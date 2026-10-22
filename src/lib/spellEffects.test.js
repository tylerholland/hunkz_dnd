import { afterEach, describe, expect, it } from "vitest";
import { allSpellEffects, ridersFor, setCustomEffects, spellEffect } from "./spellEffects";

afterEach(() => setCustomEffects([]));

describe("spell effect riders (Story 70)", () => {
  const sources = { Hexed: { type: "character", sourceId: "eoghan", spell: "Hex" }, Marked: { type: "character", sourceId: "liu-sha" } };

  it("gives the caster their own effect's rider, and nobody else's", () => {
    expect(ridersFor({ conditions: ["Hexed", "Marked", "Prone"], sources, attackerSlug: "eoghan" }))
      .toEqual([{ effect: "Hexed", dice: "1d6", label: "Hex", type: "necrotic" }]);
    expect(ridersFor({ conditions: ["Hexed", "Marked"], sources, attackerSlug: "liu-sha" }))
      .toEqual([{ effect: "Marked", dice: "1d6", label: "Mark" }]);
    expect(ridersFor({ conditions: ["Hexed"], sources: {}, attackerSlug: "eoghan" })).toEqual([]); // applied by hand: no caster
  });
});

describe("custom effects", () => {
  it("joins the effect list with its kind, without shadowing a built-in", () => {
    setCustomEffects([{ name: "Covered in slime", kind: "curse" }, { name: "hexed", kind: "helpful" }, { name: "Blur" }]);
    expect(spellEffect("covered in SLIME")).toMatchObject({ kind: "curse", custom: true });
    expect(spellEffect("Hexed").kind).toBe("curse");
    expect(spellEffect("Blur").kind).toBe("neutral");
    expect(allSpellEffects().map((e) => e.name)).toContain("Flying");
    setCustomEffects([]);
    expect(spellEffect("Covered in slime")).toBeNull();
  });
});
