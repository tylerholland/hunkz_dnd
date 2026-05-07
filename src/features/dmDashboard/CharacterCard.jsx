import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { patchSession } from "../../api";
import CharacterTalents, { InfoBadge } from "../characterSheet/CharacterTalents";
import { PALETTES } from "../characterSheet/theme";
import { useDebouncedOptimisticNumberFlush } from "../../lib/liveSync";
import {
  ALL_CONDITIONS,
  DAMAGE_PRESETS,
  PalCtx,
  conditionStyle,
  getPartyCardActiveSurface,
  getPartyCardPalette,
  hpBarColor,
  useHoldToRepeat,
} from "./dashboardShared";

function DamageHealModal({ char, mode, dmPassword, onClose, onOptimisticUpdate, onSync }) {
  const pal = useContext(PalCtx);
  const [amount, setAmount] = useState(0);
  const hpMax = char.hpMax ?? char.hp ?? 0;
  const serverHp = char.hpCurrent ?? 0;
  const isHeal = mode === "heal";
  const accentColor = isHeal ? "#5a9a5a" : "#c06060";
  const accentBright = isHeal ? "#88c888" : "#d08080";

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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 24,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: pal.surfaceSolid,
        border: `1px solid ${accentColor}`,
        borderRadius: 8,
        padding: "28px 28px 24px",
        width: "100%",
        maxWidth: 340,
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: accentColor, marginBottom: 4 }}>
          {isHeal ? "✦ Heal" : "⚔ Deal Damage"}
        </div>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 16, letterSpacing: "0.06em", color: pal.accentBright, marginBottom: 4 }}>{char.name}</div>
        <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted, marginBottom: 20 }}>
          HP: {serverHp} / {hpMax}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
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

        <div style={{ display: "flex", gap: 5, marginBottom: 20, flexWrap: "wrap" }}>
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

        <div style={{ display: "flex", gap: 8 }}>
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

