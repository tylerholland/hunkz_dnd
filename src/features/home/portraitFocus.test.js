import { describe, expect, it } from "vitest";
import { DEFAULT_OBJECT_POSITION, focusObjectPosition, normalizeFocus } from "./portraitFocus";

describe("portraitFocus", () => {
  it("falls back to the default framing without a focus or a known image shape", () => {
    expect(focusObjectPosition(null, 1.5)).toBe(DEFAULT_OBJECT_POSITION);
    expect(focusObjectPosition({ x: 0.5, y: 0.3 }, 0)).toBe(DEFAULT_OBJECT_POSITION);
  });

  it("slides a wide image so the focus is centred", () => {
    // A landscape image (3:2) in a portrait box: only horizontal slack.
    expect(focusObjectPosition({ x: 0.5, y: 0.3 }, 1.5)).toBe("50.0% 50.0%");
    const [x] = focusObjectPosition({ x: 0.78, y: 0.3 }, 1.5).split(" ");
    expect(parseFloat(x)).toBeGreaterThan(80);
    expect(focusObjectPosition({ x: 1, y: 0.3 }, 1.5).startsWith("100.0%")).toBe(true);
  });

  it("slides a tall image so the focus sits at the orb's height", () => {
    // A tall image (1:2): only vertical slack; a face 20% down sits near the top.
    const [, y] = focusObjectPosition({ x: 0.5, y: 0.2 }, 0.5).split(" ");
    expect(parseFloat(y)).toBeLessThan(15);
  });

  it("rejects malformed focus and clamps the rest", () => {
    expect(normalizeFocus({ x: "a", y: 0.2 })).toBeNull();
    expect(normalizeFocus({ x: 1.4, y: -1 })).toEqual({ x: 1, y: 0 });
  });
});
