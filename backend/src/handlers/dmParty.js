const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");
const { filterPublicCharacterItems } = require("../lib/specialItems");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";

  // Require DM password — owner passwords are not valid for this endpoint
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const result = await db.send(new ScanCommand({
    TableName: TABLE,
    ProjectionExpression:
      "slug, #n, nameAlt, palette, portraitUrl, hpCurrent, hpMax, #hp, tempHP, armorTotal, #c, exhaustionLevel, concentration, inspiration, spellSlots, spells, #l, race, charClass, skills, specialAbilities",
    ExpressionAttributeNames: {
      "#n": "name",
      "#c": "conditions",
      "#l": "level",
      "#hp": "hp",
    },
  }));

  const items = filterPublicCharacterItems(result.Items || []);

  return ok(items);
};
