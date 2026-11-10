import { useState } from "react";
import {
  ABILITIES, OTHER_SKILLS, QUICK_SKILLS, checkBonus, checkShort, formatBonus, savingThrow, skillCheck,
} from "./rollCheck";
import "./rollRequests.css";

const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * A player's own Check (Session view, under the ability modifiers): when the
 * DM says "roll Perception", one tap rolls it with their bonus under the house
 * rules. Saves are folded away. onRoll(check) does the rolling.
 */
export default function PlayerCheckPanel({ char, rules, onRoll, onClose }) {
  const [saves, setSaves] = useState(false);
  const chip = (check) => (
    <button key={checkShort(check)} type="button" className="rq-chip" onClick={() => onRoll(check)}>
      {checkShort(check)} <span className="rq-row-bonus">{formatBonus(checkBonus(char, check, rules))}</span>
    </button>
  );
  return (
    <div className="rq-cardask rq-playercheck" role="group" aria-label="Roll a check">
      <div className="rq-chips">
        {QUICK_SKILLS.map((s) => chip(skillCheck(s)))}
        <select className="rq-chip rq-chip-select" value="" aria-label="Another skill" onChange={(e) => { if (e.target.value) onRoll(skillCheck(e.target.value)); }}>
          <option value="">Other skill…</option>
          {OTHER_SKILLS.map((s) => <option key={s} value={s}>{title(s)} {formatBonus(checkBonus(char, skillCheck(s), rules))}</option>)}
        </select>
      </div>
      <button type="button" className="rq-more" aria-expanded={saves} onClick={() => setSaves((v) => !v)}>{saves ? "▴" : "▾"} Saving throw</button>
      {saves && <div className="rq-chips">{ABILITIES.map((a) => chip(savingThrow(a.key)))}</div>}
      <div className="rq-cardask-foot"><span style={{ flex: 1 }} /><button type="button" className="vc-btn vc-btn--quiet" onClick={onClose}>Close</button></div>
    </div>
  );
}
