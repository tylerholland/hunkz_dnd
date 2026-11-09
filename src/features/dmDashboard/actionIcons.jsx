// Line icons for the DM's action tiles, drawn to match the app's other SVG
// glyphs: 24-unit box, currentColor strokes, no fills.
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false };

/** Ask for a Roll: a d20. */
export function RollIcon() {
  return (
    <svg {...base}>
      <path d="M12 2.5 20.5 7.25v9.5L12 21.5 3.5 16.75v-9.5Z" />
      <path d="M12 6.5 17 15H7Z" />
      <path d="M12 2.5v4M20.5 7.25 17 15M3.5 7.25 7 15M7 15l-3.5 1.75M17 15l3.5 1.75M7 15l5 6.5 5-6.5" />
    </svg>
  );
}

/** Call a Vote: a ballot going into the box. */
export function VoteIcon() {
  return (
    <svg {...base}>
      <path d="M4 13.5h16v7H4Z" />
      <path d="M8.5 13.5h7" strokeWidth="2.2" />
      <path d="M8 13.5V4.5h8v9" />
      <path d="m10 9 1.6 1.6L14.5 7.5" />
    </svg>
  );
}

/** Request Silence: a speech bubble, struck through. */
export function HushIcon() {
  return (
    <svg {...base}>
      <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-8l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5Z" />
      <path d="M3 3 21 21" />
    </svg>
  );
}

/** Read a Moment: an unrolled scroll. */
export function ScrollIcon() {
  return (
    <svg {...base}>
      <path d="M7 4h11a2 2 0 0 1 2 2v1h-3" />
      <path d="M17 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h11" />
      <path d="M7 4a2 2 0 0 0-2 2v11" />
      <path d="M9 9h5M9 12h5" />
    </svg>
  );
}

/** Pass a Note: a sealed letter. */
export function NoteIcon() {
  return (
    <svg {...base}>
      <path d="M3.5 6.5h17v11h-17Z" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
      <circle cx="12" cy="14.5" r="2" />
    </svg>
  );
}
