import { useState, useRef, useCallback, useEffect } from "react";
import { useHoldToRepeat } from "../../lib/useHoldToRepeat";
import { Link } from "react-router-dom";
import DiceRoller from "../../components/DiceRoller";
import { InfoBadge } from "./CharacterTalents";
import ItemEditorModal, { itemTypeLabel } from "./ItemEditorModal";
import { HR } from "./CharacterSheetPrimitives";
import { ARMOR_OPTIONS, CONDITIONS, SPELL_LEVEL_LABELS, HIT_DIE_BY_CLASS, XP_THRESHOLDS, COIN_COLORS, fmtMod, modOf, parseModInt } from "./constants";
import { renderInline } from "./theme";
import MapViewer from "../maps/MapViewer";

const CONDITION_SEVERITY_COLORS = {
  Blinded: "#c06060",
  Paralyzed: "#c06060",
  Petrified: "#c06060",
  Poisoned: "#c06060",
  Stunned: "#c06060",
  Unconscious: "#c06060",
  Grappled: "#c09040",
  Prone: "#c09040",
  Restrained: "#c09040",
  Deafened: "#6090c0",
  Invisible: "#6090c0",
  Charmed: "#9060b8",
  Frightened: "#9060b8",
  Incapacitated: "#9060b8",
};

function conditionColorFor(name) {
  return CONDITION_SEVERITY_COLORS[name] || "#c09040";
}

function formatXpThreshold(value) {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return `${value}`;
}

function gpEquivalent(coin) {
  const cp = coin?.cp || 0;
  const sp = coin?.sp || 0;
  const ep = coin?.ep || 0;
  const gp = coin?.gp || 0;
  const pp = coin?.pp || 0;
  const total = Math.round((cp * 0.01 + sp * 0.1 + ep * 0.5 + gp + pp * 10) * 100) / 100;
  return Number.isInteger(total) ? `${total}` : total.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function HitDiceTracker({ char, slug, applySessionPatch, setChar, pal }) {
  const [showModal, setShowModal] = useState(false);
  const [modalCount, setModalCount] = useState(1);

  const level = char.level || 1;
  const dieSize = HIT_DIE_BY_CLASS[char.charClass] || 8;
  const hdCurrent = char.hitDiceCurrent ?? level;
  const isFull = hdCurrent >= level;
  const isLow = !isFull && level > 0 && (hdCurrent / level) <= 0.25;
  const isEmpty = hdCurrent === 0;

  // Get CON modifier for HP recovery preview
  const conStat = (char.stats || []).find((s) => s.stat === "Constitution");
  const conMod = conStat ? Math.floor((conStat.score - 10) / 2) : 0;

  function openModal() {
    if (isEmpty) return;
    setModalCount(1);
    setShowModal(true);
  }

  async function confirmSpend(n) {
    const newVal = Math.max(0, hdCurrent - n);
    setChar((c) => ({ ...c, hitDiceCurrent: newVal }));
    setShowModal(false);
    try {
      await applySessionPatch({ hitDiceCurrent: newVal }, { hitDiceCurrent: hdCurrent });
    } catch {
      setChar((c) => ({ ...c, hitDiceCurrent: hdCurrent }));
    }
  }

  const countColor = isEmpty ? "#c06060" : (isLow ? "#c06060" : "#c8a040");

  return (
    <>
      <style>{`
        @keyframes hdPipPop { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
      `}</style>
      <div style={{ marginBottom: 0 }}>
        {isFull ? (
          // FULL STATE — compact single line
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
            <span style={{ color: pal.gem, fontSize: 10, opacity: 0.7, flexShrink: 0 }}>◆</span>
            <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, flex: 1 }}>Hit Dice</span>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: pal.gem, lineHeight: 1 }}>{level}</span>
            <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", color: pal.textMuted, marginLeft: 2 }}>d{dieSize}</span>
            <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: pal.gem, opacity: 0.65, border: `1px solid rgba(138,180,200,0.2)`, borderRadius: 2, padding: "1px 6px" }}>Full</span>
            {slug && (
              <button onClick={openModal} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", padding: "3px 10px", cursor: "pointer", flexShrink: 0, opacity: 0.6, transition: "opacity 0.15s, border-color 0.15s, color 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accentBright; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.borderColor = pal.border; e.currentTarget.style.color = pal.textMuted; }}>Spend</button>
            )}
          </div>
        ) : (
          // DEPLETED STATE — expanded tracker
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: pal.textMuted, flex: 1 }}>Hit Dice</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 28, lineHeight: 1, color: countColor, opacity: isEmpty ? 0.6 : 1 }}>{hdCurrent}</span>
                <span style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted }}>/</span>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: pal.textMuted, lineHeight: 1 }}>{level}</span>
                <span style={{ fontFamily: pal.fontUI, fontSize: 13, color: pal.textMuted, letterSpacing: "0.06em", marginLeft: 4 }}>d{dieSize}</span>
              </div>
            </div>

            {isLow && !isEmpty && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(200,160,64,0.15)", border: "1px solid rgba(200,160,64,0.40)", borderRadius: 3, padding: "6px 12px", marginBottom: 10, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: "#c8a040" }}>
                ◈ {hdCurrent} of {level} Hit Dice remaining
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {Array.from({ length: level }, (_, i) => {
                const available = i < hdCurrent;
                return (
                  <div key={i} style={{ width: 26, height: 26, borderRadius: 4, border: `1.5px solid ${available ? "rgba(138,180,200,0.4)" : "rgba(106,143,168,0.15)"}`, background: available ? "rgba(138,180,200,0.12)" : "transparent", opacity: available ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {available && <div style={{ width: 8, height: 8, borderRadius: 1, background: pal.gem, opacity: 0.75 }} />}
                  </div>
                );
              })}
            </div>

            {slug && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: isEmpty ? 0.45 : 1, pointerEvents: isEmpty ? "none" : "auto" }}>
                <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.textMuted, flexShrink: 0 }}>Spend</span>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${pal.border}`, borderRadius: 3, overflow: "hidden" }}>
                  <button onClick={() => !isEmpty && applyHdDelta(-1)} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 18, width: 32, height: 32, cursor: isEmpty ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>−</button>
                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color: pal.text, minWidth: 28, textAlign: "center", padding: "0 4px", borderLeft: `1px solid ${pal.border}`, borderRight: `1px solid ${pal.border}` }}>1</span>
                  <button onClick={() => !isEmpty && openModal()} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 18, width: 32, height: 32, cursor: isEmpty ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>+</button>
                </div>
                {!isEmpty && (
                  <span style={{ fontFamily: pal.fontBody, fontSize: 13, fontStyle: "italic", color: pal.textMuted, flex: 1 }}>
                    Roll <span style={{ color: pal.gem, fontStyle: "normal", fontFamily: pal.fontDisplay, fontSize: 14 }}>1d{dieSize}{conMod >= 0 ? `+${conMod}` : conMod}</span>
                    <span style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted, marginLeft: 4 }}>({1 + conMod}–{dieSize + conMod})</span>
                  </span>
                )}
                {isEmpty && <span style={{ fontFamily: pal.fontBody, fontSize: 13, fontStyle: "italic", color: "#c06060" }}>No dice remaining</span>}
                <button onClick={openModal} style={{ background: "rgba(200,160,64,0.15)", border: "1px solid rgba(200,160,64,0.40)", borderRadius: 3, color: "#c8a040", fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", padding: "7px 16px", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,160,64,0.22)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(200,160,64,0.15)"; }}>Spend</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spend Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 6, padding: "28px 30px", width: "100%", maxWidth: 420 }}>
            <div style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: pal.text, marginBottom: 4 }}>Spend Hit Dice</div>
            <div style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 14, color: pal.textMuted, marginBottom: 24 }}>Short Rest — roll and add your CON modifier</div>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontFamily: pal.fontDisplay, fontSize: 56, color: pal.gem, lineHeight: 1, display: "block" }}>d{dieSize}</span>
              <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, display: "block", marginTop: 4 }}>{hdCurrent} {hdCurrent === 1 ? "die" : "dice"} available</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 18 }}>
              <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted }}>Dice to spend</span>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${pal.border}`, borderRadius: 3, overflow: "hidden" }}>
                <button onClick={() => setModalCount((n) => Math.max(1, n - 1))} disabled={modalCount <= 1} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 22, width: 40, height: 40, cursor: modalCount <= 1 ? "default" : "pointer", opacity: modalCount <= 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 24, color: pal.text, minWidth: 44, textAlign: "center", padding: "0 6px", borderLeft: `1px solid ${pal.border}`, borderRight: `1px solid ${pal.border}` }}>{modalCount}</span>
                <button onClick={() => setModalCount((n) => Math.min(hdCurrent, n + 1))} disabled={modalCount >= hdCurrent} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 22, width: 40, height: 40, cursor: modalCount >= hdCurrent ? "default" : "pointer", opacity: modalCount >= hdCurrent ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>

            <div style={{ background: `${pal.accent}14`, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "12px 16px", marginBottom: 20, textAlign: "center" }}>
              <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, display: "block", marginBottom: 6 }}>Expected HP Recovery</span>
              <span style={{ fontFamily: pal.fontDisplay, fontSize: 26, color: pal.gem, display: "block" }}>{modalCount * (1 + conMod)} – {modalCount * (dieSize + conMod)}</span>
              <span style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 13, color: pal.textMuted, display: "block", marginTop: 4 }}>{modalCount}d{dieSize} + {modalCount * conMod} (CON mod ×{modalCount})</span>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", padding: "5px 13px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => confirmSpend(modalCount)} style={{ background: "rgba(200,160,64,0.15)", border: "1px solid rgba(200,160,64,0.40)", borderRadius: 3, color: "#c8a040", fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", padding: "7px 16px", cursor: "pointer" }}>Spend {modalCount} {modalCount === 1 ? "Die" : "Dice"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  function applyHdDelta(delta) {
    const newVal = Math.max(0, hdCurrent + delta);
    if (newVal === hdCurrent) return;
    setChar((c) => ({ ...c, hitDiceCurrent: newVal }));
    applySessionPatch({ hitDiceCurrent: newVal }, { hitDiceCurrent: hdCurrent }).catch(() => {});
  }
}

