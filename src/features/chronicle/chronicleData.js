// Story 69 — Session Chronicle: pure data helpers (no React, no API).
import { PALETTES } from "../characterSheet/theme";

export const eventMs = (e) => Date.parse(e?.createdAt || "");

// ── Viewer-local time ─────────────────────────────────────────────────────
export const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const endOfDay = (ms) => { const d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); };
export const fmtDay = (ms, opts = {}) => new Date(ms).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...opts });
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const toLocalInput = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export function timeAgo(iso) {
  const ms = Date.parse(iso || "");
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return fmtDay(ms);
}

// ── People ────────────────────────────────────────────────────────────────
export const ENEMY_COLOR = "#a0503f";
export const UNKNOWN_COLOR = "#8a7d66";

export function playerColor(palette) {
  return PALETTES[palette]?.accent || PALETTES.ocean.accent;
}

/** slug → { name, color } for everyone in a session's player list + events. */
export function peopleIndex(players = [], events = []) {
  const people = new Map();
  for (const p of players) people.set(p.slug, { name: p.name, color: playerColor(p.palette) });
  for (const e of events) {
    if (e?.slug && e.source !== "dm" && !people.has(e.slug)) people.set(e.slug, { name: e.characterName || e.slug, color: playerColor(e.paletteKey) });
  }
  return people;
}

const shortName = (name) => String(name || "").replace(/^".*"\s*/, "").replace(/^Mr\.\s+/, "").split(" ")[0] || String(name || "");

// ── Rounds / hits: recorded when the log has them, inferred otherwise ──────
const PAIR_MS = 5 * 60 * 1000;

export function rollKind(e) {
  if (e?.type && e.type !== "roll") return null;
  const x = String(e?.exprLabel || "").replace(/\s/g, "");
  if (!x) return null;
  if (/check/i.test(e.label || "")) return "check";
  if (/^1d20/.test(x)) return "d20";
  if (/^2d6/.test(x)) return "action";
  if (/^\d*d(4|6|8|10|12)\b/.test(x)) return "damage";
  return null;
}

/**
 * Timeline for the Night at a Glance chart.
 * `recorded` parts come from hp/turn log entries (HP logging, Take Action,
 * initiative — 2026-09-28 on); older sessions fall back to inference from
 * the order people rolled (a 2d6 is an action, a damage die by the same
 * player shortly after is a hit, a new round starts when someone acts twice).
 */
