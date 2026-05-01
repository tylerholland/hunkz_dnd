const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");

const INITIATIVE_SLUG = "initiative";

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const password = event.headers?.["x-character-password"] || "";

  // Both GET and PUT require DM auth
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  if (method === "GET") {
    const result = await db.send(new GetCommand({
      TableName: TABLE,
      Key: { slug: INITIATIVE_SLUG },
    }));

    if (!result.Item) {
      return ok({ entries: [], activeTurnIndex: 0 });
    }

    return ok({
      entries: result.Item.entries ?? [],
      activeTurnIndex: result.Item.activeTurnIndex ?? 0,
    });
  }

  if (method === "PUT") {
    const body = JSON.parse(event.body || "{}");

    if (!Array.isArray(body.entries)) {
      return badRequest("entries must be an array");
    }

    await db.send(new PutCommand({
      TableName: TABLE,
      Item: {
        slug: INITIATIVE_SLUG,
        entries: body.entries,
        activeTurnIndex: body.activeTurnIndex ?? 0,
        updatedAt: new Date().toISOString(),
      },
    }));

    return ok({ success: true });
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
