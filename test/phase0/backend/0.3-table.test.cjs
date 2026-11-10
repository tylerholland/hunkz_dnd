// Phase 0, step 0.3 — the game table and the connections index in template.yaml.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./helpers/need.cjs");

const yaml = () => fs.readFileSync(path.join(ROOT, "backend/template.yaml"), "utf8");
// The text of one resource block (from "  Name:" to the next resource).
function resource(name) {
  const text = yaml();
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start < 0) return null;
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}\w+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test("GameTable: PK/SK, GSI1, on-demand, point-in-time recovery", () => {
  const t = resource("GameTable");
  assert.ok(t, "no GameTable resource");
  assert.match(t, /TableName:\s*dnd-game/);
  assert.match(t, /BillingMode:\s*PAY_PER_REQUEST/);
  for (const attr of ["PK", "SK", "GSI1PK", "GSI1SK"]) assert.match(t, new RegExp(`AttributeName:\\s*${attr}\\b`));
  assert.match(t, /IndexName:\s*GSI1/);
  assert.match(t, /PointInTimeRecoveryEnabled:\s*true/);
});

test("functions are told the game table and which store to use", () => {
  const y = yaml();
  assert.match(y, /GAME_TABLE:\s*!Ref GameTable/);
  assert.match(y, /STORE_BACKEND:/);
});

test("the connections table can be read by campaign", () => {
  const t = resource("WsConnectionsTable");
  assert.match(t, /IndexName:\s*campaign/);
  assert.match(t, /AttributeName:\s*campaignId/);
});
