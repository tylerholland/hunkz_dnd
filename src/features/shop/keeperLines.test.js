import { describe, expect, it } from "vitest";
import { KEEPER_LINES, linesFor } from "./keeperLines";
import { KEEPERS, SHELF_IDS } from "./shopData";

const LISTS = ["greet", "pay", "add", "poor", "out", "putBack", "notToYou", "restock"];
const HAGGLE = ["crit2", "crit", "full", "partial", "miss", "holds", "refuse", "soldOut", "doneHaggling", "push1", "push2", "thrownOut"];
const nonEmpty = (v) => (Array.isArray(v) ? v.length > 0 && v.every((t) => typeof t === "string" && t.trim()) : typeof v === "string" && v.trim());

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
    expect([...used].every((p) => ["name", "item", "price", "time"].includes(p))).toBe(true);
  });

  it("falls back to Mags for an unknown keeper", () => {
    expect(linesFor("nobody")).toBe(KEEPER_LINES.mags);
  });
});
