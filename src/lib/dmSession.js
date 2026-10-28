import { useSyncExternalStore } from "react";

// Who's signed in on this device, the DM's chosen theme, and whether combat is
// on — shared by the top bar (DM links, ⋯ menu) and every DM page, so a change
// made in one place shows everywhere at once.

const DM_KEY = "dnd_dm_password";
const PALETTE_KEY = "dnd_dm_palette";
const CHAR_PREFIX = "dnd_char_";

const read = (key) => { try { return sessionStorage.getItem(key); } catch { return null; } };

export const isDmSignedIn = () => !!read(DM_KEY);

/** Is anyone (the DM or any character) signed in on this tab? */
export function anyoneSignedIn() {
  if (isDmSignedIn()) return true;
  try {
    for (let i = 0; i < sessionStorage.length; i++) if (sessionStorage.key(i)?.startsWith(CHAR_PREFIX)) return true;
  } catch { /* storage blocked */ }
  return false;
}

/** Sign out of everything on this tab — the DM and any characters — and go home. */
export function signOutEverywhere() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i));
    for (const key of keys) if (key === DM_KEY || key?.startsWith(CHAR_PREFIX)) sessionStorage.removeItem(key);
  } catch { /* storage blocked */ }
  window.location.assign("/");
}

// ── The DM's theme (per tab, as before) ──
const paletteListeners = new Set();
export const getDmPalette = () => read(PALETTE_KEY) || "ocean";
export function setDmPalette(key) {
  try { sessionStorage.setItem(PALETTE_KEY, key); } catch { /* storage blocked */ }
  paletteListeners.forEach((fn) => fn());
}
const subscribePalette = (fn) => { paletteListeners.add(fn); return () => paletteListeners.delete(fn); };
export const useDmPalette = () => useSyncExternalStore(subscribePalette, getDmPalette);

// ── Combat on or off, as last heard from the server ──
let combat = false;
const combatListeners = new Set();
export function setCombatActive(on) {
  if (on === combat) return;
  combat = on;
  combatListeners.forEach((fn) => fn());
}
const subscribeCombat = (fn) => { combatListeners.add(fn); return () => combatListeners.delete(fn); };
export const useCombatActive = () => useSyncExternalStore(subscribeCombat, () => combat);
