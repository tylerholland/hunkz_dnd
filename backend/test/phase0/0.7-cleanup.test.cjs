// Phase 0, step 0.7 — the old ways are gone. Run this last: it can only pass
// once the switch-over is finished and the old routes have been retired.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./helpers/need.cjs");

const handlersDir = path.join(ROOT, "backend/src/handlers");
const handlers = fs.readdirSync(handlersDir).filter((f) => f.endsWith(".js"));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const srcFiles = [
  ...handlers.map((f) => `backend/src/handlers/${f}`),
  ...fs.readdirSync(path.join(ROOT, "backend/src/lib")).filter((f) => f.endsWith(".js")).map((f) => `backend/src/lib/${f}`),
];

test("handlers reach data only through the store", () => {
  const direct = handlers.filter((f) => /require\(["']\.\.\/lib\/db["']\)|require\(["']@aws-sdk\/lib-dynamodb["']\)/.test(read(`backend/src/handlers/${f}`)));
  // The socket handlers keep their own small table.
  assert.deepEqual(direct.filter((f) => !/^ws(Connect|Disconnect)\.js$/.test(f)), []);
});

test("no Scans of the game data", () => {
  const scanners = srcFiles.filter((f) => /ScanCommand/.test(read(f)));
  assert.deepEqual(scanners, []);
});

test("the roll-history ring and the legacy store are gone", () => {
  const all = srcFiles.map(read).join("\n");
  assert.doesNotMatch(all, /roll-history-archive/);
  assert.doesNotMatch(all, /STORE_BACKEND\s*===?\s*["']legacy["']/);
});

test("only scoped routes remain (plus characters and the socket)", () => {
  const paths = [...read("backend/template.yaml").matchAll(/^\s+Path:\s*(\S+)/gm)].map((m) => m[1]);
  const unscoped = paths.filter((p) => !p.startsWith("/c/{campaignId}") && !p.startsWith("/libraries/{libraryId}") && !p.startsWith("/characters"));
  assert.deepEqual(unscoped, []);
});

test("the docs describe the new layout", () => {
  const model = read("design/architecture/data-model.md");
  assert.match(model, /CAMP#/);
  assert.match(model, /LOG#/);
  assert.match(read("design/architecture/decisions.md"), /Campaign-partitioned/i);
});
