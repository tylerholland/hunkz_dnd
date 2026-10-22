import { useSyncExternalStore } from "react";

// Story 33 — two-way hover link on the DM's battle view: hovering a token
// (map or tray) lights up its party/NPC card; hovering a card pulses its
// token (or tray chip). One tiny store instead of context, so a hover only
// re-renders the token and card it concerns — not every chip on the map.
// Nothing scrolls into view (Decision 4).

let hovered = null; // { key: "character:eoghan" | "npc:npc-1", from: "token" | "card" }
const listeners = new Set();

export const linkKey = (type, sourceId) => (type && sourceId ? `${type}:${sourceId}` : null);

export function setLinkHover(type, sourceId, from) {
  const key = linkKey(type, sourceId);
  if (!key) return;
  hovered = { key, from };
  listeners.forEach((fn) => fn());
}

/** Clears the hover only if it's still this one (leave/enter can interleave). */
export function clearLinkHover(type, sourceId) {
  if (!hovered || hovered.key !== linkKey(type, sourceId)) return;
  hovered = null;
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * For one token or card: null, or which side is being hovered — "token"
 * (a card should light up) or "card" (a token should pulse).
 */
export function useLinkHover(type, sourceId) {
  const key = linkKey(type, sourceId);
  return useSyncExternalStore(
    subscribe,
    () => (hovered && key && hovered.key === key ? hovered.from : null),
    () => null,
  );
}
