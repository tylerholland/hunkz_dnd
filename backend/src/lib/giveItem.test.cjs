const test = require("node:test");
const assert = require("node:assert/strict");
const { takeFrom, giveTo, giveLogEvent } = require("./giveItem");

const eoghan = { slug: "eoghan", name: "Eòghan", weapons: [{ id: "w1", name: "Shortsword", equipped: true }], equipment: [{ id: "p1", name: "Potion of Healing", itemId: "potion-healing", qty: 3, attuned: true }] };
const liu = { slug: "liu", name: "Liu Sha", weapons: [], equipment: [{ id: "p9", name: "Potion of Healing", itemId: "potion-healing", qty: 1 }] };

test("part of a stack moves and joins the receiver's stack", () => {
  const taken = takeFrom(eoghan, "p1", 1);
  assert.equal(taken.giver.equipment[0].qty, 2);
  assert.deepEqual([taken.moved.qty, taken.moved.attuned, taken.kind], [1, false, "equipment"]);
  const next = giveTo(liu, taken.moved, taken.kind);
  assert.deepEqual(next.equipment.map((e) => [e.id, e.qty]), [["p9", 2]]);
});

test("a whole item (or a whole stack) leaves the giver; a new entry for the receiver", () => {
  const sword = takeFrom(eoghan, "w1");
  assert.equal(sword.giver.weapons.length, 0);
  const next = giveTo(liu, sword.moved, sword.kind);
  assert.equal(next.weapons[0].name, "Shortsword");
  assert.notEqual(next.weapons[0].id, "w1");
  assert.equal(takeFrom(eoghan, "p1", 3).giver.equipment.length, 0);
});

test("you can't give what you don't have", () => {
  assert.equal(takeFrom(eoghan, "nope").error, "That item isn't in your inventory");
  assert.equal(takeFrom(eoghan, "p1", 4).error, "You have 3");
  assert.deepEqual(giveLogEvent(eoghan, liu, { name: "Potion of Healing", qty: 2 }).to, { slug: "liu", name: "Liu Sha" });
});
