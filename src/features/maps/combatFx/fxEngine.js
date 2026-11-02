// Combat FX engine (ADR-031) — one <canvas> per map viewport draws every
// strike on a single clock: wind-up / charge → strike → impact. Ported from
// the approved "Battle Map Strikes" preview.
//
// The engine works in canvas (screen) pixels. Tokens stay DOM elements; the
// adapter supplies each token's live screen position and applies the
// engine's per-frame motion (lunge, knockback, shake, swell) to the real
// token, so effects follow pan/zoom/rotation for free.
//
// adapter = {
//   getToken(id) -> { x, y, r } | null   centre + radius in canvas px, EXCLUDING fx motion
//   setMotion(id, { dx, dy, scale })      screen-space offset; {0,0,1} = rest
//   isVisible() -> boolean                 false while the map is hidden/collapsed
// }

// Table pace: the approved preview's slow-motion speed (~3s a hit) — about
// one attack a turn lands a moment after the roll, so a slower play gives
// everyone time to look up and catch it.
export const TABLE_PACE = 0.3;

const CHARGE_MS = 350;
const SHEETS = { slash: "/effects/fa01-slash.png", thrust: "/effects/fa01-thrust.png", punch: "/effects/fa01-punch.png" };
const SHEET_FOR_STYLE = {
  cut: "slash", chop: "slash", flurry: "punch", arrow: "thrust", rock: "punch", fire: "punch", force: "punch", bolt: "punch",
  // Creature attacks (NPC abilities' looks).
  bite: "slash", claw: "slash", lash: "slash", sting: "thrust", slam: "punch", breath: "punch", spit: "punch",
};
// A new hit on a token whose strike is still playing is absorbed (slow −/+
// taps would otherwise stack several swings from the same attacker).
const ABSORB_MS = 1100;
// Whip timing, as fractions of its duration: the tip reaches the target at
// WHIP_HIT, and the flick finishes easing out at WHIP_LAND.
const WHIP_HIT = 0.745, WHIP_LAND = 0.78;

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeIn = (k) => k * k;
const hsl = (h, s, l, a = 1) => `hsla(${Math.round(h)},${Math.round(s * 100)}%,${Math.round(l * 100)}%,${a})`;

let sheetCache = null;
function loadSheets() {
  if (sheetCache || typeof Image === "undefined") return sheetCache;
  sheetCache = {};
  for (const [key, src] of Object.entries(SHEETS)) {
    const img = new Image();
    img.src = src;
    sheetCache[key] = img;
  }
  return sheetCache;
}

