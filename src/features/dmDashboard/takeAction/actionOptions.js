// DM Take Action (ADR-032) — what an actor can do on the map, and the small
// dice helpers the Deal Damage pop-up uses. Pure: no React, no API.
import { buildAttackEntries, buildUnarmedStrike, normalizeSpells } from "../../characterSheet/constants";
import { abilityModifier } from "../cardStats";
import { classifyStrike } from "../../maps/combatFx/strikeRules";
import { parseDiceExpr, rollDie } from "../../../components/DiceRoller";
import { lookAnimation, normalizeAttacks } from "../npcStats";

// A potion of healing — the most common heal the DM applies by hand.
export const DEFAULT_HEAL_DICE = "2d4+2";

export const HEAL_ACTION = { id: "heal", name: "Heal", style: "heal", dice: DEFAULT_HEAL_DICE, heal: true };

// Quick attacks for any NPC (and for creatures without their own): the DM
// picks the look, and the dice last used for that NPC + action are
// remembered (see rememberedDice below). Their attack roll is the DM
// Setting "NPC attack roll" (houseRules.npcAttackDice).
export const NPC_ACTIONS = [
  { id: "npc-unarmed", name: "Unarmed Strike", style: "flurry", dice: "1d4" },
  { id: "npc-sword", name: "Swing Sword", style: "cut", dice: "1d8" },
  { id: "npc-rock", name: "Throw Rock", style: "rock", dice: "1d4" },
  { id: "npc-arrow", name: "Fire Arrow", style: "arrow", dice: "1d6" },
];

export const MAGIC_ACTIONS = [
  { id: "magic-fire", name: "Fire", style: "fire", dice: "2d6", magic: true },
  { id: "magic-force", name: "Force Blast", style: "force", dice: "2d8", magic: true },
  { id: "magic-bolt", name: "Lightning", style: "bolt", dice: "2d8", magic: true },
];

/**
 * A player character's actions, in the order the drawer shows them:
 * weapons, Unarmed Strike (unless they have their own), attack spells.
 * Heal is added by the drawer after a divider.
 */
export function characterActions(member) {
  if (!member) return [];
  const spells = normalizeSpells(member.spells);
  const { weaponEntries, spellEntries } = buildAttackEntries({ weapons: member.weapons || [], spells });
  const unarmed = buildUnarmedStrike({
    weapons: member.weapons || [],
    charClass: member.charClass,
    level: member.level,
    mods: { Strength: abilityModifier(member, "Strength"), Dexterity: abilityModifier(member, "Dexterity") },
  });
  return [...weaponEntries, ...(unarmed ? [unarmed] : []), ...spellEntries].map((entry) => ({
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    toHit: entry.toHit || "",
    // The whole attack roll, as the DM rolls it for this character: a d20 plus
    // the to-hit bonus.
    hit: toHitExpr(entry.toHit),
    dice: entry.damage || "",
    style: classifyStrike({ attack: { kind: entry.kind, name: entry.name }, adjacent: entry.kind !== "spell" }),
  }));
}

// "+5" / "5" / "-1" → "1d20+5" / "1d20-1"; nothing → "1d20".
export function toHitExpr(toHit) {
  const n = parseInt(String(toHit ?? "").replace(/\s+/g, ""), 10);
  return Number.isFinite(n) && n !== 0 ? `1d20${n > 0 ? "+" : ""}${n}` : "1d20";
}

/**
 * An NPC's own attacks (set on its library creature or on the NPC), as
 * actions: the whole attack roll, the damage, and the animation for its look.
 */
export function npcOwnActions(npc) {
  return normalizeAttacks(npc?.attacks).map((a) => ({
    id: `own-${a.id}`,
    name: a.name,
    hit: a.hit,
    dice: a.damage,
    look: a.look,
    style: lookAnimation(a.look),
    own: true,
  }));
}

