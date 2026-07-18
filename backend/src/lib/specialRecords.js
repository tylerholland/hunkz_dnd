const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("./db");
const { INITIATIVE_SLUG, NPC_COMBAT_SLUG, ROLL_HISTORY_SLUG, MAP_LIBRARY_SLUG, PARTY_ROSTER_SLUG, NPC_LIBRARY_SLUG, COUNTER_WHEELS_SLUG } = require("./specialItems");
// Note: no APP_META_SLUG import here — normalizeAppMetaRecord() (Story 36b)
// normalizes a generic item and doesn't need the slug constant; the sentinel
// is written directly by deploy.sh and read directly by getSessionState.js.

const ROLL_HISTORY_LIMIT = 500;

function normalizeInitiativeRecord(item) {
  return {
    entries: item?.entries ?? [],
    activeTurnIndex: item?.activeTurnIndex ?? 0,
    round: Math.max(1, item?.round ?? 1),
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
  };
}

function normalizeRollHistoryRecord(item) {
  return {
    rolls: item?.rolls ?? [],
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
  return {
    mapId,
    translate: { x, y },
    scale,
    pageNumber,
    updatedAt: typeof view?.updatedAt === "string" ? view.updatedAt : null,
  };
}

function normalizePartyRosterRecord(item) {
  return {
    exists: !!item,
    members: Array.isArray(item?.members) ? item.members.filter((value) => typeof value === "string" && value.trim()) : [],
    partyVisibilityEnabled: item?.partyVisibilityEnabled !== false, // default true
  };
}

async function getSpecialRecord(slug) {
  const result = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { slug },
  }));
  return result.Item || null;
}

async function putSpecialRecord(slug, payload) {
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      slug,
      ...payload,
      updatedAt: new Date().toISOString(),
    },
  }));
}

async function getInitiativeState() {
  const item = await getSpecialRecord(INITIATIVE_SLUG);
  return normalizeInitiativeRecord(item);
}

async function saveInitiativeState({ entries, activeTurnIndex, round }) {
  await putSpecialRecord(INITIATIVE_SLUG, {
    entries,
    activeTurnIndex: activeTurnIndex ?? 0,
    round: Math.max(1, round ?? 1),
  });
}

async function getNpcCombatState() {
  const item = await getSpecialRecord(NPC_COMBAT_SLUG);
  return normalizeNpcCombatRecord(item);
}

async function saveNpcCombatState({ npcs }) {
  await putSpecialRecord(NPC_COMBAT_SLUG, { npcs });
}

async function getRollHistoryState() {
  const item = await getSpecialRecord(ROLL_HISTORY_SLUG);
  return normalizeRollHistoryRecord(item);
}

async function saveRollHistoryState({ rolls }) {
  await putSpecialRecord(ROLL_HISTORY_SLUG, { rolls });
}

async function appendRollHistoryEvent(event, limit = ROLL_HISTORY_LIMIT) {
  const current = await getRollHistoryState();
  const rolls = [event, ...(current.rolls || [])].slice(0, limit);
  await saveRollHistoryState({ rolls });
  return rolls;
}

function normalizeMapLibraryRecord(item) {
  return {
    activeMapId: item?.activeMapId ?? null,
    activeMapView: normalizeMapView(item?.activeMapView),
    maps: Array.isArray(item?.maps)
      ? item.maps.map((map) => ({
          ...map,
          contentType: inferMapContentType(map),
          mapMode: map?.mapMode === "battle" ? "battle" : "adventure",
          tokens: Array.isArray(map?.tokens) ? map.tokens : [],
          tokenScale: Number.isFinite(map?.tokenScale) ? Math.min(2.5, Math.max(0.5, map.tokenScale)) : 1.0,
        }))
      : [],
  };
}

async function getMapLibraryState() {
  const item = await getSpecialRecord(MAP_LIBRARY_SLUG);
  return normalizeMapLibraryRecord(item);
}

async function saveMapLibraryState({ activeMapId, activeMapView, maps }) {
  await putSpecialRecord(MAP_LIBRARY_SLUG, {
    activeMapId: activeMapId ?? null,
    activeMapView: normalizeMapView(activeMapView),
    maps: maps ?? [],
  });
}

async function getPartyRosterState() {
  const item = await getSpecialRecord(PARTY_ROSTER_SLUG);
  return normalizePartyRosterRecord(item);
}

async function savePartyRosterState({ members, partyVisibilityEnabled }) {
  await putSpecialRecord(PARTY_ROSTER_SLUG, {
    members: Array.isArray(members) ? members : [],
    partyVisibilityEnabled: partyVisibilityEnabled !== false, // default true
  });
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
  };
}

async function getNpcLibraryState() {
  const item = await getSpecialRecord(NPC_LIBRARY_SLUG);
  return normalizeNpcLibraryRecord(item);
}

async function saveNpcLibraryState({ templates }) {
  await putSpecialRecord(NPC_LIBRARY_SLUG, { templates: Array.isArray(templates) ? templates : [] });
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
  };
}

async function getCounterWheelsState() {
  const item = await getSpecialRecord(COUNTER_WHEELS_SLUG);
  return normalizeCounterWheelsRecord(item);
}

async function saveCounterWheelsState({ wheels }) {
  await putSpecialRecord(COUNTER_WHEELS_SLUG, { wheels: Array.isArray(wheels) ? wheels : [] });
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
  getMapLibraryState,
  saveMapLibraryState,
  getPartyRosterState,
  savePartyRosterState,
  getNpcLibraryState,
  saveNpcLibraryState,
  getCounterWheelsState,
  saveCounterWheelsState,
  normalizeAppMetaRecord,
};
