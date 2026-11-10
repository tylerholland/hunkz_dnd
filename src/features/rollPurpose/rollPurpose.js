// "What was that for?" — best guesses for an untagged free roll, from its
// dice. Tags read like "Longbow attack", "Longbow damage", "Hex cast",
// "Stealth check", "Dexterity save"; the Story (storyLines.js) tells them as
// sentences. `attacks` are the character's attack entries ({ kind, name,
// toHit, damage }); `skills` the skills they list.
import { ABILITIES, SKILLS } from "../rollRequests/rollCheck";

const title = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
export const ALL_SKILLS = Object.keys(SKILLS).map(title);
export const ALL_SAVES = ABILITIES.map((a) => a.stat);
const MAX_GUESSES = 4;

const norm = (expr) => String(expr || "").replace(/\s+/g, "").toLowerCase();
const firstStep = (a) => `${a.name} ${a.kind === "spell" ? "cast" : "attack"}`;

/** The dice part and the flat bonus of "1d8+3" / "2d6 + 2" / "1d20-1". */
function splitExpr(expr) {
  const match = /^(\d+d\d+)([+-]\d+)?$/.exec(norm(expr));
  return match ? { dice: match[1], bonus: Number(match[2] || 0) } : { dice: norm(expr), bonus: 0 };
}

export function purposeGuesses({ expr, attacks = [], skills = [], checkDice = "2d6", spellDice = "1d20", inCombat = false }) {
  const { dice, bonus } = splitExpr(expr);
  const out = [];
  const add = (tag) => { if (tag && !out.includes(tag)) out.push(tag); };
  // Exact matches first: a weapon's damage dice, or its to-hit.
  attacks.forEach((a) => { if (a.damage && norm(a.damage) === norm(expr)) add(`${a.name} damage`); });
  attacks.forEach((a) => {
    const hitDice = a.kind === "spell" ? norm(spellDice) : "1d20";
    if (dice === hitDice && Number(String(a.toHit ?? "").replace("+", "")) === bonus) add(firstStep(a));
  });
  const own = (skills || []).map(title).filter((s) => ALL_SKILLS.includes(s));
  const checks = (inCombat ? ["Athletics", "Acrobatics"] : own.length ? own : ["Perception", "Investigation", "Stealth"]).map((s) => `${s} check`);
  const hits = attacks.map(firstStep);
  const damage = attacks.filter((a) => a.damage).map((a) => `${a.name} damage`);
  if (dice === norm(checkDice)) checks.forEach(add);
  if (dice === "1d20") hits.forEach(add);
  // Anything else is most likely damage.
  const damageFirst = dice !== "1d20" && dice !== norm(checkDice);
  (inCombat ? (damageFirst ? [...damage, ...hits] : [...hits, ...damage]) : checks).forEach(add);
  (inCombat ? checks : [...hits, ...damage]).forEach(add);
  return out.slice(0, MAX_GUESSES);
}

/** Every option, grouped, for "More…". */
export function purposeGroups(attacks = []) {
  return [
    { label: "Attacks", options: attacks.flatMap((a) => [{ tag: firstStep(a), text: firstStep(a) }, ...(a.damage ? [{ tag: `${a.name} damage`, text: `${a.name} damage` }] : [])]) },
    { label: "Skills", options: ALL_SKILLS.map((s) => ({ tag: `${s} check`, text: s })) },
    { label: "Saves", options: ALL_SAVES.map((s) => ({ tag: `${s} save`, text: s })) },
  ].filter((g) => g.options.length);
}
