// Today's table (key `slug`), small but complete: characters, every kind of
// special record, a live roll feed of 100 events, two archive pages that
// overlap it, two chronicle sessions, app-meta, and one item nobody knows.
const BASE = Date.UTC(2026, 9, 1, 19, 0, 0); // 1 Oct 2026, 19:00 UTC
const at = (minutes) => new Date(BASE + minutes * 60000).toISOString();

function rollEvent(n, extra = {}) {
  return { id: `roll-${String(n).padStart(4, "0")}`, slug: n % 2 ? "eoghan" : "liu-sha", characterName: n % 2 ? "Eòghan" : "Liu Sha", label: "Free Roll", exprLabel: "2d6", total: 7, rollValues: [3, 4], createdAt: at(n), ...extra };
}

function oldTable() {
  // 250 events in all: 0–149 only in the archive, 150–249 live; 150–159 are
  // in both (an archive page and the live feed can overlap).
  const all = Array.from({ length: 250 }, (_, n) => rollEvent(n));
  all[200] = { id: "hp-0200", type: "hp", subject: { type: "npc", sourceId: "npc-1", name: "Carrion Crawler" }, from: 30, to: 24, delta: -6, editor: "dm", createdAt: at(200) };
  all[201] = { id: "cond-0201", type: "condition", subject: { type: "character", sourceId: "aesop", name: "Aesop" }, added: ["Poisoned"], removed: [], editor: "dm", createdAt: at(201) };
  const live = all.slice(150).reverse(); // newest first, like today
  const archive0 = all.slice(0, 75).reverse();
  const archive1 = all.slice(75, 160).reverse();

  const characters = ["eoghan", "liu-sha", "aesop"].map((slug, i) => ({
    slug, name: ["Eòghan", "Liu Sha", "Aesop"][i], passwordHash: `$2b$10$hash${i}`, palette: "ocean", hpCurrent: 18, hpMax: 18,
    weapons: [], equipment: [], version: 3 + i, updatedAt: at(0),
  }));

  return {
    items: [
      ...characters,
      { slug: "initiative", entries: [{ id: "e1", name: "Eòghan", slug: "eoghan", isPC: true, initiative: 14 }], activeTurnIndex: 0, round: 2, version: 9 },
      { slug: "npc-combat", npcs: [{ id: "npc-1", name: "Carrion Crawler", hpMax: 30, hpCurrent: 24 }], version: 4 },
      { slug: "roll-history", rolls: live, version: 250 },
      { slug: "roll-history-archive:0", seq: 0, events: archive0 },
      { slug: "roll-history-archive:1", seq: 1, events: archive1 },
      { slug: "roll-history-archive:index", seq: 1 },
      { slug: "map-library", activeMapId: "m1", combatMode: false, maps: [{ id: "m1", name: "Sewers", imageUrl: "https://hunkz-dnd-portraits.s3.amazonaws.com/maps/sewers.png", tokens: [] }], version: 12 },
      { slug: "party-roster", members: ["eoghan", "liu-sha", "aesop"], partyVisibilityEnabled: true, version: 2 },
      { slug: "npc-library", templates: [{ id: "t1", name: "Goblin", abilities: [], portraitUrl: "https://hunkz-dnd-portraits.s3.amazonaws.com/npc-portraits/goblin.png" }], version: 5 },
      { slug: "counter-wheels", wheels: [{ id: "w1", name: "The Water Rises", segments: 4, filledCount: 2 }], version: 6 },
      { slug: "house-rules", abilityCheckDice: "2d6", featuresEnabled: true, version: 3 },
      { slug: "app-meta", buildVersion: "2026-10-01-abc123", deployedAt: at(-60) },
      { slug: "chronicle", chapters: [{ id: "c1", name: "Up From the Gutter" }], sessions: [{ id: "s1", chapterId: "c1", title: "Night one", startAt: at(0), endAt: at(120) }], nextSession: null, version: 7 },
      { slug: "chronicle-session:s1", id: "s1", events: all.slice(0, 121), excludedEventIds: ["roll-0003"], summary: null, recollections: [], version: 2 },
      { slug: "talent-codex", entries: { stealth: { text: "Sneaky." } }, version: 1 },
      { slug: "shop", keeper: "humble", opening: null, version: 8 },
      { slug: "shop-catalog", items: [{ id: "potion-healing", cat: "potions", name: "Potion of Healing", price: 50 }], version: 2 },
      { slug: "presence", seen: { eoghan: at(249) }, version: 40 },
      { slug: "party-vote", vote: null, version: 3 },
      { slug: "roll-requests", requests: [], version: 5 },
      { slug: "table-silence", silence: null, version: 1 },
      { slug: "prep-deck", cards: [{ id: "k1", kind: "moment", title: "The Gate" }], version: 2 },
      { slug: "table-messages", messages: [], version: 4 },
      { slug: "mystery-thing", hello: "nobody knows me" },
    ],
    all,
    live,
    characters,
  };
}

// Where each special record goes (design/architecture/multi-campaign-plan.md).
const CAMPAIGN_STATES = ["initiative", "npc-combat", "map-library", "party-roster", "counter-wheels", "house-rules", "chronicle", "shop", "presence", "party-vote", "roll-requests", "table-silence", "prep-deck", "table-messages"];
const LIBRARY_RECORDS = { "npc-library": "NPCS", "shop-catalog": "SHOP_CATALOG", "talent-codex": "TALENTS" };

module.exports = { oldTable, rollEvent, at, BASE, CAMPAIGN_STATES, LIBRARY_RECORDS };
