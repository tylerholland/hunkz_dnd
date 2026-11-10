const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "giveItem.js");
const originalLoad = Module._load;

function load({ members = ["eoghan", "liu"] } = {}) {
  const state = {
    chars: {
      eoghan: { slug: "eoghan", name: "Eòghan", version: 4, weapons: [], equipment: [{ id: "p1", name: "Potion of Healing", qty: 2 }] },
      liu: { slug: "liu", name: "Liu Sha", version: 7, weapons: [], equipment: [] },
    },
    log: [],
    transacts: 0,
  };
  Module._load = function mocked(request, parent, isMain) {
    if (parent?.filename === handlerPath) {
      if (request === "@aws-sdk/lib-dynamodb") {
        return {
          BatchGetCommand: class { constructor(input) { this.input = input; this.kind = "get"; } },
          TransactWriteCommand: class { constructor(input) { this.input = input; this.kind = "tx"; } },
        };
      }
      if (request === "../lib/db") {
        return {
          TABLE: "t",
          db: {
            send: async (cmd) => {
              if (cmd.kind === "get") return { Responses: { t: cmd.input.RequestItems.t.Keys.map((k) => state.chars[k.slug]).filter(Boolean) } };
              state.transacts += 1;
              for (const { Put } of cmd.input.TransactItems) {
                assert.equal(Put.ExpressionAttributeValues[":expected"], state.chars[Put.Item.slug].version);
                state.chars[Put.Item.slug] = Put.Item;
              }
              return {};
            },
          },
        };
      }
      if (request === "../lib/auth") return { verifyPassword: async (pw, item) => ({ valid: pw === "dm" || pw === `pw-${item.slug}`, role: pw === "dm" ? "dm" : "owner" }) };
      if (request === "../lib/broadcast") return { notifySessionChanged: async () => {} };
      if (request === "../lib/specialRecords") return { appendRollHistoryEvent: async (e) => { state.log.push(e); }, getPartyRosterState: async () => ({ exists: true, members }) };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[handlerPath];
  const { handler } = require(handlerPath);
  Module._load = originalLoad;
  const give = (slug, body, password) => handler({ pathParameters: { slug }, headers: password ? { "x-character-password": password } : {}, body: JSON.stringify(body) });
  return { state, give };
}

test("a player gives one potion: both inventories change together, and it's logged", async () => {
  const { state, give } = load();
  assert.equal((await give("eoghan", { toSlug: "liu", itemId: "p1", qty: 1 }, "pw-liu")).statusCode, 403);
  const res = await give("eoghan", { toSlug: "liu", itemId: "p1", qty: 1 }, "pw-eoghan");
  assert.equal(res.statusCode, 200);
  assert.equal(state.transacts, 1);
  assert.equal(state.chars.eoghan.equipment[0].qty, 1);
  assert.deepEqual([state.chars.liu.equipment[0].name, state.chars.liu.equipment[0].qty], ["Potion of Healing", 1]);
  assert.deepEqual([state.log[0].type, state.log[0].to.name, state.log[0].item], ["give", "Liu Sha", "Potion of Healing"]);
});

test("only to someone else in the party, and only what you have", async () => {
  const { give } = load({ members: ["eoghan"] });
  assert.equal((await give("eoghan", { toSlug: "liu", itemId: "p1" }, "pw-eoghan")).statusCode, 403);
  const { give: give2 } = load();
  assert.equal((await give2("eoghan", { toSlug: "eoghan", itemId: "p1" }, "pw-eoghan")).statusCode, 400);
  assert.equal((await give2("eoghan", { toSlug: "liu", itemId: "p1", qty: 5 }, "pw-eoghan")).statusCode, 400);
});
