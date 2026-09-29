import { describe, expect, it } from "vitest";
import { npcCombatCaughtUp, stripNpcServerStamps } from "./npcServerStamps";

describe("NPC catch-up after an optimistic DM write", () => {
  it("ignores every server-only last* stamp", () => {
    const server = [{ id: "n1", hpCurrent: 4, lastDamagedAt: "t", lastDamageAmount: 3, lastDamageFrom: {}, lastHealedAt: "t", lastHealAmount: 1, lastHealFrom: {}, lastFx: { style: "cut" } }];
    expect(stripNpcServerStamps(server)).toEqual([{ id: "n1", hpCurrent: 4 }]);
  });

  it("matches when the server returns the same NPC with its fields in a different order", () => {
    const expected = [{ id: "n1", name: "Carrion", hpCurrent: 70, conditions: ["Prone"], abilities: [] }];
    const server = [{ abilities: [], lastDamagedAt: "t", conditions: ["Prone"], hpCurrent: 70, id: "n1", name: "Carrion", notes: [] }];
    expect(npcCombatCaughtUp(server, expected)).toBe(true);
  });

  it("waits while the server still has the old HP", () => {
    expect(npcCombatCaughtUp([{ id: "n1", hpCurrent: 80 }], [{ id: "n1", hpCurrent: 70 }])).toBe(false);
    expect(npcCombatCaughtUp([], [{ id: "n1", hpCurrent: 70 }])).toBe(false);
  });
});
