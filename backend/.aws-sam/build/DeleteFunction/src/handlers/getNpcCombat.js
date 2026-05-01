const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");

const NPC_COMBAT_SLUG = "npc-combat";

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const result = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { slug: NPC_COMBAT_SLUG },
  }));

  if (!result.Item) return ok({ npcs: [] });
  return ok({ npcs: result.Item.npcs ?? [] });
};
