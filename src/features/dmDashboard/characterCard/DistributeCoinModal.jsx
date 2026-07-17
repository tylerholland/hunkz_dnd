import { useContext, useState } from "react";
import { patchSession } from "../../../api";
import { COIN_COLORS } from "../../characterSheet/constants";
import { PalCtx } from "../dashboardShared";
import "../characterCard.css";

function DistributeCoinModal({ char, dmPassword, onClose, onUpdate, onOptimisticUpdate, forParty = false, party = [] }) {
  const pal = useContext(PalCtx);
  const [action, setAction] = useState("give"); // "give" | "deduct"
  const [denom, setDenom] = useState("gp");
  const [amount, setAmount] = useState("");
  const [targets, setTargets] = useState(() => forParty ? party.map((c) => c.slug) : [char?.slug].filter(Boolean));
  const [error, setError] = useState("");

  const PRESETS = [10, 25, 50, 100, 200, 500];
  const denomColor = COIN_COLORS[denom] || "#c8a040";
  const allSlugs = party.map((c) => c.slug);

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

  function toggleTarget(slug) {
    setTargets((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  }

  function toggleAll() {
    if (targets.length === allSlugs.length) setTargets([]);
    else setTargets(allSlugs);
  }

  function handleConfirm() {
    const n = parseInt(amount, 10);
    if (isNaN(n) || n <= 0) { setError("Enter a valid amount."); return; }
    if (targets.length === 0) { setError("Select at least one character."); return; }
    setError("");
    const allChars = party.length > 0 ? party : [char];

    const updates = targets.map((slug) => {
      const target = allChars.find((c) => c.slug === slug);
      if (!target) return null;
      const currentCoin = target.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
      const currentVal = currentCoin[denom] ?? 0;
      const newVal = action === "give" ? currentVal + n : Math.max(0, currentVal - n);
      return { slug, coin: { ...currentCoin, [denom]: newVal } };
    }).filter(Boolean);

    const reverts = targets.map((slug) => {
      const target = allChars.find((c) => c.slug === slug);
      if (!target) return null;
      return { slug, coin: target.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } };
    }).filter(Boolean);

    onOptimisticUpdate?.(updates);
    onClose();

    Promise.all(updates.map((u) => patchSession(u.slug, { coin: u.coin }, dmPassword)))
      .then(() => onUpdate())
      .catch(() => onOptimisticUpdate?.(reverts));
  }

  const pillBtn = (active, color, onClick, children) => (
    <button
      onClick={onClick}
      style={{
        background: active ? `${color}22` : "transparent",
        border: `1px solid ${active ? color : pal.border}`,
        borderRadius: 4,
        color: active ? color : pal.textMuted,
        fontFamily: pal.fontUI,
        fontSize: 12,
        letterSpacing: "0.1em",
        padding: "5px 14px",
        cursor: "pointer",
        transition: "all 0.14s",
      }}
    >{children}</button>
  );

  return (
    <div
      className="cc-modal-overlay"
      style={palVars}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cc-modal-panel cc-modal-panel-wide">
        <div className="cc-modal-title">Distribute Coin</div>
        <div className="cc-modal-subtitle">
          {forParty ? "Whole Party" : (char?.name || "")}
        </div>

        {/* Give / Deduct toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {pillBtn(action === "give", pal.accent, () => setAction("give"), "Give")}
          {pillBtn(action === "deduct", "#c06060", () => setAction("deduct"), "Deduct")}
        </div>

        {/* Denomination selector */}
        <div className="cc-coin-modal-denoms">
          {["cp", "sp", "ep", "gp", "pp"].map((d) => {
            const c = COIN_COLORS[d];
            const active = denom === d;
            return (
              <button
                key={d}
                onClick={() => setDenom(d)}
                className="cc-coin-modal-denom-btn"
                style={{
                  background: active ? `${c}22` : "transparent",
                  borderColor: active ? c : pal.border,
                  color: active ? c : pal.textMuted,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
                {d.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Amount input */}
        <label className="cc-modal-label">Amount</label>
        <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${denomColor}`, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
          <button onClick={() => setAmount((v) => String(Math.max(0, (parseInt(v, 10) || 0) - 10)))} style={{ width: 36, background: "transparent", border: "none", color: denomColor, fontFamily: pal.fontDisplay, fontSize: 20, cursor: "pointer" }}>−</button>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus style={{ flex: 1, background: "transparent", border: "none", color: denomColor, fontFamily: pal.fontDisplay, fontSize: 28, letterSpacing: "0.05em", padding: "8px 0", outline: "none", textAlign: "center", MozAppearance: "textfield" }} />
          <button onClick={() => setAmount((v) => String((parseInt(v, 10) || 0) + 10))} style={{ width: 36, background: "transparent", border: "none", color: denomColor, fontFamily: pal.fontDisplay, fontSize: 20, cursor: "pointer" }}>+</button>
        </div>
        <div className="cc-modal-presets">
          <span className="cc-modal-preset-label">Quick:</span>
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(String(p))} className="cc-modal-preset-btn"
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = denomColor; e.currentTarget.style.color = denomColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = pal.border; e.currentTarget.style.color = pal.textMuted; }}
            >{p}</button>
          ))}
        </div>

        {/* Target selector (only shown for party actions) */}
        {party.length > 0 && (
          <div className="cc-coin-modal-targets">
            <div className="cc-coin-modal-targets-label">Targets</div>
            <div className="cc-coin-modal-targets-row">
              <button
                onClick={toggleAll}
                style={{
                  background: targets.length === allSlugs.length ? `${pal.accent}22` : "transparent",
                  border: `1px solid ${targets.length === allSlugs.length ? pal.accent : pal.border}`,
                  borderRadius: 4,
                  color: targets.length === allSlugs.length ? pal.accentBright : pal.textMuted,
                  fontFamily: pal.fontUI,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >All Party</button>
              {party.map((c) => {
                const sel = targets.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    onClick={() => toggleTarget(c.slug)}
                    style={{
                      background: sel ? `${pal.accent}22` : "transparent",
                      border: `1px solid ${sel ? pal.accent : pal.border}`,
                      borderRadius: 4,
                      color: sel ? pal.accentBright : pal.textMuted,
                      fontFamily: pal.fontUI,
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >{c.name}</button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div className="cc-modal-error">{error}</div>}

        <div className="cc-modal-footer">
          <button onClick={onClose} className="cc-modal-cancel-btn">Cancel</button>
          <button
            onClick={handleConfirm}
            style={{
              background: `${denomColor}22`,
              border: `1px solid ${denomColor}`,
              borderRadius: 3,
              color: denomColor,
              fontFamily: pal.fontUI,
              fontSize: 13,
              letterSpacing: "0.1em",
              padding: "7px 20px",
              cursor: "pointer",
            }}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}

export { DistributeCoinModal };
