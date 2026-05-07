import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { putNpcCombat } from "../../api";
import { PALETTES } from "../characterSheet/theme";
import { useDebouncedOptimisticNumberFlush } from "../../lib/liveSync";
import ConfirmDialog from "./ConfirmDialog";
import {
  ALL_CONDITIONS,
  PalCtx,
  VELLUM_CARD_MODE,
  getActiveTurnSurface,
  mixHex,
  useHoldToRepeat,
  withAlpha,
} from "./dashboardShared";

const NPC_ACCENT = "#7a7060";
const NPC_BRIGHT = "#b0a080";
const NPC_SURFACE = "rgba(30,26,20,0.6)";
const NPC_BORDER = "rgba(120,110,90,0.3)";

function getNpcCardPalette(dashboardPal) {
  if (dashboardPal !== PALETTES.vellum) {
    return {
      surface: NPC_SURFACE,
      border: NPC_BORDER,
      accent: NPC_ACCENT,
      bright: NPC_BRIGHT,
      track: "rgba(40,34,24,0.8)",
      chipBg: "rgba(122,112,96,0.12)",
      actionBorder: NPC_BORDER,
    };
  }

  const paperTint = mixHex(VELLUM_CARD_MODE.paper, NPC_ACCENT, 0.2);
  const paperTintStrong = mixHex(VELLUM_CARD_MODE.paperAlt, NPC_ACCENT, 0.28);
  const accent = mixHex(NPC_ACCENT, VELLUM_CARD_MODE.ink, 0.24);
  const borderTone = mixHex(NPC_ACCENT, VELLUM_CARD_MODE.line, 0.36);

  return {
    surface: withAlpha(mixHex(paperTint, "#6b5c49", 0.08), 0.62),
    border: withAlpha(borderTone, 0.56),
    accent,
    bright: mixHex(NPC_BRIGHT, VELLUM_CARD_MODE.ink, 0.22),
    track: withAlpha(mixHex(paperTintStrong, "#6b5c49", 0.18), 0.7),
    chipBg: withAlpha(mixHex(paperTintStrong, accent, 0.18), 0.78),
    actionBorder: withAlpha(borderTone, 0.48),
  };
}

function npcHpStatus(npc) {
  if (npc.hpCurrent <= 0) return "dead";
  if (npc.hpCurrent < npc.hpMax / 2) return "bloodied";
  return "alive";
}

