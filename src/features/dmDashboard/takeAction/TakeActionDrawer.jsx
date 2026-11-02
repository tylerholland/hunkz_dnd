import { useId, useState } from "react";
import { ALL_CONDITIONS } from "../dashboardShared";
import LookIcon from "../LookIcon";
import "./takeAction.css";

function ActionChip({ action, glyph, icon, onPick, variant }) {
  return (
    <button
      type="button"
      className={`ta-chip${variant ? ` ta-chip--${variant}` : ""}`}
      onClick={() => onPick(action)}
    >
      {glyph && <span className="ta-chip-glyph" aria-hidden="true">{glyph}</span>}
      {icon && <span className="ta-chip-glyph" aria-hidden="true">{icon}</span>}
      {action.name}
      {action.own
        ? <span className="ta-chip-meta">{action.hit} · {action.dice}</span>
        : (action.toHit || action.dice) && <span className="ta-chip-meta">{action.toHit || action.dice}</span>}
    </button>
  );
}

/**
 * ADR-032 — the DM's Take Action drawer under the battle map.
 * idle → a one-line hint; target → "Select target"; pick → the actor's actions.
 * At the target step the long-pressed token can also be handled directly —
 * Damage, Heal, or its conditions — like the buttons on its card.
 */
export default function TakeActionDrawer({ step, actorName, targetName, self, groups, onPick, onTargetSelf, onRetarget, onCancel, conditions = [], onDirect, onToggleCondition }) {
  const magicId = useId();
  const [condOpen, setCondOpen] = useState(false);

  if (step === "idle") {
    return (
      <div className="ta-drawer ta-drawer--idle">
        <p className="ta-hint">Long-press a token to take an action with it. Tap and drag still moves tokens.</p>
      </div>
    );
  }

  if (step === "target") {
    return (
      <div className="ta-drawer" aria-live="polite">
        <div className="ta-drawer-head">
          <h3 className="ta-drawer-title">{actorName}</h3>
          <span className="ta-drawer-cue">Select target</span>
          <span className="ta-spacer" />
          <button type="button" className="ta-chip ta-chip--ghost" onClick={onTargetSelf}>Target self</button>
          <button type="button" className="ta-chip ta-chip--ghost" onClick={onCancel}>Cancel</button>
        </div>
        <p className="ta-hint">Long-press (or tap) the token {actorName} is acting on.</p>
        {onDirect && (
          <div className="ta-direct">
            <span className="ta-direct-label">Or on {actorName} directly</span>
            <button type="button" className="ta-chip ta-chip--dmg" onClick={() => onDirect("damage")}>⚔ Dmg</button>
            <button type="button" className="ta-chip ta-chip--heal" onClick={() => onDirect("heal")}><span className="ta-chip-glyph" aria-hidden="true">✦</span>Heal</button>
            <button type="button" className="ta-chip" aria-expanded={condOpen} onClick={() => setCondOpen((v) => !v)}>+ Cond</button>
          </div>
        )}
        {onDirect && condOpen && (
          <div className="ta-conds" role="group" aria-label={`${actorName}'s conditions`}>
            {ALL_CONDITIONS.map((cond) => {
              const on = conditions.includes(cond);
              return (
                <button key={cond} type="button" className={`ta-cond${on ? " on" : ""}`} aria-pressed={on} onClick={() => onToggleCondition?.(cond)}>{cond}</button>
              );
            })}
            <button type="button" className="ta-chip ta-chip--ghost" onClick={onCancel}>Done</button>
          </div>
        )}
      </div>
    );
  }

  const { own = [], primary = [], spells = [], heal, magic = [] } = groups || {};
  return (
    <div className="ta-drawer" aria-live="polite">
      <div className="ta-drawer-head">
        <h3 className="ta-drawer-title">
          {actorName}<span className="ta-arrow">→</span>{self ? "Self" : targetName}
        </h3>
        <span className="ta-spacer" />
        <button type="button" className="ta-chip ta-chip--ghost" onClick={onRetarget}>Change target</button>
        <button type="button" className="ta-chip ta-chip--ghost" onClick={onCancel}>Cancel</button>
      </div>
      <div className="ta-chips">
        {/* The creature's own attacks first (set in the Enemies Gallery or on its card). */}
        {own.map((action) => <ActionChip key={action.id} action={action} icon={<LookIcon look={action.look} size={15} />} variant="own" onPick={onPick} />)}
        {own.length > 0 && <span className="ta-divider" aria-hidden="true" />}
        {primary.map((action) => <ActionChip key={action.id} action={action} onPick={onPick} />)}
        {spells.length > 0 && <span className="ta-divider" aria-hidden="true" />}
        {spells.map((action) => <ActionChip key={action.id} action={action} glyph="✶" onPick={onPick} />)}
        {heal && (
          <>
            <span className="ta-divider" aria-hidden="true" />
            <ActionChip action={{ ...heal, dice: "" }} glyph="✚" variant="heal" onPick={() => onPick(heal)} />
          </>
        )}
        {magic.length > 0 && (
          <span className="ta-magic">
            <label htmlFor={magicId}><span className="ta-chip-glyph" aria-hidden="true">✶</span> Magic</label>
            <select
              id={magicId}
              value=""
              onChange={(e) => {
                const action = magic.find((m) => m.id === e.target.value);
                if (action) onPick(action);
              }}
            >
              <option value="">Choose…</option>
              {magic.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </span>
        )}
      </div>
    </div>
  );
}
