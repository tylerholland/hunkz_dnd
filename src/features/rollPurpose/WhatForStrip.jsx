import { useEffect, useState } from "react";
import { purposeGroups } from "./rollPurpose";
import "./rollPurpose.css";

const FADE_MS = 12000;

/**
 * A quiet "What was that for?" under an untagged free roll: a best guess and
 * a few chips, More… for everything. Fades by itself after a while (not while
 * More… is open), never takes focus, never blocks the next roll.
 */
export default function WhatForStrip({ guesses, attacks, onPick, onClose }) {
  const [more, setMore] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [other, setOther] = useState("");

  useEffect(() => {
    if (more) return undefined;
    const fade = window.setTimeout(() => setLeaving(true), FADE_MS);
    return () => window.clearTimeout(fade);
  }, [more]);
  useEffect(() => {
    if (!leaving) return undefined;
    const done = window.setTimeout(onClose, 340);
    return () => window.clearTimeout(done);
  }, [leaving, onClose]);

  const chip = (tag, text = tag, best = false) => (
    <button key={tag} type="button" className={`wf-chip${best ? " best" : ""}`} onClick={() => onPick(tag)}>{text}</button>
  );
  return (
    <div className={`wf-strip${more ? " open" : ""}${leaving ? " leaving" : ""}`} role="group" aria-label="What was that roll for?">
      <div className="wf-chips">
        <span className="wf-ask">What was that for?</span>
        {!more && guesses.map((tag, i) => chip(tag, tag, i === 0))}
        {!more && <button type="button" className="wf-chip wf-more" onClick={() => setMore(true)}>More…</button>}
      </div>
      <button type="button" className="wf-close" aria-label="Not now" onClick={() => setLeaving(true)}>×</button>
      {more && (
        <div className="wf-groups">
          {purposeGroups(attacks).map((g) => (
            <div key={g.label} className="wf-group"><span>{g.label}</span>{g.options.map((o) => chip(o.tag, o.text))}</div>
          ))}
          <div className="wf-group">
            <span>Else</span>
            <input
              className="wf-other"
              value={other}
              maxLength={60}
              placeholder="Something else… ↵"
              aria-label="Something else"
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && other.trim()) onPick(other.trim()); }}
            />
          </div>
        </div>
      )}
      {!more && !leaving && <span className="wf-timer" aria-hidden="true" />}
    </div>
  );
}
