/**
 * Shared token utility functions.
 */

/**
 * Map a character palette name to its accent color.
 */
export function getPaletteAccent(paletteName) {
  const PALETTE_ACCENTS = {
    ember: "#a06840",
    ocean: "#6a8fa8",
    forest: "#5a8a60",
    shadow: "#8a6a9a",
    bone: "#a09070",
    frost: "#70a0b8",
    dusk: "#9a6870",
    gold: "#b89040",
  };
  return PALETTE_ACCENTS[paletteName] || "#6a8fa8";
}

/**
 * Derive a deterministic fill color from an NPC id string.
 * Uses a simple djb2-style hash to pick from a set of muted palette colors.
 */
export function npcInitialColor(id) {
  const colors = [
    "#2a5a4a",
    "#4a3a2a",
    "#5a2a2a",
    "#2a3a5a",
    "#4a2a5a",
    "#3a4a2a",
    "#5a4a2a",
    "#2a4a4a",
    "#4a2a3a",
    "#3a2a4a",
  ];
  let hash = 0;
  const str = String(id || "");
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

/**
 * Generate initials from an NPC name (up to 2 chars).
 */
export function npcInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Clamp a fractional coordinate to [0, 1].
 */
export function clampFrac(v) {
  return Math.max(0, Math.min(1, v));
}
