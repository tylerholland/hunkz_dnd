import { describe, expect, it } from "vitest";
import { nearestSizeIndex, sizeLabel, stepTokenScale, SIZE_STEPS } from "./tokenSizes";

describe("tokenSizes", () => {
  it("offers 5e-labelled steps up to 6x", () => {
    expect(SIZE_STEPS).toEqual([0.5, 1, 2, 3, 4, 6]);
    expect(sizeLabel(2)).toBe("LARGE");
    expect(sizeLabel(4)).toBe("GARGANTUAN");
    expect(sizeLabel(6)).toBe("COLOSSAL");
  });

  it("steps between presets and stops at the ends", () => {
    expect(stepTokenScale(1, 1)).toBe(2);
    expect(stepTokenScale(4, 1)).toBe(6);
    expect(stepTokenScale(6, 1)).toBe(6);
    expect(stepTokenScale(0.5, -1)).toBe(0.5);
    expect(stepTokenScale(undefined, 1)).toBe(2);
  });

  it("moves a legacy 1.5x token to its neighbouring preset", () => {
    expect(stepTokenScale(1.5, 1)).toBe(2);
    expect(stepTokenScale(1.5, -1)).toBe(1);
    expect(SIZE_STEPS[nearestSizeIndex(1.5)]).toBe(1);
  });
});
