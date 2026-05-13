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
} from "./dashboardShared";

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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.76)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 5, padding: "24px 26px 22px", width: "100%", maxWidth: 380 }}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 15, color: pal.text, letterSpacing: "0.1em", marginBottom: 4 }}>Award XP</div>
        <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.12em", color: pal.textMuted, marginBottom: 20, textTransform: "uppercase" }}>{awardAll ? "Whole Party" : (char?.name || "")}</div>

        <label style={{ display: "block", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 6 }}>Amount</label>
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus style={{ width: "100%", background: "rgba(18,32,48,0.9)", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 28, letterSpacing: "0.05em", padding: "10px 14px", outline: "none", textAlign: "center", MozAppearance: "textfield" }} onFocus={(e) => { e.target.style.borderColor = pal.accent; }} onBlur={(e) => { e.target.style.borderColor = pal.border; }} />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, marginBottom: 18 }}>
          <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.textMuted, alignSelf: "center" }}>Quick:</span>
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(String(p))} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 13, padding: "4px 11px", cursor: "pointer", transition: "border-color 0.14s, color 0.14s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accentBright; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = pal.border; e.currentTarget.style.color = pal.textMuted; }}>{p}</button>
          ))}
        </div>

        {party.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <label style={{ position: "relative", width: 36, height: 20, cursor: "pointer", display: "block", flexShrink: 0 }}>
              <input type="checkbox" checked={awardAll} onChange={(e) => setAwardAll(e.target.checked)} style={{ display: "none" }} />
              <div style={{ width: 36, height: 20, background: awardAll ? `rgba(106,143,168,0.35)` : "rgba(100,130,160,0.15)", border: `1px solid ${awardAll ? pal.accent : pal.border}`, borderRadius: 10, transition: "background 0.18s, border-color 0.18s" }} />
              <div style={{ position: "absolute", top: 3, left: awardAll ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: awardAll ? pal.accentBright : pal.textMuted, transition: "left 0.18s, background 0.18s" }} />
            </label>
            <span style={{ fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.1em", color: pal.textBody }}>Award to whole party</span>
          </div>
        )}

        {error && <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "7px 16px", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleAward} style={{ background: "rgba(18,58,78,0.5)", border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.1em", padding: "7px 20px", cursor: "pointer" }}>Award XP</button>
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.76)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 5, padding: "24px 26px 22px", width: "100%", maxWidth: 400 }}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 15, color: pal.text, letterSpacing: "0.1em", marginBottom: 4 }}>Distribute Coin</div>
        <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.12em", color: pal.textMuted, marginBottom: 18, textTransform: "uppercase" }}>
          {forParty ? "Whole Party" : (char?.name || "")}
        </div>

        {/* Give / Deduct toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {pillBtn(action === "give", pal.accent, () => setAction("give"), "Give")}
          {pillBtn(action === "deduct", "#c06060", () => setAction("deduct"), "Deduct")}
        </div>

        {/* Denomination selector */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          {["cp", "sp", "ep", "gp", "pp"].map((d) => {
            const c = COIN_COLORS[d];
            const active = denom === d;
            return (
              <button key={d} onClick={() => setDenom(d)} style={{ background: active ? `${c}22` : "transparent", border: `1px solid ${active ? c : pal.border}`, borderRadius: 4, color: active ? c : pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.14s" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
                {d.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Amount input */}
        <label style={{ display: "block", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 6 }}>Amount</label>
        <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${denomColor}`, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
          <button onClick={() => setAmount((v) => String(Math.max(0, (parseInt(v, 10) || 0) - 10)))} style={{ width: 36, background: "transparent", border: "none", color: denomColor, fontFamily: pal.fontDisplay, fontSize: 20, cursor: "pointer" }}>−</button>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus style={{ flex: 1, background: "transparent", border: "none", color: denomColor, fontFamily: pal.fontDisplay, fontSize: 28, letterSpacing: "0.05em", padding: "8px 0", outline: "none", textAlign: "center", MozAppearance: "textfield" }} />
          <button onClick={() => setAmount((v) => String((parseInt(v, 10) || 0) + 10))} style={{ width: 36, background: "transparent", border: "none", color: denomColor, fontFamily: pal.fontDisplay, fontSize: 20, cursor: "pointer" }}>+</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.textMuted, alignSelf: "center" }}>Quick:</span>
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(String(p))} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 13, padding: "4px 11px", cursor: "pointer", transition: "border-color 0.14s, color 0.14s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = denomColor; e.currentTarget.style.color = denomColor; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = pal.border; e.currentTarget.style.color = pal.textMuted; }}>{p}</button>
          ))}
        </div>

        {/* Target selector (only shown for party actions) */}
        {party.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>Targets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button onClick={toggleAll} style={{ background: targets.length === allSlugs.length ? `${pal.accent}22` : "transparent", border: `1px solid ${targets.length === allSlugs.length ? pal.accent : pal.border}`, borderRadius: 4, color: targets.length === allSlugs.length ? pal.accentBright : pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em", padding: "4px 10px", cursor: "pointer" }}>All Party</button>
              {party.map((c) => {
                const sel = targets.includes(c.slug);
                return (
                  <button key={c.slug} onClick={() => toggleTarget(c.slug)} style={{ background: sel ? `${pal.accent}22` : "transparent", border: `1px solid ${sel ? pal.accent : pal.border}`, borderRadius: 4, color: sel ? pal.accentBright : pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em", padding: "4px 10px", cursor: "pointer" }}>{c.name}</button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "7px 16px", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleConfirm} style={{ background: `${denomColor}22`, border: `1px solid ${denomColor}`, borderRadius: 3, color: denomColor, fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.1em", padding: "7px 20px", cursor: "pointer" }}>Confirm</button>
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

function QuickActionPopover({ char, onClose, onUpdate, onOpenHpModal, onCommitFields, initialMode = null, initialVal = "" }) {
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
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(192,96,96,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            onClick={() => { onClose(); onOpenHpModal?.("damage"); }}
          >
            <span style={{ width: 18, textAlign: "center", color: "#d08080", fontSize: 15 }}>⚔</span> Deal Damage
          </div>
          <div
            style={actionStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(80,160,80,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            onClick={() => { onClose(); onOpenHpModal?.("heal"); }}
          >
            <span style={{ width: 18, textAlign: "center", color: "#88c888", fontSize: 15 }}>✦</span> Heal
          </div>
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

  const stripStyle = {
    borderTop: `1px solid ${pal.border}`,
    borderRadius: "0 0 5px 5px",
    cursor: "pointer",
    userSelect: "none",
  };

  const barStyle = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "6px 12px",
    background: stripBarBg,
    borderRadius: open ? 0 : "0 0 5px 5px",
    borderBottom: open ? `1px solid ${pal.border}` : "none",
    transition: "background 0.15s",
  };

  return (
    <div style={stripStyle} onClick={handleToggle}>
      <div style={barStyle}
        onMouseEnter={(e) => { if (!open && !hasNotes) e.currentTarget.style.background = "rgba(106,143,168,0.07)"; }}
        onMouseLeave={(e) => { if (!open && !hasNotes) e.currentTarget.style.background = "transparent"; }}
      >
        <NoteIcon color={iconColor} />
        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: labelColor, flex: 1, transition: "color 0.15s" }}>
          {label}
        </span>
        {dmNoteCount > 0 && (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: `1px solid ${pal.accent}`,
              color: pal.accent,
              fontSize: 10,
              fontFamily: pal.fontDisplay,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              flexShrink: 0,
            }}
            title={`${dmNoteCount} DM note${dmNoteCount === 1 ? "" : "s"}`}
          >
            {dmNoteCount}
          </span>
        )}
        {playerNoteCount > 0 && (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: pal.accent,
              color: pal.bg,
              fontSize: 10,
              fontFamily: pal.fontDisplay,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              flexShrink: 0,
            }}
            title={`${playerNoteCount} player-shared note${playerNoteCount === 1 ? "" : "s"}`}
          >
            {playerNoteCount}
          </span>
        )}
        <span style={{ fontSize: 10, color: pal.textMuted, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", display: "inline-block" }}>▼</span>
      </div>

      <div
        style={{
          maxHeight: open ? 520 : 0,
          overflow: "hidden",
          opacity: open ? 1 : 0,
          transition: "max-height 0.24s ease, opacity 0.18s ease",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div style={{ padding: "10px 12px 12px" }} onClick={(e) => e.stopPropagation()}>
          {dmNotes.length > 0 && (
            <ul style={{ listStyle: "none", marginBottom: 8 }}>
              {dmNotes.map((note, idx) => (
                <li key={note.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: idx < dmNotes.length - 1 ? `1px solid ${pal.border}` : "none" }}>
                  <span style={{ flex: 1, fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, lineHeight: 1.5 }}>{note.text}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                    style={{ background: "transparent", border: "none", color: "#c06060", cursor: "pointer", fontSize: 15, padding: "0 2px", opacity: 0.45, lineHeight: 1, flexShrink: 0, marginTop: 1, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.45"; }}
                    title="Delete note"
                  >×</button>
                </li>
              ))}
            </ul>
          )}

          {(sharedPlayerNotes || []).length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 6px" }}>
                <div style={{ flex: 1, height: 1, background: pal.border }} />
                <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: pal.gem, whiteSpace: "nowrap", opacity: 0.85 }}>
                  Player shared
                </span>
                <div style={{ flex: 1, height: 1, background: pal.border }} />
              </div>
              {(sharedPlayerNotes || []).map((note) => (
                <div key={note.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 8px", background: `rgba(138,180,200,0.06)`, borderRadius: 3, borderLeft: `2px solid ${pal.gem}`, marginBottom: 5 }}>
                  <span style={{ flex: 1, fontFamily: pal.fontBody, fontSize: 13, fontStyle: "italic", color: pal.textBody, lineHeight: 1.5 }}>{note.text}</span>
                </div>
              ))}
            </>
          )}

          {dmNotes.length === 0 && (sharedPlayerNotes || []).length === 0 && (
            <div style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 13, color: pal.textMuted, padding: "2px 0 6px" }}>No notes yet.</div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              maxLength={500}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="Add a note… (Enter to save)"
              style={{ flex: 1, background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "6px 10px", outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = pal.accent; }}
              onBlur={(e) => { e.target.style.borderColor = pal.border; }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleAdd(); }}
              style={{ background: `rgba(18,58,78,0.5)`, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(106,143,168,0.22)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(18,58,78,0.5)`; }}
            >+ Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CharacterCard({ char, dmPassword, onUpdate, onCommitSessionUpdates, onRegisterOpen, isActiveTurn = false, allParty = [] }) {
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

  const [optimisticXp, setOptimisticXp] = useState(char.xpCurrent ?? 0);
  const xpPendingRef = useRef(false);
  const [optimisticCoin, setOptimisticCoin] = useState(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  const coinPendingRef = useRef(false);

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

  useEffect(() => {
    if (!xpPendingRef.current) setOptimisticXp(char.xpCurrent ?? 0);
  }, [char.xpCurrent]);

  useEffect(() => {
    if (!coinPendingRef.current) setOptimisticCoin(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  }, [char.coin]);

  useEffect(() => {
    setCoinExpanded(false);
  }, [char.slug, char.coinMode]);

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
  const visibleConds = conditions;

  const concentration = char.concentration;
  const isConcentrating = concentration?.active;
  const conScore = char.stats?.find((s) => s.stat === "Constitution")?.score ?? 10;
  const conItemBonus = [...(char.weapons || []), ...(char.equipment || [])].reduce((sum, item) => {
    return sum + (item.mods || []).filter((m) => m.attribute === "Constitution").reduce((s, m) => s + (parseInt(m.value, 10) || 0), 0);
  }, 0);
  const conSaveMod = Math.floor((conScore - 10) / 2) + conItemBonus;
  const conSaveLabel = (conSaveMod >= 0 ? "+" : "") + conSaveMod;
  const hasStatusRow = visibleConds.length > 0 || isConcentrating || !!char.inspiration;
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
    const updated = conditions.filter((condition) => condition !== cond);
    await commitSessionFields({ conditions: updated });
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
      style={{
        background: activeSurface,
        border: `1px solid ${cardBorderColor}`,
        borderRadius: 6,
        marginBottom: 12,
        position: "relative",
        zIndex: popoverOpen ? 50 : isActiveTurn ? 2 : 1,
        overflow: "visible",
        transform: isActiveTurn ? "translateY(-1px)" : "translateY(0)",
        transformOrigin: "center center",
        transition: "transform 0.18s ease",
        boxShadow: isActiveTurn ? `0 4px 18px ${cardPal.accent}24` : "none",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "6px 0 0 6px", background: stripeColor }} />
      {isActiveTurn && (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: -2,
            height: 4,
            borderRadius: 999,
            background: `linear-gradient(90deg, transparent 0%, ${cardPal.accent} 14%, ${cardPal.accentBright} 50%, ${cardPal.accent} 86%, transparent 100%)`,
            boxShadow: `0 0 18px ${cardPal.accent}99`,
            pointerEvents: "none",
          }}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, padding: "12px 14px 10px 18px", alignItems: "start" }}>
        <div style={{
          width: 42,
          height: 42,
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
            <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 16, color: cardPal.gem }}>{initial}</span>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 1, minWidth: 0 }}>
            <div style={{ fontFamily: cardPal.fontDisplay, fontSize: 17, letterSpacing: "0.1em", fontVariant: "small-caps", color: cardPal.accentBright, lineHeight: 1.1, minWidth: 0, flex: 1 }}>{char.name || "Unknown"}</div>
            <div style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${cardPal.uiBorder}`, borderRadius: 3, padding: "4px 10px 3px", fontFamily: cardPal.fontDisplay, fontSize: 13, letterSpacing: "0.1em", fontVariant: "small-caps", color: cardPal.text, whiteSpace: "nowrap", flexShrink: 0 }}>
              AC {char.armorTotal ?? "—"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8, minWidth: 0 }}>
            <span style={{ fontFamily: cardPal.fontUI, fontSize: 11, letterSpacing: "0.08em", color: cardPal.textMuted, minWidth: 0 }}>
              {metaParts.join(" · ")}
            </span>
            <Link
              to={`/characters/${char.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${char.name || "character"} sheet`}
              style={{
                color: cardPal.textMuted,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ExternalLinkIcon color={cardPal.textMuted} />
            </Link>
          </div>

          {hasHp && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, position: "relative" }}>
              <button style={stepBtnStyle} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); minusBind.start(); }} onPointerUp={minusBind.stop} onPointerCancel={minusBind.stop} title="Deal 1 damage (hold to repeat)">−</button>
              <div style={{ display: "flex", alignItems: "baseline", gap: 0, whiteSpace: "nowrap", flexShrink: 0 }}>
                <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 20, lineHeight: 1, color: hpTone.text }}>{displayHp}</span>
                <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 13, color: cardPal.textMuted }}>/</span>
                <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 13, color: cardPal.textMuted }}>{hpMax}</span>
              </div>
              <div style={{ flex: 1, height: 10, borderRadius: 2, overflow: "hidden", background: "rgba(7,14,22,0.88)", position: "relative", display: "flex", gap: 1 }}>
                {Array.from({ length: 5 }).map((_, idx) => {
                  const segStart = idx / 5;
                  const segFill = Math.max(0, Math.min(1, (hpPct - segStart) * 5));
                  return (
                    <div key={idx} style={{ flex: 1, position: "relative", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, width: `${segFill * 100}%`, background: hpTone.fill, transition: "width 0.25s ease" }} />
                    </div>
                  );
                })}
              </div>
              <button style={stepBtnStyle} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); plusBind.start(); }} onPointerUp={plusBind.stop} onPointerCancel={plusBind.stop} title="Heal 1 HP (hold to repeat)">+</button>
              {deltaIndicator && (
                <span key={deltaIndicator.key} className="dm-hp-delta" style={{ color: hpTone.text }}>
                  {deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : `${deltaIndicator.value}`}
                </span>
              )}
            </div>
          )}

          {hasHp && char.tempHP > 0 && (
            <div style={{ marginTop: -2, marginBottom: 8 }}>
              <span style={{ background: cardPal.accentDim, border: `1px solid ${cardPal.accent}`, borderRadius: 8, padding: "1px 7px", fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.08em", color: cardPal.accentBright }}>
                +{char.tempHP} temp
              </span>
            </div>
          )}

          {showDeathSaves && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 2, borderRadius: 4, background: "rgba(192,60,60,0.08)", borderTop: "1px solid rgba(192,80,80,0.2)" }}>
                <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#c06060", flex: 1 }}>Death Saves</span>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {[0, 1, 2].map((idx) => (
                    <span key={`save-s-${idx}`} style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px dashed ${idx < deathSaves.successes ? "#5a9a5a" : "rgba(90,154,90,0.4)"}`, background: idx < deathSaves.successes ? "#5a9a5a" : "transparent", display: "inline-block" }} />
                  ))}
                </div>
                <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: cardPal.textMuted, margin: "0 4px" }}>/</span>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {[0, 1, 2].map((idx) => (
                    <span key={`save-f-${idx}`} style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px dashed ${idx < deathSaves.failures ? "#c06060" : "rgba(192,96,96,0.35)"}`, background: idx < deathSaves.failures ? "#c06060" : "transparent", display: "inline-block" }} />
                  ))}
                </div>
              </div>
              <div style={{ fontFamily: cardPal.fontBody, fontStyle: "italic", fontSize: 9, color: cardPal.textMuted, textAlign: "right", marginBottom: 8, paddingRight: 2, letterSpacing: "0.02em" }}>
                player-reported
              </div>
            </>
          )}

          {hasStatusRow && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: spellSlotGroups.length > 0 ? 8 : 6 }}>
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
              {isConcentrating && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.12em", color: cardPal.accentBright }}>
                  <span className="dm-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: cardPal.accentBright, boxShadow: `0 0 5px ${cardPal.accentBright}`, flexShrink: 0, display: "inline-block" }} />
                  {concentration.spell || "Concentrating"}
                  <span style={{ color: cardPal.textMuted, fontSize: 9, letterSpacing: "0.08em" }}>· CON {conSaveLabel}</span>
                </span>
              )}
              {char.inspiration && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: cardPal.gem }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: cardPal.gem, boxShadow: `0 0 6px ${cardPal.gem}66`, display: "inline-block" }} />
                  Inspired
                </span>
              )}
            </div>
          )}

          {spellSlotGroups.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {spellSlotGroups.map((slot) => (
                <div key={slot.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: cardPal.textMuted, marginRight: 2 }}>
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

          <div style={{ marginTop: 4, marginBottom: 8, height: 1, background: cardPal.border, opacity: 0.7 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(char.levelingMode || "milestone") === "xp" && (() => {
              const level = char.level || 1;
              const xp = optimisticXp;
              const nextThreshold = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[20];
              const currentThreshold = XP_THRESHOLDS[level] ?? 0;
              const isMaxLevel = level >= 20;
              const isReady = !isMaxLevel && xp >= nextThreshold;
              const progress = isMaxLevel ? 1 : Math.min(1, Math.max(0, (xp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)));
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: cardPal.textMuted, width: 20, flexShrink: 0 }}>XP</span>
                  <div style={{ flex: 1, height: 4, background: `${cardPal.accent}18`, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress * 100}%`, background: isReady ? cardPal.gem : cardPal.accent, borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: isReady ? cardPal.accentBright : cardPal.text }}>
                    {xp.toLocaleString()}
                  </span>
                  {!isMaxLevel && (
                    <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, color: cardPal.textMuted }}>
                      / {nextThreshold >= 1000 ? `${Math.round(nextThreshold / 1000)}k` : nextThreshold}
                    </span>
                  )}
                  <button onClick={() => setShowAwardXp(true)} style={{ background: "transparent", border: `1px solid ${cardPal.uiBorder}`, borderRadius: 3, color: cardPal.accent, fontFamily: cardPal.fontUI, fontSize: 14, lineHeight: 1, width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "border-color 0.15s, color 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = cardPal.accentBright; e.currentTarget.style.color = cardPal.accentBright; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = cardPal.uiBorder; e.currentTarget.style.color = cardPal.accent; }} title="Award XP">+</button>
                </div>
              );
            })()}

            {(() => {
              const gpVal = displayCoin.gp ?? 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: coinMode === "gp" ? 0 : 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: cardPal.textMuted, width: 20, flexShrink: 0 }}>GP</span>
                    {coinMode === "gp" ? (
                      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3, background: "rgba(200,160,64,0.08)", border: "1px solid rgba(200,160,64,0.22)", borderRadius: 8, padding: "2px 8px" }}>
                        <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: COIN_COLORS.gp }}>{gpVal.toLocaleString()}</span>
                        <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: "rgba(200,160,64,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>gp</span>
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3, background: "rgba(200,160,64,0.08)", border: "1px solid rgba(200,160,64,0.22)", borderRadius: 8, padding: "2px 8px" }}>
                        <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, color: "rgba(200,160,64,0.55)" }}>≈</span>
                        <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: COIN_COLORS.gp }}>{coinEquivalent}</span>
                        <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: "rgba(200,160,64,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>gp</span>
                      </span>
                    )}
                    {coinMode === "gp" ? (
                      <button
                        onClick={() => setShowDistributeCoin(true)}
                        style={{ background: "transparent", border: `1px solid rgba(200,160,64,0.3)`, borderRadius: 4, color: "rgba(200,160,64,0.7)", fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.08em", padding: "3px 8px", cursor: "pointer", transition: "all 0.14s", marginLeft: "auto" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = COIN_COLORS.gp; e.currentTarget.style.color = COIN_COLORS.gp; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(200,160,64,0.3)"; e.currentTarget.style.color = "rgba(200,160,64,0.7)"; }}
                      >Give</button>
                    ) : (
                      <button
                        onClick={() => setCoinExpanded((value) => !value)}
                        style={{ width: 20, height: 20, borderRadius: 3, border: "1px solid rgba(200,160,64,0.2)", background: "transparent", color: "rgba(200,160,64,0.5)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "border-color 0.12s, color 0.12s", marginLeft: "auto" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(200,160,64,0.5)"; e.currentTarget.style.color = COIN_COLORS.gp; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(200,160,64,0.2)"; e.currentTarget.style.color = "rgba(200,160,64,0.5)"; }}
                        title={coinExpanded ? "Hide purse breakdown" : "Show purse breakdown"}
                      >
                        {coinExpanded ? "˄" : "˅"}
                      </button>
                    )}
                  </div>

                  {coinMode !== "gp" && coinExpanded && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 28, flexWrap: "wrap" }}>
                      {["cp", "sp", "ep", "gp", "pp"].map((denom) => (
                        <span
                          key={denom}
                          style={{
                            display: "inline-flex",
                            alignItems: "baseline",
                            gap: 3,
                            background: `${COIN_COLORS[denom]}14`,
                            border: `1px solid ${COIN_COLORS[denom]}55`,
                            borderRadius: 8,
                            padding: "2px 8px",
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
                        style={{ background: "transparent", border: `1px solid rgba(200,160,64,0.3)`, borderRadius: 4, color: "rgba(200,160,64,0.7)", fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.08em", padding: "3px 8px", cursor: "pointer", transition: "all 0.14s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = COIN_COLORS.gp; e.currentTarget.style.color = COIN_COLORS.gp; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(200,160,64,0.3)"; e.currentTarget.style.color = "rgba(200,160,64,0.7)"; }}
                      >Give</button>
                    </div>
                  )}
                  </div>
              );
            })()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, position: "relative", paddingTop: 1 }}>
          <button
            onClick={() => setPopoverOpen((value) => !value)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 3,
              border: "none",
              background: popoverOpen ? "rgba(255,255,255,0.06)" : "transparent",
              color: popoverOpen ? cardPal.text : cardPal.textMuted,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              letterSpacing: "0.05em",
              padding: 0,
            }}
            title="More actions"
          >⋯</button>

          {popoverOpen && (
            <QuickActionPopover
              char={char}
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
