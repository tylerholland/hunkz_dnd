import { describe, expect, it } from "vitest";
import { abilityModifier, formatMod, getAbilityMods, getPassivePerception, getSkillNames, getSpeed, getWeaponSummary, groupDrawerContent } from "./cardStats";

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

  it("lists skill names without 5e bonuses", () => {
    expect(getSkillNames({ skills: ["lore", "Stealth", " ", 3] })).toEqual(["Lore", "Stealth"]);
  });

  it("summarizes weapon attack and damage", () => {
    expect(getWeaponSummary(char.weapons[0])).toEqual({ attack: 5, damage: "1d6+2" });
    expect(getWeaponSummary({ name: "Rock" })).toEqual({ attack: null, damage: null });
  });
});

describe("groupDrawerContent", () => {
  it("sorts a loadout the way a DM reads it", () => {
    const groups = groupDrawerContent({
      weapons: [
        { id: "w1", name: "Longsword", mods: [{ attribute: "Attack Bonus", value: "+5" }, { attribute: "Damage", value: "1d8+3" }] },
        { id: "w2", name: "Spare Dagger", equipped: false },
      ],
      spells: [
        { id: "s1", name: "Fire Bolt", role: "attack", toHit: "+6", damage: "1d10", level: 0 },
        { id: "s2", name: "Shield", level: 1 },
        "Light",
      ],
      equipment: [
        { id: "e1", name: "Chain Mail", type: "armor" },
        { id: "e2", name: "Ring of Protection", mods: [{ attribute: "Armor", value: "+1" }], requiresAttunement: true, attuned: true },
        { id: "e3", name: "Healing Potion", type: "potion", qty: 2 },
        { id: "e4", name: "Rope" },
        { id: "e5", name: "Cloak of Elvenkind", type: "wondrous", equipped: false },
      ],
    });
    expect(groups.attacks.map((a) => [a.name, a.attack, a.damage])).toEqual([["Longsword", 5, "1d8+3"], ["Fire Bolt", 6, "1d10"]]);
    expect(groups.gear.map((g) => g.name)).toEqual(["Chain Mail", "Ring of Protection"]);
    expect(groups.gear[1].mods).toBe("Armor +1");
    expect(groups.consumables).toBeUndefined();
    expect(groups.spells.map((s) => s.name)).toEqual(["Shield", "Light"]);
    expect(groups.pack.map((p) => [p.name, !!p.stowed, p.qty])).toEqual([
      ["Spare Dagger", true, undefined], ["Healing Potion", false, 2], ["Rope", false, undefined], ["Cloak of Elvenkind", true, undefined],
    ]);
    expect(groups.attacks[0].icon).toBe("weapon");
    expect(groups.gear.map((g) => g.icon)).toEqual(["armor", "other"]);
    expect(groups.pack[1].icon).toBe("potion");
  });
});
