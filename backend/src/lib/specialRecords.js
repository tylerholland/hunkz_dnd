const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("./db");
const { INITIATIVE_SLUG, NPC_COMBAT_SLUG, ROLL_HISTORY_SLUG, MAP_LIBRARY_SLUG, PARTY_ROSTER_SLUG } = require("./specialItems");

function normalizeInitiativeRecord(item) {
  return {
    entries: item?.entries ?? [],
    activeTurnIndex: item?.activeTurnIndex ?? 0,
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

async function saveInitiativeState({ entries, activeTurnIndex }) {
  await putSpecialRecord(INITIATIVE_SLUG, {
    entries,
    activeTurnIndex: activeTurnIndex ?? 0,
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

async function appendRollHistoryEvent(event, limit = 20) {
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

async function savePartyRosterState({ members }) {
  await putSpecialRecord(PARTY_ROSTER_SLUG, {
    members: Array.isArray(members) ? members : [],
  });
}

module.exports = {
  normalizeInitiativeRecord,
  normalizeNpcCombatRecord,
  normalizeRollHistoryRecord,
  normalizeMapLibraryRecord,
  normalizeMapView,
  normalizePartyRosterRecord,
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
};
