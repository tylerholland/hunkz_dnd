const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");

const NPC_COMBAT_SLUG = "npc-combat";

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  if (!Array.isArray(body.npcs)) return badRequest("npcs must be an array");

  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { slug: NPC_COMBAT_SLUG, npcs: body.npcs, updatedAt: new Date().toISOString() },
  }));

  return ok({ success: true });
};
