const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Max per-token size multiplier — keep in sync with SCALE_MAX in
// handlers/patchMapTokens.js and tokenSizes.js on the client (Story 65).
const TOKEN_SCALE_MAX = 6.0;
const { db, TABLE } = require("./db");
const { normalizeHouseRulesRecord } = require("./houseRules");
const { VersionConflictError, isConditionalFailure, currentVersion, conditionalPutParams, withVersionRetry } = require("./versioning");
const { INITIATIVE_SLUG, NPC_COMBAT_SLUG, ROLL_HISTORY_SLUG, MAP_LIBRARY_SLUG, PARTY_ROSTER_SLUG, NPC_LIBRARY_SLUG, COUNTER_WHEELS_SLUG, HOUSE_RULES_SLUG } = require("./specialItems");
// Note: no APP_META_SLUG import here — normalizeAppMetaRecord() (Story 36b)
// normalizes a generic item and doesn't need the slug constant; the sentinel
// is written directly by deploy.sh and read directly by getSessionState.js.

const ROLL_HISTORY_LIMIT = 500;

function normalizeInitiativeRecord(item) {
  return {
    entries: item?.entries ?? [],
    activeTurnIndex: item?.activeTurnIndex ?? 0,
    round: Math.max(1, item?.round ?? 1),
    // Story 52 — stamped whenever activeTurnIndex/round changes; clients derive
    // Phase B (wound halo) liveness from this rather than a server-side clear.
    turnStartedAt: typeof item?.turnStartedAt === "string" ? item.turnStartedAt : null,
    version: currentVersion(item),
  };
}

function normalizeNpcCombatRecord(item) {
  const rawNpcs = Array.isArray(item?.npcs)
    ? item.npcs
    : Array.isArray(item?.enemies)
    ? item.enemies
    : Array.isArray(item?.combatants)
    ? item.combatants
    : [];

  return {
    npcs: rawNpcs.map((npc) => ({
      ...npc,
      initiativeEntryId: npc?.initiativeEntryId ?? npc?.initiativeId ?? null,
      conditions: Array.isArray(npc?.conditions) ? npc.conditions : [],
      notes: Array.isArray(npc?.notes) ? npc.notes : [],
    })),
    version: currentVersion(item),
  };
}

function normalizeRollHistoryRecord(item) {
  return {
    rolls: item?.rolls ?? [],
    version: currentVersion(item),
  };
}

