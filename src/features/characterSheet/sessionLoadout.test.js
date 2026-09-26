import { describe, expect, it } from "vitest";
import { applyDelta, normalizeCoin, parseQuickAdd, xpProgress } from "./sessionLoadout";

describe("sessionLoadout", () => {
  it("splits comma entries and parses trailing qty on equipment", () => {
    const items = parseQuickAdd(" Rope, Arrows x20 ,, Torch ×3", "equipment");
    expect(items.map(({ name, qty }) => ({ name, qty }))).toEqual([
      { name: "Rope", qty: undefined },
      { name: "Arrows", qty: 20 },
      { name: "Torch", qty: 3 },
    ]);
    expect(items[0]).toMatchObject({ description: "", mods: [], equipped: true });
    expect("qty" in items[0]).toBe(false);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it("keeps weapon names literal", () => {
    expect(parseQuickAdd("Dagger x2", "weapons")[0]).not.toHaveProperty("qty");
    expect(parseQuickAdd("Dagger x2", "weapons")[0].name).toBe("Dagger x2");
  });

  it("applies spend/gain/set and clamps at zero", () => {
    expect(applyDelta(12, "gain", 125)).toEqual({ value: 137, clamped: false });
    expect(applyDelta(12, "spend", 5)).toEqual({ value: 7, clamped: false });
    expect(applyDelta(12, "spend", 50)).toEqual({ value: 0, clamped: true });
    expect(applyDelta(12, "set", 40)).toEqual({ value: 40, clamped: false });
  });

  it("normalizes coin and reports XP progress", () => {
    expect(normalizeCoin({ gp: "5" })).toEqual({ cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 });
    expect(xpProgress(600, 2)).toMatchObject({ floor: 300, next: 900, pct: 0.5, ready: false });
    expect(xpProgress(950, 2).ready).toBe(true);
    expect(xpProgress(400000, 20).next).toBe(null);
  });
});