export function buildTimeline(events, people) {
  const sorted = [...events].filter((e) => Number.isFinite(eventMs(e))).sort((a, b) => eventMs(a) - eventMs(b));
  const colorOfRef = (ref) => {
    if (!ref) return UNKNOWN_COLOR;
    if (ref.type === "character") return people.get(ref.sourceId)?.color || UNKNOWN_COLOR;
    return ENEMY_COLOR;
  };
  const nameOfRef = (ref) => (ref?.type === "character" ? people.get(ref.sourceId)?.name : null) || ref?.name || null;

  // HP series (party only), as % of max.
  const hpEvents = sorted.filter((e) => e.type === "hp");
  const hpSeries = new Map();
  for (const e of hpEvents) {
    if (e.subject?.type !== "character" || !Number.isFinite(e.to)) continue;
    const key = e.subject.sourceId;
    if (!hpSeries.has(key)) {
      const max = Number.isFinite(e.max) && e.max > 0 ? e.max : Math.max(e.from || 0, e.to, 1);
      hpSeries.set(key, { slug: key, name: nameOfRef(e.subject) || e.subject.name, color: colorOfRef(e.subject), max, points: [{ ms: eventMs(e) - 1, hp: e.from }] });
    }
    const series = hpSeries.get(key);
    if (Number.isFinite(e.max) && e.max > 0) series.max = e.max;
    series.points.push({ ms: eventMs(e), hp: e.to });
  }

  const recordedHits = hpEvents
    .filter((e) => !e.miss && Number.isFinite(e.delta) && e.delta < 0)
    .map((e) => ({
      ms: eventMs(e),
      amount: -e.delta,
      color: colorOfRef(e.by),
      attacker: nameOfRef(e.by),
      target: e.subject?.name || "",
      action: e.action?.name || null,
      crit: !!e.action?.crit,
      attributed: !!e.by,
      recorded: true,
    }));
  const recordedMisses = hpEvents.filter((e) => e.miss).map((e) => ({ ms: eventMs(e), color: colorOfRef(e.by), who: nameOfRef(e.by), target: e.subject?.name || "" }));

  const turnEvents = sorted.filter((e) => e.type === "turn" && Number.isFinite(e.round));
  const recordedRounds = [];
  for (const e of turnEvents) {
    const last = recordedRounds[recordedRounds.length - 1];
    if (!last || last.n !== e.round) recordedRounds.push({ n: e.round, start: eventMs(e), order: [] });
    recordedRounds[recordedRounds.length - 1].order.push(nameOfRef(e.subject) || e.subject?.name);
  }

  // Inferred (legacy) rounds and hits.
  const inferredRounds = [];
  const inferredHits = [];
  const inferredMisses = [];
  let seen = new Set();
  const lastAction = new Map();
  const swings = [];
  for (const e of sorted) {
    if (e.source === "dm" || !e.slug) continue;
    const k = rollKind(e);
    const who = e.slug;
    if (k === "action") {
      let cur = inferredRounds[inferredRounds.length - 1];
      if (!cur || seen.has(who)) {
        cur = { n: inferredRounds.length + 1, start: eventMs(e), order: [] };
        inferredRounds.push(cur);
        seen = new Set();
      }
      seen.add(who);
      cur.order.push(who);
      const swing = { e, who, paired: false };
      swings.push(swing);
      lastAction.set(who, swing);
    } else if (k === "damage") {
      const a = lastAction.get(who);
      const paired = !!a && !a.paired && eventMs(e) - eventMs(a.e) <= PAIR_MS;
      if (paired) a.paired = true;
      inferredHits.push({
        ms: eventMs(e),
        amount: e.total,
        color: people.get(who)?.color || UNKNOWN_COLOR,
        attacker: people.get(who)?.name || e.characterName,
        target: e.target?.name || "",
        action: paired ? `${e.exprLabel} after ${a.e.exprLabel} = ${a.e.total}` : e.exprLabel,
        crit: !!e.isCrit,
        attributed: paired,
        recorded: false,
      });
    }
  }
  for (const s of swings) if (!s.paired) inferredMisses.push({ ms: eventMs(s.e), color: people.get(s.who)?.color || UNKNOWN_COLOR, who: people.get(s.who)?.name, target: "" });

  const hasRecordedHits = recordedHits.length > 0 || recordedMisses.length > 0;
  const rounds = recordedRounds.length ? recordedRounds : inferredRounds.map((r) => ({ ...r, order: r.order.map((slug) => people.get(slug)?.name || slug) }));

  // Typical turn order: average position across rounds.
  const pos = new Map();
  rounds.forEach((r) => r.order.forEach((name, i) => {
    const v = pos.get(name) || { s: 0, n: 0 };
    v.s += i; v.n += 1;
    pos.set(name, v);
  }));
  const order = [...pos.entries()].sort((a, b) => a[1].s / a[1].n - b[1].s / b[1].n).map(([name]) => name);

  return {
    hpSeries: [...hpSeries.values()],
    hits: hasRecordedHits ? recordedHits : inferredHits,
    misses: hasRecordedHits ? recordedMisses : inferredMisses,
    rounds,
    order,
    roundsInferred: !recordedRounds.length && inferredRounds.length > 0,
    hitsInferred: !hasRecordedHits && inferredHits.length > 0,
    clocks: sorted.filter((e) => e.type === "wheel").map((e) => ({ ms: eventMs(e), name: e.name, filled: e.filledCount, segments: e.segments })),
  };
}

