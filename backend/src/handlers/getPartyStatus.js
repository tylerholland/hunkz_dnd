const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok } = require("../lib/response");
const { filterPublicCharacterItems } = require("../lib/specialItems");
const { getPartyRosterState } = require("../lib/specialRecords");
const { projectPlayerCharacter } = require("../lib/partyProjection");

exports.handler = async () => {
  const roster = await getPartyRosterState();

  // Check partyVisibilityEnabled — default true
  const visEnabled = roster.partyVisibilityEnabled !== false;
  if (!visEnabled) {
    return ok({ visible: false, members: [] });
  }

  const result = await db.send(new ScanCommand({
    TableName: TABLE,
    ProjectionExpression:
      "slug, #n, palette, portraitUrl, hpCurrent, hpMax, #hp, tempHP, #c, concentration, inspiration, deathSaves",
    ExpressionAttributeNames: {
      "#n": "name",
      "#c": "conditions",
      "#hp": "hp",
    },
  }));

  const rawItems = filterPublicCharacterItems(result.Items || []);

  // Filter to roster members only (if roster exists)
  const rosterMembers = roster.exists
    ? roster.members
    : rawItems
        .filter((item) => typeof item?.slug === "string" && typeof item?.name === "string" && item.name.trim())
        .map((item) => item.slug);

  const memberSet = new Set(rosterMembers);

  const members = rawItems
    .filter((item) => memberSet.has(item.slug))
    .sort((a, b) => rosterMembers.indexOf(a.slug) - rosterMembers.indexOf(b.slug))
    // This legacy endpoint reads only a few fields, so it can't build the
    // Story 61 party card correctly — leave it off rather than send zeros.
    .map((item) => {
      const projected = projectPlayerCharacter(item);
      delete projected.partyCard;
      return projected;
    });

  return ok({ visible: true, members });
};
