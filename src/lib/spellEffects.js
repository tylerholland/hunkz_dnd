// Spell effects, set by hand or applied from a cast (Story 70). They live in
// the same `conditions` array as the 5e conditions — so saving, syncing, the
// session log and player/DM visibility all work unchanged — and are told
// apart by name here. The pickers show them as their own group and the map
// draws them with their own rings (gold for helpful, sigils for curses).
//
// kind: "helpful" | "curse" | "neutral"
// rider (optional): extra damage the CASTER adds to their own hits on the
// target while it lasts — carried by the attack bar (Story 70, option A).

export const SPELL_EFFECTS = [
  { name: "Blessed", kind: "helpful", help: "+1d4 to attack rolls and saving throws (Bless)." },
  { name: "Hasted", kind: "helpful", help: "+2 AC, advantage on Dex saves, double speed, one extra action (Haste)." },
  { name: "Heroism", kind: "helpful", help: "Immune to frightened; gains temp HP each turn (Heroism)." },
  { name: "Shielded", kind: "helpful", help: "+2 AC (Shield of Faith)." },
  { name: "Raging", kind: "helpful", help: "Bonus melee damage; resistance to bludgeoning, piercing and slashing (Rage)." },
  { name: "Dodging", kind: "helpful", help: "Attacks against it have disadvantage; advantage on Dex saves (Dodge)." },
  { name: "Hidden", kind: "helpful", help: "Unseen: attacks against it have disadvantage, its attacks have advantage." },
  { name: "Hexed", kind: "curse", help: "Disadvantage on checks with one chosen ability; the caster deals +1d6 necrotic on each hit (Hex).", rider: { dice: "1d6", type: "necrotic", label: "Hex" } },
  { name: "Marked", kind: "curse", help: "The caster deals +1d6 on each weapon hit and can track it (Hunter's Mark).", rider: { dice: "1d6", label: "Mark" } },
  { name: "Baned", kind: "curse", help: "−1d4 to attack rolls and saving throws (Bane)." },
  { name: "Outlined", kind: "curse", help: "Glows; attacks against it have advantage and it can't be invisible (Faerie Fire)." },
  { name: "Flying", kind: "neutral", help: "Airborne — out of reach of melee from the ground; falls if knocked prone or its speed drops to 0." },
];

export const EFFECT_KINDS = [
  { value: "curse", label: "Curse" },
  { value: "helpful", label: "Helpful" },
  { value: "neutral", label: "Neutral" },
];

// The DM's custom effects ("Covered in slime"), stored in house rules so every
// screen knows their kind. Pages call setCustomEffects() whenever house rules
// arrive; the lookups below then include them.
let customEffects = [];
let byName = new Map();

function rebuild() {
  byName = new Map([...SPELL_EFFECTS, ...customEffects].map((e) => [e.name.toLowerCase(), e]));
}
rebuild();

const KIND_VALUES = new Set(EFFECT_KINDS.map((k) => k.value));

export function normalizeCustomEffects(list) {
  const seen = new Set(SPELL_EFFECTS.map((e) => e.name.toLowerCase()));
  return (Array.isArray(list) ? list : [])
    .map((e) => ({
      name: typeof e?.name === "string" ? e.name.trim().slice(0, 30) : "",
      kind: KIND_VALUES.has(e?.kind) ? e.kind : "neutral",
      custom: true,
    }))
    .filter((e) => {
      const key = e.name.toLowerCase();
      if (!e.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

export function setCustomEffects(list) {
  const next = normalizeCustomEffects(list);
  if (JSON.stringify(next) === JSON.stringify(customEffects)) return;
  customEffects = next;
  rebuild();
}

/** Every effect a picker should offer: the fixed list, then the DM's own. */
export function allSpellEffects() {
  return [...SPELL_EFFECTS, ...customEffects];
}

export function spellEffect(name) {
  return typeof name === "string" ? byName.get(name.trim().toLowerCase()) || null : null;
}

export const isSpellEffect = (name) => !!spellEffect(name);
export const isHelpfulEffect = (name) => spellEffect(name)?.kind === "helpful";
export const isCurseEffect = (name) => spellEffect(name)?.kind === "curse";

export const HELPFUL_EFFECTS = SPELL_EFFECTS.filter((e) => e.kind === "helpful").map((e) => e.name);
export const CURSE_EFFECTS = SPELL_EFFECTS.filter((e) => e.kind === "curse").map((e) => e.name);
export const NEUTRAL_EFFECTS = SPELL_EFFECTS.filter((e) => e.kind === "neutral").map((e) => e.name);

/**
 * Damage riders the attacker adds to a hit on this target: effects on it that
 * carry a rider AND were cast by this attacker. `sources` is the target's
 * effectSources ({ Hexed: { type, sourceId, spell } }).
 * @returns {{ effect, dice, label, type? }[]}
 */
export function ridersFor({ conditions, sources, attackerSlug }) {
  if (!attackerSlug || !Array.isArray(conditions)) return [];
  return conditions
    .map((name) => ({ name, def: spellEffect(name), source: sources?.[name] }))
    .filter(({ def, source }) => def?.rider && source?.type === "character" && source.sourceId === attackerSlug)
    .map(({ name, def, source }) => ({ effect: name, dice: def.rider.dice, label: source.spell || def.rider.label || name, ...(def.rider.type ? { type: def.rider.type } : {}) }));
}

// Pill colours (same shape as dashboardShared's conditionStyle).
export const HELPFUL_STYLE = { bg: "rgba(232,192,96,0.14)", border: "rgba(232,192,96,0.45)", color: "#ecc970" };
export const CURSE_STYLE = { bg: "rgba(170,100,230,0.15)", border: "rgba(182,120,236,0.42)", color: "#cda2f2" };
export const NEUTRAL_STYLE = { bg: "rgba(142,197,232,0.14)", border: "rgba(142,197,232,0.45)", color: "#9fcfee" };

export function effectStyle(kind) {
  return kind === "helpful" ? HELPFUL_STYLE : kind === "neutral" ? NEUTRAL_STYLE : CURSE_STYLE;
}
