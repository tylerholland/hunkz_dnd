// NPC abilities and defense (design/prototypes/npc-abilities.html). Set on a
// library creature, copied to NPCs in play, changeable per NPC. DM-only.
// Keep the shapes in sync with backend/src/lib/npcStats.js.
//
//   defense:   { kind: "ac", ac: 13 } | { kind: "roll", roll: "1d20+3", name: "Dodge" }
//   abilities: [{ id, name, notes?, roll?: { hit: "1d20+8", damage: "1d4+2", look: "lash" } }]
// A rollable ability (`roll`) shows in Take Action; the rest are notes.
// `hit` is the whole attack roll — in D&D, a d20 plus the creature's bonus.
// Older data had ability strings and a separate `attacks` list; both are read.
import { parseDiceExpr, rollDie } from "../../components/DiceRoller";

// What a strike looks like on the map — each look is an animation in the
// combat FX engine (design/prototypes/creature-strikes.html).
export const LOOK_GROUPS = [
  { title: "Creature", looks: [
    { id: "bite", label: "Bite" }, { id: "claw", label: "Claw" }, { id: "lash", label: "Lash" },
    { id: "sting", label: "Sting" }, { id: "slam", label: "Slam" }, { id: "breath", label: "Breath" },
    { id: "spit", label: "Spit" },
  ] },
  { title: "Weapon", looks: [
    { id: "cut", label: "Cut" }, { id: "stab", label: "Stab" }, { id: "chop", label: "Chop" }, { id: "flurry", label: "Flurry" },
    { id: "arrow", label: "Arrow" }, { id: "rock", label: "Rock" },
  ] },
  { title: "Magic", looks: [{ id: "fire", label: "Fire" }, { id: "force", label: "Force" }, { id: "bolt", label: "Bolt" }] },
];
const ALL_LOOKS = LOOK_GROUPS.flatMap((g) => g.looks);
export const LOOK_IDS = ALL_LOOKS.map((l) => l.id);
export const lookLabel = (id) => ALL_LOOKS.find((l) => l.id === id)?.label || "Cut";
/** The animation a look plays (an unknown look plays Cut). */
export const lookAnimation = (id) => (LOOK_IDS.includes(id) ? id : "cut");

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
  [/dagger|rapier|knife|stiletto|shank|shiv|needle|spear|pike|trident|lance|short ?sword/i, "stab"],
  [/sword|blade|scimitar|glaive|halberd/i, "cut"],
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

// "Keen Smell: advantage on…" → { name: "Keen Smell", notes: "advantage on…" }.
function splitAbilityText(text) {
  const t = String(text || "").trim().slice(0, 600);
  const m = /^(.{1,40}?)\s*(?::|\s[—–-]\s)\s*(.+)$/.exec(t);
  return m ? { name: m[1].trim(), notes: m[2].trim() } : { name: t.slice(0, 120), notes: t.length > 120 ? t.slice(120).trim() : "" };
}

/** A creature's abilities as one clean list, reading the old shapes too. */
export function normalizeAbilities(rawAbilities, legacyAttacks) {
  const list = Array.isArray(rawAbilities) ? rawAbilities : typeof rawAbilities === "string" && rawAbilities.trim() ? [rawAbilities] : [];
  const out = list.map((a, i) => {
    if (typeof a === "string") return { id: `ab-${i + 1}`, ...splitAbilityText(a) };
    const name = String(a?.name || "").trim().slice(0, 120);
    const notes = String(a?.notes || "").trim().slice(0, 600);
    const hit = tidyDice(a?.roll?.hit);
    const damage = tidyDice(a?.roll?.damage);
    return {
      id: String(a?.id || `ab-${i + 1}`).slice(0, 40),
      name,
      notes,
      ...(hit && damage ? { roll: { hit, damage, look: LOOK_IDS.includes(a?.roll?.look) ? a.roll.look : "cut" } } : {}),
    };
  });
  const names = new Set(out.map((a) => a.name.toLowerCase()));
  for (const atk of normalizeAttacks(legacyAttacks)) {
    if (!names.has(atk.name.toLowerCase())) out.push({ id: atk.id, name: atk.name, notes: "", roll: { hit: atk.hit, damage: atk.damage, look: atk.look } });
  }
  return out.filter((a) => a.name).map(({ notes, ...rest }) => (notes ? { ...rest, notes } : rest)).slice(0, 30);
}

/** An entity's (NPC's or library creature's) abilities, whatever shape they're stored in. */
export const abilitiesOf = (entity) => normalizeAbilities(entity?.abilities, entity?.attacks);
/** The abilities that can be rolled — what Take Action offers. */
export const rollableAbilities = (entity) => abilitiesOf(entity).filter((a) => a.roll);
/** Plain text of an ability, for search and short lists. */
export const abilityText = (a) => (typeof a === "string" ? a : [a?.name, a?.notes].filter(Boolean).join(": "));

/** The stats to copy onto an NPC when it's added from a library creature. */
export function statsFromTemplate(template) {
  const defense = normalizeDefense(template?.defense);
  const abilities = abilitiesOf(template);
  return { ...(defense ? { defense } : {}), ...(abilities.length ? { abilities } : {}) };
}

// Ids don't matter for "changed": two lists with the same content are the same.
const comparable = (entity) => JSON.stringify({
  defense: normalizeDefense(entity?.defense),
  abilities: abilitiesOf(entity).map(({ id, ...rest }) => rest), // eslint-disable-line no-unused-vars
});
/** Has this NPC's defense or abilities been changed from its library creature? */
export function changedFromTemplate(npc, template) {
  if (!template) return false;
  return comparable(npc) !== comparable(template);
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
