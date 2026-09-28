const { BatchGetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden } = require("../lib/response");
const { isReservedCharacterSlug, INITIATIVE_SLUG } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");
const { addVersionBump, characterVersionKey, withVersions } = require("../lib/versioning");
const { normalizeInitiativeRecord, markRollApplied } = require("../lib/specialRecords");
const { resolveAttackerRef } = require("../lib/initiativeProjection");
const { sanitizeFx, buildLastFx } = require("../lib/combatFx");

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

  // ADR-032 — the chosen action (DM map / Deal Damage). A miss changes no
  // field but still stamps lastFx so every screen plays the swing.
  const fx = sanitizeFx(body.fx);
  const setField = (field, value) => {
    updates.push(`#${field} = :${field}`);
    names[`#${field}`] = field;
    values[`:${field}`] = value;
  };
  let applied = null;
  const hpInBody = Object.prototype.hasOwnProperty.call(body, "hpCurrent") && typeof body.hpCurrent === "number";
  const prevHpForFx = characterItem.hpCurrent ?? characterItem.hp ?? 0;
  if (fx && fx.miss && (!hpInBody || body.hpCurrent === prevHpForFx)) {
    setField("lastFx", buildLastFx(fx, "miss", new Date().toISOString()));
    applied = { kind: "miss", amount: 0 };
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
      values[":lastDamageFrom"] = fx?.attacker || attackerRef;
      if (fx && !fx.miss) {
        setField("lastFx", buildLastFx(fx, "damage", values[":lastDamagedAt"]));
        applied = { kind: "damage", amount: prevHp - body.hpCurrent };
      }
    } else if (typeof prevHp === "number" && body.hpCurrent > prevHp) {
      // Combat FX (ADR-031) — heal stamp, the mirror of the damage stamp,
      // so every map can play the healing effect once. The healer is the
      // active combatant, resolved the same way as an attacker.
      const initiative = normalizeInitiativeRecord(initiativeItem);
      const healerRef = resolveAttackerRef(initiative, { type: "character", sourceId: slug });
      updates.push(
        "#lastHealedAt = :lastHealedAt",
        "#lastHealAmount = :lastHealAmount",
        "#lastHealFrom = :lastHealFrom"
      );
      names["#lastHealedAt"] = "lastHealedAt";
      names["#lastHealAmount"] = "lastHealAmount";
      names["#lastHealFrom"] = "lastHealFrom";
      values[":lastHealedAt"] = new Date().toISOString();
      values[":lastHealAmount"] = body.hpCurrent - prevHp;
      values[":lastHealFrom"] = fx?.attacker || healerRef;
      if (fx && !fx.miss) {
        setField("lastFx", buildLastFx(fx, "heal", values[":lastHealedAt"]));
        applied = { kind: "heal", amount: body.hpCurrent - prevHp };
      }
    }
  }

  // Always update the timestamp
  updates.push("#updatedAt = :updatedAt");
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = new Date().toISOString();

  // ADR-030 — bump the record version in the same write (field-level SETs,
  // so an atomic +1 is enough; no read-modify-write here).
  addVersionBump(updates, names, values);

  const writeResult = await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { slug },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: "UPDATED_NEW",
  }));

  if (applied && fx?.rollId) {
    await markRollApplied(fx.rollId, { ...applied, at: new Date().toISOString() });
  }

  await notifySessionChanged();

  return ok(withVersions({ slug }, { [characterVersionKey(slug)]: writeResult?.Attributes?.version }));
};
