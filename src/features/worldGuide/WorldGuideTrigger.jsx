/**
 * WorldGuideTrigger
 *
 * Icon button that opens/closes the World Guide drawer.
 * Renders an open-book SVG glyph (32×32) padded to a 44×44 touch target.
 *
 * Props:
 *   open     {boolean}  — whether the drawer is currently open
 *   onToggle {function} — called when button is clicked
 *
 * Relies on --pal-* CSS custom properties being set on an ancestor element
 * (the mount-point component root). No pal prop needed here.
 */
export default function WorldGuideTrigger({ open, onToggle }) {
  return (
    <button
      className={`guide-trigger${open ? " is-open" : ""}`}
      onClick={onToggle}
      aria-label="World Guide"
      aria-expanded={open}
      title="World Guide"
      type="button"
    >
      <svg
        className="guide-trigger-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    </button>
  );
}
