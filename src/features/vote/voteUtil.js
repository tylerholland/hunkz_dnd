// Party vote — shared helpers for the DM's card and players' cards
// (design/prototypes/party-vote.html; server rules in backend lib/vote.js).
import { useEffect, useState } from "react";

export const LETTERS = "ABCDEF";
export const TIME_LIMITS = [[0, "No limit"], [30, "30 s"], [60, "1 min"], [120, "2 min"], [300, "5 min"]];
export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Counts per option and the winners (a tie = several), from ballots. */
export function tally(vote) {
  const counts = (vote?.options || []).map(() => 0);
  for (const picks of Object.values(vote?.ballots || {})) for (const i of picks) if (counts[i] != null) counts[i] += 1;
  const max = Math.max(0, ...counts);
  const winners = max > 0 ? counts.map((n, i) => (n === max ? i : -1)).filter((i) => i >= 0) : [];
  return { counts, max, winners };
}

/**
 * Seconds left on a vote, ticking every second, by the server's clock (the
 * poll's serverTime) so a device with the wrong time still counts right.
 * null when there's no time limit.
 */
export function useCountdown(endsAt, serverTime) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!endsAt) return undefined;
    const server = Date.parse(serverTime || "");
    const offset = Number.isFinite(server) ? server - Date.now() : 0;
    const update = () => setLeft(Math.max(0, Math.ceil((Date.parse(endsAt) - (Date.now() + offset)) / 1000)));
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [endsAt, serverTime]);
  return endsAt ? left : null;
}

// The session log's line for a finished vote (no outcome if the DM kept it).
export function voteLogText(entry) {
  if (entry.hidden || !Array.isArray(entry.winners)) return `The party voted on “${entry.question}”`;
  if (!entry.winners.length) return `“${entry.question}”: nobody voted`;
  if (entry.winners.length > 1) return `“${entry.question}”: a tie between ${entry.winners.join(" and ")}`;
  return `“${entry.question}”: the party chose ${entry.winners[0]}`;
}
