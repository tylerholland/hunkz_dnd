// Colours for the Atmosphere backdrop (src/components/Atmosphere.jsx).

function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return [150, 185, 220];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The fog's "r, g, b": the palette's bright accent on dark palettes; on a
 * light palette, its accent softened toward the paper.
 */
export function fogRgbFor(pal) {
  if (!pal.light) return hexRgb(pal.accentBright).join(", ");
  const a = hexRgb(pal.accent);
  const b = hexRgb(pal.bg);
  return a.map((v, i) => Math.round(v * 0.6 + b[i] * 0.4)).join(", ");
}
