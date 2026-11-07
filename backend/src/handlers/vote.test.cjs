const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "vote.js");
const originalLoad = Module._load;

// An in-memory vote record, roster, characters and log behind the handler.
function load({ members = ["eoghan", "liu"] } = {}) {
  const state = { record: null, version: 0, log: [], nudges: 0 };
  Module._load = function mocked(request, parent, isMain) {
    if (parent?.filename === handlerPath) {
      if (request === "@aws-sdk/lib-dynamodb") return { GetCommand: class { constructor(input) { this.input = input; } } };
      if (request === "../lib/db") return { TABLE: "t", db: { send: async (cmd) => ({ Item: { slug: cmd.input.Key.slug, passwordHash: `hash-${cmd.input.Key.slug}` } }) } };
      if (request === "../lib/auth") return { verifyPassword: async (pw, item) => ({ valid: pw === "dm" || pw === `pw-${item.slug}`, role: pw === "dm" ? "dm" : "owner" }) };
      if (request === "../lib/broadcast") return { notifySessionChanged: async () => { state.nudges += 1; } };
      if (request === "../lib/specialRecords") {
        return {
          getSpecialRecord: async () => (state.record ? { ...state.record, version: state.version } : null),
          putSpecialRecord: async (_slug, payload, { expectedVersion }) => { assert.equal(expectedVersion, state.version); state.record = payload; state.version += 1; return state.version; },
          appendRollHistoryEvent: async (e) => { state.log.push(e); },
          getPartyRosterState: async () => ({ exists: true, members }),
        };
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[handlerPath];
  const { handler } = require(handlerPath);
  Module._load = originalLoad;
  const call = (method, p, body, password) => handler({ requestContext: { http: { method } }, rawPath: p, headers: password ? { "x-character-password": password } : {}, body: JSON.stringify(body) });
  return { state, call };
}

test("the DM starts a vote; players vote; it closes when everyone has; dismissing logs it", async () => {
  const { state, call } = load();
  assert.equal((await call("PUT", "/vote", { action: "start", question: "Q", options: ["A", "B"] }, "liu-wrong")).statusCode, 403);
  const started = JSON.parse((await call("PUT", "/vote", { action: "start", question: "Where next?", options: ["Inn", "Temple"] }, "dm")).body).vote;
  assert.equal(started.status, "open");
  assert.equal((await call("PUT", "/vote", { action: "start", question: "Again?", options: ["A", "B"] }, "dm")).statusCode, 409);

  assert.equal((await call("POST", "/vote/ballot", { asSlug: "eoghan", voteId: started.id, picks: [0] }, "pw-liu")).statusCode, 403);
  assert.equal((await call("POST", "/vote/ballot", { asSlug: "stranger", voteId: started.id, picks: [0] }, "pw-stranger")).statusCode, 403);
  const mine = JSON.parse((await call("POST", "/vote/ballot", { asSlug: "eoghan", voteId: started.id, picks: [0] }, "pw-eoghan")).body).vote;
  assert.deepEqual(mine.mine, [0]);
  assert.equal(mine.ballots, undefined); // votes aren't shown live by default
  await call("POST", "/vote/ballot", { asSlug: "liu", voteId: started.id, picks: [0] }, "pw-liu");
  assert.equal(state.record.status, "closed"); // everyone has voted
  assert.equal((await call("POST", "/vote/ballot", { asSlug: "liu", voteId: started.id, picks: [1] }, "pw-liu")).statusCode, 409);

  await call("PUT", "/vote", { action: "dismiss" }, "dm");
  assert.equal(state.log.length, 1);
  assert.deepEqual([state.log[0].type, state.log[0].winners, state.log[0].top], ["vote", ["Inn"], 2]);
  assert.equal(state.record.question, undefined); // cleared
  assert.ok(state.nudges >= 4);
});

test("a cancelled vote isn't logged", async () => {
  const { state, call } = load();
  const v = JSON.parse((await call("PUT", "/vote", { action: "start", question: "Q", options: ["A", "B"] }, "dm")).body).vote;
  await call("POST", "/vote/ballot", { asSlug: "eoghan", voteId: v.id, picks: [1] }, "pw-eoghan");
  await call("PUT", "/vote", { action: "cancel" }, "dm");
  assert.equal(state.log.length, 0);
});
