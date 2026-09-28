import { describe, expect, it } from "vitest";
import { classifyStrike, hueFromHex, matchDeclaredAttack } from "./strikeRules";

describe("classifyStrike", () => {
  it("picks spell looks by name, forked bolt otherwise", () => {
    expect(classifyStrike({ attack: { kind: "spell", name: "Fire Bolt" } })).toBe("fire");
    expect(classifyStrike({ attack: { kind: "spell", name: "Eldritch Blast" } })).toBe("force");
    expect(classifyStrike({ attack: { kind: "spell", name: "Thunderwave" } })).toBe("force");
    expect(classifyStrike({ attack: { kind: "spell", name: "Hex" } })).toBe("bolt");
  });

  it("picks weapon looks by name", () => {
    expect(classifyStrike({ attack: { kind: "weapon", name: "Battleaxe" } })).toBe("chop");
    expect(classifyStrike({ attack: { kind: "weapon", name: "Unarmed Strike" } })).toBe("flurry");
    expect(classifyStrike({ attack: { kind: "weapon", name: "Longsword" } })).toBe("cut");
    expect(classifyStrike({ attack: { kind: "weapon", name: "Longbow" } })).toBe("arrow");
  });

  it("falls back to distance, and heals win", () => {
    expect(classifyStrike({ attack: null, adjacent: true })).toBe("cut");
    expect(classifyStrike({ attack: null, adjacent: false })).toBe("arrow");
    expect(classifyStrike({ attack: { kind: "weapon", name: "Mystery" }, adjacent: false })).toBe("arrow");
    expect(classifyStrike({ attack: { kind: "spell", name: "Fire Bolt" }, heal: true })).toBe("heal");
  });
});

describe("matchDeclaredAttack", () => {
  const at = "2026-09-27T20:00:30.000Z";
  const rolls = [
    { slug: "eoghan", attack: { kind: "spell", id: "hex", name: "Hex" }, target: { sourceId: "ogre" }, isCrit: true, createdAt: "2026-09-27T20:00:10.000Z" },
    { slug: "eoghan", attack: { kind: "spell", id: "hex", name: "Hex" }, target: { sourceId: "ogre" }, isCrit: false, createdAt: "2026-09-27T20:00:20.000Z" },
    { slug: "eoghan", attack: { kind: "weapon", id: "w1", name: "Longsword" }, target: { sourceId: "goblin" }, createdAt: "2026-09-27T20:00:25.000Z" },
    { slug: "liu", attack: { kind: "spell", id: "fb", name: "Fire Bolt" }, target: { sourceId: "ogre" }, createdAt: "2026-09-27T20:00:28.000Z" },
    { slug: "eoghan", label: "Free roll", createdAt: "2026-09-27T20:00:29.000Z" },
  ];

  it("prefers the attacker's newest roll aimed at this target, with crit from the attack roll", () => {
    expect(matchDeclaredAttack(rolls, { attackerSlug: "eoghan", targetSourceId: "ogre", at })).toEqual({ attack: rolls[1].attack, crit: true });
  });

  it("falls back to the newest declared attack, ignores other characters and old rolls", () => {
    expect(matchDeclaredAttack(rolls, { attackerSlug: "eoghan", targetSourceId: "wolf", at }).attack.name).toBe("Longsword");
    expect(matchDeclaredAttack(rolls, { attackerSlug: "eoghan", targetSourceId: "ogre", at: "2026-09-27T21:00:00.000Z" }).attack).toBe(null);
    expect(matchDeclaredAttack(rolls, { attackerSlug: null, targetSourceId: "ogre", at }).attack).toBe(null);
  });
});

describe("hueFromHex", () => {
  it("reads the hue of a palette accent", () => {
    expect(Math.round(hueFromHex("#6a8fa8"))).toBe(204); // ocean → blue
    expect(Math.round(hueFromHex("#5a8a60"))).toBe(128); // forest → green
    expect(hueFromHex("bad")).toBe(205);
  });
});
