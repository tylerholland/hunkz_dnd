const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const specialRecordsPath = path.resolve(__dirname, "specialRecords.js");
const originalLoad = Module._load;

// In-memory table that honours the ADR-030 conditional put.
function fakeTable() {
  const items = new Map();
  const send = async (command) => {
    const input = command.input;
    if (command.kind === "get") return { Item: items.has(input.Key.slug) ? structuredClone(items.get(input.Key.slug)) : undefined };
    if (command.kind === "put") {
      const existing = items.get(input.Item.slug);
      const expected = input.ExpressionAttributeValues?.[":expected"];
      if (existing && Number.isFinite(existing.version) && existing.version !== expected) {
        const err = new Error("conditional"); err.name = "ConditionalCheckFailedException"; throw err;
      }
      items.set(input.Item.slug, structuredClone(input.Item));
      return {};
    }
    throw new Error("unexpected command");
  };
  return { items, send };
}

function load(send) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        GetCommand: class { constructor(input) { this.input = input; this.kind = "get"; } },
        PutCommand: class { constructor(input) { this.input = input; this.kind = "put"; } },
      };
    }
    if (request === "./db" && parent && parent.filename === specialRecordsPath) return { db: { send }, TABLE: "t" };
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[specialRecordsPath];
  return require(specialRecordsPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[specialRecordsPath];
});

const ev = (n) => ({ id: `e${n}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString() });

test("events that age out of the live feed move to the archive, in order, without duplicates", async () => {
  const { items, send } = fakeTable();
  const lib = load(send);
  for (let n = 1; n <= 12; n += 1) await lib.appendRollHistoryEvent(ev(n), 5);
  assert.deepEqual(items.get("roll-history").rolls.map((e) => e.id), ["e12", "e11", "e10", "e9", "e8"]);
  const archived = await lib.getRollHistoryArchive();
  assert.deepEqual(archived.map((e) => e.id), ["e7", "e6", "e5", "e4", "e3", "e2", "e1"]);
});

test("the archive is a ring: when every page is full the oldest page is reused", async () => {
  const { items, send } = fakeTable();
  const lib = load(send);
  const total = 5 + lib.ROLL_HISTORY_ARCHIVE_PAGES * lib.ROLL_HISTORY_ARCHIVE_PAGE_SIZE + 3;
  const batch = [];
  for (let n = 1; n <= total; n += 1) batch.push(ev(n));
  // one big append overflows many events at once
  await lib.appendRollHistoryEvents(batch, 5);
  const archived = await lib.getRollHistoryArchive();
  assert.equal(items.get("roll-history").rolls.length, 5);
  assert.ok(archived.length <= lib.ROLL_HISTORY_ARCHIVE_PAGES * lib.ROLL_HISTORY_ARCHIVE_PAGE_SIZE);
  // newest archived event is the one just older than the live feed
  assert.equal(archived[0].id, `e${total - 5}`);
  assert.equal(new Set(archived.map((e) => e.id)).size, archived.length);
});

test("setRollTag labels an event in the live feed or the archive, and clears it", async () => {
  const { items, send } = fakeTable();
  const lib = load(send);
  for (let n = 1; n <= 8; n += 1) await lib.appendRollHistoryEvent(ev(n), 5);
  assert.equal(await lib.setRollTag("e7", "Climbing the grate"), true); // live
  assert.equal(items.get("roll-history").rolls.find((e) => e.id === "e7").tag, "Climbing the grate");
  assert.equal(await lib.setRollTag("e2", "Persuade the goblin king"), true); // archived
  assert.equal((await lib.getRollHistoryArchive()).find((e) => e.id === "e2").tag, "Persuade the goblin king");
  assert.equal(await lib.setRollTag("e2", ""), true);
  assert.equal("tag" in (await lib.getRollHistoryArchive()).find((e) => e.id === "e2"), false);
  assert.equal(await lib.setRollTag("nope", "x"), false);
});
