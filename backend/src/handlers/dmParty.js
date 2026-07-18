const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");
const { filterPublicCharacterItems } = require("../lib/specialItems");
const { getPartyRosterState } = require("../lib/specialRecords");
const {
  DM_PARTY_PROJECTION_EXPRESSION,
  DM_PARTY_EXPRESSION_ATTRIBUTE_NAMES,
  projectDmPartyItem,
} = require("../lib/partyProjection");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";

  // Require DM password — owner passwords are not valid for this endpoint
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const result = await db.send(new ScanCommand({
    TableName: TABLE,
    ProjectionExpression: DM_PARTY_PROJECTION_EXPRESSION,
    ExpressionAttributeNames: DM_PARTY_EXPRESSION_ATTRIBUTE_NAMES,
  }));

  const rawItems = filterPublicCharacterItems(result.Items || []);
  const roster = await getPartyRosterState();
  const rosterMembers = roster.exists
    ? roster.members
    : rawItems
        .filter((item) => typeof item?.slug === "string" && typeof item?.name === "string" && item.name.trim())
        .map((item) => item.slug);
  const memberSet = new Set(rosterMembers);

  const items = rawItems
    .filter((item) => memberSet.has(item.slug))
    .sort((a, b) => rosterMembers.indexOf(a.slug) - rosterMembers.indexOf(b.slug))
    .map(projectDmPartyItem);

  return ok(items);
};
