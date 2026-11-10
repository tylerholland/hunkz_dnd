// Phase 0, step 0.5 — campaign-scoped (and library-scoped) API routes.
// During the switch every old route keeps working and gets a twin that names
// the campaign, wired to the same function:
//   /initiative            → /c/{campaignId}/initiative
//   /npc-library           → /libraries/{libraryId}/npc-library
// Character routes (/characters/{slug}/…) stay as they are; the character
// record says which campaign it's in.
// backend/src/lib/campaign.js:
//   campaignIdFrom(event) → the path's campaignId; DEFAULT ("hunkz") when the
//     route has none (old routes); null when it's present but not a valid id
//   libraryIdFrom(event)  → same for libraryId
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { need, ROOT } = require("./helpers/need.cjs");

// A small reader for template.yaml: which function serves which path+method.
function routes() {
  const lines = fs.readFileSync(path.join(ROOT, "backend/template.yaml"), "utf8").split("\n");
  const out = [];
  let fn = null;
  let pending = null;
  for (const line of lines) {
    const res = /^ {2}(\w+):\s*$/.exec(line);
    if (res) fn = res[1];
    const p = /^\s+Path:\s*(\S+)/.exec(line);
    if (p) pending = p[1];
    const m = /^\s+Method:\s*(\S+)/.exec(line);
    if (m && pending) { out.push({ fn, path: pending, method: m[1].toUpperCase() }); pending = null; }
  }
  return out;
}

const LIBRARY_PATHS = ["/npc-library", "/npc-library/portraits/presign", "/talent-codex"];
const isCharacterRoute = (p) => p.startsWith("/characters");
const isScoped = (p) => p.startsWith("/c/{campaignId}") || p.startsWith("/libraries/{libraryId}");

test("every campaign route has a /c/{campaignId} twin on the same function", () => {
  const all = routes();
  const missing = [];
  for (const r of all) {
    if (isScoped(r.path) || isCharacterRoute(r.path) || LIBRARY_PATHS.includes(r.path)) continue;
    const twin = all.find((t) => t.path === `/c/{campaignId}${r.path}` && t.method === r.method);
    if (!twin || twin.fn !== r.fn) missing.push(`${r.method} ${r.path} (${r.fn})`);
  }
  assert.deepEqual(missing, [], `no campaign twin for:\n  ${missing.join("\n  ")}`);
});

test("library routes have a /libraries/{libraryId} twin", () => {
  const all = routes();
  const missing = all.filter((r) => LIBRARY_PATHS.includes(r.path))
    .filter((r) => !all.some((t) => t.path === `/libraries/{libraryId}${r.path}` && t.method === r.method && t.fn === r.fn))
    .map((r) => `${r.method} ${r.path}`);
  assert.deepEqual(missing, []);
});

test("character routes are not duplicated under a campaign", () => {
  assert.equal(routes().filter((r) => r.path.startsWith("/c/{campaignId}/characters")).length, 0);
});

test("handlers find their campaign (or library) in the path", () => {
  const { campaignIdFrom, libraryIdFrom } = need("backend/src/lib/campaign.js", "0.5");
  assert.equal(campaignIdFrom({ pathParameters: { campaignId: "drowned-lantern" } }), "drowned-lantern");
  assert.equal(campaignIdFrom({ pathParameters: {} }), "hunkz");
  assert.equal(campaignIdFrom({}), "hunkz");
  assert.equal(campaignIdFrom({ pathParameters: { campaignId: "Not OK" } }), null);
  assert.equal(libraryIdFrom({ pathParameters: { libraryId: "hunkz" } }), "hunkz");
  assert.equal(libraryIdFrom({ pathParameters: { libraryId: "x/y" } }), null);
});
