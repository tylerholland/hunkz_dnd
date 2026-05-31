const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok } = require("../lib/response");
const { filterPublicCharacterItems } = require("../lib/specialItems");
const { getPartyRosterState } = require("../lib/specialRecords");

exports.handler = async () => {
  const roster = await getPartyRosterState();

  if (roster.exists) {
    return ok({ exists: true, members: roster.members, partyVisibilityEnabled: roster.partyVisibilityEnabled !== false });
  }

  const result = await db.send(new ScanCommand({
    TableName: TABLE,
    ProjectionExpression: "slug, #n",
    ExpressionAttributeNames: {
      "#n": "name",
    },
  }));

  const members = filterPublicCharacterItems(result.Items || [])
    .filter((item) => typeof item?.slug === "string" && typeof item?.name === "string" && item.name.trim())
    .map((item) => item.slug);

  return ok({ exists: false, members });
};