export function createFxEngine(canvas, adapter, { reducedMotion = false, timeScale = TABLE_PACE } = {}) {
  const ctx = canvas?.getContext?.("2d");
  // No 2D canvas (tests, very old browsers): effects are decoration — skip them.
  if (!ctx) return { play() {}, destroy() {} };
  let W = 0, H = 0, dpr = 1;
  let clock = 0, last = 0, rafId = null, destroyed = false;
  let boardShake = 0;

  const effects = [];   // { t0, dur, tick?(k), draw?(k), end?(), fn? }
  const particles = [];
  const rings = [];
  const sprites = [];
  const stains = [];
  const fx = new Map(); // tokenId -> { ox, oy, scale, glow, glowHue, glowLight, flash, flashColor, shake, knock }

  const state = (id) => {
    if (!fx.has(id)) fx.set(id, { ox: 0, oy: 0, scale: 1, glow: 0, glowColor: "#ffffff", flash: 0, flashColor: "#ff4a3a", shake: null, knock: null });
    return fx.get(id);
  };
  const tok = (id) => (id ? adapter.getToken(id) : null);
  const at = (delay, fn) => effects.push({ t0: clock + delay, fn });

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  function spark(x, y, o) {
    particles.push({ x, y, vx: o.vx || 0, vy: o.vy || 0, life: 0, max: o.max || 500, size: o.size || 2, color: o.color || "#fff", drag: o.drag ?? 0.92, g: o.g || 0, to: o.to || null, shrink: o.shrink ?? true, line: o.line ?? true, blood: !!o.blood, dust: !!o.dust });
  }
  function burst(x, y, color, n, speed, max, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.9);
      spark(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: max * (0.6 + Math.random() * 0.6), size: (opts.size || 2.2) * (0.6 + Math.random()), color, g: opts.g || 0, drag: opts.drag });
    }
  }
  function blood(p, R, bearing, n) {
    const colors = ["#8e1414", "#a81c1c", "#6f0d0d", "#c02a22"];
    for (let i = 0; i < n; i++) {
      const a = bearing + (Math.random() - 0.5) * 1.5, s = 0.12 + Math.random() * 0.26;
      spark(p.x + Math.cos(a) * R * 0.5, p.y + Math.sin(a) * R * 0.5, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.05, max: 520 + Math.random() * 380, size: 1.6 + Math.random() * 2.6, color: colors[i % colors.length], drag: 0.955, g: 0.00055, shrink: false, line: false, blood: true });
    }
  }

  // ── Attacker beats ────────────────────────────────────────────────────────
  function charge(id, color, ms) {
    effects.push({ t0: clock, dur: ms, tick: (k) => {
      const s = state(id), t = tok(id);
      s.glow = Math.max(s.glow, easeOut(k)); s.glowColor = color;
      s.scale = 1 + 0.07 * Math.sin(k * Math.PI);
      if (t && Math.random() < 0.9) {
        const a = Math.random() * Math.PI * 2, R = t.r * (1.9 + Math.random() * 0.6);
        spark(t.x + Math.cos(a) * R, t.y + Math.sin(a) * R, { to: id, max: 380, size: 1.8 + Math.random() * 1.6, color });
      }
    }, end: () => { state(id).scale = 1; } });
  }
  function windUp(id, targetId, ms, heavy = false) {
    effects.push({ t0: clock, dur: ms, tick: (k) => {
      const a = tok(id), b = tok(targetId), s = state(id);
      if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const back = a.r * (heavy ? 0.45 : 0.28) * Math.sin(clamp01(k) * Math.PI * 0.5);
      s.ox = -((b.x - a.x) / d) * back; s.oy = -((b.y - a.y) / d) * back;
      if (heavy) s.scale = 1 + 0.12 * Math.sin(clamp01(k) * Math.PI * 0.5);
      if (k < 0.35) { s.flash = Math.max(s.flash, 0.9); s.flashColor = "#e8f4ff"; }
      s.glow = Math.max(s.glow, 0.5 * Math.sin(k * Math.PI)); s.glowColor = "#dfeeff";
    }, end: () => { if (heavy) state(id).scale = 1; } });
  }
  function lunge(id, targetId, start, ms) {
    effects.push({ t0: clock + start, dur: ms, tick: (k) => {
      const a = tok(id), b = tok(targetId), s = state(id);
      if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const reach = Math.min(Math.max(0, d - a.r - b.r) * 0.55 + a.r * 0.25, a.r * 2.5);
      const e = k < 0.45 ? easeOut(k / 0.45) : 1 - easeIn((k - 0.45) / 0.55);
      s.ox = ((b.x - a.x) / d) * reach * e; s.oy = ((b.y - a.y) / d) * reach * e;
    }, end: () => { const s = state(id); s.ox = 0; s.oy = 0; } });
  }

  // ── Strike visuals ────────────────────────────────────────────────────────
  function cut(targetId, start, ms, bearing, opts = {}) {
    const angle = bearing + Math.PI / 2 + (opts.angleOffset ?? (Math.random() - 0.5) * 0.7);
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const p = tok(targetId); if (!p) return;
      const L = p.r * (opts.long ? 2.7 : 2.3), cx = Math.cos(angle), cy = Math.sin(angle);
      const sh = (opts.shift || 0) * p.r;
      const x0 = p.x - (cx * L) / 2 - cy * sh, y0 = p.y - (cy * L) / 2 + cx * sh;
      const head = easeOut(clamp01(k / 0.35)), tail = easeIn(clamp01((k - 0.2) / 0.8));
      const hx = x0 + cx * L * head, hy = y0 + cy * L * head, tx = x0 + cx * L * tail, ty = y0 + cy * L * tail;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      ctx.shadowColor = opts.color || "#dff1ff"; ctx.shadowBlur = 14;
      ctx.strokeStyle = opts.color || "#dff1ff"; ctx.globalAlpha = 0.55 * (1 - tail); ctx.lineWidth = opts.heavy ? 13 : opts.long ? 9 : 7;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = "#ffffff"; ctx.globalAlpha = 1 - tail; ctx.lineWidth = opts.heavy ? 3.4 : 2.2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.restore();
    } });
  }
  // A curved blade swoosh that grows from the top of the swing, accelerating,
  // thickest near its leading tip, with thin "fins" trailing off the outer
  // edge; then it frays into strands and dashes.
  // - Chop (default): a broad crescent arc round the target.
  // - opts.hook (Cut): a flat hairpin along the line of attack — forward past
  //   the target, a sharp turn, and back — about 3× longer than it is tall.
  // opts.reverse starts from the bottom.
  function swoosh(targetId, start, ms, bearing, opts = {}) {
    const light = opts.color || "#e6f2fb", shade = opts.shade || "#9fbad0";
    const spread = opts.long ? 1.05 : 0.95, turn = Math.PI - 0.35;
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const p = tok(targetId); if (!p) return;
      const bx = Math.cos(bearing), by = Math.sin(bearing), nx = -by, ny = bx;
      // at(u, off): the point u (0→1) along the swing's path, pushed off
      // outward by off — the path's shape lives here.
      let at, dir;
      if (opts.hook) {
        const A = p.r * 2.1, B = p.r * 0.62, cx = p.x + bx * p.r * 0.2, cy = p.y + by * p.r * 0.2;
        // Start on whichever side of the line of attack is higher on screen.
        dir = (ny > 0 || (ny === 0 && nx < 0) ? 1 : -1) * (opts.reverse ? -1 : 1);
        at = (u, off) => {
          const th = -turn + 2 * turn * u, c = Math.cos(th), sn = Math.sin(th) * dir;
          let ox = c / A, oy = sn / B; const m = Math.hypot(ox, oy) || 1; ox /= m; oy /= m;
          const lx = A * c + ox * off, ly = B * sn + oy * off;
          return [cx + bx * lx + nx * ly, cy + by * lx + ny * ly];
        };
      } else {
        const R = p.r * (opts.long ? 2.3 : 2.1), px = p.x - bx * (R - p.r * 0.65), py = p.y - by * (R - p.r * 0.65);
        // Sweep from whichever end of the arc is higher on screen.
        const upFirst = Math.sin(bearing - spread) < Math.sin(bearing + spread);
        dir = (upFirst ? 1 : -1) * (opts.reverse ? -1 : 1);
        at = (u, off) => { const a = bearing - dir * spread + dir * spread * 2 * u; return [px + Math.cos(a) * (R + off), py + Math.sin(a) * (R + off)]; };
      }
      const head = easeIn(clamp01(k / 0.55));
      const tail = Math.max(head - 0.8, easeIn(clamp01((k - 0.5) / 0.35)));
      const W = p.r * (opts.long ? 0.68 : opts.hook ? 0.46 : 0.5);
      const band = (from, to, base, outer, inner, color, alpha) => {
        const pts = [], N = opts.hook ? 60 : 30;
        for (let i = 0; i <= N; i++) {
          const v = i / N, u = from + (to - from) * v, w = W * Math.sin(Math.PI * Math.pow(v, 1.8));
          pts.push([...at(u, base + w * outer), ...at(u, base + w * inner)]);
        }
        ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][2], pts[i][3]);
        ctx.closePath(); ctx.fill();
      };
      const fade = 1 - easeIn(clamp01((k - 0.7) / 0.3)) * 0.5;
      ctx.save();
      // Fraying: once the swing lands, the blade's path breaks into thin
      // strands that thin out into dashes and fade.
      const fray = clamp01((k - 0.5) / 0.5);
      if (fray > 0) {
        ctx.lineCap = "round";
        for (let i = 0; i < 4; i++) {
          const from = Math.min(0.95, 0.3 + 0.45 * fray + i * 0.06), to = 1 - i * 0.04;
          if (to - from < 0.02) continue;
          ctx.strokeStyle = i % 2 ? shade : light; ctx.globalAlpha = 0.95 * (1 - easeIn(fray));
          ctx.lineWidth = Math.max(0.8, (3.4 - i * 0.6) * (1 - fray * 0.5));
          ctx.setLineDash([Math.max(2, 18 * (1 - fray)), 2 + 12 * fray]);
          ctx.beginPath();
          for (let j = 0; j <= 40; j++) { const [x, y] = at(from + ((to - from) * j) / 40, W * (0.55 - i * 0.28)); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      if (head - tail < 0.01) { ctx.restore(); return; }
      ctx.shadowColor = light; ctx.shadowBlur = 10;
      band(tail, head, 0, 0.75, -0.3, shade, 0.95 * fade);
      ctx.shadowBlur = 0;
      band(tail, head, 0, 0.75, 0.12, light, fade);
      // Trailing fins: thin slivers a steady gap off the outer edge, lagging the tip.
      for (let i = 0; i < (opts.long ? 3 : 2); i++) {
        const lag = 0.1 + i * 0.07, fh = head - lag, ft = Math.max(tail, fh - 0.32 + i * 0.06);
        if (fh - ft < 0.03) continue;
        band(ft, fh, W * (0.82 + i * 0.26), 0.16, 0, i ? shade : light, 0.8 * fade);
      }
      // A few flecks where the swing began.
      if (tail < 0.05) for (let j = 1; j <= 3; j++) {
        const [x, y] = at(tail - j * 0.025, 0), sz = Math.max(0.8, 2.6 - j * 0.6);
        ctx.globalAlpha = (0.8 - j * 0.2) * fade; ctx.fillStyle = light;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      ctx.restore();
    } });
  }
  function jabPopHit(targetId, bearing, second) {
    const p = tok(targetId); if (!p) return;
    const cx = p.x - Math.cos(bearing) * p.r * 0.7, cy = p.y - Math.sin(bearing) * p.r * 0.7;
    rings.push({ x: cx, y: cy, r0: p.r * 0.15, r1: p.r * (second ? 0.9 : 0.7), t0: clock, dur: 260, color: "rgba(255,248,230,", w: 2.2 });
    burst(cx, cy, "#fff6e6", 6, 0.22, 180, { size: 1.4 });
    for (let i = 0; i < 7; i++) {
      const a = bearing + Math.PI + (Math.random() - 0.5) * 2.2, sp = 0.03 + Math.random() * 0.05;
      spark(cx, cy, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: 700, size: 3 + Math.random() * 3, color: "rgba(190,170,140,0.35)", drag: 0.97, shrink: false, line: false, blood: true, dust: true });
    }
    const s = state(targetId); s.flash = Math.max(s.flash, second ? 0.8 : 0.5); s.flashColor = "#ff4a3a";
    if (!second) s.knock = { t0: clock, dur: 260, dist: p.r * 0.12, bearing };
  }
  function projectile(attId, targetId, start, ms, kind, color, hue, sparkColors = ["#ffb04a", "#ff5a24"]) {
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const a = tok(attId), b = tok(targetId); if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
      const p0 = { x: a.x + ux * a.r, y: a.y + uy * a.r }, p2 = { x: b.x - ux * b.r * 0.6, y: b.y - uy * b.r * 0.6 };
      const sag = kind === "arrow" ? -Math.min(0.06 * d, a.r * 2) : kind === "rock" ? -Math.min(0.18 * d, a.r * 4) : 0;
      const c = { x: (p0.x + p2.x) / 2 - uy * sag * (ux >= 0 ? 1 : -1), y: (p0.y + p2.y) / 2 + ux * sag * (ux >= 0 ? 1 : -1) };
      const along = (u) => ({ x: (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * c.x + u * u * p2.x, y: (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * c.y + u * u * p2.y });
      const u = kind === "orb" ? easeIn(k) * 0.35 + k * 0.65 : k;
      const h = along(u);
      if (kind === "rock") {
        // A tumbling stone on a high arc, drawn opaque (not glowing).
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(k * Math.PI * 5);
        const rr = Math.max(4, a.r * 0.26);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(1.5, 2, rr, rr * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8d8272"; ctx.beginPath();
        ctx.moveTo(-rr, -rr * 0.2); ctx.lineTo(-rr * 0.4, -rr * 0.9); ctx.lineTo(rr * 0.6, -rr * 0.75); ctx.lineTo(rr, rr * 0.1); ctx.lineTo(rr * 0.35, rr * 0.85); ctx.lineTo(-rr * 0.7, rr * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#b4a996"; ctx.beginPath(); ctx.moveTo(-rr * 0.5, -rr * 0.5); ctx.lineTo(rr * 0.4, -rr * 0.55); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      if (kind === "arrow") {
        for (let i = 0; i < 10; i++) {
          const q0 = along(Math.max(0, u - (0.22 * (i + 1)) / 10)), q1 = along(Math.max(0, u - (0.22 * i) / 10));
          ctx.strokeStyle = color; ctx.globalAlpha = 0.85 * (1 - i / 10); ctx.lineWidth = 3.2 * (1 - i / 10) + 0.6; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
        }
        const n = along(Math.min(1, u + 0.01)), ang = Math.atan2(n.y - h.y, n.x - h.x);
        ctx.globalAlpha = 1; ctx.fillStyle = "#fff4d8"; ctx.translate(h.x, h.y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, 3.5); ctx.lineTo(-4, -3.5); ctx.closePath(); ctx.fill();
      } else {
        const wob = Math.sin(k * 18) * a.r * 0.12, x = h.x - uy * wob, y = h.y + ux * wob, r = a.r * 0.4;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
        g.addColorStop(0, "rgba(255,245,210,1)"); g.addColorStop(0.25, color); g.addColorStop(1, hsl(hue ?? 20, 1, 0.55, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 3; i++) spark(x, y, { vx: (Math.random() - 0.5) * 0.08 - ux * 0.05, vy: (Math.random() - 0.5) * 0.08 - uy * 0.05 - 0.02, max: 420, size: 2 + Math.random() * 2.5, color: sparkColors[Math.random() < 0.5 ? 0 : 1], line: false });
      }
      ctx.restore();
    } });
  }
  function jag(x0, y0, x1, y1, rough, depth, out, width, branchChance) {
    if (depth === 0) { out.push({ x0, y0, x1, y1, w: width }); return; }
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * rough, my = (y0 + y1) / 2 + (Math.random() - 0.5) * rough;
    jag(x0, y0, mx, my, rough / 2, depth - 1, out, width, branchChance);
    jag(mx, my, x1, y1, rough / 2, depth - 1, out, width, branchChance);
    if (width > 1 && Math.random() < branchChance) {
      const ang = Math.atan2(y1 - y0, x1 - x0) + (Math.random() < 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.5);
      const len = Math.hypot(x1 - x0, y1 - y0) * (0.7 + Math.random() * 0.8);
      jag(mx, my, mx + Math.cos(ang) * len, my + Math.sin(ang) * len, rough / 2, Math.max(1, depth - 2), out, width * 0.5, branchChance * 0.6);
    }
  }
  // One forked bolt that snaps in, holds, then fades into the lingering sigil.
  function lightning(attId, targetId, start, ms, hue) {
    let path = null;
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const a = tok(attId), b = tok(targetId); if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
      if (!path) { path = []; jag(a.x + ux * a.r * 0.9, a.y + uy * a.r * 0.9, b.x - ux * b.r * 0.2, b.y - uy * b.r * 0.2, Math.min(d * 0.28, a.r * 3.6), 6, path, 1.9, 0.2); }
      const HOLD = 0.6, t = k * ms;
      const alpha = k < HOLD ? 0.9 + 0.1 * Math.sin(t * 0.09) : Math.max(0, 1 - (k - HOLD) / (1 - HOLD));
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = hsl(hue, 0.95, 0.6); ctx.shadowBlur = 8;
      for (const seg of path) { ctx.globalAlpha = alpha * 0.45; ctx.strokeStyle = hsl(hue, 0.95, 0.52); ctx.lineWidth = seg.w * 2.2; ctx.beginPath(); ctx.moveTo(seg.x0, seg.y0); ctx.lineTo(seg.x1, seg.y1); ctx.stroke(); }
      ctx.shadowBlur = 0;
      for (const seg of path) { ctx.globalAlpha = alpha; ctx.strokeStyle = seg.w > 1.2 ? hsl(hue, 1, 0.94) : hsl(hue, 0.95, 0.8); ctx.lineWidth = Math.max(0.7, seg.w * 0.55); ctx.beginPath(); ctx.moveTo(seg.x0, seg.y0); ctx.lineTo(seg.x1, seg.y1); ctx.stroke(); }
      ctx.restore();
    } });
  }
  function sigil(targetId, start, ms, hue) {
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const p = tok(targetId); if (!p) return;
      const R = p.r * 1.45, fade = k < 0.12 ? k / 0.12 : k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(p.x, p.y);
      ctx.strokeStyle = hsl(hue, 0.95, 0.62, 0.55 * fade); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(170,110,255,${0.4 * fade})`; ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(k * Math.PI * 1.2); ctx.strokeStyle = hsl(hue, 0.95, 0.76, 0.8 * fade); ctx.lineWidth = 1.8;
      for (let i = 0; i < 6; i++) {
        const aa = (i / 6) * Math.PI * 2, x = Math.cos(aa) * R * 0.91, y = Math.sin(aa) * R * 0.91, s = R * 0.09;
        ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x, y - s * 1.3); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x, y + s); ctx.stroke();
      }
      ctx.restore();
    } });
  }
  function forceBlast(attId, targetId, start, ms, hue) {
    const streaks = Array.from({ length: 7 }, () => ({ off: (Math.random() - 0.5) * 1.6, lag: 0.15 + Math.random() * 0.35, len: 0.18 + Math.random() * 0.2 }));
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const a = tok(attId), b = tok(targetId); if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
      const travel = Math.max(a.r, dist - a.r - b.r * 0.35);
      const u = easeOut(clamp01(k / 0.72)), fade = k < 0.72 ? 1 : Math.max(0, 1 - (k - 0.72) / 0.28);
      const D = Math.max(a.r * 0.4, travel * u), hw = lerp(a.r * 0.55, b.r * 1.2 + a.r * 0.2, u), w0 = a.r * 0.38;
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang); ctx.translate(a.r * 0.85, 0); ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createLinearGradient(0, 0, D + hw, 0);
      grad.addColorStop(0, hsl(hue, 0.95, 0.6, 0));
      grad.addColorStop(clamp01(Math.max(0.01, (D - hw) / (D + hw))), hsl(hue, 0.95, 0.62, 0.22 * fade));
      grad.addColorStop(clamp01(Math.max(0.02, D / (D + hw))), hsl(hue, 1, 0.85, 0.7 * fade));
      grad.addColorStop(1, hsl(hue, 1, 0.95, 0.9 * fade));
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, -w0); ctx.lineTo(D, -hw); ctx.arc(D, 0, hw, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, w0); ctx.closePath(); ctx.fill();
      ctx.shadowColor = hsl(hue, 1, 0.7); ctx.shadowBlur = 14; ctx.strokeStyle = hsl(hue, 1, 0.94, 0.95 * fade); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(D, 0, hw, -Math.PI / 2 + 0.15, Math.PI / 2 - 0.15); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineCap = "round";
      for (const st of streaks) {
        const x1 = D - hw * st.lag, x0 = x1 - travel * st.len; if (x1 <= 0) continue;
        const yy = st.off * hw * 0.55 * (x1 / Math.max(1, D));
        ctx.strokeStyle = hsl(hue, 1, 0.92, 0.55 * fade); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(Math.max(0, x0), yy); ctx.lineTo(x1, yy); ctx.stroke();
      }
      ctx.restore();
    } });
  }
  function healMotes(srcId, targetId, start, ms) {
    const motes = Array.from({ length: 7 }, (_, i) => ({ phase: i / 7, off: 0.5 + Math.random() * 0.8 }));
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const a = tok(srcId), b = tok(targetId); if (!a || !b) return;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (const m of motes) {
        const u = clamp01(k * 1.25 - m.phase * 0.25); if (u <= 0 || u >= 1) continue;
        const sw = Math.sin(u * Math.PI) * a.r * 2 * m.off * Math.sin(m.phase * 6.28 + k * 6);
        const x = lerp(a.x, b.x, easeOut(u)) - ((b.y - a.y) / d) * sw, y = lerp(a.y, b.y, easeOut(u)) + ((b.x - a.x) / d) * sw;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, "rgba(230,255,235,1)"); g.addColorStop(0.4, "rgba(127,212,160,.9)"); g.addColorStop(1, "rgba(127,212,160,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } });
  }

  // ── Creature strike visuals ───────────────────────────────────────────────
  // Jaws: two rows of teeth sweep in from either side of the target and snap
  // shut along the line of attack.
  function jaws(targetId, start, ms, bearing) {
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const p = tok(targetId); if (!p) return;
      const R = p.r, close = easeIn(clamp01(k / 0.45)), fade = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(bearing);
      ctx.globalCompositeOperation = "lighter"; ctx.shadowColor = "#fff2d6"; ctx.shadowBlur = 10;
      for (const side of [-1, 1]) {
        const gap = lerp(R * 1.25, R * 0.12, close) * side;
        ctx.strokeStyle = `rgba(255,244,220,${0.85 * fade})`; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-R * 1.1, gap + side * R * 0.25); ctx.quadraticCurveTo(0, gap - side * R * 0.15, R * 1.1, gap + side * R * 0.25); ctx.stroke();
        ctx.fillStyle = `rgba(255,248,232,${0.95 * fade})`;
        for (let i = 0; i < 6; i++) {
          const x = -R * 0.85 + (i * R * 1.7) / 5, base = gap + side * R * 0.18 * (1 - Math.abs(x) / (R * 1.4));
          ctx.beginPath(); ctx.moveTo(x - R * 0.12, base); ctx.lineTo(x + R * 0.12, base); ctx.lineTo(x, base - side * R * 0.32); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    } });
  }
  // A whip / tentacle / tail. It rises curled back on itself (tip pointing
  // down and back toward the attacker) and creeps forward slowly; then the
  // curl rolls out from root to tip, accelerating hard, so the tip flicks
  // round and cracks into the target — easing out only in the last frames.
  // Hits at WHIP_HIT of its duration.
  function whip(attId, targetId, start, ms, color) {
    const sway = Math.random() * Math.PI * 2;
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const a = tok(attId), b = tok(targetId); if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
      // Curl toward whichever side is higher on screen.
      let nx = -uy, ny = ux; if (ny > 0) { nx = -nx; ny = -ny; }
      const x0 = a.x + ux * a.r * 0.8, y0 = a.y + uy * a.r * 0.8, len = d - a.r * 0.8 - b.r * 0.15;
      // Unroll progress: slow creep, then a hard accelerating flick that
      // eases out only over its last frames, then held while it fades.
      const coil = 0.6, crack = WHIP_LAND;
      let p;
      if (k < coil) p = 0.3 * (0.5 - 0.5 * Math.cos((k / coil) * Math.PI));
      else if (k < crack) {
        const q = (k - coil) / (crack - coil);
        p = 0.3 + 0.7 * (q < 0.85 ? 0.96 * Math.pow(q / 0.85, 3) : 0.96 + 0.04 * easeOut((q - 0.85) / 0.15));
      } else p = 1;
      const fade = k < 0.86 ? 1 : Math.max(0, 1 - (k - 0.86) / 0.14);
      // Bend along the length: the part behind the travelling loop lies along
      // the root angle; past it, the tentacle is turned back by `curl`.
      const rootAng = 1.15 * (1 - p) * (1 - p) + 0.12 * Math.sin(k * 11 + sway) * (1 - p);
      const curl = -(Math.PI + 0.2) * (1 - p * p), loopAt = 0.5 + 0.55 * p, loopW = 0.3;
      const L = len * (0.75 + 0.25 * p), N = 40, pts = [[x0, y0]];
      let x = x0, y = y0;
      for (let i = 1; i <= N; i++) {
        const sAt = (i - 0.5) / N, z = clamp01((sAt - loopAt + loopW) / (2 * loopW));
        const th = rootAng + curl * z * z * (3 - 2 * z);
        x += (ux * Math.cos(th) + nx * Math.sin(th)) * (L / N); y += (uy * Math.cos(th) + ny * Math.sin(th)) * (L / N);
        pts.push([x, y]);
      }
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = fade;
      const w0 = Math.max(6, a.r * 0.4), w1 = Math.max(2, a.r * 0.08);
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? "rgba(0,0,0,0.38)" : color;
        for (let i = 1; i <= N; i++) {
          const w = w0 + (w1 - w0) * (i / N);
          ctx.lineWidth = pass === 0 ? w + 2.5 : w;
          ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
        }
      }
      // The crack: a bright flare at the tip as it lands.
      const flare = 1 - Math.abs(k - WHIP_HIT) / 0.06;
      if (flare > 0) {
        const [tx, ty] = pts[N];
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = flare;
        const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, a.r * 0.7);
        g.addColorStop(0, "rgba(255,250,235,1)"); g.addColorStop(1, "rgba(255,240,210,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, a.r * 0.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } });
  }
  // A barbed stinger / spike: a fast straight thrust in and back out.
  function stab(attId, targetId, start, ms, color) {
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const a = tok(attId), b = tok(targetId); if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
      const out = k < 0.35 ? easeOut(k / 0.35) : 1 - easeIn((k - 0.35) / 0.65);
      const x0 = a.x + ux * a.r * 0.8, y0 = a.y + uy * a.r * 0.8, L = (d - a.r * 0.8 - b.r * 0.1) * out;
      const hx = x0 + ux * L, hy = y0 + uy * L, w = Math.max(2.5, a.r * 0.16);
      ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 - uy * w, y0 + ux * w); ctx.lineTo(hx, hy); ctx.lineTo(x0 + uy * w, y0 - ux * w); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } });
  }
  // Breath: a cone pouring from the attacker over the target, full of embers.
  function breathCone(attId, targetId, start, ms, colors) {
    effects.push({ t0: clock + start, dur: ms, draw: (k) => {
      const a = tok(attId), b = tok(targetId); if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ang = Math.atan2(b.y - a.y, b.x - a.x);
      const len = (d + b.r * 1.2) * easeOut(clamp01(k / 0.4)), spread = 0.42;
      const fade = k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(a.x, a.y); ctx.rotate(ang);
      const g = ctx.createLinearGradient(a.r * 0.6, 0, len, 0);
      g.addColorStop(0, colors.core); g.addColorStop(0.5, colors.mid); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(a.r * 0.6, -a.r * 0.2); ctx.lineTo(len, -Math.tan(spread) * len); ctx.quadraticCurveTo(len * 1.08, 0, len, Math.tan(spread) * len); ctx.lineTo(a.r * 0.6, a.r * 0.2); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (fade > 0.3) {
        for (let i = 0; i < 4; i++) {
          const aa = ang + (Math.random() - 0.5) * spread * 2, sp = 0.25 + Math.random() * 0.3;
          spark(a.x + Math.cos(ang) * a.r * 0.8, a.y + Math.sin(ang) * a.r * 0.8, { vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, max: Math.min(900, d * 2.4 + 200), size: 2 + Math.random() * 3, color: colors.ember[i % colors.ember.length], drag: 0.985, line: false });
        }
      }
    } });
  }
  // A splatter of droplets (venom, acid) that hangs a moment.
  function splatter(p, bearing, colors, n) {
    for (let i = 0; i < n; i++) {
      const a = bearing + (Math.random() - 0.5) * 2.4, sp = 0.08 + Math.random() * 0.22;
      spark(p.x + Math.cos(a) * p.r * 0.4, p.y + Math.sin(a) * p.r * 0.4, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: 600 + Math.random() * 400, size: 1.8 + Math.random() * 2.6, color: colors[i % colors.length], drag: 0.95, g: 0.0004, shrink: false, line: false, blood: true });
    }
  }

  // ── Impact ────────────────────────────────────────────────────────────────
  function hitImpact(targetId, o) {
    const p = tok(targetId); if (!p) return;
    const R = p.r, s = state(targetId);
    const heavy = o.crit ? 1.9 : o.heavy ? 1.3 : 1;
    if (o.heal) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * R * 1.1;
        spark(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.6, { vy: -(0.03 + Math.random() * 0.06), max: 900, size: 1.8 + Math.random() * 2.2, color: Math.random() < 0.5 ? "#9ff0c0" : "#e6fff0", drag: 0.99, line: false });
      }
      rings.push({ x: p.x, y: p.y, r0: R * 0.8, r1: R * 2.1, t0: clock, dur: 700, color: "rgba(127,212,160,", w: 3 });
      s.flash = 0.55; s.flashColor = "#7fd4a0";
      return;
    }
    const sheets = loadSheets();
    const sheetImg = o.crit && sheets?.[SHEET_FOR_STYLE[o.style]];
    if (sheetImg?.complete && sheetImg.naturalWidth) {
      sprites.push({ img: sheetImg, x: p.x, y: p.y, size: Math.max(R * 4.6, 110), rot: o.style === "arrow" ? o.bearing : 0, t0: clock });
    }
    if (!o.blade && !o.fist) {
      burst(p.x, p.y, o.color, Math.round(24 * heavy), 0.42 * heavy, 520);
      burst(p.x, p.y, "#fff6e0", Math.round(8 * heavy), 0.25, 260, { size: 1.6 });
      rings.push({ x: p.x, y: p.y, r0: R * 0.9, r1: R * (1.9 + 0.5 * heavy), t0: clock, dur: 420, color: o.ringColor || "rgba(255,240,220,", w: 2.5 * heavy });
    } else {
      burst(p.x, p.y, "#ffffff", Math.round(6 * heavy), 0.3, 200, { size: 1.4 });
    }
    if (o.embers) burst(p.x, p.y, "#ff6a28", 22, 0.3, 800, { g: -0.00012, size: 2.6 });
    if (o.crackle) { burst(p.x, p.y, hsl(o.hue, 0.95, 0.7), 14, 0.36, 380, { size: 1.5 }); burst(p.x, p.y, "#b58cff", 5, 0.24, 460, { size: 1.3 }); }
    if (o.force) rings.push({ x: p.x, y: p.y, r0: R * 0.6, r1: R * 2.8, t0: clock + 90, dur: 520, color: o.ringColor, w: 2 });
    if (o.blade) blood(p, R, o.bearing, Math.round(16 * heavy));
    if (o.fist) blood(p, R, o.bearing, 5);
    if (o.chips) burst(p.x, p.y, "#9a8a74", 10, 0.3, 600, { g: 0.0007, size: 2.2, drag: 0.95 });
    s.flash = 1; s.flashColor = "#ff4a3a";
    s.shake = { t0: clock, dur: 360, amp: Math.min(R * 0.5, 6 * heavy), bearing: o.bearing };
    s.knock = { t0: clock, dur: o.force ? 640 : 520, dist: R * (o.crit ? 0.45 : o.force ? 0.6 : 0.28), bearing: o.bearing };
    if (o.crit) boardShake = Math.max(boardShake, 7);
  }

  // A miss: the strike arrives but doesn't connect — a puff of dust past the
  // target's shoulder and a brief sidestep, no blood, flash or knockback.
  function whiff(targetId, o = {}) {
    const p = tok(targetId); if (!p) return;
    const side = (o.bearing ?? Math.PI / 2) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    const cx = p.x + Math.cos(o.bearing ?? 0) * p.r * 0.9 + Math.cos(side) * p.r * 0.8;
    const cy = p.y + Math.sin(o.bearing ?? 0) * p.r * 0.9 + Math.sin(side) * p.r * 0.8;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.02 + Math.random() * 0.04;
      spark(cx, cy, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.01, max: 650, size: 3 + Math.random() * 3, color: "rgba(200,185,160,0.35)", drag: 0.97, shrink: false, line: false, blood: true, dust: true });
    }
    state(targetId).knock = { t0: clock, dur: 420, dist: p.r * 0.35, bearing: side };
    effects.push({ t0: clock, dur: 900, draw: (k) => {
      const q = tok(targetId); if (!q) return;
      ctx.save();
      ctx.globalAlpha = k < 0.2 ? k / 0.2 : Math.max(0, 1 - (k - 0.2) / 0.8);
      ctx.font = `${Math.round(Math.max(12, q.r * 0.5))}px Cinzel, Georgia, serif`;
      ctx.textAlign = "center"; ctx.fillStyle = "#eadfc8"; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
      const y = q.y - q.r - 8 - k * 14;
      ctx.strokeText("MISS", q.x, y); ctx.fillText("MISS", q.x, y);
      ctx.restore();
    } });
  }

  // ── Sequences ─────────────────────────────────────────────────────────────
  // event = { style, crit, miss?, attackerId|null, targetId, hue }
  const busyUntil = new Map();
  function play(event) {
    if (destroyed || !event?.targetId) return;
    const { style, attackerId, targetId } = event;
    const miss = event.miss === true;
    const crit = !miss && event.crit;
    const hue = Number.isFinite(event.hue) ? event.hue : 205;
    const a = tok(attackerId), t = tok(targetId);
    if (!t) return;
    if (clock < (busyUntil.get(targetId) ?? -1) && !idle()) return;
    busyUntil.set(targetId, clock + ABSORB_MS);
    const impact = miss ? (id, o) => whiff(id, o) : hitImpact;
    const jabPop = miss ? () => {} : jabPopHit;
    const bearing = a ? Math.atan2(t.y - a.y, t.x - a.x) : Math.PI / 2;
    const common = { style, crit, bearing, hue };

    // Spell effects (no damage): a curse flies to the target and leaves the
    // hex sigil; a blessing drifts over as gold motes and leaves a gold halo.
    if (style === "curse" || style === "bless") {
      const effectHue = style === "curse" ? 275 : 45;
      const color = style === "curse" ? "#b678ec" : "#ecc970";
      if (reducedMotion || !a || attackerId === targetId) {
        sigil(targetId, 0, 1600, effectHue);
      } else if (style === "curse") {
        const ms = Math.min(620, Math.max(320, 240 + Math.hypot(t.x - a.x, t.y - a.y) * 0.45));
        charge(attackerId, color, CHARGE_MS + 60);
        projectile(attackerId, targetId, CHARGE_MS + 60, ms, "orb", color, effectHue);
        sigil(targetId, CHARGE_MS + 60 + ms - 80, 2600, effectHue);
      } else {
        charge(attackerId, color, CHARGE_MS);
        healMotes(attackerId, targetId, CHARGE_MS - 40, 520);
        sigil(targetId, CHARGE_MS + 380, 2400, effectHue);
      }
      kick();
      return;
    }

    // Reduced motion, or no attacker on this map: the impact alone.
    if (reducedMotion || !a || attackerId === targetId) {
      if (style === "heal") impact(targetId, { heal: true });
      else if (reducedMotion) { if (!miss) { const s = state(targetId); s.flash = 1; s.flashColor = "#ff4a3a"; } }
      else impact(targetId, { ...common, blade: style === "cut" || style === "chop", fist: style === "flurry", color: "#ffe0d0" });
      kick();
      return;
    }
    const dist = Math.hypot(t.x - a.x, t.y - a.y);
    const travel = (min, max, base) => Math.min(max, Math.max(min, base + dist * 0.45));

    if (style === "heal") {
      charge(attackerId, "#8fe6b2", CHARGE_MS);
      healMotes(attackerId, targetId, CHARGE_MS - 40, 520);
      at(CHARGE_MS + 380, () => impact(targetId, { heal: true }));
    } else if (style === "cut" && !crit) {
      windUp(attackerId, targetId, 300);
      lunge(attackerId, targetId, 300, 360);
      swoosh(targetId, 330, 480, bearing, { hook: true });
      at(510, () => impact(targetId, { ...common, blade: true, color: "#cfeaff" }));
    } else if (crit && (style === "cut" || style === "chop")) {
      // Crit: a gold swing down, then one back up — a tight hook for Cut, a
      // broad arc for Chop.
      windUp(attackerId, targetId, 480, style === "chop");
      lunge(attackerId, targetId, 480, 420);
      const shape = style === "cut" ? { hook: true } : { long: true };
      swoosh(targetId, 500, 500, bearing, { ...shape, color: "#ffe8b0", shade: "#c9a25e" });
      swoosh(targetId, 690, 500, bearing, { ...shape, reverse: true, color: "#ffe8b0", shade: "#c9a25e" });
      at(690, () => impact(targetId, { ...common, blade: true, chips: style === "chop", color: "#ffd27a" }));
    } else if (style === "chop") {
      windUp(attackerId, targetId, 520, true);
      lunge(attackerId, targetId, 520, 420);
      swoosh(targetId, 480, 520, bearing, { long: true, color: "#f2ece2", shade: "#a8a092" });
      at(680, () => { boardShake = Math.max(boardShake, 4); impact(targetId, { ...common, heavy: true, blade: true, chips: true, color: "#ffe6c8" }); });
    } else if (style === "flurry") {
      windUp(attackerId, targetId, 220);
      lunge(attackerId, targetId, 220, 220);
      at(300, () => jabPop(targetId, bearing, false));
      lunge(attackerId, targetId, 470, 240);
      at(560, () => { jabPop(targetId, bearing, true); impact(targetId, { ...common, fist: true, color: "#f3e6cc" }); });
    } else if (style === "arrow") {
      const ms = travel(220, 450, 160);
      windUp(attackerId, targetId, CHARGE_MS);
      projectile(attackerId, targetId, CHARGE_MS, ms, "arrow", "#ffd58c");
      at(CHARGE_MS + ms, () => impact(targetId, { ...common, color: "#ffd58c" }));
    } else if (style === "rock") {
      const ms = travel(320, 620, 240);
      windUp(attackerId, targetId, CHARGE_MS, true);
      projectile(attackerId, targetId, CHARGE_MS, ms, "rock", "#8d8272");
      at(CHARGE_MS + ms, () => impact(targetId, { ...common, fist: true, chips: true, color: "#d8cbb4" }));
    } else if (style === "fire") {
      const ms = travel(280, 520, 200);
      charge(attackerId, "#ff8a3c", CHARGE_MS + 60);
      projectile(attackerId, targetId, CHARGE_MS + 60, ms, "orb", "#ff8a3c", 20);
      at(CHARGE_MS + 60 + ms, () => impact(targetId, { ...common, heavy: true, color: "#ffb35c", embers: true }));
    } else if (style === "force") {
      charge(attackerId, hsl(hue, 0.95, 0.68), CHARGE_MS + 120);
      forceBlast(attackerId, targetId, CHARGE_MS + 80, 900, hue);
      at(CHARGE_MS + 80 + 630, () => { boardShake = Math.max(boardShake, 3); impact(targetId, { ...common, force: true, color: hsl(hue, 0.95, 0.82), ringColor: `hsla(${Math.round(hue)},95%,72%,` }); });
    // ── Creature attacks ───────────────────────────────────────────────────
    } else if (style === "bite") {
      windUp(attackerId, targetId, 300);
      lunge(attackerId, targetId, 300, 380);
      jaws(targetId, 380, 520, bearing);
      at(520, () => { impact(targetId, { ...common, blade: true, color: "#ffe6d8" }); if (!miss) blood(t, t.r, bearing, crit ? 22 : 12); });
    } else if (style === "claw") {
      windUp(attackerId, targetId, 320);
      lunge(attackerId, targetId, 320, 380);
      for (const [i, shift] of [[0, -0.45], [1, 0], [2, 0.45]]) cut(targetId, 420 + i * 45, 360, bearing, { angleOffset: 0.35, shift, color: "#ffe4c4" });
      at(470, () => impact(targetId, { ...common, blade: true, color: "#ffe4c4" }));
    } else if (style === "lash") {
      windUp(attackerId, targetId, 260);
      whip(attackerId, targetId, 260, 900, "#a3a6a8");
      at(260 + 900 * WHIP_HIT, () => {
        rings.push({ x: t.x, y: t.y, r0: t.r * 0.3, r1: t.r * 1.5, t0: clock, dur: 300, color: "rgba(255,240,210,", w: 2 });
        impact(targetId, { ...common, fist: true, color: "#f3e6cc" });
      });
    } else if (style === "sting") {
      windUp(attackerId, targetId, 320);
      stab(attackerId, targetId, 320, 420, "#d8cfa8");
      at(320 + 150, () => { impact(targetId, { ...common, blade: true, color: "#d8f5a0" }); if (!miss) splatter(t, bearing, ["#8fd14f", "#5fae2e", "#c4f08a"], crit ? 18 : 10); });
    } else if (style === "slam") {
      windUp(attackerId, targetId, 560, true);
      lunge(attackerId, targetId, 560, 460);
      at(720, () => {
        boardShake = Math.max(boardShake, crit ? 10 : 7);
        rings.push({ x: t.x, y: t.y, r0: t.r * 0.8, r1: t.r * 2.6, t0: clock, dur: 520, color: "rgba(214,196,160,", w: 4 });
        rings.push({ x: t.x, y: t.y, r0: t.r * 0.8, r1: t.r * 3.4, t0: clock + 120, dur: 620, color: "rgba(214,196,160,", w: 2 });
        burst(t.x, t.y, "rgba(190,170,140,0.6)", 16, 0.18, 800, { size: 3.5, drag: 0.96 });
        impact(targetId, { ...common, heavy: true, fist: true, chips: true, color: "#e8dcc4" });
      });
    } else if (style === "breath") {
      charge(attackerId, "#ff8a3c", CHARGE_MS + 120);
      breathCone(attackerId, targetId, CHARGE_MS + 120, 1100, { core: "rgba(255,240,200,1)", mid: "rgba(255,120,40,0.85)", ember: ["#ffb04a", "#ff5a24", "#ffd88a"] });
      at(CHARGE_MS + 120 + 420, () => impact(targetId, { ...common, heavy: true, color: "#ffb35c", embers: true }));
    } else if (style === "spit") {
      const ms = travel(300, 560, 220);
      charge(attackerId, "#9bd84f", CHARGE_MS);
      projectile(attackerId, targetId, CHARGE_MS, ms, "orb", "#8fd14f", 95, ["#b8ec7a", "#6fbf2f"]);
      at(CHARGE_MS + ms, () => { impact(targetId, { ...common, color: "#b8ec7a" }); if (!miss) splatter(t, bearing, ["#8fd14f", "#6fbf2f", "#d4f59a"], crit ? 26 : 16); });
    } else {
      // "bolt" — any other attack spell: one forked bolt, then the lingering sigil.
      charge(attackerId, hsl(hue, 0.95, 0.68), CHARGE_MS + 60);
      lightning(attackerId, targetId, CHARGE_MS + 60, 1000, hue);
      at(CHARGE_MS + 120, () => impact(targetId, { ...common, crackle: true, color: hsl(hue, 0.95, 0.82), ringColor: `hsla(${Math.round(hue)},95%,72%,` }));
      if (!miss) sigil(targetId, CHARGE_MS + 420, 2600, hue);
    }
    kick();
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  function idle() {
    if (effects.length || particles.length || rings.length || sprites.length || stains.length || boardShake > 0.2) return false;
    for (const s of fx.values()) if (s.glow > 0.02 || s.flash > 0.02 || s.shake || s.knock || s.ox || s.oy || s.scale !== 1) return false;
    return true;
  }
  function kick() {
    if (rafId !== null || destroyed) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function frame(now) {
    rafId = null;
    if (destroyed) return;
    try { renderFrame(now); }
    catch (err) {
      // Never freeze the map: drop in-flight effects and settle every token.
      console.error("[combatFx] frame failed", err);
      effects.length = 0; rings.length = 0; sprites.length = 0; particles.length = 0;
      for (const [id, s] of fx) { Object.assign(s, { ox: 0, oy: 0, scale: 1, shake: null, knock: null, glow: 0, flash: 0 }); adapter.setMotion(id, { dx: 0, dy: 0, scale: 1 }); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0;
      ctx.clearRect(0, 0, W, H);
      return;
    }
    if (!idle()) rafId = requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W, H); fx.clear(); }
  }

  function renderFrame(now) {
    const dt = Math.min(50, now - last) * timeScale;
    last = now;
    clock += dt;
    resize();
    ctx.clearRect(0, 0, W, H);
    const visible = adapter.isVisible?.() !== false && W > 0 && H > 0;

    ctx.save();
    if (boardShake > 0.2) { ctx.translate((Math.random() - 0.5) * boardShake, (Math.random() - 0.5) * boardShake); boardShake *= Math.pow(0.99, dt); } else boardShake = 0;

    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      if (clock < e.t0) continue;
      if (e.fn) { e.fn(); effects.splice(i, 1); continue; }
      const k = clamp01((clock - e.t0) / e.dur);
      e.tick?.(k);
      if (k >= 1) { e.end?.(); effects.splice(i, 1); }
    }

    // stains (under everything else)
    for (let i = stains.length - 1; i >= 0; i--) {
      const st = stains[i], k = (clock - st.t0) / 2600;
      if (k >= 1) { stains.splice(i, 1); continue; }
      if (!visible) continue;
      ctx.globalAlpha = 0.75 * (1 - k); ctx.fillStyle = st.color;
      ctx.beginPath(); ctx.ellipse(st.x, st.y, st.r * 1.3, st.r, st.a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // token motion (applied to the real DOM tokens) + glow/flash overlays
    for (const [id, s] of fx) {
      s.glow *= Math.pow(0.992, dt); s.flash *= Math.pow(0.991, dt);
      let sx = 0, sy = 0, kx = 0, ky = 0;
      if (s.shake) {
        const k = (clock - s.shake.t0) / s.shake.dur;
        if (k >= 1) s.shake = null;
        else { const amp = s.shake.amp * (1 - k); sx = Math.cos(s.shake.bearing) * amp * Math.sin(k * 40); sy = Math.sin(s.shake.bearing) * amp * Math.sin(k * 40); }
      }
      if (s.knock) {
        const k = (clock - s.knock.t0) / s.knock.dur;
        if (k >= 1) s.knock = null;
        else { const e = k < 0.25 ? easeOut(k / 0.25) : 1 - easeOut((k - 0.25) / 0.75); kx = Math.cos(s.knock.bearing) * s.knock.dist * e; ky = Math.sin(s.knock.bearing) * s.knock.dist * e; }
      }
      const dx = s.ox + sx + kx, dy = s.oy + sy + ky;
      adapter.setMotion(id, { dx, dy, scale: s.scale });
      const t = visible ? tok(id) : null;
      if (!t) continue;
      const x = t.x + dx, y = t.y + dy, R = t.r * s.scale;
      if (s.glow > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const gg = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 2.1);
        gg.addColorStop(0, withAlpha(s.glowColor, 0.55 * s.glow)); gg.addColorStop(1, withAlpha(s.glowColor, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, R * 2.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (s.flash > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = s.flash * 0.75;
        ctx.fillStyle = s.flashColor; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }

    if (visible) for (const e of effects) { if (e.draw && clock >= e.t0) e.draw(clamp01((clock - e.t0) / e.dur)); }

    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], k = (clock - r.t0) / r.dur;
      if (k >= 1) { rings.splice(i, 1); continue; }
      if (k < 0 || !visible) continue;
      ctx.strokeStyle = r.color + (1 - k) * 0.8 + ")"; ctx.lineWidth = r.w * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(0, lerp(r.r0, r.r1, easeOut(k))), 0, Math.PI * 2); ctx.stroke();
    }
    // crit art-pack sprites: 192px frames, 5 columns, 30fps
    for (let i = sprites.length - 1; i >= 0; i--) {
      const sp = sprites[i], frames = Math.round(sp.img.naturalHeight / 192) * 5, f = Math.floor((clock - sp.t0) / 33);
      if (f >= frames) { sprites.splice(i, 1); continue; }
      if (!visible) continue;
      ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(sp.rot);
      ctx.drawImage(sp.img, (f % 5) * 192, Math.floor(f / 5) * 192, 192, 192, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
      ctx.restore();
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life += dt;
      if (p.life >= p.max) {
        if (p.blood && !p.dust) stains.push({ x: p.x, y: p.y, r: p.size * 0.9, a: Math.random() * Math.PI, color: "#5a0c0c", t0: clock });
        particles.splice(i, 1); continue;
      }
      if (p.to) { const c = tok(p.to); if (c) { p.vx += (c.x - p.x) * 0.00006 * dt; p.vy += (c.y - p.y) * 0.00006 * dt; } }
      p.vy += p.g * dt;
      const drag = Math.pow(p.drag, dt / 16); p.vx *= drag; p.vy *= drag;
      const px = p.x, py = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
      if (!visible) continue;
      const k = 1 - p.life / p.max;
      ctx.globalCompositeOperation = p.blood ? "source-over" : "lighter";
      ctx.globalAlpha = p.blood ? Math.min(1, k * 3) : Math.min(1, k * 1.4);
      if (p.line && Math.hypot(p.x - px, p.y - py) > 1) {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * (p.shrink ? k : 1); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(px - (p.x - px) * 2, py - (p.y - py) * 2); ctx.lineTo(p.x, p.y); ctx.stroke();
      } else {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, p.size * (p.shrink ? k : 1)), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.restore();
    ctx.restore();
  }

  return {
    play,
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      for (const id of fx.keys()) adapter.setMotion(id, { dx: 0, dy: 0, scale: 1 });
      fx.clear();
    },
  };
}

// "#rrggbb" or any CSS colour string → rgba()/hsla() with alpha.
function withAlpha(color, a) {
  if (typeof color === "string" && color.startsWith("#") && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  if (typeof color === "string" && color.startsWith("hsla(")) return color.replace(/,[\d.]+\)$/, `,${a})`);
  return color;
}
