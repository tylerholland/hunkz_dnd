// Combat FX (ADR-031) — pure rules: which effect a hit plays, and how a hit
// is matched to the declared attack in the shared roll history.

// Effect styles the engine knows how to play.
export const STYLES = ["cut", "chop", "flurry", "arrow", "rock", "fire", "force", "bolt", "heal"];

const SPELL_RULES = [
  [/fire|flame|burn|scorch|inferno|ember|blaze|firebolt/i, "fire"],
  [/force|thunder|eldritch|blast|shatter|wave|repel|push/i, "force"],
];

const WEAPON_RULES = [
  [/unarmed|fist|punch|kick|palm|monk|flurry|strike of|martial/i, "flurry"],
  [/axe|maul|hammer|mace|club|flail|morning ?star|pick/i, "chop"],
  [/bow|crossbow|sling|dart|javelin|throw|blowgun|net/i, "arrow"],
  [/sword|dagger|blade|rapier|scimitar|knife|katana|sabre|saber|spear|glaive|halberd|pike|trident|sickle|whip/i, "cut"],
];

// Adjacent = the gap between token rims is at most one token-width.
export const MELEE_GAP_UNITS = 1.0;

/**
 * @param {object} p
 * @param {{kind: "weapon"|"spell", name: string}|null} p.attack  declared attack, if any
 * @param {boolean} p.heal         HP went up
 * @param {boolean} p.adjacent     attacker and target are within melee reach
 * @returns {string} one of STYLES
 */
export function classifyStrike({ attack, heal = false, adjacent = true }) {
  if (heal) return "heal";
  const name = String(attack?.name || "");
  if (attack?.kind === "spell") {
    for (const [pattern, style] of SPELL_RULES) if (pattern.test(name)) return style;
    return "bolt"; // any other attack spell: forked bolt in the caster's colour
  }
  if (attack?.kind === "weapon") {
    for (const [pattern, style] of WEAPON_RULES) if (pattern.test(name)) return style;
  }
  return adjacent ? "cut" : "arrow";
}

// How far back from the damage stamp a declared attack roll may be to count
// as "this hit" (the roll comes first, then someone applies the damage).
export const ROLL_MATCH_WINDOW_MS = 120000;

/**
 * Find the declared attack behind a hit: the newest roll by the attacking
 * character that names an attack, made shortly before the damage landed,
 * preferring one aimed at this target. Crit if any roll of that attack in the
 * window was a crit (the attack roll crits; the damage roll follows it).
 *
 * @param {Array} rolls           roll-history events (newest first or any order)
 * @param {object} p
 * @param {string} p.attackerSlug character slug of the attacker (NPC attackers have no rolls)
 * @param {string} p.targetSourceId the target's slug / npc id
 * @param {string} p.at           ISO time the damage/heal was stamped
 * @returns {{attack: object|null, crit: boolean}}
 */
export function matchDeclaredAttack(rolls, { attackerSlug, targetSourceId, at }) {
  const atMs = Date.parse(at || "");
  if (!attackerSlug || !Number.isFinite(atMs) || !Array.isArray(rolls)) return { attack: null, crit: false };
  const candidates = rolls.filter((roll) => {
    if (roll?.slug !== attackerSlug || !roll.attack?.name) return false;
    const t = Date.parse(roll.createdAt || "");
    return Number.isFinite(t) && t <= atMs + 5000 && atMs - t <= ROLL_MATCH_WINDOW_MS;
  });
  if (candidates.length === 0) return { attack: null, crit: false };
  const newestFirst = [...candidates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const aimed = newestFirst.find((roll) => roll.target?.sourceId === targetSourceId);
  const chosen = aimed || newestFirst[0];
  const sameAttack = newestFirst.filter((roll) => (roll.attack.id && roll.attack.id === chosen.attack.id) || roll.attack.name === chosen.attack.name);
  return { attack: chosen.attack, crit: sameAttack.some((roll) => roll.isCrit) };
}

// Spell colour from the caster's theme: the palette accent's hue, with
// saturation/brightness pushed up so a muted UI colour still reads as magic.
export function hueFromHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return 205;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 205;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h;
}
