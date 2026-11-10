// Phase 0, step 0.3 — the game table's keys, in one place: backend/src/lib/keys.js
//   DEFAULT_CAMPAIGN_ID, DEFAULT_LIBRARY_ID ("hunkz")
//   isValidId(id)                     — lowercase letters, digits, hyphens; 1–40
//   campaignPk(id)  "CAMP#<id>"       stateSk(name) "STATE#<name>"
//   logSk(createdAt, id) "LOG#<createdAt>#<id>"   parseLogSk(sk) → { createdAt, id }
//   chronicleSk(id) "CHRON#<id>"      characterPk(id) "CHAR#<id>"
//   libraryPk(id)   "LIB#<id>"        META "META"        APP_PK "APP"
//   slugPk(slug)    "SLUG#<slug>"     (reserves a character slug)
const test = require("node:test");
const assert = require("node:assert/strict");
const { need } = require("./helpers/need.cjs");

const keys = () => need("backend/src/lib/keys.js", "0.3");

test("keys have one spelling", () => {
  const k = keys();
  assert.equal(k.DEFAULT_CAMPAIGN_ID, "hunkz");
  assert.equal(k.DEFAULT_LIBRARY_ID, "hunkz");
  assert.equal(k.campaignPk("hunkz"), "CAMP#hunkz");
  assert.equal(k.stateSk("initiative"), "STATE#initiative");
  assert.equal(k.chronicleSk("s1"), "CHRON#s1");
  assert.equal(k.characterPk("eoghan"), "CHAR#eoghan");
  assert.equal(k.libraryPk("hunkz"), "LIB#hunkz");
  assert.equal(k.slugPk("eoghan"), "SLUG#eoghan");
  assert.equal(k.META, "META");
  assert.equal(k.APP_PK, "APP");
});

test("log keys sort by time, then id, and read back", () => {
  const k = keys();
  const a = k.logSk("2026-11-10T19:00:00.000Z", "roll-b");
  const b = k.logSk("2026-11-10T19:00:00.000Z", "roll-c");
  const c = k.logSk("2026-11-10T19:00:01.000Z", "hp-a");
  assert.deepEqual([c, a, b].sort(), [a, b, c]);
  assert.deepEqual(k.parseLogSk(a), { createdAt: "2026-11-10T19:00:00.000Z", id: "roll-b" });
});

test("log keys refuse times that wouldn't sort", () => {
  const k = keys();
  assert.throws(() => k.logSk("10/11/2026", "x"), TypeError);
  assert.throws(() => k.logSk("2026-11-10T19:00:00Z", "x"), TypeError, "ISO with milliseconds only, so string order is time order");
});

test("ids are plain and short", () => {
  const k = keys();
  for (const ok of ["hunkz", "the-drowned-lantern", "a1", "x".repeat(40)]) assert.equal(k.isValidId(ok), true, ok);
  for (const bad of ["", "Hunkz", "a b", "a#b", "a/b", "x".repeat(41), null, 7]) assert.equal(k.isValidId(bad), false, String(bad));
});
