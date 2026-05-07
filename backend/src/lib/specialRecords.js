const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("./db");
const { INITIATIVE_SLUG, NPC_COMBAT_SLUG, ROLL_HISTORY_SLUG } = require("./specialItems");

function normalizeInitiativeRecord(item) {
  return {
    entries: item?.entries ?? [],
    activeTurnIndex: item?.activeTurnIndex ?? 0,
  };
}

function normalizeNpcCombatRecord(item) {
  return {
    npcs: item?.npcs ?? [],
  };
}

function normalizeRollHistoryRecord(item) {
  return {
    rolls: item?.rolls ?? [],
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

module.exports = {
  normalizeInitiativeRecord,
  normalizeNpcCombatRecord,
  normalizeRollHistoryRecord,
  getInitiativeState,
  saveInitiativeState,
  getNpcCombatState,
  saveNpcCombatState,
  getRollHistoryState,
  saveRollHistoryState,
  appendRollHistoryEvent,
};
