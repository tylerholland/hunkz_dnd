import { useEffect, useRef, useState } from "react";
import { patchDmNote } from "../../../api";
import "../characterCard.css";

function NoteIcon({ color }) {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="8" height="10" rx="1" stroke={color} strokeWidth="1.1" />
      <line x1="3" y1="4" x2="7" y2="4" stroke={color} strokeWidth="1" />
      <line x1="3" y1="6.5" x2="7" y2="6.5" stroke={color} strokeWidth="1" />
      <line x1="3" y1="9" x2="5.5" y2="9" stroke={color} strokeWidth="1" />
      <path d="M9 8.5 L11 6.5 L10.5 6 L8.5 8 Z" fill={color} />
    </svg>
  );
}

function DmNotesStrip({ slug, dmNotes: initialDmNotes, sharedPlayerNotes, dmPassword, pal, hasDeathStripBelow = false }) {
  const [open, setOpen] = useState(false);
  const [dmNotes, setDmNotes] = useState(initialDmNotes || []);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  // Sync server state when party poll updates props (but only if panel is closed to avoid disrupting typing)
  useEffect(() => {
    if (!open) {
      setDmNotes(initialDmNotes || []);
    }
  }, [initialDmNotes, open]);

  const hasNotes = dmNotes.length > 0 || (sharedPlayerNotes || []).length > 0;
  const dmNoteCount = dmNotes.length;
  const playerNoteCount = (sharedPlayerNotes || []).length;

  async function handleAdd() {
    const text = inputVal.trim();
    if (!text) return;
    const localId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const localNote = { id: localId, text, createdAt: new Date().toISOString() };
    setDmNotes((prev) => [...prev, localNote]);
    setInputVal("");
    inputRef.current?.focus();
    try {
      await patchDmNote(slug, { action: "add", text }, dmPassword);
    } catch {
      setDmNotes((prev) => prev.filter((n) => n.id !== localId));
    }
  }

  async function handleDelete(id) {
    const removed = dmNotes.find((n) => n.id === id);
    setDmNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await patchDmNote(slug, { action: "delete", id }, dmPassword);
    } catch {
      if (removed) setDmNotes((prev) => [...prev, removed]);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }

  const stripBarBg = open
    ? `rgba(106,143,168,0.12)`
    : hasNotes
    ? `rgba(106,143,168,0.09)`
    : "transparent";

  const iconColor = hasNotes || open ? pal.accent : pal.textMuted;
  const labelColor = hasNotes || open ? pal.accentBright : pal.textMuted;
  const label = hasNotes ? "DM Notes" : "+ Note";

  return (
    <div className={`cc-notes-strip${hasDeathStripBelow ? " has-death-strip-below" : ""}`} onClick={handleToggle}>
      <div
        className="cc-notes-bar"
        style={{
          background: stripBarBg,
          borderRadius: (open || hasDeathStripBelow) ? 0 : "0 0 5px 5px",
          borderBottom: open ? `1px solid ${pal.border}` : "none",
        }}
        onMouseEnter={(e) => { if (!open && !hasNotes) e.currentTarget.style.background = "rgba(106,143,168,0.07)"; }}
        onMouseLeave={(e) => { if (!open && !hasNotes) e.currentTarget.style.background = "transparent"; }}
      >
        <NoteIcon color={iconColor} />
        <span className="cc-notes-label" style={{ color: labelColor }}>
          {label}
        </span>
        {dmNoteCount > 0 && (
          <span
            className="cc-notes-badge"
            style={{
              border: `1px solid ${pal.accent}`,
              color: pal.accent,
            }}
            title={`${dmNoteCount} DM note${dmNoteCount === 1 ? "" : "s"}`}
          >
            {dmNoteCount}
          </span>
        )}
        {playerNoteCount > 0 && (
          <span
            className="cc-notes-badge"
            style={{
              background: pal.accent,
              color: pal.bg,
            }}
            title={`${playerNoteCount} player-shared note${playerNoteCount === 1 ? "" : "s"}`}
          >
            {playerNoteCount}
          </span>
        )}
        <span className="cc-notes-chevron" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </div>

      <div
        className="cc-notes-body"
        style={{
          maxHeight: open ? 520 : 0,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="cc-notes-content" onClick={(e) => e.stopPropagation()}>
          {dmNotes.length > 0 && (
            <ul className="cc-note-list">
              {dmNotes.map((note, idx) => (
                <li
                  key={note.id}
                  className="cc-note-item"
                  style={{ borderBottom: idx < dmNotes.length - 1 ? `1px solid ${pal.border}` : "none" }}
                >
                  <span className="cc-note-text">{note.text}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                    className="cc-note-delete-btn"
                    title="Delete note"
                  >×</button>
                </li>
              ))}
            </ul>
          )}

          {(sharedPlayerNotes || []).length > 0 && (
            <>
              <div className="cc-notes-divider-row">
                <div className="cc-notes-divider-line" />
                <span className="cc-notes-shared-label">Player shared</span>
                <div className="cc-notes-divider-line" />
              </div>
              {(sharedPlayerNotes || []).map((note) => (
                <div key={note.id} className="cc-shared-note" style={{ borderLeft: `2px solid ${pal.gem}` }}>
                  <span className="cc-shared-note-text">{note.text}</span>
                </div>
              ))}
            </>
          )}

          {dmNotes.length === 0 && (sharedPlayerNotes || []).length === 0 && (
            <div className="cc-notes-empty">No notes yet.</div>
          )}

          <div className="cc-notes-input-row" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              maxLength={500}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="Add a note… (Enter to save)"
              className="cc-notes-input"
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleAdd(); }}
              className="cc-notes-add-btn"
            >+ Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DmNotesStrip;
