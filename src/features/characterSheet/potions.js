// Healing potions a player can drink from their inventory (Session view). The
// shop's Potion of Healing is 2d4+2; the stronger D&D potions are recognised
// by name, and any item whose description says "heals XdY+Z" works too.
const BY_ITEM_ID = { "potion-healing": "2d4+2" };
const BY_NAME = [
  [/supreme healing/i, "10d4+20"],
  [/superior healing/i, "8d4+8"],
  [/greater healing/i, "4d4+4"],
  [/potion of healing/i, "2d4+2"],
];
const DICE = /(\d+)d(\d+)(?:\s*\+\s*(\d+))?/i;

/** The healing dice for an item ("2d4+2"), or null if it isn't a healing potion. */
export function healingDice(item) {
  if (!item) return null;
  const id = item.itemId || item.bought?.itemId;
  if (id && BY_ITEM_ID[id]) return BY_ITEM_ID[id];
  const named = BY_NAME.find(([pattern]) => pattern.test(item.name || ""));
  if (named) return named[1];
  const described = /heal(?:s|ing)?\s+(\d+d\d+(?:\s*\+\s*\d+)?)/i.exec(item.description || "");
  return described ? described[1].replace(/\s+/g, "") : null;
}

/** Roll healing dice: → { total, rolls, bonus }. */
export function rollHealing(dice, rollDie = (sides) => 1 + Math.floor(Math.random() * sides)) {
  const [, count, sides, bonus = "0"] = DICE.exec(dice) || [null, "0", "0", "0"];
  const rolls = Array.from({ length: Number(count) }, () => rollDie(Number(sides)));
  return { total: rolls.reduce((a, b) => a + b, 0) + Number(bonus), rolls, bonus: Number(bonus) };
}
