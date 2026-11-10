import { describe, expect, it } from "vitest";
import { buildStory, hitSeverity } from "./storyLines";

const at = (min) => new Date(Date.UTC(2026, 10, 9, 21, min)).toISOString();
const text = (item) => item.parts.map((p) => (typeof p === "string" ? p : p.t === "num" ? ` [${p.s}]` : p.s)).join("");
const lines = (entries, opts) => buildStory(entries, opts).filter((i) => i.kind === "line").map(text);

const atk = { id: "r1", slug: "liu", characterName: "Liu Sha", label: "Longbow ATK", total: 18, attack: { kind: "weapon", id: "w1", name: "Longbow" }, target: { name: "Goblin Boss" }, createdAt: at(1) };
const dmg = { id: "r2", slug: "liu", characterName: "Liu Sha", label: "Longbow DMG", total: 7, attack: { kind: "weapon", id: "w1", name: "Longbow" }, target: { name: "Goblin Boss" }, createdAt: at(2) };
const hit = { id: "h1", type: "hp", rollId: "r2", subject: { type: "npc", sourceId: "g", name: "Goblin Boss" }, delta: -7, createdAt: at(2) };

describe("buildStory", () => {
  it("tells an attack and its damage as one line, with numbers only for your own", () => {
    expect(lines([dmg, atk, hit], { viewerSlug: "eoghan" })).toEqual(["Liu Sha attacked Goblin Boss with a Longbow… and hit."]);
    expect(lines([dmg, atk, hit], { viewerSlug: "liu" })).toEqual(["You attacked Goblin Boss with a Longbow… and hit. [18 to hit · 7 damage]"]);
    expect(lines([dmg, atk, hit], { viewerSlug: "liu", numbers: "none" })).toEqual(["You attacked Goblin Boss with a Longbow… and hit."]);
  });

  it("says when an attack missed", () => {
    const miss = { id: "h2", type: "hp", rollId: "r1", miss: true, subject: { type: "npc", sourceId: "g", name: "Goblin Boss" }, delta: 0, createdAt: at(1) };
    expect(lines([atk, miss], { viewerSlug: "x" })).toEqual(["Liu Sha attacked Goblin Boss with a Longbow… and missed."]);
  });

  it("words a hit on a party member by how much it hurt, with a short name", () => {
    const hurt = { id: "h3", type: "hp", subject: { type: "character", sourceId: "q", name: '"The Sound of a Hearthfire Burning" Quietclaw' }, delta: -12, max: 24, by: { name: "Ogre" }, action: { name: "Greatclub" }, createdAt: at(3) };
    expect(lines([hurt], { viewerSlug: "x" })).toEqual(["Quietclaw took a brutal hit from Ogre's Greatclub."]);
    expect(lines([hurt], { viewerSlug: "q" })).toEqual(["You took a brutal hit from Ogre's Greatclub. [−12]"]);
    expect(hitSeverity(2, 30)).toBe("a scratch");
    expect(hitSeverity(6, 30)).toBe("a solid hit");
  });

  it("tells checks: others without results, a revealed one with its label and outcome", () => {
    const check = { id: "c1", type: "check", check: { ability: "str", skill: "athletics" }, rows: [{ slug: "q", name: "Quietclaw" }], createdAt: at(4) };
    expect(lines([check], { viewerSlug: "x" })).toEqual(["Quietclaw made an Athletics check."]);
    const revealed = { id: "c2", type: "check", label: "Barrel-roll under the portcullis", revealed: true, check: { ability: "dex", skill: "acrobatics" }, rows: [{ slug: "m", name: "Meanjeans", total: 6, pass: false }], createdAt: at(5) };
    expect(lines([revealed], { viewerSlug: "x" })).toEqual(["Barrel-roll under the portcullis — Meanjeans made an Acrobatics check… and failed."]);
    const mine = { id: "c3", type: "check", check: { ability: "wis", skill: "perception" }, rows: [{ slug: "e", name: "Eòghan", total: 17 }], createdAt: at(6) };
    expect(lines([mine], { viewerSlug: "e" })).toEqual(["You made a Perception check. [17]"]);
  });

  it("tells the player's own Check-button rolls as checks and saves", () => {
    const entries = [
      { id: "a", slug: "liu", characterName: "Liu Sha", label: "Dexterity (Stealth)", total: 11, createdAt: at(1) },
      { id: "b", slug: "liu", characterName: "Liu Sha", label: "Wisdom save", total: 9, createdAt: at(2) },
    ];
    expect(lines(entries, { viewerSlug: "x" })).toEqual(["Liu Sha made a Wisdom save.", "Liu Sha made a Stealth check."]);
  });

  it("leaves out the DM's dice and turn changes; keeps gifts, votes, shopping, conditions", () => {
    const entries = [
      { id: "d", source: "dm", characterName: "DM", label: "Free Roll", total: 12, createdAt: at(1) },
      { id: "t", type: "turn", round: 2, subject: { name: "Aesop" }, createdAt: at(2) },
      { id: "g", type: "give", from: { slug: "e", name: "Eòghan" }, to: { slug: "liu", name: "Liu Sha" }, item: "Potion of Healing", qty: 1, createdAt: at(3) },
      { id: "v", type: "vote", question: "Which way?", winners: ["The river"], createdAt: at(4) },
      { id: "s", type: "shop", slug: "m", characterName: "Meanjeans", items: [{ name: "Lantern", qty: 1 }], createdAt: at(5) },
      { id: "k", type: "condition", subject: { type: "character", sourceId: "a", name: "Aesop" }, added: ["Poisoned"], removed: [], createdAt: at(6) },
    ];
    expect(lines(entries, { viewerSlug: "liu" })).toEqual([
      "Aesop is now Poisoned.",
      "Meanjeans bought a Lantern.",
      "“Which way?”: the party chose The river.",
      "Eòghan gave you a Potion of Healing.",
    ]);
  });

  it("keeps moments and notes as their own items, replies under the note", () => {
    const story = buildStory([
      { id: "msg-n1", type: "note", to: ["e"], toNames: ["Eòghan"], text: "Psst.", createdAt: at(1) },
      { id: "reply-n1-e", type: "note-reply", noteId: "n1", slug: "e", name: "Eòghan", text: "Got it.", createdAt: at(2) },
      { id: "msg-m1", type: "moment", title: "The Gate", text: "It slams shut.", createdAt: at(3) },
    ], { viewerSlug: "e" });
    expect(story.map((i) => i.kind)).toEqual(["moment", "note"]);
    expect(story[1]).toMatchObject({ heading: "The DM, to you only", replies: [{ who: "You", text: "Got it." }] });
  });
});

