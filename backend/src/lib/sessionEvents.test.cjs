const test = require("node:test");
const assert = require("node:assert/strict");
const { subjectRef, buildHpEvent, buildConditionEvent } = require("./sessionEvents");
const { sanitizeFx } = require("./combatFx");

const goblin = subjectRef("npc", "gob", "Goblin Scout");

test("hp events record the change and tag the attack when there is one", () => {
  const plain = buildHpEvent({ subject: goblin, from: 12, to: 9, max: 12, at: "t" });
  assert.equal(plain.type, "hp");
  assert.equal(plain.delta, -3);
  assert.equal(plain.by, undefined);
  assert.equal(plain.action, undefined);

  const fx = sanitizeFx({ style: "flurry", name: "Unarmed Strike", crit: true, attacker: { type: "character", sourceId: "aesop", name: "Aesop" }, rollId: "roll-9" });
  const tagged = buildHpEvent({ subject: goblin, from: 9, to: 1, max: 12, fx, at: "t" });
  assert.deepEqual(tagged.by, { type: "character", sourceId: "aesop", name: "Aesop" });
  assert.deepEqual(tagged.action, { style: "flurry", crit: true, name: "Unarmed Strike" });
  assert.equal(tagged.rollId, "roll-9");

  const miss = buildHpEvent({ subject: goblin, from: 9, to: 9, fx: sanitizeFx({ style: "cut", miss: true }), at: "t" });
  assert.equal(miss.miss, true);
  assert.equal(miss.delta, 0);
  assert.equal(miss.action.crit, false);
});

test("condition events list what was added and removed, or nothing", () => {
  const ev = buildConditionEvent({ subject: goblin, before: ["Prone"], after: ["Poisoned"], at: "t" });
  assert.deepEqual([ev.added, ev.removed], [["Poisoned"], ["Prone"]]);
  assert.equal(buildConditionEvent({ subject: goblin, before: ["Prone"], after: ["Prone"] }), null);
  const ex = buildConditionEvent({ subject: goblin, before: [], after: [], exhaustionBefore: 1, exhaustionAfter: 2 });
  assert.deepEqual(ex.exhaustion, { from: 1, to: 2 });
});