function QuickActionPopover({ char, dmPassword, onClose, onUpdate, initialMode = null, initialVal = "" }) {
  const pal = useContext(PalCtx);
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
    await patchSession(char.slug, { conditions: merged }, dmPassword);
    onUpdate();
    onClose();
  }

  async function applyTempHp() {
    const value = parseInt(inputVal, 10);
    if (isNaN(value) || value < 0) return;
    await patchSession(char.slug, { tempHP: value }, dmPassword);
    onUpdate();
    onClose();
  }

  async function clearConcentration() {
    await patchSession(char.slug, { concentration: { active: false, spell: "" } }, dmPassword);
    onUpdate();
    onClose();
  }

  const actionStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    fontFamily: pal.fontUI,
    fontSize: 13,
    letterSpacing: "0.08em",
    color: pal.text,
    cursor: "pointer",
    borderBottom: `1px solid ${pal.border}`,
    transition: "background 0.12s",
  };

  const isConcentrating = char.concentration?.active;

  return (
    <div ref={ref} style={{
      position: "absolute",
      right: 0,
      top: 34,
      zIndex: 100,
      background: pal.surfaceSolid,
      border: "1px solid rgba(100,130,160,0.32)",
      borderRadius: 5,
      minWidth: 210,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      overflow: "hidden",
    }}>
      <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: pal.textMuted, padding: "9px 14px 8px", borderBottom: `1px solid ${pal.border}` }}>
        {char.name} — More Actions
      </div>

      {mode === null && (
        <>
          <div
            style={actionStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(106,143,168,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            onClick={() => setMode("condition")}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>◈</span> Add Condition
          </div>
          <div
            style={actionStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(106,143,168,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            onClick={() => setMode("tempHp")}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>⬡</span> Set Temp HP
          </div>
          {isConcentrating && (
            <div
              style={{ ...actionStyle, color: "#c06060" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(192,96,96,0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              onClick={clearConcentration}
            >
              <span style={{ width: 18, textAlign: "center", color: "#c06060", fontSize: 15 }}>○</span> Drop Concentration
            </div>
          )}
          <div
            style={actionStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(106,143,168,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            onClick={() => { onClose(); onUpdate("shortRest"); }}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>◑</span> Short Rest
          </div>
          <div
            style={{ ...actionStyle, borderBottom: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(106,143,168,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            onClick={() => { onClose(); onUpdate("longRest"); }}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>⏾</span> Long Rest
          </div>
        </>
      )}

      {mode === "tempHp" && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted, marginBottom: 8 }}>Temp HP amount</div>
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
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted, marginBottom: 8 }}>Select conditions</div>
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

export default function CharacterCard({ char, dmPassword, onUpdate, onRegisterOpen, isActiveTurn = false }) {
  const pal = useContext(PalCtx);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const charPal = PALETTES[char.palette] || PALETTES.ocean;
  const cardPal = getPartyCardPalette(charPal, pal);

  const hpMax = char.hpMax ?? char.hp ?? null;
  const serverHp = char.hpCurrent ?? null;
  const hasHp = serverHp !== null && hpMax !== null && hpMax > 0;

  const [optimisticHp, setOptimisticHp] = useState(serverHp ?? 0);
  const optimisticHpRef = useRef(serverHp ?? 0);
  const serverHpRef = useRef(serverHp ?? 0);
  const hpMaxRef = useRef(hpMax ?? 0);
  const pendingDeltaRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const [deltaIndicator, setDeltaIndicator] = useState(null);

  useEffect(() => {
    optimisticHpRef.current = optimisticHp;
  }, [optimisticHp]);

  useEffect(() => {
    hpMaxRef.current = hpMax ?? 0;
    if (serverHp !== null) {
      serverHpRef.current = serverHp;
    }
    if (pendingDeltaRef.current === 0 && !flushInFlightRef.current) {
      setOptimisticHp(serverHp ?? 0);
      optimisticHpRef.current = serverHp ?? 0;
    }
  }, [serverHp, hpMax]);

  const getTargetHp = useCallback(
    () => Math.max(0, Math.min(hpMaxRef.current ?? 0, optimisticHpRef.current)),
    []
  );
  const commitHp = useCallback(
    (targetHp) => patchSession(char.slug, { hpCurrent: targetHp }, dmPassword),
    [char.slug, dmPassword]
  );
  const rollbackHp = useCallback((previousServerHp) => {
    optimisticHpRef.current = previousServerHp;
    setOptimisticHp(previousServerHp);
  }, []);
  const debouncedFlushRef = useDebouncedOptimisticNumberFlush({
    enabled: hasHp,
    delay: 300,
    fieldName: "hpCurrent",
    getTargetValue: getTargetHp,
    serverValueRef: serverHpRef,
    inFlightRef: flushInFlightRef,
    pendingDeltaRef,
    commitValue: commitHp,
    setLocalValue: rollbackHp,
    requestSync: onUpdate,
  });

  function applyDelta(delta) {
    const current = optimisticHpRef.current;
    const newOptimistic = Math.max(0, Math.min(hpMax ?? 0, current + delta));
    const actualDelta = newOptimistic - current;
    if (actualDelta === 0) return;
    pendingDeltaRef.current += actualDelta;
    optimisticHpRef.current = newOptimistic;
    setOptimisticHp(newOptimistic);
    setDeltaIndicator({ value: pendingDeltaRef.current, key: Date.now() });
    debouncedFlushRef.current();
  }

  useEffect(() => {
    if (onRegisterOpen) {
      onRegisterOpen(char.slug, () => {
        setModalMode("damage");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char.slug]);

  const minusBind = useHoldToRepeat(() => applyDelta(-1));
  const plusBind = useHoldToRepeat(() => applyDelta(1));

  const displayHp = hasHp ? optimisticHp : null;
  const hpPct = hasHp ? Math.max(0, Math.min(1, optimisticHp / hpMax)) : 0;
  const hpDanger = hasHp && hpPct < 0.2;

  const conditions = Array.isArray(char.conditions) ? char.conditions : [];
  const visibleConds = conditions.slice(0, 3);
  const overflowCount = conditions.length - visibleConds.length;

  const concentration = char.concentration;
  const isConcentrating = concentration?.active;

  async function removeCondition(cond) {
    const updated = conditions.filter((condition) => condition !== cond);
    await patchSession(char.slug, { conditions: updated }, dmPassword);
    onUpdate();
  }

  const initial = (char.name || "?").charAt(0).toUpperCase();

  const cardBorderColor = hpDanger ? "rgba(192,96,96,0.45)" : cardPal.border;
  const stripeColor = hpDanger ? "#c06060" : cardPal.accent;
  const activeSurface = isActiveTurn
    ? getPartyCardActiveSurface(charPal, pal, cardPal)
    : cardPal.surface;

  const stepBtnStyle = {
    width: 28,
    height: 28,
    borderRadius: 3,
    border: `1px solid ${cardPal.uiBorder}`,
    background: "transparent",
    color: cardPal.accentBright,
    fontFamily: cardPal.fontDisplay,
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    userSelect: "none",
    touchAction: "none",
  };

  function handlePopoverUpdate(action) {
    if (action === "shortRest" || action === "longRest") onUpdate(action);
    else onUpdate();
  }

  return (
    <div
      className={isActiveTurn ? "dm-active-turn" : undefined}
      style={{
        background: activeSurface,
        border: `1px solid ${cardBorderColor}`,
        borderRadius: 6,
        marginBottom: 12,
        position: "relative",
        zIndex: popoverOpen ? 50 : isActiveTurn ? 2 : 1,
        overflow: "visible",
        transform: isActiveTurn ? "scaleX(1.02)" : "scaleX(1)",
        transformOrigin: "center center",
        transition: "transform 0.18s ease",
        ...(isActiveTurn ? {
          "--turn-color": cardPal.accent,
          "--turn-glow": `${cardPal.accent}66`,
        } : {}),
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "6px 0 0 6px", background: stripeColor }} />

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, padding: "14px 14px 10px 18px", alignItems: "start" }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: `2px solid ${cardPal.accent}`,
          background: cardPal.surfaceSolid,
          overflow: "hidden",
        }}>
          {char.portraitUrl ? (
            <img src={char.portraitUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          ) : (
            <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 20, color: cardPal.gem }}>{initial}</span>
          )}
        </div>

        <div>
          <div style={{ fontFamily: cardPal.fontDisplay, fontSize: 17, letterSpacing: "0.06em", color: cardPal.accentBright, marginBottom: 3 }}>{char.name || "Unknown"}</div>
          <div style={{ fontFamily: cardPal.fontUI, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: cardPal.textMuted, marginBottom: 10 }}>
            {[char.race, char.charClass, char.level ? `Lvl ${char.level}` : null].filter(Boolean).join(" · ")}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 22, lineHeight: 1, color: hpDanger ? "#c06060" : cardPal.gem }}>{hasHp ? displayHp : "—"}</span>
              {hasHp && (
                <>
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 14, color: cardPal.textMuted }}>/</span>
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 14, color: cardPal.textMuted }}>{hpMax}</span>
                </>
              )}
            </div>
            {char.tempHP > 0 && (
              <span style={{ background: cardPal.accentDim, border: `1px solid ${cardPal.accent}`, borderRadius: 8, padding: "1px 7px", fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.08em", color: cardPal.accentBright }}>
                +{char.tempHP} temp
              </span>
            )}
          </div>

          {hasHp && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, position: "relative" }}>
              <button style={stepBtnStyle} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); minusBind.start(); }} onPointerUp={minusBind.stop} onPointerCancel={minusBind.stop} title="Deal 1 damage (hold to repeat)">−</button>
              <div style={{ flex: 1, height: 6, borderRadius: 3, overflow: "hidden", background: cardPal.gemLow, position: "relative" }}>
                <div style={{ height: "100%", width: `${hpPct * 100}%`, borderRadius: 3, background: hpBarColor(hpPct), transition: "width 0.25s ease" }} />
              </div>
              <button style={stepBtnStyle} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); plusBind.start(); }} onPointerUp={plusBind.stop} onPointerCancel={plusBind.stop} title="Heal 1 HP (hold to repeat)">+</button>
              {deltaIndicator && (
                <span key={deltaIndicator.key} className="dm-hp-delta" style={{ color: cardPal.gem }}>
                  {deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : `${deltaIndicator.value}`}
                </span>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {visibleConds.map((cond) => {
              const cs = conditionStyle(cond);
              return (
                <span
                  key={cond}
                  onClick={() => removeCondition(cond)}
                  title={`Remove ${cond}`}
                  style={{ background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 10, color: cs.color, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", cursor: "pointer" }}
                >{cond} ×</span>
              );
            })}
            {overflowCount > 0 && (
              <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, color: cardPal.textMuted, letterSpacing: "0.1em" }}>+{overflowCount} more</span>
            )}
            {isConcentrating && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.12em", color: cardPal.accentBright }}>
                <span className="dm-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: cardPal.accentBright, boxShadow: `0 0 5px ${cardPal.accentBright}`, flexShrink: 0, display: "inline-block" }} />
                {concentration.spell || "Concentrating"}
              </span>
            )}
            {char.inspiration && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: cardPal.gem }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: cardPal.gem, boxShadow: `0 0 6px ${cardPal.gem}66`, display: "inline-block" }} />
                Inspired
              </span>
            )}
          </div>

          {((char.skills || []).length > 0 || (char.specialAbilities || []).length > 0 || (char.spells || []).length > 0) && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <CharacterTalents
                pal={cardPal}
                skills={char.skills || []}
                specialAbilities={char.specialAbilities || []}
                compact
              />
              {(char.spells || []).map((spell) => (
                <InfoBadge
                  key={spell}
                  pal={cardPal}
                  label={spell}
                  tooltip={`Spell: ${spell}`}
                  compact
                  color={cardPal.accent}
                  background={cardPal.surfaceSolid}
                  border={cardPal.uiBorder}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, position: "relative" }}>
          <div style={{ background: cardPal.surfaceSolid, border: `1px solid ${cardPal.uiBorder}`, borderRadius: 4, padding: "5px 10px", textAlign: "center", minWidth: 46 }}>
            <div style={{ fontFamily: cardPal.fontDisplay, fontSize: 20, lineHeight: 1, color: cardPal.gem }}>{char.armorTotal ?? "—"}</div>
            <div style={{ fontFamily: cardPal.fontUI, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: cardPal.textMuted }}>AC</div>
          </div>

          <button
            onClick={() => setPopoverOpen((value) => !value)}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1px solid ${popoverOpen ? cardPal.accent : cardPal.uiBorder}`,
              background: popoverOpen ? cardPal.accentDim : "transparent",
              color: cardPal.accentBright,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              letterSpacing: "0.05em",
            }}
            title="More actions"
          >⋯</button>

          <Link to={`/characters/${char.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: cardPal.textMuted, textDecoration: "none", whiteSpace: "nowrap" }}>↗ Sheet</Link>

          {popoverOpen && (
            <QuickActionPopover
              char={char}
              dmPassword={dmPassword}
              onClose={() => setPopoverOpen(false)}
              onUpdate={handlePopoverUpdate}
            />
          )}
        </div>
      </div>

      {hasHp && (
        <div style={{ display: "flex", gap: 6, padding: "0 14px 12px 18px" }}>
          <button
            onClick={() => setModalMode("damage")}
            style={{ flex: 1, background: "rgba(192,96,96,0.08)", border: "1px solid rgba(192,96,96,0.3)", borderRadius: 4, color: "#d08080", fontFamily: charPal.fontUI, fontSize: 12, letterSpacing: "0.1em", padding: "6px 0", cursor: "pointer", transition: "background 0.12s, border-color 0.12s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(192,96,96,0.18)"; e.currentTarget.style.borderColor = "#c06060"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(192,96,96,0.08)"; e.currentTarget.style.borderColor = "rgba(192,96,96,0.3)"; }}
          >⚔ Damage</button>
          <button
            onClick={() => setModalMode("heal")}
            style={{ flex: 1, background: "rgba(80,160,80,0.08)", border: "1px solid rgba(80,160,80,0.3)", borderRadius: 4, color: "#88c888", fontFamily: charPal.fontUI, fontSize: 12, letterSpacing: "0.1em", padding: "6px 0", cursor: "pointer", transition: "background 0.12s, border-color 0.12s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(80,160,80,0.18)"; e.currentTarget.style.borderColor = "#5a9a5a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(80,160,80,0.08)"; e.currentTarget.style.borderColor = "rgba(80,160,80,0.3)"; }}
          >✦ Heal</button>
        </div>
      )}

      {modalMode && (
        <DamageHealModal
          char={{ ...char, hpCurrent: optimisticHp }}
          mode={modalMode}
          dmPassword={dmPassword}
          onClose={() => setModalMode(null)}
          onOptimisticUpdate={(newHp) => setOptimisticHp(newHp)}
          onSync={onUpdate}
        />
      )}
    </div>
  );
}
