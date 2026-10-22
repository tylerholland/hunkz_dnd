const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidCheckDice, normalizeHouseRulesRecord, DEFAULT_HOUSE_RULES } = require("./houseRules");
const { isReservedCharacterSlug, HOUSE_RULES_SLUG } = require("./specialItems");

test("house rules default to 2d6 ability checks", () => {
  assert.deepEqual(normalizeHouseRulesRecord(undefined), { ...DEFAULT_HOUSE_RULES, version: 0 });
  assert.equal(DEFAULT_HOUSE_RULES.abilityCheckDice, "2d6");
  assert.equal(normalizeHouseRulesRecord(undefined).featuresEnabled, true);
  assert.equal(normalizeHouseRulesRecord({ featuresEnabled: false }).featuresEnabled, false);
  assert.equal(normalizeHouseRulesRecord(undefined).spellCastDice, "1d20");
  assert.equal(normalizeHouseRulesRecord(undefined).playersEndTurn, true);
  assert.equal(normalizeHouseRulesRecord({ playersEndTurn: false }).playersEndTurn, false);
  assert.deepEqual(
    normalizeHouseRulesRecord({ customEffects: [{ name: " Covered in slime ", kind: "curse" }, { name: "covered in SLIME" }, { name: "Blur", kind: "odd" }, { name: "" }] }).customEffects,
    [{ name: "Covered in slime", kind: "curse" }, { name: "Blur", kind: "neutral" }]
  );
  assert.equal(normalizeHouseRulesRecord({ spellCastDice: "2D6" }).spellCastDice, "2d6");
  assert.equal(normalizeHouseRulesRecord({ spellCastDice: "nonsense" }).spellCastDice, "1d20");
});

test("valid dice are kept (normalized), invalid fall back", () => {
  assert.equal(normalizeHouseRulesRecord({ abilityCheckDice: " 1D20 " }).abilityCheckDice, "1d20");
  assert.equal(normalizeHouseRulesRecord({ abilityCheckDice: "3d6" }).abilityCheckDice, "3d6");
  for (const bad of ["d20", "0d6", "11d6", "2d1", "2d101", "2d6+1", "", 7, null]) {
    assert.equal(isValidCheckDice(bad), false, String(bad));
    assert.equal(normalizeHouseRulesRecord({ abilityCheckDice: bad }).abilityCheckDice, "2d6");
  }
});

test("house-rules is a reserved (non-character) slug", () => {
  assert.equal(isReservedCharacterSlug(HOUSE_RULES_SLUG), true);
});
