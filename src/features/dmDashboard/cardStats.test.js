import { describe, expect, it } from "vitest";
import { abilityModifier, formatMod, getAbilityMods, getPassivePerception, getSkillBonuses, getSpeed, getWeaponSummary } from "./cardStats";

const char = {
  stats: [
    { stat: "Strength", score: 8 },
    { stat: "Dexterity", score: 15 },
    { stat: "Constitution", score: 14 },
    { stat: "Wisdom", score: 16 },
  ],
  weapons: [{ name: "Staff", mods: [{ attribute: "Wisdom", value: "1" }, { attribute: "Attack Bonus", value: "+5" }, { attribute: "Damage", value: "1d6+2" }] }],
  equipment: [
    { name: "Boots", mods: [{ attribute: "Speed", value: 10 }] },
    { name: "Unworn ring", equipped: false, mods: [{ attribute: "Constitution", value: 2 }] },
  ],
};

describe("cardStats", () => {
  it("computes all six modifiers with equipped item bonuses", () => {
    expect(getAbilityMods(char).map((a) => `${a.abbr}${formatMod(a.mod)}`)).toEqual([
      "Str-1", "Dex+2", "Con+2", "Int+0", "Wis+4", "Cha+0",
    ]);
  });

  it("ignores unequipped items and missing stats", () => {
    expect(abilityModifier(char, "Constitution")).toBe(2);
    expect(abilityModifier({}, "Wisdom")).toBe(0);
  });

  it("derives passive perception and speed", () => {
    expect(getPassivePerception(char)).toBe(14);
    expect(getSpeed(char)).toEqual({ speed: 40, zeroed: false, notable: true });
    expect(getSpeed({ ...char, conditions: ["Grappled"] }).speed).toBe(0);
  });

  it("adds proficiency to standard skills only", () => {
    expect(getSkillBonuses({ ...char, level: 5, skills: ["perception", "Stealth", "Basket weaving"] })).toEqual([
      { name: "Perception", bonus: 7 },
      { name: "Stealth", bonus: 5 },
      { name: "Basket Weaving", bonus: null },
    ]);
  });

  it("summarizes weapon attack and damage", () => {
    expect(getWeaponSummary(char.weapons[0])).toEqual({ attack: 5, damage: "1d6+2" });
    expect(getWeaponSummary({ name: "Rock" })).toEqual({ attack: null, damage: null });
  });
});
