const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");
const { getNpcLibraryState } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  return ok(await getNpcLibraryState());
};
