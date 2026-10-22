const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { normalizeTalentCodexEntries } = require("../lib/talentCodex");

const handlerPath = path.resolve(__dirname, "talentCodex.js");
const originalLoad = Module._load;

function load({ dm = true, record = null } = {}) {
  const calls = { puts: [], notified: 0 };
  Module._load = function mockedLoad(request, parent, isMain) {
    if (parent && parent.filename === handlerPath) {
      if (request === "../lib/auth") return { verifyPassword: async () => (dm ? { valid: true, role: "dm" } : { valid: false }) };
      if (request === "../lib/broadcast") return { notifySessionChanged: async () => { calls.notified += 1; } };
      if (request === "../lib/specialRecords") {
        return {
          getSpecialRecord: async () => record,
          putSpecialRecord: async (slug, payload) => { calls.puts.push([slug, payload]); return 4; },
        };
      }
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

test("normalizer keeps only real overrides, bounded, under valid keys", () => {
  const out = normalizeTalentCodexEntries({
    awareness: { description: "  Spot the unseen. ", atTable: "+1 in darkness", updatedAt: "t" },
    stealth: { description: "", atTable: "" },
    "Bad Key!": { description: "x" },
    backstab: { atTable: "Only from hiding" },
  });
  assert.deepEqual(out, {
    awareness: { description: "Spot the unseen.", atTable: "+1 in darkness", updatedAt: "t" },
    backstab: { atTable: "Only from hiding", updatedAt: null },
  });
});

test("anyone can read the codex; only the DM can replace it", async () => {
  const reader = load({ dm: false, record: { entries: { lore: { description: "Old tales." } }, version: 3 } });
  const got = await reader.handler({ requestContext: { http: { method: "GET" } } });
  assert.equal(got.statusCode, 200);
  assert.deepEqual(JSON.parse(got.body), { entries: { lore: { description: "Old tales.", updatedAt: null } }, version: 3 });

  const denied = await reader.handler({ requestContext: { http: { method: "PUT" } }, headers: {}, body: JSON.stringify({ entries: {} }) });
  assert.equal(denied.statusCode, 403);

  const dm = load({ dm: true });
  const saved = await dm.handler({ requestContext: { http: { method: "PUT" } }, headers: { "x-character-password": "dm" }, body: JSON.stringify({ entries: { lore: { description: "New tales." } } }) });
  assert.equal(saved.statusCode, 200);
  assert.equal(dm.calls.puts[0][0], "talent-codex");
  assert.equal(dm.calls.puts[0][1].entries.lore.description, "New tales.");
  assert.ok(dm.calls.puts[0][1].entries.lore.updatedAt);
  assert.equal(dm.calls.notified, 1);
});
