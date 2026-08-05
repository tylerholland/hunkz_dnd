const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

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

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  // x-session-token remains a future escape hatch for an authenticated
  // session-token flow. Otherwise require owner or DM credentials, including
  // the explicit empty string for intentionally passwordless characters.
  if (!sessionToken) {
    if (password === undefined || password === null) return forbidden();
    const auth = await verifyPassword(password, result.Item);
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
  if (Object.prototype.hasOwnProperty.call(body, "hpCurrent") && typeof body.hpCurrent === "number") {
    const prevHp = result.Item.hpCurrent ?? result.Item.hp ?? 0;
    if (typeof prevHp === "number" && body.hpCurrent < prevHp) {
      updates.push("#lastDamagedAt = :lastDamagedAt", "#lastDamageAmount = :lastDamageAmount");
      names["#lastDamagedAt"] = "lastDamagedAt";
      names["#lastDamageAmount"] = "lastDamageAmount";
      values[":lastDamagedAt"] = new Date().toISOString();
      values[":lastDamageAmount"] = prevHp - body.hpCurrent;
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
