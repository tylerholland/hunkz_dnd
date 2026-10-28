import { describe, expect, it } from "vitest";
import { normalizeInitiativeUpdate } from "./dashboardShared";

describe("normalizeInitiativeUpdate", () => {
  const entries = [{ id: "a" }, { id: "b" }];

  it("keeps an explicit round from the caller (next-turn wrap)", () => {
    expect(normalizeInitiativeUpdate({ entries, activeTurnIndex: 0, round: 3 }, 2)).toEqual({
      entries,
      activeTurnIndex: 0,
      round: 3,
    });
  });

  it("carries the latest known round when the caller omits it", () => {
    expect(normalizeInitiativeUpdate({ entries, activeTurnIndex: 1 }, 4).round).toBe(4);
  });

  it("defaults to round 1 when nothing is known", () => {
    expect(normalizeInitiativeUpdate({}, undefined)).toEqual({ entries: [], activeTurnIndex: 0, round: 1 });
  });
});

describe("getPartyCardPalette — a vellum character on a dark dashboard", () => {
  it("gives the portrait a dark ring, not the pale parchment surface", async () => {
    const { getPartyCardPalette } = await import("./dashboardShared");
    const { PALETTES } = await import("../characterSheet/theme");
    const card = getPartyCardPalette(PALETTES.vellum, PALETTES.ocean);
    const [r, g, b] = card.portraitRing.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16));
    expect((r + g + b) / 3).toBeLessThan(80);
    // Dark palettes keep their usual ring (no override).
    expect(getPartyCardPalette(PALETTES.ember, PALETTES.ocean).portraitRing).toBeUndefined();
  });
});
