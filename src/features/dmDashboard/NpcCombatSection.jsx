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
import "./npcCombat.css";

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

function NpcDamageHealModal({ npc, mode, onClose, onConfirm }) {
  const pal = useContext(PalCtx);
  const [amount, setAmount] = useState(0);
  const isHeal = mode === "heal";
  const accentColor = isHeal ? "#5a9a5a" : "#c06060";
  const accentBright = isHeal ? "#88c888" : "#d08080";
  const minusBind = useHoldToRepeat(() => setAmount((value) => Math.max(0, value - 1)));
  const plusBind = useHoldToRepeat(() => setAmount((value) => value + 1));

  function confirm() {
    const newHp = isHeal ? Math.min(npc.hpMax, npc.hpCurrent + amount) : npc.hpCurrent - amount;
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
    <div className="modal-overlay" style={{ zIndex: 300 }} onClick={onClose}>
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${accentColor}`, borderRadius: 8, padding: "24px 28px", maxWidth: 340, width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 4 }}>
          {isHeal ? "✦ Heal" : "⚔ Deal Damage"} — {npc.name}
        </div>
        <div className="flex-row" style={{ justifyContent: "center", gap: 16, margin: "20px 0" }}>
          <button onPointerDown={minusBind.start} onPointerUp={minusBind.stop} onPointerLeave={minusBind.stop} style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${accentColor}`, background: "transparent", color: accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer" }}>−</button>
          <input type="number" value={amount} min="0" onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: 90, background: "transparent", border: "none", borderBottom: `2px solid ${accentColor}`, color: accentBright, fontFamily: pal.fontDisplay, fontSize: 42, textAlign: "center", outline: "none" }} />
          <button onPointerDown={plusBind.start} onPointerUp={plusBind.stop} onPointerLeave={plusBind.stop} style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${accentColor}`, background: "transparent", color: accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer" }}>+</button>
        </div>
        <div className="flex-row" style={{ flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 20 }}>
          {[3, 5, 8, 10, 15, 20].map((preset) => (
            <button key={preset} onClick={() => setAmount(preset)} style={{ padding: "5px 12px", borderRadius: 4, border: `1px solid ${amount === preset ? accentColor : "rgba(100,130,160,0.32)"}`, background: amount === preset ? `rgba(${isHeal ? "80,160,80" : "192,96,96"},0.15)` : "transparent", color: amount === preset ? accentBright : pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, cursor: "pointer" }}>{preset}</button>
          ))}
        </div>
        <div className="flex-row" style={{ gap: 10 }}>
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
    <div className="modal-overlay" style={{ zIndex: 300 }} onClick={onClose}>
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${pal.accent}`, borderRadius: 8, padding: "20px 24px", maxWidth: 360, width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.accentBright, marginBottom: 14 }}>Add Condition — {npc.name}</div>
        <div className="flex-row" style={{ flexWrap: "wrap", gap: 6 }}>
          {ALL_CONDITIONS.map((condition) => (
            <button
              key={condition}
              disabled={existing.has(condition)}
              onClick={() => onAdd(condition)}
              style={{ padding: "5px 12px", borderRadius: 10, border: `1px solid ${existing.has(condition) ? pal.border : pal.accent}`, background: existing.has(condition) ? "transparent" : "rgba(106,143,168,0.1)", color: existing.has(condition) ? pal.textMuted : pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", cursor: existing.has(condition) ? "not-allowed" : "pointer" }}
            >{condition}</button>
          ))}
        </div>
        <button className="btn-ghost" onClick={onClose} style={{ marginTop: 16, width: "100%", borderRadius: 4, padding: "8px 0" }}>Close</button>
      </div>
    </div>
  );
}

