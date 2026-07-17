import { useContext, useEffect, useState } from "react";
import { patchSession } from "../../../api";
import { DAMAGE_PRESETS, PalCtx, useHoldToRepeat } from "../dashboardShared";
import "../characterCard.css";

function DamageHealModal({ char, mode, dmPassword, onClose, onOptimisticUpdate, onSync }) {
  const pal = useContext(PalCtx);
  const [amount, setAmount] = useState(0);
  const hpMax = char.hpMax ?? char.hp ?? 0;
  const serverHp = char.hpCurrent ?? 0;
  const isHeal = mode === "heal";
  const accentColor = isHeal ? "#5a9a5a" : "#c06060";
  const accentBright = isHeal ? "#88c888" : "#d08080";

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

  function confirm() {
    const newHp = Math.max(0, Math.min(hpMax, serverHp + (isHeal ? amount : -amount)));
    onOptimisticUpdate(newHp);
    patchSession(char.slug, { hpCurrent: newHp }, dmPassword)
      .then(() => onSync?.())
      .catch(() => {
        onOptimisticUpdate(serverHp);
      });
    onClose();
  }

  function adjustAmount(delta) {
    setAmount((prev) => Math.max(0, prev + delta));
  }

  const minusBind = useHoldToRepeat(() => adjustAmount(-1));
  const plusBind = useHoldToRepeat(() => adjustAmount(1));

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && amount > 0) confirm();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stepper button style — accent color is dynamic (heal vs damage), keep inline
  const stepBtnStyle = {
    width: 44,
    height: 44,
    borderRadius: 4,
    border: `1px solid ${accentColor}`,
    background: "rgba(18,32,48,0.7)",
    color: accentBright,
    fontFamily: pal.fontDisplay,
    fontSize: 22,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    userSelect: "none",
    touchAction: "none",
  };

  return (
    <div
      className="cc-modal-overlay"
      style={{ ...palVars, padding: 24 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="cc-dmg-modal-panel"
        style={{ border: `1px solid ${accentColor}` }}
      >
        <div className="cc-dmg-modal-type" style={{ color: accentColor }}>
          {isHeal ? "✦ Heal" : "⚔ Deal Damage"}
        </div>
        <div className="cc-dmg-modal-name">{char.name}</div>
        <div className="cc-dmg-modal-hp">
          HP: {serverHp} / {hpMax}
        </div>

        <div className="cc-dmg-stepper-row">
          <button
            style={stepBtnStyle}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); minusBind.start(); }}
            onPointerUp={minusBind.stop}
            onPointerCancel={minusBind.stop}
          >−</button>

          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
            style={{
              flex: 1,
              background: "rgba(18,32,48,0.8)",
              border: `1px solid ${accentColor}`,
              borderRadius: 4,
              color: accentBright,
              fontFamily: pal.fontDisplay,
              fontSize: 36,
              textAlign: "center",
              padding: "8px 6px",
              outline: "none",
              minWidth: 0,
            }}
          />

          <button
            style={stepBtnStyle}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); plusBind.start(); }}
            onPointerUp={plusBind.stop}
            onPointerCancel={plusBind.stop}
          >+</button>
        </div>

        <div className="cc-dmg-presets">
          {DAMAGE_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              style={{
                flex: "1 0 auto",
                minWidth: 36,
                background: amount === preset ? `${accentColor}22` : "transparent",
                border: `1px solid ${amount === preset ? accentColor : "rgba(100,130,160,0.28)"}`,
                borderRadius: 3,
                color: amount === preset ? accentBright : pal.textMuted,
                fontFamily: pal.fontDisplay,
                fontSize: 14,
                padding: "5px 4px",
                cursor: "pointer",
              }}
            >{preset}</button>
          ))}
        </div>

        <div className="cc-dmg-footer">
          <button onClick={onClose} style={{
            flex: 1,
            background: "transparent",
            border: "1px solid rgba(100,130,160,0.28)",
            borderRadius: 4,
            color: pal.textMuted,
            fontFamily: pal.fontUI,
            fontSize: 12,
            letterSpacing: "0.12em",
            padding: "9px 0",
            cursor: "pointer",
          }}>Cancel</button>
          <button onClick={confirm} disabled={amount === 0} style={{
            flex: 2,
            background: amount === 0 ? "rgba(18,32,48,0.3)" : `${accentColor}22`,
            border: `1px solid ${amount === 0 ? "rgba(100,130,160,0.2)" : accentColor}`,
            borderRadius: 4,
            color: amount === 0 ? pal.textMuted : accentBright,
            fontFamily: pal.fontUI,
            fontSize: 12,
            letterSpacing: "0.14em",
            padding: "9px 0",
            cursor: amount === 0 ? "not-allowed" : "pointer",
            opacity: amount === 0 ? 0.6 : 1,
          }}>{isHeal ? "Heal" : "Apply Damage"}</button>
        </div>
      </div>
    </div>
  );
}

export default DamageHealModal;
