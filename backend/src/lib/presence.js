// Who's here — the shared "last seen" record (design/prototypes/presence-dots.html).
// Every session-state poll that names a character (player pages) or carries
// the DM password stamps that person's last-seen time, at most once a minute,
// in one record: { slug: "presence", seen: { [slug | "dm"]: ISO time } }.
// Like the rest of the app (ADR-005), a player's stamp trusts the character
// the poll names. Clients turn the times into green / yellow / gray dots.
const STAMP_EVERY_MS = 60 * 1000;

/** The "last seen" map from the presence record. */
function seenOf(record) {
  const seen = record?.seen;
  if (!seen || typeof seen !== "object") return {};
  return Object.fromEntries(Object.entries(seen).filter(([, at]) => typeof at === "string"));
}

/** Whether this poll should stamp `who` (not stamped in the last minute). */
function shouldStamp(seen, who, nowMs = Date.now()) {
  if (!who) return false;
  const last = Date.parse(seen?.[who] || "");
  return !Number.isFinite(last) || nowMs - last >= STAMP_EVERY_MS;
}

/** What a poll returns: the party's and the DM's last-seen times only. */
function publicPresence(seen, partySlugs) {
  const keep = new Set([...(partySlugs || []), "dm"]);
  return Object.fromEntries(Object.entries(seen || {}).filter(([who]) => keep.has(who)));
}

module.exports = { STAMP_EVERY_MS, seenOf, shouldStamp, publicPresence };
