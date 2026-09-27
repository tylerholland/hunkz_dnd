const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { VersionConflictError, isConditionalFailure, currentVersion, withVersionRetry, characterVersionKey, withVersions } = require("../lib/versioning");
const { isReservedCharacterSlug } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();

  const password = event.headers?.["x-character-password"] || "";

  // Always require DM auth for this endpoint
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const { action } = body;

  if (!action || (action !== "add" && action !== "delete")) {
    return badRequest('action must be "add" or "delete"');
  }

  // Read-modify-write under the version lock (ADR-030): if another write to
  // this character lands in between, re-read and re-apply so no note is lost.
  if (action === "add" && !(body.text || "").trim()) return badRequest("text is required");
  if (action === "delete" && !body.id) return badRequest("id is required for delete");
  const noteToAdd = action === "add"
    ? { id: require("crypto").randomUUID(), text: body.text.trim().slice(0, 500), createdAt: new Date().toISOString() }
    : null;

  let outcome;
  try {
    outcome = await withVersionRetry(async () => {
      const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
      if (!result.Item) return null;
      const existing = result.Item.dmNotes || [];
      const updated = noteToAdd ? [...existing, noteToAdd] : existing.filter((note) => note.id !== body.id);
      const expected = currentVersion(result.Item);
      try {
        const res = await db.send(new UpdateCommand({
          TableName: TABLE,
          Key: { slug },
          UpdateExpression: "SET #dmNotes = :dmNotes, #updatedAt = :updatedAt, #ver = :next",
          ConditionExpression: "attribute_not_exists(#ver) OR #ver = :expected",
          ExpressionAttributeNames: { "#dmNotes": "dmNotes", "#updatedAt": "updatedAt", "#ver": "version" },
          ExpressionAttributeValues: {
            ":dmNotes": updated,
            ":updatedAt": new Date().toISOString(),
            ":expected": expected,
            ":next": expected + 1,
          },
          ReturnValues: "UPDATED_NEW",
        }));
        return { updated, version: res.Attributes?.version ?? expected + 1 };
      } catch (err) {
        if (isConditionalFailure(err)) throw new VersionConflictError(characterVersionKey(slug));
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  }
  if (!outcome) return notFound();

  await notifySessionChanged();

  return ok(withVersions({ dmNotes: outcome.updated }, { [characterVersionKey(slug)]: outcome.version }));
};
