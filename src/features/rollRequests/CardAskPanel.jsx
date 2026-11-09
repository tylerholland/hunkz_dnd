import { useState } from "react";
import {
  ABILITIES, OTHER_SKILLS, QUICK_SKILLS, SKILLS, abilityCheck, checkBonus, checkShort, formatBonus, savingThrow, skillCheck,
} from "./rollCheck";
import "./rollRequests.css";

const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * On a DM party card: ask THIS player to roll, one tap (it pops up on their
 * screen with the roll loaded). Opened from an ability score (`ability` set:
 * that check, its skills, its save, or "Roll it myself") or from Check (the
 * common skills, with saves folded away). "DC, advantage…" opens the full form.
 */
export default function CardAskPanel({ char, rules, ability = null, onAsk, onRollSelf, onMore, onClose }) {
  const [saves, setSaves] = useState(false);
  const chip = (check) => (
    <button key={checkShort(check)} type="button" className="rq-chip" onClick={() => onAsk(check)}>
      {checkShort(check)} <span className="rq-row-bonus">{formatBonus(checkBonus(char, check, rules))}</span>
    </button>
  );
  const abbr = ABILITIES.find((a) => a.key === ability)?.abbr;
  return (
    <div className="rq-cardask" role="group" aria-label={`Ask ${char.name} to roll`}>
      <span className="rq-sub">Ask {char.name} {ability ? "to roll" : "for a check"}</span>
      {ability ? (
        <div className="rq-chips">
          {chip(abilityCheck(ability))}
          {Object.keys(SKILLS).filter((s) => SKILLS[s] === ability).map((s) => chip(skillCheck(s)))}
          {chip(savingThrow(ability))}
        </div>
      ) : (
        <>
          <div className="rq-chips">
            {QUICK_SKILLS.map((s) => chip(skillCheck(s)))}
            <select className="rq-chip rq-chip-select" value="" aria-label="Another skill" onChange={(e) => { if (e.target.value) onAsk(skillCheck(e.target.value)); }}>
              <option value="">Other skill…</option>
              {OTHER_SKILLS.map((s) => <option key={s} value={s}>{title(s)} {formatBonus(checkBonus(char, skillCheck(s), rules))}</option>)}
            </select>
          </div>
          <button type="button" className="rq-more" aria-expanded={saves} onClick={() => setSaves((v) => !v)}>{saves ? "▴" : "▾"} Saving throw</button>
          {saves && <div className="rq-chips">{ABILITIES.map((a) => chip(savingThrow(a.key)))}</div>}
        </>
      )}
      <span className="vb-hint">One tap: it pops up on their screen with the roll loaded.</span>
      <div className="rq-cardask-foot">
        {ability && onRollSelf && <button type="button" className="vc-btn vc-btn--quiet" onClick={onRollSelf}>Roll {abbr} myself</button>}
        <button type="button" className="vc-btn vc-btn--quiet" onClick={onMore}>DC, advantage…</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="vc-btn vc-btn--quiet" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
