// Spell effects, managed by hand for now (Story 70 will set them from spells).
// They live in the same `conditions` array as the 5e conditions — so saving,
// syncing, the session log and player/DM visibility all work unchanged — and
// are told apart by name here. The pickers show them as their own group and
// the map draws them with their own rings (gold for helpful, sigils for curses).

export const SPELL_EFFECTS = [
  { name: "Blessed", kind: "helpful", help: "+1d4 to attack rolls and saving throws (Bless)." },
  { name: "Hasted", kind: "helpful", help: "+2 AC, advantage on Dex saves, double speed, one extra action (Haste)." },
  { name: "Heroism", kind: "helpful", help: "Immune to frightened; gains temp HP each turn (Heroism)." },
  { name: "Shielded", kind: "helpful", help: "+2 AC (Shield of Faith)." },
  { name: "Raging", kind: "helpful", help: "Bonus melee damage; resistance to bludgeoning, piercing and slashing (Rage)." },
  { name: "Dodging", kind: "helpful", help: "Attacks against it have disadvantage; advantage on Dex saves (Dodge)." },
  { name: "Hidden", kind: "helpful", help: "Unseen: attacks against it have disadvantage, its attacks have advantage." },
  { name: "Hexed", kind: "curse", help: "Disadvantage on checks with one chosen ability; the caster deals +1d6 necrotic on each hit (Hex)." },
  { name: "Marked", kind: "curse", help: "The caster deals +1d6 on each weapon hit and can track it (Hunter's Mark)." },
  { name: "Baned", kind: "curse", help: "−1d4 to attack rolls and saving throws (Bane)." },
  { name: "Outlined", kind: "curse", help: "Glows; attacks against it have advantage and it can't be invisible (Faerie Fire)." },
];

const BY_NAME = new Map(SPELL_EFFECTS.map((e) => [e.name.toLowerCase(), e]));

export function spellEffect(name) {
  return typeof name === "string" ? BY_NAME.get(name.trim().toLowerCase()) || null : null;
}

export const isSpellEffect = (name) => !!spellEffect(name);
export const isHelpfulEffect = (name) => spellEffect(name)?.kind === "helpful";
export const isCurseEffect = (name) => spellEffect(name)?.kind === "curse";

export const HELPFUL_EFFECTS = SPELL_EFFECTS.filter((e) => e.kind === "helpful").map((e) => e.name);
export const CURSE_EFFECTS = SPELL_EFFECTS.filter((e) => e.kind === "curse").map((e) => e.name);

// Pill colours (same shape as dashboardShared's conditionStyle).
export const HELPFUL_STYLE = { bg: "rgba(232,192,96,0.14)", border: "rgba(232,192,96,0.45)", color: "#ecc970" };
export const CURSE_STYLE = { bg: "rgba(170,100,230,0.15)", border: "rgba(182,120,236,0.42)", color: "#cda2f2" };