/**
 * QtyStepperControls — renders [−] qty [+] with hold-to-repeat.
 * Extracted as a component so it can use the useHoldToRepeat hook.
 */
function QtyStepperControls({ qty, onDecrement, onIncrement, onActivity, pal }) {
  const decHold = useHoldToRepeat(
    () => { onDecrement(); onActivity(); },
    500, 100
  );
  const incHold = useHoldToRepeat(
    () => { onIncrement(); onActivity(); },
    500, 100
  );

  const btnStyle = {
    width: 22, height: 22, borderRadius: 3,
    border: `1px solid ${pal.border}`,
    background: "transparent",
    color: pal.accentBright,
    fontFamily: pal.fontUI,
    fontSize: 15,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    lineHeight: 1,
    userSelect: "none",
    touchAction: "none",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <button
        style={{ ...btnStyle, opacity: qty <= 0 ? 0.3 : 1, pointerEvents: qty <= 0 ? "none" : "auto" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onActivity(); decHold.start(); }}
        onPointerUp={() => decHold.stop()}
        onPointerCancel={() => decHold.stop()}
        title="Decrease"
      >−</button>
      <span style={{ fontFamily: pal.fontDisplay, fontSize: 15, color: qty === 0 ? "#c06060" : pal.gem, minWidth: 28, textAlign: "center" }}>{qty}</span>
      <button
        style={btnStyle}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onActivity(); incHold.start(); }}
        onPointerUp={() => incHold.stop()}
        onPointerCancel={() => incHold.stop()}
        title="Increase"
      >+</button>
    </div>
  );
}

