const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");
const { filterPublicCharacterItems } = require("../lib/specialItems");
const { getPartyRosterState } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";

  // Require DM password — owner passwords are not valid for this endpoint
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const result = await db.send(new ScanCommand({
    TableName: TABLE,
    ProjectionExpression:
      "slug, #n, nameAlt, palette, portraitUrl, hpCurrent, hpMax, #hp, tempHP, armorTotal, #c, exhaustionLevel, concentration, inspiration, spellSlots, spells, #l, race, charClass, skills, specialAbilities, #dmNotes, playerNotes, hitDiceCurrent, xpCurrent, levelingMode, coin, coinMode",
    ExpressionAttributeNames: {
      "#n": "name",
      "#c": "conditions",
      "#l": "level",
      "#hp": "hp",
      "#dmNotes": "dmNotes",
    },
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
    .map((item) => {
    const { playerNotes, ...rest } = item;
    const sharedPlayerNotes = (playerNotes || []).filter((note) => note.sharedWithDm === true);
    return {
      ...rest,
      dmNotes: rest.dmNotes || [],
      sharedPlayerNotes,
    };
    });

  return ok(items);
};
