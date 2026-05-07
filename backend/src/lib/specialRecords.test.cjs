const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const specialRecordsPath = path.resolve(__dirname, "specialRecords.js");
const originalLoad = Module._load;

function loadModuleWithMocks({ send }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        GetCommand: class GetCommand {
          constructor(input) {
            this.input = input;
          }
        },
        PutCommand: class PutCommand {
          constructor(input) {
            this.input = input;
          }
        },
      };
    }

    if (request === "./db" && parent && parent.filename === specialRecordsPath) {
      return { db: { send }, TABLE: "characters-table" };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[specialRecordsPath];
  return require(specialRecordsPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[specialRecordsPath];
});

test("getInitiativeState and getNpcCombatState return normalized defaults", async () => {
  const {
    getInitiativeState,
    getNpcCombatState,
    getRollHistoryState,
  } = loadModuleWithMocks({
    send: async () => ({ Item: null }),
  });

  assert.deepEqual(await getInitiativeState(), { entries: [], activeTurnIndex: 0 });
  assert.deepEqual(await getNpcCombatState(), { npcs: [] });
  assert.deepEqual(await getRollHistoryState(), { rolls: [] });
});

test("saveInitiativeState, saveNpcCombatState, and saveRollHistoryState persist to sentinel slugs", async () => {
  const sent = [];
  const {
    saveInitiativeState,
    saveNpcCombatState,
    saveRollHistoryState,
  } = loadModuleWithMocks({
    send: async (command) => {
      sent.push(command.input);
      return {};
    },
  });

  await saveInitiativeState({
    entries: [{ id: "entry-1", name: "Aragorn", initiative: 10 }],
    activeTurnIndex: 0,
  });
  await saveNpcCombatState({
    npcs: [{ id: "npc-1", name: "Goblin", hpCurrent: 7, hpMax: 7 }],
  });
  await saveRollHistoryState({
    rolls: [{ id: "roll-1", characterName: "Aragorn", exprLabel: "1d20 + 5", total: 19 }],
  });

  assert.equal(sent[0].Item.slug, "initiative");
  assert.deepEqual(sent[0].Item.entries, [{ id: "entry-1", name: "Aragorn", initiative: 10 }]);
  assert.equal(sent[0].Item.activeTurnIndex, 0);
  assert.match(sent[0].Item.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(sent[1].Item.slug, "npc-combat");
  assert.deepEqual(sent[1].Item.npcs, [{ id: "npc-1", name: "Goblin", hpCurrent: 7, hpMax: 7 }]);
  assert.match(sent[1].Item.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(sent[2].Item.slug, "roll-history");
  assert.deepEqual(sent[2].Item.rolls, [{ id: "roll-1", characterName: "Aragorn", exprLabel: "1d20 + 5", total: 19 }]);
  assert.match(sent[2].Item.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