function NpcDamageHealModal({ npc, mode, onClose, onOptimisticUpdate, onConfirm }) {
  const pal = useContext(PalCtx);
  const [amount, setAmount] = useState(0);
  const isHeal = mode === "heal";
  const accentColor = isHeal ? "#5a9a5a" : "#c06060";
  const accentBright = isHeal ? "#88c888" : "#d08080";
  const minusBind = useHoldToRepeat(() => setAmount((value) => Math.max(0, value - 1)));
  const plusBind = useHoldToRepeat(() => setAmount((value) => value + 1));

  function confirm() {
    const newHp = isHeal ? Math.min(npc.hpMax, npc.hpCurrent + amount) : npc.hpCurrent - amount;
    onOptimisticUpdate(newHp);
    onConfirm(newHp);
    onClose();
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") confirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={onClose}>
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${accentColor}`, borderRadius: 8, padding: "24px 28px", maxWidth: 340, width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 4 }}>
          {isHeal ? "✦ Heal" : "⚔ Deal Damage"} — {npc.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "20px 0" }}>
          <button onPointerDown={minusBind.start} onPointerUp={minusBind.stop} onPointerLeave={minusBind.stop} style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${accentColor}`, background: "transparent", color: accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer" }}>−</button>
          <input type="number" value={amount} min="0" onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: 90, background: "transparent", border: "none", borderBottom: `2px solid ${accentColor}`, color: accentBright, fontFamily: pal.fontDisplay, fontSize: 42, textAlign: "center", outline: "none" }} />
          <button onPointerDown={plusBind.start} onPointerUp={plusBind.stop} onPointerLeave={plusBind.stop} style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${accentColor}`, background: "transparent", color: accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer" }}>+</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 20 }}>
          {[3, 5, 8, 10, 15, 20].map((preset) => (
            <button key={preset} onClick={() => setAmount(preset)} style={{ padding: "5px 12px", borderRadius: 4, border: `1px solid ${amount === preset ? accentColor : "rgba(100,130,160,0.32)"}`, background: amount === preset ? `rgba(${isHeal ? "80,160,80" : "192,96,96"},0.15)` : "transparent", color: amount === preset ? accentBright : pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, cursor: "pointer" }}>{preset}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 4, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "8px 0", cursor: "pointer" }}>Cancel</button>
          <button onClick={confirm} style={{ flex: 2, background: `rgba(${isHeal ? "80,160,80" : "192,96,96"},0.15)`, border: `1px solid ${accentColor}`, borderRadius: 4, color: accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "8px 0", cursor: "pointer" }}>
            {isHeal ? `Heal ${amount}` : `Deal ${amount} damage`}
          </button>
        </div>
      </div>
    </div>
  );
}

function NpcConditionPicker({ npc, onAdd, onClose }) {
  const pal = useContext(PalCtx);
  const existing = new Set(npc.conditions || []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={onClose}>
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${pal.accent}`, borderRadius: 8, padding: "20px 24px", maxWidth: 360, width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.accentBright, marginBottom: 14 }}>Add Condition — {npc.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_CONDITIONS.map((condition) => (
            <button
              key={condition}
              disabled={existing.has(condition)}
              onClick={() => onAdd(condition)}
              style={{ padding: "5px 12px", borderRadius: 10, border: `1px solid ${existing.has(condition) ? pal.border : pal.accent}`, background: existing.has(condition) ? "transparent" : "rgba(106,143,168,0.1)", color: existing.has(condition) ? pal.textMuted : pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", cursor: existing.has(condition) ? "not-allowed" : "pointer" }}
            >{condition}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, width: "100%", background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 4, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "8px 0", cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

function NpcCard({ npc, allNpcsRef, isActiveTurn, dmPassword, onUpdate, onOpenModal, onOpenConditions, onRemove }) {
  const pal = useContext(PalCtx);
  const npcPal = getNpcCardPalette(pal);
  const status = npcHpStatus(npc);
  const isDead = status === "dead";
  const isBloodied = status === "bloodied";

  const serverHp = npc.hpCurrent;
  const hpMax = npc.hpMax;
  const [optimisticHp, setOptimisticHp] = useState(serverHp);
  const optimisticHpRef = useRef(serverHp);
  const serverHpRef = useRef(serverHp);
  const hpMaxRef = useRef(hpMax);
  const pendingDeltaRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const [deltaIndicator, setDeltaIndicator] = useState(null);

  useEffect(() => { optimisticHpRef.current = optimisticHp; }, [optimisticHp]);
  useEffect(() => {
    hpMaxRef.current = hpMax;
    serverHpRef.current = serverHp;
    if (pendingDeltaRef.current === 0 && !flushInFlightRef.current) {
      setOptimisticHp(serverHp);
      optimisticHpRef.current = serverHp;
    }
  }, [serverHp, hpMax]);

  const getTargetHp = useCallback(
    () => Math.min(hpMaxRef.current, Math.max(-999, optimisticHpRef.current)),
    []
  );
  const commitHp = useCallback(async (targetHp) => {
    const updatedNpcs = (allNpcsRef.current || []).map((entry) => entry.id === npc.id ? { ...entry, hpCurrent: targetHp } : entry);
    await putNpcCombat(dmPassword, { npcs: updatedNpcs });
  }, [allNpcsRef, dmPassword, npc.id]);
  const rollbackHp = useCallback((previousServerHp) => {
    optimisticHpRef.current = previousServerHp;
    setOptimisticHp(previousServerHp);
  }, []);
  const debouncedFlushRef = useDebouncedOptimisticNumberFlush({
    enabled: true,
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
    const next = Math.min(hpMax, Math.max(-999, current + delta));
    const actual = next - current;
    if (actual === 0) return;
    pendingDeltaRef.current += actual;
    optimisticHpRef.current = next;
    setOptimisticHp(next);
    setDeltaIndicator({ value: pendingDeltaRef.current, key: Date.now() });
    debouncedFlushRef.current();
  }

  const minusBind = useHoldToRepeat(() => applyDelta(-1));
  const plusBind = useHoldToRepeat(() => applyDelta(1));

  const hpPct = hpMax > 0 ? Math.max(0, Math.min(1, optimisticHp / hpMax)) : 0;
  const hpBarColor = isDead ? "#8c3030" : isBloodied ? "#b07030" : npcPal.accent;
  const leftStripe = isDead ? "#8c3030" : isBloodied ? "#c07030" : npcPal.accent;
  const cardBorder = isDead ? "rgba(192,60,60,0.4)" : isBloodied ? "rgba(180,100,40,0.5)" : npcPal.border;
  const activeSurface = isActiveTurn && !isDead ? getActiveTurnSurface(npcPal.surface, isBloodied ? "#c07030" : npcPal.accent, 0.22, 0.08) : npcPal.surface;
  const glowStyle = isActiveTurn && !isDead ? {
    "--turn-color": isBloodied ? "#b07030" : npcPal.accent,
    "--turn-glow": isBloodied ? "rgba(176,112,48,0.42)" : withAlpha(npcPal.accent, 0.36),
    boxShadow: isBloodied ? "0 0 0 1px rgba(176,112,48,0.7), 0 0 18px 4px rgba(176,112,48,0.26)" : `0 0 0 1px ${withAlpha(npcPal.accent, 0.74)}, 0 0 18px 4px ${withAlpha(npcPal.accent, 0.24)}`,
  } : {};

  const conditions = Array.isArray(npc.conditions) ? npc.conditions : [];

  return (
    <div data-active-turn={isActiveTurn && !isDead ? "true" : undefined} className={isActiveTurn && !isDead ? "dm-active-turn" : undefined} style={{ background: activeSurface, border: `1px solid ${cardBorder}`, borderRadius: 5, marginBottom: 10, position: "relative", opacity: isDead ? 0.75 : 1, overflow: "visible", ...glowStyle }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "5px 0 0 5px", background: leftStripe }} />
      <div style={{ padding: "10px 10px 0 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 15, letterSpacing: "0.05em", color: isDead ? pal.textMuted : npcPal.bright, textDecoration: isDead ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{npc.name}</span>
            {isBloodied && !isDead && (
              <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 8, background: "rgba(180,100,40,0.14)", border: "1px solid rgba(180,100,40,0.45)", color: "#d09050", flexShrink: 0 }}>Bloodied</span>
            )}
            {isDead && (
              <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 8, background: "rgba(192,60,60,0.14)", border: "1px solid rgba(192,60,60,0.4)", color: "#c06060", flexShrink: 0 }}>Dead</span>
            )}
          </div>
          <button onClick={onRemove} style={{ background: "transparent", border: "none", color: pal.textMuted, fontSize: 14, cursor: "pointer", padding: "2px 4px", borderRadius: 3, lineHeight: 1, flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.color = "#c06060"; e.currentTarget.style.background = "rgba(192,96,96,0.1)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = ""; }}>×</button>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 4 }}>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, lineHeight: 1, color: isDead ? "#c06060" : isBloodied ? "#c07830" : npcPal.bright }}>{optimisticHp}</span>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>/</span>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>{hpMax}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 6, position: "relative" }}>
          <button onPointerDown={minusBind.start} onPointerUp={minusBind.stop} onPointerLeave={minusBind.stop} style={{ width: 26, height: 16, borderRadius: 3, border: `1px solid ${npcPal.actionBorder}`, background: "transparent", color: pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", touchAction: "none" }}>−</button>
          <div style={{ flex: 1, padding: "0 5px" }}>
            <div style={{ height: 5, borderRadius: 3, overflow: "hidden", background: npcPal.track }}>
              <div style={{ height: "100%", borderRadius: 3, width: `${hpPct * 100}%`, background: hpBarColor, transition: "width 0.3s ease" }} />
            </div>
          </div>
          <button onPointerDown={plusBind.start} onPointerUp={plusBind.stop} onPointerLeave={plusBind.stop} style={{ width: 26, height: 16, borderRadius: 3, border: `1px solid ${npcPal.actionBorder}`, background: "transparent", color: pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", touchAction: "none" }}>+</button>
          {deltaIndicator && (
            <div key={deltaIndicator.key} className="dm-hp-delta" style={{ color: deltaIndicator.value > 0 ? "#88c888" : "#d08080" }}>{deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : deltaIndicator.value}</div>
          )}
        </div>

        {conditions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
            {conditions.map((condition) => (
              <span
                key={condition}
                onClick={() => {
                  const updated = conditions.filter((value) => value !== condition);
                  const updatedNpcs = (allNpcsRef.current || []).map((entry) => entry.id === npc.id ? { ...entry, conditions: updated } : entry);
                  putNpcCombat(dmPassword, { npcs: updatedNpcs }).then(onUpdate).catch(() => {});
                }}
                style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 10, cursor: "pointer", background: "rgba(140,110,180,0.14)", border: "1px solid rgba(140,110,180,0.38)", color: "#c098e0" }}
                title="Click to remove"
              >{condition}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 5, padding: "6px 10px 8px", borderTop: `1px solid ${npcPal.actionBorder}`, marginTop: 2 }}>
        <button onClick={() => onOpenModal("damage")} style={{ flex: 1, background: "transparent", border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,96,96,0.5)"; e.currentTarget.style.color = "#d08080"; e.currentTarget.style.background = "rgba(192,96,96,0.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = npcPal.actionBorder; e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = "transparent"; }}>⚔ Dmg</button>
        <button onClick={() => onOpenModal("heal")} style={{ flex: 1, background: "transparent", border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(80,160,80,0.5)"; e.currentTarget.style.color = "#88c888"; e.currentTarget.style.background = "rgba(80,160,80,0.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = npcPal.actionBorder; e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = "transparent"; }}>✦ Heal</button>
        <button onClick={onOpenConditions} style={{ flex: 1, background: "transparent", border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(140,110,180,0.5)"; e.currentTarget.style.color = "#c098e0"; e.currentTarget.style.background = "rgba(140,110,180,0.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = npcPal.actionBorder; e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = "transparent"; }}>+ Cond</button>
      </div>
    </div>
  );
}

export default function NpcCombatSection({ npcCombat, initiative, dmPassword, onUpdate }) {
  const pal = useContext(PalCtx);
  const npcPal = getNpcCardPalette(pal);
  const allNpcsRef = useRef(npcCombat.npcs || []);
  useEffect(() => { allNpcsRef.current = npcCombat.npcs || []; }, [npcCombat.npcs]);

  const [modalTarget, setModalTarget] = useState(null);
  const [condTarget, setCondTarget] = useState(null);
  const [addName, setAddName] = useState("");
  const [addHp, setAddHp] = useState("");
  const [addCount, setAddCount] = useState(1);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const npcs = npcCombat.npcs || [];
  const sorted = [...(initiative.entries || [])].sort((a, b) => b.initiative - a.initiative);
  const activeEntry = sorted[initiative.activeTurnIndex ?? 0];
  const activeTurnNpcId = activeEntry?.npcId ?? null;
  const activeTurnEntryId = activeEntry?.id ?? null;
  const activeTurnNpcName = !activeEntry?.isPC ? (activeEntry?.name || "").trim().toLowerCase() : "";

  async function handleAddNpcs() {
    if (!addName.trim() || !addHp) return;
    const hpMax = parseInt(addHp, 10);
    if (isNaN(hpMax) || hpMax <= 0) return;
    const count = Math.max(1, Math.min(8, parseInt(addCount, 10) || 1));
    const newNpcs = Array.from({ length: count }, (_, index) => ({
      id: "npc-" + Date.now() + index + Math.random().toString(36).slice(2, 5),
      name: count > 1 ? `${addName.trim()} ${String.fromCharCode(65 + index)}` : addName.trim(),
      hpMax,
      hpCurrent: hpMax,
      conditions: [],
      initiativeEntryId: null,
    }));
    const updated = [...npcs, ...newNpcs];
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      setAddName("");
      setAddHp("");
      setAddCount(1);
      onUpdate();
    } catch {}
  }

  async function handleRemoveNpc(npcId) {
    const updated = npcs.filter((entry) => entry.id !== npcId);
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      onUpdate();
    } catch {}
  }

  async function handleEndCombat() {
    try {
      await putNpcCombat(dmPassword, { npcs: [] });
      setShowEndConfirm(false);
      onUpdate();
    } catch {}
  }

  function handleModalOptimistic(npcId, newHp) {
    allNpcsRef.current = (allNpcsRef.current || []).map((entry) => entry.id === npcId ? { ...entry, hpCurrent: newHp } : entry);
  }

  async function handleModalConfirm(npcId, newHp) {
    const updated = (allNpcsRef.current || []).map((entry) => entry.id === npcId ? { ...entry, hpCurrent: newHp } : entry);
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      onUpdate();
    } catch {}
  }

  async function handleAddCondition(npcId, cond) {
    if (!cond) return;
    const updated = (allNpcsRef.current || []).map((entry) => entry.id === npcId && !entry.conditions.includes(cond) ? { ...entry, conditions: [...entry.conditions, cond] } : entry);
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      setCondTarget(null);
      onUpdate();
    } catch {}
  }

  return (
    <div className="dm-npc-col" style={{ borderLeft: `1px solid ${pal.border}`, paddingLeft: 20, paddingRight: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted }}>
          Enemies{npcs.length > 0 ? ` · ${npcs.length}` : ""}
        </span>
        {npcs.length > 0 && (
          <button
            onClick={() => setShowEndConfirm(true)}
            style={{ background: "transparent", border: "1px solid rgba(160,80,60,0.45)", borderRadius: 3, color: "#c08070", fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(160,80,60,0.15)"; e.currentTarget.style.borderColor = "rgba(192,96,80,0.7)"; e.currentTarget.style.color = "#e0a090"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(160,80,60,0.45)"; e.currentTarget.style.color = "#c08070"; }}
          >End Combat ×</button>
        )}
      </div>

      {npcs.length === 0 ? (
        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", color: pal.textMuted, padding: "12px 0 16px", textAlign: "center" }}>
          No enemies tracked yet.<br />Add below or tap an NPC in initiative.
        </div>
      ) : (
        npcs.map((npc) => (
          <NpcCard
            key={npc.id}
            npc={npc}
            allNpcsRef={allNpcsRef}
            isActiveTurn={activeTurnNpcId === npc.id || (activeTurnEntryId !== null && npc.initiativeEntryId === activeTurnEntryId) || (!!activeTurnNpcName && (npc.name || "").trim().toLowerCase() === activeTurnNpcName)}
            dmPassword={dmPassword}
            onUpdate={onUpdate}
            onOpenModal={(mode) => setModalTarget({ npc, mode })}
            onOpenConditions={() => setCondTarget(npc)}
            onRemove={() => handleRemoveNpc(npc.id)}
          />
        ))
      )}

      <div style={{ background: npcPal.surface, border: `1px dashed ${npcPal.actionBorder}`, borderRadius: 5, padding: 14, marginTop: 4 }}>
        <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 10 }}>Add Enemy</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input type="text" placeholder="Name…" value={addName} onChange={(e) => setAddName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNpcs()} style={{ flex: 1, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "7px 10px", outline: "none" }} />
          <input type="number" placeholder="HP" value={addHp} onChange={(e) => setAddHp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNpcs()} style={{ width: 64, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15, padding: "7px 8px", outline: "none", textAlign: "center" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted }}>Count:</span>
          <input type="number" min="1" max="8" value={addCount} onChange={(e) => setAddCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))} style={{ width: 44, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 14, padding: "4px 6px", outline: "none", textAlign: "center" }} />
          {addCount > 1 && addName.trim() && (
            <span style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, fontStyle: "italic" }}>
              → {addName.trim()} A–{String.fromCharCode(64 + (parseInt(addCount, 10) || 1))}
            </span>
          )}
        </div>
        <button onClick={handleAddNpcs} style={{ width: "100%", background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, borderRadius: 3, color: npcPal.bright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", padding: "8px 0", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = withAlpha(npcPal.accent, 0.22); }} onMouseLeave={(e) => { e.currentTarget.style.background = npcPal.chipBg; }}>+ Add Enemy</button>
      </div>

      {modalTarget && (
        <NpcDamageHealModal
          npc={modalTarget.npc}
          mode={modalTarget.mode}
          onClose={() => setModalTarget(null)}
          onOptimisticUpdate={(newHp) => handleModalOptimistic(modalTarget.npc.id, newHp)}
          onConfirm={(newHp) => handleModalConfirm(modalTarget.npc.id, newHp)}
        />
      )}

      {condTarget && (
        <NpcConditionPicker npc={condTarget} onAdd={(cond) => handleAddCondition(condTarget.id, cond)} onClose={() => setCondTarget(null)} />
      )}

      {showEndConfirm && (
        <ConfirmDialog
          title="End Combat"
          message="Remove all NPC tracking? Initiative and party state are not affected."
          onConfirm={handleEndCombat}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  );
}
