const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");
const { getRollHistoryState, getRollHistoryArchive } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const live = await getRollHistoryState();
  // ?archive=1 — also return the events that aged out of the live feed
  // (Story 69: recording a session from weeks ago).
  if (event.queryStringParameters?.archive === "1") {
    return ok({ ...live, archived: await getRollHistoryArchive() });
  }
  return ok(live);
};
