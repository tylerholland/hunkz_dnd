const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok, notFound } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");

const INITIATIVE_SLUG = "initiative";

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();

  const [result, initiativeResult] = await Promise.all([
    db.send(new GetCommand({ TableName: TABLE, Key: { slug } })),
    db.send(new GetCommand({ TableName: TABLE, Key: { slug: INITIATIVE_SLUG } })),
  ]);
  if (!result.Item) return notFound();

  const { passwordHash, ...character } = result.Item;

  // Normalize legacy `hp` field: if hpCurrent is absent, synthesize from hp.
  // Does not modify DynamoDB — outgoing response normalization only.
  if (character.hpCurrent === undefined) {
    character.hpCurrent = character.hp ?? 0;
    character.hpMax = character.hpMax ?? character.hp ?? 0;
  }
  if (character.tempHP === undefined) {
    character.tempHP = 0;
  }

  const initiativeEntries = initiativeResult.Item?.entries ?? [];
  const sortedEntries = [...initiativeEntries].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
  const activeTurnIndex = initiativeResult.Item?.activeTurnIndex ?? 0;
  const activeEntry = sortedEntries[activeTurnIndex] || null;
  character.isActiveTurn = activeEntry?.slug === slug;

  return ok(character);
};
