import { describe, expect, it } from "vitest";
import { purposeGroups, purposeGuesses } from "./rollPurpose";

const attacks = [
  { kind: "weapon", name: "Longbow", toHit: "+5", damage: "1d8+3" },
  { kind: "weapon", name: "Dagger", toHit: "5", damage: "1d4+3" },
  { kind: "spell", name: "Hex", toHit: "+2", damage: "1d6" },
];

describe("purposeGuesses", () => {
  it("puts an exact damage match first", () => {
    expect(purposeGuesses({ expr: "1d8 + 3", attacks, inCombat: true })[0]).toBe("Longbow damage");
    expect(purposeGuesses({ expr: "1d6", attacks, inCombat: true })[0]).toBe("Hex damage");
  });
  it("matches a to-hit roll on its dice and bonus (spells on the table's spell dice)", () => {
    expect(purposeGuesses({ expr: "1d20+5", attacks, inCombat: true }).slice(0, 2)).toEqual(["Longbow attack", "Dagger attack"]);
    expect(purposeGuesses({ expr: "2d6+2", attacks, spellDice: "2d6", checkDice: "2d6", skills: ["stealth"] })[0]).toBe("Hex cast");
  });
  it("offers the character's skills for the check dice out of combat", () => {
    expect(purposeGuesses({ expr: "2d6+1", attacks, skills: ["stealth", "perception"], checkDice: "2d6" }).slice(0, 2)).toEqual(["Stealth check", "Perception check"]);
  });
  it("leads with damage for other dice in combat, and never repeats or runs long", () => {
    const g = purposeGuesses({ expr: "3d4", attacks, inCombat: true });
    expect(g[0]).toMatch(/damage$/);
    expect(new Set(g).size).toBe(g.length);
    expect(g.length).toBeLessThanOrEqual(4);
  });
});

describe("purposeGroups", () => {
  it("lists attacks, every skill and every save", () => {
    const groups = purposeGroups(attacks);
    expect(groups.map((g) => g.label)).toEqual(["Attacks", "Skills", "Saves"]);
    expect(groups[1].options).toHaveLength(18);
    expect(groups[2].options[1]).toEqual({ tag: "Dexterity save", text: "Dexterity" });
  });
});
