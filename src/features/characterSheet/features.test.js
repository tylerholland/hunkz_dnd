import { describe, expect, it } from "vitest";
import { featureMaxUses, featureUsesLeft, normalizeFeatures, proficiencyBonus, restFeatures, spendFeatureUse } from "./features";
import { applyLongRest, applyShortRest } from "./constants";

const hiddenStep = { id: "f1", name: "Hidden Step", kind: "race", description: "Turn invisible…", uses: { mode: "prof", recharge: "long", used: 0 } };
const secondWind = { id: "f2", name: "Second Wind", kind: "class", uses: { mode: "fixed", max: 1, recharge: "short", used: 1 } };
const trance = { id: "f3", name: "Speech of Beast and Leaf", kind: "race", uses: null };

describe("Features & Traits", () => {
  it("works out proficiency-bonus uses from level", () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
    expect(featureMaxUses(hiddenStep, 5)).toBe(3);
    expect(featureMaxUses(secondWind, 5)).toBe(1);
    expect(featureMaxUses(trance, 5)).toBe(0);
  });

  it("spends and restores uses within bounds", () => {
    let list = spendFeatureUse([hiddenStep], "f1", 1, 1);
    expect(featureUsesLeft(list[0], 1)).toBe(1);
    list = spendFeatureUse(list, "f1", 1, 1);
    list = spendFeatureUse(list, "f1", 1, 1); // can't go below zero left
    expect(featureUsesLeft(list[0], 1)).toBe(0);
    list = spendFeatureUse(list, "f1", -1, 1);
    expect(featureUsesLeft(list[0], 1)).toBe(1);
  });

  it("a short rest refills short-rest features; a long rest refills everything", () => {
    const spent = normalizeFeatures([{ ...hiddenStep, uses: { ...hiddenStep.uses, used: 2 } }, secondWind, trance]);
    const short = restFeatures(spent, "short");
    expect(short.map((f) => f.uses?.used ?? null)).toEqual([2, 0, null]);
    const long = restFeatures(spent, "long");
    expect(long.map((f) => f.uses?.used ?? null)).toEqual([0, 0, null]);
  });

  it("the sheet's rest helpers include features", () => {
    const char = { level: 3, spellSlots: [], features: [{ ...hiddenStep, uses: { ...hiddenStep.uses, used: 2 } }, secondWind] };
    expect(applyLongRest(char).features.map((f) => f.uses.used)).toEqual([0, 0]);
    expect(applyShortRest(char).features.map((f) => f.uses.used)).toEqual([2, 0]);
    expect(applyShortRest({ spellSlots: [] }).features).toBeUndefined();
  });
});
