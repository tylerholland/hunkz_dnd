import { describe, expect, it } from "vitest";

import { buildCharacterRollPayload, buildLocalRollHistoryEntry } from "./rollHistory";

describe("roll history helpers", () => {
  it("builds a character roll payload from rolled groups without losing the dice counts", () => {
    const payload = buildCharacterRollPayload({
      label: "Stick ATK",
      result: {
        groups: [{ sides: 20, rolls: [4] }],
        flat: 1,
        total: 5,
        isCrit: false,
        isFumble: false,
        advKept: null,
        advDiscarded: null,
      },
    });

    expect(payload).toMatchObject({
      exprLabel: "1d20 + 1",
      label: "Stick ATK",
      total: 5,
      rollValues: [4],
    });
  });

  it("normalizes free-roll labels and keeps the die array in local history entries", () => {
    const entry = buildLocalRollHistoryEntry({
      id: "roll-1",
      label: "Free roll",
      result: {
        groups: [{ sides: 6, rolls: [2, 4, 1] }],
        flat: 0,
        total: 7,
        isCrit: false,
        isFumble: false,
      },
    });

    expect(entry).toMatchObject({
      exprLabel: "3d6",
      label: "Free Roll",
      total: 7,
      rollValues: [2, 4, 1],
    });
  });
});