function NpcNotesStrip({ npc, allNpcsRef, onCommitNpcs, pal, npcPal }) {
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
    setInputVal("");
    inputRef.current?.focus();
    const success = await onCommitNpcs(updatedNpcs);
    if (success === false) {
      setInputVal(text);
    }
  }

  async function handleDelete(id) {
    const updatedNpcs = (allNpcsRef.current || []).map((entry) =>
      entry.id === npc.id ? { ...entry, notes: (entry.notes || []).filter((n) => n.id !== id) } : entry
    );
    await onCommitNpcs(updatedNpcs);
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
                <li key={note.id} className="flex-row" style={{ alignItems: "flex-start", gap: 7, padding: "5px 0", borderBottom: idx < notes.length - 1 ? `1px solid ${npcPal.actionBorder}` : "none" }}>
                  <span style={{ flex: 1, fontFamily: pal.fontBody, fontSize: 13, color: pal.textBody, lineHeight: 1.5 }}>{note.text}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                    className="btn-note-delete"
                    title="Delete note"
                  >×</button>
                </li>
              ))}
            </ul>
          )}
          {notes.length === 0 && (
            <div style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 12, color: pal.textMuted, padding: "2px 0 5px" }}>No notes yet.</div>
          )}
          <div className="flex-row" style={{ gap: 5, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
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
              className="btn-note-add"
              style={{ background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, color: npcPal.bright }}
            >+ Add</button>
          </div>
          <div style={{ fontFamily: pal.fontUI, fontSize: 9, color: pal.textMuted, letterSpacing: "0.12em", marginTop: 5 }}>Session only — discarded when combat ends</div>
        </div>
      )}
    </div>
  );
}

const ABILITY_MAX_LENGTH = 255;
const ABILITY_COUNTER_THRESHOLD = 30;
const ABILITY_COLLAPSED_LIMIT = 3;

function NpcAbilityRef({ abilities: abilitiesProp, isActiveTurn, npcPal, onSave }) {
  // Backward-compat coercion: string (legacy) → string[], absent → []
  const abilities = Array.isArray(abilitiesProp)
    ? abilitiesProp
    : typeof abilitiesProp === "string" && abilitiesProp.trim()
    ? [abilitiesProp]
    : [];

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [addInput, setAddInput] = useState("");
  const addInputRef = useRef(null);

  // Auto-expand on active turn; guard against editing state
  useEffect(() => {
    if (editing) return;
    if (isActiveTurn && abilities.length > 0) setExpanded(true);
    else setExpanded(false);
  }, [isActiveTurn, abilities.length, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  function enterEdit() {
    setDraft([...abilities]);
    setAddInput("");
    setEditing(true);
    // Focus the add input after paint
    setTimeout(() => addInputRef.current?.focus(), 60);
  }

  function exitEdit() {
    setEditing(false);
    setAddInput("");
  }

  async function commitEdit() {
    // Trim entries, drop whitespace-only
    const cleaned = draft.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    const success = await onSave(cleaned);
    if (success !== false) {
      exitEdit();
    }
  }

  function handleAddEntry() {
    const text = addInput.trim();
    if (!text) return;
    setDraft((current) => [...current, text]);
    setAddInput("");
    setTimeout(() => addInputRef.current?.focus(), 0);
  }

  function handleRemoveEntry(index) {
    setDraft((current) => current.filter((_, idx) => idx !== index));
  }

  function handleAddKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEntry();
    }
    if (e.key === "Escape") {
      exitEdit();
    }
  }

  function handleEditKeyDown(e) {
    if (e.key === "Escape") {
      exitEdit();
    }
  }

  const addInputLen = addInput.length;
  const showCounter = addInputLen >= ABILITY_MAX_LENGTH - ABILITY_COUNTER_THRESHOLD;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (abilities.length === 0 && !editing) {
    return (
      <div className="npc-ability-ref">
        <button
          className="npc-ability-ref-toggle"
          onClick={enterEdit}
          title="Add ability reference"
        >
          + Ability reference
        </button>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="npc-ability-ref" onKeyDown={handleEditKeyDown}>
        {draft.map((entry, idx) => (
          <div key={idx} className="npc-ability-ref-row">
            <button
              className="npc-ability-ref-remove"
              onClick={() => handleRemoveEntry(idx)}
              title="Remove"
            >−</button>
            <span className="npc-ability-ref-row-text">{entry}</span>
          </div>
        ))}

        <div className="npc-ability-add-row">
          <input
            ref={addInputRef}
            className="npc-ability-add-input"
            type="text"
            placeholder="+ Add ability or spell…"
            maxLength={ABILITY_MAX_LENGTH}
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={handleAddKeyDown}
            autoComplete="off"
          />
          <button
            className="npc-ability-add-btn"
            onClick={handleAddEntry}
            disabled={!addInput.trim()}
            title="Add entry"
          >+</button>
        </div>

        <div className={`npc-ability-char-counter${showCounter ? " visible" : ""}`}>
          {ABILITY_MAX_LENGTH - addInputLen} characters remaining
        </div>

        <div className="npc-ability-ref-actions">
          <button className="npc-ability-cancel-btn" onClick={exitEdit}>Cancel</button>
          <button className="npc-ability-done-btn" onClick={commitEdit}>Done</button>
        </div>
      </div>
    );
  }

  // ── Read mode (collapsed or expanded) ────────────────────────────────────
  const visibleEntries = expanded ? abilities : abilities.slice(0, ABILITY_COLLAPSED_LIMIT);
  const hasMore = abilities.length > ABILITY_COLLAPSED_LIMIT;

  return (
    <div className="npc-ability-ref">
      <ul className="npc-ability-ref-list">
        {visibleEntries.map((entry, idx) => (
          <li key={idx} className="npc-ability-ref-item">
            <span className="npc-ability-ref-diamond">◆</span>
            <span className="npc-ability-ref-text">{entry}</span>
          </li>
        ))}
      </ul>

      <div className="npc-ability-ref-footer">
        <div>
          {!expanded && hasMore && (
            <button
              className="npc-ability-show-toggle"
              onClick={() => setExpanded(true)}
            >
              Show all {abilities.length}
            </button>
          )}
          {expanded && (
            <button
              className="npc-ability-show-toggle"
              onClick={() => setExpanded(false)}
            >
              Show less
            </button>
          )}
        </div>
        <button
          className="npc-ability-edit-btn"
          onClick={enterEdit}
          title="Edit abilities"
        >✎</button>
      </div>
    </div>
  );
}

