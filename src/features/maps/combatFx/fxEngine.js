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
const SHEET_FOR_STYLE = { cut: "slash", chop: "slash", flurry: "punch", arrow: "thrust", rock: "punch", fire: "punch", force: "punch", bolt: "punch" };
// A new hit on a token whose strike is still playing is absorbed (slow −/+
// taps would otherwise stack several swings from the same attacker).
const ABSORB_MS = 1100;

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
      const x0 = p.x - (cx * L) / 2, y0 = p.y - (cy * L) / 2;
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
  function projectile(attId, targetId, start, ms, kind, color, hue) {
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
        for (let i = 0; i < 3; i++) spark(x, y, { vx: (Math.random() - 0.5) * 0.08 - ux * 0.05, vy: (Math.random() - 0.5) * 0.08 - uy * 0.05 - 0.02, max: 420, size: 2 + Math.random() * 2.5, color: Math.random() < 0.5 ? "#ffb04a" : "#ff5a24", line: false });
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
      cut(targetId, 400, 360, bearing);
      at(430, () => impact(targetId, { ...common, blade: true, color: "#cfeaff" }));
    } else if (style === "cut" || (style === "chop" && crit)) {
      windUp(attackerId, targetId, 480, style === "chop");
      lunge(attackerId, targetId, 480, 420);
      cut(targetId, 590, 380, bearing, { long: true, angleOffset: 0.55, color: "#ffe2a0" });
      cut(targetId, 700, 380, bearing, { long: true, angleOffset: -0.55, color: "#ffe2a0" });
      at(620, () => impact(targetId, { ...common, blade: true, chips: style === "chop", color: "#ffd27a" }));
    } else if (style === "chop") {
      windUp(attackerId, targetId, 520, true);
      lunge(attackerId, targetId, 520, 420);
      cut(targetId, 640, 420, bearing, { long: true, angleOffset: -Math.PI / 2, color: "#ffe6c8", heavy: true });
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
