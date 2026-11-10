// Phase 0 — "nothing visible changes", proven on the one response every
// screen polls. The golden files in ./golden were captured from TODAY's
// handler (helpers/captureGolden.cjs) for the fixture, as the DM, a player and
// a stranger. After migration, the rebuilt handler — reading through the store
// — must return the same thing for the same data.
//
// Needs: store.js `setStore(store)` (the handlers' store, swappable for
// tests), steps 0.3 (dynamo store) and 0.4 (migration). Modules must load
// without the AWS SDK installed locally (require it lazily, in the default
// store/broadcaster only).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { need, ROOT } = require("./helpers/need.cjs");
const { createFakeDynamo, GAME_TABLE, GAME_TABLE_DEF } = require("./helpers/fakeDynamo.cjs");
const { oldTable } = require("./helpers/fixtures.cjs");
const { VIEWERS, DM_HASH, stable } = require("./helpers/todaySessionState.cjs");

async function newSessionState(viewer) {
  const storeModule = need("backend/src/lib/store.js", "0.3");
  const { planMigration } = need("backend/src/lib/migration/campaignMigration.js", "0.4");
  const fake = createFakeDynamo({ tables: { [GAME_TABLE]: GAME_TABLE_DEF } });
  fake.load(GAME_TABLE, planMigration(oldTable().items, { campaignId: "hunkz", libraryId: "hunkz", campaignName: "Hunkz Adventures" }).items);
  storeModule.setStore(storeModule.createDynamoStore({ db: fake.db, commands: fake.commands, tableName: GAME_TABLE, now: () => Date.now() }));
  process.env.DM_PASSWORD_HASH = DM_HASH;
  const handlerPath = path.join(ROOT, "backend/src/handlers/getSessionState.js");
  delete require.cache[handlerPath];
  const { handler } = require(handlerPath);
  const res = await handler(VIEWERS[viewer]);
  return { statusCode: res.statusCode, body: stable(JSON.parse(res.body)), calls: fake.calls };
}

for (const viewer of Object.keys(VIEWERS)) {
  test(`GET /session-state as ${viewer} is unchanged after the move`, async () => {
    const golden = require(`./golden/session-state.${viewer}.json`);
    const res = await newSessionState(viewer);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, golden);
  });
}

test("GET /session-state still costs at most three reads, none of them Scans", async () => {
  const { calls } = await newSessionState("dm");
  const reads = calls.filter((c) => ["GetCommand", "BatchGetCommand", "QueryCommand", "ScanCommand"].includes(c.name));
  assert.equal(reads.filter((c) => c.name === "ScanCommand").length, 0);
  assert.ok(reads.length <= 3, `${reads.length} reads: ${reads.map((c) => c.name).join(", ")}`);
});
