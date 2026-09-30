import { describe, expect, it } from "vitest";
import { computeArmorClass } from "./armorClass";

const stats = (dex, extra = {}) => [
  { stat: "Dexterity", score: dex },
  ...Object.entries(extra).map(([stat, score]) => ({ stat, score })),
];

describe("computeArmorClass", () => {
  it("is 10 + Dex with no armor and nothing entered", () => {
    expect(computeArmorClass({ stats: stats(15) }).total).toBe(12);
  });

  it("uses the sheet's AC without armor (natural armor, Unarmored Defense) instead", () => {
    // Tortle: flat 17, Dex doesn't matter
    expect(computeArmorClass({ stats: stats(8), armorTotal: 17 }).total).toBe(17);
  });

  it("light armor adds all of Dex; medium caps it at +2; heavy ignores it", () => {
    const wearing = (acDex, acBase) => ({ stats: stats(18), equipment: [{ name: "Armor", type: "armor", acBase, acDex }] });
    expect(computeArmorClass(wearing("full", 11)).total).toBe(15); // leather, Dex +4
    expect(computeArmorClass(wearing("max2", 14)).total).toBe(16); // breastplate
    expect(computeArmorClass(wearing("none", 18)).total).toBe(18); // plate
  });

  it("worn armor replaces the no-armor value; a shield and Armor mods add on", () => {
    const char = {
      stats: stats(12),
      armorTotal: 13,
      equipment: [
        { name: "Leather", type: "Armor", acBase: 11, acDex: "full" },
        { name: "Shield", type: "shield", acBonus: 2 },
        { name: "Ring of Protection", mods: [{ attribute: "Armor", value: "+1" }] },
      ],
    };
    const { total, parts } = computeArmorClass(char);
    expect(total).toBe(15); // 11 + 1 Dex + 2 shield + 1 ring
    expect(parts.map((p) => p.label)).toEqual(["Leather", "Dexterity", "Shield", "Ring of Protection"]);
  });

  it("ignores unequipped gear and counts only the best armor and one shield", () => {
    const char = {
      stats: stats(10),
      equipment: [
        { name: "Chain mail", type: "armor", acBase: 16, acDex: "none", equipped: false },
        { name: "Leather", type: "armor", acBase: 11, acDex: "full" },
        { name: "Studded", type: "armor", acBase: 12, acDex: "full" },
        { name: "Shield", type: "shield", acBonus: 2 },
        { name: "Spare shield", type: "shield", acBonus: 2 },
      ],
    };
    expect(computeArmorClass(char).total).toBe(14);
  });

  it("counts Dex bonuses from items", () => {
    const char = { stats: stats(15), equipment: [{ name: "Gloves", mods: [{ attribute: "Dexterity", value: "+1" }] }] };
    expect(computeArmorClass(char).total).toBe(13); // 10 + (2 + 1)
  });
});
