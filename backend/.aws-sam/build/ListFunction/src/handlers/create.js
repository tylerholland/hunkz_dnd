const bcrypt = require("bcryptjs");
const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { created, badRequest, conflict } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");

exports.handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const { password, portrait, ...charData } = body;

  if (!charData.name) return badRequest("Character name is required");

  const slug = charData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!slug) return badRequest("Could not generate a valid slug from character name");
  if (isReservedCharacterSlug(slug)) return conflict(`The slug "${slug}" is reserved`);

  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (existing.Item) return conflict(`A character named "${charData.name}" already exists`);

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...charData,
      slug,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    },
  }));

  return created({ slug });
};
