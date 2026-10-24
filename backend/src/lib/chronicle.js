// Story 69 — Session Chronicle: pure helpers (no DynamoDB).
//
// Index record (`chronicle`): { chapters: [{ id, name }], sessions: [meta],
//   nextSession: { at, setBy, updatedAt } | null }
//   meta = { id, chapterId, title, startAt, endAt, eventCount, players,
//            foes, summaryExcerpt, recollectionCount, createdAt }
//   foes = the creatures the party damaged that session, most-hurt first:
//          [{ name, portraitUrl }] (portraits looked up when it's recorded).
// Session record (`chronicle-session:<id>`): { id, events, excludedEventIds,
//   summary: { text, updatedAt, updatedBy } | null, recollections: [...] }

const MAX_TITLE = 120;
const MAX_CHAPTER = 80;
const MAX_SUMMARY = 20000;
const MAX_RECOLLECTION = 2000;
const EXCERPT_LEN = 220;
// Leave headroom under DynamoDB's 400KB item limit for summary/recollections.
const MAX_SNAPSHOT_BYTES = 300000;
const MAX_FOES = 3;

const clip = (value, n) => (typeof value === "string" ? value.trim().slice(0, n) : "");
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function normalizeChronicle(item) {
  return {
    chapters: Array.isArray(item?.chapters)
      ? item.chapters.filter((c) => c && c.id).map((c) => ({ id: String(c.id), name: clip(c.name, MAX_CHAPTER) || "Untitled chapter" }))
      : [],
    sessions: Array.isArray(item?.sessions) ? item.sessions.filter((s) => s && s.id) : [],
    nextSession: normalizeNextSession(item?.nextSession),
  };
}

function normalizeNextSession(value) {
  if (!value || typeof value !== "object" || !Number.isFinite(Date.parse(value.at || ""))) return null;
  return {
    at: new Date(Date.parse(value.at)).toISOString(),
    setBy: value.setBy && typeof value.setBy === "object" ? value.setBy : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

// "Goblin 2" and "Goblin #2" are the same kind of creature as "Goblin".
const creatureKey = (name) => String(name || "").trim().toLowerCase().replace(/\s*#?\d+$/, "");

/**
 * The creatures (NPCs) that lost HP during a session, most damage first.
 * `portraits` = { byId: Map(npc id → url), byName: Map(creatureKey → url) },
 * from the NPCs in play and the NPC library when the session is recorded.
 */
function foesFromEvents(events, portraits = {}) {
  const byId = new Map();
  for (const event of events || []) {
    if (event?.type !== "hp" || event.subject?.type !== "npc" || event.miss) continue;
    const delta = Number(event.delta ?? (event.to - event.from));
    if (!Number.isFinite(delta) || delta >= 0) continue;
    const id = event.subject.sourceId || event.subject.name;
    const entry = byId.get(id) || { id, name: event.subject.name || "Unknown", damage: 0 };
    entry.damage += -delta;
    byId.set(id, entry);
  }
  return [...byId.values()]
    .sort((a, b) => b.damage - a.damage)
    .slice(0, MAX_FOES)
    .map(({ id, name }) => ({
      name,
      portraitUrl: portraits.byId?.get(id) || portraits.byName?.get(creatureKey(name)) || null,
    }));
}

function normalizeSessionRecord(item) {
  return {
    id: item?.id ?? null,
    events: Array.isArray(item?.events) ? item.events : [],
    excludedEventIds: Array.isArray(item?.excludedEventIds) ? item.excludedEventIds : [],
    summary: item?.summary && typeof item.summary.text === "string" ? item.summary : null,
    recollections: Array.isArray(item?.recollections) ? item.recollections : [],
  };
}

const eventMs = (event) => Date.parse(event?.createdAt || "");

/**
 * Events for a range: every source (live feed, archive, and — when editing —
 * the session's existing snapshot) merged by id, kept if inside [startMs,
 * endMs] and not excluded. Oldest first.
 */
function gatherSessionEvents(sources, { startMs, endMs, excluded = [] }) {
  const skip = new Set(excluded);
  const byId = new Map();
  for (const list of sources) {
    for (const event of list || []) {
      if (!event?.id || byId.has(event.id)) continue;
      const ms = eventMs(event);
      if (!Number.isFinite(ms) || ms < startMs || ms > endMs) continue;
      byId.set(event.id, event);
    }
  }
  const inRange = [...byId.values()].sort((a, b) => eventMs(a) - eventMs(b));
  return { inRange, included: inRange.filter((e) => !skip.has(e.id)) };
}

/** Party members who took part, by slug (latest display name wins). */
function playersFromEvents(events) {
  const bySlug = new Map();
  for (const event of events) {
    if (event?.type === "hp" || event?.type === "condition" || event?.type === "turn") {
      const s = event.subject;
      if (s?.type === "character" && s.sourceId && !bySlug.has(s.sourceId)) bySlug.set(s.sourceId, { slug: s.sourceId, name: s.name || s.sourceId, palette: null });
      continue;
    }
    if (event?.source === "dm" || !event?.slug) continue;
    bySlug.set(event.slug, { slug: event.slug, name: event.characterName || event.slug, palette: event.paletteKey || bySlug.get(event.slug)?.palette || null });
  }
  return [...bySlug.values()];
}

function excerpt(text) {
  const first = String(text || "").trim().split(/\n\s*\n/)[0] || "";
  return first.length > EXCERPT_LEN ? `${first.slice(0, EXCERPT_LEN - 1).trimEnd()}…` : first;
}

function rangesOverlap(a, b) {
  return Date.parse(a.startAt) <= Date.parse(b.endAt) && Date.parse(b.startAt) <= Date.parse(a.endAt);
}

// Players see a finished session much as they saw the live log: NPC HP
// totals stay hidden (only the change shows).
function publicSessionEvents(events) {
  return events.map((event) => {
    if (event?.type !== "hp" || event.subject?.type !== "npc") return event;
    const { from, to, max, ...rest } = event;
    return rest;
  });
}

function snapshotTooLarge(record) {
  return JSON.stringify(record).length > MAX_SNAPSHOT_BYTES;
}

module.exports = {
  MAX_TITLE,
  MAX_CHAPTER,
  MAX_SUMMARY,
  MAX_RECOLLECTION,
  clip,
  newId,
  normalizeChronicle,
  normalizeNextSession,
  normalizeSessionRecord,
  creatureKey,
  foesFromEvents,
  gatherSessionEvents,
  playersFromEvents,
  excerpt,
  rangesOverlap,
  publicSessionEvents,
  snapshotTooLarge,
};
