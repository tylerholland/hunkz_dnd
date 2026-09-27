// Record versions (ADR-030). Every write to a character or sentinel record
// bumps a monotonically increasing `version` on that record; responses carry
// it so clients can drop any poll/response older than what they have already
// seen or written (stale-read protection), and read-modify-write handlers use
// it as an optimistic lock so two concurrent writers can't silently erase
// each other's change (collision protection).

const VERSION_ATTR = "version";

class VersionConflictError extends Error {
  constructor(key) {
    super(`Version conflict on ${key}`);
    this.name = "VersionConflictError";
    this.key = key;
  }
}

function isConditionalFailure(err) {
  return err?.name === "ConditionalCheckFailedException" || err?.name === "TransactionCanceledException";
}

function currentVersion(item) {
  return Number.isFinite(item?.[VERSION_ATTR]) ? item[VERSION_ATTR] : 0;
}

// Put `item` as version expected+1, only if the stored version is still
// `expected` (0 = the record must not have a version yet). Throws
// VersionConflictError when someone else wrote in between.
function conditionalPutParams(tableName, item, expected) {
  return {
    TableName: tableName,
    Item: { ...item, [VERSION_ATTR]: expected + 1 },
    ConditionExpression: "attribute_not_exists(#ver) OR #ver = :expected",
    ExpressionAttributeNames: { "#ver": VERSION_ATTR },
    ExpressionAttributeValues: { ":expected": expected },
  };
}

// Re-run a read-modify-write `fn` when its write loses a version race. `fn`
// must re-read state on every attempt.
async function withVersionRetry(fn, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof VersionConflictError)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

// For UpdateCommand writers: adds `#ver = if_not_exists(#ver, 0) + 1` to the
// SET clause lists and returns the params to merge (read back via
// ReturnValues: "UPDATED_NEW" → Attributes.version).
function addVersionBump(setClauses, names, values) {
  setClauses.push("#ver = if_not_exists(#ver, :verZero) + :verOne");
  names["#ver"] = VERSION_ATTR;
  values[":verZero"] = 0;
  values[":verOne"] = 1;
}

function characterVersionKey(slug) {
  return `char:${slug}`;
}

// Response helper: `{ ...body, versions: { [key]: version } }`.
function withVersions(body, versions) {
  const clean = Object.fromEntries(Object.entries(versions || {}).filter(([, v]) => Number.isFinite(v)));
  return Object.keys(clean).length ? { ...(body || {}), versions: clean } : body;
}

module.exports = {
  VERSION_ATTR,
  VersionConflictError,
  isConditionalFailure,
  currentVersion,
  conditionalPutParams,
  withVersionRetry,
  addVersionBump,
  characterVersionKey,
  withVersions,
};
