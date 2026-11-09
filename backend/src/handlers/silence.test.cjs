const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "silence.js");
const originalLoad = Module._load;

function load() {
  const state = { record: null, version: 0, nudges: 0 };
  Module._load = function mocked(request, parent, isMain) {
    if (parent?.filename === handlerPath) {
      if (request === "@aws-sdk/lib-dynamodb") return { GetCommand: class { constructor(input) { this.input = input; } } };
      if (request === "../lib/db") return { TABLE: "t", db: { send: async (cmd) => ({ Item: { slug: cmd.input.Key.slug } }) } };
      if (request === "../lib/auth") return { verifyPassword: async (pw, item) => ({ valid: pw === "dm" || pw === `pw-${item.slug}`, role: pw === "dm" ? "dm" : "owner" }) };
      if (request === "../lib/broadcast") return { notifySessionChanged: async () => { state.nudges += 1; } };
      if (request === "../lib/specialRecords") {
        return {
          getSpecialRecord: async () => (state.record ? { ...state.record, version: state.version } : null),
          putSpecialRecord: async (_slug, payload, { expectedVersion }) => { assert.equal(expectedVersion, state.version); state.record = payload; state.version += 1; return state.version; },
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

test("the DM asks for silence, players say they're listening, the DM lifts it", async () => {
  const { state, call } = load();
  assert.equal((await call("PUT", "/silence", { action: "start" }, "pw-liu")).statusCode, 403);
  const started = JSON.parse((await call("PUT", "/silence", { action: "start" }, "dm")).body).silence;
  assert.deepEqual(started.acks, []);
  assert.equal((await call("POST", "/silence/ack", { asSlug: "liu", id: started.id }, "pw-eoghan")).statusCode, 403);
  await call("POST", "/silence/ack", { asSlug: "liu", id: started.id }, "pw-liu");
  await call("POST", "/silence/ack", { asSlug: "liu", id: started.id }, "pw-liu");
  assert.deepEqual(state.record.acks, ["liu"]);
  await call("PUT", "/silence", { action: "lift" }, "dm");
  assert.ok(state.record.cleared);
  const late = JSON.parse((await call("POST", "/silence/ack", { asSlug: "eoghan", id: started.id }, "pw-eoghan")).body);
  assert.equal(late.silence, null);
});
