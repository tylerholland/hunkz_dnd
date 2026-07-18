const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok, notFound } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");
const { getInitiativeState } = require("../lib/specialRecords");
const {
  stripPassword,
  applyPlayerNotesVisibility,
  normalizeHpFields,
  computeIsActiveTurn,
} = require("../lib/characterProjection");

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();

  const [result, initiative] = await Promise.all([
    db.send(new GetCommand({ TableName: TABLE, Key: { slug } })),
    getInitiativeState(),
  ]);
  if (!result.Item) return notFound();

  const password = event.headers?.["x-character-password"] || "";

  let character = stripPassword(result.Item);
  character = await applyPlayerNotesVisibility(character, password, result.Item);
  character = normalizeHpFields(character);
  character.isActiveTurn = computeIsActiveTurn(initiative, slug);

  return ok(character);
};
