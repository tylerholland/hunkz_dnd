const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "endTurn.js");
const originalLoad = Module._load;

const entries = [
  { id: "e1", name: "Carrion Crawler", isPC: false, npcId: "npc-1" },
  { id: "e2", name: "Eòghan", isPC: true, slug: "eoghan" },
  { id: "e3", name: "Liu Sha", isPC: true, slug: "liu-sha" },
];

function load({ activeTurnIndex = 1, round = 2, rules = {} } = {}) {
  const calls = { saved: null, events: [], notified: 0 };
  Module._load = function mockedLoad(request, parent, isMain) {
    if (parent && parent.filename === handlerPath) {
      if (request === "../lib/specialRecords") {
        return {
          getInitiativeState: async () => ({ entries, activeTurnIndex, round, version: 7 }),
          saveInitiativeState: async (state, opts) => { calls.saved = { state, opts }; return 8; },
          appendRollHistoryEvents: async (events) => { calls.events.push(...events); },
          getSpecialRecord: async () => rules,
        };
      }
      if (request === "../lib/broadcast") return { notifySessionChanged: async () => { calls.notified += 1; } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[handlerPath];
  return { handler: require(handlerPath).handler, calls };
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
});

const req = (body) => ({ body: JSON.stringify(body) });

test("a player ends their own active turn: next entry, logged, everyone nudged", async () => {
  const { handler, calls } = load();
  const res = await handler(req({ slug: "eoghan", entryId: "e2" }));
  assert.equal(res.statusCode, 200);
  assert.equal(calls.saved.state.activeTurnIndex, 2);
  assert.equal(calls.saved.state.round, 2);
  assert.equal(calls.saved.opts.expectedVersion, 7);
  assert.equal(calls.events[0].type, "turn");
  assert.equal(calls.events[0].subject.sourceId, "liu-sha");
  assert.equal(calls.notified, 1);
});

test("ending the last turn wraps to the top and starts the next round", async () => {
  const { handler, calls } = load({ activeTurnIndex: 2, round: 3 });
  await handler(req({ slug: "liu-sha", entryId: "e3" }));
  assert.deepEqual([calls.saved.state.activeTurnIndex, calls.saved.state.round], [0, 4]);
});

test("refuses someone else's turn, a stale entry, and when the DM has turned it off", async () => {
  assert.equal((await load().handler(req({ slug: "liu-sha", entryId: "e2" }))).statusCode, 403);
  assert.equal((await load().handler(req({ slug: "eoghan", entryId: "e1" }))).statusCode, 409);
  assert.equal((await load({ rules: { playersEndTurn: false } }).handler(req({ slug: "eoghan", entryId: "e2" }))).statusCode, 403);
  assert.equal((await load().handler(req({ slug: "eoghan" }))).statusCode, 400);
});
