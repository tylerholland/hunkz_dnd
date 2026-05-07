const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { saveNpcCombatState } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  if (!Array.isArray(body.npcs)) return badRequest("npcs must be an array");

  await saveNpcCombatState({ npcs: body.npcs });

  return ok({ success: true });
};
