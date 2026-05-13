import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { putNpcCombat } from "../../api";
import { PALETTES } from "../characterSheet/theme";
import { useDebouncedOptimisticNumberFlush } from "../../lib/liveSync";
import ConfirmDialog from "./ConfirmDialog";
import {
  ALL_CONDITIONS,
  PalCtx,
  VELLUM_CARD_MODE,
  getPartyCardActiveSurface,
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
      surfaceSolid: "rgba(24,21,16,0.76)",
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
    surfaceSolid: withAlpha(mixHex(paperTintStrong, "#6b5c49", 0.18), 0.82),
    border: withAlpha(borderTone, 0.56),
    accent,
    bright: mixHex(NPC_BRIGHT, VELLUM_CARD_MODE.ink, 0.22),
    track: withAlpha(mixHex(paperTintStrong, "#6b5c49", 0.18), 0.7),
    chipBg: withAlpha(mixHex(paperTintStrong, accent, 0.18), 0.78),
    actionBorder: withAlpha(borderTone, 0.48),
  };
}

function getNpcInitiativeEntryId(npc) {
  return npc?.initiativeEntryId ?? npc?.initiativeId ?? null;
}

function npcHpStatus(hpCurrent, hpMax) {
  if (hpCurrent <= 0) return "dead";
  if (hpCurrent < hpMax / 2) return "bloodied";
  return "alive";
}

