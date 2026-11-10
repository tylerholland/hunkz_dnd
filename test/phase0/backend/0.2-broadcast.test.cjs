// Phase 0, step 0.2 — live-update nudges go only to the campaign that changed.
// backend/src/lib/broadcast.js gains a testable core:
//   createBroadcaster({ db, commands, connectionsTable, post }) →
//     { notifySessionChanged(campaignId, payload = { type: "changed" }), broadcastReload() }
//   where post(connectionId, dataString) sends one message (the management API
//   in production) and may throw a 410 / GoneException for a dead connection.
//   connectionRecord({ connectionId, query, nowMs }) → the item wsConnect.js stores.
// The connections table gets an index named "campaign" on campaignId.
const test = require("node:test");
const assert = require("node:assert/strict");
const { need } = require("./helpers/need.cjs");
const { createFakeDynamo, CONNECTIONS_TABLE, CONNECTIONS_TABLE_DEF } = require("./helpers/fakeDynamo.cjs");

function setup(connections) {
  const { createBroadcaster } = need("backend/src/lib/broadcast.js", "0.2");
  const fake = createFakeDynamo({ tables: { [CONNECTIONS_TABLE]: CONNECTIONS_TABLE_DEF } });
  fake.load(CONNECTIONS_TABLE, connections);
  const sent = [];
  const gone = new Set();
  const post = async (connectionId, data) => {
    if (gone.has(connectionId)) { const err = new Error("Gone"); err.name = "GoneException"; err.$metadata = { httpStatusCode: 410 }; throw err; }
    sent.push({ connectionId, data: JSON.parse(data) });
  };
  const b = createBroadcaster({ db: fake.db, commands: fake.commands, connectionsTable: CONNECTIONS_TABLE, post });
  if (typeof b?.notifySessionChanged !== "function") throw new Error("createBroadcaster must return notifySessionChanged");
  return { b, fake, sent, gone };
}

const conns = [
  { connectionId: "a1", campaignId: "hunkz" },
  { connectionId: "a2", campaignId: "hunkz" },
  { connectionId: "b1", campaignId: "other" },
];

test("a change nudges only that campaign's screens, without a Scan", async () => {
  const { b, fake, sent } = setup(conns);
  await b.notifySessionChanged("hunkz");
  assert.deepEqual(sent.map((s) => s.connectionId).sort(), ["a1", "a2"]);
  assert.deepEqual(sent[0].data, { type: "changed" });
  assert.equal(fake.calls.filter((c) => c.name === "ScanCommand").length, 0);
  assert.ok(fake.calls.some((c) => c.name === "QueryCommand" && c.input.IndexName === "campaign"));
});

test("a deploy reload still reaches everyone", async () => {
  const { b, sent } = setup(conns);
  await b.broadcastReload();
  assert.deepEqual(sent.map((s) => s.connectionId).sort(), ["a1", "a2", "b1"]);
  assert.deepEqual(sent[0].data, { type: "reload" });
});

test("dead connections are pruned, and nothing ever throws", async () => {
  const { b, fake, gone } = setup(conns);
  gone.add("a2");
  await b.notifySessionChanged("hunkz");
  assert.deepEqual(fake.items(CONNECTIONS_TABLE).map((c) => c.connectionId).sort(), ["a1", "b1"]);
  const broken = need("backend/src/lib/broadcast.js", "0.2").createBroadcaster({ db: { send: async () => { throw new Error("boom"); } }, commands: fake.commands, connectionsTable: CONNECTIONS_TABLE, post: async () => {} });
  await assert.doesNotReject(broken.notifySessionChanged("hunkz"));
});

test("connections remember their campaign (default: hunkz)", () => {
  const { connectionRecord } = need("backend/src/lib/broadcast.js", "0.2");
  const now = Date.UTC(2026, 10, 10, 19, 0, 0);
  const rec = connectionRecord({ connectionId: "c1", query: { campaign: "other" }, nowMs: now });
  assert.equal(rec.campaignId, "other");
  assert.equal(rec.ttl, Math.floor(now / 1000) + 12 * 60 * 60, "12 h TTL, as today");
  assert.equal(connectionRecord({ connectionId: "c2", query: {}, nowMs: now }).campaignId, "hunkz");
  assert.equal(connectionRecord({ connectionId: "c3", query: { campaign: "Bad Id!" }, nowMs: now }).campaignId, "hunkz", "junk falls back to the default");
});
