import { useRef, useState } from "react";
import { parseQuickAdd } from "./sessionLoadout";
import "./sessionLoadout.css";

// Story 58 — "+ WEAPON" / "+ ITEM" row at the foot of a Loadout column. It
// expands in place into a compose row; the input clears and keeps focus
// after each add so a whole hoard can be logged in a row.
export default function SessionQuickAdd({ kind, label, onAdd, onOpenDetails }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [hintSeen, setHintSeen] = useState(false);
  const inputRef = useRef(null);

  function close() {
    setOpen(false);
    setError(false);
  }

  async function commit() {
    const items = parseQuickAdd(text, kind);
    if (items.length === 0) return;
    const typed = text;
    setText("");
    setError(false);
    setHintSeen(true);
    inputRef.current?.focus();
    const ok = await onAdd(items);
    if (ok === false) {
      setText((current) => current || typed);
      setError(true);
    }
  }

  function openDetails() {
    const [first] = parseQuickAdd(text, kind);
    onOpenDetails({ name: first?.name || "", qty: first?.qty });
  }

  if (!open) {
    return (
      <button type="button" className="cs-sm-add cs-sm-add--idle" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  }

  return (
    <div
      className={`cs-sm-add cs-sm-add--open${error ? " cs-sm-add--error" : ""}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && !text.trim()) close();
      }}
    >
      <div className="cs-sm-add-row">
        <input
          ref={inputRef}
          autoFocus
          className="input-base cs-sm-add-input"
          value={text}
          maxLength={200}
          placeholder={kind === "equipment" ? "Item name (e.g. Arrows x20)" : "Weapon name"}
          aria-label={`New ${label.toLowerCase()} name`}
          onChange={(e) => { setText(e.target.value); setError(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { e.preventDefault(); close(); }
          }}
        />
        <button type="button" className="btn-primary cs-sm-add-commit" onClick={commit} disabled={!text.trim()}>
          Add
        </button>
        <button type="button" className="btn-ghost cs-sm-add-details" onClick={openDetails} title="More details" aria-label="Open full item editor">
          ⋯
        </button>
      </div>
      {error ? (
        <div className="cs-sm-add-hint cs-sm-add-hint--error">Couldn{"'"}t save — tap Add to retry</div>
      ) : !hintSeen && (
        <div className="cs-sm-add-hint">Comma-separate to add several</div>
      )}
    </div>
  );
}
