// Phase 0, steps 0.1 + 0.3 — the store: every handler's only way to the data.
// One contract, two implementations:
//   createMemoryStore({ now })                               — for handler tests
//   createDynamoStore({ db, commands, tableName, now })      — the game table
// Both from backend/src/lib/store.js. `now()` returns ms; tests control it.
//
// Contract (see design/architecture/multi-campaign-plan.md, "0.1"):
//   getCampaign(id) / putCampaign({ id, name, libraryId, … })
//   getCampaignStates(campaignId, names) → { [name]: record|null }
//   putCampaignState(campaignId, name, payload, { expectedVersion? }) → new version
//   appendLog(campaignId, events)           — idempotent by event id
//   readLog(campaignId, { limit?, before?, since?, until? }) → events, newest first
//   updateLogEvent(campaignId, { id, createdAt? }, changes) → event | null
//   getCharacter(id) / createCharacter(item) / putCharacter(item, { expectedVersion? })
//   deleteCharacter(id) / listCampaignCharacters(campaignId)
//   getLibrary(libraryId, name) / putLibrary(libraryId, name, payload, { expectedVersion? })
//   getChronicleSession(campaignId, id) / putChronicleSession(campaignId, record, { expectedVersion? })
//   getAppMeta() / putAppMeta(meta)
// Records come back with their `version` (ADR-030). A stale expectedVersion
// throws VersionConflictError (lib/versioning.js); expectedVersion 0 means
// "must not exist yet"; no expectedVersion means write regardless.
const test = require("node:test");
const assert = require("node:assert/strict");
const { need } = require("./helpers/need.cjs");
const { createFakeDynamo, GAME_TABLE, GAME_TABLE_DEF } = require("./helpers/fakeDynamo.cjs");
const { VersionConflictError } = require("../../../backend/src/lib/versioning");

const T0 = Date.UTC(2026, 10, 10, 19, 0, 0);
const iso = (min) => new Date(T0 + min * 60000).toISOString();
const ev = (n, extra = {}) => ({ id: `roll-${n}`, slug: "eoghan", label: "Free Roll", total: n, createdAt: iso(n), ...extra });

const factories = {
  memory: () => {
    const { createMemoryStore } = need("backend/src/lib/store.js", "0.1");
    let clock = T0 + 1000 * 60 * 60;
    return { store: createMemoryStore({ now: () => clock }), setNow: (ms) => { clock = ms; } };
  },
  dynamo: () => {
    const { createDynamoStore } = need("backend/src/lib/store.js", "0.3");
    const fake = createFakeDynamo({ tables: { [GAME_TABLE]: GAME_TABLE_DEF } });
    let clock = T0 + 1000 * 60 * 60;
    return { store: createDynamoStore({ db: fake.db, commands: fake.commands, tableName: GAME_TABLE, now: () => clock }), fake, setNow: (ms) => { clock = ms; } };
  },
};

