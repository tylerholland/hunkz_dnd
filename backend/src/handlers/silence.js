// "Request silence". One function behind /silence:
//   PUT  /silence       { action: "start" | "lift" } — the DM
//   POST /silence/ack   { asSlug, id } — a player taps "I'm listening"
// Polls carry it (getSessionState → lib/silence.js normalizeSilence).
const crypto = require("crypto");
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { getSpecialRecord, putSpecialRecord } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");
const { currentVersion, withVersionRetry, VersionConflictError } = require("../lib/versioning");
const { SILENCE_SLUG, isReservedCharacterSlug } = require("../lib/specialItems");
const { normalizeSilence, startSilence, acknowledge } = require("../lib/silence");

async function isDm(event) {
  const password = event.headers?.["x-character-password"];
  if (password === undefined || password === null) return false;
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  return auth.valid && auth.role === "dm";
}

// True when the password is the character's own (or the DM's).
async function canActFor(event, slug) {
  if (typeof slug !== "string" || !slug.trim() || isReservedCharacterSlug(slug.trim())) return false;
  const got = await db.send(new GetCommand({ TableName: TABLE, Key: { slug: slug.trim() }, ProjectionExpression: "slug, passwordHash" }));
  if (!got.Item) return false;
  return (await verifyPassword(event.headers?.["x-character-password"] ?? "", got.Item)).valid;
}

async function readSilence() {
  const item = await getSpecialRecord(SILENCE_SLUG);
  return { silence: normalizeSilence(item), version: currentVersion(item) };
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = (event.rawPath || event.path || "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean); // ["silence", ...]
  if (parts[0] !== "silence") return notFound();
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }

  try {
    // PUT /silence — the DM asks for quiet, or lifts it
    if (parts.length === 1 && method === "PUT") {
      if (!(await isDm(event))) return forbidden("DM password required");
      if (body.action !== "start" && body.action !== "lift") return badRequest("Unknown action");
      const saved = await withVersionRetry(async () => {
        const { version } = await readSilence();
        const next = body.action === "start" ? startSilence({ id: crypto.randomUUID() }) : null;
        await putSpecialRecord(SILENCE_SLUG, next || { cleared: new Date().toISOString() }, { expectedVersion: version });
        return next;
      });
      await notifySessionChanged();
      return ok({ silence: saved });
    }

    // POST /silence/ack — a player is listening
    if (parts[1] === "ack" && parts.length === 2 && method === "POST") {
      const slug = typeof body.asSlug === "string" ? body.asSlug.trim() : "";
      if (!slug) return badRequest("asSlug is required");
      if (!(await canActFor(event, slug))) return forbidden("That character's password is required");
      const saved = await withVersionRetry(async () => {
        const { silence, version } = await readSilence();
        if (!silence || silence.id !== body.id) return { done: true }; // already lifted: nothing to do
        const next = acknowledge(silence, slug);
        if (next.silence === silence) return { silence };
        await putSpecialRecord(SILENCE_SLUG, next.silence, { expectedVersion: version });
        return { silence: next.silence };
      });
      if (saved.silence) await notifySessionChanged();
      return ok({ silence: saved.silence || null });
    }
  } catch (err) {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  }
  return notFound();
};
