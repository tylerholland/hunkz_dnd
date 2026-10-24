import { useEffect, useRef, useState } from "react";
import "./atmosphere.css";

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
// Sun, moon and the five wandering stars; U+FE0E asks for the text (not emoji) form.
const PLANETS = ["☉", "☽", "☿", "♀", "♂", "♃", "♄"].map((g) => `${g}︎`);

// Per-variant look: the fog's softness and the glyphs that rise.
const VARIANTS = {
  home: { glyphs: [...RUNES], glyphCount: 12, fog: { clusters: 7, rMin: 50, rRange: 120, aMin: 0.12, aRange: 0.12 } },
  // A reading page: fewer glyphs, runes mixed with the planets, and a softer,
  // wider veil of mist instead of distinct clouds.
  chronicle: { glyphs: [...RUNES.slice(0, 12), ...PLANETS], glyphCount: 8, fog: { clusters: 9, rMin: 90, rRange: 110, aMin: 0.06, aRange: 0.06 } },
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// A cloud texture, tileable left/right, painted once per palette. The fog
// bands drift it with CSS transforms only.
function paintFog(rgb, { clusters, rMin, rRange, aMin, aRange }) {
  const W = 1400;
  const H = 600;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext?.("2d");
  if (!g) return null;
  for (let c = 0; c < clusters; c += 1) {
    const cx = (c + Math.random() * 0.6) * (W / clusters);
    const cy = H * (0.38 + Math.random() * 0.24);
    const puffs = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < puffs; i += 1) {
      const x = cx + (Math.random() - 0.5) * 260;
      const y = cy + (Math.random() - 0.5) * 90;
      // Every puff stays inside the canvas vertically, or it gets a flat edge.
      const r = Math.min(rMin + Math.random() * rRange, y - 4, H - y - 4);
      if (r < 20) continue;
      const a = aMin + Math.random() * aRange;
      for (const dx of [0, -W, W]) {
        const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        grd.addColorStop(0, `rgba(${rgb},${a})`);
        grd.addColorStop(0.55, `rgba(${rgb},${a * 0.45})`);
        grd.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grd;
        g.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
  }
  return canvas.toDataURL();
}

function makeGlyphs(variant) {
  if (reducedMotion()) return [];
  const { glyphs, glyphCount } = VARIANTS[variant];
  return Array.from({ length: glyphCount }, (_, i) => ({
    id: i,
    glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
    style: {
      left: `${4 + Math.random() * 92}%`,
      top: `${10 + Math.random() * 85}%`,
      animationDuration: `${9 + Math.random() * 8}s`,
      animationDelay: `${-Math.random() * 16}s`,
      fontSize: `${16 + Math.random() * 14}px`,
    },
  }));
}

const onCircle = (count, radius, offset = 0) => Array.from({ length: count }, (_, i) => {
  const a = (i / count) * Math.PI * 2 + offset;
  return { a, x: 200 + Math.cos(a) * radius, y: 200 + Math.sin(a) * radius };
});

const RING_RUNES = onCircle(24, 160).map(({ a, x, y }, i) => ({
  x, y: y + 5, rotate: `rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`, glyph: RUNES[i % RUNES.length],
}));

const MOONS = onCircle(8, 168, -Math.PI / 2).map(({ x, y }, i) => ({ x, y, shadeX: x + 18 * Math.cos((i / 8) * Math.PI * 2) }));

// A seven-pointed star drawn in one stroke ({7/3}), and the seven planets round it.
const HEPTA = onCircle(7, 132, -Math.PI / 2);
const HEPTAGRAM = HEPTA.map((_, i) => HEPTA[(i * 3) % 7]).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const INNER = onCircle(7, 58, -Math.PI / 2);
const HEPTAGON = INNER.map((_, i) => INNER[(i * 2) % 7]).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const RING_PLANETS = onCircle(7, 162, -Math.PI / 2).map(({ x, y }, i) => ({ x, y: y + 6, glyph: PLANETS[i] }));

function EightPointStar() {
  return (
    <svg className="atmos-sigil atmos-sigil--top-right" viewBox="0 0 400 400" fill="none" stroke="currentColor">
      <g className="atmos-ring-a">
        <circle cx="200" cy="200" r="190" strokeWidth="1" />
        <circle cx="200" cy="200" r="176" strokeWidth="0.6" strokeDasharray="2 6" />
        <g fontFamily="Cinzel, serif" fontSize="14" fill="currentColor" stroke="none">
          {RING_RUNES.map((r, i) => <text key={i} x={r.x} y={r.y} textAnchor="middle" transform={r.rotate}>{r.glyph}</text>)}
        </g>
      </g>
      <g className="atmos-ring-b">
        <circle cx="200" cy="200" r="138" strokeWidth="0.8" />
        {/* Two squares, one turned 45°. */}
        <polygon points="200,62 338,200 200,338 62,200" strokeWidth="0.8" />
        <rect x="102.4" y="102.4" width="195.2" height="195.2" strokeWidth="0.8" />
        <circle cx="200" cy="200" r="70" strokeWidth="0.6" strokeDasharray="1 4" />
        <circle cx="200" cy="200" r="22" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

function Astrolabe({ corner, id }) {
  return (
    <svg className={`atmos-sigil atmos-sigil--${corner}`} viewBox="0 0 400 400" fill="none" stroke="currentColor">
      <defs>
        {MOONS.map((m, i) => (
          <mask key={i} id={`${id}-moon-${i}`}>
            <circle cx={m.x} cy={m.y} r="9" fill="#fff" />
            <circle cx={m.shadeX} cy={m.y} r="9" fill="#000" />
          </mask>
        ))}
      </defs>
      <g className="atmos-ring-b">
        <circle cx="200" cy="200" r="186" strokeWidth="1" />
        <circle cx="200" cy="200" r="150" strokeWidth="0.6" strokeDasharray="6 4 1 4" />
        {MOONS.map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r="9" fill="currentColor" stroke="none" mask={`url(#${id}-moon-${i})`} />
            <circle cx={m.x} cy={m.y} r="9" strokeWidth="0.6" />
          </g>
        ))}
      </g>
      <g className="atmos-ring-a">
        <circle cx="200" cy="200" r="104" strokeWidth="0.8" />
        <line x1="200" y1="40" x2="200" y2="360" strokeWidth="0.6" />
        <line x1="40" y1="200" x2="360" y2="200" strokeWidth="0.6" />
        <path d="M200 120 L214 200 L200 280 L186 200 Z" strokeWidth="0.8" />
        <path d="M120 200 L200 186 L280 200 L200 214 Z" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

function Heptagram({ corner }) {
  return (
    <svg className={`atmos-sigil atmos-sigil--${corner}`} viewBox="0 0 400 400" fill="none" stroke="currentColor">
      <g className="atmos-ring-a">
        <circle cx="200" cy="200" r="190" strokeWidth="1" />
        <circle cx="200" cy="200" r="178" strokeWidth="0.6" strokeDasharray="1 5" />
        <g fontFamily="Cinzel, serif" fontSize="17" fill="currentColor" stroke="none" textAnchor="middle">
          {RING_PLANETS.map((p, i) => <text key={i} x={p.x} y={p.y}>{p.glyph}</text>)}
        </g>
        <circle cx="200" cy="200" r="146" strokeWidth="0.8" />
      </g>
      <g className="atmos-ring-b">
        <polygon points={HEPTAGRAM} strokeWidth="0.8" />
        <polygon points={HEPTAGON} strokeWidth="0.6" />
        <circle cx="200" cy="200" r="132" strokeWidth="0.5" strokeDasharray="3 5" />
        <circle cx="200" cy="200" r="16" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

/**
 * A page's "live" backdrop: drifting fog, two sigils on a tilted plane and
 * glyphs that rise and fade. `variant` "home" (eight-pointed star + astrolabe,
 * runes) or "chronicle" (astrolabe + seven-pointed star of the planets, runes
 * and planets, lighter mist kept off the reading column). Motion stops under
 * reduced motion.
 */
export default function Atmosphere({ variant = "home", fogRgb, light = false }) {
  const rootRef = useRef(null);
  const [glyphs] = useState(() => makeGlyphs(variant));

  useEffect(() => {
    const url = paintFog(fogRgb, VARIANTS[variant].fog);
    if (!url || !rootRef.current) return;
    rootRef.current.querySelectorAll(".atmos-fog").forEach((el) => { el.style.backgroundImage = `url(${url})`; });
  }, [fogRgb, variant]);

  return (
    <div className={`atmos atmos--${variant}`} data-light={light ? "true" : undefined} ref={rootRef} aria-hidden="true">
      <div className="atmos-fogs">
        <div className="atmos-fog atmos-fog--1" />
        <div className="atmos-fog atmos-fog--2" />
        <div className="atmos-fog atmos-fog--3" />
      </div>
      {variant === "chronicle" ? (
        <>
          <Astrolabe corner="top-right" id="atmos-chr" />
          <Heptagram corner="bottom-left" />
        </>
      ) : (
        <>
          <EightPointStar />
          <Astrolabe corner="bottom-left" id="atmos-home" />
        </>
      )}
      {glyphs.map((g) => <span key={g.id} className="atmos-glyph" style={g.style}>{g.glyph}</span>)}
    </div>
  );
}
