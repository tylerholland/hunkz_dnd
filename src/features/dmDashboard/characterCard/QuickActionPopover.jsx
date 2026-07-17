import { useEffect, useRef, useState } from "react";
import { ALL_CONDITIONS, conditionStyle, withAlpha } from "../dashboardShared";
import "../characterCard.css";

function QuickActionPopover({ char, pal, basePal, onClose, onUpdate, onOpenHpModal, onCommitFields, initialMode = null, initialVal = "" }) {
  const [mode, setMode] = useState(initialMode);
  const [inputVal, setInputVal] = useState(initialVal);
  const [selectedConds, setSelectedConds] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function applyConditions() {
    const existing = char.conditions || [];
    const merged = Array.from(new Set([...existing, ...selectedConds]));
    const success = await onCommitFields?.({ conditions: merged });
    if (success !== false) {
      setSelectedConds([]);
      onClose();
    }
  }

  async function applyTempHp() {
    const value = parseInt(inputVal, 10);
    if (isNaN(value) || value < 0) return;
    const success = await onCommitFields?.({ tempHP: value });
    if (success !== false) {
      setInputVal("");
      onClose();
    }
  }

  async function clearConcentration() {
    const success = await onCommitFields?.({ concentration: { active: false, spell: "" } });
    if (success !== false) onClose();
  }

  const isConcentrating = char.concentration?.active;

  // Popover sets its own palette vars so cc-popover-action can use var(--pal-*)
  const popoverPalVars = {
    "--pal-border": pal.uiBorder || pal.border,
    "--pal-text": pal.text,
    "--pal-text-muted": pal.textMuted,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-gem": pal.gem,
    "--font-display": pal.fontDisplay,
    "--font-body": pal.fontBody,
    "--font-ui": pal.fontUI,
  };

  return (
    <div
      ref={ref}
      className="cc-popover"
      style={{
        ...popoverPalVars,
        background: withAlpha(basePal?.surfaceSolid || pal.surfaceSolid || pal.bg || "#111111", 0.94),
      }}
    >
      <div className="cc-popover-title">
        {char.name} — More Actions
      </div>

      {mode === null && (
        <>
          <div
            className="cc-popover-action danger"
            onClick={() => { onClose(); onOpenHpModal?.("damage"); }}
          >
            <span className="cc-popover-icon" style={{ color: "#d08080" }}>⚔</span> Deal Damage
          </div>
          <div
            className="cc-popover-action heal"
            onClick={() => { onClose(); onOpenHpModal?.("heal"); }}
          >
            <span className="cc-popover-icon" style={{ color: "#88c888" }}>✦</span> Heal
          </div>
          <div
            className="cc-popover-action"
            onClick={() => setMode("condition")}
          >
            <span className="cc-popover-icon" style={{ color: pal.accentBright }}>◈</span> Add Condition
          </div>
          <div
            className="cc-popover-action"
            onClick={() => setMode("tempHp")}
          >
            <span className="cc-popover-icon" style={{ color: pal.accentBright }}>⬡</span> Set Temp HP
          </div>
          {isConcentrating && (
            <div
              className="cc-popover-action danger"
              style={{ color: "#c06060" }}
              onClick={clearConcentration}
            >
              <span className="cc-popover-icon" style={{ color: "#c06060" }}>○</span> Drop Concentration
            </div>
          )}
          <div
            className="cc-popover-action"
            onClick={() => { onClose(); onUpdate("shortRest"); }}
          >
            <span className="cc-popover-icon" style={{ color: pal.accentBright }}>◑</span> Short Rest
          </div>
          <div
            className="cc-popover-action"
            onClick={() => { onClose(); onUpdate("longRest"); }}
          >
            <span className="cc-popover-icon" style={{ color: pal.accentBright }}>⏾</span> Long Rest
          </div>
        </>
      )}

      {mode === "tempHp" && (
        <div className="cc-popover-inner">
          <div className="cc-popover-sub-label">Temp HP amount</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min="0"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                background: "rgba(18,32,48,0.7)",
                border: `1px solid ${pal.accent}`,
                borderRadius: 3,
                color: pal.text,
                fontFamily: pal.fontDisplay,
                fontSize: 16,
                padding: "6px 10px",
                outline: "none",
              }}
            />
            <button onClick={applyTempHp} style={{
              background: "rgba(18,32,48,0.6)",
              border: `1px solid ${pal.accent}`,
              borderRadius: 3,
              color: pal.accentBright,
              fontFamily: pal.fontUI,
              fontSize: 12,
              padding: "6px 12px",
              cursor: "pointer",
            }}>Apply</button>
          </div>
          <button onClick={() => { setMode(null); setInputVal(""); }} style={{ background: "none", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, marginTop: 8, cursor: "pointer" }}>← Back</button>
        </div>
      )}

      {mode === "condition" && (
        <div className="cc-popover-inner">
          <div className="cc-popover-sub-label">Select conditions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
            {ALL_CONDITIONS.map((cond) => {
              const cs = conditionStyle(cond);
              const selected = selectedConds.includes(cond);
              return (
                <span
                  key={cond}
                  onClick={() => setSelectedConds((prev) => prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond])}
                  style={{
                    background: selected ? cs.bg : "transparent",
                    border: `1px solid ${selected ? cs.border : pal.border}`,
                    borderRadius: 10,
                    color: selected ? cs.color : pal.textMuted,
                    fontFamily: pal.fontUI,
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    cursor: "pointer",
                  }}
                >{cond}</span>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={applyConditions} disabled={selectedConds.length === 0} style={{
              flex: 1,
              background: "rgba(18,32,48,0.6)",
              border: `1px solid ${pal.accent}`,
              borderRadius: 3,
              color: pal.accentBright,
              fontFamily: pal.fontUI,
              fontSize: 11,
              padding: "6px 0",
              cursor: selectedConds.length === 0 ? "not-allowed" : "pointer",
              opacity: selectedConds.length === 0 ? 0.5 : 1,
            }}>Add Selected</button>
            <button onClick={() => { setMode(null); setSelectedConds([]); }} style={{ background: "none", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, padding: "6px 10px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickActionPopover;
