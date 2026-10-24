// Homepage — "The road so far": the Chronicle's sessions as waypoints on a
// winding trail, with a flag at the next session (or today). Pure layout
// helpers; RoadSoFar.jsx draws the SVG.

const DAY = 86400000;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const ROAD_GLYPHS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ";

// The viewBox the road is laid out in.
export const ROAD_W = 1000;
export const ROAD_H = 190;

/** Local midday of the day `value` falls on, so day maths ignores the hour. */
export function localDay(value) {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

export const daysBetween = (a, b) => Math.round((localDay(b) - localDay(a)) / DAY);

export const shortDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/** "Through the Lair · Tue, Sep 29" → "Through the Lair": titles often carry their date. */
export function sessionTitle(title) {
  return String(title || "").replace(/\s*·\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+\w+\s+\d{1,2}\s*$/i, "").trim() || "Untitled session";
}

export function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function toRoman(n) {
  const table = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  let rest = Math.max(1, Math.min(39, n));
  for (const [value, glyph] of table) while (rest >= value) { out += glyph; rest -= value; }
  return out;
}

/**
 * The next session, if it's still ahead (or under way: it stays "next" until
 * six hours after its start). Returns null otherwise.
 */
export function upcomingSession(nextSession, now = new Date()) {
  const ms = Date.parse(nextSession?.at || "");
  if (!Number.isFinite(ms) || ms < now.getTime() - 6 * 3600000) return null;
  const at = new Date(ms);
  const days = daysBetween(now, at);
  const minutes = at.getMinutes();
  const time = `${((at.getHours() + 11) % 12) + 1}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${at.getHours() < 12 ? "AM" : "PM"}`;
  const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return { at, days, label: `${WEEKDAYS[at.getDay()]}, ${shortDate(at)}, ${time}`, when };
}

// A gently winding trail across the box.
export const roadY = (x) => 104 + Math.sin(x / 95) * 22 + Math.sin(x / 41) * 6;

export function trailPath(xStart, xEnd) {
  let d = `M${xStart},${roadY(xStart).toFixed(1)}`;
  for (let x = xStart + 10; x < xEnd; x += 10) d += ` L${x},${roadY(x).toFixed(1)}`;
  return `${d} L${xEnd.toFixed(1)},${roadY(xEnd).toFixed(1)}`;
}

/**
 * Positions for sessions ([{ id, title, startAt, foes }], oldest first), the
 * month ticks, today, and the next-session flag.
 */
export function layoutRoad({ sessions, now = new Date(), next = null }) {
  const today = localDay(now);
  const days = sessions.map((s) => localDay(s.startAt));
  const nextDay = next ? localDay(next) : null;
  const end = nextDay && nextDay > today ? nextDay : today;
  const t0 = new Date((days[0] || today).getTime() - 10 * DAY);
  const t1 = new Date(end.getTime() + 9 * DAY);
  const span = t1 - t0;
  const X = (d) => 50 + ((d - t0) / span) * 900;

  const months = [];
  for (let m = new Date(t0.getFullYear(), t0.getMonth() + 1, 1, 12); m < t1; m = new Date(m.getFullYear(), m.getMonth() + 1, 1, 12)) {
    months.push({ x: X(m), label: MONTHS[m.getMonth()] });
  }

  const xs = days.map(X);
  const points = sessions.map((session, i) => {
    const x = xs[i];
    // Shrink a session's orbit when its neighbours are close, so they don't collide.
    const gaps = [xs[i - 1], xs[i + 1]].filter((v) => v !== undefined).map((v) => Math.abs(v - x));
    const orbitR = Math.max(22, Math.min(40, Math.min(...gaps, 999) / 2 - 4));
    return { session, x, y: roadY(x), day: days[i], orbitR, latest: i === sessions.length - 1 };
  });

  const lastX = xs.length ? xs[xs.length - 1] : X(today);
  return {
    months,
    points,
    lastX,
    endX: X(end),
    today: { x: X(today), y: roadY(X(today)) },
    flag: nextDay && nextDay > today ? { x: X(nextDay), y: roadY(X(nextDay)), day: nextDay } : null,
  };
}
