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
