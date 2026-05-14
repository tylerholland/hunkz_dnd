import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { patchDmNote, patchSession } from "../../api";
import { PALETTES } from "../characterSheet/theme";
import { XP_THRESHOLDS, COIN_COLORS } from "../characterSheet/constants";
import { useDebouncedOptimisticNumberFlush } from "../../lib/liveSync";
import {
  ALL_CONDITIONS,
  DAMAGE_PRESETS,
  PalCtx,
  conditionStyle,
  getPartyCardActiveSurface,
  getPartyCardPalette,
  useHoldToRepeat,
  withAlpha,
} from "./dashboardShared";
import "./characterCard.css";

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

const DENOM_NAMES = { cp: "Copper", sp: "Silver", ep: "Electrum", gp: "Gold", pp: "Platinum" };
const DENOM_SHORT = { cp: "CP", sp: "SP", ep: "EP", gp: "GP", pp: "PP" };

function formatGpEquivalent(coin) {
  const total = ((coin.pp || 0) * 10) + (coin.gp || 0) + ((coin.ep || 0) * 0.5) + ((coin.sp || 0) * 0.1) + ((coin.cp || 0) * 0.01);
  if (Math.abs(total - Math.round(total)) < 0.000001) return String(Math.round(total));
  return total.toFixed(2);
}

function getDeathSaveCounts(char) {
  const source = char?.deathSaves || {};
  const successSource = source.successes ?? source.success ?? source.succeeded ?? 0;
  const failureSource = source.failures ?? source.failure ?? source.failed ?? 0;
  return {
    successes: Math.max(0, Math.min(3, Number(successSource) || 0)),
    failures: Math.max(0, Math.min(3, Number(failureSource) || 0)),
  };
}

function getSpellSlotGroups(spellSlots = []) {
  return (spellSlots || [])
    .filter((slot) => (slot?.max ?? 0) > 0)
    .map((slot) => ({
      key: slot.isPactMagic ? `pact-${slot.level}` : `level-${slot.level}`,
      label: slot.level,
      isPactMagic: !!slot.isPactMagic,
      max: slot.max,
      used: Math.max(0, Math.min(slot.max, slot.used || 0)),
    }));
}

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

