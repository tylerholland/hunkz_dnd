import { describe, expect, it } from "vitest";
import { abilityCheckExpr, applyCheckAdvantage, isCheckDiceGroups, isValidCheckDice, normalizeHouseRules, parseCheckDice } from "./houseRules";

describe("houseRules", () => {
  it("defaults to 2d6 and validates NdS dice", () => {
    expect(normalizeHouseRules(null)).toEqual({ abilityCheckDice: "2d6", featuresEnabled: true, spellCastDice: "1d20", playersEndTurn: true });
    expect(normalizeHouseRules({ abilityCheckDice: " 1D20 " })).toEqual({ abilityCheckDice: "1d20", featuresEnabled: true, spellCastDice: "1d20", playersEndTurn: true });
    expect(normalizeHouseRules({ abilityCheckDice: "2d6+1", featuresEnabled: false })).toEqual({ abilityCheckDice: "2d6", featuresEnabled: false, spellCastDice: "1d20", playersEndTurn: true });
    expect(normalizeHouseRules({ spellCastDice: " 2D6 " }).spellCastDice).toBe("2d6");
    expect(normalizeHouseRules({ spellCastDice: "2d6+1" }).spellCastDice).toBe("1d20");
    expect(isValidCheckDice("10d100")).toBe(true);
    expect(isValidCheckDice("11d6")).toBe(false);
    expect(parseCheckDice("3d8")).toEqual({ count: 3, sides: 8 });
  });

  it("builds check expressions from the configured dice", () => {
    expect(abilityCheckExpr(3)).toBe("2d6+3");
    expect(abilityCheckExpr(-1, "1d20")).toBe("1d20-1");
    expect(abilityCheckExpr(0, "3d6")).toBe("3d6+0");
  });

  it("recognises the configured check dice", () => {
    expect(isCheckDiceGroups([{ count: 2, sides: 6 }], "2d6")).toBe(true);
    expect(isCheckDiceGroups([{ count: 1, sides: 20 }], "2d6")).toBe(false);
    expect(isCheckDiceGroups([{ count: 1, sides: 20 }], "1d20")).toBe(true);
  });

  it("rolls one extra die and keeps the best/worst N", () => {
    const fixed = (value) => () => value;
    expect(applyCheckAdvantage([2, 5], 6, "advantage", fixed(4))).toEqual({ rolls: [4, 5], keptRolls: [4, 5], droppedRoll: 2 });
    expect(applyCheckAdvantage([2, 5], 6, "disadvantage", fixed(4))).toEqual({ rolls: [2, 4], keptRolls: [2, 4], droppedRoll: 5 });
    expect(applyCheckAdvantage([7], 20, "advantage", fixed(15))).toEqual({ rolls: [15], keptRolls: [15], droppedRoll: 7 });
    expect(applyCheckAdvantage([3, 3], 6, "normal", fixed(6))).toEqual({ rolls: [3, 3], keptRolls: null, droppedRoll: null });
  });
});
