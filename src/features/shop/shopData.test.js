import { describe, expect, it } from "vitest";
import { KEEPERS, SCENES, USUAL, SHELF_IDS, rollStock, rollMarkups, markedPrice, signFor, markupName } from "./shopData";

describe("shop data", () => {
  it("every keeper has a scene, a usual setup and three signs", () => {
    for (const key of Object.keys(KEEPERS)) {
      expect(SCENES[key]?.src).toMatch(/^\/art\/shop\/scenes\//);
      expect(USUAL[key].cats.every((c) => SHELF_IDS.includes(c))).toBe(true);
      expect(KEEPERS[key].names).toHaveLength(3);
    }
  });

  it("the stock roll favours staples", () => {
    const items = [{ id: "rope", price: 2 }, { id: "warhorse", price: 1000 }];
    expect(rollStock(items, "all", () => 0)).toEqual([]);
    // A roll of 0.1 is under "mostly full" for the warhorse (0.13 × 1.9) but not the rope (0.13 × 0.25).
    expect(rollStock(items, "full", () => 0.1)).toEqual(["warhorse"]);
  });

  it("markups roll within the level, in steps of five", () => {
    expect(Object.values(rollMarkups("high", () => 0))).toEqual(SHELF_IDS.map(() => 15));
    expect(Object.values(rollMarkups("cheap", () => 0.999))).toEqual(SHELF_IDS.map(() => 0));
    expect(markedPrice({ cat: "fancy", price: 20 }, { fancy: 25 })).toBe(25);
    expect(markupName(0)).toBe("list");
    expect(markupName(-10)).toBe("−10%");
  });

  it("a sign can be the keeper's own or the DM's", () => {
    expect(signFor("humble-1", { nameIdx: 1 }).name).toBe("The Muddy Boot");
    const own = signFor("shady-1", { custom: { name: "The Gilt Rat", where: "Hommlet · Back Alley" } });
    expect(own).toMatchObject({ keeperName: "Vesk", name: "The Gilt Rat", where: "Hommlet · Back Alley" });
    // The DM's own town replaces the sign's; a blank street keeps the sign's.
    expect(signFor("humble-1", { nameIdx: 0 }, { town: "Hobbiton", street: "" }).where).toBe("Hobbiton · By the Mill Pond");
    expect(signFor("humble-1", { nameIdx: 0 }, { town: "Hobbiton", street: "Bagshot Row" }).where).toBe("Hobbiton · Bagshot Row");
    expect(signFor("humble-1", { nameIdx: 0 }, {}).where).toBe("Millbrook · By the Mill Pond");
  });
});

describe("item art", () => {
  it("every item listed as having art has its picture in public/art/shop/items", async () => {
    const { existsSync } = await import("node:fs");
    const { ART_IDS, SHELF_ART } = await import("./shopData");
    const missing = [...ART_IDS, ...Object.values(SHELF_ART)].filter((id) => !existsSync(`public/art/shop/items/${id}.jpg`));
    expect(missing).toEqual([]);
  });
});
