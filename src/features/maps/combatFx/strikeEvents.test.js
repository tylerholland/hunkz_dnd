import { describe, expect, it } from "vitest";
import { buildStrikeEvents, isFreshStamp } from "./strikeEvents";

const tokens = [
  { id: "t-eoghan", type: "character", sourceId: "eoghan", x: 0.30, y: 0.50 },
  { id: "t-goblin", type: "npc", sourceId: "gob", x: 0.33, y: 0.50 },
  { id: "t-ogre", type: "npc", sourceId: "ogre", x: 0.80, y: 0.50 },
];
const party = [{ slug: "eoghan", palette: "ocean" }];
const common = { tokens, party, imageW: 1000, imageH: 1000, mapTokenScale: 1 };

describe("buildStrikeEvents", () => {
  it("styles a declared spell in the caster's theme colour, with crit from the attack roll", () => {
    const rolls = [{ slug: "eoghan", attack: { kind: "spell", id: "hex", name: "Hex" }, target: { sourceId: "ogre" }, isCrit: true, createdAt: "2026-09-27T20:00:00.000Z" }];
    const [event] = buildStrikeEvents({ ...common, rolls, hits: [{ kind: "damage", token: tokens[2], stamp: "2026-09-27T20:00:05.000Z", fromRef: { type: "character", sourceId: "eoghan" } }] });
    expect(event).toMatchObject({ style: "bolt", crit: true, attackerId: "t-eoghan", targetId: "t-ogre", id: "damage|t-ogre|2026-09-27T20:00:05.000Z" });
    expect(Math.round(event.hue)).toBe(204); // ocean accent → blue
  });

  it("falls back to distance with no declared attack, and plays impact-only with no attacker token", () => {
    const [melee] = buildStrikeEvents({ ...common, rolls: [], hits: [{ kind: "damage", token: tokens[1], stamp: "s1", fromRef: { type: "character", sourceId: "eoghan" } }] });
    expect(melee.style).toBe("cut");
    const [ranged] = buildStrikeEvents({ ...common, rolls: [], hits: [{ kind: "damage", token: tokens[2], stamp: "s2", fromRef: { type: "character", sourceId: "eoghan" } }] });
    expect(ranged.style).toBe("arrow");
    const [orphan] = buildStrikeEvents({ ...common, rolls: [], hits: [{ kind: "damage", token: tokens[2], stamp: "s3", fromRef: null }] });
    expect(orphan.attackerId).toBe(null);
  });

  it("heals are heals", () => {
    const [heal] = buildStrikeEvents({ ...common, rolls: [], hits: [{ kind: "heal", token: tokens[0], stamp: "s4", fromRef: { type: "character", sourceId: "eoghan" } }] });
    expect(heal).toMatchObject({ style: "heal", crit: false, id: "heal|t-eoghan|s4" });
  });
});

describe("isFreshStamp", () => {
  it("never fires on first sight, fires once for a new recent stamp", () => {
    const seen = new Map();
    const now = "2026-09-27T20:00:10.000Z";
    expect(isFreshStamp("t", "2026-09-27T20:00:00.000Z", now, seen)).toBe(false); // first paint
    expect(isFreshStamp("t", "2026-09-27T20:00:08.000Z", now, seen)).toBe(true);
    expect(isFreshStamp("t", "2026-09-27T20:00:08.000Z", now, seen)).toBe(false); // same stamp again
    expect(isFreshStamp("t", "2026-09-27T19:00:00.000Z", now, seen)).toBe(false); // too old
  });
});
