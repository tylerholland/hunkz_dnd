import { useEffect, useRef } from "react";
import { createFxEngine } from "./fxEngine";
import "./combatFx.css";

const PLAYED_MEMORY = 200;

// One canvas over a map viewport (ADR-031). Plays each strike event exactly
// once (by id) — later polls that still carry the same event can't replay or
// cut it off. Tokens stay DOM chips: the adapter reads their live screen
// position and moves them through --fx-x / --fx-y on their .tk-lunge
// wrapper, converted into the map frame (viewer scale + rotation).
export default function CombatFxLayer({ events, rotation = 0, reducedMotion = false }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const playedRef = useRef(new Set());
  const appliedRef = useRef(new Map()); // tokenId -> { dx, dy } currently applied (screen px)
  const rotationRef = useRef(rotation);

  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const root = () => canvas.parentElement;
    const findChip = (id) => root()?.querySelector(`[data-fx-token="${CSS.escape(String(id))}"]`) || null;

    const viewerScale = () => {
      const layer = root()?.querySelector(".token-layer");
      if (!layer || !layer.offsetWidth) return 1;
      const rect = layer.getBoundingClientRect();
      const quarterTurn = ((Math.round(rotationRef.current / 90) % 2) + 2) % 2 === 1;
      return rect.width / (quarterTurn ? layer.offsetHeight : layer.offsetWidth) || 1;
    };

    const adapter = {
      isVisible: () => canvas.offsetWidth > 0 && canvas.offsetHeight > 0,
      getToken(id) {
        const chip = findChip(id);
        if (!chip) return null;
        const r = chip.getBoundingClientRect();
        if (!r.width) return null;
        const c = canvas.getBoundingClientRect();
        const applied = appliedRef.current.get(id) || { dx: 0, dy: 0 };
        return { x: r.left + r.width / 2 - c.left - applied.dx, y: r.top + r.height / 2 - c.top - applied.dy, r: r.width / 2 };
      },
      setMotion(id, { dx, dy, scale }) {
        const chip = findChip(id);
        const wrap = chip?.closest(".tk-lunge");
        const rest = Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05;
        if (wrap) {
          if (rest) {
            wrap.style.removeProperty("--fx-x");
            wrap.style.removeProperty("--fx-y");
            wrap.removeAttribute("data-fx");
          } else {
            wrap.setAttribute("data-fx", "1");
            // screen offset → map frame: undo the viewer's rotation and scale
            const s = viewerScale();
            const rad = (-rotationRef.current * Math.PI) / 180;
            const lx = (dx * Math.cos(rad) - dy * Math.sin(rad)) / s;
            const ly = (dx * Math.sin(rad) + dy * Math.cos(rad)) / s;
            wrap.style.setProperty("--fx-x", `${lx.toFixed(2)}px`);
            wrap.style.setProperty("--fx-y", `${ly.toFixed(2)}px`);
          }
        }
        if (chip) {
          if (Math.abs(scale - 1) > 0.001) chip.style.setProperty("--token-drag-scale", scale.toFixed(3));
          else chip.style.removeProperty("--token-drag-scale");
        }
        if (rest) appliedRef.current.delete(id);
        else appliedRef.current.set(id, { dx, dy });
      },
    };

    engineRef.current = createFxEngine(canvas, adapter, { reducedMotion });
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [reducedMotion]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !Array.isArray(events)) return;
    const played = playedRef.current;
    for (const event of events) {
      if (!event?.id || played.has(event.id)) continue;
      played.add(event.id);
      engine.play(event);
    }
    if (played.size > PLAYED_MEMORY) {
      const keep = [...played].slice(-PLAYED_MEMORY / 2);
      playedRef.current = new Set(keep);
    }
  }, [events]);

  return <canvas ref={canvasRef} className="combat-fx-layer" aria-hidden="true" />;
}
