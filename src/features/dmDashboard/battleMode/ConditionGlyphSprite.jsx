/**
 * ConditionGlyphSprite — the 14-condition (+ unknown) SVG glyph sprite for
 * Story 53's badge column. Ported verbatim from
 * design/prototypes/token-effects-review.html — the prototype itself labels
 * these "ILLUSTRATIVE approximations… not final art," which is the same
 * fidelity bar this implementation pass targets; a later icon pass can swap
 * these paths without touching any consumer (everything references glyphs
 * by id via <use>, never inlines paths per token).
 *
 * Rendered once per map surface (MapPanel, PlayerMapViewer) — not once per
 * token — since <symbol> definitions are shared via <use href="#g-...">.
 */
export default function ConditionGlyphSprite() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <symbol id="g-unconscious" viewBox="0 0 10 10"><path d="M1 6.2 Q5 2 9 6.2 Q5 8.6 1 6.2 Z" /></symbol>
        <symbol id="g-paralyzed" viewBox="0 0 10 10"><path d="M6.2 0 L2 5.6 L4.6 5.6 L3.4 10 L8.2 4 L5.4 4 Z" /></symbol>
        <symbol id="g-stunned" viewBox="0 0 10 10"><path d="M5 0.6c2.6 0 4.4 1.9 4.4 4.3 0 2-1.5 3.6-3.4 3.6-1.5 0-2.7-1.1-2.7-2.6 0-1.2 1-2.1 2.1-2.1.9 0 1.6.7 1.6 1.6 0 .7-.5 1.2-1.1 1.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></symbol>
        <symbol id="g-petrified" viewBox="0 0 10 10"><polygon points="5,0.4 9.2,2.9 9.2,7.4 5,9.9 0.8,7.4 0.8,2.9" /></symbol>
        <symbol id="g-incapacitated" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="0.6" y="4.3" width="8.8" height="1.4" /></symbol>
        <symbol id="g-restrained" viewBox="0 0 10 10"><rect x="-0.4" y="4.3" width="10.8" height="1.4" transform="rotate(45 5 5)" /><rect x="-0.4" y="4.3" width="10.8" height="1.4" transform="rotate(-45 5 5)" /></symbol>
        <symbol id="g-grappled" viewBox="0 0 10 10"><path d="M0.5 2 L3.5 5 L0.5 8 L1.5 8 L4.6 5 L1.5 2 Z" /><path d="M9.5 2 L6.5 5 L9.5 8 L8.5 8 L5.4 5 L8.5 2 Z" /></symbol>
        <symbol id="g-prone" viewBox="0 0 10 10"><rect x="0.8" y="7.2" width="8.4" height="1.5" /><circle cx="4.8" cy="3.4" r="2.1" /></symbol>
        <symbol id="g-blinded" viewBox="0 0 10 10"><path d="M0.5 5c1.4-2.4 3-3.4 4.5-3.4S8.1 2.6 9.5 5c-1.4 2.4-3 3.4-4.5 3.4S1.9 7.4 0.5 5Z" fill="none" stroke="currentColor" strokeWidth="1.1" /><circle cx="5" cy="5" r="1.15" /><rect x="0.3" y="4.35" width="9.4" height="1.3" transform="rotate(-32 5 5)" /></symbol>
        <symbol id="g-deafened" viewBox="0 0 10 10"><path d="M2 2.5a4.2 4.2 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M4 1.2a6.2 6.2 0 0 1 0 7.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><rect x="0.3" y="4.35" width="9.4" height="1.3" transform="rotate(-32 5 5)" /></symbol>
        <symbol id="g-charmed" viewBox="0 0 10 10"><path d="M5 9C2 6.6 0.6 4.9 0.6 3.2A2.3 2.3 0 0 1 5 2.1 2.3 2.3 0 0 1 9.4 3.2C9.4 4.9 8 6.6 5 9Z" /></symbol>
        <symbol id="g-frightened" viewBox="0 0 10 10"><polygon points="0.7,1.2 5,6.2 9.3,1.2 9.3,3.2 5,9 0.7,3.2" /></symbol>
        <symbol id="g-poisoned" viewBox="0 0 10 10"><path d="M5 0.4C6.8 3.4 8.3 5.4 8.3 7A3.3 3.3 0 0 1 1.7 7C1.7 5.4 3.2 3.4 5 0.4Z" /></symbol>
        <symbol id="g-unknown" viewBox="0 0 10 10"><circle cx="5" cy="5" r="1.7" /></symbol>
      </defs>
    </svg>
  );
}
