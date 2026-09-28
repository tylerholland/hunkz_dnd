const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeFx, buildLastFx } = require("./combatFx");

test("sanitizeFx whitelists style and bounds the attacker", () => {
  assert.equal(sanitizeFx(null), null);
  assert.equal(sanitizeFx({ style: "laser" }), null);
  assert.deepEqual(
    sanitizeFx({ style: "fire", attacker: { type: "npc", sourceId: " carrion " }, crit: true, rollId: "roll-1", junk: 1 }),
    { attacker: { type: "npc", sourceId: "carrion" }, style: "fire", crit: true, miss: false, rollId: "roll-1" }
  );
  assert.equal(sanitizeFx({ style: "cut", attacker: { type: "dragon", sourceId: "x" } }).attacker, null);
});

test("buildLastFx only keeps crit on damage", () => {
  const fx = sanitizeFx({ style: "cut", attacker: { type: "character", sourceId: "eoghan" }, crit: true });
  assert.equal(buildLastFx(fx, "damage", "t").crit, true);
  assert.equal(buildLastFx(fx, "miss", "t").crit, false);
  assert.deepEqual(buildLastFx(fx, "heal", "t"), { at: "t", kind: "heal", attacker: { type: "character", sourceId: "eoghan" }, style: "cut", crit: false });
});
