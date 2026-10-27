import { describe, expect, it } from "vitest";
import { DEFAULT_MONEY, normalizeMoney, shownCoins, purseWorth, mixedPurse } from "./money";

describe("table money", () => {
  it("defaults to silver and gold, gold worth 10", () => {
    expect(normalizeMoney(undefined)).toEqual(DEFAULT_MONEY);
    expect(normalizeMoney({ coins: { sp: { on: false } } }).coins.sp.on).toBe(true);
  });

  it("shows silver first, then the other coins in use — and any coin someone holds", () => {
    expect(shownCoins({ sp: 49 })).toEqual(["sp", "gp"]);
    expect(shownCoins({ sp: 1, cp: 3 })).toEqual(["sp", "gp", "cp"]);
    expect(shownCoins({}, { coins: { gp: { on: false } } })).toEqual(["sp"]);
  });

  it("totals a purse in silver, and only calls it mixed when it is", () => {
    expect(purseWorth({ sp: 9, gp: 2 })).toBe(29);
    expect(purseWorth({ sp: 9, gp: 2 }, { coins: { gp: { on: true, rate: 50 } } })).toBe(109);
    expect(mixedPurse({ sp: 49, gp: 0 })).toBe(false);
    expect(mixedPurse({ sp: 9, gp: 2 })).toBe(true);
  });
});
