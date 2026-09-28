import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { rollDiceExpr } from "./actionOptions";
import "./takeAction.css";

function palVars(pal) {
  return {
    "--pal-bg": pal.bg,
    "--pal-surface": pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border": pal.border,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-text": pal.text,
    "--pal-text-body": pal.textBody,
    "--pal-text-muted": pal.textMuted,
    "--font-display": pal.fontDisplay,
    "--font-body": pal.fontBody,
    "--font-ui": pal.fontUI,
  };
}

/**
 * ADR-032 — the one damage/heal pop-up behind both DM entry points: an
 * action picked on the map, and "Deal Damage" on a player's roll in the log.
 * Roll (optional) → adjust (½ / ×2 / ±) → Apply, or Miss.
 */
export default function DealDamageModal({
  pal,
  actorName,
  targetName,
  targetHp, // { current, max }
  actionName,
  heal = false,
  initialExpr = "",
  rememberedExpr = false,
  initialAmount = null,
  initialCrit = false,
  fromRoll = null, // { exprLabel, total, isCrit } when opened from the roll log
  onRoll, // (result) => void — posts the roll to history
  onApply, // ({ amount, crit }) => void
  onMiss, // () => void
  onClose,
}) {
  const titleId = useId();
  const [expr, setExpr] = useState(initialExpr);
  const [amount, setAmount] = useState(initialAmount ?? 0);
  const [crit, setCrit] = useState(initialCrit && !heal);
  const [rolled, setRolled] = useState(null);
  const [error, setError] = useState("");
  const exprRef = useRef(null);
  const amountRef = useRef(null);
  const self = actorName === targetName;

  useEffect(() => {
    (fromRoll ? amountRef : exprRef).current?.focus();
    // focus once on open
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const n = Math.max(0, parseInt(amount, 10) || 0);
  const hp = Math.max(0, targetHp?.current ?? 0);
  const max = Math.max(1, targetHp?.max ?? 1);
  const next = heal ? Math.min(max, hp + n) : Math.max(0, hp - n);
  const pctNow = (Math.min(hp, next) / max) * 100;
  const pctGhost = (Math.abs(next - hp) / max) * 100;

  function roll() {
    const result = rollDiceExpr(expr, { crit: crit && !heal });
    if (!result) { setError("Use a format like 2d6+3."); return; }
    setError("");
    setRolled(result);
    setAmount(result.total);
    onRoll?.(result, expr.trim());
  }

  function apply() {
    if (n <= 0) return;
    onApply({ amount: n, crit: crit && !heal });
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const adjust = (fn) => setAmount((value) => Math.max(0, fn(Math.max(0, parseInt(value, 10) || 0))));

  return createPortal(
    <div
      className="ta-overlay"
      style={palVars(pal)}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`ta-modal${heal ? " ta-modal--heal" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ta-modal-head">
          <h2 id={titleId} className="ta-modal-title">
            {actorName}<span className="ta-arrow">→</span>{self ? "Self" : targetName}
          </h2>
          <p className="ta-modal-sub">{actionName}{heal ? " · healing" : ""}</p>
        </div>

        <div className="ta-hp">
          <div className="ta-hp-line">
            <span>{targetName}</span>
            <span><b>{hp} → {next}</b> / {max} HP</span>
          </div>
          <div className="ta-hp-bar" aria-hidden="true">
            <div className="ta-hp-now" style={{ width: `${pctNow}%` }} />
            <div className="ta-hp-ghost" style={{ left: `${pctNow}%`, width: `${pctGhost}%` }} />
          </div>
        </div>

        {fromRoll && (
          <p className="ta-source">
            From {actorName}&apos;s roll: <b>{fromRoll.exprLabel}</b> → {fromRoll.total}
            {fromRoll.isCrit ? " (critical hit)" : ""}.
          </p>
        )}

        <div className="ta-field">
          <label className="ta-label" htmlFor={`${titleId}-dice`}>
            {fromRoll ? "Roll again (optional)" : "Dice"}
            {rememberedExpr ? ` · last used for ${actorName}` : ""}
          </label>
          <div className="ta-dice-row">
            <input
              id={`${titleId}-dice`}
              ref={exprRef}
              className="ta-dice-input"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); roll(); } }}
              placeholder="2d6+3"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="ta-btn" onClick={roll}>Roll</button>
          </div>
          <div className="ta-roll-out" aria-live="polite">
            {error || (rolled
              ? <>{rolled.exprLabel} → [{rolled.rollValues.join(", ")}]{rolled.flat ? ` ${rolled.flat > 0 ? "+" : "−"}${Math.abs(rolled.flat)}` : ""} = <b>{rolled.total}</b></>
              : (crit ? "Crit: the dice are doubled when you roll." : ""))}
          </div>
        </div>

        <div className="ta-field">
          <span className="ta-label">{heal ? "Healing" : "Damage"}</span>
          <div className="ta-amount-row">
            <div className="ta-stepper">
              <button type="button" aria-label="Less" onClick={() => adjust((v) => v - 1)}>−</button>
              <input
                ref={amountRef}
                type="number"
                inputMode="numeric"
                min="0"
                aria-label={heal ? "Healing amount" : "Damage amount"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
              />
              <button type="button" aria-label="More" onClick={() => adjust((v) => v + 1)}>+</button>
            </div>
            {!heal && (
              <>
                <button type="button" className="ta-btn" title="Resistance" onClick={() => adjust((v) => Math.floor(v / 2))}>½</button>
                <button type="button" className="ta-btn" title="Vulnerability" onClick={() => adjust((v) => v * 2)}>×2</button>
                <button type="button" className="ta-toggle" aria-pressed={crit} onClick={() => setCrit((c) => !c)}>Crit</button>
              </>
            )}
          </div>
        </div>

        <div className="ta-foot">
          {!heal && onMiss && <button type="button" className="ta-btn ta-btn--quiet" onClick={onMiss}>Miss</button>}
          <span className="ta-spacer" />
          <button type="button" className="ta-btn ta-btn--quiet" onClick={onClose}>Cancel</button>
          <button type="button" className="ta-btn ta-btn--primary" disabled={n <= 0} onClick={apply}>
            {heal ? "Apply Healing" : "Apply Damage"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
