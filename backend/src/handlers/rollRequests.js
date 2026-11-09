// Roll requests. One function behind /roll-requests:
//   PUT  /roll-requests          { action, ... } — the DM: "start" (label, check,
//                                targets, dc, showDc, adv), "reveal" { id },
//                                "close" { id, names } (logged; names = slug → name for the log), "cancel" { id } (dropped)
//   POST /roll-requests/result   { asSlug, id, total, rolls, manual } — a player
//                                sends their roll (their password, or the DM's)
// Polls carry them (getSessionState → lib/rollRequests.js projectRollRequests).
const crypto = require("crypto");
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { getSpecialRecord, putSpecialRecord, appendRollHistoryEvent, getPartyRosterState } = require("../lib/specialRecords");
const { normalizeHouseRulesRecord } = require("../lib/houseRules");
const { notifySessionChanged } = require("../lib/broadcast");
const { currentVersion, withVersionRetry, VersionConflictError } = require("../lib/versioning");
const { ROLL_REQUESTS_SLUG, HOUSE_RULES_SLUG, isReservedCharacterSlug } = require("../lib/specialItems");
const { startRequest, normalizeRollRequests, addRequest, recordResult, projectRollRequests, rollRequestLogEvent } = require("../lib/rollRequests");

async function isDm(event) {
  const password = event.headers?.["x-character-password"];
  if (password === undefined || password === null) return false;
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  return auth.valid && auth.role === "dm";
}

// True when the password is the character's own (or the DM's).
async function canRollFor(event, slug) {
  if (typeof slug !== "string" || !slug.trim() || isReservedCharacterSlug(slug.trim())) return false;
  const got = await db.send(new GetCommand({ TableName: TABLE, Key: { slug: slug.trim() }, ProjectionExpression: "slug, passwordHash" }));
  if (!got.Item) return false;
  const auth = await verifyPassword(event.headers?.["x-character-password"] ?? "", got.Item);
  return auth.valid;
}

async function readState() {
  const item = await getSpecialRecord(ROLL_REQUESTS_SLUG);
  return { state: normalizeRollRequests(item), version: currentVersion(item) };
}

const save = (state, version) => putSpecialRecord(ROLL_REQUESTS_SLUG, { requests: state.requests }, { expectedVersion: version });

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = (event.rawPath || event.path || "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean); // ["roll-requests", ...]
  if (parts[0] !== "roll-requests") return notFound();
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }

  // PUT /roll-requests — the DM asks, reveals, closes or cancels
  if (parts.length === 1 && method === "PUT") {
    if (!(await isDm(event))) return forbidden("DM password required");
    const action = body.action;
    try {
      const saved = await withVersionRetry(async () => {
        const { state, version } = await readState();
        if (action === "start") {
          const [roster, rulesItem] = await Promise.all([getPartyRosterState(), getSpecialRecord(HOUSE_RULES_SLUG)]);
          const rules = normalizeHouseRulesRecord(rulesItem);
          const request = startRequest(body, { id: crypto.randomUUID(), rules, partySlugs: roster.exists ? roster.members : [] });
          if (request.error) return { error: badRequest(request.error) };
          const added = addRequest(state, request);
          if (added.error) return { error: conflict(added.error) };
          await save(added.state, version);
          return { state: added.state, request };
        }
        const request = state.requests.find((r) => r.id === body.id);
        if (!request) return { error: notFound("That roll request has ended") };
        if (action === "reveal") {
          const next = { requests: state.requests.map((r) => (r.id === request.id ? { ...r, revealed: true } : r)) };
          await save(next, version);
          return { state: next, request: { ...request, revealed: true } };
        }
        if (action === "close" || action === "cancel") {
          const next = { requests: state.requests.filter((r) => r.id !== request.id) };
          await save(next, version);
          return { state: next, finished: action === "close" ? request : null };
        }
        return { error: badRequest("Unknown action") };
      });
      if (saved.error) return saved.error;
      // A closed request goes in the session log once the write has stuck.
      if (saved.finished) {
        try { await appendRollHistoryEvent(rollRequestLogEvent(saved.finished, body.names)); } catch { /* the rolls already happened */ }
      }
      await notifySessionChanged();
      return ok({ rollRequests: projectRollRequests(saved.state, { isDm: true }) });
    } catch (err) {
      if (err instanceof VersionConflictError) return conflict("Busy — please try again");
      throw err;
    }
  }

  // POST /roll-requests/result — a player sends their roll
  if (parts[1] === "result" && parts.length === 2 && method === "POST") {
    const slug = typeof body.asSlug === "string" ? body.asSlug.trim() : "";
    if (!slug) return badRequest("asSlug is required");
    if (!(await canRollFor(event, slug))) return forbidden("That character's password is required");
    try {
      const saved = await withVersionRetry(async () => {
        const { state, version } = await readState();
        const current = state.requests.find((r) => r.id === body.id);
        const done = recordResult(current, slug, body);
        if (done.error) return { error: conflict(done.error) };
        const next = { requests: state.requests.map((r) => (r.id === current.id ? done.request : r)) };
        await save(next, version);
        return { state: next };
      });
      if (saved.error) return saved.error;
      await notifySessionChanged();
      return ok({ rollRequests: projectRollRequests(saved.state, { slug }) });
    } catch (err) {
      if (err instanceof VersionConflictError) return conflict("Busy — please try again");
      throw err;
    }
  }

  return notFound();
};
