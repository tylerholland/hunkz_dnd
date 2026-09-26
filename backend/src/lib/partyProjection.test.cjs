const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DM_PARTY_FIELDS,
  DM_PARTY_PROJECTION_EXPRESSION,
  projectDmPartyItem,
  projectPlayerCharacter,
} = require("./partyProjection");

const item = {
  slug: "eoghan",
  name: "Eoghan",
  stats: [{ stat: "Wisdom", score: 16 }],
  speed: 35,
  weapons: [{ id: "w1", name: "Longsword" }],
  equipment: [{ id: "e1", name: "Rope" }],
  password: "secret",
};

test("DM projection carries stats, speed, and loadout for the card", () => {
  const projected = projectDmPartyItem(item);
  assert.deepEqual(projected.stats, item.stats);
  assert.equal(projected.speed, 35);
  assert.deepEqual(projected.weapons, item.weapons);
  assert.deepEqual(projected.equipment, item.equipment);
  assert.equal(projected.password, undefined);
});

test("DM projection expression lists every whitelisted field", () => {
  const aliases = { name: "#n", hp: "#hp", conditions: "#c", level: "#l", dmNotes: "#dmNotes" };
  const listed = DM_PARTY_PROJECTION_EXPRESSION.split(",").map((part) => part.trim());
  for (const field of DM_PARTY_FIELDS) {
    assert.ok(listed.includes(aliases[field] || field), `missing ${field}`);
  }
});

test("player projection still omits loadout and stats", () => {
  const projected = projectPlayerCharacter(item);
  assert.equal(projected.stats, undefined);
  assert.equal(projected.weapons, undefined);
  assert.equal(projected.equipment, undefined);
});
