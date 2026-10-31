// NPC attacks and defense (design/prototypes/npc-attacks.html). Set on a
// library creature, copied to NPCs in play, changeable per NPC. DM-only.
// Keep the shapes in sync with backend/src/lib/npcStats.js.
//
//   defense: { kind: "ac", ac: 13 } | { kind: "roll", roll: "1d20+3", name: "Dodge" }
//   attacks: [{ id, name, hit: "1d20+8", damage: "1d4+2", look: "lash" }]
// `hit` is the whole attack roll — in D&D, a d20 plus the creature's bonus.
import { parseDiceExpr, rollDie } from "../../components/DiceRoller";

// What a strike looks like on the map. The creature looks are new; until they
// have their own animations they play the nearest existing one (`plays`).
export const LOOK_GROUPS = [
  { title: "Creature", looks: [
    { id: "bite", label: "Bite", plays: "cut" },
    { id: "claw", label: "Claw", plays: "cut" },
    { id: "lash", label: "Lash", plays: "cut" },
    { id: "sting", label: "Sting", plays: "arrow" },
    { id: "slam", label: "Slam", plays: "chop" },
    { id: "breath", label: "Breath", plays: "fire" },
    { id: "spit", label: "Spit", plays: "arrow" },
  ] },
  { title: "Weapon", looks: [
    { id: "cut", label: "Cut" }, { id: "chop", label: "Chop" }, { id: "flurry", label: "Flurry" },
    { id: "arrow", label: "Arrow" }, { id: "rock", label: "Rock" },
  ] },
  { title: "Magic", looks: [{ id: "fire", label: "Fire" }, { id: "force", label: "Force" }, { id: "bolt", label: "Bolt" }] },
];
const ALL_LOOKS = LOOK_GROUPS.flatMap((g) => g.looks);
export const LOOK_IDS = ALL_LOOKS.map((l) => l.id);
export const lookLabel = (id) => ALL_LOOKS.find((l) => l.id === id)?.label || "Cut";
/** The animation a look plays today (creature looks borrow a near one). */
export const lookAnimation = (id) => ALL_LOOKS.find((l) => l.id === id)?.plays || (LOOK_IDS.includes(id) ? id : "cut");

// Guess a look from an attack's name until the DM picks one.
const GUESSES = [
  [/bite|fang|jaw|maw|gnaw|chomp/i, "bite"],
  [/claw|talon|rake|scratch/i, "claw"],
  [/tentacle|whip|lash|tail|tongue|vine|tendril/i, "lash"],
  [/sting|stinger|barb|spine/i, "sting"],
  [/slam|crush|squeeze|stomp|smash|ram|gore|butt|fist/i, "slam"],
  [/breath|breathe|exhale/i, "breath"],
  [/spit|acid|web|spray|venom|bile/i, "spit"],
  [/axe|hammer|club|mace|maul|flail/i, "chop"],
  [/bow|crossbow|sling|throw|javelin|dart/i, "arrow"],
  [/sword|blade|dagger|spear|scimitar|rapier|knife|glaive|halberd|pike/i, "cut"],
  [/fire|flame|burn/i, "fire"],
  [/lightning|shock|thunder/i, "bolt"],
];
export const guessLook = (name, fallback = "cut") => GUESSES.find(([re]) => re.test(name || ""))?.[1] || fallback;

const DICE = /^\s*(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*\s*$/i;
export const isDice = (v) => typeof v === "string" && DICE.test(v);
const tidyDice = (v) => (isDice(v) ? v.replace(/\s+/g, "") : "");

export function normalizeDefense(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.kind === "roll") {
    const roll = tidyDice(raw.roll);
    return roll ? { kind: "roll", roll, name: String(raw.name || "").trim().slice(0, 30) || "Defense" } : null;
  }
  const ac = parseInt(raw.ac, 10);
  return Number.isFinite(ac) && ac >= 0 && ac <= 40 ? { kind: "ac", ac } : null;
}

export function normalizeAttacks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a, i) => ({
      id: String(a?.id || `atk-${i + 1}`).slice(0, 40),
      name: String(a?.name || "").trim().slice(0, 40),
      hit: tidyDice(a?.hit),
      damage: tidyDice(a?.damage),
      look: LOOK_IDS.includes(a?.look) ? a.look : "cut",
    }))
    .filter((a) => a.name && a.hit && a.damage)
    .slice(0, 8);
}

/** The stats to copy onto an NPC when it's added from a library creature. */
export function statsFromTemplate(template) {
  const defense = normalizeDefense(template?.defense);
  const attacks = normalizeAttacks(template?.attacks);
  return { ...(defense ? { defense } : {}), ...(attacks.length ? { attacks } : {}) };
}

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Has this NPC's defense or attacks been changed from its library creature? */
export function changedFromTemplate(npc, template) {
  if (!template) return false;
  return !sameJson(normalizeDefense(npc?.defense), normalizeDefense(template.defense))
    || !sameJson(normalizeAttacks(npc?.attacks), normalizeAttacks(template.attacks));
}

/** Roll a dice expression: { total, rolls } or null if it doesn't read. */
export function rollDice(expr, roll = rollDie) {
  const parsed = parseDiceExpr(String(expr || "").trim());
  if (!parsed || !parsed.groups.length) return null;
  const rolls = [];
  let total = parsed.flat || 0;
  for (const g of parsed.groups) {
    for (let i = 0; i < g.count; i++) {
      const r = roll(g.sides);
      rolls.push(r);
      total += g.sign === -1 ? -r : r;
    }
  }
  return { total, rolls };
}

/** Exact chance (0–100) that `expr` totals at least `target`. */
export function chanceToReach(expr, target) {
  const parsed = parseDiceExpr(String(expr || "").trim());
  if (!parsed || !parsed.groups.length) return null;
  let dist = new Map([[parsed.flat || 0, 1]]);
  for (const g of parsed.groups) {
    const sign = g.sign === -1 ? -1 : 1;
    for (let i = 0; i < g.count; i++) {
      const next = new Map();
      for (const [v, p] of dist) for (let f = 1; f <= g.sides; f++) next.set(v + sign * f, (next.get(v + sign * f) || 0) + p / g.sides);
      dist = next;
    }
  }
  let p = 0;
  for (const [v, q] of dist) if (v >= target) p += q;
  return Math.round(p * 100);
}

/**
 * Hit or miss, as D&D has it: meeting the AC hits; a defense roll is a
 * contest, so the attack must beat it (a tie goes to the defender).
 */
export function attackHits(attackTotal, defense, defenseTotal = null) {
  if (!Number.isFinite(attackTotal) || !defense) return null;
  if (defense.kind === "ac") return attackTotal >= defense.ac;
  return Number.isFinite(defenseTotal) ? attackTotal > defenseTotal : null;
}

/** "AC 13" / "Dodge 1d20+3" — how a defense reads. */
export const defenseLabel = (d) => (!d ? "" : d.kind === "ac" ? `AC ${d.ac}` : `${d.name || "Defense"} ${d.roll}`);
