import { useEffect, useRef, useState } from "react";

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// A soft cloud texture, tileable left/right, painted once per palette. The
// fog bands drift it with CSS transforms only.
function paintFog(rgb) {
  const W = 1400;
  const H = 600;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext?.("2d");
  if (!g) return null;
  // Cloud banks: clusters of overlapping puffs, with gaps between them.
  for (let c = 0; c < 7; c += 1) {
    const cx = (c + Math.random() * 0.6) * (W / 7);
    const cy = H * (0.38 + Math.random() * 0.24);
    const puffs = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < puffs; i += 1) {
      const x = cx + (Math.random() - 0.5) * 260;
      const y = cy + (Math.random() - 0.5) * 90;
      // Every puff stays inside the canvas vertically, or it gets a flat edge.
      const r = Math.min(50 + Math.random() * 120, y - 4, H - y - 4);
      if (r < 20) continue;
      const a = 0.12 + Math.random() * 0.12;
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

function makeRunes() {
  if (reducedMotion()) return [];
  return Array.from({ length: 12 }, (_, i) => ({
    id: i,
    glyph: RUNES[Math.floor(Math.random() * RUNES.length)],
    style: {
      left: `${4 + Math.random() * 92}%`,
      top: `${10 + Math.random() * 85}%`,
      animationDuration: `${9 + Math.random() * 8}s`,
      animationDelay: `${-Math.random() * 16}s`,
      fontSize: `${16 + Math.random() * 14}px`,
    },
  }));
}

const RING_RUNES = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  const x = 200 + Math.cos(a) * 160;
  const y = 200 + Math.sin(a) * 160 + 5;
  return { x, y, rotate: `rotate(${(a * 180) / Math.PI + 90} ${x} ${y - 5})`, glyph: RUNES[i % RUNES.length] };
});

const MOONS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  const x = 200 + Math.cos(a) * 168;
  const y = 200 + Math.sin(a) * 168;
  return { x, y, shadeX: x + 18 * Math.cos((i / 8) * Math.PI * 2) };
});

/**
 * Homepage atmosphere: drifting fog banks, two sigils chalked on a tilted
 * plane (an eight-pointed star and an astrolabe of moon phases), and runes
 * that rise and fade. Decorative; motion stops under reduced motion.
 */
export default function HomeAtmosphere({ fogRgb }) {
  const rootRef = useRef(null);
  const [runes] = useState(makeRunes);

  useEffect(() => {
    const url = paintFog(fogRgb);
    if (!url || !rootRef.current) return;
    rootRef.current.querySelectorAll(".home-fog").forEach((el) => { el.style.backgroundImage = `url(${url})`; });
  }, [fogRgb]);

  return (
    <div className="home-atmos" ref={rootRef} aria-hidden="true">
      <div className="home-fog home-fog--1" />
      <div className="home-fog home-fog--2" />
      <div className="home-fog home-fog--3" />
      <svg className="home-sigil" viewBox="0 0 400 400" fill="none" stroke="currentColor">
        <g className="home-sigil-ring-a">
          <circle cx="200" cy="200" r="190" strokeWidth="1" />
          <circle cx="200" cy="200" r="176" strokeWidth="0.6" strokeDasharray="2 6" />
          <g fontFamily="Cinzel, serif" fontSize="14" fill="currentColor" stroke="none">
            {RING_RUNES.map((r, i) => <text key={i} x={r.x} y={r.y} textAnchor="middle" transform={r.rotate}>{r.glyph}</text>)}
          </g>
        </g>
        <g className="home-sigil-ring-b">
          <circle cx="200" cy="200" r="138" strokeWidth="0.8" />
          {/* An eight-pointed star: two squares, one turned 45°. */}
          <polygon points="200,62 338,200 200,338 62,200" strokeWidth="0.8" />
          <rect x="102.4" y="102.4" width="195.2" height="195.2" strokeWidth="0.8" />
          <circle cx="200" cy="200" r="70" strokeWidth="0.6" strokeDasharray="1 4" />
          <circle cx="200" cy="200" r="22" strokeWidth="0.8" />
        </g>
      </svg>
      <svg className="home-sigil home-sigil--astrolabe" viewBox="0 0 400 400" fill="none" stroke="currentColor">
        <defs>
          {MOONS.map((m, i) => (
            <mask key={i} id={`home-moon-${i}`}>
              <circle cx={m.x} cy={m.y} r="9" fill="#fff" />
              <circle cx={m.shadeX} cy={m.y} r="9" fill="#000" />
            </mask>
          ))}
        </defs>
        <g className="home-sigil-ring-b">
          <circle cx="200" cy="200" r="186" strokeWidth="1" />
          <circle cx="200" cy="200" r="150" strokeWidth="0.6" strokeDasharray="6 4 1 4" />
          {MOONS.map((m, i) => (
            <g key={i}>
              <circle cx={m.x} cy={m.y} r="9" fill="currentColor" stroke="none" mask={`url(#home-moon-${i})`} />
              <circle cx={m.x} cy={m.y} r="9" strokeWidth="0.6" />
            </g>
          ))}
        </g>
        <g className="home-sigil-ring-a">
          <circle cx="200" cy="200" r="104" strokeWidth="0.8" />
          <line x1="200" y1="40" x2="200" y2="360" strokeWidth="0.6" />
          <line x1="40" y1="200" x2="360" y2="200" strokeWidth="0.6" />
          <path d="M200 120 L214 200 L200 280 L186 200 Z" strokeWidth="0.8" />
          <path d="M120 200 L200 186 L280 200 L200 214 Z" strokeWidth="0.8" />
        </g>
      </svg>
      {runes.map((r) => <span key={r.id} className="home-rune" style={r.style}>{r.glyph}</span>)}
    </div>
  );
}
