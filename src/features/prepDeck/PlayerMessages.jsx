import { useState } from "react";
import { postMessageReply, postMessageSeen } from "../../api";
import { NoteIcon } from "../dmDashboard/actionIcons";
import "../vote/vote.css";
import "./prepDeck.css";

/**
 * What the DM sent this player, one at a time, oldest first: a MOMENT as a
 * scroll over the page (Continue), or a NOTE only they can see, as a card near
 * the top (reply once, or Got it). Both go in the session log (and the Chronicle).
 * `messages` are this player's (getSessionState → tableMessages).
 */
export default function PlayerMessages({ messages = [], slug, password, light = false }) {
  const [done, setDone] = useState(() => new Set()); // answered here, before the poll catches up
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const waiting = messages
    .filter((m) => !m.passed && !m.seenByMe && !done.has(m.id))
    .sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)));
  const message = waiting[0];
  if (!message) return null;

  const finish = () => { setDone((s) => new Set(s).add(message.id)); setReply(""); setError(""); };
  async function seen() {
    finish();
    try { await postMessageSeen(slug, password, message.id); } catch { /* it's in their log either way */ }
  }
  async function sendReply() {
    const text = reply.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await postMessageReply(slug, password, message.id, text);
      finish();
    } catch (err) {
      setError(err?.status === 409 ? "That note can't take a reply any more." : "Couldn't send it. Try again.");
    }
    setBusy(false);
  }

  if (message.kind === "moment") {
    return (
      <div className={`pm-scrim${light ? " pm-scrim--light" : ""}`}>
        <div className="pm-scroll" role="dialog" aria-modal="true" aria-labelledby="pm-title">
          {message.picture && <img className="pm-pic" src={message.picture} alt="" />}
          <div className="pm-body">
            <div className="pm-orn" aria-hidden="true">◆ ◆ ◆</div>
            <h2 id="pm-title">{message.title || "The DM reads"}</h2>
            <p className="pm-text">{message.text}</p>
            <div className="pm-foot">
              <button type="button" className="vc-btn vc-btn--primary" onClick={seen} autoFocus>Continue</button>
              <span className="vb-hint">It goes in the session log, kept in the Chronicle.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const others = (message.to || []).filter((s) => s !== slug).length;
  return (
    <div className={`pv-card pm-note${light ? " vb-light" : ""}`} role="dialog" aria-label="A note from the DM">
      <div className="pm-note-head">
        <span className="pm-seal" aria-hidden="true"><NoteIcon /></span>
        <div>
          <span className="vb-label">A note from the DM</span>
          <p className="vb-hint">Only you can see this{others ? ` (and ${others} other${others > 1 ? "s" : ""})` : ""}.</p>
        </div>
      </div>
      {message.picture && <img className="pm-note-pic" src={message.picture} alt="" />}
      {message.title && <h4>{message.title}</h4>}
      <p className="pm-note-text">{message.text}</p>
      {message.canReply && !message.myReply && (
        <div className="vc-row">
          <input className="vc-in" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }} placeholder="Reply to the DM (optional)" maxLength={280} aria-label="Reply to the DM" />
          <button type="button" className="vc-btn" onClick={sendReply} disabled={busy || !reply.trim()}>Send</button>
        </div>
      )}
      {error && <p className="vc-error" role="alert">{error}</p>}
      <div className="vc-foot" style={{ borderTop: 0, paddingTop: 0 }}><span style={{ flex: 1 }} /><button type="button" className="vc-btn vc-btn--primary" onClick={seen}>Got it</button></div>
    </div>
  );
}
