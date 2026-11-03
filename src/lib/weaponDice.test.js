import { afterEach, describe, expect, it } from "vitest";
import { setWeaponDice, weaponDamage } from "./weaponDice";
import { buildAttackEntries } from "../features/characterSheet/constants";

describe("weapon dice", () => {
  afterEach(() => setWeaponDice(null));

  it("a weapon rolls its own Damage, else its shop type's dice, else nothing", () => {
    setWeaponDice({ dagger: "1d4", "light-weapon": "d6" });
    expect(weaponDamage({ name: "Dagger of Bone", itemId: "dagger" })).toBe("1d4");
    expect(weaponDamage({ name: "Old knife", bought: { itemId: "light-weapon" } })).toBe("d6");
    expect(weaponDamage({ name: "Dagger of Bone", itemId: "dagger", mods: [{ attribute: "Damage", value: "1d6+1" }] })).toBe("1d6+1");
    expect(weaponDamage({ name: "Rock" })).toBe("");
  });

  it("attack lists (sheet and Take Action) use it", () => {
    setWeaponDice({ spear: "d6+1" });
    const { weaponEntries } = buildAttackEntries({ weapons: [{ id: "w", name: "Grandpa's Spear", itemId: "spear" }, { id: "x", name: "Stick" }] });
    expect(weaponEntries.map((e) => e.damage)).toEqual(["d6+1", undefined]);
  });
});
