import { describe, expect, it } from "vitest";
import { buildStrikeEvents, collectTokenHits, isFreshStamp } from "./strikeEvents";

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

describe("chosen actions (lastFx)", () => {
  it("plays exactly the chosen action instead of guessing", () => {
    const fx = { at: "s5", kind: "damage", attacker: { type: "npc", sourceId: "ogre" }, style: "rock", crit: true };
    const [event] = buildStrikeEvents({ ...common, rolls: [], hits: [{ kind: "damage", token: tokens[0], stamp: "s5", fromRef: { type: "npc", sourceId: "gob" }, fx }] });
    expect(event).toMatchObject({ style: "rock", crit: true, miss: false, attackerId: "t-ogre", targetId: "t-eoghan" });
  });

  it("collects a fresh miss once, and pairs lastFx only with its own stamp", () => {
    const heal = new Map(), miss = new Map();
    const now = "2026-09-28T20:00:10.000Z";
    const token = tokens[1];
    const subject = (fx) => ({ lastDamagedAt: "2026-09-28T20:00:09.000Z", lastFx: fx });
    const missFx = { at: "2026-09-28T20:00:09.500Z", kind: "miss", attacker: { type: "character", sourceId: "eoghan" }, style: "cut" };
    expect(collectTokenHits({ token, subject: subject(null), damageFresh: false, serverTime: now, healSeen: heal, missSeen: miss })).toEqual([]);
    const hits = collectTokenHits({ token, subject: subject(missFx), damageFresh: true, serverTime: now, healSeen: heal, missSeen: miss });
    expect(hits.map((h) => h.kind)).toEqual(["damage", "miss"]);
    expect(hits[0].fx).toBe(null); // the damage stamp isn't the miss's stamp
    expect(collectTokenHits({ token, subject: subject(missFx), damageFresh: false, serverTime: now, healSeen: heal, missSeen: miss })).toEqual([]);
    const [ev] = buildStrikeEvents({ ...common, rolls: [], hits: [hits[1]] });
    expect(ev).toMatchObject({ miss: true, style: "cut", attackerId: "t-eoghan" });
  });
});

describe("spell effects on the map", () => {
  it("plays a fresh applied effect once, as its own curse/bless style", () => {
    const seen = new Map();
    const fx = { kind: "effect", at: "2026-10-08T02:00:00.000Z", style: "curse", effect: "Hexed", attacker: { type: "character", sourceId: "eoghan" } };
    const subject = { lastFx: fx };
    // First sight is history, not an event.
    expect(collectTokenHits({ token: tokens[2], subject, damageFresh: false, serverTime: fx.at, healSeen: new Map(), missSeen: seen })).toEqual([]);
    const next = { lastFx: { ...fx, at: "2026-10-08T02:00:05.000Z" } };
    const hits = collectTokenHits({ token: tokens[2], subject: next, damageFresh: false, serverTime: "2026-10-08T02:00:06.000Z", healSeen: new Map(), missSeen: seen });
    expect(hits.map((h) => h.kind)).toEqual(["effect"]);
    const [event] = buildStrikeEvents({ ...common, rolls: [], hits });
    expect(event).toMatchObject({ style: "curse", effect: true, attackerId: "t-eoghan", targetId: "t-ogre" });
  });
});
