// House rules — DM-configurable table rules, stored in the "house-rules"
// sentinel. Pure (no DB) so handlers and tests can share it. Keep the
// defaults and dice format in sync with src/lib/houseRules.js (client).
// featuresEnabled — show the Features & Traits section (race/class features
// with uses) on character sheets, the Session page and the DM card.
// spellCastDice — what a spell's cast roll uses (plus its to-hit); separate
// from ability checks, defaulting to the usual attack d20.
// playersEndTurn — players may end their own turn in initiative (Story 49).
// customEffects — the DM's own effects ([{ name, kind }]), Story 70.
// money — which coins are in use and their worth in silver (lib/money.js).
// saveDice — what a saving throw rolls (before the ability modifier).
// skillBonus — what a proficient skill adds to a check: "none" (the ability
// modifier alone) or "proficiency" (D&D 5e: +2 at levels 1–4, rising with level).
// npcAttackDice — the attack roll for an NPC's quick attacks when the creature
// has none of its own: a d20 plus a typical low-level monster's +3, by default.
const { normalizeMoney, DEFAULT_MONEY } = require("./money");
const DEFAULT_HOUSE_RULES = { abilityCheckDice: "2d6", featuresEnabled: true, spellCastDice: "1d20", playersEndTurn: true, customEffects: [], money: DEFAULT_MONEY, npcAttackDice: "1d20+3", weaponDamage: "wod", saveDice: "1d20", skillBonus: "none" };
const EFFECT_KINDS = new Set(["curse", "helpful", "neutral"]);

function normalizeCustomEffects(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((e) => ({
      name: typeof e?.name === "string" ? e.name.trim().slice(0, 30) : "",
      kind: EFFECT_KINDS.has(e?.kind) ? e.kind : "neutral",
    }))
    .filter((e) => {
      const key = e.name.toLowerCase();
      if (!e.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}
const CHECK_DICE_PATTERN = /^([1-9]|10)d([2-9]|[1-9]\d|100)$/;

function isValidCheckDice(value) {
  return typeof value === "string" && CHECK_DICE_PATTERN.test(value.trim().toLowerCase());
}

function normalizeDice(value, fallback) {
  const dice = typeof value === "string" ? value.trim().toLowerCase() : "";
  return isValidCheckDice(dice) ? dice : fallback;
}

// Dice with an optional bonus or penalty: 1d20+3, 2d6-1, 1d20.
const ATTACK_DICE_PATTERN = /^([1-9]|10)d([2-9]|[1-9]\d|100)([+-]\d{1,2})?$/;
function isValidAttackDice(value) {
  return typeof value === "string" && ATTACK_DICE_PATTERN.test(value.replace(/\s+/g, "").toLowerCase());
}

function normalizeHouseRulesRecord(item) {
  const dice = typeof item?.abilityCheckDice === "string" ? item.abilityCheckDice.trim().toLowerCase() : "";
  return {
    abilityCheckDice: isValidCheckDice(dice) ? dice : DEFAULT_HOUSE_RULES.abilityCheckDice,
    featuresEnabled: item?.featuresEnabled !== false,
    spellCastDice: normalizeDice(item?.spellCastDice, DEFAULT_HOUSE_RULES.spellCastDice),
    playersEndTurn: item?.playersEndTurn !== false,
    customEffects: normalizeCustomEffects(item?.customEffects),
    money: normalizeMoney(item?.money),
    npcAttackDice: isValidAttackDice(item?.npcAttackDice) ? item.npcAttackDice.replace(/\s+/g, "").toLowerCase() : DEFAULT_HOUSE_RULES.npcAttackDice,
    weaponDamage: item?.weaponDamage === "dnd" ? "dnd" : "wod",
    saveDice: normalizeDice(item?.saveDice, DEFAULT_HOUSE_RULES.saveDice),
    skillBonus: item?.skillBonus === "proficiency" ? "proficiency" : "none",
    version: Number.isFinite(item?.version) ? item.version : 0,
  };
}

module.exports = { DEFAULT_HOUSE_RULES, isValidCheckDice, isValidAttackDice, normalizeHouseRulesRecord };
