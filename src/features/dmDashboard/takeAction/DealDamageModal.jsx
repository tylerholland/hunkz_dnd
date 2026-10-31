import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { rollDiceExpr } from "./actionOptions";
import { attackHits, defenseLabel } from "../npcStats";
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
 * With an attack roll (design/prototypes/npc-attacks.html) it first rolls to
 * hit against the target's defense — an AC, or a defense roll rolled at the
 * same time — and suggests Hit or Miss; the DM decides. Opened from a
 * player's roll, it compares their to-hit with the creature's defense.
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
  fromRoll = null, // { exprLabel, total, isCrit, hitTotal } when opened from the roll log
  attackExpr = null, // the whole attack roll, e.g. "1d20+8" (DM-rolled actions)
  targetDefense = null, // { kind: "ac", ac } | { kind: "roll", roll, name } | null
  onAttackRoll, // (result) => void — posts the attack roll to history
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
  const [atkExpr, setAtkExpr] = useState(attackExpr || "");
  const [attack, setAttack] = useState(null); // { result, defenseTotal, natural }
  const [defenseRoll, setDefenseRoll] = useState(null); // vs a player's to-hit
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

  // Roll to hit (and the target's defense roll, if it has one, at the same time).
  function rollAttack() {
    const result = rollDiceExpr(atkExpr);
    if (!result) { setError("Use a format like 1d20+4 for the attack roll."); return; }
    setError("");
    const defenseResult = targetDefense?.kind === "roll" ? rollDiceExpr(targetDefense.roll) : null;
    // A single d20: a natural 20 is a crit, a natural 1 a miss.
    const natural = result.groups.length === 1 && result.groups[0].sides === 20 && result.groups[0].rolls.length === 1 ? result.groups[0].rolls[0] : null;
    if (natural === 20) setCrit(true);
    setAttack({ result, defenseTotal: defenseResult?.total ?? null, natural });
    onAttackRoll?.(result, atkExpr.trim());
  }
  const attackVerdict = attack
    ? (attack.natural === 20 ? true : attack.natural === 1 ? false : attackHits(attack.result.total, targetDefense, attack.defenseTotal))
    : null;
  const playerVerdict = fromRoll && Number.isFinite(fromRoll.hitTotal) && targetDefense
    ? attackHits(fromRoll.hitTotal, targetDefense, defenseRoll?.total ?? null)
    : null;
  const suggestMiss = attackVerdict === false || playerVerdict === false;
  const vsText = (defenseTotal) => !targetDefense ? "no defense set: your call"
    : targetDefense.kind === "ac" ? `vs ${targetName}'s AC ${targetDefense.ac}`
    : `vs ${targetName}'s ${targetDefense.name} ${defenseTotal ?? targetDefense.roll}`;

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

        {!heal && attackExpr != null && (
          <div className="ta-attack">
            <label className="ta-label" htmlFor={`${titleId}-atk`}>Attack roll {targetDefense ? `· vs ${defenseLabel(targetDefense)}` : ""}</label>
            <div className="ta-dice-row">
              <input id={`${titleId}-atk`} className="ta-dice-input" value={atkExpr} onChange={(e) => setAtkExpr(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rollAttack(); } }} placeholder="1d20+4" autoComplete="off" spellCheck={false} />
              <button type="button" className="ta-btn" onClick={rollAttack}>{attack ? "↺ Again" : "Roll to hit"}</button>
            </div>
            {attack && (
              <div className="ta-attack-row" aria-live="polite">
                <span className="ta-attack-total">{attack.result.total}</span>
                <span className="ta-attack-vs">{vsText(attack.defenseTotal)}</span>
                {attackVerdict != null && <span className={`ta-verdict ta-verdict--${attackVerdict ? "hit" : "miss"}`}>{attackVerdict ? "Hits" : "Misses"}</span>}
                {attack.natural === 20 && <span className="ta-attack-note">Natural 20: a critical hit (Crit is on).</span>}
                {attack.natural === 1 && <span className="ta-attack-note">Natural 1: a miss.</span>}
                {attackVerdict != null && attack.natural == null && <span className="ta-attack-note">A suggestion: you decide.</span>}
              </div>
            )}
          </div>
        )}

        {fromRoll && Number.isFinite(fromRoll.hitTotal) && targetDefense && (
          <div className="ta-attack">
            <div className="ta-attack-row" aria-live="polite">
              <span className="ta-attack-vs">{actorName}&apos;s attack <b>{fromRoll.hitTotal}</b> {vsText(defenseRoll?.total)}</span>
              {targetDefense.kind === "roll" && (
                <button type="button" className="ta-btn" onClick={() => setDefenseRoll(rollDiceExpr(targetDefense.roll))}>{defenseRoll ? "↺" : `Roll ${targetDefense.name}`}</button>
              )}
              {playerVerdict != null && <span className={`ta-verdict ta-verdict--${playerVerdict ? "hit" : "miss"}`}>{playerVerdict ? "Hits" : "Misses"}</span>}
            </div>
          </div>
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
          {!heal && onMiss && <button type="button" className={`ta-btn ${suggestMiss ? "ta-btn--primary" : "ta-btn--quiet"}`} onClick={onMiss}>Miss</button>}
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