for (const [kind, make] of Object.entries(factories)) {
  test(`[${kind}] campaign state: round trip, versions, conflicts`, async () => {
    const { store } = make();
    assert.deepEqual(await store.getCampaignStates("hunkz", ["initiative", "party-vote"]), { initiative: null, "party-vote": null });
    assert.equal(await store.putCampaignState("hunkz", "initiative", { entries: [], round: 1 }, { expectedVersion: 0 }), 1);
    assert.equal(await store.putCampaignState("hunkz", "initiative", { entries: [], round: 2 }, { expectedVersion: 1 }), 2);
    await assert.rejects(store.putCampaignState("hunkz", "initiative", { round: 9 }, { expectedVersion: 1 }), VersionConflictError);
    await assert.rejects(store.putCampaignState("hunkz", "initiative", { round: 9 }, { expectedVersion: 0 }), VersionConflictError);
    const { initiative } = await store.getCampaignStates("hunkz", ["initiative"]);
    assert.deepEqual(initiative, { entries: [], round: 2, version: 2 });
    assert.equal(await store.putCampaignState("hunkz", "initiative", { round: 3 }), 3, "no expectedVersion: write regardless, still bump the version");
  });

  test(`[${kind}] campaign state is separate per campaign`, async () => {
    const { store } = make();
    await store.putCampaignState("hunkz", "house-rules", { abilityCheckDice: "2d6" });
    await store.putCampaignState("other", "house-rules", { abilityCheckDice: "1d20" });
    const a = (await store.getCampaignStates("hunkz", ["house-rules"]))["house-rules"];
    const b = (await store.getCampaignStates("other", ["house-rules"]))["house-rules"];
    assert.equal(a.abilityCheckDice, "2d6");
    assert.equal(b.abilityCheckDice, "1d20");
  });

  test(`[${kind}] state payloads never carry their storage keys`, async () => {
    const { store } = make();
    await store.putCampaignState("hunkz", "shop", { keeper: "humble" });
    const { shop } = await store.getCampaignStates("hunkz", ["shop"]);
    for (const key of ["PK", "SK", "GSI1PK", "GSI1SK", "slug", "campaignId"]) assert.equal(key in shop, false, `${key} leaked`);
  });

  test(`[${kind}] campaign ids are checked`, async () => {
    const { store } = make();
    for (const bad of ["", "Has Space", "a#b", "x".repeat(41), null]) {
      await assert.rejects(store.putCampaignState(bad, "initiative", {}), /campaign/i, `accepted ${JSON.stringify(bad)}`);
    }
  });

  test(`[${kind}] campaign meta`, async () => {
    const { store } = make();
    assert.equal(await store.getCampaign("hunkz"), null);
    await store.putCampaign({ id: "hunkz", name: "Hunkz Adventures", libraryId: "hunkz" });
    assert.deepEqual(await store.getCampaign("hunkz"), { id: "hunkz", name: "Hunkz Adventures", libraryId: "hunkz", version: 1 });
  });

  test(`[${kind}] log: newest first, limited, and kept whole (no ring)`, async () => {
    const { store } = make();
    const events = Array.from({ length: 3500 }, (_, n) => ev(n));
    await store.appendLog("hunkz", events);
    const latest = await store.readLog("hunkz");
    assert.equal(latest.length, 100, "default limit is the live feed's 100");
    assert.equal(latest[0].id, "roll-3499");
    assert.equal(latest[99].id, "roll-3400");
    const oldest = await store.readLog("hunkz", { until: iso(2), limit: 10 });
    assert.deepEqual(oldest.map((e) => e.id), ["roll-2", "roll-1", "roll-0"], "nothing is overwritten after 3,100 events");
  });

  test(`[${kind}] log: appending the same event twice keeps one`, async () => {
    const { store } = make();
    await store.appendLog("hunkz", [ev(1), ev(2)]);
    await store.appendLog("hunkz", [ev(2), ev(3)]);
    assert.deepEqual((await store.readLog("hunkz")).map((e) => e.id), ["roll-3", "roll-2", "roll-1"]);
  });

  test(`[${kind}] log: events need an id and a createdAt`, async () => {
    const { store } = make();
    await assert.rejects(store.appendLog("hunkz", [{ id: "x" }]), TypeError);
    await assert.rejects(store.appendLog("hunkz", [{ createdAt: iso(1) }]), TypeError);
  });

  test(`[${kind}] log: ranges (Chronicle) and paging (archive)`, async () => {
    const { store } = make();
    await store.appendLog("hunkz", Array.from({ length: 30 }, (_, n) => ev(n)));
    const range = await store.readLog("hunkz", { since: iso(10), until: iso(12), limit: 1000 });
    assert.deepEqual(range.map((e) => e.id), ["roll-12", "roll-11", "roll-10"], "since and until are inclusive");
    const page = await store.readLog("hunkz", { before: iso(5), limit: 3 });
    assert.deepEqual(page.map((e) => e.id), ["roll-4", "roll-3", "roll-2"], "before is exclusive");
  });

  test(`[${kind}] log: separate per campaign`, async () => {
    const { store } = make();
    await store.appendLog("hunkz", [ev(1)]);
    await store.appendLog("other", [ev(2)]);
    assert.deepEqual((await store.readLog("hunkz")).map((e) => e.id), ["roll-1"]);
    assert.deepEqual((await store.readLog("other")).map((e) => e.id), ["roll-2"]);
  });

  test(`[${kind}] log: events come back exactly as written`, async () => {
    const { store } = make();
    const original = ev(7, { target: { type: "npc", sourceId: "n1", name: "Goblin" }, riders: [{ label: "Hex", total: 3 }] });
    await store.appendLog("hunkz", [original]);
    assert.deepEqual((await store.readLog("hunkz"))[0], original);
  });

  test(`[${kind}] log: updating an event (a tag, Applied, an effect note)`, async () => {
    const { store, setNow } = make();
    await store.appendLog("hunkz", [ev(1), ev(2)]);
    const updated = await store.updateLogEvent("hunkz", { id: "roll-1", createdAt: iso(1) }, { tag: "Longbow damage" });
    assert.equal(updated.tag, "Longbow damage");
    assert.equal((await store.readLog("hunkz")).find((e) => e.id === "roll-1").tag, "Longbow damage");
    // Without createdAt, it's found if it happened in the last 24 hours…
    setNow(T0 + 60 * 60 * 1000);
    assert.equal((await store.updateLogEvent("hunkz", { id: "roll-2" }, { tag: "Stealth check" })).tag, "Stealth check");
    // …and not otherwise, nor in another campaign.
    setNow(T0 + 3 * 24 * 60 * 60 * 1000);
    assert.equal(await store.updateLogEvent("hunkz", { id: "roll-2" }, { tag: "late" }), null);
    assert.equal(await store.updateLogEvent("other", { id: "roll-1", createdAt: iso(1) }, { tag: "x" }), null);
    // An update can't move or rename the event.
    const kept = await store.updateLogEvent("hunkz", { id: "roll-1", createdAt: iso(1) }, { id: "hacked", createdAt: iso(99) });
    assert.equal(kept.id, "roll-1");
    assert.equal(kept.createdAt, iso(1));
  });

  test(`[${kind}] characters: create once, version, list by campaign, move`, async () => {
    const { store } = make();
    const eoghan = { slug: "eoghan", name: "Eòghan", campaignId: "hunkz", hpCurrent: 18 };
    assert.equal(await store.createCharacter(eoghan), 1);
    await assert.rejects(store.createCharacter({ ...eoghan, name: "Impostor" }), (err) => err.code === "SLUG_TAKEN");
    await store.createCharacter({ slug: "liu-sha", name: "Liu Sha", campaignId: "hunkz" });
    await store.createCharacter({ slug: "zed", name: "Zed", campaignId: "other" });
    assert.deepEqual((await store.listCampaignCharacters("hunkz")).map((c) => c.slug).sort(), ["eoghan", "liu-sha"]);

    const got = await store.getCharacter("eoghan");
    assert.equal(got.version, 1);
    await store.putCharacter({ ...got, hpCurrent: 12 }, { expectedVersion: 1 });
    await assert.rejects(store.putCharacter({ ...got, hpCurrent: 1 }, { expectedVersion: 1 }), VersionConflictError);

    // Moving a character is one field; it changes which list it's in.
    const now = await store.getCharacter("eoghan");
    await store.putCharacter({ ...now, campaignId: "other" }, { expectedVersion: now.version });
    assert.deepEqual((await store.listCampaignCharacters("hunkz")).map((c) => c.slug), ["liu-sha"]);
    assert.deepEqual((await store.listCampaignCharacters("other")).map((c) => c.slug).sort(), ["eoghan", "zed"]);
    assert.equal((await store.getCharacter("eoghan")).hpCurrent, 12, "the sheet travels with it");

    await store.deleteCharacter("zed");
    assert.equal(await store.getCharacter("zed"), null);
    assert.deepEqual((await store.listCampaignCharacters("other")).map((c) => c.slug), ["eoghan"]);
  });

  test(`[${kind}] characters keep every field, and no storage keys leak`, async () => {
    const { store } = make();
    const item = { slug: "aesop", name: "Aesop", campaignId: "hunkz", passwordHash: "$2b$10$x", weapons: [{ id: "w", name: "Mace", mods: [] }], deathSaves: { successes: 1, failures: 0 } };
    await store.createCharacter(item);
    const got = await store.getCharacter("aesop");
    assert.deepEqual(got, { ...item, version: 1 });
  });

  test(`[${kind}] libraries are keyed by library, not campaign`, async () => {
    const { store } = make();
    assert.equal(await store.getLibrary("hunkz", "NPCS"), null);
    assert.equal(await store.putLibrary("hunkz", "NPCS", { templates: [{ id: "t1", name: "Goblin" }] }, { expectedVersion: 0 }), 1);
    await assert.rejects(store.putLibrary("hunkz", "NPCS", { templates: [] }, { expectedVersion: 0 }), VersionConflictError);
    assert.equal((await store.getLibrary("hunkz", "NPCS")).templates[0].name, "Goblin");
    assert.equal(await store.getLibrary("someone-else", "NPCS"), null);
  });

  test(`[${kind}] chronicle sessions live with their campaign`, async () => {
    const { store } = make();
    await store.putChronicleSession("hunkz", { id: "s1", events: [ev(1)], summary: null }, { expectedVersion: 0 });
    assert.equal((await store.getChronicleSession("hunkz", "s1")).events.length, 1);
    assert.equal(await store.getChronicleSession("other", "s1"), null);
  });

  test(`[${kind}] app meta (the deploy stamp)`, async () => {
    const { store } = make();
    assert.equal(await store.getAppMeta(), null);
    await store.putAppMeta({ buildVersion: "v1", deployedAt: iso(0) });
    assert.equal((await store.getAppMeta()).buildVersion, "v1");
  });
}

