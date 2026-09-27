const { verifyPassword } = require("../lib/auth");
const { badRequest, forbidden, ok } = require("../lib/response");
const { savePartyRosterState } = require("../lib/specialRecords");
const { withVersions } = require("../lib/versioning");
const { PARTY_ROSTER_SLUG } = require("../lib/specialItems");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  if (!Array.isArray(body.members)) return badRequest("members must be an array");

  const members = body.members
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  // partyVisibilityEnabled is optional — if omitted it defaults to true in savePartyRosterState
  const partyVisibilityEnabled = typeof body.partyVisibilityEnabled === "boolean"
    ? body.partyVisibilityEnabled
    : undefined;

  const savedVersion = await savePartyRosterState({ members, partyVisibilityEnabled });

  return ok(withVersions({ success: true, members, partyVisibilityEnabled: partyVisibilityEnabled !== false }, { [PARTY_ROSTER_SLUG]: savedVersion }));
};
