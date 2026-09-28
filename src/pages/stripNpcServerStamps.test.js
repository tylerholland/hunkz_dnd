import { describe, expect, it } from "vitest";
import { stripNpcServerStamps } from "./npcServerStamps";

describe("stripNpcServerStamps", () => {
  it("ignores every server-only last* stamp so optimistic NPC state can catch up", () => {
    const server = [{ id: "n1", hpCurrent: 4, lastDamagedAt: "t", lastDamageAmount: 3, lastDamageFrom: {}, lastHealedAt: "t", lastHealAmount: 1, lastHealFrom: {}, lastFx: { style: "cut" } }];
    expect(stripNpcServerStamps(server)).toEqual([{ id: "n1", hpCurrent: 4 }]);
  });
});
