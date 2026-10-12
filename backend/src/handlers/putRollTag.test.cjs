const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "putRollTag.js");
const originalLoad = Module._load;

function load({ dm = true, inLog = false, records = {}, characters = {} } = {}) {
  const calls = { setRollTag: [], puts: [], notified: 0 };
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") return { GetCommand: class { constructor(input) { this.input = input; } } };
    if (parent && parent.filename === handlerPath) {
      if (request === "../lib/db") return { TABLE: "t", db: { send: async (cmd) => ({ Item: characters[cmd.input.Key.slug] }) } };
      // The DM check uses a dummy hash; a player's uses their record.
      if (request === "../lib/auth") {
        return {
          verifyPassword: async (password, item) => {
            if (item.passwordHash === "$2b$10$invalid") return dm ? { valid: true, role: "dm" } : { valid: false };
            return { valid: item.passwordHash === `hash:${password}`, role: "owner" };
          },
        };
      }
      if (request === "../lib/broadcast") return { notifySessionChanged: async () => { calls.notified += 1; } };
      if (request === "../lib/specialRecords") {
        return {
          setRollTag: async (id, tag) => { calls.setRollTag.push([id, tag]); return inLog; },
          getSpecialRecord: async (slug) => (records[slug] ? structuredClone(records[slug]) : null),
          putSpecialRecord: async (slug, payload) => { calls.puts.push([slug, payload]); records[slug] = { ...payload, slug, version: (records[slug]?.version ?? 0) + 1 }; return 1; },
        };
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[handlerPath];
  return { handler: require(handlerPath).handler, calls, records };
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
});

const req = (body) => ({ headers: { "x-character-password": "pw" }, pathParameters: { id: "roll-1" }, body: JSON.stringify(body) });

test("anyone signed in can label: the DM, or a player with their character's password", async () => {
  const characters = { aesop: { slug: "aesop", passwordHash: "hash:pw" } };
  const player = load({ dm: false, inLog: true, characters });
  assert.equal((await player.handler(req({ tag: "x", asSlug: "aesop" }))).statusCode, 200);
  const wrong = load({ dm: false, inLog: true, characters });
  assert.equal((await wrong.handler({ ...req({ tag: "x", asSlug: "aesop" }), headers: { "x-character-password": "nope" } })).statusCode, 403);
  const anon = load({ dm: false, inLog: true, characters });
  assert.equal((await anon.handler(req({ tag: "x" }))).statusCode, 403);
});

test("labels the event in the log and in the Chronicle session's own copy", async () => {
  const records = { "chronicle-session:s1": { slug: "chronicle-session:s1", id: "s1", version: 3, events: [{ id: "roll-1", label: "Free Roll" }, { id: "roll-2" }], summary: null } };
  const { handler, calls } = load({ inLog: false, records });
  const res = await handler(req({ tag: "  Persuade the goblin king ", sessionId: "s1" }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.setRollTag, [["roll-1", "Persuade the goblin king"]]);
  const [slug, payload] = calls.puts[0];
  assert.equal(slug, "chronicle-session:s1");
  assert.equal(payload.events[0].tag, "Persuade the goblin king");
  assert.equal(payload.id, "s1");
  assert.equal("version" in payload, false);
  assert.equal(calls.notified, 1);
});

test("404s when the event is nowhere", async () => {
  const { handler } = load({ inLog: false });
  assert.equal((await handler(req({ tag: "x", sessionId: "missing" }))).statusCode, 404);
});