describe("buildStory on real-table noise", () => {
  const npc = { type: "npc", sourceId: "c", name: "Carrion Crawler" };
  it("keeps monster names whole and tells a spell's attack roll as a cast", () => {
    const hex = { id: "x", slug: "e", characterName: "Eòghan MacGille Fàth", label: "Hex ATK", total: 9, attack: { kind: "spell", id: "h", name: "Hex" }, target: npc, createdAt: at(1) };
    expect(lines([hex], { viewerSlug: "z" })).toEqual(["Eòghan cast Hex at Carrion Crawler."]);
  });
  it("drops a condition switched on and off within moments, and DM damage undone", () => {
    const entries = [
      { id: "a", type: "condition", subject: npc, added: ["Blinded"], removed: [], createdAt: at(1) },
      { id: "b", type: "condition", subject: npc, added: [], removed: ["Blinded"], createdAt: at(2) },
      { id: "c", type: "hp", subject: npc, delta: -5, createdAt: at(3) },
      { id: "d", type: "hp", subject: npc, delta: 5, createdAt: at(3) },
      { id: "f", type: "condition", subject: npc, added: ["Exhaustion"], removed: [], createdAt: at(10) },
    ];
    expect(lines(entries, { viewerSlug: "z" })).toEqual(["Carrion Crawler is now Exhausted."]);
  });
  it("tells back-to-back free rolls and repeated heals as one line", () => {
    const free = (id, min, total) => ({ id, slug: "e", characterName: "Eòghan", label: "Free Roll", total, createdAt: at(min) });
    const heal = (id) => ({ id, type: "hp", subject: { type: "character", sourceId: "a", name: "Aesop" }, delta: 4, createdAt: at(20) });
    expect(lines([free("1", 1, 9), free("2", 3, 1), heal("h1"), heal("h2")], { viewerSlug: "e" })).toEqual(["Aesop was healed.", "You rolled the dice twice. [9, 1]"]);
  });
  it("marks combat rounds, dropping a start that was straight away restarted", () => {
    const turn = (id, min, round) => ({ id, type: "turn", round, subject: { name: "A" }, createdAt: at(min) });
    const story = buildStory([turn("t1", 0, 1), turn("t2", 0, 1), turn("t3", 5, 2)], { viewerSlug: "z" });
    expect(story.filter((i) => i.kind === "round").map((i) => `${i.start ? "start " : ""}${i.round}`)).toEqual(["2", "start 1"]);
  });
});
