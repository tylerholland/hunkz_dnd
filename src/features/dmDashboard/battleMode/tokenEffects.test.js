import { describe, expect, it } from "vitest";
import { MIN_TOKEN_SCREEN_PX, computeEffectivePx, tokenMinBoost } from "./tokenEffects";

describe("tokenMinBoost", () => {
  it("leaves tokens alone when they're already big enough on screen", () => {
    expect(tokenMinBoost(36)).toBe(1);
    expect(tokenMinBoost(MIN_TOKEN_SCREEN_PX)).toBe(1);
  });

  it("grows a small token just enough to stay visible when zoomed out", () => {
    const px = computeEffectivePx({ tokenScale: 1, mapTokenScale: 1, zoom: 0.4 }); // 14.4px
    const boost = tokenMinBoost(px);
    expect(px * boost).toBeGreaterThanOrEqual(MIN_TOKEN_SCREEN_PX - 1);
    expect(px * boost).toBeLessThan(MIN_TOKEN_SCREEN_PX + 2);
  });

  it("keeps a Colossal token at its true scale, so size differences still read", () => {
    const colossal = computeEffectivePx({ tokenScale: 6, mapTokenScale: 1, zoom: 0.4 });
    expect(tokenMinBoost(colossal)).toBe(1);
  });
});
