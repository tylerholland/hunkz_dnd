// Phase 0, step 0.4 — moving today's table into the game table.
// backend/src/lib/migration/campaignMigration.js:
//   planMigration(oldItems, { campaignId, libraryId, campaignName }) →
//     { items: [game-table items], report: { counts: { [kind]: n }, unplaced: [slug…], skippedEvents: [..] } }
// Pure: the interactive script (scripts/migrate-to-campaigns.mjs) reads the
// old table, calls this, prints the report (dry run) and writes the items.
// The proof that it's right is reading the result through the real store.
const test = require("node:test");
const assert = require("node:assert/strict");
const { need } = require("./helpers/need.cjs");
const { createFakeDynamo, GAME_TABLE, GAME_TABLE_DEF } = require("./helpers/fakeDynamo.cjs");
const { oldTable, at, CAMPAIGN_STATES, LIBRARY_RECORDS } = require("./helpers/fixtures.cjs");
const { gatherSessionEvents } = require("../../../backend/src/lib/chronicle");

const OPTS = { campaignId: "hunkz", libraryId: "hunkz", campaignName: "Hunkz Adventures" };

function migrate(items = oldTable().items) {
  const { planMigration } = need("backend/src/lib/migration/campaignMigration.js", "0.4");
  const { createDynamoStore } = need("backend/src/lib/store.js", "0.3");
  const plan = planMigration(items, OPTS);
  const fake = createFakeDynamo({ tables: { [GAME_TABLE]: GAME_TABLE_DEF } });
  fake.load(GAME_TABLE, plan.items);
  const store = createDynamoStore({ db: fake.db, commands: fake.commands, tableName: GAME_TABLE, now: () => Date.parse(at(300)) });
  return { plan, store, fake };
}
const strip = ({ slug, ...rest }) => rest;

test("the campaign exists, pointing at its library", async () => {
  const { store } = migrate();
  assert.deepEqual(await store.getCampaign("hunkz"), { id: "hunkz", name: "Hunkz Adventures", libraryId: "hunkz", version: 1 });
});

test("every live record becomes campaign state, unchanged, version kept", async () => {
  const { store } = migrate();
  const old = Object.fromEntries(oldTable().items.map((i) => [i.slug, i]));
  const states = await store.getCampaignStates("hunkz", CAMPAIGN_STATES);
  for (const name of CAMPAIGN_STATES) assert.deepEqual(states[name], strip(old[name]), name);
});

test("library records move to the library", async () => {
  const { store } = migrate();
  const old = Object.fromEntries(oldTable().items.map((i) => [i.slug, i]));
  for (const [slug, name] of Object.entries(LIBRARY_RECORDS)) assert.deepEqual(await store.getLibrary("hunkz", name), strip(old[slug]), slug);
});

test("characters keep everything and join the campaign", async () => {
  const { store } = migrate();
  for (const c of oldTable().characters) assert.deepEqual(await store.getCharacter(c.slug), { ...c, campaignId: "hunkz" });
  assert.deepEqual((await store.listCampaignCharacters("hunkz")).map((c) => c.slug).sort(), ["aesop", "eoghan", "liu-sha"]);
});

test("the live feed reads back exactly as it was", async () => {
  const { store } = migrate();
  const { live } = oldTable();
  assert.deepEqual(await store.readLog("hunkz", { limit: 100 }), live);
});

test("the whole log is kept: live plus archive, each event once", async () => {
  const { store, plan } = migrate();
  const { all } = oldTable();
  const everything = await store.readLog("hunkz", { limit: 10000 });
  assert.equal(everything.length, all.length);
  assert.deepEqual(everything.map((e) => e.id), [...all].reverse().map((e) => e.id));
  assert.equal(plan.report.counts.logEvents, all.length);
});

test("a Chronicle range reads the same as today's gatherSessionEvents", async () => {
  const { store } = migrate();
  const old = Object.fromEntries(oldTable().items.map((i) => [i.slug, i]));
  const sources = [old["roll-history"].rolls, old["roll-history-archive:0"].events, old["roll-history-archive:1"].events];
  const range = { startMs: Date.parse(at(60)), endMs: Date.parse(at(180)) };
  const before = gatherSessionEvents(sources, range).inRange.map((e) => e.id);
  const after = (await store.readLog("hunkz", { since: at(60), until: at(180), limit: 10000 })).map((e) => e.id).reverse();
  assert.deepEqual(after, before);
});

test("chronicle sessions and the deploy stamp move too", async () => {
  const { store } = migrate();
  const old = Object.fromEntries(oldTable().items.map((i) => [i.slug, i]));
  assert.deepEqual(await store.getChronicleSession("hunkz", "s1"), strip(old["chronicle-session:s1"]));
  assert.deepEqual(await store.getAppMeta(), strip(old["app-meta"]));
});

test("the report counts each kind and names what it couldn't place", () => {
  const { plan } = migrate();
  const c = plan.report.counts;
  assert.equal(c.characters, 3);
  assert.equal(c.campaignStates, CAMPAIGN_STATES.length);
  assert.equal(c.libraryRecords, Object.keys(LIBRARY_RECORDS).length);
  assert.equal(c.chronicleSessions, 1);
  assert.deepEqual(plan.report.unplaced, ["mystery-thing"]);
});

test("odd events: a time without milliseconds is tidied; no id or no time is reported, not guessed", () => {
  const { items } = oldTable();
  const rh = items.find((i) => i.slug === "roll-history");
  rh.rolls = [
    { id: "short-time", createdAt: "2026-10-01T23:00:00Z", label: "Free Roll" },
    { createdAt: at(400), label: "no id" },
    { id: "no-time", label: "Free Roll" },
    ...rh.rolls,
  ];
  const { plan } = migrate(items);
  const logged = plan.items.filter((i) => String(i.SK).startsWith("LOG#"));
  assert.ok(logged.some((i) => i.SK === "LOG#2026-10-01T23:00:00.000Z#short-time"));
  assert.equal(plan.report.skippedEvents.length, 2);
});

test("every item is a valid game-table item under DynamoDB's size limit", () => {
  const { plan } = migrate();
  for (const it of plan.items) {
    assert.equal(typeof it.PK, "string");
    assert.equal(typeof it.SK, "string");
    assert.ok(JSON.stringify(it).length < 400 * 1024, `${it.PK} ${it.SK} too big`);
  }
});

test("planning is deterministic (safe to dry-run, then run)", () => {
  const { planMigration } = need("backend/src/lib/migration/campaignMigration.js", "0.4");
  assert.deepEqual(planMigration(oldTable().items, OPTS), planMigration(oldTable().items, OPTS));
});
