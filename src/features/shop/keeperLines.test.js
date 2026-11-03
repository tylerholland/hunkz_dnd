import { describe, expect, it } from "vitest";
import { KEEPER_LINES, byMood, linesFor } from "./keeperLines";
import { KEEPERS, SHELF_IDS } from "./shopData";

const LISTS = ["greet", "pay", "add", "poor", "out", "putBack", "notToYou", "restock"];
const HAGGLE = ["crit2", "crit", "full", "partial", "miss", "holds", "refuse", "soldOut", "doneHaggling", "push1", "push2", "thrownOut"];
const nonEmpty = (v) => (v && !Array.isArray(v) && typeof v === "object" ? nonEmpty(v.warm) && nonEmpty(v.cool) : Array.isArray(v) ? v.length > 0 && v.every((t) => typeof t === "string" && t.trim()) : typeof v === "string" && v.trim());

describe("keeper lines", () => {
  it("every keeper has their own line for every moment", () => {
    for (const key of Object.keys(KEEPERS)) {
      const v = KEEPER_LINES[key];
      expect(v, key).toBeTruthy();
      for (const k of LISTS) expect(nonEmpty(v[k]), `${key}.${k}`).toBeTruthy();
      expect(nonEmpty(v.lockup), `${key}.lockup`).toBeTruthy();
      for (const k of ["closed", "backSoon", "fight", "thrown"]) expect(nonEmpty(v.plaques[k]), `${key}.plaques.${k}`).toBeTruthy();
      for (const s of SHELF_IDS) expect(nonEmpty(v.shelf[s]), `${key}.shelf.${s}`).toBeTruthy();
      for (const h of HAGGLE) expect(nonEmpty(v.haggle[h]), `${key}.haggle.${h}`).toBeTruthy();
      for (const s of ["offer", "sold", "wontBuy", "notBuying"]) expect(nonEmpty(v.sell[s]), `${key}.sell.${s}`).toBeTruthy();
    }
  });

  it("only uses placeholders the shop fills in", () => {
    const all = JSON.stringify(KEEPER_LINES);
    const used = new Set([...all.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    expect([...used].every((p) => ["name", "race", "class", "a_race", "A_race", "a_class", "A_class", "item", "price", "time", "town"].includes(p))).toBe(true);
  });

  it("warm or cool lines follow the shopper's read of the mood", () => {
    const list = { warm: ["nice"], cool: ["frosty"] };
    expect(byMood(list, "easy")).toEqual(["nice"]);
    expect(byMood(list, undefined)).toEqual(["nice"]);
    expect(byMood(list, "testy")).toEqual(["frosty"]);
    expect(byMood(["plain"], "done")).toEqual(["plain"]);
  });

  it("Master Quibb has a word on every piece in the catalog", async () => {
    const src = (await import("../../../backend/src/lib/shop.js?raw")).default;
    const ids = [...src.slice(src.indexOf("const SEED_ITEMS"), src.indexOf("];", src.indexOf("const SEED_ITEMS"))).matchAll(/(?:id: |weapon\()"([^"]+)"/g)].map((m) => m[1]);
    const missing = ids.filter((id) => !KEEPER_LINES["fancy-2"].items[id]);
    expect(missing).toEqual([]);
  });

  it("falls back to Mags for an unknown keeper", () => {
    expect(linesFor("nobody")).toBe(KEEPER_LINES.mags);
  });
});

describe("fillLine", () => {
  it("fills every placeholder in every keeper's lines, with or without a shopper", async () => {
    const { fillLine } = await import("./keeperLines");
    const all = (v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(all) : v && typeof v === "object" ? Object.values(v).flatMap(all) : []);
    const vars = { item: "rope", price: "2s", time: "9pm" };
    const shoppers = [null, { name: "Eòghan", race: "Firbolg", charClass: "Warlock (Fuath)" }, { name: "Aesop", race: "Elf", charClass: "Ranger" }];
    for (const lines of Object.values(KEEPER_LINES)) {
      for (const text of all(lines)) {
        for (const character of shoppers) expect(fillLine(text, { character, town: "Greyhawk", vars })).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("reads naturally with no shopper (the DM's page) and with one", async () => {
    const { fillLine } = await import("./keeperLines");
    expect(fillLine("{A_race}! Come in — I've stock that'll fit ye.")).toBe("A traveller! Come in — I've stock that'll fit ye.");
    expect(fillLine("{A_race}! Come in.", { character: { race: "Elf" } })).toBe("An elf! Come in.");
  });
});
