import { describe, expect, it } from "vitest";
import { groupHpUnderRolls } from "./rollHistory";

describe("groupHpUnderRolls", () => {
  it("tucks an HP change under the roll that caused it; others stay as rows", () => {
    const entries = [
      { id: "hp1", type: "hp", rollId: "r1", delta: -3 },
      { id: "r1", label: "Shank DMG", total: 3 },
      { id: "hp2", type: "hp", delta: 5 },
      { id: "hp3", type: "hp", rollId: "gone", delta: -1 }, // its roll isn't in view
    ];
    const { list, outcomes } = groupHpUnderRolls(entries);
    expect(list.map((e) => e.id)).toEqual(["r1", "hp2", "hp3"]);
    expect(outcomes.get("r1").map((e) => e.id)).toEqual(["hp1"]);
  });
});

describe("buildDiceExprLabel", () => {
  it("writes a flat bonus with one sign", async () => {
    const { buildDiceExprLabel } = await import("./rollHistory");
    expect(buildDiceExprLabel([{ count: 2, sides: 6 }], 2)).toBe("2d6+2");
    expect(buildDiceExprLabel([{ count: 1, sides: 20 }], -1)).toBe("1d20-1");
    expect(buildDiceExprLabel([{ count: 1, sides: 4 }, { count: 1, sides: 6 }], 0)).toBe("1d4+1d6");
  });
});
