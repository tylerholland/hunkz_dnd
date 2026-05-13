const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");
const { getInitiativeState } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();

  const [result, initiative] = await Promise.all([
    db.send(new GetCommand({ TableName: TABLE, Key: { slug } })),
    getInitiativeState(),
  ]);
  if (!result.Item) return notFound();

  const { passwordHash, ...character } = result.Item;

  // Privacy: filter playerNotes based on auth level.
  // Unauthenticated: strip entirely. Owner: full array. DM: only sharedWithDm === true.
  const password = event.headers?.["x-character-password"] || "";
  if (!password) {
    delete character.playerNotes;
  } else {
    const auth = await verifyPassword(password, result.Item);
    if (!auth.valid) {
      delete character.playerNotes;
    } else if (auth.role === "dm") {
      const allNotes = character.playerNotes || [];
      character.playerNotes = allNotes.filter((note) => note.sharedWithDm === true);
    }
    // auth.role === "owner": return full playerNotes as-is
  }

  // Normalize legacy `hp` field: if hpCurrent is absent, synthesize from hp.
  // Does not modify DynamoDB — outgoing response normalization only.
  if (character.hpCurrent === undefined) {
    character.hpCurrent = character.hp ?? 0;
    character.hpMax = character.hpMax ?? character.hp ?? 0;
  }
  if (character.tempHP === undefined) {
    character.tempHP = 0;
  }

  const initiativeEntries = initiative.entries ?? [];
  const sortedEntries = [...initiativeEntries].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
  const activeTurnIndex = initiative.activeTurnIndex ?? 0;
  const activeEntry = sortedEntries[activeTurnIndex] || null;
  character.isActiveTurn = activeEntry?.slug === slug;

  return ok(character);
};
