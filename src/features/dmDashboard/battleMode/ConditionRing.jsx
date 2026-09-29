import { FAMILY_COLORS } from "./tokenEffects";

// Condition ring (replaces Story 53's corner badges). One layer per kind of
// thing on the token:
//   • harmful conditions/curses — a slowly turning rune ring, coloured by the
//     most serious one present;
//   • helpful spell effects (Blessed, Hasted…) — a pulsing gold halo;
//   • Hexed — the curse sigil (counter-rotating hexagram), as in the strike FX.
// A count pip shows when there's more than one. The token's hover/tap card
// lists each by name.
const R = 44;
const point = (r, a) => [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
const ticks = (r, n, len) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  const [x1, y1] = point(r, a);
  const [x2, y2] = point(r + len, a);
  return { x1, y1, x2, y2 };
});
const RUNE_TICKS = ticks(R, 12, 3);
const SIGIL_TICKS = ticks(R + 1, 6, 4);
const BLESS_MOTES = Array.from({ length: 8 }, (_, i) => point(R + 1, (i / 8) * Math.PI * 2));
const triangle = (offset) => Array.from({ length: 3 }, (_, i) => point(R - 3, (i / 3) * Math.PI * 2 + offset).join(",")).join(" ");
const TRI_UP = triangle(-Math.PI / 2);
const TRI_DOWN = triangle(Math.PI / 2);
const STROKE = { vectorEffect: "non-scaling-stroke", fill: "none" };

function RuneRing({ color, scale = 1 }) {
  return (
    <g style={{ "--fam": color }} transform={scale !== 1 ? `translate(50 50) scale(${scale}) translate(-50 -50)` : undefined}>
      <g className="tk-cond-ring__spin">
        <circle cx="50" cy="50" r={R} {...STROKE} stroke="var(--fam)" strokeWidth="2" strokeDasharray="6 3 1 3" />
        {RUNE_TICKS.map((t, i) => (
          <line key={i} {...t} {...STROKE} stroke="var(--fam)" strokeWidth="1.5" strokeLinecap="round" />
        ))}
      </g>
      <circle cx="50" cy="50" r="40" {...STROKE} stroke="var(--fam)" strokeWidth="1" opacity="0.55" />
    </g>
  );
}

function HelpfulHalo({ scale = 1 }) {
  const color = FAMILY_COLORS.helpful;
  return (
    <g transform={scale !== 1 ? `translate(50 50) scale(${scale}) translate(-50 -50)` : undefined}>
      <g className="tk-cond-ring__pulse">
        <circle cx="50" cy="50" r={R + 2} {...STROKE} stroke={color} strokeWidth="4" opacity="0.3" />
        <circle cx="50" cy="50" r={R} {...STROKE} stroke={color} strokeWidth="1.6" />
      </g>
      <g className="tk-cond-ring__spin">
        {BLESS_MOTES.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.8" fill={color} />)}
      </g>
    </g>
  );
}

function HexSigil({ scale = 1 }) {
  const color = FAMILY_COLORS.curse;
  return (
    <g transform={scale !== 1 ? `translate(50 50) scale(${scale}) translate(-50 -50)` : undefined}>
      <g className="tk-cond-ring__spin-rev">
        <circle cx="50" cy="50" r={R + 1} {...STROKE} stroke={color} strokeWidth="1.6" />
        <circle cx="50" cy="50" r={R - 4} {...STROKE} stroke="rgba(170,110,255,0.55)" strokeWidth="1" />
        <polygon points={TRI_UP} {...STROKE} stroke={color} strokeWidth="1" opacity="0.7" />
        <polygon points={TRI_DOWN} {...STROKE} stroke={color} strokeWidth="1" opacity="0.7" />
        {SIGIL_TICKS.map((t, i) => (
          <line key={i} {...t} {...STROKE} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        ))}
      </g>
    </g>
  );
}

export default function ConditionRing({ eligible, isFallen = false }) {
  if (!Array.isArray(eligible) || eligible.length === 0) return null;
  const hexed = eligible.some((item) => String(item.name).toLowerCase() === "hexed");
  const helpful = eligible.filter((item) => item.meta?.family === "helpful");
  // Everything harmful except Hexed, which has its own sigil. `eligible` is
  // sorted most-serious first, so [0] sets the rune ring's colour.
  const harmful = eligible.filter((item) => item.meta?.family !== "helpful" && String(item.name).toLowerCase() !== "hexed");

  // Layers nest outward so they don't sit on top of each other.
  const layers = [];
  if (hexed) layers.push("hex");
  if (harmful.length) layers.push("rune");
  if (helpful.length) layers.push("halo");
  const scaleFor = (index) => 1 + index * 0.14;
  const pipColor = harmful.length
    ? FAMILY_COLORS[harmful[0].meta?.family] || FAMILY_COLORS.unknown
    : hexed ? FAMILY_COLORS.curse : FAMILY_COLORS.helpful;

  return (
    <div className={`tk-cond-ring${isFallen ? " tk-cond-ring--fallen" : ""}`} style={{ "--fam": pipColor }} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        {layers.map((layer, i) => {
          if (layer === "hex") return <HexSigil key="hex" scale={scaleFor(i)} />;
          if (layer === "rune") return <RuneRing key="rune" scale={scaleFor(i)} color={FAMILY_COLORS[harmful[0].meta?.family] || FAMILY_COLORS.unknown} />;
          return <HelpfulHalo key="halo" scale={scaleFor(i)} />;
        })}
      </svg>
      {eligible.length > 1 && <span className="tk-cond-ring__count">{eligible.length}</span>}
    </div>
  );
}
