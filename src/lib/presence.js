// Who's here (design/prototypes/presence-dots.html). The session poll brings
// everyone's last check-in ({ [slug | "dm"]: ISO }, backend lib/presence.js);
// these turn one into a dot. Deliberately slow, so quiet tables don't flicker:
// every open page checks in at least once a minute.
export const ONLINE_MS = 5 * 60 * 1000;
export const RECENT_MS = 30 * 60 * 1000;

/** "on" (online) · "recent" (recently active) · "away", judged by the server's clock. */
export function presenceState(lastSeen, now) {
  const seen = Date.parse(lastSeen || "");
  const at = typeof now === "number" ? now : Date.parse(now || "") || Date.now();
  if (!Number.isFinite(seen)) return "away";
  const ago = Math.max(0, at - seen);
  return ago <= ONLINE_MS ? "on" : ago <= RECENT_MS ? "recent" : "away";
}

/** The words behind a dot: "Aesop · online", "· last here 12 min ago", "· away". */
export function presenceLabel(name, lastSeen, now) {
  const state = presenceState(lastSeen, now);
  if (state === "on") return `${name} · online`;
  if (state === "recent") {
    const at = typeof now === "number" ? now : Date.parse(now || "") || Date.now();
    return `${name} · last here ${Math.max(1, Math.round((at - Date.parse(lastSeen)) / 60000))} min ago`;
  }
  return lastSeen ? `${name} · away` : `${name} · not seen yet`;
}
