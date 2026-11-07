import { useEffect, useRef, useState } from "react";
import { LETTERS, TIME_LIMITS } from "./voteUtil";
import "./vote.css";

const PLACEHOLDERS = ["The tavern", "The temple", "The docks"];

function Switch({ on, onToggle, children }) {
  return (
    <button type="button" className="vc-switch" role="switch" aria-checked={on} onClick={onToggle}>
      <span className="vc-sw"><i /></span>{children}
    </button>
  );
}

/** The DM's "Call a Vote" form. onSend(fields) resolves to true when it went out. */
export default function VoteComposer({ onSend, onClose }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [limitSec, setLimitSec] = useState(60);
  const [showLive, setShowLive] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [state, setState] = useState({ busy: false, error: "" });
  const questionRef = useRef(null);
  useEffect(() => { questionRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = question.trim() && filled.length >= 2;
  const setOption = (i, value) => setOptions((list) => list.map((o, k) => (k === i ? value : o)));

  async function send() {
    if (!ready || state.busy) return;
    setState({ busy: true, error: "" });
    const okSent = await onSend({ question: question.trim(), options: filled, multi, limitSec, showLive, showResult });
    if (okSent === true) onClose();
    else setState({ busy: false, error: typeof okSent === "string" ? okSent : "Couldn't send it. Try again." });
  }

  return (
    <div className="vc-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vc-modal" role="dialog" aria-modal="true" aria-labelledby="vc-title">
        <div><h3 id="vc-title">Call a Vote</h3><p className="vb-hint">Asks everyone in the party at once.</p></div>
        <label className="vc-field"><span className="vb-label">Question</span>
          <input ref={questionRef} className="vc-in" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Where do we go next?" maxLength={80} />
        </label>
        <div className="vc-field">
          <div className="vc-row"><span className="vb-label">Options</span><span style={{ flex: 1 }} />
            <button type="button" className="vc-btn vc-btn--quiet" onClick={() => setOptions(["Yes", "No"])}>Yes / No</button></div>
          {options.map((o, i) => (
            <div key={i} className="vc-opt">
              <span className="vb-letter">{LETTERS[i]}</span>
              <input className="vc-in" value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={PLACEHOLDERS[i] || "Another option"} maxLength={60} aria-label={`Option ${LETTERS[i]}`} />
              {options.length > 2
                ? <button type="button" className="vc-x" aria-label={`Remove option ${LETTERS[i]}`} onClick={() => setOptions((list) => list.filter((_, k) => k !== i))}>✕</button>
                : <span />}
            </div>
          ))}
          {options.length < 6 && <button type="button" className="vc-btn vc-btn--quiet" style={{ justifySelf: "start" }} onClick={() => setOptions((list) => [...list, ""])}>＋ Add option</button>}
        </div>
        <Switch on={multi} onToggle={() => setMulti((v) => !v)}>Players can pick more than one</Switch>
        <div className="vc-field"><span className="vb-label">Time limit</span>
          <span className="vc-seg">{TIME_LIMITS.map(([s, label]) => <button key={s} type="button" className={limitSec === s ? "on" : ""} aria-pressed={limitSec === s} onClick={() => setLimitSec(s)}>{label}</button>)}</span>
          <p className="vb-hint">{limitSec ? "It closes by itself then, or as soon as everyone's voted." : "It stays open until everyone's voted or you close it."}</p>
        </div>
        <div className="vc-field"><span className="vb-label">What players see</span>
          <Switch on={showLive} onToggle={() => setShowLive((v) => !v)}>Show votes to players as they come in</Switch>
          <p className="vb-hint">{showLive ? "Everyone sees who picked what while it's open." : "Off: nobody sees how the others voted while it's open, so nobody is swayed."}</p>
          <Switch on={showResult} onToggle={() => setShowResult((v) => !v)}>Show the result to players when it closes</Switch>
          <p className="vb-hint">{showResult ? "When it closes, everyone sees the result." : "Off: players only learn it closed. The result stays with you, a quiet temperature check."}</p>
        </div>
        {state.error && <p className="vc-error" role="alert">{state.error}</p>}
        <div className="vc-foot"><span style={{ flex: 1 }} />
          <button type="button" className="vc-btn vc-btn--quiet" onClick={onClose}>Cancel</button>
          <button type="button" className="vc-btn vc-btn--primary" onClick={send} disabled={!ready || state.busy}>{state.busy ? "Sending…" : "Send to the party"}</button>
        </div>
      </div>
    </div>
  );
}
