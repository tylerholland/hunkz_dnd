import { describe, expect, it } from "vitest";
import { presenceLabel, presenceState } from "./presence";

const now = "2026-11-05T10:00:00.000Z";
const ago = (min) => new Date(Date.parse(now) - min * 60000).toISOString();

describe("who's here", () => {
  it("stays green through quiet minutes, then yellow, then gray", () => {
    expect(presenceState(ago(0), now)).toBe("on");
    expect(presenceState(ago(4.9), now)).toBe("on");
    expect(presenceState(ago(6), now)).toBe("recent");
    expect(presenceState(ago(29), now)).toBe("recent");
    expect(presenceState(ago(31), now)).toBe("away");
    expect(presenceState(undefined, now)).toBe("away");
  });

  it("says it in words, judged by the server's clock", () => {
    expect(presenceLabel("Aesop", ago(1), now)).toBe("Aesop · online");
    expect(presenceLabel("Aesop", ago(12), now)).toBe("Aesop · last here 12 min ago");
    expect(presenceLabel("Aesop", ago(90), now)).toBe("Aesop · away");
    expect(presenceLabel("Aesop", null, now)).toBe("Aesop · not seen yet");
  });
});