function getNpcHpTone(npcPal, hpPct) {
  if (hpPct < 0.25) {
    return {
      fill: "#c06060",
    };
  }

  if (hpPct < 0.5) {
    return {
      fill: "#c8a040",
    };
  }

  return {
    fill: npcPal.accent,
  };
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

function NpcNotesStrip({ npc, allNpcsRef, dmPassword, onUpdate, pal, npcPal }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  const notes = npc.notes || [];
  const hasNotes = notes.length > 0;

  async function handleAdd() {
    const text = inputVal.trim();
    if (!text) return;
    const localId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const newNote = { id: localId, text };
    const updatedNpcs = (allNpcsRef.current || []).map((entry) =>
      entry.id === npc.id ? { ...entry, notes: [...(entry.notes || []), newNote] } : entry
    );
    // Optimistic update via ref
    allNpcsRef.current = updatedNpcs;
    setInputVal("");
    inputRef.current?.focus();
    try {
      await putNpcCombat(dmPassword, { npcs: updatedNpcs });
      onUpdate();
    } catch {
      // Revert
      const reverted = (allNpcsRef.current || []).map((entry) =>
        entry.id === npc.id ? { ...entry, notes: (entry.notes || []).filter((n) => n.id !== localId) } : entry
      );
      allNpcsRef.current = reverted;
      onUpdate();
    }
  }

  async function handleDelete(id) {
    const removed = (npc.notes || []).find((n) => n.id === id);
    const updatedNpcs = (allNpcsRef.current || []).map((entry) =>
      entry.id === npc.id ? { ...entry, notes: (entry.notes || []).filter((n) => n.id !== id) } : entry
    );
    allNpcsRef.current = updatedNpcs;
    try {
      await putNpcCombat(dmPassword, { npcs: updatedNpcs });
      onUpdate();
    } catch {
      if (removed) {
        const reverted = (allNpcsRef.current || []).map((entry) =>
          entry.id === npc.id ? { ...entry, notes: [...(entry.notes || []), removed] } : entry
        );
        allNpcsRef.current = reverted;
        onUpdate();
      }
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

  const iconColor = hasNotes || open ? npcPal.accent : pal.textMuted;
  const labelColor = hasNotes || open ? npcPal.bright : pal.textMuted;
  const label = hasNotes ? "Notes" : "+ Note";

  return (
    <div
      style={{ borderTop: `1px solid ${npcPal.actionBorder}`, borderRadius: "0 0 5px 5px", cursor: "pointer", userSelect: "none" }}
      onClick={handleToggle}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", background: stripBarBg, borderRadius: open ? 0 : "0 0 5px 5px", borderBottom: open ? `1px solid ${npcPal.actionBorder}` : "none", transition: "background 0.15s" }}>
        <svg width="11" height="12" viewBox="0 0 12 13" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="8" height="10" rx="1" stroke={iconColor} strokeWidth="1.1" />
          <line x1="3" y1="4" x2="7" y2="4" stroke={iconColor} strokeWidth="1" />
          <line x1="3" y1="6.5" x2="7" y2="6.5" stroke={iconColor} strokeWidth="1" />
          <line x1="3" y1="9" x2="5.5" y2="9" stroke={iconColor} strokeWidth="1" />
          {hasNotes && <path d="M9 8.5 L11 6.5 L10.5 6 L8.5 8 Z" fill={iconColor} />}
        </svg>
        <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: labelColor, flex: 1 }}>{label}</span>
        {notes.length > 0 && (
          <span style={{ background: npcPal.accent, color: pal.bg, borderRadius: 10, padding: "1px 6px", fontSize: 10, fontFamily: pal.fontDisplay, minWidth: 16, textAlign: "center", lineHeight: "15px" }}>{notes.length}</span>
        )}
        <span style={{ fontSize: 9, color: pal.textMuted, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s", display: "inline-block" }}>▼</span>
      </div>

      {open && (
        <div style={{ padding: "8px 10px 10px" }} onClick={(e) => e.stopPropagation()}>
          {notes.length > 0 && (
            <ul style={{ listStyle: "none", marginBottom: 6 }}>
              {notes.map((note, idx) => (
                <li key={note.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 0", borderBottom: idx < notes.length - 1 ? `1px solid ${npcPal.actionBorder}` : "none" }}>
                  <span style={{ flex: 1, fontFamily: pal.fontBody, fontSize: 13, color: pal.textBody, lineHeight: 1.5 }}>{note.text}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                    style={{ background: "transparent", border: "none", color: "#c06060", cursor: "pointer", fontSize: 14, padding: "0 2px", opacity: 0.45, lineHeight: 1, flexShrink: 0, marginTop: 1, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.45"; }}
                    title="Delete note"
                  >×</button>
                </li>
              ))}
            </ul>
          )}
          {notes.length === 0 && (
            <div style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 12, color: pal.textMuted, padding: "2px 0 5px" }}>No notes yet.</div>
          )}
          <div style={{ display: "flex", gap: 5, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              maxLength={500}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="Combat note… (Enter)"
              style={{ flex: 1, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 13, padding: "5px 8px", outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = npcPal.accent; }}
              onBlur={(e) => { e.target.style.borderColor = npcPal.actionBorder; }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleAdd(); }}
              style={{ background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, borderRadius: 3, color: npcPal.bright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em", padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = withAlpha(npcPal.accent, 0.22); }}
              onMouseLeave={(e) => { e.currentTarget.style.background = npcPal.chipBg; }}
            >+ Add</button>
          </div>
          <div style={{ fontFamily: pal.fontUI, fontSize: 9, color: pal.textMuted, letterSpacing: "0.12em", marginTop: 5 }}>Session only — discarded when combat ends</div>
        </div>
      )}
    </div>
  );
}

function NpcCard({
  npc,
  allNpcsRef,
  isActiveTurn,
  isInInitiative,
  dmPassword,
  onUpdate,
  onOpenModal,
  onOpenConditions,
  onRemove,
  onToggleInitiative,
}) {
  const pal = useContext(PalCtx);
  const npcPal = getNpcCardPalette(pal);

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
  const status = npcHpStatus(optimisticHp, hpMax);
  const isDead = status === "dead";
  const isBloodied = status === "bloodied";
  const hpTone = getNpcHpTone(npcPal, hpPct);
  const leftStripe = isDead ? "#8c3030" : npcPal.accent;
  const cardBorder = isDead ? "rgba(192,60,60,0.4)" : npcPal.border;
  const activeSurface = isActiveTurn && !isDead
    ? getPartyCardActiveSurface(pal, pal, {
        ...npcPal,
        accent: npcPal.accent,
        accentBright: npcPal.bright,
      })
    : npcPal.surface;
  const activeTurnStyle = isActiveTurn && !isDead
    ? {
        "--turn-color": isBloodied ? "#c07030" : npcPal.accent,
        "--turn-glow": isBloodied ? "#c0703066" : `${npcPal.accent}66`,
      }
    : undefined;

  const conditions = Array.isArray(npc.conditions) ? npc.conditions : [];

  return (
    <div
      data-active-turn={isActiveTurn && !isDead ? "true" : undefined}
      className={isActiveTurn && !isDead ? "dm-active-turn" : undefined}
      style={{
        background: activeSurface,
        border: `1px solid ${cardBorder}`,
        borderRadius: 5,
        marginBottom: 10,
        position: "relative",
        opacity: isDead ? 0.75 : 1,
        overflow: "visible",
        zIndex: isActiveTurn && !isDead ? 2 : 1,
        transform: isActiveTurn && !isDead ? "scaleX(1.02)" : "scaleX(1)",
        transformOrigin: "center center",
        transition: "transform 0.18s ease",
        ...activeTurnStyle,
      }}
    >
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {onToggleInitiative && (
              <button
                onClick={onToggleInitiative}
                style={{
                  background: isInInitiative ? withAlpha(npcPal.accent, 0.12) : "transparent",
                  border: `1px solid ${isInInitiative ? npcPal.accent : npcPal.actionBorder}`,
                  color: isInInitiative ? npcPal.bright : pal.textMuted,
                  borderRadius: 10,
                  fontFamily: pal.fontUI,
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                title={isInInitiative ? "Remove from initiative" : "Add to initiative"}
              >{isInInitiative ? "− Init" : "+ Init"}</button>
            )}
            <button onClick={onRemove} style={{ background: "transparent", border: "none", color: pal.textMuted, fontSize: 14, cursor: "pointer", padding: "2px 4px", borderRadius: 3, lineHeight: 1, flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.color = "#c06060"; e.currentTarget.style.background = "rgba(192,96,96,0.1)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = ""; }}>×</button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 6, position: "relative" }}>
          <button onPointerDown={minusBind.start} onPointerUp={minusBind.stop} onPointerLeave={minusBind.stop} style={{ width: 26, height: 22, borderRadius: 3, border: `1px solid ${npcPal.actionBorder}`, background: "transparent", color: pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", touchAction: "none" }}>−</button>
          <div style={{ display: "flex", alignItems: "baseline", gap: 0, whiteSpace: "nowrap", padding: "0 8px 0 9px", flexShrink: 0 }}>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, lineHeight: 1, color: isDead ? "#c06060" : npcPal.bright }}>{optimisticHp}</span>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>/</span>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>{hpMax}</span>
          </div>
          <div style={{ flex: 1, paddingRight: 5 }}>
            <div style={{ height: 10, borderRadius: 2, overflow: "hidden", background: "rgba(7,14,22,0.88)", display: "flex", gap: 1 }}>
              {Array.from({ length: 5 }).map((_, idx) => {
                const segStart = idx / 5;
                const segFill = Math.max(0, Math.min(1, (hpPct - segStart) * 5));
                return (
                  <div key={idx} style={{ flex: 1, position: "relative", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${segFill * 100}%`, background: hpTone.fill, transition: "width 0.3s ease" }} />
                  </div>
                );
              })}
            </div>
          </div>
          <button onPointerDown={plusBind.start} onPointerUp={plusBind.stop} onPointerLeave={plusBind.stop} style={{ width: 26, height: 22, borderRadius: 3, border: `1px solid ${npcPal.actionBorder}`, background: "transparent", color: pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", touchAction: "none" }}>+</button>
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
        {isDead ? (
          <button
            onClick={() => onOpenModal("heal")}
            style={{ flex: 1, background: "rgba(80,160,80,0.08)", border: "1px solid rgba(80,160,80,0.35)", borderRadius: 3, color: "#88c888", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#5a9a5a"; e.currentTarget.style.color = "#a0d8a0"; e.currentTarget.style.background = "rgba(80,160,80,0.14)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(80,160,80,0.35)"; e.currentTarget.style.color = "#88c888"; e.currentTarget.style.background = "rgba(80,160,80,0.08)"; }}
          >
            Revive
          </button>
        ) : (
          <>
            <button onClick={() => onOpenModal("damage")} style={{ flex: 1, background: "rgba(192,96,96,0.08)", border: "1px solid rgba(192,96,96,0.35)", borderRadius: 3, color: "#d08080", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c06060"; e.currentTarget.style.color = "#e09898"; e.currentTarget.style.background = "rgba(192,96,96,0.14)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(192,96,96,0.35)"; e.currentTarget.style.color = "#d08080"; e.currentTarget.style.background = "rgba(192,96,96,0.08)"; }}>⚔ Dmg</button>
            <button onClick={() => onOpenModal("heal")} style={{ flex: 1, background: "rgba(80,160,80,0.08)", border: "1px solid rgba(80,160,80,0.35)", borderRadius: 3, color: "#88c888", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#5a9a5a"; e.currentTarget.style.color = "#a0d8a0"; e.currentTarget.style.background = "rgba(80,160,80,0.14)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(80,160,80,0.35)"; e.currentTarget.style.color = "#88c888"; e.currentTarget.style.background = "rgba(80,160,80,0.08)"; }}>✦ Heal</button>
            <button onClick={onOpenConditions} style={{ flex: 1, background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, borderRadius: 3, color: npcPal.bright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = npcPal.bright; e.currentTarget.style.color = npcPal.bright; e.currentTarget.style.background = withAlpha(npcPal.accent, 0.22); }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = npcPal.accent; e.currentTarget.style.color = npcPal.bright; e.currentTarget.style.background = npcPal.chipBg; }}>+ Cond</button>
          </>
        )}
      </div>
      <NpcNotesStrip npc={npc} allNpcsRef={allNpcsRef} dmPassword={dmPassword} onUpdate={onUpdate} pal={pal} npcPal={npcPal} />
    </div>
  );
}

function getNpcInitiativeLink(npc, entries) {
  const initiativeEntryId = getNpcInitiativeEntryId(npc);
  const matchIndex = entries.findIndex((entry) =>
    entry.npcId === npc.id ||
    (initiativeEntryId && entry.id === initiativeEntryId) ||
    (!entry.isPC && !entry.npcId && (entry.name || "").trim().toLowerCase() === (npc.name || "").trim().toLowerCase())
  );
  return matchIndex >= 0 ? { entry: entries[matchIndex], index: matchIndex } : { entry: null, index: -1 };
}

export default function NpcCombatSection({
  npcCombat,
  initiative,
  dmPassword,
  onUpdate,
  onCommitNpcCombat,
  onAddNpcToInitiative,
  onRemoveNpcFromInitiative,
}) {
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
  const entries = initiative.entries || [];
  const activeEntry = entries[initiative.activeTurnIndex ?? 0];
  const activeTurnNpcId = activeEntry?.npcId ?? null;
  const activeTurnEntryId = activeEntry?.id ?? null;
  const activeTurnNpcName = !activeEntry?.isPC ? (activeEntry?.name || "").trim().toLowerCase() : "";
  const npcWithLinks = npcs.map((npc) => {
    const link = getNpcInitiativeLink(npc, entries);
    return {
      npc,
      initiativeEntry: link.entry,
      initiativeIndex: link.index,
      isInInitiative: link.index >= 0,
    };
  });
  const activeNpcs = npcWithLinks.filter((value) => value.isInInitiative).sort((a, b) => a.initiativeIndex - b.initiativeIndex);
  const inactiveNpcs = npcWithLinks.filter((value) => !value.isInInitiative);

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
    allNpcsRef.current = updated;
    setAddName("");
    setAddHp("");
    setAddCount(1);
    if (onCommitNpcCombat) {
      await onCommitNpcCombat({ npcs: updated }, { optimistic: true });
    } else {
      try {
        await putNpcCombat(dmPassword, { npcs: updated });
        onUpdate();
      } catch {}
    }
  }

  async function handleRemoveNpc(npcId) {
    const updated = npcs.filter((entry) => entry.id !== npcId);
    allNpcsRef.current = updated;
    if (onCommitNpcCombat) {
      await onCommitNpcCombat({ npcs: updated }, { optimistic: true });
    } else {
      try {
        await putNpcCombat(dmPassword, { npcs: updated });
        onUpdate();
      } catch {}
    }
  }

  async function handleEndCombat() {
    allNpcsRef.current = [];
    if (onCommitNpcCombat) {
      await onCommitNpcCombat({ npcs: [] }, { optimistic: true });
      setShowEndConfirm(false);
    } else {
      try {
        await putNpcCombat(dmPassword, { npcs: [] });
        setShowEndConfirm(false);
        onUpdate();
      } catch {}
    }
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
          No enemies tracked yet.<br />Add below to start tracking them.
        </div>
      ) : (
        <>
          {activeNpcs.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>
                In Initiative · {activeNpcs.length}
              </div>
              {activeNpcs.map(({ npc, isInInitiative }) => (
                <NpcCard
                  key={npc.id}
                  npc={npc}
                  allNpcsRef={allNpcsRef}
                  isInInitiative={isInInitiative}
                  isActiveTurn={activeTurnNpcId === npc.id || (activeTurnEntryId !== null && getNpcInitiativeEntryId(npc) === activeTurnEntryId) || (!!activeTurnNpcName && (npc.name || "").trim().toLowerCase() === activeTurnNpcName)}
                  dmPassword={dmPassword}
                  onUpdate={onUpdate}
                  onOpenModal={(mode) => setModalTarget({ npc, mode })}
                  onOpenConditions={() => setCondTarget(npc)}
                  onToggleInitiative={() => onRemoveNpcFromInitiative?.(npc.id)}
                  onRemove={() => handleRemoveNpc(npc.id)}
                />
              ))}
            </div>
          )}

          {inactiveNpcs.length > 0 && (
            <div style={{ marginTop: 22, marginBottom: 10 }}>
              <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>
                Inactive · {inactiveNpcs.length}
              </div>
              {inactiveNpcs.map(({ npc, isInInitiative }) => (
                <NpcCard
                  key={npc.id}
                  npc={npc}
                  allNpcsRef={allNpcsRef}
                  isInInitiative={isInInitiative}
                  isActiveTurn={false}
                  dmPassword={dmPassword}
                  onUpdate={onUpdate}
                  onOpenModal={(mode) => setModalTarget({ npc, mode })}
                  onOpenConditions={() => setCondTarget(npc)}
                  onToggleInitiative={() => onAddNpcToInitiative?.(npc.id)}
                  onRemove={() => handleRemoveNpc(npc.id)}
                />
              ))}
            </div>
          )}
        </>
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
        <div style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, marginTop: 8, letterSpacing: "0.08em" }}>
          Use <span style={{ color: npcPal.bright }}>+ Init</span> on a card to add it to the turn order.
        </div>
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
