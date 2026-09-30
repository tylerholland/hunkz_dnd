import { abilityModifier } from "../dmDashboard/cardStats";

// Armor Class from what the character is wearing (5e):
//   • Body armor (an equipped item of type "armor" with a base AC) sets the
//     base: its AC plus Dex — all of it (light), up to +2 (medium) or none
//     (heavy). With more than one equipped, the best counts.
//   • Without armor, the sheet's "AC without armor" (natural armor, Unarmored
//     Defense…) is the base, or 10 + Dex when that's blank.
//   • A shield (equipped item of type "shield") adds its bonus; only one counts.
//   • "Armor" modifiers on equipped items (Ring of Protection +1…) add on top.
// The backend mirrors this in backend/src/lib/armorClass.js for party cards.

export const ARMOR_DEX_OPTIONS = [
  { value: "full", label: "+ Dex (light)" },
  { value: "max2", label: "+ Dex, max 2 (medium)" },
  { value: "none", label: "No Dex (heavy)" },
];

function toInt(value) {
  const parsed = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const itemType = (item) => String(item?.type || "").toLowerCase();

function equipped(char) {
  return [...(char?.weapons || []), ...(char?.equipment || [])].filter((item) => item && item.equipped !== false);
}

export function armorDexBonus(dexMod, rule) {
  if (rule === "none") return 0;
  if (rule === "max2") return Math.min(dexMod, 2);
  return dexMod;
}

/**
 * @returns {{ total: number, parts: { label: string, value: number, base?: boolean }[] }}
 * `parts` add up to `total`; the first is the base.
 */
export function computeArmorClass(char) {
  const dexMod = abilityModifier(char, "Dexterity");
  const items = equipped(char);
  const parts = [];

  const armors = items
    .filter((item) => itemType(item) === "armor" && toInt(item.acBase) > 0)
    .map((item) => {
      const dex = armorDexBonus(dexMod, item.acDex);
      return { item, base: toInt(item.acBase), dex, total: toInt(item.acBase) + dex };
    })
    .sort((a, b) => b.total - a.total);

  if (armors.length) {
    const best = armors[0];
    parts.push({ label: best.item.name || "Armor", value: best.base, base: true });
    if (best.dex !== 0) parts.push({ label: "Dexterity", value: best.dex });
  } else if (toInt(char?.armorTotal) > 0) {
    parts.push({ label: "Without armor", value: toInt(char.armorTotal), base: true });
  } else {
    parts.push({ label: "Unarmored", value: 10, base: true });
    if (dexMod !== 0) parts.push({ label: "Dexterity", value: dexMod });
  }

  const shield = items
    .filter((item) => itemType(item) === "shield" && toInt(item.acBonus) !== 0)
    .sort((a, b) => toInt(b.acBonus) - toInt(a.acBonus))[0];
  if (shield) parts.push({ label: shield.name || "Shield", value: toInt(shield.acBonus) });

  for (const item of items) {
    const bonus = (item.mods || []).filter((mod) => mod?.attribute === "Armor").reduce((sum, mod) => sum + toInt(mod.value), 0);
    if (bonus !== 0) parts.push({ label: item.name || "Item", value: bonus });
  }

  return { total: parts.reduce((sum, part) => sum + part.value, 0), parts };
}

export const armorClassOf = (char) => computeArmorClass(char).total;
