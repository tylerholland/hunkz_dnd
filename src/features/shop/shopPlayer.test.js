import { beforeEach, describe, expect, it } from "vitest";
import { haveCount, packGroups, loadSatchel, saveSatchel, placeBubble } from "./shopPlayer";
import { SCENES } from "./shopData";

const rope = { id: "rope", cat: "gear", name: "20ft Rope", icon: "rope" };

describe("shop page helpers", () => {
  beforeEach(() => sessionStorage.clear());

  it("counts what the shopper already carries, by shop id or by name", () => {
    const char = {
      weapons: [{ id: "w", name: "Light Weapon", bought: { itemId: "light-weapon" } }],
      equipment: [{ id: "a", name: "20ft rope", qty: 2 }, { id: "b", name: "Rope ladder" }],
    };
    expect(haveCount(char, rope)).toBe(2);
    expect(haveCount(char, { id: "light-weapon", name: "Light Weapon" })).toBe(1);
    expect(haveCount(null, rope)).toBe(0);
  });

  it("groups the pack into weapons, armour and gear", () => {
    const byId = new Map([[rope.id, rope]]);
    const groups = packGroups({
      weapons: [{ id: "w", name: "Short Sword", equipped: true }],
      equipment: [{ id: "x", name: "Leathers", type: "armor", equipped: false }, { id: "r", name: "20ft Rope", bought: { itemId: "rope", from: "Shop" }, qty: 2 }],
    }, byId);
    expect(groups.map((g) => g.name)).toEqual(["Weapons", "Armour", "Gear & tools"]);
    expect(groups[0].rows[0].worn).toBe(true);
    expect(groups[1].rows[0].worn).toBe(false);
    expect(groups[2].rows[0]).toMatchObject({ qty: 2, art: "/art/shop/items/rope.jpg" });
  });

  it("shows a renamed item's type under its name", () => {
    const blade = { id: "light-weapon", cat: "arms", name: "Light Weapon" };
    const byId = new Map([[rope.id, rope], [blade.id, blade]]);
    const groups = packGroups({
      weapons: [{ id: "w", name: "Dagger of Bone", itemId: "light-weapon" }],
      equipment: [{ id: "r", name: "20ft Rope", itemId: "rope" }, { id: "g", name: "Grandpa's Rope", itemId: "rope" }],
    }, byId);
    expect(groups[0].rows[0]).toMatchObject({ name: "Dagger of Bone", kind: "Light Weapon", art: "/art/shop/items/light-weapon.jpg" });
    expect(groups[1].rows.map((r) => r.kind)).toEqual([null, "20ft Rope"]);
    expect(haveCount({ equipment: [{ name: "Grandpa's Rope", itemId: "rope" }] }, rope)).toBe(1);
  });

  it("keeps the satchel only for the same opening", () => {
    saveSatchel("eoghan", "o1", [{ itemId: "rope", qty: 2 }]);
    expect(loadSatchel("eoghan", "o1")).toEqual([{ itemId: "rope", qty: 2 }]);
    expect(loadSatchel("eoghan", "o2")).toEqual([]);
    saveSatchel("eoghan", "o1", []);
    expect(loadSatchel("eoghan", "o1")).toEqual([]);
  });

  it("puts the bubble beside the face when there's room, else on the other side", () => {
    const size = { width: 1144, height: 572, naturalWidth: 2000, naturalHeight: 1191 };
    expect(placeBubble(SCENES.mags, size).mode).toBe("right");
    expect(placeBubble(SCENES["fancy-2"], size).mode).toBe("left");
    expect(placeBubble(SCENES.mags, { ...size, width: 0 })).toBeNull();
  });
});