/** Everything an actor can pick, as the drawer groups it. */
export function actionGroups(actor) {
  if (actor?.type === "character") {
    const all = characterActions(actor.member);
    return {
      primary: all.filter((a) => a.kind !== "spell"),
      spells: all.filter((a) => a.kind === "spell"),
      heal: HEAL_ACTION,
      magic: [],
    };
  }
  return { own: npcOwnActions(actor?.npc), primary: NPC_ACTIONS, spells: [], heal: HEAL_ACTION, magic: MAGIC_ACTIONS };
}

/**
 * A player's damage roll aimed at a target — the rows that get "Deal Damage"
 * in the DM's roll log. Attack (to-hit) rolls don't: hit or miss is the DM's
 * call, and the damage roll that follows is what gets applied.
 */
export function isDealableRoll(entry) {
  return !!entry
    && entry.source !== "dm"
    && !!entry.slug
    && !!entry.target?.sourceId
    && !!entry.attack?.name
    && /\bDMG$/i.test(String(entry.label || "").trim());
}

/** A player's to-hit roll aimed at a target (ATK / CAST), not the damage. */
export function isToHitRoll(entry) {
  return !!entry
    && entry.source !== "dm"
    && !!entry.slug
    && !!entry.target?.sourceId
    && !!entry.attack?.name
    && /\b(ATK|CAST)\b/i.test(String(entry.label || ""));
}

/**
 * The to-hit roll that went with a player's damage roll: the newest ATK/CAST
 * by the same player at the same target with the same attack, before it.
 */
export function toHitRollFor(rolls, damageEntry) {
  const at = Date.parse(damageEntry?.createdAt || "");
  if (!Array.isArray(rolls) || !Number.isFinite(at)) return null;
  return rolls
    .filter((r) => isToHitRoll(r)
      && r.slug === damageEntry.slug
      && r.target?.sourceId === damageEntry.target?.sourceId
      && (r.attack.id ? r.attack.id === damageEntry.attack?.id : r.attack.name === damageEntry.attack?.name)
      && Date.parse(r.createdAt || "") <= at)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null;
}

// ── Dice ────────────────────────────────────────────────────────────────────

/**
 * Roll a dice expression. Crit doubles the dice (not the modifier).
 * @returns {{ exprLabel, groups: [{sides, rolls}], rollValues, flat, total } | null}
 */
export function rollDiceExpr(expr, { crit = false, roll = rollDie } = {}) {
  const parsed = typeof expr === "string" && expr.trim() ? parseDiceExpr(expr.trim()) : null;
  if (!parsed || parsed.groups.length === 0) return null;
  const groups = parsed.groups.map(({ count, sides }) => {
    const n = Math.min(60, count * (crit ? 2 : 1));
    return { sides, rolls: Array.from({ length: n }, () => roll(sides)) };
  });
  const rollValues = groups.flatMap((g) => g.rolls);
  const flat = parsed.flat || 0;
  const total = Math.max(0, rollValues.reduce((sum, v) => sum + v, 0) + flat);
  const dicePart = groups.map((g) => `${g.rolls.length}d${g.sides}`).join("+");
  const exprLabel = flat ? `${dicePart}${flat > 0 ? "+" : ""}${flat}` : dicePart;
  return { exprLabel, groups, rollValues, flat, total };
}

// ── Remembered NPC dice (per DM browser, a convenience only) ───────────────
const DICE_MEMORY_KEY = "dm-take-action-dice";

function readDiceMemory() {
  try {
    const raw = window.localStorage.getItem(DICE_MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function rememberedDice(actorKey, actionId) {
  const value = readDiceMemory()[`${actorKey}|${actionId}`];
  return typeof value === "string" ? value : null;
}

export function rememberDice(actorKey, actionId, expr) {
  try {
    const memory = readDiceMemory();
    memory[`${actorKey}|${actionId}`] = expr;
    const keys = Object.keys(memory);
    if (keys.length > 200) keys.slice(0, keys.length - 200).forEach((k) => { delete memory[k]; });
    window.localStorage.setItem(DICE_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // storage unavailable — the pop-up just falls back to the preset dice
  }
}
