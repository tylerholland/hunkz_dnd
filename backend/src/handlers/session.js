const { BatchGetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden } = require("../lib/response");
const { isReservedCharacterSlug, INITIATIVE_SLUG } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");
const { normalizeInitiativeRecord } = require("../lib/specialRecords");
const { resolveAttackerRef } = require("../lib/initiativeProjection");

// Session fields require owner or DM auth. Empty-string passwords are valid
// for characters explicitly configured with no password gate.

const SESSION_FIELDS = [
  "hpCurrent",
  "tempHP",
  "spellSlots",
  "conditions",
  "exhaustionLevel",
  "concentration",
  "inspiration",
  "weapons",
  "equipment",
  "playerNotes",
  "hitDiceCurrent",
  "xpCurrent",
  "coin",
  "deathSaves",
];

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();
  const headers = event.headers || {};
  const password = headers["x-character-password"];
  const sessionToken = headers["x-session-token"];
  const body = JSON.parse(event.body || "{}");

  // Story 55 — widened from a plain GetCommand to a BatchGetCommand for
  // {slug, "initiative"} so the attacker can be resolved in the same round
  // trip that already fetches the character for auth — no added latency.
  const batchResult = await db.send(new BatchGetCommand({
    RequestItems: { [TABLE]: { Keys: [{ slug }, { slug: INITIATIVE_SLUG }] } },
  }));
  const batchItems = batchResult.Responses?.[TABLE] || [];
  const characterItem = batchItems.find((item) => item.slug === slug);
  const initiativeItem = batchItems.find((item) => item.slug === INITIATIVE_SLUG);
  if (!characterItem) return notFound();

  // x-session-token remains a future escape hatch for an authenticated
  // session-token flow. Otherwise require owner or DM credentials, including
  // the explicit empty string for intentionally passwordless characters.
  if (!sessionToken) {
    if (password === undefined || password === null) return forbidden();
    const auth = await verifyPassword(password, characterItem);
    if (!auth.valid) return forbidden();
  }

  // Build a partial UpdateExpression covering only the provided session fields
  const updates = [];
  const names = {};
  const values = {};

  for (const field of SESSION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates.push(`#${field} = :${field}`);
      names[`#${field}`] = field;
      values[`:${field}`] = body[field];
    }
  }

  if (updates.length === 0) {
    return ok({ slug });
  }

  // Story 52 — damage flash stamp. session.js already fetches the previous
  // item above for auth, so the prior hpCurrent is in hand for free. Any
  // strict decrease is treated as damage (healing/tempHP/hpMax edits do not
  // touch hpCurrent downward and are excluded by construction).
  // Story 55 — `lastDamageFrom` is stamped in the SAME write, per ADR-022,
  // which is what makes the two beats (tracer + flash) atomic by
  // construction — they cannot separate across a poll boundary, a WebSocket
  // nudge, a reconnect, or a tab return.
  if (Object.prototype.hasOwnProperty.call(body, "hpCurrent") && typeof body.hpCurrent === "number") {
    const prevHp = characterItem.hpCurrent ?? characterItem.hp ?? 0;
    if (typeof prevHp === "number" && body.hpCurrent < prevHp) {
      const initiative = normalizeInitiativeRecord(initiativeItem);
      const attackerRef = resolveAttackerRef(initiative, { type: "character", sourceId: slug });
      updates.push(
        "#lastDamagedAt = :lastDamagedAt",
        "#lastDamageAmount = :lastDamageAmount",
        "#lastDamageFrom = :lastDamageFrom"
      );
      names["#lastDamagedAt"] = "lastDamagedAt";
      names["#lastDamageAmount"] = "lastDamageAmount";
      names["#lastDamageFrom"] = "lastDamageFrom";
      values[":lastDamagedAt"] = new Date().toISOString();
      values[":lastDamageAmount"] = prevHp - body.hpCurrent;
      values[":lastDamageFrom"] = attackerRef;
    }
  }

  // Always update the timestamp
  updates.push("#updatedAt = :updatedAt");
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = new Date().toISOString();

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { slug },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));

  await notifySessionChanged();

  return ok({ slug });
};
