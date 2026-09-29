import { FAMILY_COLORS } from "./tokenEffects";

// Condition ring (replaces Story 53's corner badges): a slowly turning rune
// ring around any token with a condition, coloured by the most serious one
// present, with a count when there's more than one. It says "look here";
// the token's hover/tap card lists what each condition is. Spell-effect
// sigils (Hex, Bless) join it with Story 70.
const R = 44;
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return {
    x1: 50 + R * Math.cos(a), y1: 50 + R * Math.sin(a),
    x2: 50 + (R + 3) * Math.cos(a), y2: 50 + (R + 3) * Math.sin(a),
  };
});

export default function ConditionRing({ eligible, isFallen = false }) {
  if (!Array.isArray(eligible) || eligible.length === 0) return null;
  // `eligible` is already sorted most-serious first (getBadgeEligibleConditions).
  const color = FAMILY_COLORS[eligible[0].meta?.family] || FAMILY_COLORS.unknown;
  return (
    <div className={`tk-cond-ring${isFallen ? " tk-cond-ring--fallen" : ""}`} style={{ "--fam": color }} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <g className="tk-cond-ring__spin">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--fam)" strokeWidth="2" strokeDasharray="6 3 1 3" vectorEffect="non-scaling-stroke" />
          {TICKS.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--fam)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--fam)" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
      </svg>
      {eligible.length > 1 && <span className="tk-cond-ring__count">{eligible.length}</span>}
    </div>
  );
}
