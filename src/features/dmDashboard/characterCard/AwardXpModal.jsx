import { useContext, useState } from "react";
import { patchSession } from "../../../api";
import { PalCtx } from "../dashboardShared";
import "../characterCard.css";

function AwardXpModal({ char, dmPassword, onClose, onUpdate, onOptimisticUpdate, forParty = false, party = [] }) {
  const pal = useContext(PalCtx);
  const [amount, setAmount] = useState("");
  const [awardAll, setAwardAll] = useState(forParty);
  const [error, setError] = useState("");

  const PRESETS = [50, 100, 200, 300, 500, 750];

  function handleAward() {
    const n = parseInt(amount, 10);
    if (isNaN(n) || n <= 0) { setError("Enter a valid amount."); return; }
    setError("");
    const targets = awardAll ? party : [char];
    const updates = targets.map((c) => ({ slug: c.slug, xpCurrent: (c.xpCurrent ?? 0) + n }));
    const reverts = targets.map((c) => ({ slug: c.slug, xpCurrent: c.xpCurrent ?? 0 }));

    onOptimisticUpdate?.(updates);
    onClose();

    Promise.all(updates.map((u) => patchSession(u.slug, { xpCurrent: u.xpCurrent }, dmPassword)))
      .then(() => onUpdate())
      .catch(() => onOptimisticUpdate?.(reverts));
  }

  // Modal uses the dashboard pal from PalCtx — set palette vars for sub-tree
  const palVars = {
    "--pal-bg": pal.bg,
    "--pal-surface": pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border": pal.border,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim": pal.accentDim,
    "--pal-text": pal.text,
    "--pal-text-body": pal.textBody,
    "--pal-text-muted": pal.textMuted,
    "--pal-gem": pal.gem,
    "--font-display": pal.fontDisplay,
    "--font-body": pal.fontBody,
    "--font-ui": pal.fontUI,
  };

  return (
    <div className="cc-modal-overlay" style={palVars} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cc-modal-panel">
        <div className="cc-modal-title">Award XP</div>
        <div className="cc-modal-subtitle">{awardAll ? "Whole Party" : (char?.name || "")}</div>

        <label className="cc-modal-label">Amount</label>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            background: "rgba(18,32,48,0.9)",
            border: `1px solid ${pal.border}`,
            borderRadius: 3,
            color: pal.text,
            fontFamily: pal.fontDisplay,
            fontSize: 28,
            letterSpacing: "0.05em",
            padding: "10px 14px",
            outline: "none",
            textAlign: "center",
            MozAppearance: "textfield",
          }}
          onFocus={(e) => { e.target.style.borderColor = pal.accent; }}
          onBlur={(e) => { e.target.style.borderColor = pal.border; }}
        />

        <div className="cc-modal-presets">
          <span className="cc-modal-preset-label">Quick:</span>
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(String(p))} className="cc-modal-preset-btn">{p}</button>
          ))}
        </div>

        {party.length > 0 && (
          <div className="cc-award-toggle-row">
            <label style={{ position: "relative", width: 36, height: 20, cursor: "pointer", display: "block", flexShrink: 0 }}>
              <input type="checkbox" checked={awardAll} onChange={(e) => setAwardAll(e.target.checked)} style={{ display: "none" }} />
              <div style={{ width: 36, height: 20, background: awardAll ? `rgba(106,143,168,0.35)` : "rgba(100,130,160,0.15)", border: `1px solid ${awardAll ? pal.accent : pal.border}`, borderRadius: 10, transition: "background 0.18s, border-color 0.18s" }} />
              <div style={{ position: "absolute", top: 3, left: awardAll ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: awardAll ? pal.accentBright : pal.textMuted, transition: "left 0.18s, background 0.18s" }} />
            </label>
            <span className="cc-toggle-label">Award to whole party</span>
          </div>
        )}

        {error && <div className="cc-modal-error">{error}</div>}

        <div className="cc-modal-footer">
          <button onClick={onClose} className="cc-modal-cancel-btn">Cancel</button>
          <button onClick={handleAward} className="cc-modal-confirm-btn">Award XP</button>
        </div>
      </div>
    </div>
  );
}

export { AwardXpModal };
