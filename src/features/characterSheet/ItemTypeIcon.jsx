// Small 16px line icons for Loadout rows, one per item type. Closed shapes
// take a soft fill when `filled` (equipped); open strokes stay as lines.
const SHAPES = {
  weapon: [
    // Double-bitted battle axe: centre haft, mirrored crescent blades
    { d: "M8.8 4.2c1.7-.6 3.2-1.6 4.4-2.4 1.4 2.4 1.4 5 0 7.4-1.2-.8-2.7-1.8-4.4-2.4Z", closed: true },
    { d: "M7.2 4.2c-1.7-.6-3.2-1.6-4.4-2.4-1.4 2.4-1.4 5 0 7.4 1.2-.8 2.7-1.8 4.4-2.4Z", closed: true },
    { d: "M8 1.5v13" },
  ],
  armor: [
    { d: "M5 2 3 3.5V7l1.5 1v5.5c2.3.9 4.7.9 7 0V8L13 7V3.5L11 2c-1.8 1.7-4.2 1.7-6 0Z", closed: true },
  ],
  shield: [
    { d: "M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4L8 1.5Z", closed: true },
  ],
  wondrous: [
    // Two four-point sparkles, large lower-left and small upper-right
    { d: "M6 5 7.1 8.4 10.5 9.5 7.1 10.6 6 14 4.9 10.6 1.5 9.5 4.9 8.4Z", closed: true },
    { d: "M12 1.4 12.7 3.3 14.6 4 12.7 4.7 12 6.6 11.3 4.7 9.4 4 11.3 3.3Z", closed: true },
  ],
  potion: [
    { d: "M7 1.8v3.9L3.6 11.4c-.8 1.4.2 2.8 1.8 2.8h5.2c1.6 0 2.6-1.4 1.8-2.8L9 5.7V1.8Z", closed: true },
    { d: "M6 1.8h4" },
    { d: "M4.8 9.8h6.4" },
  ],
  tool: [
    { d: "M2.5 2.8h8.5v3.4H2.5Z", closed: true },
    { d: "M6.8 6.2v7.8" },
    { d: "M11 4.5h2.5" },
  ],
  ammunition: [
    { d: "M13.5 2.5 9.2 3.9 12.1 6.8Z", closed: true },
    { d: "M3 13 11.2 4.8" },
    { d: "M3 13v-2.8M3 13h2.8M4.7 11.3V8.9M4.7 11.3h2.4" },
  ],
  quest: [
    { d: "M3.5 2.5h9v11h-9Z", closed: true },
    { d: "M5.8 5.5h4.4M5.8 8h4.4M5.8 10.5h2.8" },
  ],
  other: [
    { d: "M5.5 4.8c1.6.9 3.4.9 5 0l1.9 6.2c.4 2-1.4 3.2-4.4 3.2s-4.8-1.2-4.4-3.2Z", closed: true },
    { d: "M6 2.3 8 4.4l2-2.1" },
  ],
};

export default function ItemTypeIcon({ type, filled = false, size = 16 }) {
  const shapes = SHAPES[type] || SHAPES.other;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" data-icon={type}>
      {shapes.map((shape, i) => (
        <path
          key={i}
          d={shape.d}
          fill={shape.closed && filled ? "currentColor" : "none"}
          fillOpacity={shape.closed && filled ? 0.25 : 0}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