function SessionNotesSection({ char, setChar, applySessionPatch, pal }) {
  const [inputVal, setInputVal] = useState("");
  const notes = char.playerNotes || [];

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  async function handleAdd() {
    const text = inputVal.trim();
    if (!text) return;
    const newNote = { id: genId(), text, sharedWithDm: false, createdAt: new Date().toISOString() };
    const prev = notes;
    const updated = [...notes, newNote];
    setChar((c) => ({ ...c, playerNotes: updated }));
    setInputVal("");
    try {
      await applySessionPatch({ playerNotes: updated }, { playerNotes: prev });
    } catch {
      setChar((c) => ({ ...c, playerNotes: prev }));
    }
  }

  async function handleDelete(id) {
    const prev = notes;
    const updated = notes.filter((n) => n.id !== id);
    setChar((c) => ({ ...c, playerNotes: updated }));
    try {
      await applySessionPatch({ playerNotes: updated }, { playerNotes: prev });
    } catch {
      setChar((c) => ({ ...c, playerNotes: prev }));
    }
  }

  async function handleToggleShare(id) {
    const prev = notes;
    const updated = notes.map((n) => n.id === id ? { ...n, sharedWithDm: !n.sharedWithDm } : n);
    setChar((c) => ({ ...c, playerNotes: updated }));
    try {
      await applySessionPatch({ playerNotes: updated }, { playerNotes: prev });
    } catch {
      setChar((c) => ({ ...c, playerNotes: prev }));
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: pal.textMuted }}>Session Notes</span>
        <div style={{ flex: 1, height: 1, background: pal.border }} />
      </div>

      {notes.length > 0 && (
        <ul style={{ listStyle: "none", marginBottom: 12 }}>
          {notes.map((note, idx) => (
            <li key={note.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: idx < notes.length - 1 ? `1px solid ${pal.border}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text, lineHeight: 1.5, marginBottom: 5 }}>{note.text}</div>
                <button
                  onClick={() => handleToggleShare(note.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: note.sharedWithDm ? pal.gem : pal.textMuted, border: "none", background: "transparent", padding: 0, transition: "color 0.15s", userSelect: "none" }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${note.sharedWithDm ? pal.gem : pal.textMuted}`, background: note.sharedWithDm ? pal.gem : "transparent", display: "inline-block", transition: "background 0.15s, border-color 0.15s", flexShrink: 0 }} />
                  {note.sharedWithDm ? "Shared with DM" : "Private"}
                </button>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                style={{ background: "transparent", border: "none", color: "#c06060", cursor: "pointer", fontSize: 16, padding: "0 2px", opacity: 0.45, lineHeight: 1, flexShrink: 0, marginTop: 2, transition: "opacity 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.45"; }}
                title="Delete note"
              >×</button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input
          type="text"
          maxLength={500}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Capture a name, clue, or quest thread… (Enter to add)"
          style={{ flex: 1, background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "7px 10px", outline: "none" }}
          onFocus={(e) => { e.target.style.borderColor = pal.accent; }}
          onBlur={(e) => { e.target.style.borderColor = pal.border; }}
        />
        <button
          onClick={handleAdd}
          style={{ background: `rgba(18,58,78,0.5)`, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(106,143,168,0.22)`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(18,58,78,0.5)`; }}
        >+ Add</button>
      </div>
      <div style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, letterSpacing: "0.12em" }}>Private by default. Tap "Private" to share a note with the DM.</div>
    </div>
  );
}

export default function CharacterSheetViewMode({ ctx }) {
  const [conditionPickerOpen, setConditionPickerOpen] = useState(false);
  const [fullCoinExpanded, setFullCoinExpanded] = useState(false);
  const [xpAwardOpen, setXpAwardOpen] = useState(false);
  const [xpAwardValue, setXpAwardValue] = useState("100");
  // Qty stepper: id of the equipment item whose stepper is open, or null
  const [qtyStepperOpenId, setQtyStepperOpenId] = useState(null);
  // Attunement over-limit flash: set of item ids currently flashing red
  const [attunementFlashing, setAttunementFlashing] = useState(new Set());
  // Drop item confirm: id of item pending drop confirmation, or null
  const [dropConfirmId, setDropConfirmId] = useState(null);
  const qtyAutoCloseRef = useRef(null);
  const qtyDebounceRef = useRef(null);
  const {
    rootWrap,
    pal,
    char,
    exportJSON,
    handleEditClick,
    unlockLoading,
    unlockChecking,
    unlockState,
    unlockIntent,
    unlockInput,
    setUnlockInput,
    unlockError,
    handleCancelUnlock,
    handleUnlockSubmit,
    handleViewUnlock,
    active,
    setActive,
    activeSec,
    navBtn,
    onSave,
    slug,
    applySessionPatch,
    setChar,
    markSessionExpected,
    hpFlushRef,
    hpPendingDelta,
    tempHpFlushRef,
    exhFlushRef,
    exhPendingDelta,
    concSpellInput,
    setConcSpellInput,
    hpEditMode,
    setHpEditMode,
    hpMax,
    hpCurrent,
    tempHP,
    hpPct,
    hpBarColor,
    hpBonus,
    _itemBonuses,
    isActiveTurn,
    secHead,
    inputStyle,
    combatTab,
    setTab,
    editingItem,
    setEditingItem,
    expandedItems,
    setExpandedItems,
    toggleExpanded,
    hoveredStat,
    setHoveredStat,
    updateWeapon,
    addWeapon,
    updateEquipment,
    addEquipment,
    activeMap,
    activeMapView,
  } = ctx;

  // Close qty stepper when clicking outside the loadout tab
  useEffect(() => {
    if (!qtyStepperOpenId) return;
    function handleDocClick(e) {
      // Close unless the click is inside a [data-qty-row] element
      if (!e.target.closest("[data-qty-row]")) {
        setQtyStepperOpenId(null);
      }
    }
    document.addEventListener("pointerdown", handleDocClick);
    return () => document.removeEventListener("pointerdown", handleDocClick);
  }, [qtyStepperOpenId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(qtyAutoCloseRef.current);
      clearTimeout(qtyDebounceRef.current);
    };
  }, []);

  // Derived attunement count across weapons + equipment
  const attunedCount = [
    ...(char.weapons || []),
    ...(char.equipment || []),
  ].filter((i) => i.attuned).length;

  const skillItems = (char.skills || []).map((skill) => ({ key: skill, label: skill.replace(/\b\w/g, (ch) => ch.toUpperCase()) }));
  const spellItems = (char.spells || []).map((spell) => ({ key: spell, label: spell }));
  const abilityItems = (char.specialAbilities || []).map((ability) => ({ key: ability, label: ability.replace(/\b\w/g, (ch) => ch.toUpperCase()) }));
  const talentGroups = [
    {
      label: "Skills",
      singular: "Skill",
      items: skillItems,
      color: pal.accentBright,
      border: `${pal.accent}66`,
      bg: `${pal.accent}16`,
    },
    {
      label: "Spells",
      singular: "Spell",
      items: spellItems,
      color: pal.accent,
      border: pal.border,
      bg: pal.surface,
    },
    {
      label: "Special Abilities",
      singular: "Special Ability",
      items: abilityItems,
      color: pal.gem,
      border: `${pal.gem}55`,
      bg: `${pal.gem}14`,
    },
  ];
  const hasPersonaBadgeContent = talentGroups.some((group) => group.items.length > 0);

  return (
    <div style={rootWrap}>
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse at 18% 45%, ${pal.glow1} 0%, transparent 55%),
          radial-gradient(ellipse at 82% 18%, ${pal.glow2} 0%, transparent 48%),
          radial-gradient(ellipse at 50% 90%, ${pal.glow2} 0%, transparent 45%)
        `,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 840, margin: "0 auto", padding: "30px 28px 100px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 40 }}>
          <Link to="/" style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, textDecoration: "none" }}>
            ← All Characters
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={exportJSON} style={{ background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 2, cursor: "pointer" }}>
              Export JSON
            </button>
            <button onClick={handleEditClick} disabled={unlockLoading || unlockChecking} style={{ background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: unlockLoading ? 0.6 : 1 }}>
              {unlockLoading ? <><div className="dnd-spinner" style={{ width: 12, height: 12, borderTopColor: pal.textMuted }} /> Checking…</> : unlockState === "unlocked" ? "Edit Character" : "🔒 Edit Character"}
            </button>
          </div>
        </div>

        {unlockState === "prompting" && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 6, padding: "32px 28px", width: "100%", maxWidth: 360 }}>
              <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>
                {unlockIntent === "delete" ? "Unlock to Delete" : "Unlock to Edit"}
              </div>
              <div style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: pal.text, marginBottom: 20 }}>
                {char.name}
              </div>
              <form onSubmit={handleUnlockSubmit}>
                <input type="password" autoFocus placeholder="Enter character password…" value={unlockInput} onChange={(e) => setUnlockInput(e.target.value)} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 16, padding: "9px 13px", width: "100%", outline: "none", marginBottom: 8 }} />
                {unlockError && (
                  <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 14, marginBottom: 12 }}>
                    {unlockError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={handleCancelUnlock} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontBody, fontSize: 14, padding: "8px 16px", cursor: "pointer", flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.08em", padding: "9px 18px", cursor: "pointer", flex: 2 }}>
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <header style={{ textAlign: "center", marginBottom: 52, paddingBottom: 40, borderBottom: `1px solid ${pal.border}` }}>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", color: pal.textMuted, textTransform: "uppercase", marginBottom: 18 }}>
            {char.charClass}{char.subclass ? ` · ${char.subclass}` : ""}
          </div>

          <h1 style={{ fontFamily: pal.fontDisplay, fontWeight: 400, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: pal.text, margin: "0 0 8px", letterSpacing: "0.04em", lineHeight: 1.1 }}>
            {char.name || "Unnamed"}
          </h1>

          {char.nameAlt && (
            <div style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 18, color: pal.text, letterSpacing: "0.06em", marginBottom: 6 }}>
              "{char.nameAlt}"
            </div>
          )}

          {char.pronunciation && (
            <div style={{ fontFamily: pal.fontUI, fontSize: 14, color: pal.accent, letterSpacing: "0.15em", marginBottom: 24 }}>
              {char.pronunciation}
            </div>
          )}

          <div className="character-details-grid">
            {[
              ["Race", char.race],
              ["Class", char.charClass],
              char.subclass ? ["Subclass", char.subclass] : null,
              ["Alignment", char.alignment],
              ["Background", char.background],
              ["Origin", char.origin],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.22em", color: pal.accentDim, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.accent }}>{value}</div>
              </div>
            ))}
          </div>

        </header>

        {(char.portraitUrl || char.portrait) && (
          <div style={{ width: "calc(100% + 56px)", marginLeft: -28, marginRight: -28, marginBottom: 44, overflow: "hidden", borderRadius: 4 }}>
            <img src={char.portraitUrl || char.portrait} alt={char.name} style={{ width: "100%", display: "block" }} />
            {char.tagline && (
              <p style={{ margin: 0, padding: "14px 28px 10px", fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 22, color: pal.accent, textAlign: "center", lineHeight: 1.7 }}>
                {char.tagline}
              </p>
            )}
          </div>
        )}

        {unlockState === "unlocked" ? (
          <>
            <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "28px 30px", marginBottom: 44, isolation: "isolate" }}>
              {((char.hpMax ?? char.hp ?? 0) > 0 || char.armorType || char.armorTotal > 0) && (() => {
                const acBonus = _itemBonuses["Armor"] || 0;
                const effectiveAc = (char.armorTotal || 0) + acBonus;
                const armorOpt = ARMOR_OPTIONS.find((option) => option.value === char.armorType);
                const armorBreakdown = [
                  { label: "Base", value: char.armorTotal || 0 },
                  ...[...(char.weapons || []), ...(char.equipment || [])].filter((item) => item.equipped !== false)
                    .flatMap((item) => (item.mods || [])
                      .filter((mod) => mod.attribute === "Armor")
                      .map((mod) => ({
                        label: item.name,
                        value: parseModInt(mod.value) || 0,
                      })))
                    .filter((entry) => entry.value !== 0),
                ];
                const armorFlyoutOpen = hoveredStat === "armor";
                const armorHandlers = {
                  onMouseEnter: () => setHoveredStat("armor"),
                  onMouseLeave: () => setHoveredStat(null),
                  onClick: (e) => { e.stopPropagation(); setHoveredStat(hoveredStat === "armor" ? null : "armor"); },
                };

                return (
                  <div style={{ display: "flex", justifyContent: "center", gap: 52, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {(char.hpMax ?? char.hp ?? 0) > 0 && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 4 }}>Hit Points</div>
                        <div style={{ height: 14 }} />
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 44, color: pal.gem, lineHeight: 1 }}>{hpCurrent}</span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.textMuted, lineHeight: 1 }}>/</span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 30, color: pal.accent, lineHeight: 1 }}>{hpMax}</span>
                        </div>
                        <div style={{ height: 18, marginTop: 1 }}>
                          {tempHP > 0 && <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.accentBright, letterSpacing: "0.08em" }}>+{tempHP} temp</div>}
                        </div>
                        <div style={{ width: "100%", height: 10, marginTop: 0, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 80 }}>
                          {hpMax > 0 && (
                            <div style={{ width: "100%", height: 4, borderRadius: 2, background: pal.border, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%`, height: "100%", borderRadius: 2, background: hpBarColor, transition: "width 0.25s, background-color 0.25s" }} />
                            </div>
                          )}
                        </div>
                        
                        <div style={{ height: 15, marginTop: 2 }}>
                          {hpBonus !== 0 && <div style={{ fontFamily: pal.fontBody, fontSize: 11, color: pal.accent, fontStyle: "italic", opacity: 0.8 }}>{char.hpMax ?? char.hp} base {hpBonus > 0 ? "+" : ""}{hpBonus} item</div>}
                        </div>
                      </div>
                    )}
                    {(armorOpt || char.armorTotal > 0 || acBonus > 0) && (
                      <div style={{ textAlign: "center", position: "relative" }}>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 4 }}>Armor</div>
                        <div style={{ height: 14 }} />
                        {effectiveAc > 0 && (
                          <>
                            <div {...armorHandlers} style={{ fontFamily: pal.fontDisplay, fontSize: 44, color: pal.accentBright, lineHeight: 1, cursor: "pointer" }}>{effectiveAc}</div>
                            <div style={{ height: 18, marginTop: 1 }} />
                          </>
                        )}
                        {effectiveAc <= 0 && <div style={{ height: 62 }} />}
                        <div style={{ width: "100%", height: 10, marginTop: 0, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 120 }}>
                          {armorOpt && (
                            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>
                              {armorOpt.label}{armorOpt.speed ? ` · ${armorOpt.speed}` : ""}
                            </div>
                          )}
                        </div>
                        
                        <div style={{ height: 15, marginTop: 2 }} />
                        {armorFlyoutOpen && (
                          <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 20, background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "12px 16px", minWidth: 180, boxShadow: "0 4px 20px rgba(0,0,0,0.45)", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20, marginBottom: 10 }}>
                              <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted }}>Armor Class</div>
                              <div style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.accentBright, lineHeight: 1 }}>{effectiveAc}</div>
                            </div>
                            <div style={{ borderTop: `1px solid ${pal.border}`, marginBottom: 8 }} />
                            {armorBreakdown.map((entry, index) => (
                              <div key={`${entry.label}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: index < armorBreakdown.length - 1 ? 4 : 0 }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: entry.label === "Base" ? pal.textMuted : pal.textBody, fontStyle: entry.label === "Base" ? "italic" : "normal" }}>{entry.label}</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: entry.value >= 0 ? pal.gem : pal.gemLow }}>{entry.value >= 0 ? `+${entry.value}` : entry.value}</span>
                              </div>
                            ))}
                            <div style={{ borderTop: `1px solid ${pal.border}`, margin: "6px 0" }} />
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
                              <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>Total</span>
                              <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: pal.accentBright }}>{effectiveAc}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <HR color={pal.border} />
              <div style={secHead}>Ability Scores · Level {char.level}</div>

              {(() => {
                const modSources = {};
                [...(char.weapons || []), ...(char.equipment || [])].filter((item) => item.equipped !== false).forEach((item) => {
                  (item.mods || []).forEach(({ attribute, value }) => {
                    const parsed = parseModInt(value);
                    if (!isNaN(parsed)) (modSources[attribute] = modSources[attribute] || []).push({ source: item.name, value: parsed });
                  });
                });

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px 8px", marginBottom: 8, justifyContent: "center" }}>
                    {char.stats.map(({ stat, score, note }) => {
                      const baseMod = modOf(score);
                      const itemMods = modSources[stat] || [];
                      const itemBonus = itemMods.reduce((sum, mod) => sum + mod.value, 0);
                      const totalMod = baseMod + itemBonus;
                      const color = score >= 14 ? pal.gem : score <= 8 ? pal.gemLow : pal.accent;
                      const showBadge = totalMod !== 0;
                      const flyoutOpen = hoveredStat === stat;
                      const circleHandlers = {
                        onMouseEnter: () => setHoveredStat(stat),
                        onMouseLeave: () => setHoveredStat(null),
                        onClick: (e) => { e.stopPropagation(); setHoveredStat(hoveredStat === stat ? null : stat); },
                      };

                      return (
                        <div key={stat} style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0, marginLeft: 8, marginBottom: 6 }}>
                            <div {...circleHandlers} style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${color}55`, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                              <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, color, lineHeight: 1 }}>{score}</div>
                            </div>
                            {showBadge && (
                              <div {...circleHandlers} style={{ position: "absolute", bottom: -6, left: -8, width: 26, height: 26, borderRadius: "50%", background: color, border: `2px solid ${pal.surfaceSolid}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: pal.bg, lineHeight: 1, letterSpacing: "-0.02em" }}>{fmtMod(totalMod)}</span>
                              </div>
                            )}
                          </div>

                          <div>
                            <div style={{ fontFamily: pal.fontUI, fontSize: 14, color: pal.accentBright, letterSpacing: "0.06em" }}>{stat}</div>
                            <div style={{ fontFamily: pal.fontBody, fontSize: 12, color: pal.textMuted, marginTop: 2 }}>{note}</div>
                          </div>

                          {flyoutOpen && (
                            <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 20, pointerEvents: "none", background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "12px 16px", minWidth: 180, boxShadow: "0 4px 20px rgba(0,0,0,0.45)", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20, marginBottom: 10 }}>
                                <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted }}>{stat}</div>
                                <div style={{ fontFamily: pal.fontDisplay, fontSize: 22, color, lineHeight: 1 }}>{score}</div>
                              </div>
                              <div style={{ borderTop: `1px solid ${pal.border}`, marginBottom: 8 }} />
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: itemMods.length > 0 ? 4 : 0 }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>Score modifier</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: baseMod >= 0 ? pal.gem : pal.gemLow }}>{fmtMod(baseMod)}</span>
                              </div>
                              {itemMods.map((mod, index) => (
                                <div key={index} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: index < itemMods.length - 1 ? 4 : 0 }}>
                                  <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textBody }}>{mod.source}</span>
                                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: mod.value >= 0 ? pal.gem : pal.gemLow }}>{fmtMod(mod.value)}</span>
                                </div>
                              ))}
                              <div style={{ borderTop: `1px solid ${pal.border}`, margin: "6px 0" }} />
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>Total</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color }}>{score + totalMod}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <style>{`@keyframes xpLevelupPulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,0,0,0)} 50%{box-shadow:0 0 8px 2px rgba(138,180,200,0.28)} }`}</style>

              <div style={{ display: "flex", margin: "0 -30px 24px" }}>
                {[
                  
                  {
                    key: "persona",
                    label: "Persona",
                    icon: (activeTab) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 5 Q4 2 10 2 Q16 2 16 5 L16 11 Q16 16 10 17 Q7 17 5.5 15" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                        <path d="M4 5 L4 11 Q4 14 5.5 15" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                        <circle cx="7.5" cy="8" r="1.2" fill={activeTab ? pal.accentBright : pal.textMuted}/>
                        <circle cx="12.5" cy="8" r="1.2" fill={activeTab ? pal.accentBright : pal.textMuted}/>
                        <path d="M7.5 12 Q10 13.5 12.5 12" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    key: "loadout",
                    label: "Inventory",
                    icon: (activeTab) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="3" y1="3" x2="17" y2="17" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="17" y1="3" x2="3" y2="17" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="2" strokeLinecap="round"/>
                        <rect x="2" y="1" width="3" height="5" rx="1" fill={activeTab ? pal.accentBright : pal.textMuted} transform="rotate(45 3 3)"/>
                        <rect x="15" y="1" width="3" height="5" rx="1" fill={activeTab ? pal.accentBright : pal.textMuted} transform="rotate(-45 17 3)"/>
                      </svg>
                    ),
                  },   
                  {
                    key: "map",
                    label: "Map",
                    disabled: !activeMap,
                    icon: (activeTab) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="2,4 7,2 13,5 18,3 18,16 13,18 7,15 2,17" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                        <line x1="7" y1="2" x2="7" y2="15" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.2"/>
                        <line x1="13" y1="5" x2="13" y2="18" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.2"/>
                      </svg>
                    ),
                  },               
                  {
                    key: "combat",
                    label: "Combat",
                    icon: (activeTab) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2 L17 5 L17 10 Q17 15 10 18 Q3 15 3 10 L3 5 Z" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
                        <path d="M10 6 L10 13 M7 9.5 L13 9.5" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    ),
                  }                  
                ].map((tab, index, allTabs) => {
                  const isCurrent = combatTab === tab.key;
                  const isDisabled = !!tab.disabled;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => !isDisabled && setTab(tab.key)}
                      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, height: 64, fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", cursor: isDisabled ? "not-allowed" : "pointer", background: isCurrent ? pal.accentDim : "transparent", border: `1px solid ${isCurrent ? pal.accent : pal.border}`, borderRight: index < allTabs.length - 1 ? "none" : `1px solid ${isCurrent ? pal.accent : pal.border}`, color: isCurrent ? pal.accentBright : pal.textMuted, transition: "border-color 0.15s, background 0.15s, color 0.15s", opacity: isDisabled ? 0.4 : 1 }}
                    >
                      {tab.icon(isCurrent)}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {combatTab === "loadout" && (
                <>
                <style>{`
                  @keyframes attunePulse {
                    0%, 100% { opacity: 0.75; }
                    50% { opacity: 1; }
                  }
                  @keyframes overLimitFlash {
                    0%, 100% { box-shadow: 0 0 5px 1px rgba(200,144,76,0.5); }
                    25%, 75% { box-shadow: 0 0 8px 3px rgba(192,96,96,0.8); }
                    50% { box-shadow: 0 0 5px 1px rgba(200,144,76,0.5); }
                  }
                  .attuned-gem {
                    animation: attunePulse 2.2s ease-in-out infinite;
                  }
                  .attuned-gem.over-limit-flash {
                    animation: overLimitFlash 0.4s ease-in-out;
                  }
                `}</style>

                {/* Attunement Banner */}
                {(() => {
                  const isOverLimit = attunedCount > 3;
                  const isFull = attunedCount === 3;
                  const isEmpty = attunedCount === 0;
                  const noteText = isOverLimit
                    ? "⚠ Over limit"
                    : isFull
                    ? "Slots full"
                    : attunedCount === 2
                    ? "1 slot remaining"
                    : attunedCount === 1
                    ? "2 slots remaining"
                    : "3 slots free";
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      paddingBottom: 12,
                      borderBottom: `1px solid ${pal.border}`,
                      marginBottom: 16,
                      opacity: isEmpty ? 0.45 : 1,
                    }}>
                      <span style={{
                        display: "flex", alignItems: "center", gap: 6,
                        fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.25em",
                        textTransform: "uppercase",
                        color: isOverLimit ? "#c06060" : pal.textMuted,
                      }}>
                        <span style={{ color: isOverLimit ? "#c06060" : pal.accentDim }}>◆</span>
                        Attuned
                      </span>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 2, fontFamily: pal.fontDisplay, fontSize: 14 }}>
                        <span style={{ color: isOverLimit ? "#c06060" : pal.gem }}>{attunedCount}</span>
                        <span style={{ color: pal.textMuted, margin: "0 1px" }}>/</span>
                        <span style={{ color: pal.textMuted }}>3</span>
                      </span>
                      <span style={{
                        fontFamily: pal.fontUI, fontSize: 11, fontStyle: "italic",
                        color: isOverLimit ? "#c06060" : isFull ? pal.accentBright : pal.textMuted,
                      }}>
                        · {noteText}
                      </span>
                    </div>
                  );
                })()}

                <div className="loadout-grid">
                  {/* WEAPONS COLUMN */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim }}>Weapons</div>
                      {onSave && <button onClick={() => setEditingItem({ listType: "weapons", item: null })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12 }}>+ Add Weapon</button>}
                    </div>
                    {(char.weapons || []).length > 0 ? (
                      char.weapons.map((item) => {
                        const expanded = expandedItems.has(item.id);
                        const needsAttune = item.requiresAttunement;
                        const isAttuned = item.attuned;
                        const isFlashing = attunementFlashing.has(item.id);
                        const isEquipped = item.equipped !== false;
                        const nameColor = (!needsAttune || isAttuned) ? (isEquipped ? pal.text : pal.textMuted) : pal.textBody;
                        const isDropConfirming = dropConfirmId === item.id;

                        function toggleAttunement(e) {
                          e.stopPropagation();
                          const prevWeapons = char.weapons;
                          const newAttuned = !isAttuned;
                          // Check over-limit flash
                          if (newAttuned && attunedCount >= 3) {
                            setAttunementFlashing((s) => new Set([...s, item.id]));
                            setTimeout(() => {
                              setAttunementFlashing((s) => { const n = new Set(s); n.delete(item.id); return n; });
                            }, 400);
                          }
                          const updated = char.weapons.map((w) => w.id === item.id ? { ...w, attuned: newAttuned } : w);
                          setChar((c) => ({ ...c, weapons: updated }));
                          applySessionPatch({ weapons: updated }, { weapons: prevWeapons }).catch(() => {});
                        }

                        function toggleEquipped(e) {
                          e.stopPropagation();
                          const prevWeapons = char.weapons;
                          const updated = char.weapons.map((w) => w.id === item.id ? { ...w, equipped: !isEquipped } : w);
                          setChar((c) => ({ ...c, weapons: updated }));
                          applySessionPatch({ weapons: updated }, { weapons: prevWeapons }).catch(() => {});
                        }

                        function confirmDrop(e) {
                          e.stopPropagation();
                          const prevWeapons = char.weapons;
                          const updated = char.weapons.filter((w) => w.id !== item.id);
                          setChar((c) => ({ ...c, weapons: updated }));
                          setDropConfirmId(null);
                          applySessionPatch({ weapons: updated }, { weapons: prevWeapons }).catch(() => {});
                        }

                        return (
                          <div key={item.id} onClick={() => toggleExpanded(item.id)} style={{ padding: "9px 0", borderBottom: `1px solid ${pal.border}`, cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "nowrap" }}>
                              {/* Equipped toggle badge */}
                              <span
                                onClick={toggleEquipped}
                                title={isEquipped ? "Equipped — tap to unequip" : "Not equipped — tap to equip"}
                                style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 14, height: 14, flexShrink: 0,
                                  padding: 7, margin: -7,
                                  cursor: "pointer",
                                  fontSize: 10,
                                  color: isEquipped ? pal.gem : pal.textMuted,
                                  opacity: isEquipped ? 1 : 0.45,
                                }}
                              >■</span>
                              <span style={{ fontFamily: pal.fontBody, fontSize: 16, color: nameColor, flex: 1, minWidth: 0 }}>{item.name}</span>
                              {item.mods?.length > 0 && <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted, flexShrink: 0 }}>{item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</span>}
                              {needsAttune && (
                                <span
                                  onClick={toggleAttunement}
                                  title={isAttuned ? "Attuned — tap to de-attune" : "Requires attunement — tap to attune"}
                                  style={{
                                    display: "inline-block",
                                    width: 10, height: 10,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    padding: 9, margin: -9,
                                    backgroundClip: "content-box",
                                    cursor: "pointer",
                                    backgroundColor: isAttuned ? pal.gem : "transparent",
                                    border: isAttuned ? "none" : `1.5px solid ${pal.textMuted}`,
                                    boxShadow: isAttuned ? `0 0 5px 1px ${pal.gem}80` : "none",
                                  }}
                                  className={isAttuned ? (isFlashing ? "attuned-gem over-limit-flash" : "attuned-gem") : ""}
                                />
                              )}
                              <span style={{ flexShrink: 0, color: pal.accentDim, fontSize: 11, fontFamily: pal.fontUI }}>{expanded ? "▲" : "▼"}</span>
                            </div>
                            {expanded && (
                              <div>
                                {item.description && <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, marginTop: 6, lineHeight: 1.6, fontStyle: "italic" }}>{item.description}</div>}
                                {/* Drop item */}
                                {slug && (
                                  <div style={{ marginTop: 10, display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                                    {isDropConfirming ? (
                                      <>
                                        <button onClick={confirmDrop} style={{ background: "transparent", border: `1px solid #c06060`, borderRadius: 3, color: "#c06060", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}>Confirm drop</button>
                                        <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(null); }} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
                                      </>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(item.id); }} style={{ background: "transparent", border: "none", borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 0", cursor: "pointer" }}>Drop Item</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No weapons.</div>
                    )}
                  </div>

                  {/* EQUIPMENT COLUMN */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim }}>Equipment</div>
                      {onSave && <button onClick={() => setEditingItem({ listType: "equipment", item: null, showType: true })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12 }}>+ Add Item</button>}
                    </div>
                    {(char.equipment || []).length > 0 ? (
                      char.equipment.map((item) => {
                        const expanded = expandedItems.has(item.id);
                        const needsAttune = item.requiresAttunement;
                        const isAttuned = item.attuned;
                        const isFlashing = attunementFlashing.has(item.id);
                        const hasQty = item.qty != null;
                        const isDepleted = hasQty && item.qty === 0;
                        const stepperOpen = qtyStepperOpenId === item.id;
                        const isEquipped = item.equipped !== false;
                        const isPotion = item.type === "potion" && hasQty && item.qty > 0;
                        const isDropConfirming = dropConfirmId === item.id;
                        const nameColor = isDepleted ? pal.textMuted : (!needsAttune || isAttuned) ? (isEquipped ? pal.text : pal.textMuted) : pal.textBody;

                        function patchEquipmentQty(newQty) {
                          const prevEquipment = char.equipment;
                          const updated = char.equipment.map((eq) => eq.id === item.id ? { ...eq, qty: Math.max(0, newQty) } : eq);
                          setChar((c) => ({ ...c, equipment: updated }));
                          clearTimeout(qtyDebounceRef.current);
                          qtyDebounceRef.current = setTimeout(() => {
                            applySessionPatch({ equipment: updated }, { equipment: prevEquipment }).catch(() => {});
                          }, 400);
                        }

                        function openStepper(e) {
                          e.stopPropagation();
                          setQtyStepperOpenId(item.id);
                          resetAutoClose();
                        }

                        function resetAutoClose() {
                          clearTimeout(qtyAutoCloseRef.current);
                          qtyAutoCloseRef.current = setTimeout(() => {
                            setQtyStepperOpenId(null);
                          }, 2000);
                        }

                        function toggleAttunement(e) {
                          e.stopPropagation();
                          const prevEquipment = char.equipment;
                          const newAttuned = !isAttuned;
                          if (newAttuned && attunedCount >= 3) {
                            setAttunementFlashing((s) => new Set([...s, item.id]));
                            setTimeout(() => {
                              setAttunementFlashing((s) => { const n = new Set(s); n.delete(item.id); return n; });
                            }, 400);
                          }
                          const updated = char.equipment.map((eq) => eq.id === item.id ? { ...eq, attuned: newAttuned } : eq);
                          setChar((c) => ({ ...c, equipment: updated }));
                          applySessionPatch({ equipment: updated }, { equipment: prevEquipment }).catch(() => {});
                        }

                        function toggleEquipped(e) {
                          e.stopPropagation();
                          const prevEquipment = char.equipment;
                          const updated = char.equipment.map((eq) => eq.id === item.id ? { ...eq, equipped: !isEquipped } : eq);
                          setChar((c) => ({ ...c, equipment: updated }));
                          applySessionPatch({ equipment: updated }, { equipment: prevEquipment }).catch(() => {});
                        }

                        function usePotion(e) {
                          e.stopPropagation();
                          patchEquipmentQty(item.qty - 1);
                        }

                        function confirmDrop(e) {
                          e.stopPropagation();
                          const prevEquipment = char.equipment;
                          const updated = char.equipment.filter((eq) => eq.id !== item.id);
                          setChar((c) => ({ ...c, equipment: updated }));
                          setDropConfirmId(null);
                          applySessionPatch({ equipment: updated }, { equipment: prevEquipment }).catch(() => {});
                        }

                        return (
                          <div
                            key={item.id}
                            data-qty-row={stepperOpen ? "true" : undefined}
                            onClick={() => !stepperOpen && toggleExpanded(item.id)}
                            style={{ padding: "9px 0", borderBottom: `1px solid ${pal.border}`, cursor: !stepperOpen ? "pointer" : "default" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                              {/* Equipped toggle badge */}
                              <span
                                onClick={toggleEquipped}
                                title={isEquipped ? "Equipped — tap to unequip" : "Not equipped — tap to equip"}
                                style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 14, height: 14, flexShrink: 0,
                                  padding: 7, margin: -7,
                                  cursor: "pointer",
                                  fontSize: 10,
                                  color: isEquipped ? pal.gem : pal.textMuted,
                                  opacity: isEquipped ? 1 : 0.45,
                                }}
                              >■</span>
                              {/* Name area — replaced by stepper when open */}
                              {stepperOpen ? (
                                <span style={{ fontFamily: pal.fontBody, fontSize: 15, color: nameColor, flexShrink: 0, marginRight: 4 }}>{item.name}</span>
                              ) : (
                                <span style={{ fontFamily: pal.fontBody, fontSize: 16, color: nameColor, flex: 1, minWidth: 0 }}>{item.name}</span>
                              )}
                              {/* Qty display or stepper */}
                              {hasQty && !stepperOpen && (
                                <span
                                  onClick={openStepper}
                                  style={{
                                    fontFamily: pal.fontBody, fontSize: 14,
                                    color: isDepleted ? "#c06060" : pal.textMuted,
                                    flexShrink: 0, whiteSpace: "nowrap",
                                    cursor: "pointer", padding: "0 2px", borderRadius: 2,
                                  }}
                                  title="Tap to adjust quantity"
                                >
                                  · {item.qty}
                                </span>
                              )}
                              {stepperOpen && (
                                <QtyStepperControls
                                  qty={item.qty}
                                  onDecrement={() => patchEquipmentQty(item.qty - 1)}
                                  onIncrement={() => patchEquipmentQty(item.qty + 1)}
                                  onActivity={resetAutoClose}
                                  pal={pal}
                                />
                              )}
                              {/* Spacer to push type/mods/gem/arrow right when stepper is open */}
                              {stepperOpen && <span style={{ flex: 1 }} />}
                              {/* Potion quick-use */}
                              {!stepperOpen && isPotion && slug && (
                                <button
                                  onClick={usePotion}
                                  title="Use one charge"
                                  style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.accent, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}
                                >Use</button>
                              )}
                              {!stepperOpen && item.type && <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.accent, opacity: 0.75, flexShrink: 0 }}>{itemTypeLabel(item.type)}</span>}
                              {!stepperOpen && item.mods?.length > 0 && <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted, flexShrink: 0 }}>{item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</span>}
                              {needsAttune && (
                                <span
                                  onClick={toggleAttunement}
                                  title={isAttuned ? "Attuned — tap to de-attune" : "Requires attunement — tap to attune"}
                                  style={{
                                    display: "inline-block",
                                    width: 10, height: 10,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    padding: 9, margin: -9,
                                    backgroundClip: "content-box",
                                    cursor: "pointer",
                                    backgroundColor: isAttuned ? pal.gem : "transparent",
                                    border: isAttuned ? "none" : `1.5px solid ${pal.textMuted}`,
                                    boxShadow: isAttuned ? `0 0 5px 1px ${pal.gem}80` : "none",
                                  }}
                                  className={isAttuned ? (isFlashing ? "attuned-gem over-limit-flash" : "attuned-gem") : ""}
                                />
                              )}
                              <span style={{ flexShrink: 0, color: pal.accentDim, fontSize: 11, fontFamily: pal.fontUI }}>{expanded ? "▲" : "▼"}</span>
                            </div>
                            {expanded && (
                              <div>
                                {item.description && <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, marginTop: 6, lineHeight: 1.6, fontStyle: "italic" }}>{item.description}</div>}
                                {/* Drop item */}
                                {slug && (
                                  <div style={{ marginTop: 10, display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                                    {isDropConfirming ? (
                                      <>
                                        <button onClick={confirmDrop} style={{ background: "transparent", border: `1px solid #c06060`, borderRadius: 3, color: "#c06060", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}>Confirm drop</button>
                                        <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(null); }} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
                                      </>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(item.id); }} style={{ background: "transparent", border: "none", borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 0", cursor: "pointer" }}>Drop Item</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No equipment.</div>
                    )}
                  </div>
                </div>

                {/* Coin Section */}
                {(() => {
                  const coinMode = char.coinMode || "gp";
                  const currentCoin = char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                  const DENOM_LABELS = { cp: "Copper", sp: "Silver", ep: "Electrum", gp: "Gold", pp: "Platinum" };
                  const DENOM_SHORT = { cp: "CP", sp: "SP", ep: "EP", gp: "GP", pp: "PP" };

                  const patchCoin = (denom, newVal) => {
                    const clamped = Math.max(0, newVal);
                    const prev = currentCoin;
                    const updated = { ...currentCoin, [denom]: clamped };
                    setChar((c) => ({ ...c, coin: updated }));
                    applySessionPatch({ coin: updated }, { coin: prev }).catch(() => {});
                  };

                  return (
                    <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 22, marginTop: 18 }}>
                      <style>{`
                        @media (max-width: 560px) {
                          .coin-full-grid { grid-template-columns: repeat(2, 1fr) !important; }
                        }
                      `}</style>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 16 }}>Coin</div>

                      {coinMode === "gp" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                          {/* GP denomination mark */}
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `rgba(200,160,64,0.1)`, border: `2px solid rgba(200,160,64,0.5)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: COIN_COLORS.gp }}>GP</span>
                          </div>
                          {/* Stepper + input group */}
                          <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${pal.border}`, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                            <button
                              onClick={() => patchCoin("gp", (currentCoin.gp || 0) - 1)}
                              style={{ width: 36, minHeight: 44, background: pal.accentDim, border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}
                            >−</button>
                            <input
                              type="number"
                              value={currentCoin.gp || 0}
                              onChange={(e) => patchCoin("gp", parseInt(e.target.value, 10) || 0)}
                              style={{ width: 90, textAlign: "center", fontFamily: pal.fontDisplay, fontSize: 26, color: pal.gem, background: pal.surface, border: "none", outline: "none", padding: "0 4px" }}
                            />
                            <button
                              onClick={() => patchCoin("gp", (currentCoin.gp || 0) + 1)}
                              style={{ width: 36, minHeight: 44, background: pal.accentDim, border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}
                            >+</button>
                          </div>
                          <span style={{ fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted }}>Gold Pieces</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: pal.textMuted, flexShrink: 0 }}>GP</span>
                            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 0, background: `${pal.gem}14`, border: `1px solid ${pal.gem}55`, borderRadius: 12, padding: "3px 10px" }}>
                              <span style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted }}>≈</span>
                              <span style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.gem, marginLeft: 3 }}>{gpEquivalent(currentCoin)}</span>
                              <span style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted, marginLeft: 4 }}>gp</span>
                            </div>
                            <button
                              onClick={() => setFullCoinExpanded((value) => !value)}
                              style={{ width: 24, height: 24, background: "transparent", border: "1px solid transparent", color: pal.textMuted, fontSize: 13, cursor: "pointer", padding: 0, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              {fullCoinExpanded ? "↑" : "↓"}
                            </button>
                          </div>

                          {fullCoinExpanded && (
                            <div className="coin-full-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 14 }}>
                              {["cp", "sp", "ep", "gp", "pp"].map((denom) => {
                                const color = COIN_COLORS[denom];
                                const val = currentCoin[denom] || 0;
                                return (
                                  <div key={denom} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${color}18`, border: `1.5px solid ${color}80`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <span style={{ fontFamily: pal.fontDisplay, fontSize: 10, color }}>{DENOM_SHORT[denom]}</span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", border: `1px solid ${pal.border}`, borderRadius: 4, overflow: "hidden", width: "100%" }}>
                                      <button
                                        onClick={() => patchCoin(denom, val + 1)}
                                        style={{ width: "100%", height: 22, background: pal.accentDim, border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}
                                      >▲</button>
                                      <input
                                        type="number"
                                        value={val}
                                        onChange={(e) => patchCoin(denom, parseInt(e.target.value, 10) || 0)}
                                        style={{ width: "100%", textAlign: "center", fontFamily: pal.fontDisplay, fontSize: 20, color: (denom === "gp" || denom === "pp") ? color : pal.text, background: pal.surface, border: "none", outline: "none", padding: "2px 0" }}
                                      />
                                      <button
                                        onClick={() => patchCoin(denom, val - 1)}
                                        style={{ width: "100%", height: 22, background: pal.accentDim, border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}
                                      >▼</button>
                                    </div>
                                    <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color }}>{DENOM_LABELS[denom]}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {(char.levelingMode || "milestone") === "xp" && (() => {
                  const level = char.level || 1;
                  const xp = char.xpCurrent || 0;
                  const nextThreshold = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[20];
                  const currentThreshold = XP_THRESHOLDS[level] ?? 0;
                  const isMaxLevel = level >= 20;
                  const isReadyToLevelUp = !isMaxLevel && xp >= nextThreshold;
                  const progress = isMaxLevel ? 1 : Math.min(1, Math.max(0, (xp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)));
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderTop: `1px solid ${pal.border}`, marginTop: 18 }}>
                      <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: pal.textMuted, flexShrink: 0 }}>XP</span>
                      <div style={{ flex: 1, height: 4, background: `${pal.accent}20`, borderRadius: 2, overflow: "hidden", minWidth: 0 }}>
                        <div style={{ height: "100%", width: `${progress * 100}%`, background: isReadyToLevelUp ? pal.gem : pal.accent, borderRadius: 2, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                        <span style={{ color: pal.gem }}>{xp.toLocaleString()}</span>
                        <span style={{ color: pal.textMuted, margin: "0 3px" }}>/</span>
                        <span style={{ color: pal.textMuted }}>{isMaxLevel ? "Max Level" : formatXpThreshold(nextThreshold)}</span>
                      </div>
                      {isReadyToLevelUp ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${pal.gem}18`, border: `1px solid ${pal.gem}`, borderRadius: 3, padding: "3px 9px", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.gem, animation: "xpLevelupPulse 2.4s ease-in-out infinite", flexShrink: 0 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: pal.gem, display: "inline-block" }} />
                          Ready
                        </div>
                      ) : (
                        <button onClick={() => setXpAwardOpen((value) => !value)} style={{ width: 24, height: 24, borderRadius: "50%", background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted, fontSize: 16, cursor: "pointer", flexShrink: 0, padding: 0, lineHeight: 1 }}>+</button>
                      )}
                    </div>
                  );
                })()}

                {xpAwardOpen && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <input
                      type="number"
                      min={1}
                      value={xpAwardValue}
                      onChange={(e) => setXpAwardValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const delta = Math.max(0, parseInt(xpAwardValue, 10) || 0);
                        if (!delta) return;
                        const prev = char.xpCurrent || 0;
                        const xpCurrent = prev + delta;
                        setChar((current) => ({ ...current, xpCurrent }));
                        applySessionPatch({ xpCurrent }, { xpCurrent: prev }).catch(() => {});
                        setXpAwardOpen(false);
                      }}
                      style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "5px 8px", outline: "none", width: 88, textAlign: "center" }}
                    />
                    <button
                      onClick={() => {
                        const delta = Math.max(0, parseInt(xpAwardValue, 10) || 0);
                        if (!delta) return;
                        const prev = char.xpCurrent || 0;
                        const xpCurrent = prev + delta;
                        setChar((current) => ({ ...current, xpCurrent }));
                        applySessionPatch({ xpCurrent }, { xpCurrent: prev }).catch(() => {});
                        setXpAwardOpen(false);
                      }}
                      style={{ background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px", cursor: "pointer" }}
                    >
                      Add XP
                    </button>
                    <button
                      onClick={() => setXpAwardOpen(false)}
                      style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                </>
              )}

              {combatTab === "persona" && (
                <>
                  <div style={{ marginBottom: 4 }}>
                    <div style={secHead}>Skills, Spells & Special Abilities</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {talentGroups.map((group) => (
                        <div key={group.label}>
                          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 6 }}>
                            {group.label}
                          </div>
                          {group.items.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {group.items.map((item) => (
                                <InfoBadge
                                  key={item.key}
                                  pal={pal}
                                  label={item.label}
                                  tooltip={`${group.singular}: ${item.label}`}
                                  color={group.color}
                                  background={group.bg}
                                  border={group.border}
                                />
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>
                              None listed.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {(char.inPlay || []).length > 0 && hasPersonaBadgeContent && <HR color={pal.border} />}

                  {(char.inPlay || []).length > 0 ? (
                    <ul style={{ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0 28px" }}>
                      {char.inPlay.map((item, index) => (
                        <li key={index} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: `1px solid ${pal.border}`, fontFamily: pal.fontBody, fontSize: 16, lineHeight: 1.5, color: pal.textBody }}>
                          <span style={{ color: pal.accentDim, fontSize: 7, marginTop: 5, flexShrink: 0 }}>◆</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.textMuted, fontStyle: "italic" }}>
                      No persona traits yet. Add them in edit mode under Persona Traits.
                    </div>
                  )}
                </>
              )}

              {combatTab === "combat" && (
                <div style={{ border: isActiveTurn ? `1px solid ${pal.accent}` : "1px solid transparent", borderRadius: 8, padding: isActiveTurn ? "14px 14px 10px" : 0, background: isActiveTurn ? `${pal.accent}10` : "transparent", boxShadow: isActiveTurn ? `0 0 0 1px ${pal.accent}22, 0 0 18px ${pal.accent}22` : "none", transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s" }}>
                  {isActiveTurn && (
                    <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 5, background: pal.accentDim, border: `1px solid ${pal.accent}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: pal.accentBright, marginBottom: 2 }}>Your Turn</div>
                        <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody }}>You are the active combatant in initiative.</div>
                      </div>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: pal.accentBright, boxShadow: `0 0 10px ${pal.accentBright}`, flexShrink: 0 }} />
                    </div>
                  )}

                  {char.concentration?.active && (
                    <div style={{ background: `rgba(${pal.name === "Vellum" ? "140,110,70" : "160,104,64"},0.10)`, border: `1px solid ${pal.accent}`, borderRadius: 4, padding: "11px 16px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 9, height: 9, borderRadius: "50%", background: pal.accentBright, boxShadow: `0 0 6px ${pal.accentBright}`, flexShrink: 0 }} />
                        <div>
                          <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: pal.textMuted, display: "block", marginBottom: 1 }}>Concentrating on</span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 15, color: pal.accentBright }}>{char.concentration.spell}</span>
                        </div>
                      </div>
                      {slug && (
                        <button onClick={() => {
                          const prev = char.concentration;
                          const concentration = { active: false, spell: "" };
                          setChar((current) => ({ ...current, concentration }));
                          applySessionPatch({ concentration }, { concentration: prev }).catch(() => {});
                        }} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                          Drop Concentration
                        </button>
                      )}
                    </div>
                  )}

                  {slug && !char.concentration?.active && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                      <input type="text" placeholder="Spell name…" value={concSpellInput} onChange={(e) => setConcSpellInput(e.target.value)} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "6px 10px", outline: "none", flex: 1 }} onKeyDown={(e) => {
                        if (e.key === "Enter" && concSpellInput.trim()) {
                          const prev = char.concentration;
                          const concentration = { active: true, spell: concSpellInput.trim() };
                          setChar((current) => ({ ...current, concentration }));
                          applySessionPatch({ concentration }, { concentration: prev }).catch(() => {});
                          setConcSpellInput("");
                        }
                      }} />
                      <button onClick={() => {
                        if (!concSpellInput.trim()) return;
                        const prev = char.concentration;
                        const concentration = { active: true, spell: concSpellInput.trim() };
                        setChar((current) => ({ ...current, concentration }));
                        applySessionPatch({ concentration }, { concentration: prev }).catch(() => {});
                        setConcSpellInput("");
                      }} style={{ background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 12px", cursor: "pointer", opacity: concSpellInput.trim() ? 1 : 0.5 }}>
                        Set Concentration
                      </button>
                    </div>
                  )}

                  {hpMax > 0 && (
                    <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "16px 18px", marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        {slug && (
                          <button onClick={() => {
                            const delta = -1;
                            const newVal = Math.max(0, hpCurrent + delta);
                            if (newVal === hpCurrent) return;
                            hpPendingDelta.current += delta;
                            markSessionExpected({ hpCurrent: newVal });
                            setChar((current) => ({ ...current, hpCurrent: newVal }));
                            hpFlushRef.current?.();
                          }} style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: pal.accentDim, border: `1px solid ${pal.accent}`, color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 24, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        )}
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                            {hpEditMode ? (
                              <input type="number" autoFocus defaultValue={hpCurrent} style={{ fontFamily: pal.fontDisplay, fontSize: 40, color: pal.gem, lineHeight: 1, background: pal.surface, border: `1px solid ${pal.accent}`, borderRadius: 3, width: 80, textAlign: "center", outline: "none", padding: "0 4px" }} onBlur={(e) => {
                                const value = Math.max(0, Math.min(hpMax, parseInt(e.target.value, 10) || 0));
                                const prev = hpCurrent;
                                setChar((current) => ({ ...current, hpCurrent: value }));
                                applySessionPatch({ hpCurrent: value }, { hpCurrent: prev }).catch(() => {});
                                setHpEditMode(false);
                              }} onKeyDown={(e) => {
                                if (e.key === "Enter") e.target.blur();
                                if (e.key === "Escape") setHpEditMode(false);
                              }} />
                            ) : (
                              <span onClick={() => slug && setHpEditMode(true)} title={slug ? "Tap to set HP directly" : undefined} style={{ fontFamily: pal.fontDisplay, fontSize: 48, color: pal.gem, lineHeight: 1, cursor: slug ? "pointer" : "default" }}>{hpCurrent}</span>
                            )}
                            <span style={{ fontFamily: pal.fontDisplay, fontSize: 24, color: pal.textMuted, lineHeight: 1 }}>/</span>
                            <span style={{ fontFamily: pal.fontDisplay, fontSize: 32, color: pal.accent, lineHeight: 1 }}>{hpMax}</span>
                          </div>
                          <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginTop: 3 }}>Hit Points</div>
                          {tempHP > 0 && <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.accentBright, letterSpacing: "0.08em", marginTop: 2 }}>+{tempHP} temp</div>}
                        </div>
                        {slug && (
                          <button onClick={() => {
                            const delta = 1;
                            const newVal = Math.min(hpMax, hpCurrent + delta);
                            if (newVal === hpCurrent) return;
                            hpPendingDelta.current += delta;
                            markSessionExpected({ hpCurrent: newVal });
                            setChar((current) => ({ ...current, hpCurrent: newVal }));
                            hpFlushRef.current?.();
                          }} style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: pal.accentDim, border: `1px solid ${pal.accent}`, color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 24, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        )}
                      </div>
                      <div style={{ width: "100%", height: 5, borderRadius: 3, background: pal.border, marginTop: 12, overflow: "hidden" }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%`, height: "100%", borderRadius: 3, background: hpBarColor, transition: "width 0.25s, background-color 0.25s" }} />
                      </div>
                      {slug && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                          <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, flexShrink: 0 }}>Temp HP</span>
                          <input type="number" min={0} value={tempHP} onChange={(e) => {
                            const value = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setChar((current) => ({ ...current, tempHP: value }));
                            markSessionExpected({ tempHP: value });
                            tempHpFlushRef.current?.();
                          }} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "4px 8px", outline: "none", width: 72, textAlign: "center" }} />
                        </div>
                      )}
                      {hpCurrent === 0 && hpMax > 0 && (
                        <div style={{ marginTop: 14, borderTop: `1px solid ${pal.border}`, paddingTop: 12 }}>
                          <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8, textAlign: "center" }}>Death Saves</div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 6 }}>
                            <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: pal.gem, textTransform: "uppercase", minWidth: 54, textAlign: "right" }}>Success</span>
                            {[0, 1, 2].map((value) => <div key={value} style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${pal.gem}`, background: "transparent" }} />)}
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: "#c06060", textTransform: "uppercase", minWidth: 54, textAlign: "right" }}>Failure</span>
                            {[0, 1, 2].map((value) => <div key={value} style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid #c06060", background: "transparent" }} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hit Dice Tracker */}
                  <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "12px 16px", marginBottom: 18 }}>
                    <HitDiceTracker char={char} slug={slug} applySessionPatch={applySessionPatch} setChar={setChar} pal={pal} />
                  </div>

                  <button onClick={() => {
                    if (!slug) return;
                    const inspiration = !char.inspiration;
                    setChar((current) => ({ ...current, inspiration }));
                    applySessionPatch({ inspiration }, { inspiration: !inspiration }).catch(() => {});
                  }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", width: "100%", textAlign: "left", background: char.inspiration ? `${pal.gem}18` : "transparent", border: `1px solid ${char.inspiration ? pal.gem : pal.border}`, borderRadius: 4, marginBottom: 18, cursor: slug ? "pointer" : "default", transition: "background 0.15s, border-color 0.15s" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: char.inspiration ? pal.gem : "transparent", border: `2px solid ${char.inspiration ? pal.gem : pal.border}`, boxShadow: char.inspiration ? `0 0 8px ${pal.gem}88, 0 0 18px ${pal.gem}33` : "none", flexShrink: 0, transition: "all 0.18s" }} />
                    <span style={{ fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: char.inspiration ? pal.accentBright : pal.textMuted }}>Inspiration</span>
                    {char.inspiration && <span style={{ marginLeft: "auto", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.gem, background: `${pal.gem}1a`, border: `1px solid ${pal.gem}55`, borderRadius: 10, padding: "2px 10px" }}>Active</span>}
                  </button>

                  <div style={{ borderTop: `1px solid ${pal.border}`, margin: "4px 0 20px" }} />
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 10 }}>Conditions</div>
                    {(() => {
                      const activeConditions = char.conditions || [];
                      const exhaustionLevel = char.exhaustionLevel || 0;
                      const activeChips = [
                        ...activeConditions.map((condition) => ({ key: condition, label: condition, type: "condition" })),
                        ...(exhaustionLevel > 0 ? [{ key: "exhausted", label: "Exhausted", type: "exhaustion" }] : []),
                      ];
                      const inactiveConditions = CONDITIONS.filter((condition) => !activeConditions.includes(condition));

                      return (
                        <>
                          {activeChips.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                              {activeChips.map((chip) => {
                                const color = chip.type === "exhaustion" ? "#c09040" : conditionColorFor(chip.label);
                                return (
                                  <div key={chip.key} style={{ display: "inline-flex", alignItems: "center", padding: "5px 14px", borderRadius: 14, fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", background: `${color}26`, border: `1px solid ${color}b3`, color }}>
                                    <span>{chip.label}</span>
                                    {slug && (
                                      <button
                                        onClick={() => {
                                          if (chip.type === "exhaustion") {
                                            const prevExhaustion = exhaustionLevel;
                                            setChar((current) => ({ ...current, exhaustionLevel: 0 }));
                                            applySessionPatch({ exhaustionLevel: 0 }, { exhaustionLevel: prevExhaustion }).catch(() => {});
                                            return;
                                          }
                                          const prevConds = activeConditions;
                                          const conditions = prevConds.filter((value) => value !== chip.label);
                                          setChar((current) => ({ ...current, conditions }));
                                          applySessionPatch({ conditions }, { conditions: prevConds }).catch(() => {});
                                        }}
                                        style={{ background: "transparent", border: "none", color: pal.textMuted, fontSize: 14, marginLeft: 8, cursor: "pointer", lineHeight: 1, padding: 0 }}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {slug && (
                            <>
                              <button
                                onClick={() => setConditionPickerOpen((value) => !value)}
                                style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 14, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", padding: "4px 14px", cursor: "pointer", marginBottom: conditionPickerOpen && inactiveConditions.length > 0 ? 10 : 0 }}
                              >
                                ＋ Add Condition
                              </button>

                              {conditionPickerOpen && inactiveConditions.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 0, marginBottom: 12, padding: "12px 14px", background: "rgba(0,0,0,0.18)", borderRadius: 6, border: `1px solid ${pal.border}` }}>
                                  {inactiveConditions.map((condition) => (
                                    <button
                                      key={condition}
                                      onClick={() => {
                                        const prevConds = activeConditions;
                                        const conditions = [...prevConds, condition];
                                        setChar((current) => ({ ...current, conditions }));
                                        applySessionPatch({ conditions }, { conditions: prevConds }).catch(() => {});
                                        setConditionPickerOpen(false);
                                      }}
                                      style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 12px", borderRadius: 14, background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted, cursor: "pointer" }}
                                    >
                                      {condition}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()}

                    {slug && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: pal.textMuted }}>Exhaustion</span>
                        <button onClick={() => {
                          const delta = -1;
                          const value = Math.max(0, (char.exhaustionLevel || 0) + delta);
                          if (value === (char.exhaustionLevel || 0)) return;
                          exhPendingDelta.current += delta;
                          markSessionExpected({ exhaustionLevel: value });
                          setChar((current) => ({ ...current, exhaustionLevel: value }));
                          exhFlushRef.current?.();
                        }} style={{ width: 26, height: 26, borderRadius: "50%", background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: (char.exhaustionLevel || 0) > 0 ? pal.gem : pal.textMuted, minWidth: 20, textAlign: "center" }}>{char.exhaustionLevel || 0}</span>
                        <button onClick={() => {
                          const delta = 1;
                          const value = Math.min(6, (char.exhaustionLevel || 0) + delta);
                          if (value === (char.exhaustionLevel || 0)) return;
                          exhPendingDelta.current += delta;
                          markSessionExpected({ exhaustionLevel: value });
                          setChar((current) => ({ ...current, exhaustionLevel: value }));
                          exhFlushRef.current?.();
                        }} style={{ width: 26, height: 26, borderRadius: "50%", background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    )}

                    {slug && (((char.conditions || []).length > 0) || (char.exhaustionLevel || 0) > 0) && (
                      <button onClick={() => {
                        const prevConds = char.conditions || [];
                        const prevExhaustion = char.exhaustionLevel || 0;
                        setChar((current) => ({ ...current, conditions: [], exhaustionLevel: 0 }));
                        applySessionPatch({ conditions: [], exhaustionLevel: 0 }, { conditions: prevConds, exhaustionLevel: prevExhaustion }).catch(() => {});
                      }} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 14px", cursor: "pointer" }}>
                        Clear All Conditions
                      </button>
                    )}
                  </div>

                  {(() => {
                    const activeSlots = (char.spellSlots || []).filter((slot) => slot.max > 0);
                    if (activeSlots.length === 0) return null;
                    return (
                      <>
                        <div style={{ borderTop: `1px solid ${pal.border}`, margin: "4px 0 20px" }} />
                        <div>
                          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 12 }}>Spell Slots</div>
                          {activeSlots.map((slot) => (
                            <div key={slot.level} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted, minWidth: 32 }}>{SPELL_LEVEL_LABELS[slot.level - 1]}</div>
                              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                {Array.from({ length: slot.max }, (_, index) => {
                                  const isUsed = index < (slot.used || 0);
                                  return (
                                    <div key={index} onClick={() => {
                                      if (!slug) return;
                                      const prevSlots = char.spellSlots || [];
                                      const used = isUsed ? Math.max(0, slot.used - 1) : Math.min(slot.max, (slot.used || 0) + 1);
                                      const spellSlots = prevSlots.map((entry) => entry.level === slot.level ? { ...entry, used } : entry);
                                      setChar((current) => ({ ...current, spellSlots }));
                                      applySessionPatch({ spellSlots }, { spellSlots: prevSlots }).catch(() => {});
                                    }} style={{ width: 20, height: 20, borderRadius: "50%", background: isUsed ? pal.accentDim : pal.gem, border: `1px solid ${isUsed ? pal.border : pal.accent}`, cursor: slug ? "pointer" : "default", padding: 6, boxSizing: "content-box", transition: "background 0.15s", flexShrink: 0 }} />
                                  );
                                })}
                              </div>
                              {slot.isPactMagic && <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: pal.accent, textTransform: "uppercase" }}>Pact</span>}
                            </div>
                          ))}
                          {slug && (
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={() => {
                                if (window.confirm("Long rest — reset all spell slots and restore Hit Dice?")) {
                                  const prevSlots = char.spellSlots || [];
                                  const spellSlots = prevSlots.map((slot) => ({ ...slot, used: 0 }));
                                  const level = char.level || 1;
                                  const hdCurrent = char.hitDiceCurrent ?? level;
                                  const hdRestore = Math.max(1, Math.floor(level / 2));
                                  const hitDiceCurrent = Math.min(level, hdCurrent + hdRestore);
                                  setChar((current) => ({ ...current, spellSlots, hitDiceCurrent }));
                                  applySessionPatch({ spellSlots, hitDiceCurrent }, { spellSlots: prevSlots, hitDiceCurrent: hdCurrent }).catch(() => {});
                                }
                              }} style={{ background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer" }}>Long Rest</button>
                              <button onClick={() => {
                                if (window.confirm("Short rest — reset Pact Magic slots?")) {
                                  const prevSlots = char.spellSlots || [];
                                  const spellSlots = prevSlots.map((slot) => slot.isPactMagic ? { ...slot, used: 0 } : slot);
                                  setChar((current) => ({ ...current, spellSlots }));
                                  applySessionPatch({ spellSlots }, { spellSlots: prevSlots }).catch(() => {});
                                }
                              }} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer" }}>Short Rest</button>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {(char.weapons || []).length > 0 && (
                    <>
                      <div style={{ borderTop: `1px solid ${pal.border}`, margin: "20px 0" }} />
                      <div>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 12 }}>Weapons</div>
                        {char.weapons.map((item) => {
                          const expanded = expandedItems.has(item.id + "-combat");
                          const attackMod = item.mods?.find((mod) => mod.attribute === "Attack Bonus");
                          const damageMod = item.mods?.find((mod) => mod.attribute === "Damage");
                          return (
                            <div key={item.id} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, marginBottom: 6, overflow: "hidden", transition: "border-color 0.15s" }}>
                              <div onClick={() => {
                                const next = new Set(expandedItems);
                                const key = item.id + "-combat";
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                setExpandedItems(next);
                              }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", userSelect: "none" }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text, flex: 1 }}>{item.name}</span>
                                {attackMod && <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", color: pal.textMuted, whiteSpace: "nowrap" }}>To-hit <span style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.accentBright }}>{attackMod.value}</span></span>}
                                {damageMod && <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", color: pal.textMuted, whiteSpace: "nowrap", marginLeft: 4 }}>Dmg <span style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.accentBright }}>{damageMod.value}</span></span>}
                                <span style={{ color: pal.textMuted, fontSize: 11, flexShrink: 0 }}>{expanded ? "▼" : "▶"}</span>
                              </div>
                              {expanded && item.description && <div style={{ padding: "10px 14px 12px", fontFamily: pal.fontBody, fontSize: 14, fontStyle: "italic", color: pal.textBody, borderTop: `1px solid ${pal.border}`, lineHeight: 1.55 }}>{item.description}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {!(char.hpMax ?? char.hp ?? 0) && !(char.spellSlots || []).length && !(char.weapons || []).length && (
                    <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.textMuted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
                      Set up your character stats in edit mode to use in-session tracking.
                    </div>
                  )}

                  {slug && <SessionNotesSection char={char} setChar={setChar} applySessionPatch={applySessionPatch} pal={pal} />}

                  <DiceRoller weapons={char.weapons || []} stats={char.stats || []} pal={pal} slug={slug} />
                </div>
              )}

              {combatTab === "map" && (
                <div>
                  {activeMap ? (
                    <>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 10 }}>{activeMap.name || "Active Map"}</div>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                        <button
                          onClick={() => window.open(`/map-view?theme=${encodeURIComponent((char.palette || "ocean").toLowerCase())}`, "_blank", "noopener,noreferrer")}
                          style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = pal.accentBright; e.currentTarget.style.borderColor = pal.accent; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.borderColor = pal.border; }}
                        >
                          Open Window
                        </button>
                      </div>
                      <style>{`@media (max-width: 560px) { .map-viewer-mobile { height: calc(100vh - 160px) !important; } }`}</style>
                      <div className="map-viewer-mobile" style={{ height: 500 }}>
                        <MapViewer
                          imageUrl={activeMap.imageUrl}
                          name={activeMap.name}
                          contentType={activeMap.contentType}
                          height={500}
                          pal={pal}
                          publishedView={activeMapView}
                          allowResetToPublished={!!activeMapView}
                          resetLabel="Current View"
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: "48px 0", textAlign: "center" }}>
                      <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.textMuted, fontStyle: "italic" }}>The DM hasn&apos;t loaded a map yet.</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 36 }}>
              {char.collections.map((collection) => {
                if (!collection.sections.length) return null;
                return (
                  <div key={collection.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.22em", color: pal.accentDim, textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>
                      {collection.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                      {collection.sections.map((section) => {
                        const isCurrent = active?.collectionId === collection.id && active?.sectionId === section.id;
                        return (
                          <button key={section.id} onClick={() => setActive({ collectionId: collection.id, sectionId: section.id })} style={navBtn(isCurrent)}>
                            {section.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeSec && (
              <div>
                <h2 style={{ fontFamily: pal.fontDisplay, fontWeight: 400, fontSize: 14, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accent, marginBottom: 28 }}>{activeSec.title}</h2>
                {activeSec.type === "list" ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {(activeSec.items || []).map((item, index) => (
                      <li key={index} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: `1px solid ${pal.border}`, fontFamily: pal.fontBody, fontSize: 16, lineHeight: 1.6, color: pal.textBody }}>
                        <span style={{ color: pal.accent, marginTop: 5, fontSize: 10, flexShrink: 0 }}>◆</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    {(activeSec.content || "").split("\n\n").filter(Boolean).map((para, index) => (
                      <p key={index} style={{ fontFamily: pal.fontBody, fontSize: 18, lineHeight: 1.9, color: pal.textBody, marginBottom: 22, textAlign: "justify" }}>
                        {renderInline(para.trim())}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          slug && (
            <div style={{ textAlign: "center", padding: "40px 0 20px", borderTop: `1px solid ${pal.border}` }}>
              {unlockChecking || unlockLoading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, color: pal.textMuted }}>
                  <div className="dnd-spinner" style={{ borderTopColor: pal.textMuted }} />
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 16 }}>
                    Full sheet is private
                  </div>
                  <button onClick={handleViewUnlock} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", padding: "8px 20px", cursor: "pointer" }}>
                    🔒 Unlock with password
                  </button>
                </>
              )}
            </div>
          )
        )}

        <footer style={{ marginTop: 64, paddingTop: 26, borderTop: `1px solid ${pal.border}`, textAlign: "center", fontFamily: pal.fontUI, fontStyle: "italic", fontSize: 14, color: pal.textMuted, letterSpacing: "0.1em", lineHeight: 1.8 }}>
          {char.name && <>{char.name}{char.nameAlt ? ` · ${char.nameAlt}` : ""}{" · "}{char.race} {char.charClass}{char.level ? ` · Level ${char.level}` : ""}</>}
        </footer>

        {editingItem && (
          <ItemEditorModal
            item={editingItem.item}
            pal={pal}
            showType={editingItem.showType}
            onSave={(saved) => {
              let updatedChar = char;
              if (editingItem.item) {
                if (editingItem.listType === "weapons") {
                  updateWeapon(saved.id, saved);
                  updatedChar = { ...char, weapons: (char.weapons || []).map((weapon) => weapon.id === saved.id ? saved : weapon) };
                } else {
                  updateEquipment(saved.id, saved);
                  updatedChar = { ...char, equipment: (char.equipment || []).map((item) => item.id === saved.id ? saved : item) };
                }
              } else if (editingItem.listType === "weapons") {
                addWeapon(saved);
                updatedChar = { ...char, weapons: [...(char.weapons || []), saved] };
              } else {
                addEquipment(saved);
                updatedChar = { ...char, equipment: [...(char.equipment || []), saved] };
              }

              if (slug) {
                applySessionPatch({ [editingItem.listType]: updatedChar[editingItem.listType] }, { [editingItem.listType]: char[editingItem.listType] }).catch(() => {});
              } else if (onSave) {
                onSave(updatedChar);
              }
              setEditingItem(null);
            }}
            onClose={() => setEditingItem(null)}
          />
        )}
      </div>
    </div>
  );
}
