import { describe, expect, it } from "vitest";
import {
  attackHits, chanceToReach, changedFromTemplate, defenseLabel, guessLook, lookAnimation,
  normalizeAttacks, normalizeDefense, rollDice, statsFromTemplate,
} from "./npcStats";

const CRAWLER = {
  defense: { kind: "ac", ac: 13 },
  attacks: [
    { id: "t", name: "Tentacles", hit: "1d20+8", damage: "1d4+2", look: "lash" },
    { id: "b", name: "Bite", hit: "1d20+4", damage: "2d4+2", look: "bite" },
  ],
};

describe("npcStats", () => {
  it("guesses a look from the attack's name, and plays a near animation for creature looks", () => {
    expect(guessLook("Tentacles")).toBe("lash");
    expect(guessLook("Poison Bite")).toBe("bite");
    expect(guessLook("Greataxe")).toBe("chop");
    expect(guessLook("Mystery")).toBe("cut");
    expect(lookAnimation("lash")).toBe("cut");
    expect(lookAnimation("breath")).toBe("fire");
    expect(lookAnimation("arrow")).toBe("arrow");
  });

  it("cleans defense and attacks, dropping ones that can't be rolled", () => {
    expect(normalizeDefense({ kind: "roll", roll: "1d20 + 3", name: "Dodge" })).toEqual({ kind: "roll", roll: "1d20+3", name: "Dodge" });
    expect(normalizeDefense({ kind: "ac", ac: "15" })).toEqual({ kind: "ac", ac: 15 });
    expect(normalizeDefense({ kind: "roll", roll: "?" })).toBeNull();
    expect(normalizeAttacks([{ name: "Claw", hit: "1d20+5", damage: "1d6+3", look: "nope" }, { name: "x", hit: "", damage: "1d4" }]))
      .toEqual([{ id: "atk-1", name: "Claw", hit: "1d20+5", damage: "1d6+3", look: "cut" }]);
  });

  it("copies a creature's stats to an NPC and notices when one is changed", () => {
    const npc = { name: "Crawler 1", ...statsFromTemplate(CRAWLER) };
    expect(changedFromTemplate(npc, CRAWLER)).toBe(false);
    expect(changedFromTemplate({ ...npc, defense: { kind: "ac", ac: 15 } }, CRAWLER)).toBe(true);
    expect(statsFromTemplate({ name: "Rat" })).toEqual({});
  });

  it("works out hit chances exactly, and hits as D&D does", () => {
    expect(chanceToReach("1d20+8", 12)).toBe(85);
    expect(chanceToReach("1d20+4", 15)).toBe(50);
    expect(chanceToReach("2d6", 12)).toBe(3);
    // Meeting the AC hits; a defense roll is a contest — ties go to the defender.
    expect(attackHits(13, { kind: "ac", ac: 13 })).toBe(true);
    expect(attackHits(12, { kind: "ac", ac: 13 })).toBe(false);
    expect(attackHits(14, { kind: "roll", roll: "1d20+3" }, 14)).toBe(false);
    expect(attackHits(15, { kind: "roll", roll: "1d20+3" }, 14)).toBe(true);
    expect(attackHits(15, { kind: "roll", roll: "1d20+3" })).toBeNull();
    expect(defenseLabel({ kind: "roll", roll: "1d20+3", name: "Dodge" })).toBe("Dodge 1d20+3");
  });

  it("rolls an expression", () => {
    expect(rollDice("1d20+8", () => 10)).toEqual({ total: 18, rolls: [10] });
    expect(rollDice("nonsense")).toBeNull();
  });
});

describe("abilities as one list", () => {
  it("reads old strings and attacks, and finds the rollable ones", async () => {
    const { abilitiesOf, rollableAbilities, abilityText } = await import("./npcStats");
    const old = { abilities: ["Keen Smell: advantage on smell checks", "Spider Climb"], attacks: [{ id: "t", name: "Tentacles", hit: "1d20+8", damage: "1d4+2", look: "lash" }] };
    expect(abilitiesOf(old)).toEqual([
      { id: "ab-1", name: "Keen Smell", notes: "advantage on smell checks" },
      { id: "ab-2", name: "Spider Climb" },
      { id: "t", name: "Tentacles", roll: { hit: "1d20+8", damage: "1d4+2", look: "lash" } },
    ]);
    expect(rollableAbilities(old).map((a) => a.name)).toEqual(["Tentacles"]);
    expect(abilityText(abilitiesOf(old)[0])).toBe("Keen Smell: advantage on smell checks");
  });
});
