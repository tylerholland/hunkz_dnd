const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "postCharacterRoll.js");
const specialRecordsPath = path.resolve(__dirname, "../lib/specialRecords.js");
const dbPath = path.resolve(__dirname, "../lib/db.js");
const originalLoad = Module._load;

function loadHandlerWithMocks({ getItem, appendRollHistoryEvent, notifySessionChanged }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        GetCommand: class GetCommand {
          constructor(input) { this.input = input; }
        },
      };
    }

    if (request === "../lib/db" && parent && parent.filename === handlerPath) {
      return {
        db: { send: async () => ({ Item: getItem }) },
        TABLE: "characters-table",
      };
    }

    if (request === "../lib/specialRecords" && parent && parent.filename === handlerPath) {
      return {
        appendRollHistoryEvent: appendRollHistoryEvent || (async (event) => [event]),
      };
    }

    if (request === "../lib/broadcast" && parent && parent.filename === handlerPath) {
      return {
        notifySessionChanged: notifySessionChanged || (async () => {}),
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
  delete require.cache[dbPath];
  return require(handlerPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
  delete require.cache[dbPath];
});

test("postCharacterRoll appends an event with no target/attack when not supplied (backward compatible)", async () => {
  const appended = [];
  const { handler } = loadHandlerWithMocks({
    getItem: { slug: "aragorn", name: "Aragorn", palette: "ember" },
    appendRollHistoryEvent: async (eventRecord) => { appended.push(eventRecord); return [eventRecord]; },
  });

  const result = await handler({
    pathParameters: { slug: "aragorn" },
    body: JSON.stringify({
      exprLabel: "1d20+7",
      label: "Longsword ATK",
      total: 17,
      rollValues: [10],
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].label, "Longsword ATK");
  assert.equal("target" in appended[0], false);
  assert.equal("attack" in appended[0], false);
});

test("postCharacterRoll (Story 57) passes through valid target/attack declaration fields", async () => {
  const appended = [];
  const { handler } = loadHandlerWithMocks({
    getItem: { slug: "aragorn", name: "Aragorn", palette: "ember" },
    appendRollHistoryEvent: async (eventRecord) => { appended.push(eventRecord); return [eventRecord]; },
  });

  const result = await handler({
    pathParameters: { slug: "aragorn" },
    body: JSON.stringify({
      exprLabel: "1d20+7",
      label: "Longsword ATK",
      total: 17,
      rollValues: [10],
      target: { type: "npc", sourceId: "npc-1", name: "Goblin 2" },
      attack: { kind: "weapon", id: "w1", name: "Longsword" },
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(appended.length, 1);
  assert.deepEqual(appended[0].target, { type: "npc", sourceId: "npc-1", name: "Goblin 2" });
  assert.deepEqual(appended[0].attack, { kind: "weapon", id: "w1", name: "Longsword" });
  // label is never rewritten to bake the declaration in (ADR-026).
  assert.equal(appended[0].label, "Longsword ATK");
});

test("postCharacterRoll drops an incomplete or malformed target/attack instead of writing a partial object", async () => {
  const appended = [];
  const { handler } = loadHandlerWithMocks({
    getItem: { slug: "aragorn", name: "Aragorn", palette: "ember" },
    appendRollHistoryEvent: async (eventRecord) => { appended.push(eventRecord); return [eventRecord]; },
  });

  const result = await handler({
    pathParameters: { slug: "aragorn" },
    body: JSON.stringify({
      exprLabel: "1d20+7",
      label: "Longsword ATK",
      total: 17,
      rollValues: [10],
      target: { type: "npc", sourceId: "npc-1" }, // missing name
      attack: { kind: "spellbolt", id: "s1", name: "Fire Bolt" }, // invalid kind
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal("target" in appended[0], false);
  assert.equal("attack" in appended[0], false);
});

test("postCharacterRoll bounds target/attack name length rather than rejecting the roll", async () => {
  const appended = [];
  const { handler } = loadHandlerWithMocks({
    getItem: { slug: "aragorn", name: "Aragorn", palette: "ember" },
    appendRollHistoryEvent: async (eventRecord) => { appended.push(eventRecord); return [eventRecord]; },
  });

  const longName = "X".repeat(200);
  const result = await handler({
    pathParameters: { slug: "aragorn" },
    body: JSON.stringify({
      exprLabel: "2d6+3",
      label: "Fire Bolt DMG",
      total: 11,
      rollValues: [5, 3],
      target: { type: "npc", sourceId: "npc-1", name: longName },
      attack: { kind: "spell", id: "s1", name: longName },
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(appended[0].target.name.length, 60);
  assert.equal(appended[0].attack.name.length, 60);
});
