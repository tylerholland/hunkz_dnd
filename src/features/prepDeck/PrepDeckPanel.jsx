import { useState } from "react";
import { VoteToken } from "../vote/VoteBoard";
import { NoteIcon, ScrollIcon } from "../dmDashboard/actionIcons";
import "../vote/vote.css";
import "../rollRequests/rollRequests.css";
import "./prepDeck.css";

const FILTERS = [["all", "All"], ["moment", "Moments"], ["note", "Notes"]];

function toLabel(card, members) {
  if (card.to === "all") return "Everyone";
  if (card.to === "choose") return "Choose when sending";
  return card.to.map((s) => members.find((m) => m.slug === s)?.name || s).join(", ");
}

function DeckCard({ card, members, picking, onPick, onSend, onEdit, onCancelPick }) {
  const used = !!card.usedAt;
  return (
    <div className={`pd-card${used ? " used" : ""}`}>
      <div className="pd-card-main">
        <div className="pd-card-head">
          {card.picture && <img className="pd-card-thumb" src={card.picture} alt="" />}
          <span className={`pd-kind pd-kind--${card.kind}`}>{card.kind === "moment" ? <ScrollIcon /> : <NoteIcon />}</span>
          <span className="pd-card-title">{card.title || (card.kind === "moment" ? "A moment" : "A note")}</span>
        </div>
        <p className="pd-card-text"><span className="pd-to">{toLabel(card, members)}</span>{card.text}</p>
      </div>
      <div className="pd-card-actions">
        {used && <span className="pd-used-at">{new Date(card.usedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
        <button type="button" className={`vc-btn${used ? " vc-btn--quiet" : " vc-btn--primary"}`} onClick={() => (card.to === "choose" ? onPick(card.id) : onSend(card))}>
          {used ? "Again" : card.to === "choose" ? "Send" : card.kind === "moment" ? "Read" : "Pass"}
        </button>
        <button type="button" className="vc-btn vc-btn--quiet" onClick={() => onEdit(card)}>Edit</button>
      </div>
      {picking && (
        <div className="pd-pick">
          <span className="vb-hint">Send it to…</span>
          <button type="button" className="rq-chip" onClick={() => onSend(card, "all")}>Everyone</button>
          {members.map((m) => (
            <button key={m.slug} type="button" className="rq-chip pd-to-chip" onClick={() => onSend(card, [m.slug])}><VoteToken member={m} small />{m.name}</button>
          ))}
          <button type="button" className="vc-btn vc-btn--quiet" onClick={onCancelPick}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/**
 * The DM's prep deck: moments and notes written before the session, sent in
 * one tap (Read / Pass). Used ones fold into "Used tonight". onSend(card, to?).
 */
export default function PrepDeckPanel({ cards, members, onSend, onEdit, onPrepare }) {
  const [filter, setFilter] = useState("all");
  const [usedOpen, setUsedOpen] = useState(false);
  const [picking, setPicking] = useState(null);
  const list = cards.filter((c) => filter === "all" || c.kind === filter || c.to === "choose");
  const ready = list.filter((c) => !c.usedAt);
  const used = list.filter((c) => c.usedAt);
  const send = (card, to) => { setPicking(null); onSend(card, to); };
  const row = (c) => <DeckCard key={c.id} card={c} members={members} picking={picking === c.id} onPick={setPicking} onSend={send} onEdit={onEdit} onCancelPick={() => setPicking(null)} />;

  return (
    <section className="pd-panel" aria-label="Prep deck">
      <div className="pd-head">
        <span className="label-ui">Prep deck</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="vc-btn" onClick={onPrepare}>＋ Prepare</button>
      </div>
      <div className="vc-seg" role="group" aria-label="Show">
        {FILTERS.map(([k, l]) => <button key={k} type="button" className={filter === k ? "on" : ""} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <div className="pd-list">
        {ready.length ? ready.map(row) : <p className="vb-hint">{cards.length ? "Nothing left here. Everything's been used tonight." : "Nothing prepared yet. Write moments and notes before the session, then send each one with a tap."}</p>}
        {used.length > 0 && (
          <>
            <button type="button" className="rq-more" aria-expanded={usedOpen} onClick={() => setUsedOpen((v) => !v)}>{usedOpen ? "▴" : "▾"} Used tonight · {used.length}</button>
            {usedOpen && used.map(row)}
          </>
        )}
      </div>
    </section>
  );
}