// ── Highlights ────────────────────────────────────────────────────────────
export function buildHighlights(events, people) {
  const rolls = events.filter((e) => (!e.type || e.type === "roll") && Number.isFinite(e.total));
  const nameOf = (e) => (e.slug ? people.get(e.slug)?.name : null) || e.characterName || "DM";
  const d20 = rolls.filter((e) => /^1d20/.test(String(e.exprLabel || "").replace(/\s/g, "")));
  const nat20 = d20.filter((e) => e.isCrit || e.rollValues?.[0] === 20);
  const nat1 = [
    ...d20.filter((e) => e.isFumble || e.rollValues?.[0] === 1),
    ...rolls.filter((e) => /^2d6/.test(String(e.exprLabel || "").replace(/\s/g, "")) && e.rollValues?.length === 2 && e.rollValues[0] === 1 && e.rollValues[1] === 1),
  ];
  const top = [...rolls].sort((a, b) => b.total - a.total)[0];
  const counts = new Map();
  rolls.forEach((e) => { if (e.source !== "dm" && e.slug) counts.set(nameOf(e), (counts.get(nameOf(e)) || 0) + 1); });
  const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const clocks = new Map();
  events.filter((e) => e.type === "wheel").forEach((e) => clocks.set(e.name, e));
  const unique = (list) => [...new Set(list.map(nameOf).map(shortName))].join(", ");

  const hp = events.filter((e) => e.type === "hp" && !e.miss);
  const dealt = new Map();
  hp.filter((e) => e.delta < 0 && e.by?.type === "character").forEach((e) => {
    const n = people.get(e.by.sourceId)?.name || e.by.name;
    dealt.set(n, (dealt.get(n) || 0) + -e.delta);
  });
  const topDealer = [...dealt.entries()].sort((a, b) => b[1] - a[1])[0];
  const downed = [...new Set(hp.filter((e) => e.from > 0 && e.to <= 0).map((e) => e.subject?.name).filter(Boolean))];
  const healed = hp.filter((e) => e.delta > 0).reduce((sum, e) => sum + e.delta, 0);

  return [
    { key: "nat20", label: "Natural 20s", value: nat20.length, detail: nat20.length ? unique(nat20) : "None this time", tone: nat20.length ? "good" : "" },
    { key: "nat1", label: "Natural 1s", value: nat1.length, detail: nat1.length ? unique(nat1) : "A clean night", tone: nat1.length ? "bad" : "" },
    top ? { key: "top", label: "Highest roll", value: top.total, detail: `${shortName(nameOf(top))} · ${top.label || "Roll"} (${top.exprLabel})` } : null,
    busiest ? { key: "busy", label: "Most rolls", value: busiest[1], detail: shortName(busiest[0]) } : null,
    topDealer ? { key: "dealer", label: "Most damage", value: topDealer[1], detail: shortName(topDealer[0]) } : null,
    downed.length ? { key: "down", label: "Went down", value: downed.length, detail: downed.join(", "), tone: "bad" } : null,
    healed ? { key: "heal", label: "Healing", value: healed, detail: "HP restored", tone: "good" } : null,
    { key: "clocks", label: "Clocks moved", value: clocks.size, detail: clocks.size ? [...clocks.values()].map((e) => `${e.name}${Number.isFinite(e.filledCount) ? ` ${e.filledCount}/${e.segments}` : ""}`).join(" · ") : "None" },
  ].filter(Boolean);
}

// ── Record-a-session helpers ──────────────────────────────────────────────
export function mergeLogSources(...lists) {
  const byId = new Map();
  for (const list of lists) for (const e of list || []) if (e?.id && !byId.has(e.id) && Number.isFinite(eventMs(e))) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => eventMs(a) - eventMs(b));
}

export function sessionTakingMs(sessions, ms, exceptId) {
  return sessions.find((s) => s.id !== exceptId && ms >= Date.parse(s.startAt) && ms <= Date.parse(s.endAt)) || null;
}

export function playersInEvents(events) {
  const names = new Map();
  for (const e of events) if (e?.slug && e.source !== "dm") names.set(e.slug, e.characterName || e.slug);
  return [...names.values()];
}
