const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");

// Session fields are intentionally writable without auth — see ADR-005 and story 05 architect notes

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
];

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();
  const password = event.headers?.["x-character-password"] || "";
  const sessionToken = event.headers?.["x-session-token"];
  const body = JSON.parse(event.body || "{}");

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  // Auth: if password header is present, verify it (owner or DM both accepted).
  // If absent, allow the write — session state is intentionally writable without auth.
  // x-session-token accepted as valid auth (full token validation in future story).
  if (password && !sessionToken) {
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

  return ok({ slug });
};
