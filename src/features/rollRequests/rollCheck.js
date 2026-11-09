// Roll requests, shared by the DM's form and the players' prompts: what a check
// is called, a character's bonus for it under the house rules, and the roll.
// Keep SKILLS in sync with backend/src/lib/rollRequests.js.
import { abilityModifier } from "../dmDashboard/cardStats";
import { applyCheckAdvantage, DEFAULT_HOUSE_RULES, parseCheckDice } from "../../lib/houseRules";

export const ABILITIES = [
  { key: "str", stat: "Strength", abbr: "STR" },
  { key: "dex", stat: "Dexterity", abbr: "DEX" },
  { key: "con", stat: "Constitution", abbr: "CON" },
  { key: "int", stat: "Intelligence", abbr: "INT" },
  { key: "wis", stat: "Wisdom", abbr: "WIS" },
  { key: "cha", stat: "Charisma", abbr: "CHA" },
];
const ABILITY = Object.fromEntries(ABILITIES.map((a) => [a.key, a]));

export const SKILLS = {
  athletics: "str", acrobatics: "dex", "sleight of hand": "dex", stealth: "dex",
  arcana: "int", history: "int", investigation: "int", nature: "int", religion: "int",
  "animal handling": "wis", insight: "wis", medicine: "wis", perception: "wis", survival: "wis",
  deception: "cha", intimidation: "cha", performance: "cha", persuasion: "cha",
};

// The checks DMs ask for most outside combat, roughly most-used first; the
// rest go in "Other skill…".
export const QUICK_SKILLS = ["perception", "investigation", "insight", "stealth", "persuasion", "athletics", "survival", "arcana"];
export const OTHER_SKILLS = Object.keys(SKILLS).filter((s) => !QUICK_SKILLS.includes(s)).sort();

const title = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
export const skillCheck = (skill) => ({ ability: SKILLS[skill], skill, save: false });
export const abilityCheck = (ability) => ({ ability, skill: null, save: false });
export const savingThrow = (ability) => ({ ability, skill: null, save: true });

/** "Wisdom (Perception)", "Dexterity save", "Strength check". */
export function checkName(check) {
  const ability = ABILITY[check?.ability]?.stat || "Ability";
  if (check?.save) return `${ability} save`;
  return check?.skill ? `${ability} (${title(check.skill)})` : `${ability} check`;
}

/** "Perception", "DEX save", "STR check" — the short form for chips and cards. */
export function checkShort(check) {
  const abbr = ABILITY[check?.ability]?.abbr || "";
  if (check?.save) return `${abbr} save`;
  return check?.skill ? title(check.skill) : `${abbr} check`;
}

/** D&D 5e proficiency bonus: +2 at levels 1–4, +3 at 5–8, … */
export const proficiencyBonus = (level) => 2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4);

/** True when the character lists the skill. */
export function isProficient(char, skill) {
  return !!skill && (char?.skills || []).some((s) => typeof s === "string" && s.trim().toLowerCase() === skill);
}

/** A character's bonus for a check: ability modifier, plus the proficiency
 * bonus for a listed skill when the house rule says so. */
export function checkBonus(char, check, rules = DEFAULT_HOUSE_RULES) {
  const mod = abilityModifier(char, ABILITY[check?.ability]?.stat || "Strength");
  const prof = rules?.skillBonus === "proficiency" && isProficient(char, check?.skill) ? proficiencyBonus(char?.level) : 0;
  return mod + prof;
}

/** The dice a check rolls under the house rules (saves have their own). */
export const diceFor = (check, rules = DEFAULT_HOUSE_RULES) => (check?.save ? rules?.saveDice || DEFAULT_HOUSE_RULES.saveDice : rules?.abilityCheckDice || DEFAULT_HOUSE_RULES.abilityCheckDice);

/** DC quick picks that suit the dice: 2d6 tops out at 12, a d20 at 20. */
export function dcPresets(dice) {
  const { count, sides } = parseCheckDice(dice);
  const max = count * sides;
  if (max <= 12) return [7, 10, 12];
  return [10, 12, 15, 20];
}

const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const formatBonus = fmt;

/** Roll `dice` + bonus, with advantage ("adv") / disadvantage ("dis"):
 * one extra die, keep the best / worst. → { total, rolls, dropped } */
export function rollFor(dice, bonus, adv = "normal", rollDie = (sides) => 1 + Math.floor(Math.random() * sides)) {
  const { count, sides } = parseCheckDice(dice);
  const base = Array.from({ length: count }, () => rollDie(sides));
  const mode = adv === "adv" ? "advantage" : adv === "dis" ? "disadvantage" : "normal";
  const { rolls, droppedRoll } = applyCheckAdvantage(base, sides, mode, rollDie);
  return { total: rolls.reduce((a, b) => a + b, 0) + bonus, rolls, dropped: droppedRoll };
}
