// House rules — DM-configurable table rules, stored in the "house-rules"
// sentinel. Pure (no DB) so handlers and tests can share it. Keep the
// defaults and dice format in sync with src/lib/houseRules.js (client).
// featuresEnabled — show the Features & Traits section (race/class features
// with uses) on character sheets, the Session page and the DM card.
// spellCastDice — what a spell's cast roll uses (plus its to-hit); separate
// from ability checks, defaulting to the usual attack d20.
const DEFAULT_HOUSE_RULES = { abilityCheckDice: "2d6", featuresEnabled: true, spellCastDice: "1d20" };
const CHECK_DICE_PATTERN = /^([1-9]|10)d([2-9]|[1-9]\d|100)$/;

function isValidCheckDice(value) {
  return typeof value === "string" && CHECK_DICE_PATTERN.test(value.trim().toLowerCase());
}

function normalizeDice(value, fallback) {
  const dice = typeof value === "string" ? value.trim().toLowerCase() : "";
  return isValidCheckDice(dice) ? dice : fallback;
}

function normalizeHouseRulesRecord(item) {
  const dice = typeof item?.abilityCheckDice === "string" ? item.abilityCheckDice.trim().toLowerCase() : "";
  return {
    abilityCheckDice: isValidCheckDice(dice) ? dice : DEFAULT_HOUSE_RULES.abilityCheckDice,
    featuresEnabled: item?.featuresEnabled !== false,
    spellCastDice: normalizeDice(item?.spellCastDice, DEFAULT_HOUSE_RULES.spellCastDice),
    version: Number.isFinite(item?.version) ? item.version : 0,
  };
}

module.exports = { DEFAULT_HOUSE_RULES, isValidCheckDice, normalizeHouseRulesRecord };
