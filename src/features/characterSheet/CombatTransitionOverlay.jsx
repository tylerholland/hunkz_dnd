import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./combatTransition.css";

// Timing constants (ms)
const PHASE_OUT_DELAY = 2440; // hold duration before shutters open
                               // = shutter-close (260) + text-delay (200) + hold (1980)

export default function CombatTransitionOverlay({ type }) {
  const [phase, setPhase] = useState("in");

  useEffect(() => {
    setPhase("in");
    const t = setTimeout(() => setPhase("out"), PHASE_OUT_DELAY);
    return () => clearTimeout(t);
  }, [type]);

  if (!type) return null;

  return createPortal(
    <div className={`cto cto--${type} cto--phase-${phase}`} aria-hidden="true">
      <div className="cto__half cto__half--top" />
      <div className="cto__half cto__half--bottom" />
      <div className="cto__content">
        <div className="cto__rule">── ◆ ─────── ◆ ──</div>
        <h2 className="cto__title">
          {type === "entering" ? "Entering Combat" : "Leaving Combat"}
        </h2>
        <p className="cto__subtitle">
          {type === "entering" ? "Prepare for battle" : "Combat has ended"}
        </p>
        <div className="cto__rule">── ◆ ─────── ◆ ──</div>
      </div>
    </div>,
    document.body
  );
}
