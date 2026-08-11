/**
 * RollOverlay — Story 57 (brief §5 "Roll overlay").
 *
 * A centred, full-viewport roll-landing moment, Attack-Bar-only. Reuses
 * DiceRoller's cycling-number *mechanic* (a ~90ms interval swapping a
 * random face value, settling on the real total once it's known) at a
 * larger scale — not DiceRoller's own internal state, which isn't exposed
 * outside that component (ADR-027: `executeRoll` is not forked, and this
 * overlay does not touch it). Driven purely by `playing`/`result` props:
 * cycles while `playing && !result`, settles + auto-dismisses ~400ms after
 * `result` arrives. This makes it correct regardless of exactly how long
 * the real roll takes to resolve (single vs. multi-group), rather than
 * hard-coding DiceRoller's internal resolveTime formula.
 *
 * Non-goal (brief §5): the roller's own panel — weapon quick-roll buttons,
 * Free Roll, ability checks — is completely unaffected; this is a new,
 * separate surface.
 */
import { useEffect, useRef, useState } from "react";
import { rollDie } from "./DiceRoller";

const CYCLE_MS = 90;
const SETTLE_HOLD_MS = 400;

export default function RollOverlay({ pal, playing, result, onDismiss }) {
  const [cycleNum, setCycleNum] = useState(null);
  const cycleRef = useRef(null);
  const dismissRef = useRef(null);

  useEffect(() => {
    if (!playing) return undefined;
    if (result) return undefined; // settled — stop cycling
    setCycleNum(rollDie(20));
    cycleRef.current = setInterval(() => setCycleNum(rollDie(20)), CYCLE_MS);
    return () => {
      if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
    };
  }, [playing, result]);

  useEffect(() => {
    if (!playing || !result) return undefined;
    if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
    dismissRef.current = setTimeout(() => onDismiss?.(), SETTLE_HOLD_MS);
    return () => clearTimeout(dismissRef.current);
  }, [playing, result, onDismiss]);

  useEffect(() => () => {
    if (cycleRef.current) clearInterval(cycleRef.current);
    if (dismissRef.current) clearTimeout(dismissRef.current);
  }, []);

  if (!playing) return null;

  const displayValue = result ? result.total : cycleNum ?? "?";
  const resultColor = result?.isCrit ? "#ffd060" : result?.isFumble ? "#c06060" : pal.gem;
  const numAnim = result?.isCrit
    ? "dr-crit-pulse 0.7s ease-out"
    : result?.isFumble
    ? "dr-fumble-shake 0.5s ease-out"
    : undefined;

  return (
    <div className="cs-roll-overlay" onClick={() => result && onDismiss?.()}>
      <div className="cs-roll-overlay-scrim" />
      <div className="cs-roll-overlay-number" style={{ color: resultColor, animation: numAnim }}>
        {displayValue}
      </div>
      {result?.isCrit && <div className="cs-roll-overlay-tag cs-roll-overlay-tag--crit">✦ CRITICAL HIT ✦</div>}
      {result?.isFumble && <div className="cs-roll-overlay-tag cs-roll-overlay-tag--fumble">✕ FUMBLE ✕</div>}
    </div>
  );
}
