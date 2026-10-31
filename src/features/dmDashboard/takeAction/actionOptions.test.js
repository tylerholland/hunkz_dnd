import { describe, expect, it } from "vitest";
import { actionGroups, characterActions, isDealableRoll, rollDiceExpr } from "./actionOptions";

describe("rollDiceExpr", () => {
  it("rolls, totals and labels; a crit doubles the dice, not the modifier", () => {
    const fixed = () => 3;
    expect(rollDiceExpr("2d6+2", { roll: fixed })).toMatchObject({ exprLabel: "2d6+2", rollValues: [3, 3], total: 8 });
    expect(rollDiceExpr("2d6+2", { crit: true, roll: fixed })).toMatchObject({ exprLabel: "4d6+2", total: 14 });
    expect(rollDiceExpr("7")).toBe(null);
    expect(rollDiceExpr("")).toBe(null);
  });
});

describe("actions", () => {
  const monk = {
    slug: "aesop", charClass: "Monk", level: 5,
    stats: [{ stat: "Strength", score: 10 }, { stat: "Dexterity", score: 16 }],
    weapons: [{ id: "w1", name: "Dart", mods: [{ attribute: "Attack Bonus", value: "+6" }, { attribute: "Damage", value: "1d4+3" }] }],
    spells: [{ id: "s1", name: "Fire Bolt", role: "attack", damage: "1d10" }],
  };

  it("gives a player their weapons, Unarmed Strike and attack spells, each with a look", () => {
    const list = characterActions(monk);
    expect(list.map((a) => [a.name, a.style])).toEqual([["Dart", "arrow"], ["Unarmed Strike", "flurry"], ["Fire Bolt", "fire"]]);
    expect(list[0]).toMatchObject({ toHit: "+6", dice: "1d4+3" });
  });

  it("groups NPC presets with Heal and Magic", () => {
    const npc = actionGroups({ type: "npc" });
    expect(npc.primary.map((a) => a.name)).toEqual(["Unarmed Strike", "Swing Sword", "Throw Rock", "Fire Arrow"]);
    expect(npc.magic.map((a) => a.style)).toEqual(["fire", "force", "bolt"]);
    expect(npc.heal.heal).toBe(true);
    const pc = actionGroups({ type: "character", member: monk });
    expect(pc.spells.map((a) => a.name)).toEqual(["Fire Bolt"]);
    expect(pc.magic).toEqual([]);
  });
});

describe("isDealableRoll", () => {
  const roll = { source: "character", slug: "aesop", label: "Dart DMG", target: { sourceId: "gob" }, attack: { id: "w1", name: "Dart" } };
  it("only offers Deal Damage on a player's targeted damage roll", () => {
    expect(isDealableRoll(roll)).toBe(true);
    expect(isDealableRoll({ ...roll, label: "Dart ATK" })).toBe(false);
    expect(isDealableRoll({ ...roll, target: undefined })).toBe(false);
    expect(isDealableRoll({ ...roll, source: "dm" })).toBe(false);
  });
});

describe("NPC attacks in Take Action", () => {
  it("lists a creature's own attacks first, with their attack roll and look", async () => {
    const { actionGroups, toHitExpr } = await import("./actionOptions");
    const groups = actionGroups({ type: "npc", npc: { attacks: [{ id: "t", name: "Tentacles", hit: "1d20+8", damage: "1d4+2", look: "lash" }] } });
    expect(groups.own).toEqual([{ id: "own-t", name: "Tentacles", hit: "1d20+8", dice: "1d4+2", look: "lash", style: "cut", own: true }]);
    expect(groups.primary.length).toBeGreaterThan(0);
    expect(actionGroups({ type: "npc", npc: {} }).own).toEqual([]);
    expect(toHitExpr("+5")).toBe("1d20+5");
    expect(toHitExpr("-1")).toBe("1d20-1");
    expect(toHitExpr("")).toBe("1d20");
  });

  it("finds the to-hit roll that went with a player's damage roll", async () => {
    const { toHitRollFor } = await import("./actionOptions");
    const atk = (total, at, attack = { id: "dagger", name: "Dagger" }) => ({ slug: "eoghan", label: "Dagger ATK", total, createdAt: at, target: { type: "npc", sourceId: "crawler" }, attack });
    const rolls = [atk(9, "2026-10-30T10:00:00Z"), atk(15, "2026-10-30T10:01:00Z"), atk(18, "2026-10-30T10:03:00Z")];
    const damage = { slug: "eoghan", label: "Dagger DMG", createdAt: "2026-10-30T10:02:00Z", target: { sourceId: "crawler" }, attack: { id: "dagger", name: "Dagger" } };
    expect(toHitRollFor(rolls, damage).total).toBe(15);
  });
});
