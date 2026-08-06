import { useLayoutEffect, useRef } from "react";
import { TRACER_UNIT_PX, BOLT_CORE_COLOR } from "./tokenEffects";

/**
 * TracerLayer — Story 55, L4. Mounted as the FIRST child of
 * `tokenLayerChildren` on both MapPanel.jsx (DM) and PlayerMapViewer
 * (CharacterSheetSessionMode.jsx), in natural-image pixel space, below the
 * token chips in z-order (explicit z-index: 4 vs. .token-chip's 10 — never
 * relying on document order alone).
 *
 * Renders only the currently-playing "Bolt" tracers — a Strike (melee) has
 * nothing that travels; its lunge/chevrons live on the attacker's TokenChip
 * and its impact crescent lives on the target's TokenChip (both inside
 * .token-chip's existing counter-rotation, per the brief's composition
 * rules). Not mounted at all when there are no live bolts — no idle
 * compositor cost, no will-change at rest.
 *
 * The SVG is sized to the union bounding box of live tracer geometry + 1U
 * margin, never the full natural image (a 6000px-wide SVG per tracer would
 * be a memory hazard, not a micro-optimisation, per Architect Notes).
 */
export default function TracerLayer({ events, reducedMotion }) {
  const bolts = (events || []).filter((e) => e.kind === "bolt");
  if (bolts.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of bolts) {
    const { ax, ay, tx, ty, U } = e.geom;
    minX = Math.min(minX, ax, tx) - U;
    minY = Math.min(minY, ay, ty) - U;
    maxX = Math.max(maxX, ax, tx) + U;
    maxY = Math.max(maxY, ay, ty) + U;
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return (
    <svg
      className="tracer-layer"
      aria-hidden="true"
      style={{ left: minX, top: minY, width, height }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      {bolts.map((event) => (
        <TracerBolt
          key={`${event.attackerTokenId}-${event.targetTokenId}`}
          event={event}
          reducedMotion={reducedMotion}
        />
      ))}
    </svg>
  );
}

// One traveling bolt = 3 stroked paths (shade / glow / core), each drawn as
// a dash-offset sweep (rim-to-rim, gentle quadratic sag) — the exact
// technique reviewed in design/prototypes/token-effects-review.html's
// mirrored board (boltGeometry()/fireBoardTracer()). Imperative dash setup
// via refs in a layout effect (not React state) — getTotalLength() is a DOM
// read, and setting the dash pattern before first paint avoids a one-frame
// flash of a fully-drawn line.
function TracerBolt({ event, reducedMotion }) {
  const { geom, startDelayMs, travelMs, tint } = event;
  const { ax, ay, tx, ty, ux, uy, rA, rB, dist, gap, U } = geom;
  const p0x = ax + ux * rA, p0y = ay + uy * rA;
  const p2x = tx - ux * rB, p2y = ty - uy * rB;
  const sag = Math.min(0.10 * dist, 2.5 * U);
  const nx = -uy, ny = ux;
  const mx = (p0x + p2x) / 2 + nx * sag;
  const my = (p0y + p2y) / 2 + ny * sag;
  const d = `M${p0x.toFixed(1)},${p0y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`;

  const coreW = Math.max(0.6, 0.09 * U);
  const glowW = Math.max(1.2, 0.32 * U);
  const shadeW = Math.max(1, 0.15 * U);
  const glowColor = tint || BOLT_CORE_COLOR;

  const shadeRef = useRef(null);
  const glowRef = useRef(null);
  const coreRef = useRef(null);

  useLayoutEffect(() => {
    const paths = [shadeRef.current, glowRef.current, coreRef.current].filter(Boolean);
    if (paths.length === 0) return undefined;

    if (reducedMotion) {
      // Story 55 §11 — complete static path, instant, held @0.75 opacity
      // (draw/scale animation removed; the spatial relationship, the whole
      // point of the bolt, must survive).
      paths.forEach((p) => {
        p.style.transition = "none";
        p.style.opacity = "0.75";
        p.removeAttribute("stroke-dasharray");
        p.removeAttribute("stroke-dashoffset");
      });
      return undefined;
    }

    const dashLen = Math.min(Math.max(0.45 * gap, 1.2 * U), 6 * U);
    const timers = [];
    paths.forEach((p) => {
      const len = p.getTotalLength();
      const sweepGap = 2 * len + 2 * dashLen + 10; // never wraps within one sweep
      p.style.transition = "none";
      p.setAttribute("stroke-dasharray", `${dashLen} ${sweepGap}`);
      p.setAttribute("stroke-dashoffset", `${len + dashLen}`);
      const timer = setTimeout(() => {
        p.style.transition = `stroke-dashoffset ${travelMs}ms cubic-bezier(0.4, 0, 0.7, 0.35)`;
        requestAnimationFrame(() => {
          p.setAttribute("stroke-dashoffset", `${-(len + dashLen)}`);
        });
      }, startDelayMs);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, startDelayMs, travelMs, reducedMotion]);

  return (
    <>
      <path ref={shadeRef} d={d} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={shadeW} strokeLinecap="round" />
      <path ref={glowRef} d={d} fill="none" stroke={glowColor} strokeOpacity={0.7} strokeWidth={glowW} strokeLinecap="round" />
      <path ref={coreRef} d={d} fill="none" stroke={BOLT_CORE_COLOR} strokeWidth={coreW} strokeLinecap="round" />
    </>
  );
}

// Exported for reuse by MapPanel/PlayerMapViewer when computing --lunge-x/y
// and chevron/crescent placement on the attacker/target TokenChips — kept
// here (not tokenEffects.js) since it's a rendering-unit constant, not a
// gameplay rule.
export const TRACER_TOKEN_UNIT_PX = TRACER_UNIT_PX;
