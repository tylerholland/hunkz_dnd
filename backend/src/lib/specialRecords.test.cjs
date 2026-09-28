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
  // ADR-030 — every normalized record carries its version (0 = never written).
  assert.deepEqual(await getInitiativeState(), { entries: [], activeTurnIndex: 0, round: 1, turnStartedAt: null, version: 0 });
  assert.deepEqual(await getNpcCombatState(), { npcs: [], version: 0 });
  assert.deepEqual(await getRollHistoryState(), { rolls: [], version: 0 });
  assert.deepEqual(await getPartyRosterState(), { exists: false, members: [], partyVisibilityEnabled: true, version: 0 });
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
      // Versioned writes read the current version first (Get), then Put.
      if (command.input?.Item) sent.push(command.input);
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
  // ADR-030 — first write is version 1, conditional on no prior version.
  assert.equal(sent[0].Item.version, 1);
  assert.match(sent[0].ConditionExpression, /attribute_not_exists\(#ver\) OR #ver = :expected/);

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
    version: 0,
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
    adventureMapId: null,
    battleMapId: null,
    combatMode: false,
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
        tokens: [],
        tokenScale: 1,
        rotation: 0,
      },
      {
        id: "map-2",
        s3Key: "maps/forest.webp",
        imageUrl: "https://example.com/maps/forest.webp",
        contentType: "image/webp",
        tokens: [],
        tokenScale: 1,
        rotation: 0,
      },
    ],
    version: 0,
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
  const livePuts = sent.filter((input) => input.Item?.slug === "roll-history");
  assert.equal(livePuts.length, 1);
  assert.equal(livePuts[0].Item.rolls.length, 500);
  assert.equal(livePuts[0].Item.rolls[0].id, "new-roll");
  assert.equal(livePuts[0].Item.rolls.at(-1).id, "existing-498");
  // The roll that aged out is archived, not dropped (Story 69).
  const archivePut = sent.find((input) => input.Item?.slug === "roll-history-archive:0");
  assert.deepEqual(archivePut.Item.events.map((e) => e.id), ["existing-499"]);
});

test("whole-record saves bump the stored version and retry when a write lands in between", async () => {
  let stored = 4;
  let conflictOnce = true;
  const puts = [];
  const { saveNpcCombatState } = loadModuleWithMocks({
    send: async (command) => {
      if (!command.input?.Item) return { Item: { version: stored } }; // version read
      if (conflictOnce) {
        conflictOnce = false;
        stored = 5; // someone else wrote meanwhile
        throw Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
      }
      puts.push(command.input);
      stored = command.input.Item.version;
      return {};
    },
  });
  const version = await saveNpcCombatState({ npcs: [] });
  assert.equal(version, 6);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].ExpressionAttributeValues[":expected"], 5);
});

test("expectedVersion writes throw VersionConflictError instead of clobbering", async () => {
  const { saveMapLibraryState } = loadModuleWithMocks({
    send: async () => { throw Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" }); },
  });
  const { VersionConflictError } = require("./versioning");
  await assert.rejects(saveMapLibraryState({ maps: [] }, { expectedVersion: 3 }), (err) => err instanceof VersionConflictError);
});

test("concurrent roll appends both survive (loser re-reads and re-appends)", async () => {
  let record = { slug: "roll-history", rolls: [{ id: "a" }], version: 1 };
  let raced = false;
  const { appendRollHistoryEvent } = loadModuleWithMocks({
    send: async (command) => {
      const input = command.input;
      if (!input.Item) return { Item: record };
      if (!raced) {
        raced = true; // another roll lands between our read and write
        record = { ...record, rolls: [{ id: "b" }, ...record.rolls], version: 2 };
        throw Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
      }
      assert.equal(input.ExpressionAttributeValues[":expected"], record.version);
      record = input.Item;
      return {};
    },
  });
  await appendRollHistoryEvent({ id: "c" });
  assert.deepEqual(record.rolls.map((r) => r.id), ["c", "b", "a"]);
  assert.equal(record.version, 3);
});
