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
    getPartyRosterState,
  } = loadModuleWithMocks({
    send: async () => ({ Item: null }),
  });

  // Story 52 — turnStartedAt added to the normalized shape (null default).
  assert.deepEqual(await getInitiativeState(), { entries: [], activeTurnIndex: 0, round: 1, turnStartedAt: null });
  assert.deepEqual(await getNpcCombatState(), { npcs: [] });
  assert.deepEqual(await getRollHistoryState(), { rolls: [] });
  assert.deepEqual(await getPartyRosterState(), { exists: false, members: [] });
});

test("saveInitiativeState, saveNpcCombatState, and saveRollHistoryState persist to sentinel slugs", async () => {
  const sent = [];
  const {
    saveInitiativeState,
    saveNpcCombatState,
    saveRollHistoryState,
    savePartyRosterState,
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
  await savePartyRosterState({
    members: ["aragorn", "liu-sha"],
  });

  assert.equal(sent[0].Item.slug, "initiative");
  assert.deepEqual(sent[0].Item.entries, [{ id: "entry-1", name: "Aragorn", initiative: 10 }]);
  assert.equal(sent[0].Item.activeTurnIndex, 0);
  assert.equal(sent[0].Item.round, 1);
  assert.match(sent[0].Item.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(sent[1].Item.slug, "npc-combat");
  assert.deepEqual(sent[1].Item.npcs, [{ id: "npc-1", name: "Goblin", hpCurrent: 7, hpMax: 7 }]);
  assert.match(sent[1].Item.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(sent[2].Item.slug, "roll-history");
  assert.deepEqual(sent[2].Item.rolls, [{ id: "roll-1", characterName: "Aragorn", exprLabel: "1d20 + 5", total: 19 }]);
  assert.match(sent[2].Item.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(sent[3].Item.slug, "party-roster");
  assert.deepEqual(sent[3].Item.members, ["aragorn", "liu-sha"]);
  assert.match(sent[3].Item.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("getNpcCombatState normalizes legacy npc combat shapes", async () => {
  const { getNpcCombatState } = loadModuleWithMocks({
    send: async () => ({
      Item: {
        slug: "npc-combat",
        enemies: [
          {
            id: "npc-legacy",
            name: "Goblin",
            hpCurrent: 7,
            hpMax: 7,
            initiativeId: "entry-legacy",
          },
        ],
      },
    }),
  });

  assert.deepEqual(await getNpcCombatState(), {
    npcs: [
      {
        id: "npc-legacy",
        name: "Goblin",
        hpCurrent: 7,
        hpMax: 7,
        initiativeId: "entry-legacy",
        initiativeEntryId: "entry-legacy",
        conditions: [],
        notes: [],
      },
    ],
  });
});

test("getMapLibraryState normalizes legacy map content types from file extension", async () => {
  const { getMapLibraryState } = loadModuleWithMocks({
    send: async () => ({
      Item: {
        slug: "map-library",
        activeMapId: "map-1",
        activeMapView: {
          mapId: "map-1",
          translate: { x: 120, y: -48 },
          scale: 1.6,
          pageNumber: 2,
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
        maps: [
          { id: "map-1", s3Key: "maps/dungeon.pdf", imageUrl: "https://example.com/maps/dungeon.pdf" },
          { id: "map-2", s3Key: "maps/forest.webp", imageUrl: "https://example.com/maps/forest.webp" },
        ],
      },
    }),
  });

  assert.deepEqual(await getMapLibraryState(), {
    activeMapId: "map-1",
    activeMapView: {
      mapId: "map-1",
      translate: { x: 120, y: -48 },
      scale: 1.6,
      pageNumber: 2,
      updatedAt: "2026-05-09T00:00:00.000Z",
    },
    maps: [
      {
        id: "map-1",
        s3Key: "maps/dungeon.pdf",
        imageUrl: "https://example.com/maps/dungeon.pdf",
        contentType: "application/pdf",
      },
      {
        id: "map-2",
        s3Key: "maps/forest.webp",
        imageUrl: "https://example.com/maps/forest.webp",
        contentType: "image/webp",
      },
    ],
  });
});

test("appendRollHistoryEvent keeps the newest 500 rolls by default", async () => {
  const sent = [];
  const existingRolls = Array.from({ length: 500 }, (_, index) => ({ id: `existing-${index}` }));
  const {
    appendRollHistoryEvent,
    ROLL_HISTORY_LIMIT,
  } = loadModuleWithMocks({
    send: async (command) => {
      if (command.input?.Key?.slug === "roll-history") {
        return {
          Item: {
            slug: "roll-history",
            rolls: existingRolls,
          },
        };
      }

      sent.push(command.input);
      return {};
    },
  });

  await appendRollHistoryEvent({ id: "new-roll" });

  assert.equal(ROLL_HISTORY_LIMIT, 500);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].Item.slug, "roll-history");
  assert.equal(sent[0].Item.rolls.length, 500);
  assert.equal(sent[0].Item.rolls[0].id, "new-roll");
  assert.equal(sent[0].Item.rolls.at(-1).id, "existing-498");
});
