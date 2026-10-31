const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeDefense, normalizeAttacks } = require("./npcStats");

test("a creature's defense is an AC or a named defense roll", () => {
  assert.deepEqual(normalizeDefense({ kind: "ac", ac: "13" }), { kind: "ac", ac: 13 });
  assert.deepEqual(normalizeDefense({ kind: "roll", roll: "1d20 + 3", name: " Dodge " }), { kind: "roll", roll: "1d20+3", name: "Dodge" });
  assert.deepEqual(normalizeDefense({ kind: "roll", roll: "1d20+3" }), { kind: "roll", roll: "1d20+3", name: "Defense" });
  assert.equal(normalizeDefense({ kind: "roll", roll: "lots" }), null);
  assert.equal(normalizeDefense({ kind: "ac", ac: 99 }), null);
  assert.equal(normalizeDefense(null), null);
});

test("attacks keep a name, whole attack roll, damage and a known look", () => {
  const out = normalizeAttacks([
    { id: "t", name: "Tentacles", hit: "1d20+8", damage: "1d4+2", look: "lash" },
    { name: "Bite", hit: "1d20 + 4", damage: "2d4+2", look: "teeth" },
    { name: "Broken", hit: "a lot", damage: "1d6" },
    { name: "", hit: "1d20", damage: "1d4" },
  ]);
  assert.deepEqual(out, [
    { id: "t", name: "Tentacles", hit: "1d20+8", damage: "1d4+2", look: "lash" },
    { id: "atk-2", name: "Bite", hit: "1d20+4", damage: "2d4+2", look: "cut" },
  ]);
  assert.deepEqual(normalizeAttacks("nope"), []);
});

test("abilities are one list: plain notes or rollable, reading the old shapes too", () => {
  const { normalizeAbilities } = require("./npcStats");
  const out = normalizeAbilities(
    ["Keen Smell: advantage on smell checks", "Spider Climb", { id: "t", name: "Tentacles", notes: "Poisoned, DC 13", roll: { hit: "1d20+8", damage: "1d4+2", look: "lash" } }, { name: "Broken", roll: { hit: "x", damage: "1d4" } }],
    [{ id: "b", name: "Bite", hit: "1d20+4", damage: "2d4+2", look: "bite" }, { name: "Tentacles", hit: "1d20+8", damage: "1d4+2" }],
  );
  assert.deepEqual(out, [
    { id: "ab-1", name: "Keen Smell", notes: "advantage on smell checks" },
    { id: "ab-2", name: "Spider Climb" },
    { id: "t", name: "Tentacles", notes: "Poisoned, DC 13", roll: { hit: "1d20+8", damage: "1d4+2", look: "lash" } },
    { id: "ab-4", name: "Broken" },
    { id: "b", name: "Bite", roll: { hit: "1d20+4", damage: "2d4+2", look: "bite" } },
  ]);
  assert.deepEqual(normalizeAbilities(undefined, undefined), []);
});
