const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPartyCard } = require("./partyCard");

const aesop = {
  race: "Tortle", charClass: "Paladin", subclass: "Oath of the Ancients", level: 1,
  armorTotal: 12,
  stats: [{ stat: "Strength", score: 13 }, { stat: "Dexterity", score: 8 }, { stat: "Wisdom", score: 12 }],
  equipment: [
    { name: "Shield", equipped: true, mods: [{ attribute: "Armor", value: "2" }] },
    { name: "Ring of Wisdom", equipped: true, mods: [{ attribute: "Wisdom", value: "+1" }] },
    { name: "Spare cloak", equipped: false, mods: [{ attribute: "Armor", value: "1" }] },
  ],
  weapons: [{ name: "Battle Axe", equipped: true, mods: [{ attribute: "Attack Bonus", value: "+3" }] }],
  skills: ["heal", "survival"],
  specialAbilities: ["cure", { name: "hardy" }],
  spells: [{ id: "s1", name: "Cure Wounds", role: "heal", level: 1, description: "Touch heals 1d8.", toHit: "+5" }],
  spellSlots: [{ level: 1, max: 2, used: 1 }, { level: 2, max: 0, used: 0 }],
  coin: { gp: 40 },
  playerNotes: [{ text: "secret" }],
};

test("teammates get finished numbers, including equipped gear bonuses", () => {
  const card = buildPartyCard(aesop);
  assert.equal(card.armorClass, 14); // 12 + shield; the unequipped cloak doesn't count
  assert.deepEqual(card.abilityMods, { Strength: 1, Dexterity: -1, Constitution: 0, Intelligence: 0, Wisdom: 2, Charisma: 0 });
  assert.deepEqual([card.race, card.charClass, card.subclass, card.level], ["Tortle", "Paladin", "Oath of the Ancients", 1]);
  assert.deepEqual(card.skills, ["heal", "survival"]);
  assert.deepEqual(card.specialAbilities, ["cure", "hardy"]);
  assert.equal(card.spells, undefined);
  assert.deepEqual(card.spellSlots, [{ level: 1, max: 2, used: 1 }]);
});

test("nothing from the inventory, coin or notes leaks into the card", () => {
  const json = JSON.stringify(buildPartyCard(aesop));
  for (const secret of ["Shield", "Ring of Wisdom", "Battle Axe", "cloak", "gp", "secret", "toHit", "Cure Wounds"]) {
    assert.equal(json.includes(secret), false, secret);
  }
});
