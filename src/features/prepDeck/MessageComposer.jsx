import { useEffect, useRef, useState } from "react";
import { VoteToken } from "../vote/VoteBoard";
import { uploadMomentArt } from "./momentArt";
import "../vote/vote.css";
import "../rollRequests/rollRequests.css";
import "./prepDeck.css";

const toList = (to) => (Array.isArray(to) ? to : []);

/**
 * Write a moment (to everyone: read-aloud text, a picture) or a note (to
 * players: only they see it). From the Read a Moment / Pass a Note tiles, a
 * deck card's Edit, or "＋ Prepare". Who it's for decides which it is.
 * onSave(card) → true | message; onSend(card) → true | message (the page sends
 * it after a moment's Undo); onDelete(id).
 */
export default function MessageComposer({ members, deck = [], initial = {}, dmPassword, onSave, onSend, onDelete, onClose }) {
  const start = initial.card || {};
  const [cardId, setCardId] = useState(start.id || null);
  const [to, setTo] = useState(start.to ?? initial.to ?? (initial.kind === "note" ? [] : "all"));
  const [title, setTitle] = useState(start.title || "");
  const [text, setText] = useState(start.text || "");
  const [picture, setPicture] = useState(start.picture || "");
  const [canReply, setCanReply] = useState(start.canReply !== false);
  const [showPassed, setShowPassed] = useState(start.showPassed !== false);
  const [state, setState] = useState({ busy: false, error: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const editing = !!initial.editing;
  const isMoment = to === "all";

  useEffect(() => { textRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fields = () => ({ id: cardId || undefined, to, title: title.trim(), text: text.trim(), picture, canReply, showPassed });
  const toggleMember = (slug) => setTo((cur) => { const list = toList(cur); return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]; });
  const canSend = !!text.trim() && (isMoment || toList(to).length > 0);
  const prepared = deck.filter((c) => !c.usedAt && (c.to === "choose" || (c.kind === "moment") === isMoment) && c.id !== cardId);

  function load(card) {
    setCardId(card.id);
    setTo(card.to === "choose" ? (isMoment ? "all" : toList(to)) : card.to);
    setTitle(card.title || "");
    setText(card.text || "");
    setPicture(card.picture || "");
    setCanReply(card.canReply !== false);
    setShowPassed(card.showPassed !== false);
  }

  async function run(action) {
    if (state.busy) return;
    setState({ busy: true, error: "" });
    const result = await action(fields());
    if (result === true) onClose();
    else setState({ busy: false, error: typeof result === "string" ? result : "Couldn't do that. Try again." });
  }

  async function pickPicture(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try { setPicture(await uploadMomentArt(file, dmPassword)); } catch (err) { setState({ busy: false, error: err?.message || "Couldn't upload that picture." }); }
    setUploading(false);
  }

  return (
    <div className="vc-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vc-modal pd-modal" role="dialog" aria-modal="true" aria-labelledby="pd-title">
        <div>
          <h3 id="pd-title">{editing ? "Edit card" : initial.saveOnly ? "Prepare a card" : isMoment ? "Read a Moment" : "Pass a Note"}</h3>
          <p className="vb-hint">{isMoment ? "Everyone sees it as a pop-up, and it goes in the session log." : to === "choose" ? "You'll pick who gets it when you pass it." : "Only the players you pick see it. Everyone else sees that a note was passed (if you allow it)."}</p>
        </div>

        {!editing && !initial.saveOnly && prepared.length > 0 && (
          <div className="vc-field">
            <span className="vb-label">From your deck</span>
            <div className="rq-chips">
              {prepared.map((c) => <button key={c.id} type="button" className="rq-chip" onClick={() => load(c)}>{c.title || c.text.slice(0, 30)}</button>)}
            </div>
          </div>
        )}

        <div className="vc-field">
          <span className="vb-label">To</span>
          <div className="rq-chips">
            <button type="button" className={`rq-chip${isMoment ? " on" : ""}`} aria-pressed={isMoment} onClick={() => setTo("all")}>Everyone</button>
            {members.map((m) => {
              const on = toList(to).includes(m.slug);
              return (
                <button key={m.slug} type="button" className={`rq-chip pd-to-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleMember(m.slug)}>
                  <VoteToken member={m} small />{m.name}
                </button>
              );
            })}
            {(editing || initial.saveOnly) && (
              <button type="button" className={`rq-chip${to === "choose" ? " on" : ""}`} aria-pressed={to === "choose"} onClick={() => setTo("choose")}>Choose when sending</button>
            )}
          </div>
        </div>

        <label className="vc-field">
          <span className="vb-label">Title</span>
          <input className="vc-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isMoment ? "The Guildmaster's signal" : "Optional"} maxLength={80} />
        </label>
        <label className="vc-field">
          <span className="vb-label">{isMoment ? "What you read out" : "The note"}</span>
          <textarea ref={textRef} className="vc-in pd-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={isMoment ? "The Guildmaster signals to the shadows…" : "You notice…"} maxLength={2000} />
        </label>

        <div className="vc-field">
          <span className="vb-label">Picture <span className="rq-aside">optional</span></span>
          <div className="pd-picture-row">
            {picture && <img className="pd-thumb" src={picture} alt="" />}
            <button type="button" className="vc-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : picture ? "Change picture" : "Add a picture"}</button>
            {picture && <button type="button" className="vc-btn vc-btn--quiet" onClick={() => setPicture("")}>Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPicture} />
          </div>
        </div>
        {!isMoment && (
          <div className="vc-field">
            <button type="button" className="vc-switch" role="switch" aria-checked={canReply} onClick={() => setCanReply((v) => !v)}><span className="vc-sw"><i /></span>They can reply</button>
            <button type="button" className="vc-switch" role="switch" aria-checked={showPassed} onClick={() => setShowPassed((v) => !v)}><span className="vc-sw"><i /></span>The others see that a note was passed</button>
            <p className="vb-hint">{showPassed ? "Like at the table: everyone sees the note go by, not what it says." : "Nobody else knows."}</p>
          </div>
        )}

        {state.error && <p className="vc-error" role="alert">{state.error}</p>}
        <div className="vc-foot">
          {editing && <button type="button" className="vc-btn vc-btn--danger" onClick={() => run(async () => onDelete(cardId))}>Delete</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="vc-btn vc-btn--quiet" onClick={onClose}>Cancel</button>
          {editing ? (
            <button type="button" className="vc-btn vc-btn--primary" onClick={() => run(onSave)} disabled={!text.trim() || state.busy || uploading}>Save</button>
          ) : (
            <>
              <button type="button" className={`vc-btn${initial.saveOnly ? " vc-btn--primary" : ""}`} onClick={() => run(onSave)} disabled={!text.trim() || state.busy || uploading}>Save to deck</button>
              {!initial.saveOnly && (
                <button type="button" className="vc-btn vc-btn--primary" onClick={() => run(onSend)} disabled={!canSend || state.busy || uploading}>{isMoment ? "Read it now" : "Pass it now"}</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
