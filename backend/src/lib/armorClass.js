// Armor Class for party cards — mirrors src/features/characterSheet/armorClass.js:
// the best equipped body armor's base AC + Dex (all / max 2 / none), or the
// sheet's "AC without armor" (armorTotal), or 10 + Dex; plus one shield's
// bonus; plus "Armor" modifiers on equipped items.

function toInt(value) {
  const parsed = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const itemType = (item) => String(item?.type || "").toLowerCase();

function equippedItems(item) {
  return [...(item?.weapons || []), ...(item?.equipment || [])].filter((gear) => gear && gear.equipped !== false);
}

function armorDexBonus(dexMod, rule) {
  if (rule === "none") return 0;
  if (rule === "max2") return Math.min(dexMod, 2);
  return dexMod;
}

function computeArmorClass(item, dexMod) {
  const gear = equippedItems(item);
  const armor = gear
    .filter((g) => itemType(g) === "armor" && toInt(g.acBase) > 0)
    .map((g) => toInt(g.acBase) + armorDexBonus(dexMod, g.acDex))
    .sort((a, b) => b - a)[0];
  const base = armor ?? (toInt(item?.armorTotal) > 0 ? toInt(item.armorTotal) : 10 + dexMod);
  const shield = gear
    .filter((g) => itemType(g) === "shield")
    .reduce((best, g) => Math.max(best, toInt(g.acBonus)), 0);
  const mods = gear.reduce((sum, g) => (
    sum + (g.mods || []).filter((m) => m && m.attribute === "Armor").reduce((s, m) => s + toInt(m.value), 0)
  ), 0);
  return base + shield + mods;
}

module.exports = { computeArmorClass, armorDexBonus };
