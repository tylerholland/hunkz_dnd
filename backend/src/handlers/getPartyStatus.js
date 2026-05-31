const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok } = require("../lib/response");
const { filterPublicCharacterItems } = require("../lib/specialItems");
const { getPartyRosterState } = require("../lib/specialRecords");

// Fields visible to players in the party status strip
const PLAYER_VISIBLE_FIELDS = new Set([
  "slug",
  "name",
  "palette",
  "portraitUrl",
  "hpCurrent",
  "hpMax",
  "tempHP",
  "conditions",
  "concentration",
  "inspiration",
  "deathSaves",
]);

function projectCharacter(item) {
  const projected = {};
  for (const field of PLAYER_VISIBLE_FIELDS) {
    if (field in item) {
      projected[field] = item[field];
    }
  }
  // Normalise defaults for optional session fields
  projected.hpCurrent = item.hpCurrent ?? item.hp ?? 0;
  projected.hpMax = item.hpMax ?? item.hp ?? 0;
  projected.tempHP = item.tempHP ?? 0;
  projected.conditions = Array.isArray(item.conditions) ? item.conditions : [];
  projected.concentration = item.concentration ?? { active: false, spell: "" };
  projected.inspiration = item.inspiration ?? false;
  projected.deathSaves = item.deathSaves ?? { successes: 0, failures: 0 };
  return projected;
}

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
    .map(projectCharacter);

  return ok({ visible: true, members });
};