test("[dynamo] one item per log event, read without Scans", async () => {
  const { store, fake } = factories.dynamo();
  await store.appendLog("hunkz", Array.from({ length: 60 }, (_, n) => ev(n)));
  await store.readLog("hunkz");
  await store.listCampaignCharacters("hunkz");
  const logItems = fake.items(GAME_TABLE).filter((i) => String(i.SK).startsWith("LOG#"));
  assert.equal(logItems.length, 60);
  assert.equal(fake.calls.filter((c) => c.name === "ScanCommand").length, 0);
  assert.ok(fake.calls.some((c) => c.name === "BatchWriteCommand"), "appends in batches");
});

test("[dynamo] a campaign's live state is one BatchGet", async () => {
  const { store, fake } = factories.dynamo();
  const names = ["initiative", "npc-combat", "map-library", "party-roster", "house-rules", "shop", "presence", "party-vote", "roll-requests", "table-silence", "prep-deck", "table-messages", "counter-wheels", "chronicle"];
  for (const n of names) await store.putCampaignState("hunkz", n, { n });
  fake.calls.length = 0;
  const states = await store.getCampaignStates("hunkz", names);
  assert.equal(Object.keys(states).length, names.length);
  assert.deepEqual(fake.calls.map((c) => c.name), ["BatchGetCommand"]);
});