function inferMapContentType(map) {
  if (typeof map?.contentType === "string" && map.contentType) return map.contentType;
  const value = String(map?.s3Key || map?.imageUrl || "").toLowerCase();
  if (value.match(/\.pdf(?:$|[?#])/)) return "application/pdf";
  if (value.match(/\.jpe?g(?:$|[?#])/)) return "image/jpeg";
  if (value.match(/\.png(?:$|[?#])/)) return "image/png";
  if (value.match(/\.webp(?:$|[?#])/)) return "image/webp";
  if (value.match(/\.gif(?:$|[?#])/)) return "image/gif";
  if (value.match(/\.avif(?:$|[?#])/)) return "image/avif";
  if (value.match(/\.svg(?:$|[?#])/)) return "image/svg+xml";
  return "";
}

function normalizeMapView(view) {
  if (!view || typeof view !== "object") return null;
  const x = Number.isFinite(view?.translate?.x) ? view.translate.x : 0;
  const y = Number.isFinite(view?.translate?.y) ? view.translate.y : 0;
  const scale = Number.isFinite(view?.scale) ? view.scale : 1;
  const pageNumber = Number.isFinite(view?.pageNumber) ? Math.max(1, Math.floor(view.pageNumber)) : 1;
  const mapId = typeof view?.mapId === "string" && view.mapId.trim() ? view.mapId : null;
  if (!mapId) return null;
  const result = {
    mapId,
    translate: { x, y },
    scale,
    pageNumber,
    updatedAt: typeof view?.updatedAt === "string" ? view.updatedAt : null,
  };
  if (Number.isFinite(view?.centerFracX)) result.centerFracX = view.centerFracX;
  if (Number.isFinite(view?.centerFracY)) result.centerFracY = view.centerFracY;
  return result;
}

function normalizePartyRosterRecord(item) {
  return {
    exists: !!item,
    members: Array.isArray(item?.members) ? item.members.filter((value) => typeof value === "string" && value.trim()) : [],
    partyVisibilityEnabled: item?.partyVisibilityEnabled !== false, // default true
    version: currentVersion(item),
  };
}

async function getSpecialRecord(slug) {
  const result = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { slug },
  }));
  return result.Item || null;
}

// Versioned write (ADR-030); returns the record's new version.
// - `expectedVersion` given (read-modify-write callers): write only if the
//   stored version is still that value, else throw VersionConflictError so
//   the caller can re-read and re-apply (see withVersionRetry).
// - omitted (whole-record replace): read the current version and bump it,
//   retrying if another write lands in between. Last write wins, as before,
//   but the version still advances monotonically.
async function putSpecialRecord(slug, payload, { expectedVersion } = {}) {
  const item = { ...payload, slug, updatedAt: new Date().toISOString() };
  const writeAt = async (expected) => {
    try {
      await db.send(new PutCommand(conditionalPutParams(TABLE, item, expected)));
      return expected + 1;
    } catch (err) {
      if (isConditionalFailure(err)) throw new VersionConflictError(slug);
      throw err;
    }
  };
  if (Number.isFinite(expectedVersion)) return writeAt(expectedVersion);
  return withVersionRetry(async () => {
    const current = await db.send(new GetCommand({
      TableName: TABLE,
      Key: { slug },
      ProjectionExpression: "#ver",
      ExpressionAttributeNames: { "#ver": "version" },
    }));
    return writeAt(currentVersion(current.Item));
  });
}

async function getInitiativeState() {
  const item = await getSpecialRecord(INITIATIVE_SLUG);
  return normalizeInitiativeRecord(item);
}

async function saveInitiativeState({ entries, activeTurnIndex, round, turnStartedAt }, opts) {
  return putSpecialRecord(INITIATIVE_SLUG, {
    entries,
    activeTurnIndex: activeTurnIndex ?? 0,
    round: Math.max(1, round ?? 1),
    turnStartedAt: turnStartedAt ?? null,
  }, opts);
}

async function getNpcCombatState() {
  const item = await getSpecialRecord(NPC_COMBAT_SLUG);
  return normalizeNpcCombatRecord(item);
}

async function saveNpcCombatState({ npcs }, opts) {
  return putSpecialRecord(NPC_COMBAT_SLUG, { npcs }, opts);
}

async function getRollHistoryState() {
  const item = await getSpecialRecord(ROLL_HISTORY_SLUG);
  return normalizeRollHistoryRecord(item);
}

async function saveRollHistoryState({ rolls }, opts) {
  return putSpecialRecord(ROLL_HISTORY_SLUG, { rolls }, opts);
}

// Read-append-write under the version lock: two rolls landing at the same
// moment both survive (the loser re-reads and re-appends).
async function appendRollHistoryEvent(event, limit = ROLL_HISTORY_LIMIT) {
  return withVersionRetry(async () => {
    const current = await getRollHistoryState();
    const rolls = [event, ...(current.rolls || [])].slice(0, limit);
    await saveRollHistoryState({ rolls }, { expectedVersion: current.version });
    return rolls;
  });
}

// Several events from one write (e.g. HP + condition) in a single
// read-append-write.
async function appendRollHistoryEvents(events, limit = ROLL_HISTORY_LIMIT) {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  if (!list.length) return null;
  return withVersionRetry(async () => {
    const current = await getRollHistoryState();
    const rolls = [...list.slice().reverse(), ...(current.rolls || [])].slice(0, limit);
    await saveRollHistoryState({ rolls }, { expectedVersion: current.version });
    return rolls;
  });
}

// ADR-032 — "Deal Damage" from the roll log marks that roll applied so the
// button can't be used twice (shown on every DM screen, survives reloads).
async function markRollApplied(rollId, applied) {
  if (!rollId) return null;
  return withVersionRetry(async () => {
    const current = await getRollHistoryState();
    let found = false;
    const rolls = (current.rolls || []).map((roll) => {
      if (roll?.id !== rollId) return roll;
      found = true;
      return { ...roll, applied };
    });
    if (!found) return null;
    return saveRollHistoryState({ rolls }, { expectedVersion: current.version });
  });
}

function normalizeMapLibraryRecord(item) {
  return {
    activeMapId: item?.activeMapId ?? null,
    adventureMapId: item?.adventureMapId ?? null,
    battleMapId: item?.battleMapId ?? null,
    // Single source of truth for "is battle mode active" — see ADR-029.
    // Replaces the old activeMapId===battleMapId bookmark-matching scheme and
    // the retired per-map mapMode field.
    combatMode: item?.combatMode === true,
    activeMapView: normalizeMapView(item?.activeMapView),
    maps: Array.isArray(item?.maps)
      ? item.maps.map((map) => ({
          ...map,
          contentType: inferMapContentType(map),
          tokens: Array.isArray(map?.tokens)
            ? map.tokens.map((tok) => ({
                ...tok,
                scale: Number.isFinite(tok.scale)
                  ? Math.min(TOKEN_SCALE_MAX, Math.max(0.5, tok.scale))
                  : 1.0,
              }))
            : [],
          tokenScale: Number.isFinite(map?.tokenScale) ? Math.min(2.5, Math.max(0.5, map.tokenScale)) : 1.0,
          rotation: [0, 90, 180, 270].includes(map?.rotation) ? map.rotation : 0,
        }))
      : [],
    version: currentVersion(item),
  };
}

async function getMapLibraryState() {
  const item = await getSpecialRecord(MAP_LIBRARY_SLUG);
  return normalizeMapLibraryRecord(item);
}

async function saveMapLibraryState({ activeMapId, activeMapView, maps, adventureMapId, battleMapId, combatMode }, opts) {
  return putSpecialRecord(MAP_LIBRARY_SLUG, {
    activeMapId: activeMapId ?? null,
    adventureMapId: adventureMapId ?? null,
    battleMapId: battleMapId ?? null,
    combatMode: combatMode ?? false,
    activeMapView: normalizeMapView(activeMapView),
    maps: maps ?? [],
  }, opts);
}

async function getPartyRosterState() {
  const item = await getSpecialRecord(PARTY_ROSTER_SLUG);
  return normalizePartyRosterRecord(item);
}

async function savePartyRosterState({ members, partyVisibilityEnabled }, opts) {
  return putSpecialRecord(PARTY_ROSTER_SLUG, {
    members: Array.isArray(members) ? members : [],
    partyVisibilityEnabled: partyVisibilityEnabled !== false, // default true
  }, opts);
}

function normalizeNpcLibraryRecord(item) {
  const rawTemplates = Array.isArray(item?.templates) ? item.templates : [];
  return {
    templates: rawTemplates
      .filter((t) => typeof t?.id === "string" && t.id.trim())
      .map((t) => ({
        id: t.id,
        name: typeof t.name === "string" ? t.name : "",
        abilities: Array.isArray(t.abilities) ? t.abilities : [],
        hpMax: Number.isFinite(t.hpMax) ? t.hpMax : null,
        portraitUrl: typeof t.portraitUrl === "string" ? t.portraitUrl : null,
        updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : null,
      })),
    version: currentVersion(item),
  };
}

async function getNpcLibraryState() {
  const item = await getSpecialRecord(NPC_LIBRARY_SLUG);
  return normalizeNpcLibraryRecord(item);
}

async function saveNpcLibraryState({ templates }, opts) {
  return putSpecialRecord(NPC_LIBRARY_SLUG, { templates: Array.isArray(templates) ? templates : [] }, opts);
}

function normalizeCounterWheelsRecord(item) {
  const rawWheels = Array.isArray(item?.wheels) ? item.wheels : [];
  return {
    wheels: rawWheels
      .filter((w) => typeof w?.id === "string" && w.id.trim())
      .map((w) => ({
        id: w.id,
        name: typeof w.name === "string" ? w.name : "",
        segments: Number.isFinite(w.segments) ? Math.max(1, Math.min(12, Math.round(w.segments))) : 6,
        filledCount: Number.isFinite(w.filledCount) ? Math.max(0, Math.round(w.filledCount)) : 0,
      })),
    version: currentVersion(item),
  };
}

async function getCounterWheelsState() {
  const item = await getSpecialRecord(COUNTER_WHEELS_SLUG);
  return normalizeCounterWheelsRecord(item);
}

async function saveCounterWheelsState({ wheels }, opts) {
  return putSpecialRecord(COUNTER_WHEELS_SLUG, { wheels: Array.isArray(wheels) ? wheels : [] }, opts);
}

async function saveHouseRulesState(rules, opts) {
  return putSpecialRecord(HOUSE_RULES_SLUG, normalizeHouseRulesRecord(rules), opts);
}

// Story 36b — stale-client auto-refresh. Written directly by deploy.sh via
// `aws dynamodb put-item` (no Lambda write path/save helper needed here);
// read by getSessionState.js on every poll tick. Absent sentinel (e.g. before
// the first 36b deploy) normalizes to buildVersion: null — old clients never
// see a mismatch and never reload, which keeps this change backward compatible.
function normalizeAppMetaRecord(item) {
  return {
    buildVersion: typeof item?.buildVersion === "string" ? item.buildVersion : null,
    deployedAt: typeof item?.deployedAt === "string" ? item.deployedAt : null,
  };
}

module.exports = {
  normalizeInitiativeRecord,
  normalizeNpcCombatRecord,
  normalizeRollHistoryRecord,
  normalizeMapLibraryRecord,
  normalizeMapView,
  normalizePartyRosterRecord,
  normalizeNpcLibraryRecord,
  normalizeCounterWheelsRecord,
  ROLL_HISTORY_LIMIT,
  getInitiativeState,
  saveInitiativeState,
  getNpcCombatState,
  saveNpcCombatState,
  getRollHistoryState,
  saveRollHistoryState,
  appendRollHistoryEvent,
  appendRollHistoryEvents,
  markRollApplied,
  getMapLibraryState,
  saveMapLibraryState,
  getPartyRosterState,
  savePartyRosterState,
  getNpcLibraryState,
  saveNpcLibraryState,
  getCounterWheelsState,
  saveCounterWheelsState,
  normalizeAppMetaRecord,
  saveHouseRulesState,
};
