const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "rollRequests.js");
const originalLoad = Module._load;

// An in-memory record, roster, house rules and log behind the handler.
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
          getSpecialRecord: async (slug) => (slug === "house-rules" ? { abilityCheckDice: "2d6", saveDice: "1d20" } : state.record ? { ...state.record, version: state.version } : null),
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

test("the DM asks, players roll, the DM reveals and closes; the log gets it", async () => {
  const { state, call } = load();
  assert.equal((await call("PUT", "/roll-requests", { action: "start", check: { skill: "perception" }, targets: ["liu"] }, "pw-liu")).statusCode, 403);
  const started = JSON.parse((await call("PUT", "/roll-requests", { action: "start", label: "The study", check: { skill: "perception" }, targets: ["eoghan", "liu"], dc: 10 }, "dm")).body).rollRequests[0];
  assert.deepEqual([started.dice, started.label], ["2d6", "The study"]);

  assert.equal((await call("POST", "/roll-requests/result", { asSlug: "eoghan", id: started.id, total: 9 }, "pw-liu")).statusCode, 403);
  const mine = JSON.parse((await call("POST", "/roll-requests/result", { asSlug: "eoghan", id: started.id, total: 11, rolls: [6, 3] }, "pw-eoghan")).body).rollRequests[0];
  assert.deepEqual([mine.mine.total, mine.label, mine.results], [11, undefined, undefined]);
  assert.equal((await call("POST", "/roll-requests/result", { asSlug: "eoghan", id: started.id, total: 2 }, "pw-eoghan")).statusCode, 409);

  await call("PUT", "/roll-requests", { action: "reveal", id: started.id }, "dm");
  assert.equal(state.record.requests[0].revealed, true);
  await call("PUT", "/roll-requests", { action: "close", id: started.id, names: { eoghan: "Eòghan", liu: "Liu Sha" } }, "dm");
  assert.equal(state.record.requests.length, 0);
  assert.deepEqual([state.log[0].type, state.log[0].label, state.log[0].rows[0]], ["check", "The study", { slug: "eoghan", name: "Eòghan", total: 11, pass: true }]);
  assert.ok(state.nudges >= 4);
});

test("a cancelled request isn't logged; strangers can't be asked", async () => {
  const { state, call } = load();
  assert.equal((await call("PUT", "/roll-requests", { action: "start", check: { ability: "dex", save: true }, targets: ["stranger"] }, "dm")).statusCode, 400);
  const r = JSON.parse((await call("PUT", "/roll-requests", { action: "start", check: { ability: "dex", save: true }, targets: ["liu"] }, "dm")).body).rollRequests[0];
  assert.equal(r.dice, "1d20");
  await call("PUT", "/roll-requests", { action: "cancel", id: r.id }, "dm");
  assert.equal(state.log.length, 0);
});
