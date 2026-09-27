const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { saveHouseRulesState } = require("../lib/specialRecords");
const { isValidCheckDice, normalizeHouseRulesRecord } = require("../lib/houseRules");
const { notifySessionChanged } = require("../lib/broadcast");

// DM-only: replace the table's house rules. Every client picks the new rules
// up from getSessionState on its next poll (nudged immediately via WS).
exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  if (!isValidCheckDice(body.abilityCheckDice)) {
    return badRequest("abilityCheckDice must look like NdS (e.g. 2d6 or 1d20), 1–10 dice of 2–100 sides");
  }

  const houseRules = normalizeHouseRulesRecord(body);
  await saveHouseRulesState(houseRules);
  await notifySessionChanged();
  return ok({ houseRules });
};
