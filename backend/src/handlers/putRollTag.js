const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, notFound } = require("../lib/response");
const { setRollTag, getSpecialRecord, putSpecialRecord } = require("../lib/specialRecords");
const { withVersionRetry, currentVersion } = require("../lib/versioning");
const { CHRONICLE_SESSION_PREFIX } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

const MAX_TAG_LEN = 60;

// A saved Chronicle session keeps its own copy of its events; relabel the
// event there too. Returns true when the session holds the event.
async function setSessionEventTag(sessionId, rollId, tag) {
  const slug = `${CHRONICLE_SESSION_PREFIX}${sessionId}`;
  return withVersionRetry(async () => {
    const record = await getSpecialRecord(slug);
    const events = Array.isArray(record?.events) ? record.events : [];
    const index = events.findIndex((event) => event?.id === rollId);
    if (index < 0) return false;
    const next = events.slice();
    if (tag) next[index] = { ...events[index], tag };
    else { const { tag: _drop, ...rest } = events[index]; next[index] = rest; }
    const { slug: _slug, version: _version, updatedAt: _updatedAt, ...fields } = record;
    await putSpecialRecord(slug, { ...fields, events: next }, { expectedVersion: currentVersion(record) });
    return true;
  });
}

// DM-only: label any logged event ("Persuade the goblin king"), wherever it
// lives now: the live log, the archive, and — with `sessionId` — that
// Chronicle session's saved copy. Body { tag, sessionId? }; empty clears.
exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const rollId = decodeURIComponent(event.pathParameters?.id || "");
  const body = JSON.parse(event.body || "{}");
  const tag = typeof body.tag === "string" ? body.tag.trim().slice(0, MAX_TAG_LEN) : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 80) : "";

  const inLog = await setRollTag(rollId, tag);
  const inSession = sessionId ? await setSessionEventTag(sessionId, rollId, tag) : false;
  if (!inLog && !inSession) return notFound("No such event");
  await notifySessionChanged();
  return ok({ id: rollId, tag });
};
