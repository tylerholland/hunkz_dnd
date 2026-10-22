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
  HOUSE_RULES_SLUG,
  TALENT_CODEX_SLUG,
  isReservedCharacterSlug,
} = require("../lib/specialItems");
const { currentVersion } = require("../lib/versioning");
const {
  normalizeInitiativeRecord,
  normalizeNpcCombatRecord,
  normalizeRollHistoryRecord,
  normalizeMapLibraryRecord,
  normalizePartyRosterRecord,
  normalizeCounterWheelsRecord,
  normalizeAppMetaRecord,
} = require("../lib/specialRecords");
const { normalizeHouseRulesRecord } = require("../lib/houseRules");
const { projectDmPartyItem, projectPlayerCharacter } = require("../lib/partyProjection");
const {
  buildPublicInitiativePayload,
  publicNpcConditionsByNpcId,
  getHiddenInitiativeSubjects,
} = require("../lib/initiativeProjection");
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
  shouldStripAttackerRef,
} = require("../lib/tokenVisibility");

// Story 54 — annotate every token on every map with a server-derived
// `invisible` flag (never trust/re-derive it client-side).
function annotateMapLibrary(mapLibrary, { getCharacterConditions, getNpcConditions }) {
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
  HOUSE_RULES_SLUG,
  TALENT_CODEX_SLUG,
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
  const houseRules = normalizeHouseRulesRecord(sentinelBySlug.get(HOUSE_RULES_SLUG));
  // Story 39 — just the Talent Codex's version; screens fetch the codex itself
  // (GET /talent-codex) only when this changes.
  const talentCodexVersion = currentVersion(sentinelBySlug.get(TALENT_CODEX_SLUG));
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
  // drift. Computed once here (not re-derived by any client). Story 55 —
  // the same two resolvers double as the "is this attacker invisible?" gate
  // for stripping `lastDamageFrom` below (ADR-023).
  const getCharacterConditions = makeCharacterConditionsResolver(rawItemsBySlug);
  const getNpcConditions = makeNpcConditionsResolver(npcCombat);
  const annotatedMapLibrary = annotateMapLibrary(mapLibrary, { getCharacterConditions, getNpcConditions });

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
      houseRules,
      talentCodexVersion,
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

  // Story 55 (ADR-023 point 4) — strip `lastDamageFrom` whenever the
  // referenced attacker is invisible or linked to a hidden initiative entry.
  // A tracer originating from an empty square leaks the attacker's position
  // as effectively as rendering its token.
  const hiddenSubjectKeys = getHiddenInitiativeSubjects(initiative);
  function publicLastDamageFrom(lastDamageFrom) {
    if (shouldStripAttackerRef(lastDamageFrom, { getCharacterConditions, getNpcConditions, hiddenSubjectKeys })) {
      return null;
    }
    return lastDamageFrom ?? null;
  }
  // ADR-032 — the chosen action's attacker is stripped exactly like
  // lastDamageFrom; the effect still plays, just without a visible source.
  function publicEffectNotes(notes, conditions) {
    if (!notes || typeof notes !== "object") return {};
    return Object.fromEntries(Object.entries(notes).filter(([name, text]) => conditions.includes(name) && typeof text === "string" && text));
  }

  function publicEffectSources(sources, conditions) {
    if (!sources || typeof sources !== "object") return {};
    return Object.fromEntries(Object.entries(sources)
      .filter(([name, src]) => conditions.includes(name) && src && typeof src === "object")
      .map(([name, src]) => [name, { type: src.type, sourceId: src.sourceId, ...(src.name ? { name: src.name } : {}), ...(src.spell ? { spell: src.spell } : {}) }]));
  }

  function publicLastFx(lastFx) {
    if (!lastFx || typeof lastFx !== "object") return null;
    return { ...lastFx, attacker: publicLastDamageFrom(lastFx.attacker) };
  }

  const partyStatus = visEnabled
    ? {
        visible: true,
        members: orderedMembers
          .filter((slug) => rawItemsBySlug.has(slug))
          .map((slug) => {
            const projected = projectPlayerCharacter(rawItemsBySlug.get(slug));
            projected.lastDamageFrom = publicLastDamageFrom(projected.lastDamageFrom);
            projected.lastHealFrom = publicLastDamageFrom(projected.lastHealFrom);
            projected.lastFx = publicLastFx(projected.lastFx);
            return projected;
          }),
      }
    : { visible: false, members: [] };

  // Strip to name+portraitUrl only — HP/notes stay DM-only. Story 53 adds
  // `conditions` (gated on the linked initiative entry not being hidden —
  // the DM's existing secrecy lever). Story 52 adds the damage-flash sync
  // fields (not secret data, ungated). Story 55 adds `lastDamageFrom`,
  // stripped per publicLastDamageFrom() above.
  const publicNpcConditions = publicNpcConditionsByNpcId(initiative, npcCombat);
  const npcCombatPublic = {
    version: npcCombat.version ?? 0, // ADR-030
    npcs: npcCombat.npcs.map((n) => ({
      id: n.id,
      name: n.name,
      portraitUrl: n.portraitUrl ?? null,
      conditions: publicNpcConditions[n.id] ?? [],
      lastDamagedAt: n.lastDamagedAt ?? null,
      lastDamageAmount: n.lastDamageAmount ?? null,
      lastDamageFrom: publicLastDamageFrom(n.lastDamageFrom),
      lastHealedAt: n.lastHealedAt ?? null,
      lastHealAmount: n.lastHealAmount ?? null,
      lastHealFrom: publicLastDamageFrom(n.lastHealFrom),
      lastFx: publicLastFx(n.lastFx),
      // The DM's note on what a spell effect does ("Hexed — loses its hold
      // on Aesop"), only for effects the token currently shows.
      effectNotes: publicEffectNotes(n.effectNotes, publicNpcConditions[n.id] ?? []),
      // Story 70 — who cast each effect on the token (for the caster's damage
      // riders), only for effects it currently shows.
      effectSources: publicEffectSources(n.effectSources, publicNpcConditions[n.id] ?? []),
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

  // Story 69 — HP/condition log entries: drop any about a hidden or invisible
  // subject, hide NPC HP totals (players see the change, not what's left),
  // and strip a hidden attacker the same way lastDamageFrom is stripped.
  const publicRollHistory = {
    ...rollHistory,
    rolls: (rollHistory.rolls || []).flatMap((event) => {
      if (event?.type !== "hp" && event?.type !== "condition" && event?.type !== "turn") return [event];
      if (shouldStripAttackerRef(event.subject, { getCharacterConditions, getNpcConditions, hiddenSubjectKeys })) return [];
      const out = { ...event };
      if (out.subject?.type === "npc") { delete out.from; delete out.to; delete out.max; }
      if (out.by) out.by = publicLastDamageFrom(out.by);
      return [out];
    }),
  };

  const responseBody = {
    partyStatus,
    initiativePublic: buildPublicInitiativePayload(initiative, npcCombat),
    npcCombatPublic,
    mapLibrary: publicMapLibrary,
    rollHistory: publicRollHistory,
    houseRules,
    talentCodexVersion,
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
      // Story 55 — this is the player's own sheet fetch, but a player's own
      // token feeds the same map tracer (via PlayerMapViewer's ownCharacter
      // merge) — same strip rule applies, or the ADR-023 guarantee would be
      // bypassed by reading it off this field instead of partyStatus.
      if (Object.prototype.hasOwnProperty.call(character, "lastDamageFrom")) {
        character.lastDamageFrom = publicLastDamageFrom(character.lastDamageFrom);
      }
      if (Object.prototype.hasOwnProperty.call(character, "lastHealFrom")) {
        character.lastHealFrom = publicLastDamageFrom(character.lastHealFrom);
      }
      if (Object.prototype.hasOwnProperty.call(character, "lastFx")) {
        character.lastFx = publicLastFx(character.lastFx);
      }
      responseBody.character = character;
    }
  }

  return ok(responseBody);
};