function NpcCard({
  npc,
  allNpcsRef,
  isActiveTurn,
  isInInitiative,
  onCommitNpcs,
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
  const [hpFeedback, setHpFeedback] = useState(null);
  const [ghostTrail, setGhostTrail] = useState(null);
  const [bloodiedFlash, setBloodiedFlash] = useState(false);
  const [removingConds, setRemovingConds] = useState([]);
  const hpFeedbackTimeoutRef = useRef(null);
  const ghostTrailTimeoutRef = useRef(null);
  const bloodiedFlashTimeoutRef = useRef(null);
  const prevAnimatedHpRef = useRef(serverHp);
  const prevStatusRef = useRef(npcHpStatus(serverHp, hpMax));
  const removalTimersRef = useRef(new Map());

  useEffect(() => { optimisticHpRef.current = optimisticHp; }, [optimisticHp]);
  useEffect(() => {
    hpMaxRef.current = hpMax;
    serverHpRef.current = serverHp;
    if (pendingDeltaRef.current === 0 && !flushInFlightRef.current) {
      setOptimisticHp(serverHp);
      optimisticHpRef.current = serverHp;
    }
  }, [serverHp, hpMax]);

  useEffect(() => {
    const previous = prevAnimatedHpRef.current;
    if (typeof previous === "number" && previous !== optimisticHp && hpMax > 0) {
      const nextFeedback = optimisticHp < previous ? "damage" : "heal";
      setHpFeedback(nextFeedback);
      window.clearTimeout(hpFeedbackTimeoutRef.current);
      hpFeedbackTimeoutRef.current = window.setTimeout(() => setHpFeedback(null), nextFeedback === "damage" ? 300 : 250);

      if (optimisticHp < previous) {
        setGhostTrail({
          left: `${Math.max(0, (optimisticHp / hpMax) * 100)}%`,
          width: `${Math.max(0, ((previous - optimisticHp) / hpMax) * 100)}%`,
          key: Date.now(),
        });
        window.clearTimeout(ghostTrailTimeoutRef.current);
        ghostTrailTimeoutRef.current = window.setTimeout(() => setGhostTrail(null), 400);
      }
    }
    prevAnimatedHpRef.current = optimisticHp;
  }, [optimisticHp, hpMax]);

  useEffect(() => () => {
    window.clearTimeout(hpFeedbackTimeoutRef.current);
    window.clearTimeout(ghostTrailTimeoutRef.current);
    window.clearTimeout(bloodiedFlashTimeoutRef.current);
    removalTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    removalTimersRef.current.clear();
  }, []);

  const getTargetHp = useCallback(
    () => Math.min(hpMaxRef.current, Math.max(-999, optimisticHpRef.current)),
    []
  );
  const commitHp = useCallback(async (targetHp) => {
    const updatedNpcs = (allNpcsRef.current || []).map((entry) => entry.id === npc.id ? { ...entry, hpCurrent: targetHp } : entry);
    const success = await onCommitNpcs(updatedNpcs);
    if (success === false) throw new Error("Failed to update NPC HP");
  }, [allNpcsRef, npc.id, onCommitNpcs]);
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
  useEffect(() => {
    const previousStatus = prevStatusRef.current;
    if (status === "bloodied" && previousStatus === "alive") {
      setBloodiedFlash(true);
      window.clearTimeout(bloodiedFlashTimeoutRef.current);
      bloodiedFlashTimeoutRef.current = window.setTimeout(() => setBloodiedFlash(false), 200);
    }
    prevStatusRef.current = status;
  }, [status]);
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
  const visibleConds = [
    ...conditions,
    ...removingConds.filter((condition) => !conditions.includes(condition)),
  ];

  return (
    <div
      data-active-turn={isActiveTurn && !isDead ? "true" : undefined}
      data-active={isActiveTurn && !isDead ? "true" : undefined}
      data-dead={isDead ? "true" : undefined}
      className={`npc-card${isActiveTurn && !isDead ? " dm-active-turn" : ""}`}
      style={{
        background: activeSurface,
        border: `1px solid ${cardBorder}`,
        zIndex: isActiveTurn && !isDead ? 2 : 1,
        ...activeTurnStyle,
      }}
    >
      <div className={bloodiedFlash ? "npc-stripe dm-bloodied-flash" : "npc-stripe"} style={{ background: leftStripe }} />
      <div className="npc-header">
        <div className="npc-name-row">
          <div className="npc-name-group">
            <span className="npc-name" style={{ color: isDead ? pal.textMuted : npcPal.bright, textDecoration: isDead ? "line-through" : "none" }}>{npc.name}</span>
            {isBloodied && !isDead && <span className="badge-bloodied">Bloodied</span>}
            {isDead && <span className="badge-dead">Dead</span>}
          </div>
          <div className="flex-row" style={{ gap: 6, flexShrink: 0 }}>
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
            <button onClick={onRemove} className="btn-npc-remove">×</button>
          </div>
        </div>

        <div className="npc-hp-row">
          <button onPointerDown={minusBind.start} onPointerUp={minusBind.stop} onPointerLeave={minusBind.stop} className="npc-stepper">−</button>
          <div className="npc-hp-numbers">
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, lineHeight: 1, color: isDead ? "#c06060" : npcPal.bright }}>{optimisticHp}</span>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>/</span>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>{hpMax}</span>
          </div>
          <div className="npc-bar-wrap">
            <div className="npc-bar">
              {Array.from({ length: 5 }).map((_, idx) => {
                const segStart = idx / 5;
                const segFill = Math.max(0, Math.min(1, (hpPct - segStart) * 5));
                return (
                  <div key={idx} className="npc-bar-seg">
                    <div className="npc-bar-fill" style={{ width: `${segFill * 100}%`, background: hpTone.fill }} />
                  </div>
                );
              })}
              {ghostTrail && (
                <div
                  key={ghostTrail.key}
                  className="dm-hp-ghost"
                  style={{ left: ghostTrail.left, width: ghostTrail.width }}
                />
              )}
              {hpFeedback && (
                <div
                  className={`dm-hp-feedback ${hpFeedback === "damage" ? "dm-hp-feedback-damage" : "dm-hp-feedback-heal"}`}
                  style={{
                    background: hpFeedback === "damage"
                      ? "linear-gradient(90deg, rgba(192,96,96,0.24) 0%, rgba(192,96,96,0.08) 100%)"
                      : "linear-gradient(90deg, rgba(136,200,136,0.28) 0%, transparent 100%)",
                    boxShadow: hpFeedback === "heal" ? "0 0 12px rgba(136,200,136,0.35) inset" : "none",
                  }}
                />
              )}
            </div>
          </div>
          <button onPointerDown={plusBind.start} onPointerUp={plusBind.stop} onPointerLeave={plusBind.stop} className="npc-stepper">+</button>
          {deltaIndicator && (
            <div key={deltaIndicator.key} className="dm-hp-delta" style={{ color: deltaIndicator.value > 0 ? "#88c888" : "#d08080" }}>{deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : deltaIndicator.value}</div>
          )}
        </div>

        {visibleConds.length > 0 && (
          <div className="npc-conditions">
            {visibleConds.map((condition) => (
              <span
                key={condition}
                onClick={() => {
                  if (removingConds.includes(condition)) return;
                  setRemovingConds((current) => [...current, condition]);
                  const timerId = window.setTimeout(async () => {
                    const updated = conditions.filter((value) => value !== condition);
                    const updatedNpcs = (allNpcsRef.current || []).map((entry) => entry.id === npc.id ? { ...entry, conditions: updated } : entry);
                    const success = await onCommitNpcs(updatedNpcs);
                    if (success === false) {
                      setRemovingConds((current) => current.filter((value) => value !== condition));
                      removalTimersRef.current.delete(condition);
                      return;
                    }
                    const cleanupTimerId = window.setTimeout(() => {
                      setRemovingConds((current) => current.filter((value) => value !== condition));
                      removalTimersRef.current.delete(condition);
                    }, 170);
                    removalTimersRef.current.set(condition, cleanupTimerId);
                  }, 150);
                  removalTimersRef.current.set(condition, timerId);
                }}
                className={`npc-condition-chip ${removingConds.includes(condition) ? "dm-condition-exit" : "dm-condition-enter"}`}
                title="Click to remove"
              >{condition}</span>
            ))}
          </div>
        )}
      </div>

      <NpcAbilityRef
        abilities={npc.abilities}
        isActiveTurn={isActiveTurn}
        npcPal={npcPal}
        onSave={async (nextAbilities) => {
          const updatedNpcs = (allNpcsRef.current || []).map((entry) =>
            entry.id === npc.id ? { ...entry, abilities: nextAbilities } : entry
          );
          return onCommitNpcs(updatedNpcs);
        }}
      />

      <div className="npc-actions" style={{ borderTop: `1px solid ${npcPal.actionBorder}` }}>
        {isDead ? (
          <button onClick={() => onOpenModal("heal")} className="btn-npc-action btn-npc-heal">Revive</button>
        ) : (
          <>
            <button onClick={() => onOpenModal("damage")} className="btn-npc-action btn-npc-dmg">⚔ Dmg</button>
            <button onClick={() => onOpenModal("heal")} className="btn-npc-action btn-npc-heal">✦ Heal</button>
            <button onClick={onOpenConditions} className="btn-npc-action btn-npc-cond" style={{ "--npc-accent": npcPal.accent, "--npc-bright": npcPal.bright, "--npc-chip-bg": npcPal.chipBg }}>+ Cond</button>
          </>
        )}
      </div>
      <NpcNotesStrip npc={npc} allNpcsRef={allNpcsRef} onCommitNpcs={onCommitNpcs} pal={pal} npcPal={npcPal} />
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
  showEndCombatButton = true,
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

  const commitNpcList = useCallback(async (updatedNpcs) => {
    allNpcsRef.current = updatedNpcs;

    if (onCommitNpcCombat) {
      const success = await onCommitNpcCombat({ npcs: updatedNpcs }, { optimistic: true });
      if (success === false) {
        allNpcsRef.current = npcCombat.npcs || [];
        return false;
      }
      return true;
    }

    try {
      await putNpcCombat(dmPassword, { npcs: updatedNpcs });
      onUpdate();
      return true;
    } catch {
      allNpcsRef.current = npcCombat.npcs || [];
      onUpdate();
      return false;
    }
  }, [dmPassword, npcCombat.npcs, onCommitNpcCombat, onUpdate]);

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
    setAddName("");
    setAddHp("");
    setAddCount(1);
    await commitNpcList(updated);
  }

  async function handleRemoveNpc(npcId) {
    const updated = npcs.filter((entry) => entry.id !== npcId);
    await commitNpcList(updated);
  }

  async function handleEndCombat() {
    const success = await commitNpcList([]);
    if (success !== false) {
      setShowEndConfirm(false);
    }
  }

  async function handleModalConfirm(npcId, newHp) {
    const updated = (allNpcsRef.current || []).map((entry) => entry.id === npcId ? { ...entry, hpCurrent: newHp } : entry);
    await commitNpcList(updated);
  }

  async function handleAddCondition(npcId, cond) {
    if (!cond) return;
    const updated = (allNpcsRef.current || []).map((entry) => {
      if (entry.id !== npcId) return entry;
      const conditions = Array.isArray(entry.conditions) ? entry.conditions : [];
      return conditions.includes(cond)
        ? entry
        : { ...entry, conditions: [...conditions, cond] };
    });
    const success = await commitNpcList(updated);
    if (success !== false) {
      setCondTarget(null);
    }
  }

  return (
    <div
      className="dm-npc-col"
      style={{
        borderLeft: `1px solid ${pal.border}`,
        paddingLeft: 20,
        paddingRight: 10,
        "--pal-bg":           pal.bg,
        "--pal-surface":      pal.surface,
        "--pal-surface-solid":pal.surfaceSolid,
        "--pal-border":       pal.border,
        "--pal-accent":       pal.accent,
        "--pal-accent-bright":pal.accentBright,
        "--pal-accent-dim":   pal.accentDim,
        "--pal-text":         pal.text,
        "--pal-text-body":    pal.textBody,
        "--pal-text-muted":   pal.textMuted,
        "--pal-glow-1":       pal.glow1,
        "--pal-glow-2":       pal.glow2,
        "--npc-accent":       npcPal.accent,
        "--npc-bright":       npcPal.bright,
        "--npc-chip-bg":      npcPal.chipBg,
        "--npc-action-border":npcPal.actionBorder,
        "--npc-track":        npcPal.track,
      }}
    >
      <div className="flex-row-spread" style={{ marginBottom: 14 }}>
        <span className="label-ui" style={{ letterSpacing: "0.3em" }}>
          Enemies{npcs.length > 0 ? ` · ${npcs.length}` : ""}
        </span>
        {showEndCombatButton && npcs.length > 0 && (
          <button onClick={() => setShowEndConfirm(true)} className="btn-end-combat">End Combat ×</button>
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
              <div className="label-ui" style={{ letterSpacing: "0.22em", marginBottom: 8 }}>
                In Initiative · {activeNpcs.length}
              </div>
              {activeNpcs.map(({ npc, isInInitiative }) => (
                <NpcCard
                  key={npc.id}
                  npc={npc}
                  allNpcsRef={allNpcsRef}
                  isInInitiative={isInInitiative}
                  isActiveTurn={activeTurnNpcId === npc.id || (activeTurnEntryId !== null && getNpcInitiativeEntryId(npc) === activeTurnEntryId) || (!!activeTurnNpcName && (npc.name || "").trim().toLowerCase() === activeTurnNpcName)}
                  onCommitNpcs={commitNpcList}
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
              <div className="label-ui" style={{ letterSpacing: "0.22em", marginBottom: 8 }}>
                Inactive · {inactiveNpcs.length}
              </div>
              {inactiveNpcs.map(({ npc, isInInitiative }) => (
                <NpcCard
                  key={npc.id}
                  npc={npc}
                  allNpcsRef={allNpcsRef}
                  isInInitiative={isInInitiative}
                  isActiveTurn={false}
                  onCommitNpcs={commitNpcList}
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

      <div className="npc-add-form" style={{ background: npcPal.surface, border: `1px dashed ${npcPal.actionBorder}` }}>
        <div className="label-ui" style={{ letterSpacing: "0.28em", marginBottom: 10 }}>Add Enemy</div>
        <div className="npc-add-form-row">
          <input type="text" placeholder="Name…" value={addName} onChange={(e) => setAddName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNpcs()} style={{ flex: 1, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "7px 10px", outline: "none" }} />
          <input type="number" placeholder="HP" value={addHp} onChange={(e) => setAddHp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNpcs()} style={{ width: 64, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15, padding: "7px 8px", outline: "none", textAlign: "center" }} />
        </div>
        <div className="npc-add-count-row">
          <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted }}>Count:</span>
          <input type="number" min="1" max="8" value={addCount} onChange={(e) => setAddCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))} style={{ width: 44, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 14, padding: "4px 6px", outline: "none", textAlign: "center" }} />
          {addCount > 1 && addName.trim() && (
            <span style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, fontStyle: "italic" }}>
              → {addName.trim()} A–{String.fromCharCode(64 + (parseInt(addCount, 10) || 1))}
            </span>
          )}
        </div>
        <button onClick={handleAddNpcs} className="btn-npc-add-enemy">+ Add Enemy</button>
        <div style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, marginTop: 8, letterSpacing: "0.08em" }}>
          Use <span style={{ color: npcPal.bright }}>+ Init</span> on a card to add it to the turn order.
        </div>
      </div>

      {modalTarget && (
        <NpcDamageHealModal
          npc={modalTarget.npc}
          mode={modalTarget.mode}
          onClose={() => setModalTarget(null)}
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
