// Story 35 — GET /session-state
// Consolidates the DM dashboard's 5-endpoint poll and the player session
// mode's 4-endpoint poll into a single request, cutting each client's
// steady-state polling to exactly one HTTP request per tick.
//
// DM variant (valid DM password): { party, initiative, npcCombat, rollHistory,
//   mapLibrary, counterWheels, serverTime, buildVersion } plus an optional
//   `character` field when `?slug=` is supplied.
// Public variant (no/invalid DM password): { partyStatus, initiativePublic,
//   mapLibrary, rollHistory, serverTime, buildVersion } with an optional
//   `character` field when `?slug=` is supplied (same stripping rules as
//   GET /characters/{slug} unauthenticated).
//
// Reads: one BatchGetItem for the sentinel records (initiative, npc-combat,
// roll-history, map-library, party-roster, counter-wheels, app-meta —
// npc-library is intentionally excluded, it is not polled), and — only when
// there are party members (or a requested ?slug) to resolve — a second
// BatchGetItem keyed off the roster. Two DynamoDB round trips max.
//
// buildVersion (Story 36b) comes from the app-meta sentinel, which is
// written directly by deploy.sh (not by any handler) — absent sentinel
// normalizes to buildVersion: null, so clients on a pre-36b bundle simply
// never see a version to compare against and never reload.

const { BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok } = require("../lib/response");
const {
  INITIATIVE_SLUG,
  NPC_COMBAT_SLUG,
  ROLL_HISTORY_SLUG,
  MAP_LIBRARY_SLUG,
  PARTY_ROSTER_SLUG,
  COUNTER_WHEELS_SLUG,
  APP_META_SLUG,
  isReservedCharacterSlug,
} = require("../lib/specialItems");
const {
  normalizeInitiativeRecord,
  normalizeNpcCombatRecord,
  normalizeRollHistoryRecord,
  normalizeMapLibraryRecord,
  normalizePartyRosterRecord,
  normalizeCounterWheelsRecord,
  normalizeAppMetaRecord,
} = require("../lib/specialRecords");
const { projectDmPartyItem, projectPlayerCharacter } = require("../lib/partyProjection");
const { buildPublicInitiativePayload, publicNpcConditionsByNpcId } = require("../lib/initiativeProjection");
const {
  stripPassword,
  applyPlayerNotesVisibility,
  normalizeHpFields,
  computeIsActiveTurn,
} = require("../lib/characterProjection");
const {
  annotateTokensWithInvisibility,
  omitInvisibleNpcTokensForPlayers,
  makeCharacterConditionsResolver,
  makeNpcConditionsResolver,
} = require("../lib/tokenVisibility");

// Story 54 — annotate every token on every map with a server-derived
// `invisible` flag (never trust/re-derive it client-side).
function annotateMapLibrary(mapLibrary, { rawItemsBySlug, npcCombat }) {
  const getCharacterConditions = makeCharacterConditionsResolver(rawItemsBySlug);
  const getNpcConditions = makeNpcConditionsResolver(npcCombat);
  return {
    ...mapLibrary,
    maps: mapLibrary.maps.map((map) => ({
      ...map,
      tokens: annotateTokensWithInvisibility(map.tokens, { getCharacterConditions, getNpcConditions }),
    })),
  };
}

