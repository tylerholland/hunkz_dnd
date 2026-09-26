import { describe, expect, it } from "vitest";
import { resolveMapBandOpen } from "./sessionMapBand";

describe("resolveMapBandOpen", () => {
  it("defaults open in combat and collapsed otherwise", () => {
    expect(resolveMapBandOpen(null, true)).toBe(true);
    expect(resolveMapBandOpen(null, false)).toBe(false);
  });

  it("honours the player's toggle within the same mode", () => {
    expect(resolveMapBandOpen({ open: false, combat: true }, true)).toBe(false);
    expect(resolveMapBandOpen({ open: true, combat: false }, false)).toBe(true);
  });

  it("falls back to the new mode's default when combat mode flips", () => {
    expect(resolveMapBandOpen({ open: false, combat: false }, true)).toBe(true);
    expect(resolveMapBandOpen({ open: true, combat: true }, false)).toBe(false);
  });
});
