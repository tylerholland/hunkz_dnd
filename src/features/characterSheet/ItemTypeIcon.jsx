// Small 16px silhouette icons for Loadout rows, one per item type. Equipped
// (`filled`) renders solid; stowed renders as an outline. Detail cut-outs
// (visor slit, etc.) are even-odd holes so they survive the solid fill.
// Upright shapes are tilted via SHAPE_TRANSFORMS for the "held" weapons.
const SHAPES = {
  weapon: [
    // Double-bitted battle axe head + pommel, haft as a thick stroke
    { d: "M8.9 3.4c1.8-.4 3.3-1.4 4.6-2.6 1.6 2.6 1.6 5.6 0 8.2-1.3-1.2-2.8-2.2-4.6-2.6ZM7.1 3.4C5.3 3 3.8 2 2.5.8.9 3.4.9 6.4 2.5 9c1.3-1.2 2.8-2.2 4.6-2.6Z", closed: true },
    { d: "M8 6.6v7.6", width: 2 },
    { d: "M8 1v2", width: 1.6 },
    { d: "M6.9 14.2h2.2v1.3H6.9Z", closed: true },
  ],
  armor: [
    // Corinthian-style helm with a T-shaped face opening and a crest ridge
    { d: "M2.8 14.5V7.4C2.8 4.1 5.1 1.8 8 1.8s5.2 2.3 5.2 5.6v7.1H9.3V9H11.6V7.3H4.4V9h2.3v5.5Z", closed: true },
    { d: "M8 1.8C9.8.6 12.4.8 14 2.6", width: 1.4 },
  ],
  shield: [
    // Heater shield with a chevron cut-out
    { d: "M8 1.2 13.8 3.2v4.2c0 3.5-2.4 6-5.8 7.4C4.6 13.4 2.2 10.9 2.2 7.4V3.2ZM5 6.2 8 8.4l3-2.2v1.6L8 10 5 7.8Z", closed: true },
  ],
  wondrous: [
    // Two four-point sparkles, large lower-left and small upper-right
    { d: "M6 4.6 7.2 8.3 10.9 9.5 7.2 10.7 6 14.4 4.8 10.7 1.1 9.5 4.8 8.3Z", closed: true },
    { d: "M12 1 12.8 3.2 15 4 12.8 4.8 12 7 11.2 4.8 9 4 11.2 3.2Z", closed: true },
  ],
  potion: [
    // Round-bottomed flask with a cork
    { d: "M6.9 3.6h2.2v2.7c2 .5 3.6 2.3 3.6 4.4 0 2.6-2.1 4.6-4.7 4.6s-4.7-2-4.7-4.6c0-2.1 1.6-3.9 3.6-4.4Z", closed: true },
    { d: "M6.2 1h3.6v2.2H6.2Z", closed: true },
  ],
  tool: [
    // War hammer: block head, thick haft, pommel
    { d: "M3 2h10v4.4H3Z", closed: true },
    { d: "M8 6.4v7.8", width: 2 },
    { d: "M6.9 14.2h2.2v1.3H6.9Z", closed: true },
  ],
  ammunition: [
    // Arrow: barbed head, shaft, fletching
    { d: "M14.8 1.2 9.8 2.6l1.4 1.4-1.2 1.2.8.8 1.2-1.2 1.4 1.4Z", closed: true },
    { d: "M2.8 13.2 11 5", width: 1.6 },
    { d: "M1.2 12.4 3.2 10.4l1.2 1.2-2 2ZM3.6 14.8l2-2-1.2-1.2-2 2Z", closed: true },
  ],
  quest: [
    // Scroll with rolled ends and writing lines cut out
    { d: "M4 2h8.2c1 0 1.8.8 1.8 1.8S13.2 5.6 12.2 5.6H12v6.6c0 1-.8 1.8-1.8 1.8H3.8C2.8 14 2 13.2 2 12.2s.8-1.8 1.8-1.8H4ZM5.6 6.2h4.6v.9H5.6ZM5.6 9.2h4.6v.9H5.6Z", closed: true },
  ],
  other: [
    // Drawstring pouch
    { d: "M5.4 5c1.7.8 3.5.8 5.2 0l2 5.8c.6 2.4-1.6 3.7-4.6 3.7s-5.2-1.3-4.6-3.7Z", closed: true },
    { d: "M5.6 2.2 8 4.6l2.4-2.4" },
  ],
};

// Held at an angle; scaled slightly so tips stay inside the 16px box.
const TILT = "rotate(40 8 8) translate(8 8) scale(0.86) translate(-8 -8)";
const SHAPE_TRANSFORMS = { weapon: TILT, tool: TILT };

export default function ItemTypeIcon({ type, filled = false, size = 16 }) {
  const shapes = SHAPES[type] || SHAPES.other;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" data-icon={type}>
      <g transform={SHAPE_TRANSFORMS[type]}>
        {shapes.map((shape, i) => (
          <path
            key={i}
            d={shape.d}
            fill={shape.closed && filled ? "currentColor" : "none"}
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth={shape.width ?? (filled && shape.closed ? 0.6 : 1.3)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}
