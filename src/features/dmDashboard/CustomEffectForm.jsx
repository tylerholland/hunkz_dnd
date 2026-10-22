import { useContext, useState } from "react";
import { EFFECT_KINDS, effectStyle } from "../../lib/spellEffects";
import { CustomEffectsCtx } from "./customEffectsContext";
import "./customEffects.css";

// Story 70 — "+ Custom effect…" in the DM's condition pickers: type a name
// ("Covered in slime"), pick curse / helpful / neutral, Add. It joins the
// table's effect list (house rules) and `onCreated(name)` applies/selects it.
export default function CustomEffectForm({ onCreated }) {
  const ctx = useContext(CustomEffectsCtx);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("curse");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!ctx) return null;

  async function add(e) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await ctx.create(trimmed, kind);
      onCreated?.(created || trimmed);
      setName("");
      setOpen(false);
    } catch {
      setError("Couldn't save it — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="cfx-open" onClick={() => setOpen(true)}>+ Custom effect…</button>
    );
  }
  return (
    <form className="cfx-form" onSubmit={add} onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={name}
        maxLength={30}
        placeholder="e.g. Covered in slime"
        aria-label="Custom effect name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } }}
      />
      <div className="cfx-kinds" role="radiogroup" aria-label="Kind of effect">
        {EFFECT_KINDS.map((k) => {
          const tone = effectStyle(k.value);
          const on = kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`cfx-kind${on ? " on" : ""}`}
              style={on ? { background: tone.bg, borderColor: tone.border, color: tone.color } : undefined}
              onClick={() => setKind(k.value)}
            >{k.label}</button>
          );
        })}
      </div>
      {error ? <div className="cfx-error" role="alert">{error}</div> : null}
      <div className="cfx-actions">
        <button type="button" className="cfx-cancel" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="cfx-add" disabled={!name.trim() || busy}>{busy ? "Adding…" : "Add"}</button>
      </div>
    </form>
  );
}
