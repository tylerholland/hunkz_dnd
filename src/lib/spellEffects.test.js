import { describe, expect, it } from "vitest";
import { isCurseEffect, isHelpfulEffect, isSpellEffect, spellEffect } from "./spellEffects";
import { conditionStyle } from "../features/dmDashboard/dashboardShared";
import { getBadgeEligibleConditions } from "../features/dmDashboard/battleMode/tokenEffects";

describe("spell effects", () => {
  it("are recognised by name, case-insensitively, and split helpful / curse", () => {
    expect(isHelpfulEffect("blessed")).toBe(true);
    expect(isCurseEffect("Hexed")).toBe(true);
    expect(isSpellEffect("Poisoned")).toBe(false);
    expect(spellEffect("Marked").help).toMatch(/Hunter's Mark/);
  });

  it("get gold / violet pills and sort after the conditions that matter more", () => {
    expect(conditionStyle("Blessed").color).toBe("#ecc970");
    expect(conditionStyle("Hexed").color).toBe("#cda2f2");
    const order = getBadgeEligibleConditions(["Blessed", "Poisoned", "Hexed", "Stunned"], 0).map((c) => c.name);
    expect(order).toEqual(["Stunned", "Hexed", "Poisoned", "Blessed"]);
  });
});
