const { BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok } = require("../lib/response");
const { normalizeMapLibraryRecord, normalizeNpcCombatRecord } = require("../lib/specialRecords");
const { NPC_COMBAT_SLUG, MAP_LIBRARY_SLUG } = require("../lib/specialItems");
const {
  annotateTokensWithInvisibility,
  omitInvisibleNpcTokensForPlayers,
  makeNpcConditionsResolver,
} = require("../lib/tokenVisibility");

// GET /maps — unauthenticated. Story 54: this is the leak a getSessionState-
// only fix would miss (a six-line, fully unauthenticated handler that used to
// return the map library verbatim, positions and all). Now folds in the
// npc-combat sentinel via one BatchGetCommand (not a second GetCommand) so
// invisible NPC tokens can be omitted here too, not just from the polled
// session-state endpoint. PC tokens are never omitted (a player always sees
// a veiled ally) — this endpoint has no character records to resolve PC
// conditions against and doesn't need them for the omission rule.
exports.handler = async () => {
  const result = await db.send(new BatchGetCommand({
    RequestItems: {
      [TABLE]: { Keys: [{ slug: MAP_LIBRARY_SLUG }, { slug: NPC_COMBAT_SLUG }] },
    },
  }));
  const bySlug = new Map((result.Responses?.[TABLE] || []).map((item) => [item.slug, item]));

  const mapLibrary = normalizeMapLibraryRecord(bySlug.get(MAP_LIBRARY_SLUG));
  const npcCombat = normalizeNpcCombatRecord(bySlug.get(NPC_COMBAT_SLUG));
  const getNpcConditions = makeNpcConditionsResolver(npcCombat);

  const maps = mapLibrary.maps.map((map) => ({
    ...map,
    tokens: omitInvisibleNpcTokensForPlayers(
      annotateTokensWithInvisibility(map.tokens, { getCharacterConditions: null, getNpcConditions })
    ),
  }));

  return ok({ ...mapLibrary, maps });
};
