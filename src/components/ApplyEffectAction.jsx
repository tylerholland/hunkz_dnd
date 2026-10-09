import { useState } from "react";
import { RollHistoryRow } from "./RollHistoryList";

// DM only — apply a player's spell effect from the log: an optional "What does
// it do?" note, then Apply sets the condition on the target and plays the FX.
// Renders the button (in the row's action slot) and, when open, the note
// panel (in the row's `below` slot) — so it returns both parts.
function useApplyEffect({ entry, applied, onApplyEffect, pal }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const effect = entry.effect || "the effect";

  async function apply() {
    setError(null);
    const ok = await onApplyEffect(entry, note.trim());
    if (ok === false) { setError("Couldn't apply — is the target still in the fight?"); return; }
    setOpen(false);
    setNote("");
  }

  const action = applied ? (
    <span className="ta-applied">✓ Applied</span>
  ) : (
    <button type="button" className="rh-apply-effect" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      Apply Effect
    </button>
  );

  const panel = open && !applied ? (
    <div className="rh-apply-pop">
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.textMuted }}>
          What does it do? <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </span>
        <textarea
          autoFocus
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); apply(); }
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
          }}
          placeholder="e.g. loses its hold on Aesop; +1d6 necrotic from each hit while hexed"
          style={{ color: pal.text, border: `1px solid ${pal.border}` }}
        />
      </label>
      {error ? <div role="alert" style={{ color: "#d08080", fontSize: 13 }}>{error}</div> : null}
      <div className="rh-apply-pop-actions">
        <button type="button" className="btn-ghost" style={{ width: "auto", padding: "5px 12px" }} onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="rh-apply-effect" onClick={apply}>Apply {effect}</button>
      </div>
    </div>
  ) : null;

  return { action, panel };
}

// A spell-effect row in the DM's log, with Apply Effect / ✓ Applied.
export default function EffectLogRow({ entry, applied, onApplyEffect, pal, ...rowProps }) {
  const { action, panel } = useApplyEffect({ entry, applied, onApplyEffect, pal });
  return <RollHistoryRow pal={pal} entry={entry} below={panel} {...rowProps}>{action}</RollHistoryRow>;
}
