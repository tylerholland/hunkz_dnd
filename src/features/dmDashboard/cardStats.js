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

// Character skills are stored as the names of proficient skills.
const SKILL_ABILITY = {
  acrobatics: "Dexterity", "animal handling": "Wisdom", arcana: "Intelligence",
  athletics: "Strength", deception: "Charisma", history: "Intelligence",
  insight: "Wisdom", intimidation: "Charisma", investigation: "Intelligence",
  medicine: "Wisdom", nature: "Intelligence", perception: "Wisdom",
  performance: "Charisma", persuasion: "Charisma", religion: "Intelligence",
  "sleight of hand": "Dexterity", stealth: "Dexterity", survival: "Wisdom",
};

export function proficiencyBonus(level) {
  return 2 + Math.floor((Math.max(1, toInt(level) || 1) - 1) / 4);
}

// Returns [{ name, bonus }] — bonus is null for non-standard skills.
export function getSkillBonuses(char) {
  const prof = proficiencyBonus(char?.level);
  return (char?.skills || [])
    .filter((skill) => typeof skill === "string" && skill.trim())
    .map((skill) => {
      const ability = SKILL_ABILITY[skill.trim().toLowerCase()];
      return { name: titleCase(skill.trim()), bonus: ability ? abilityModifier(char, ability) + prof : null };
    });
}

export function titleCase(text) {
  return String(text || "").replace(/\b\w/g, (ch) => ch.toUpperCase());
}
