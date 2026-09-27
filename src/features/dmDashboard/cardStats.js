import { normalizeSpells } from "../characterSheet/constants";
import { itemIconType } from "../characterSheet/sessionLoadout";

// Derived stats for the DM party card (Stories 50/51/64). Mirrors Session
// mode's computeMod: base score modifier plus mods from equipped items.

export const ABILITY_ORDER = [
  { stat: "Strength", abbr: "Str" },
  { stat: "Dexterity", abbr: "Dex" },
  { stat: "Constitution", abbr: "Con" },
  { stat: "Intelligence", abbr: "Int" },
  { stat: "Wisdom", abbr: "Wis" },
  { stat: "Charisma", abbr: "Cha" },
];

const SPEED_ZERO_CONDITIONS = ["Restrained", "Paralyzed", "Petrified", "Grappled"];

function toInt(value) {
  const parsed = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function equippedItems(char) {
  return [...(char?.weapons || []), ...(char?.equipment || [])].filter((item) => item && item.equipped !== false);
}

export function itemBonus(char, attribute) {
  return equippedItems(char).reduce((sum, item) => (
    sum + (item.mods || []).filter((mod) => mod.attribute === attribute).reduce((s, mod) => s + toInt(mod.value), 0)
  ), 0);
}

export function abilityModifier(char, stat) {
  const entry = (char?.stats || []).find((s) => s.stat === stat);
  const score = entry && Number.isFinite(Number(entry.score)) ? Number(entry.score) : 10;
  return Math.floor((score - 10) / 2) + itemBonus(char, stat);
}

export function getAbilityMods(char) {
  return ABILITY_ORDER.map(({ stat, abbr }) => ({ stat, abbr, mod: abilityModifier(char, stat) }));
}

export function getPassivePerception(char) {
  return 10 + abilityModifier(char, "Wisdom");
}

export function getSpeed(char) {
  const bonus = itemBonus(char, "Speed");
  const conditions = Array.isArray(char?.conditions) ? char.conditions : [];
  const zeroed = SPEED_ZERO_CONDITIONS.some((c) => conditions.includes(c));
  const speed = zeroed ? 0 : (char?.speed ?? 30) + bonus;
  return { speed, zeroed, notable: speed !== 30 || bonus !== 0 };
}

export function formatMod(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function getWeaponSummary(weapon) {
  const mods = weapon?.mods || [];
  const atk = mods.find((m) => m.attribute === "Attack Bonus");
  const dmg = mods.find((m) => m.attribute === "Damage");
  const attack = atk && String(atk.value).trim() !== "" ? toInt(atk.value) : null;
  const damage = dmg && String(dmg.value).trim() !== "" ? String(dmg.value).trim() : null;
  return { attack, damage };
}

// Skills are this table's own list (from Noam's system — see
// talentCatalog.js), not 5e skills, and how a skill modifies a 2d6 check
// isn't settled yet — so the card shows names only, with no bonus or roll.
export function getSkillNames(char) {
  return (char?.skills || [])
    .filter((skill) => typeof skill === "string" && skill.trim())
    .map((skill) => titleCase(skill.trim()));
}

export function titleCase(text) {
  return String(text || "").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// ── DM drawer grouping ───────────────────────────────────────────────────────
// Ordered by the questions a DM asks mid-scene: what can they hit with
// (attacks), what's protecting/empowering them (gear), what else can they
// cast (spells), what's in the bag (pack — including counted consumables).
// "Equipped" alone doesn't promote plain items — a rope stays in the pack.
const GEAR_TYPES = new Set(["armor", "shield", "wondrous"]);

function isEquipped(item) {
  return item?.equipped !== false;
}

function modsText(item) {
  return (item?.mods || [])
    .filter((mod) => mod && mod.attribute && String(mod.value ?? "").trim() !== "")
    .filter((mod) => mod.attribute !== "Attack Bonus" && mod.attribute !== "Damage")
    .map((mod) => `${mod.attribute} ${mod.value}`)
    .join(" · ");
}

function parseToHit(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = parseInt(String(value).trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function groupDrawerContent(char) {
  const weapons = (char?.weapons || []).filter(Boolean);
  const equipment = (char?.equipment || []).filter(Boolean);
  const spells = normalizeSpells(char?.spells);

  const attacks = [];
  const gear = [];
  const pack = [];

  for (const weapon of weapons) {
    const entry = { id: weapon.id, kind: "weapon", icon: "weapon", name: weapon.name || "Unnamed", qty: weapon.qty, description: weapon.description || "", ...getWeaponSummary(weapon) };
    if (isEquipped(weapon)) attacks.push(entry);
    else pack.push({ ...entry, stowed: true });
  }
  for (const spell of spells.filter((s) => s.role === "attack")) {
    attacks.push({
      id: spell.id,
      kind: "spell",
      name: spell.name,
      description: spell.description || "",
      level: spell.level,
      attack: parseToHit(spell.toHit),
      damage: spell.damage && String(spell.damage).trim() ? String(spell.damage).trim() : null,
    });
  }

  for (const item of equipment) {
    const entry = { id: item.id, icon: itemIconType("equipment", item), name: item.name || "Unnamed", qty: item.qty, type: item.type || "", description: item.description || "", mods: modsText(item), attuned: !!item.attuned, requiresAttunement: !!item.requiresAttunement };
    const type = String(item.type || "").toLowerCase();
    if (isEquipped(item) && (GEAR_TYPES.has(type) || entry.mods || item.requiresAttunement)) gear.push(entry);
    else pack.push({ ...entry, stowed: !isEquipped(item) });
  }

  const otherSpells = spells.filter((s) => s.role !== "attack");
  return { attacks, gear, spells: otherSpells, pack };
}
