// House rules — DM-configurable table rules (DM Settings page), delivered to
// every client in GET /session-state's `houseRules`. Every surface that rolls
// an ability check (DM party cards in both layouts, the DM dice roller, the
// player's Session-mode dice roller and ability chips) goes through the
// helpers below so the rule can never drift between screens.
//
// Keep DEFAULT_HOUSE_RULES and the dice format in sync with the server's
// backend/src/lib/houseRules.js.

// featuresEnabled — show Features & Traits (race/class features with uses).
// spellCastDice — a spell's cast roll (plus its to-hit); separate from checks.
export const DEFAULT_HOUSE_RULES = { abilityCheckDice: "2d6", featuresEnabled: true, spellCastDice: "1d20" };

const CHECK_DICE_PATTERN = /^([1-9]|10)d([2-9]|[1-9]\d|100)$/;

export function isValidCheckDice(value) {
  return typeof value === "string" && CHECK_DICE_PATTERN.test(value.trim().toLowerCase());
}

export function normalizeHouseRules(raw) {
  const dice = typeof raw?.abilityCheckDice === "string" ? raw.abilityCheckDice.trim().toLowerCase() : "";
  return {
    abilityCheckDice: isValidCheckDice(dice) ? dice : DEFAULT_HOUSE_RULES.abilityCheckDice,
    featuresEnabled: raw?.featuresEnabled !== false,
    spellCastDice: isValidCheckDice(raw?.spellCastDice) ? raw.spellCastDice.trim().toLowerCase() : DEFAULT_HOUSE_RULES.spellCastDice,
  };
}

// "2d6" → { count: 2, sides: 6 } (falls back to the default for bad input).
export function parseCheckDice(dice) {
  const safe = isValidCheckDice(dice) ? dice.trim().toLowerCase() : DEFAULT_HOUSE_RULES.abilityCheckDice;
  const [count, sides] = safe.split("d").map((n) => parseInt(n, 10));
  return { count, sides };
}

// Ability-check expression for display and the DM roller: "2d6+3", "1d20-1".
export function abilityCheckExpr(mod, dice = DEFAULT_HOUSE_RULES.abilityCheckDice) {
  const { count, sides } = parseCheckDice(dice);
  const m = Number.isFinite(mod) ? mod : 0;
  return `${count}d${sides}${m >= 0 ? "+" : ""}${m}`;
}

// True when a parsed roll is exactly the configured check dice (one group).
export function isCheckDiceGroups(groups, dice = DEFAULT_HOUSE_RULES.abilityCheckDice) {
  const { count, sides } = parseCheckDice(dice);
  return Array.isArray(groups) && groups.length === 1 && groups[0].count === count && groups[0].sides === sides;
}

// Advantage / disadvantage for a check: roll one extra die and keep the best
// (adv) or worst (dis) `count` of them — 2d6 → 3d6 keep 2, 1d20 → 2d20 keep 1.
// `rolls` are the dice already rolled for the check; `rollDie(sides)` rolls one.
export function applyCheckAdvantage(rolls, sides, advMode, rollDie) {
  if (advMode !== "advantage" && advMode !== "disadvantage") return { rolls, keptRolls: null, droppedRoll: null };
  const all = [...rolls, rollDie(sides)].sort((a, b) => a - b);
  const keptRolls = advMode === "advantage" ? all.slice(1) : all.slice(0, -1);
  const droppedRoll = advMode === "advantage" ? all[0] : all[all.length - 1];
  return { rolls: keptRolls, keptRolls, droppedRoll };
}
