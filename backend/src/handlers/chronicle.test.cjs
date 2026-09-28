const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "chronicle.js");
const specialRecordsPath = path.resolve(__dirname, "../lib/specialRecords.js");
const originalLoad = Module._load;

function fakeTable(seed = {}) {
  const items = new Map(Object.entries(seed).map(([slug, item]) => [slug, { slug, ...item }]));
  const send = async (command) => {
    const input = command.input;
    if (command.kind === "get") return { Item: items.has(input.Key.slug) ? structuredClone(items.get(input.Key.slug)) : undefined };
    if (command.kind === "delete") { items.delete(input.Key.slug); return {}; }
    if (command.kind === "put") {
      const existing = items.get(input.Item.slug);
      const expected = input.ExpressionAttributeValues?.[":expected"];
      if (existing && Number.isFinite(existing.version) && existing.version !== expected) {
        const err = new Error("conditional"); err.name = "ConditionalCheckFailedException"; throw err;
      }
      items.set(input.Item.slug, structuredClone(input.Item));
      return {};
    }
    throw new Error(`unexpected ${command.kind}`);
  };
  return { items, send };
}

// DM password "dm"; Aesop's password "aesop".
function load(send) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        GetCommand: class { constructor(input) { this.input = input; this.kind = "get"; } },
        PutCommand: class { constructor(input) { this.input = input; this.kind = "put"; } },
        DeleteCommand: class { constructor(input) { this.input = input; this.kind = "delete"; } },
      };
    }
    if ((request === "../lib/db" && parent?.filename === handlerPath) || (request === "./db" && parent?.filename === specialRecordsPath)) {
      return { db: { send }, TABLE: "t" };
    }
    if (request === "../lib/auth" && parent?.filename === handlerPath) {
      return {
        verifyPassword: async (password, item) => {
          if (password === "dm") return { valid: true, role: "dm" };
          if (item.slug === "aesop" && password === "aesop") return { valid: true, role: "owner" };
          return { valid: false };
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
  return require(handlerPath).handler;
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
});

const at = (min) => new Date(Date.UTC(2026, 6, 23, 2, min)).toISOString();
const seed = () => ({
  "roll-history": {
    version: 3,
    rolls: [
      { id: "late", createdAt: at(200), slug: "liu", characterName: "Liu Sha", total: 4 },
      { id: "hp1", type: "hp", createdAt: at(40), subject: { type: "npc", sourceId: "gob", name: "Goblin" }, from: 12, to: 4, max: 12, delta: -8 },
      { id: "r2", createdAt: at(30), slug: "aesop", characterName: "Aesop", paletteKey: "nightwood", total: 11 },
    ],
  },
  "roll-history-archive:0": { version: 1, seq: 0, events: [{ id: "r1", createdAt: at(10), slug: "eoghan", characterName: "Eòghan", total: 9 }] },
  aesop: { name: "Aesop", palette: "nightwood", passwordHash: "x" },
});
const req = (method, path, { body, password, query } = {}) => ({
  requestContext: { http: { method } },
  rawPath: path,
  headers: password ? { "x-character-password": password } : {},
  queryStringParameters: query,
  body: body ? JSON.stringify(body) : undefined,
});

test("the DM records a session from the live log and the archive; players see it without NPC HP totals", async () => {
  const { send } = fakeTable(seed());
  const handler = load(send);
  const res = await handler(req("POST", "/chronicle/sessions", { password: "dm", body: { title: "Session 1", startAt: at(0), endAt: at(60), newChapterName: "The Road" } }));
  assert.equal(res.statusCode, 201);
  const { session } = JSON.parse(res.body);
  assert.equal(session.eventCount, 3);
  assert.equal(session.startAt, at(10));
  assert.deepEqual(session.players.map((p) => p.slug).sort(), ["aesop", "eoghan"]);

  const index = JSON.parse((await handler(req("GET", "/chronicle"))).body);
  assert.equal(index.chapters[0].name, "The Road");
  assert.equal(index.sessions[0].chapterId, index.chapters[0].id);

  const pub = JSON.parse((await handler(req("GET", `/chronicle/sessions/${session.id}`))).body).session;
  const hp = pub.events.find((e) => e.id === "hp1");
  assert.equal(hp.from, undefined);
  assert.equal(hp.delta, -8);
  const dm = JSON.parse((await handler(req("GET", `/chronicle/sessions/${session.id}`, { password: "dm" }))).body).session;
  assert.equal(dm.events.find((e) => e.id === "hp1").from, 12);
});

test("sessions can't overlap, and only the DM can record", async () => {
  const { send } = fakeTable(seed());
  const handler = load(send);
  assert.equal((await handler(req("POST", "/chronicle/sessions", { password: "aesop", body: { startAt: at(0), endAt: at(60) } }))).statusCode, 403);
  await handler(req("POST", "/chronicle/sessions", { password: "dm", body: { startAt: at(0), endAt: at(35) } }));
  const clash = await handler(req("POST", "/chronicle/sessions", { password: "dm", body: { startAt: at(20), endAt: at(60) } }));
  assert.equal(clash.statusCode, 409);
  const later = await handler(req("POST", "/chronicle/sessions", { password: "dm", body: { startAt: at(36), endAt: at(300), excludedEventIds: ["late"] } }));
  assert.equal(JSON.parse(later.body).session.eventCount, 1);
});

test("players edit the summary (with a stale-edit guard) and their own recollections; the DM can hide them", async () => {
  const { send } = fakeTable(seed());
  const handler = load(send);
  const { session } = JSON.parse((await handler(req("POST", "/chronicle/sessions", { password: "dm", body: { startAt: at(0), endAt: at(60) } }))).body);
  const base = `/chronicle/sessions/${session.id}`;

  const first = await handler(req("PUT", `${base}/summary`, { password: "aesop", body: { asSlug: "aesop", text: "We fought goblins.", baseUpdatedAt: null } }));
  assert.equal(first.statusCode, 200);
  const summary = JSON.parse(first.body).summary;
  assert.equal(summary.updatedBy.name, "Aesop");
  const stale = await handler(req("PUT", `${base}/summary`, { password: "dm", body: { text: "Something else", baseUpdatedAt: null } }));
  assert.equal(stale.statusCode, 409);
  assert.equal((await handler(req("PUT", `${base}/summary`, { password: "dm", body: { text: "Edited", baseUpdatedAt: summary.updatedAt } }))).statusCode, 200);

  const added = await handler(req("POST", `${base}/recollections`, { password: "aesop", body: { asSlug: "aesop", text: "The dice are cursed." } }));
  const rec = JSON.parse(added.body).recollection;
  assert.equal(rec.authorSlug, "aesop");
  assert.equal((await handler(req("PUT", `${base}/recollections/${rec.id}`, { password: "dm", body: { text: "DM rewrite" } }))).statusCode, 403);
  assert.equal((await handler(req("PUT", `${base}/recollections/${rec.id}`, { password: "dm", body: { hidden: true } }))).statusCode, 200);
  const pub = JSON.parse((await handler(req("GET", base))).body).session;
  assert.equal(pub.recollections.length, 0);
  const own = JSON.parse((await handler(req("GET", base, { password: "aesop", query: { asSlug: "aesop" } }))).body).session;
  assert.equal(own.recollections.length, 1);
  const index = JSON.parse((await handler(req("GET", "/chronicle"))).body);
  assert.equal(index.sessions[0].summaryExcerpt, "Edited");
  assert.equal(index.sessions[0].recollectionCount, 0);
});

test("the DM can rename, move and delete a session", async () => {
  const { send, items } = fakeTable(seed());
  const handler = load(send);
  const { session } = JSON.parse((await handler(req("POST", "/chronicle/sessions", { password: "dm", body: { startAt: at(0), endAt: at(60) } }))).body);
  const moved = JSON.parse((await handler(req("PUT", `/chronicle/sessions/${session.id}`, { password: "dm", body: { title: "The Ambush", newChapterName: "Chapter Two" } }))).body);
  assert.equal(moved.session.title, "The Ambush");
  assert.equal(moved.chapters.length, 2);
  assert.equal((await handler(req("DELETE", `/chronicle/sessions/${session.id}`, { password: "dm" }))).statusCode, 200);
  assert.equal(items.has(`chronicle-session:${session.id}`), false);
  assert.equal(JSON.parse((await handler(req("GET", "/chronicle"))).body).sessions.length, 0);
});
