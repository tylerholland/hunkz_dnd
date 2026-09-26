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
