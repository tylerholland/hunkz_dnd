import { describe, expect, it } from "vitest";
import { buildHighlights, buildTimeline, mergeLogSources, peopleIndex, rollKind } from "./chronicleData";

const t = (min) => new Date(Date.UTC(2026, 6, 23, 2, min)).toISOString();
const roll = (id, min, slug, expr, total, extra = {}) => ({ id, createdAt: t(min), slug, characterName: slug, paletteKey: "ocean", exprLabel: expr, total, rollValues: [total], ...extra });

describe("inferred timeline (sessions before HP/turn logging)", () => {
  const events = [
    roll("a1", 0, "meanjeans", "2d6 + 2", 9),
    roll("d1", 1, "meanjeans", "1d6", 6),
    roll("a2", 3, "quietclaw", "2d6 + 1", 5),
    roll("a3", 10, "meanjeans", "2d6 + 2", 11),
    roll("d2", 30, "quietclaw", "1d6", 2),
  ];
  const tl = buildTimeline(events, peopleIndex([], events));

  it("starts a new round when someone acts a second time, and orders turns", () => {
    expect(tl.rounds.map((r) => r.n)).toEqual([1, 2]);
    expect(tl.order).toEqual(["meanjeans", "quietclaw"]);
    expect(tl.roundsInferred).toBe(true);
  });

  it("pairs a damage roll with the same player's action just before it", () => {
    expect(tl.hits.map((h) => [h.amount, h.attributed])).toEqual([[6, true], [2, false]]);
    expect(tl.misses).toHaveLength(2); // quietclaw's and meanjeans' second action: no damage right after
    expect(tl.hpSeries).toEqual([]);
  });

  it("classifies roll kinds", () => {
    expect(rollKind({ exprLabel: "1d20 + 1" })).toBe("d20");
    expect(rollKind({ exprLabel: "2d6 + 2", label: "Strength Check" })).toBe("check");
    expect(rollKind({ type: "hp" })).toBe(null);
  });
});

describe("recorded timeline (HP, Take Action and turns logged)", () => {
  const players = [{ slug: "aesop", name: "Aesop", palette: "nightwood" }];
  const events = [
    { id: "t1", type: "turn", createdAt: t(0), round: 1, subject: { type: "character", sourceId: "aesop", name: "Aesop" } },
    { id: "h1", type: "hp", createdAt: t(1), subject: { type: "npc", sourceId: "gob", name: "Goblin" }, delta: -7, by: { type: "character", sourceId: "aesop", name: "Aesop" }, action: { name: "Unarmed Strike", crit: true } },
    { id: "h2", type: "hp", createdAt: t(2), subject: { type: "character", sourceId: "aesop", name: "Aesop" }, from: 20, to: 12, max: 27, delta: -8, by: { type: "npc", sourceId: "gob", name: "Goblin" } },
    { id: "t2", type: "turn", createdAt: t(3), round: 2, subject: { type: "character", sourceId: "aesop", name: "Aesop" } },
    { id: "h3", type: "hp", createdAt: t(4), subject: { type: "npc", sourceId: "gob", name: "Goblin" }, delta: 0, miss: true, by: { type: "character", sourceId: "aesop" } },
    { id: "h4", type: "hp", createdAt: t(5), subject: { type: "character", sourceId: "aesop", name: "Aesop" }, from: 12, to: 0, max: 27, delta: -12 },
  ];
  const people = peopleIndex(players, events);
  const tl = buildTimeline(events, people);

  it("uses logged rounds, hits, misses and HP", () => {
    expect(tl.roundsInferred).toBe(false);
    expect(tl.rounds.map((r) => r.n)).toEqual([1, 2]);
    expect(tl.hits.map((h) => [h.amount, h.attacker, h.crit])).toEqual([[7, "Aesop", true], [8, "Goblin", false], [12, null, false]]);
    expect(tl.misses).toHaveLength(1);
    expect(tl.hpSeries[0].points.map((p) => p.hp)).toEqual([20, 12, 0]);
    expect(tl.hpSeries[0].max).toBe(27);
  });

  it("highlights damage dealt and who went down", () => {
    const hl = Object.fromEntries(buildHighlights(events, people).map((h) => [h.key, h]));
    expect(hl.dealer.value).toBe(7);
    expect(hl.down.detail).toBe("Aesop");
  });
});

describe("mergeLogSources", () => {
  it("merges live, archive and snapshot without duplicates, oldest first", () => {
    const a = { id: "x", createdAt: t(5) };
    const b = { id: "y", createdAt: t(1) };
    expect(mergeLogSources([a], [b, a], null).map((e) => e.id)).toEqual(["y", "x"]);
  });
});
