// What using an item does (Session view's Use Item). An item can say so
// itself — `onUse: { heals: "2d4+2" }`, set in the item editor. Without that,
// the shop's Potion of Healing is 2d4+2, the stronger D&D potions are
// recognised by name, and a description saying "heals XdY+Z" works too.
const BY_ITEM_ID = { "potion-healing": "2d4+2" };
const BY_NAME = [
  [/supreme healing/i, "10d4+20"],
  [/superior healing/i, "8d4+8"],
  [/greater healing/i, "4d4+4"],
  [/potion of healing/i, "2d4+2"],
];
const DICE = /(\d+)d(\d+)(?:\s*\+\s*(\d+))?/i;

/** "2d4+2" or a flat "5" tidied, or null if it isn't either. */
export function cleanHealDice(text) {
  const raw = String(text ?? "").trim();
  if (/^\d{1,3}$/.test(raw)) return Number(raw) > 0 ? String(Number(raw)) : null;
  const match = /^(\d{1,2})\s*d\s*(\d{1,3})\s*(?:\+\s*(\d{1,3}))?$/i.exec(raw);
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 2) return null;
  return `${Number(match[1])}d${Number(match[2])}${match[3] && Number(match[3]) ? `+${Number(match[3])}` : ""}`;
}

/** The healing dice for an item ("2d4+2"), or null if using it doesn't heal. */
export function healingDice(item) {
  if (!item) return null;
  if (item.onUse && "heals" in item.onUse) return cleanHealDice(item.onUse.heals);
  const id = item.itemId || item.bought?.itemId;
  if (id && BY_ITEM_ID[id]) return BY_ITEM_ID[id];
  const named = BY_NAME.find(([pattern]) => pattern.test(item.name || ""));
  if (named) return named[1];
  const described = /heal(?:s|ing)?\s+(\d+d\d+(?:\s*\+\s*\d+)?)/i.exec(item.description || "");
  return described ? described[1].replace(/\s+/g, "") : null;
}

/** Roll healing dice: → { total, rolls, bonus }. */
export function rollHealing(dice, rollDie = (sides) => 1 + Math.floor(Math.random() * sides)) {
  if (/^\d+$/.test(String(dice))) return { total: Number(dice), rolls: [], bonus: Number(dice) };
  const [, count, sides, bonus = "0"] = DICE.exec(dice) || [null, "0", "0", "0"];
  const rolls = Array.from({ length: Number(count) }, () => rollDie(Number(sides)));
  return { total: rolls.reduce((a, b) => a + b, 0) + Number(bonus), rolls, bonus: Number(bonus) };
}