const SENTINEL_SLUGS = [
  INITIATIVE_SLUG,
  NPC_COMBAT_SLUG,
  ROLL_HISTORY_SLUG,
  MAP_LIBRARY_SLUG,
  PARTY_ROSTER_SLUG,
  COUNTER_WHEELS_SLUG,
  APP_META_SLUG,
];

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  const isDm = auth.valid && auth.role === "dm";

  const rawSlug = event.queryStringParameters?.slug;
  const querySlug = typeof rawSlug === "string" && rawSlug.trim() && !isReservedCharacterSlug(rawSlug.trim())
    ? rawSlug.trim()
    : null;

  // Round trip 1 — sentinels, single BatchGetItem
  const sentinelResult = await db.send(new BatchGetCommand({
    RequestItems: {
      [TABLE]: { Keys: SENTINEL_SLUGS.map((slug) => ({ slug })) },
    },
  }));
  const sentinelBySlug = new Map(
    (sentinelResult.Responses?.[TABLE] || []).map((item) => [item.slug, item])
  );

  const initiative = normalizeInitiativeRecord(sentinelBySlug.get(INITIATIVE_SLUG));
  const npcCombat = normalizeNpcCombatRecord(sentinelBySlug.get(NPC_COMBAT_SLUG));
  const rollHistory = normalizeRollHistoryRecord(sentinelBySlug.get(ROLL_HISTORY_SLUG));
  const mapLibrary = normalizeMapLibraryRecord(sentinelBySlug.get(MAP_LIBRARY_SLUG));
  const roster = normalizePartyRosterRecord(sentinelBySlug.get(PARTY_ROSTER_SLUG));
  const counterWheels = normalizeCounterWheelsRecord(sentinelBySlug.get(COUNTER_WHEELS_SLUG));
  const appMeta = normalizeAppMetaRecord(sentinelBySlug.get(APP_META_SLUG));
  const serverTime = new Date().toISOString();

  // Round trip 2 — party members (+ optional ?slug target), single BatchGetItem.
  // Keyed off the roster only — if no roster item exists yet, party/partyStatus
  // is simply empty for this endpoint (old endpoints keep their Scan-based
  // fallback for that edge case; see Story 35 architect notes: "two round
  // trips max").
  const memberSlugs = new Set(roster.exists ? roster.members : []);
  if (!isDm && querySlug) memberSlugs.add(querySlug);

  const rawItemsBySlug = new Map();
  if (memberSlugs.size > 0) {
    const partyResult = await db.send(new BatchGetCommand({
      RequestItems: {
        [TABLE]: { Keys: Array.from(memberSlugs).map((slug) => ({ slug })) },
      },
    }));
    for (const item of partyResult.Responses?.[TABLE] || []) {
      if (item?.slug && !isReservedCharacterSlug(item.slug)) {
        rawItemsBySlug.set(item.slug, item);
      }
    }
  }

  // Story 54 — one server-computed `invisible` flag per token, shared by the
  // DM's `◇` marker and the player-side omission below so they can never
  // drift. Computed once here (not re-derived by any client).
  const annotatedMapLibrary = annotateMapLibrary(mapLibrary, { rawItemsBySlug, npcCombat });

  if (isDm) {
    const orderedMembers = roster.exists ? roster.members : Array.from(rawItemsBySlug.keys());
    const party = orderedMembers
      .filter((slug) => rawItemsBySlug.has(slug))
      .map((slug) => projectDmPartyItem(rawItemsBySlug.get(slug)));
    const responseBody = {
      party,
      initiative,
      npcCombat,
      rollHistory,
      mapLibrary: annotatedMapLibrary,
      counterWheels,
      serverTime,
      buildVersion: appMeta.buildVersion,
    };

    if (querySlug) {
      const rawCharacterItem = rawItemsBySlug.get(querySlug);
      if (rawCharacterItem) {
        let character = stripPassword(rawCharacterItem);
        character = await applyPlayerNotesVisibility(character, password, rawCharacterItem);
        character = normalizeHpFields(character);
        character.isActiveTurn = computeIsActiveTurn(initiative, querySlug);
        responseBody.character = character;
      }
    }

    return ok(responseBody);
  }

  // Public variant
  const visEnabled = roster.partyVisibilityEnabled !== false;
  const orderedMembers = roster.exists ? roster.members : [];
  const partyStatus = visEnabled
    ? {
        visible: true,
        members: orderedMembers
          .filter((slug) => rawItemsBySlug.has(slug))
          .map((slug) => projectPlayerCharacter(rawItemsBySlug.get(slug))),
      }
    : { visible: false, members: [] };

  // Strip to name+portraitUrl only — HP/notes stay DM-only. Story 53 adds
  // `conditions` (gated on the linked initiative entry not being hidden —
  // the DM's existing secrecy lever). Story 52 adds the damage-flash sync
  // fields (not secret data, ungated).
  const publicNpcConditions = publicNpcConditionsByNpcId(initiative, npcCombat);
  const npcCombatPublic = {
    npcs: npcCombat.npcs.map((n) => ({
      id: n.id,
      name: n.name,
      portraitUrl: n.portraitUrl ?? null,
      conditions: publicNpcConditions[n.id] ?? [],
      lastDamagedAt: n.lastDamagedAt ?? null,
      lastDamageAmount: n.lastDamageAmount ?? null,
    })),
  };

  // Story 54 — the public variant additionally omits every invisible NPC
  // token entirely (a true absence, never a diminished/hinted rendering).
  const publicMapLibrary = {
    ...annotatedMapLibrary,
    maps: annotatedMapLibrary.maps.map((map) => ({
      ...map,
      tokens: omitInvisibleNpcTokensForPlayers(map.tokens),
    })),
  };

  const responseBody = {
    partyStatus,
    initiativePublic: buildPublicInitiativePayload(initiative, npcCombat),
    npcCombatPublic,
    mapLibrary: publicMapLibrary,
    rollHistory,
    serverTime,
    buildVersion: appMeta.buildVersion,
  };

  if (querySlug) {
    const rawCharacterItem = rawItemsBySlug.get(querySlug);
    if (rawCharacterItem) {
      let character = stripPassword(rawCharacterItem);
      character = await applyPlayerNotesVisibility(character, password, rawCharacterItem);
      character = normalizeHpFields(character);
      character.isActiveTurn = computeIsActiveTurn(initiative, querySlug);
      responseBody.character = character;
    }
  }

  return ok(responseBody);
};
