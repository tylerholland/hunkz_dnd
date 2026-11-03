import { describe, expect, it } from "vitest";
import { catalogToCsv, parseCsv, csvToItems, diffCatalog } from "./shopCsv";
import { SHELF_IDS } from "./shopData";

const items = [
  { id: "lantern", name: "Lantern", cat: "fancy", price: 20 },
  { id: "fire-oil", name: "Fire Oil (flask)", cat: "fancy", price: 20, stat: "d6+1 / round, 3 rounds", notes: 'Sets an area "alight".' },
  { id: "warhorse", name: "Warhorse", cat: "travel", price: 1000, hidden: true },
];

describe("catalog CSV", () => {
  it("round-trips through export and import", () => {
    const csv = catalogToCsv(items);
    expect(csv.split("\n")[0]).toBe("id,name,category,price,per,effect,notes,shown,class,dnd,units");
    expect(csvToItems(csv, SHELF_IDS)).toEqual({ items, errors: [] });
  });

  it("carries weapon classes, 5e dice and sets, and an older file keeps them", () => {
    const weapons = [{ id: "dagger", name: "Dagger", cat: "arms", price: 10, stat: "d6", tier: "light", dnd: "1d4" }, { id: "torches", name: "Torches", cat: "gear", price: 2, units: 4 }];
    expect(csvToItems(catalogToCsv(weapons), SHELF_IDS).items).toEqual(weapons);
    const old = csvToItems("id,name,category,price\ndagger,Dagger,arms,12", SHELF_IDS).items;
    expect(diffCatalog(weapons, old).changed).toEqual([{ item: old[0], fields: ["price", "stat"] }]);
  });

  it("parses quotes, commas and newlines inside cells", () => {
    expect(parseCsv('a,"b, c","d ""e""\nf"\r\n1,2,3')).toEqual([["a", "b, c", 'd "e"\nf'], ["1", "2", "3"]]);
  });

  it("reports bad rows and makes ids from names", () => {
    const { items: got, errors } = csvToItems("Name,Category,Price\nSilvered Dagger,arms,25\nOddity,nowhere,3\nCheap,gear,free", SHELF_IDS);
    expect(got).toEqual([{ id: "silvered-dagger", name: "Silvered Dagger", cat: "arms", price: 25 }]);
    expect(errors).toHaveLength(2);
  });

  it("shows what an import would change", () => {
    const incoming = [{ ...items[0], price: 15 }, items[1], { id: "map", name: "Map of the Sewers", cat: "gear", price: 15 }];
    const { added, changed, missing } = diffCatalog(items, incoming);
    expect(added.map((i) => i.id)).toEqual(["map"]);
    expect(changed).toEqual([{ item: incoming[0], fields: ["price"] }]);
    expect(missing.map((i) => i.id)).toEqual(["warhorse"]);
  });
});
