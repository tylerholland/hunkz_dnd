// The combat quick start (design/prototypes/combat-quickstart.html): a short
// illustrated step-through for players or the DM. Opened from ⋯ → "Combat
// quick start", and offered once per device the first time someone sees
// combat (CombatGuideOffer). It only explains; nothing in the game changes.
import { useEffect, useRef, useState } from "react";
import { COMBAT_GUIDES, markCombatGuideSeen } from "./combatGuideSteps";
import "./combatGuide.css";

export default function CombatGuide({ who, onClose }) {
  const steps = COMBAT_GUIDES[who] || COMBAT_GUIDES.player;
  const [i, setI] = useState(0);
  const nextRef = useRef(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  function close() {
    markCombatGuideSeen(who);
    onClose();
  }

  // Keys reach the latest step without re-binding mid-step.
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") closeRef.current();
      else if (e.key === "ArrowRight") setI((n) => Math.min(steps.length - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [steps.length]);
  useEffect(() => { nextRef.current?.focus(); }, [i]);

  return (
    <div className="cg-shade" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="cg-guide" role="dialog" aria-modal="true" aria-labelledby="cg-title">
        <div className="cg-head">
          <span className="cg-kicker">Combat quick start · {who === "dm" ? "DM" : "Players"} · Step {i + 1} of {steps.length}</span>
          <button type="button" className="cg-close" aria-label="Close the guide" onClick={close}>✕</button>
        </div>
        <div className="cg-art" aria-hidden="true">{step.art}</div>
        <div className="cg-body">
          <h3 id="cg-title">{step.title}</h3>
          {step.body.map((p, n) => <p key={n}>{p}</p>)}
          {step.tip && <p className="cg-tip">{step.tip}</p>}
        </div>
        <div className="cg-foot">
          <div className="cg-dots">
            {steps.map((s, n) => (
              <button key={s.title} type="button" className={n === i ? "on" : ""} aria-label={`Step ${n + 1}: ${s.title}`} aria-current={n === i ? "step" : undefined} onClick={() => setI(n)} />
            ))}
          </div>
          <button type="button" className="cg-btn" disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))}>Back</button>
          <button ref={nextRef} type="button" className="cg-btn primary" onClick={() => (last ? close() : setI((n) => Math.min(steps.length - 1, n + 1)))}>{last ? "Done" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}

/** The once-per-device offer, shown the first time someone sees combat. */
export function CombatGuideOffer({ who, onOpen, onDismiss }) {
  return (
    <div className="cg-offer">
      <span>New to combat here?</span>
      <button type="button" className="cg-offer-open" onClick={onOpen}>Quick start ›</button>
      <button type="button" className="cg-offer-x" aria-label="Dismiss" onClick={() => { markCombatGuideSeen(who); onDismiss(); }}>✕</button>
    </div>
  );
}