function ExternalLinkIcon({ color }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path d="M3 2.25H1.75a.75.75 0 0 0-.75.75v6.25c0 .414.336.75.75.75H8a.75.75 0 0 0 .75-.75V8" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 1h4v4" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 1 4.75 6.25" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function toTitleCase(value) {
  if (!value) return "";
  return String(value)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getHpTone(cardPal, hpPct) {
  if (hpPct < 0.25) {
    return {
      fill: "#c06060",
      solid: "#c06060",
      text: "#d98b8b",
      border: "rgba(192,96,96,0.42)",
    };
  }

  if (hpPct < 0.5) {
    return {
      fill: "#c8a040",
      solid: "#c8a040",
      text: "#dcc27a",
      border: "rgba(200,160,64,0.38)",
    };
  }

  return {
    fill: cardPal.gem,
    solid: cardPal.accent,
    text: cardPal.gem,
    border: cardPal.uiBorder,
  };
}

function NotesStrip({ slug, dmNotes: initialDmNotes, sharedPlayerNotes, dmPassword, pal }) {
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
    <div className="cc-notes-strip" onClick={handleToggle}>
      <div
        className="cc-notes-bar"
        style={{
          background: stripBarBg,
          borderRadius: open ? 0 : "0 0 5px 5px",
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

export default function CharacterCard({
  char,
  dmPassword,
  onUpdate,
  onCommitSessionUpdates,
  onRegisterOpen,
  onPopoverOpenChange,
  isActiveTurn = false,
  allParty = [],
  showTier2 = true,
  dimmed = false,
  onHeaderClick,
}) {
  const pal = useContext(PalCtx);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [showAwardXp, setShowAwardXp] = useState(false);
  const [showDistributeCoin, setShowDistributeCoin] = useState(false);
  const [coinExpanded, setCoinExpanded] = useState(false);
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
  const [hpFeedback, setHpFeedback] = useState(null);
  const [removingConds, setRemovingConds] = useState([]);
  const [fadingConcentration, setFadingConcentration] = useState(null);
  const hpFeedbackTimeoutRef = useRef(null);
  const prevAnimatedHpRef = useRef(serverHp ?? 0);
  const removalTimersRef = useRef(new Map());
  const concentrationFadeTimeoutRef = useRef(null);
  const prevConcentrationRef = useRef(char.concentration);

  const [optimisticXp, setOptimisticXp] = useState(char.xpCurrent ?? 0);
  const xpPendingRef = useRef(false);
  const [optimisticCoin, setOptimisticCoin] = useState(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  const coinPendingRef = useRef(false);

  useEffect(() => {
    optimisticHpRef.current = optimisticHp;
  }, [optimisticHp]);

  useEffect(() => {
    onPopoverOpenChange?.(popoverOpen);
  }, [onPopoverOpenChange, popoverOpen]);

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

  useEffect(() => {
    if (!xpPendingRef.current) setOptimisticXp(char.xpCurrent ?? 0);
  }, [char.xpCurrent]);

  useEffect(() => {
    if (!coinPendingRef.current) setOptimisticCoin(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  }, [char.coin]);

  useEffect(() => {
    setCoinExpanded(false);
  }, [char.slug, char.coinMode]);

  useEffect(() => {
    const previous = prevAnimatedHpRef.current;
    if (typeof previous === "number" && previous !== optimisticHp) {
      const nextFeedback = optimisticHp < previous ? "damage" : "heal";
      setHpFeedback(nextFeedback);
      window.clearTimeout(hpFeedbackTimeoutRef.current);
      hpFeedbackTimeoutRef.current = window.setTimeout(() => setHpFeedback(null), nextFeedback === "damage" ? 300 : 250);
    }
    prevAnimatedHpRef.current = optimisticHp;
  }, [optimisticHp]);

  useEffect(() => () => {
    window.clearTimeout(hpFeedbackTimeoutRef.current);
    window.clearTimeout(concentrationFadeTimeoutRef.current);
    removalTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    removalTimersRef.current.clear();
  }, []);

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
  const hpDanger = hasHp && hpPct < 0.25;
  const hpTone = getHpTone(cardPal, hpPct);

  const conditions = Array.isArray(char.conditions) ? char.conditions : [];
  const concentration = char.concentration;
  const isConcentrating = concentration?.active;
  const concentrationKey = `${concentration?.active ? "1" : "0"}|${concentration?.spell || ""}`;

  useEffect(() => {
    const previousConcentration = prevConcentrationRef.current;
    if (previousConcentration?.active && !isConcentrating) {
      setFadingConcentration(previousConcentration);
      window.clearTimeout(concentrationFadeTimeoutRef.current);
      concentrationFadeTimeoutRef.current = window.setTimeout(() => setFadingConcentration(null), 200);
    } else if (isConcentrating) {
      setFadingConcentration(null);
    }
    prevConcentrationRef.current = concentration;
  }, [concentrationKey, concentration, isConcentrating]);

  const visibleConds = [...conditions, ...removingConds.filter((condition) => !conditions.includes(condition))];
  const concentrationDisplay = isConcentrating ? concentration : fadingConcentration;
  const conScore = char.stats?.find((s) => s.stat === "Constitution")?.score ?? 10;
  const conItemBonus = [...(char.weapons || []), ...(char.equipment || [])].reduce((sum, item) => {
    return sum + (item.mods || []).filter((m) => m.attribute === "Constitution").reduce((s, m) => s + (parseInt(m.value, 10) || 0), 0);
  }, 0);
  const conSaveMod = Math.floor((conScore - 10) / 2) + conItemBonus;
  const conSaveLabel = (conSaveMod >= 0 ? "+" : "") + conSaveMod;
  const hasStatusRow = visibleConds.length > 0 || !!concentrationDisplay || !!char.inspiration;
  const spellSlotGroups = getSpellSlotGroups(char.spellSlots || []);
  const deathSaves = getDeathSaveCounts(char);
  const showDeathSaves = hasHp && optimisticHp === 0;
  const coinMode = char.coinMode || "gp";
  const displayCoin = optimisticCoin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const coinEquivalent = formatGpEquivalent(displayCoin);
  const metaParts = [toTitleCase(char.race), toTitleCase(char.charClass), char.level ? `Lvl ${char.level}` : null].filter(Boolean);

  const commitSessionFields = useCallback(async (fields) => {
    if (!fields || typeof fields !== "object") return false;

    if (onCommitSessionUpdates) {
      return onCommitSessionUpdates([{ slug: char.slug, ...fields }]);
    }

    try {
      await patchSession(char.slug, fields, dmPassword);
      onUpdate();
      return true;
    } catch {
      onUpdate();
      return false;
    }
  }, [char.slug, dmPassword, onCommitSessionUpdates, onUpdate]);

  async function removeCondition(cond) {
    if (removingConds.includes(cond)) return;
    setRemovingConds((current) => [...current, cond]);

    const timerId = window.setTimeout(async () => {
      const updated = conditions.filter((condition) => condition !== cond);
      const success = await commitSessionFields({ conditions: updated });
      if (success === false) {
        setRemovingConds((current) => current.filter((condition) => condition !== cond));
        removalTimersRef.current.delete(cond);
        return;
      }
      const cleanupTimerId = window.setTimeout(() => {
        setRemovingConds((current) => current.filter((condition) => condition !== cond));
        removalTimersRef.current.delete(cond);
      }, 170);
      removalTimersRef.current.set(cond, cleanupTimerId);
    }, 150);

    removalTimersRef.current.set(cond, timerId);
  }

  const initial = (char.name || "?").charAt(0).toUpperCase();

  const cardBorderColor = hpDanger ? "rgba(192,96,96,0.45)" : cardPal.border;
  const stripeColor = hpDanger ? "#c06060" : cardPal.accent;
  const activeSurface = isActiveTurn
    ? getPartyCardActiveSurface(charPal, pal, cardPal)
    : cardPal.surface;

  function handlePopoverUpdate(action) {
    if (action === "shortRest" || action === "longRest") onUpdate(action);
    else onUpdate();
  }

  // Palette CSS variables set once on the card root — all children inherit via cascade
  const cardPalVars = {
    "--pal-bg": cardPal.bg,
    "--pal-surface": cardPal.surface,
    "--pal-surface-solid": cardPal.surfaceSolid,
    "--pal-border": cardPal.border,
    "--pal-accent": cardPal.accent,
    "--pal-accent-bright": cardPal.accentBright,
    "--pal-accent-dim": cardPal.accentDim,
    "--pal-text": cardPal.text,
    "--pal-text-body": cardPal.textBody,
    "--pal-text-muted": cardPal.textMuted,
    "--pal-gem": cardPal.gem,
    "--pal-gem-low": cardPal.gemLow,
    "--pal-ui-border": cardPal.uiBorder,
    "--font-display": cardPal.fontDisplay,
    "--font-body": cardPal.fontBody,
    "--font-ui": cardPal.fontUI,
    // Active-turn animation vars (referenced by .dm-active-turn keyframe in dashboard.css)
    ...(isActiveTurn ? {
      "--turn-color": cardPal.accent,
      "--turn-glow": withAlpha(cardPal.accent, 0.35),
    } : {}),
  };

  return (
    <div
      className={`cc-card${isActiveTurn ? " dm-active-turn" : ""}`}
      style={{
        ...cardPalVars,
        background: activeSurface,
        border: `1px solid ${cardBorderColor}`,
        zIndex: popoverOpen ? 200 : isActiveTurn ? 2 : 1,
        transform: isActiveTurn ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isActiveTurn ? `0 4px 18px ${cardPal.accent}24` : "none",
      }}
    >
      {/* Left accent stripe — color is dynamic (hp danger vs normal) */}
      <div className="cc-stripe" style={{ background: stripeColor }} />

      {/* Active-turn glow bar along bottom edge */}
      {isActiveTurn && (
        <div
          className="cc-turn-bar"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${cardPal.accent} 14%, ${cardPal.accentBright} 50%, ${cardPal.accent} 86%, transparent 100%)`,
            boxShadow: `0 0 18px ${cardPal.accent}99`,
          }}
        />
      )}

      <div className="cc-header-grid">
        {/* Portrait */}
        <div className="cc-portrait">
          {char.portraitUrl ? (
            <img src={char.portraitUrl} alt={char.name} />
          ) : (
            <span className="cc-portrait-initial">{initial}</span>
          )}
        </div>

        {/* Character body */}
        <div
          style={{ minWidth: 0, cursor: onHeaderClick ? "pointer" : "default" }}
          onClick={onHeaderClick}
        >
          {/* Name + AC row */}
          <div className="cc-name-row">
            <div
              className="cc-name-text"
              style={{ textShadow: isActiveTurn ? `0 0 10px ${cardPal.accent}55` : "none" }}
            >{char.name || "Unknown"}</div>
            <div className="cc-ac-badge">
              AC {char.armorTotal ?? "—"}
            </div>
          </div>

          {/* Race · Class · Level + external link */}
          <div className="cc-meta-row">
            <span className="cc-meta-text">
              {metaParts.join(" · ")}
            </span>
            <Link
              to={`/characters/${char.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${char.name || "character"} sheet`}
              className="cc-external-link"
            >
              <ExternalLinkIcon color={cardPal.textMuted} />
            </Link>
          </div>

          {/* HP row */}
          {hasHp && (
            <div className="cc-hp-row">
              <button
                className="btn-stepper-sm"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); minusBind.start(); }}
                onPointerUp={minusBind.stop}
                onPointerCancel={minusBind.stop}
                title="Deal 1 damage (hold to repeat)"
              >−</button>
              <div className="cc-hp-nums">
                <span className="cc-hp-current" style={{ color: hpTone.text }}>{displayHp}</span>
                <span className="cc-hp-sep">/</span>
                <span className="cc-hp-max">{hpMax}</span>
              </div>
              <div className="cc-hp-bar">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const segStart = idx / 5;
                  const segFill = Math.max(0, Math.min(1, (hpPct - segStart) * 5));
                  return (
                    <div key={idx} className="cc-hp-seg">
                      {/* Fill width is dynamic — must stay inline */}
                      <div style={{ position: "absolute", inset: 0, width: `${segFill * 100}%`, background: hpTone.fill, transition: "width 0.25s ease" }} />
                    </div>
                  );
                })}
                {hpFeedback && (
                  <div
                    className={`dm-hp-feedback ${hpFeedback === "damage" ? "dm-hp-feedback-damage" : "dm-hp-feedback-heal"}`}
                    style={{
                      background: hpFeedback === "damage"
                        ? "linear-gradient(90deg, rgba(192,96,96,0.28) 0%, rgba(192,96,96,0.08) 100%)"
                        : `linear-gradient(90deg, ${cardPal.accentBright}3d 0%, transparent 100%)`,
                      boxShadow: hpFeedback === "heal" ? `0 0 14px ${cardPal.accentBright}55 inset` : "none",
                    }}
                  />
                )}
              </div>
              <button
                className="btn-stepper-sm"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); plusBind.start(); }}
                onPointerUp={plusBind.stop}
                onPointerCancel={plusBind.stop}
                title="Heal 1 HP (hold to repeat)"
              >+</button>
              {deltaIndicator && (
                <span key={deltaIndicator.key} className="dm-hp-delta" style={{ color: hpTone.text }}>
                  {deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : `${deltaIndicator.value}`}
                </span>
              )}
            </div>
          )}

          {/* Temp HP */}
          {hasHp && char.tempHP > 0 && (
            <div className="cc-temp-hp-row">
              <span className="cc-temp-hp-badge">
                +{char.tempHP} temp
              </span>
            </div>
          )}

          {/* Death saves */}
          {showDeathSaves && (
            <>
              <div className="cc-death-saves">
                <span className="cc-death-saves-label">Death Saves</span>
                <div className="cc-death-pips">
                  {[0, 1, 2].map((idx) => (
                    <span key={`save-s-${idx}`} style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px dashed ${idx < deathSaves.successes ? "#5a9a5a" : "rgba(90,154,90,0.4)"}`, background: idx < deathSaves.successes ? "#5a9a5a" : "transparent", display: "inline-block" }} />
                  ))}
                </div>
                <span className="cc-death-saves-sep">/</span>
                <div className="cc-death-pips">
                  {[0, 1, 2].map((idx) => (
                    <span key={`save-f-${idx}`} style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px dashed ${idx < deathSaves.failures ? "#c06060" : "rgba(192,96,96,0.35)"}`, background: idx < deathSaves.failures ? "#c06060" : "transparent", display: "inline-block" }} />
                  ))}
                </div>
              </div>
              <div className="cc-player-reported">
                player-reported
              </div>
            </>
          )}

          {/* Status row: conditions, concentration, inspiration */}
          {hasStatusRow && (
            <div className="cc-status-row" style={{ marginBottom: spellSlotGroups.length > 0 ? 8 : 6 }}>
              {visibleConds.map((cond) => {
                const cs = conditionStyle(cond);
                const isRemoving = removingConds.includes(cond);
                return (
                  <span
                    key={cond}
                    onClick={() => removeCondition(cond)}
                    title={`Remove ${cond}`}
                    className={isRemoving ? "dm-condition-exit" : "dm-condition-enter"}
                    style={{ background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 10, color: cs.color, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", cursor: "pointer" }}
                  >{cond} ×</span>
                );
              })}
              {concentrationDisplay && (
                <span className={`cc-concentration${!isConcentrating && fadingConcentration ? " dm-fade-out" : ""}`}>
                  <span className="dm-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: cardPal.accentBright, boxShadow: `0 0 5px ${cardPal.accentBright}`, flexShrink: 0, display: "inline-block" }} />
                  {concentrationDisplay.spell || "Concentrating"}
                  <span className="cc-con-save">· CON {conSaveLabel}</span>
                </span>
              )}
              {char.inspiration && (
                <span className="cc-inspiration">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: cardPal.gem, boxShadow: `0 0 6px ${cardPal.gem}66`, display: "inline-block" }} />
                  Inspired
                </span>
              )}
            </div>
          )}

          {/* Spell slots */}
          {spellSlotGroups.length > 0 && (
            <div className="cc-slots-row">
              {spellSlotGroups.map((slot) => (
                <div key={slot.key} className="cc-slot-group">
                  <span className="cc-slot-label">
                    L{slot.label}
                  </span>
                  {Array.from({ length: slot.max }).map((_, pipIdx) => {
                    const remaining = slot.max - slot.used;
                    const filled = pipIdx < remaining;
                    return (
                      <span
                        key={`${slot.key}-${pipIdx}`}
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: filled ? cardPal.gem : "transparent",
                          border: `1.5px solid ${filled ? cardPal.gem : cardPal.uiBorder}`,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Tier-2 collapse: XP + Coin */}
          <div
            className="cc-tier2"
            style={{
              maxHeight: showTier2 ? 220 : 0,
              opacity: showTier2 ? 1 : 0,
              pointerEvents: showTier2 ? "auto" : "none",
            }}
          >
            <hr className="divider" style={{ marginTop: 4, marginBottom: 8, opacity: 0.7 }} />

            <div className="cc-tier2-inner">
              {(char.levelingMode || "milestone") === "xp" && (() => {
              const level = char.level || 1;
              const xp = optimisticXp;
              const nextThreshold = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[20];
              const currentThreshold = XP_THRESHOLDS[level] ?? 0;
              const isMaxLevel = level >= 20;
              const isReady = !isMaxLevel && xp >= nextThreshold;
              const progress = isMaxLevel ? 1 : Math.min(1, Math.max(0, (xp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)));
              return (
                <div className="cc-xp-row">
                  <span className="cc-xp-label">XP</span>
                  <div className="cc-xp-bar" style={{ background: `${cardPal.accent}18` }}>
                    {/* Width is dynamic */}
                    <div style={{ height: "100%", width: `${progress * 100}%`, background: isReady ? cardPal.gem : cardPal.accent, borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: isReady ? cardPal.accentBright : cardPal.text }}>
                    {xp.toLocaleString()}
                  </span>
                  {!isMaxLevel && (
                    <span className="cc-xp-next">
                      / {nextThreshold >= 1000 ? `${Math.round(nextThreshold / 1000)}k` : nextThreshold}
                    </span>
                  )}
                  <button
                    onClick={() => setShowAwardXp(true)}
                    className="cc-xp-add-btn"
                    title="Award XP"
                  >+</button>
                </div>
              );
            })()}

              {(() => {
              const gpVal = displayCoin.gp ?? 0;
              return (
                <div className="cc-coin-row" style={{ gap: coinMode === "gp" ? 0 : 5 }}>
                  <div className="cc-coin-header">
                    <span className="cc-coin-label">GP</span>
                    {coinMode === "gp" ? (
                      <span className="cc-coin-pill">
                        <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: COIN_COLORS.gp }}>{gpVal.toLocaleString()}</span>
                        <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: "rgba(200,160,64,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>gp</span>
                      </span>
                    ) : (
                      <span className="cc-coin-pill">
                        <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, color: "rgba(200,160,64,0.55)" }}>≈</span>
                        <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: COIN_COLORS.gp }}>{coinEquivalent}</span>
                        <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: "rgba(200,160,64,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>gp</span>
                      </span>
                    )}
                    {coinMode === "gp" ? (
                      <button
                        onClick={() => setShowDistributeCoin(true)}
                        className="cc-coin-give-btn"
                      >Give</button>
                    ) : (
                      <button
                        onClick={() => setCoinExpanded((value) => !value)}
                        className="cc-coin-expand-btn"
                        title={coinExpanded ? "Hide purse breakdown" : "Show purse breakdown"}
                      >
                        {coinExpanded ? "˄" : "˅"}
                      </button>
                    )}
                  </div>

                  {coinMode !== "gp" && coinExpanded && (
                    <div className="cc-coin-breakdown">
                      {["cp", "sp", "ep", "gp", "pp"].map((denom) => (
                        <span
                          key={denom}
                          className="cc-coin-denom"
                          style={{
                            background: `${COIN_COLORS[denom]}14`,
                            border: `1px solid ${COIN_COLORS[denom]}55`,
                          }}
                        >
                          <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 11, color: COIN_COLORS[denom] }}>
                            {(displayCoin[denom] || 0).toLocaleString()}
                          </span>
                          <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: COIN_COLORS[denom], letterSpacing: "0.12em", textTransform: "uppercase" }}>
                            {DENOM_SHORT[denom].toLowerCase()}
                          </span>
                        </span>
                      ))}
                      <button
                        onClick={() => setShowDistributeCoin(true)}
                        className="cc-coin-give-btn"
                      >Give</button>
                    </div>
                  )}
                </div>
              );
            })()}
            </div>
          </div>
        </div>

        {/* Actions column: kebab menu + popover */}
        <div className="cc-actions-col">
          <button
            onClick={() => setPopoverOpen((value) => !value)}
            className={`cc-kebab-btn${popoverOpen ? " active" : ""}`}
            title="More actions"
          >⋯</button>

          {popoverOpen && (
            <QuickActionPopover
              char={char}
              pal={cardPal}
              basePal={charPal}
              onClose={() => setPopoverOpen(false)}
              onUpdate={handlePopoverUpdate}
              onOpenHpModal={setModalMode}
              onCommitFields={commitSessionFields}
            />
          )}
        </div>
      </div>

      <NotesStrip
        slug={char.slug}
        dmNotes={char.dmNotes || []}
        sharedPlayerNotes={char.sharedPlayerNotes || []}
        dmPassword={dmPassword}
        pal={cardPal}
      />

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

      {showAwardXp && (
        <AwardXpModal
          char={{ ...char, xpCurrent: optimisticXp }}
          dmPassword={dmPassword}
          onClose={() => setShowAwardXp(false)}
          onUpdate={onUpdate}
          onOptimisticUpdate={(updates) => {
            const me = updates.find((u) => u.slug === char.slug);
            if (me) { xpPendingRef.current = true; setOptimisticXp(me.xpCurrent); setTimeout(() => { xpPendingRef.current = false; }, 3000); }
          }}
          forParty={false}
          party={allParty}
        />
      )}

      {showDistributeCoin && (
        <DistributeCoinModal
          char={{ ...char, coin: optimisticCoin }}
          dmPassword={dmPassword}
          onClose={() => setShowDistributeCoin(false)}
          onUpdate={onUpdate}
          onOptimisticUpdate={(updates) => {
            const me = updates.find((u) => u.slug === char.slug);
            if (me) { coinPendingRef.current = true; setOptimisticCoin(me.coin); setTimeout(() => { coinPendingRef.current = false; }, 3000); }
          }}
          forParty={false}
          party={allParty}
        />
      )}
    </div>
  );
}
