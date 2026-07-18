const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "postDmRoll.js");
const originalLoad = Module._load;

function loadHandlerWithMocks({ verifyPasswordResult, appendRollHistoryEvent, notifySessionChanged }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "../lib/auth" && parent && parent.filename === handlerPath) {
      return {
        verifyPassword: async () => verifyPasswordResult,
      };
    }

    if (request === "../lib/specialRecords" && parent && parent.filename === handlerPath) {
      return {
        appendRollHistoryEvent,
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
  return require(handlerPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
});

test("postDmRoll rejects non-DM requests", async () => {
  const { handler } = loadHandlerWithMocks({
    verifyPasswordResult: { valid: false },
    appendRollHistoryEvent: async () => {
      throw new Error("should not append");
    },
  });

  const result = await handler({
    headers: { "x-character-password": "wrong" },
    body: JSON.stringify({ exprLabel: "1d20", total: 12, rollValues: [12] }),
  });

  assert.equal(result.statusCode, 403);
  assert.match(result.body, /DM password required/);
});

test("postDmRoll appends a DM-scoped roll-history event and broadcasts a nudge", async () => {
  const appended = [];
  let broadcastCalls = 0;
  const { handler } = loadHandlerWithMocks({
    verifyPasswordResult: { valid: true, role: "dm" },
    appendRollHistoryEvent: async (eventRecord) => {
      appended.push(eventRecord);
      return [eventRecord];
    },
    notifySessionChanged: async () => { broadcastCalls += 1; },
  });

  const result = await handler({
    headers: { "x-character-password": "swordfish" },
    body: JSON.stringify({
      id: "dm-roll-123",
      exprLabel: "2d6 + 3",
      label: "Fireball Damage",
      total: 11,
      rollValues: [5, 3],
      isCrit: false,
      isFumble: false,
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(appended.length, 1);
  assert.deepEqual(
    {
      id: appended[0].id,
      characterName: appended[0].characterName,
      source: appended[0].source,
      exprLabel: appended[0].exprLabel,
      label: appended[0].label,
      total: appended[0].total,
      rollValues: appended[0].rollValues,
      isCrit: appended[0].isCrit,
      isFumble: appended[0].isFumble,
    },
    {
      id: "dm-roll-123",
      characterName: "DM",
      source: "dm",
      exprLabel: "2d6 + 3",
      label: "Fireball Damage",
      total: 11,
      rollValues: [5, 3],
      isCrit: false,
      isFumble: false,
    }
  );
  assert.match(appended[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(broadcastCalls, 1);
});
