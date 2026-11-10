import { describe, expect, it } from "vitest";
import { healingDice, rollHealing } from "./potions";

describe("healing potions", () => {
  it("knows the shop potion, the stronger ones by name, and 'heals XdY' items", () => {
    expect(healingDice({ name: "Healing draught", itemId: "potion-healing" })).toBe("2d4+2");
    expect(healingDice({ name: "Potion of Greater Healing" })).toBe("4d4+4");
    expect(healingDice({ name: "Red vial", description: "Heals 1d8 + 1 when drunk." })).toBe("1d8+1");
    expect(healingDice({ name: "Rope" })).toBeNull();
  });

  it("prefers the item's own heals effect, which can turn healing off", () => {
    expect(healingDice({ name: "Salve", onUse: { heals: " 1D6 + 2 " } })).toBe("1d6+2");
    expect(healingDice({ name: "Goodberry", onUse: { heals: "1" } })).toBe("1");
    expect(healingDice({ name: "Potion of Healing", onUse: { heals: "" } })).toBeNull();
    expect(healingDice({ name: "Odd", onUse: { heals: "lots" } })).toBeNull();
  });

  it("rolls a flat amount as itself", () => {
    expect(rollHealing("5")).toEqual({ total: 5, rolls: [], bonus: 5 });
  });

  it("rolls the dice plus the bonus", () => {
    const dice = [3, 1];
    expect(rollHealing("2d4+2", () => dice.shift())).toEqual({ total: 6, rolls: [3, 1], bonus: 2 });
  });
});
