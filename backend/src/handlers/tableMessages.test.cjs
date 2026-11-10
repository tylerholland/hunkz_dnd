const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "tableMessages.js");
const originalLoad = Module._load;

function load({ members = ["eoghan", "liu"] } = {}) {
  const state = { records: {}, versions: {}, log: [], nudges: 0 };
  Module._load = function mocked(request, parent, isMain) {
    if (parent?.filename === handlerPath) {
      if (request === "@aws-sdk/lib-dynamodb") return { GetCommand: class { constructor(input) { this.input = input; } } };
      if (request === "../lib/db") return { TABLE: "t", db: { send: async (cmd) => ({ Item: { slug: cmd.input.Key.slug, name: cmd.input.Key.slug === "liu" ? "Liu Sha" : cmd.input.Key.slug } }) } };
      if (request === "../lib/auth") return { verifyPassword: async (pw, item) => ({ valid: pw === "dm" || pw === `pw-${item.slug}`, role: pw === "dm" ? "dm" : "owner" }) };
      if (request === "../lib/broadcast") return { notifySessionChanged: async () => { state.nudges += 1; } };
      if (request === "../lib/specialRecords") {
        return {
          getSpecialRecord: async (slug) => (state.records[slug] ? { ...state.records[slug], version: state.versions[slug] } : null),
          putSpecialRecord: async (slug, payload, { expectedVersion }) => { assert.equal(expectedVersion, state.versions[slug] || 0); state.records[slug] = payload; state.versions[slug] = (state.versions[slug] || 0) + 1; return state.versions[slug]; },
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

test("the DM prepares a note, passes it from the deck; the player replies", async () => {
  const { state, call } = load();
  assert.equal((await call("PUT", "/prep-deck", { action: "save", card: { text: "x", to: "all" } }, "pw-liu")).statusCode, 403);
  const deck = JSON.parse((await call("PUT", "/prep-deck", { action: "save", card: { title: "The boy", text: "A boy watches you.", to: "choose" } }, "dm")).body).prepDeck;
  const cardId = deck[0].id;
  assert.equal((await call("POST", "/table-messages", { cardId }, "dm")).statusCode, 400); // pick who
  const sent = JSON.parse((await call("POST", "/table-messages", { cardId, to: ["liu"], names: { liu: "Liu Sha" } }, "dm")).body);
  assert.ok(sent.prepDeck[0].usedAt);
  const id = sent.tableMessages[0].id;
  assert.deepEqual([state.log[0].type, state.log[0].toNames], ["note", ["Liu Sha"]]);

  assert.equal((await call("POST", "/table-messages/reply", { asSlug: "eoghan", id, text: "me too" }, "pw-eoghan")).statusCode, 409);
  const mine = JSON.parse((await call("POST", "/table-messages/reply", { asSlug: "liu", id, text: "I follow him" }, "pw-liu")).body).tableMessages[0];
  assert.equal(mine.myReply, "I follow him");
  assert.deepEqual([state.log[1].type, state.log[1].name, state.log[1].text], ["note-reply", "Liu Sha", "I follow him"]);
});

test("a moment sent on the spot reaches everyone; seen is recorded", async () => {
  const { state, call } = load();
  const sent = JSON.parse((await call("POST", "/table-messages", { card: { title: "Smoke", text: "Bells ring at the north gate.", to: "all" } }, "dm")).body).tableMessages[0];
  assert.equal(sent.kind, "moment");
  await call("POST", "/table-messages/seen", { asSlug: "eoghan", id: sent.id }, "pw-eoghan");
  assert.deepEqual(state.records["table-messages"].messages[0].seen, ["eoghan"]);
  assert.equal(state.log[0].type, "moment");
});
