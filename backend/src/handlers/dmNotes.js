const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");

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

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  const existing = result.Item.dmNotes || [];

  let updated;
  if (action === "add") {
    const text = (body.text || "").trim().slice(0, 500);
    if (!text) return badRequest("text is required");
    const newNote = {
      id: require("crypto").randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    };
    updated = [...existing, newNote];
  } else {
    // action === "delete"
    const { id } = body;
    if (!id) return badRequest("id is required for delete");
    updated = existing.filter((note) => note.id !== id);
  }

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { slug },
    UpdateExpression: "SET #dmNotes = :dmNotes, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#dmNotes": "dmNotes",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":dmNotes": updated,
      ":updatedAt": new Date().toISOString(),
    },
  }));

  return ok({ dmNotes: updated });
};
