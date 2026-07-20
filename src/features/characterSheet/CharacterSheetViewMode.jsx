import { useState, useRef, useCallback, useEffect } from "react";
import { useHoldToRepeat } from "../../lib/useHoldToRepeat";
import { Link } from "react-router-dom";
import DiceRoller from "../../components/DiceRoller";
import TopNav from "../../components/TopNav";
import { InfoBadge } from "./CharacterTalents";
import ItemEditorModal, { itemTypeLabel } from "./ItemEditorModal";
import { HR } from "./CharacterSheetPrimitives";
import { ARMOR_OPTIONS, CONDITIONS, SPELL_LEVEL_LABELS, HIT_DIE_BY_CLASS, XP_THRESHOLDS, COIN_COLORS, fmtMod, modOf, parseModInt } from "./constants";
import { renderInline } from "./theme";
import MapViewer from "../maps/MapViewer";
import WorldGuideDrawer from "../worldGuide/WorldGuideDrawer";
import "./characterSheet.css";

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
      <div style={{ marginBottom: 0 }}>
        {isFull ? (
          // FULL STATE — compact single line
          <div className="cs-hd-full-row">
            <span className="cs-hd-full-gem">◆</span>
            <span className="cs-hd-full-label">Hit Dice</span>
            <span className="cs-hd-full-count">{level}</span>
            <span className="cs-hd-full-size">d{dieSize}</span>
            <span className="cs-hd-full-badge">Full</span>
            {slug && (
              <button onClick={openModal} className="cs-hd-spend-btn">Spend</button>
            )}
          </div>
        ) : (
          // DEPLETED STATE — expanded tracker
          <div>
            <div className="cs-hd-dep-header">
              <span className="cs-hd-dep-label">Hit Dice</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 28, lineHeight: 1, color: countColor, opacity: isEmpty ? 0.6 : 1 }}>{hdCurrent}</span>
                <span style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted }}>/</span>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: pal.textMuted, lineHeight: 1 }}>{level}</span>
                <span style={{ fontFamily: pal.fontUI, fontSize: 13, color: pal.textMuted, letterSpacing: "0.06em", marginLeft: 4 }}>d{dieSize}</span>
              </div>
            </div>

            {isLow && !isEmpty && (
              <div className="cs-hd-low-warning">
                ◈ {hdCurrent} of {level} Hit Dice remaining
              </div>
            )}

            <div className="cs-hd-pip-grid">
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
              <div className="cs-hd-spend-row" style={{ opacity: isEmpty ? 0.45 : 1, pointerEvents: isEmpty ? "none" : "auto" }}>
                <span className="cs-hd-spend-label">Spend</span>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${pal.border}`, borderRadius: 3, overflow: "hidden" }}>
                  <button onClick={() => !isEmpty && applyHdDelta(-1)} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 18, width: 32, height: 32, cursor: isEmpty ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>−</button>
                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color: pal.text, minWidth: 28, textAlign: "center", padding: "0 4px", borderLeft: `1px solid ${pal.border}`, borderRight: `1px solid ${pal.border}` }}>1</span>
                  <button onClick={() => !isEmpty && openModal()} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 18, width: 32, height: 32, cursor: isEmpty ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>+</button>
                </div>
                {!isEmpty && (
                  <span className="cs-hd-roll-preview">
                    Roll <span className="cs-hd-roll-dice">1d{dieSize}{conMod >= 0 ? `+${conMod}` : conMod}</span>
                    <span className="cs-hd-roll-range">({1 + conMod}–{dieSize + conMod})</span>
                  </span>
                )}
                {isEmpty && <span className="cs-hd-empty-note">No dice remaining</span>}
                <button onClick={openModal} className="cs-hd-spend-action-btn">Spend</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spend Modal */}
      {showModal && (
        <div className="cs-hd-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="cs-hd-modal-panel">
            <div className="cs-hd-modal-title">Spend Hit Dice</div>
            <div className="cs-hd-modal-subtitle">Short Rest — roll and add your CON modifier</div>

            <div className="cs-hd-modal-die">
              <span className="cs-hd-modal-die-label">d{dieSize}</span>
              <span className="cs-hd-modal-die-avail">{hdCurrent} {hdCurrent === 1 ? "die" : "dice"} available</span>
            </div>

            <div className="cs-hd-modal-count-row">
              <span className="cs-hd-modal-count-label">Dice to spend</span>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${pal.border}`, borderRadius: 3, overflow: "hidden" }}>
                <button onClick={() => setModalCount((n) => Math.max(1, n - 1))} disabled={modalCount <= 1} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 22, width: 40, height: 40, cursor: modalCount <= 1 ? "default" : "pointer", opacity: modalCount <= 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 24, color: pal.text, minWidth: 44, textAlign: "center", padding: "0 6px", borderLeft: `1px solid ${pal.border}`, borderRight: `1px solid ${pal.border}` }}>{modalCount}</span>
                <button onClick={() => setModalCount((n) => Math.min(hdCurrent, n + 1))} disabled={modalCount >= hdCurrent} style={{ background: "transparent", border: "none", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 22, width: 40, height: 40, cursor: modalCount >= hdCurrent ? "default" : "pointer", opacity: modalCount >= hdCurrent ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>

            <div className="cs-hd-modal-recovery" style={{ background: `${pal.accent}14` }}>
              <span className="cs-hd-modal-recovery-label">Expected HP Recovery</span>
              <span className="cs-hd-modal-recovery-range">{modalCount * (1 + conMod)} – {modalCount * (dieSize + conMod)}</span>
              <span className="cs-hd-modal-recovery-note">{modalCount}d{dieSize} + {modalCount * conMod} (CON mod ×{modalCount})</span>
            </div>

            <div className="cs-hd-modal-actions">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={() => confirmSpend(modalCount)} className="cs-hd-spend-action-btn">Spend {modalCount} {modalCount === 1 ? "Die" : "Dice"}</button>
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
    <div className="cs-notes-section">
      <div className="cs-notes-heading">
        <span className="cs-notes-heading-label">Session Notes</span>
        <div className="cs-notes-divider" />
      </div>

      {notes.length > 0 && (
        <ul className="cs-notes-list">
          {notes.map((note, idx) => (
            <li key={note.id} className="cs-note-item" style={{ borderBottom: idx < notes.length - 1 ? `1px solid ${pal.border}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div className="cs-note-text">{note.text}</div>
                <button
                  onClick={() => handleToggleShare(note.id)}
                  className="cs-note-share-btn"
                  style={{ color: note.sharedWithDm ? pal.gem : pal.textMuted }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${note.sharedWithDm ? pal.gem : pal.textMuted}`, background: note.sharedWithDm ? pal.gem : "transparent", display: "inline-block", transition: "background 0.15s, border-color 0.15s", flexShrink: 0 }} />
                  {note.sharedWithDm ? "Shared with DM" : "Private"}
                </button>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                className="cs-note-delete-btn"
                title="Delete note"
              >×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="cs-note-input-row">
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
          className="cs-note-add-btn"
          style={{ background: `rgba(18,58,78,0.5)` }}
        >+ Add</button>
      </div>
      <div className="cs-notes-hint">Private by default. Tap "Private" to share a note with the DM.</div>
    </div>
  );
}

export default function CharacterSheetViewMode({ ctx }) {
  const [guideOpen, setGuideOpen] = useState(false);
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
      <WorldGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} pal={pal} />

      <div aria-hidden="true" className="cs-bg-glow" style={{
        background: `
          radial-gradient(ellipse at 18% 45%, ${pal.glow1} 0%, transparent 55%),
          radial-gradient(ellipse at 82% 18%, ${pal.glow2} 0%, transparent 48%),
          radial-gradient(ellipse at 50% 90%, ${pal.glow2} 0%, transparent 45%)
        `,
      }} />

      <TopNav
        backTo="/"
        title={char?.name || "Character"}
        showLive={false}
        onBookClick={() => setGuideOpen((o) => !o)}
        bookOpen={guideOpen}
        menuItems={[
          { label: "Export JSON", onClick: exportJSON },
          { label: "All Characters", href: "/" },
          ...(slug ? [{ label: "⚔ Session", href: `/characters/${slug}/session` }] : []),
        ]}
      >
        {/* Edit Character stays in right slot until Story 42 moves it to page body */}
        <button onClick={handleEditClick} disabled={unlockLoading || unlockChecking} className="cs-toolbar-btn">
          {unlockLoading
            ? <><div className="dnd-spinner" style={{ width: 12, height: 12, borderTopColor: pal.textMuted }} /> Checking…</>
            : unlockState === "unlocked" ? "Edit Character" : "🔒 Edit Character"
          }
        </button>
      </TopNav>

      <div className="cs-content">

        {unlockState === "prompting" && (
          <div className="cs-unlock-overlay">
            <div className="cs-unlock-panel">
              <div className="cs-unlock-heading">
                {unlockIntent === "delete" ? "Unlock to Delete" : "Unlock to Edit"}
              </div>
              <div className="cs-unlock-name">
                {char.name}
              </div>
              <form onSubmit={handleUnlockSubmit}>
                <input type="password" autoFocus placeholder="Enter character password…" value={unlockInput} onChange={(e) => setUnlockInput(e.target.value)} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 16, padding: "9px 13px", width: "100%", outline: "none", marginBottom: 8 }} />
                {unlockError && (
                  <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 14, marginBottom: 12 }}>
                    {unlockError}
                  </div>
                )}
                <div className="cs-unlock-actions">
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

        <header className="cs-header">
          <div className="cs-header-class">
            {char.charClass}{char.subclass ? ` · ${char.subclass}` : ""}
          </div>

          <h1 className="cs-char-name">
            {char.name || "Unnamed"}
          </h1>

          {char.nameAlt && (
            <div className="cs-char-alt-name">
              "{char.nameAlt}"
            </div>
          )}

          {char.pronunciation && (
            <div className="cs-char-pronunciation">
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
              <div key={label} className="cs-detail-cell">
                <div className="cs-detail-label">{label}</div>
                <div className="cs-detail-value">{value}</div>
              </div>
            ))}
          </div>

        </header>

        {(char.portraitUrl || char.portrait) && (
          <div className="cs-portrait-wrap">
            <img src={char.portraitUrl || char.portrait} alt={char.name} className="cs-portrait-img" />
            {char.tagline && (
              <p className="cs-portrait-tagline">
                {char.tagline}
              </p>
            )}
          </div>
        )}

        {unlockState === "unlocked" ? (
          <>
            <div className="cs-stats-panel">
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
                  <div className="cs-vital-row">
                    {(char.hpMax ?? char.hp ?? 0) > 0 && (
                      <div className="cs-vital-cell">
                        <div className="cs-vital-label">Hit Points</div>
                        <div style={{ height: 14 }} />
                        <div className="cs-hp-nums">
                          <span className="cs-hp-current">{hpCurrent}</span>
                          <span className="cs-hp-slash">/</span>
                          <span className="cs-hp-max">{hpMax}</span>
                        </div>
                        <div style={{ height: 18, marginTop: 1 }}>
                          {tempHP > 0 && <div className="cs-hp-temp">+{tempHP} temp</div>}
                        </div>
                        <div style={{ width: "100%", height: 10, marginTop: 0, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 80 }}>
                          {hpMax > 0 && (
                            <div className="cs-hp-bar-track">
                              <div style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%`, height: "100%", borderRadius: 2, background: hpBarColor, transition: "width 0.25s, background-color 0.25s" }} />
                            </div>
                          )}
                        </div>

                        <div style={{ height: 15, marginTop: 2 }}>
                          {hpBonus !== 0 && <div className="cs-hp-bonus-note">{char.hpMax ?? char.hp} base {hpBonus > 0 ? "+" : ""}{hpBonus} item</div>}
                        </div>
                      </div>
                    )}
                    {(armorOpt || char.armorTotal > 0 || acBonus > 0) && (
                      <div className="cs-vital-cell" style={{ position: "relative" }}>
                        <div className="cs-vital-label">Armor</div>
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
                          <div className="flyout cs-armor-flyout">
                            <div className="cs-flyout-header">
                              <div className="cs-flyout-header-label">Armor Class</div>
                              <div style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.accentBright, lineHeight: 1 }}>{effectiveAc}</div>
                            </div>
                            <div className="divider-tight" />
                            {armorBreakdown.map((entry, index) => (
                              <div key={`${entry.label}-${index}`} className="cs-flyout-row" style={{ marginBottom: index < armorBreakdown.length - 1 ? 4 : 0 }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: entry.label === "Base" ? pal.textMuted : pal.textBody, fontStyle: entry.label === "Base" ? "italic" : "normal" }}>{entry.label}</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: entry.value >= 0 ? pal.gem : pal.gemLow }}>{entry.value >= 0 ? `+${entry.value}` : entry.value}</span>
                              </div>
                            ))}
                            <div className="divider-tight" />
                            <div className="cs-flyout-row">
                              <span className="cs-flyout-row-label">Total</span>
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
                  <div className="cs-stats-grid">
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
                        <div key={stat} className="cs-stat-row">
                          <div className="cs-stat-circle-wrap">
                            <div {...circleHandlers} className="cs-stat-circle" style={{ border: `1px solid ${color}55`, background: `${color}14` }}>
                              <div className="cs-stat-score" style={{ color }}>{score}</div>
                            </div>
                            {showBadge && (
                              <div {...circleHandlers} className="cs-stat-badge" style={{ background: color }}>
                                <span className="cs-stat-badge-text" style={{ color: pal.bg }}>{fmtMod(totalMod)}</span>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="cs-stat-name">{stat}</div>
                            <div className="cs-stat-note">{note}</div>
                          </div>

                          {flyoutOpen && (
                            <div className="flyout cs-stat-flyout">
                              <div className="cs-flyout-header">
                                <div className="cs-flyout-header-label">{stat}</div>
                                <div style={{ fontFamily: pal.fontDisplay, fontSize: 22, color, lineHeight: 1 }}>{score}</div>
                              </div>
                              <div className="divider-tight" />
                              <div className="cs-flyout-row" style={{ marginBottom: itemMods.length > 0 ? 4 : 0 }}>
                                <span className="cs-flyout-row-label">Score modifier</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: baseMod >= 0 ? pal.gem : pal.gemLow }}>{fmtMod(baseMod)}</span>
                              </div>
                              {itemMods.map((mod, index) => (
                                <div key={index} className="cs-flyout-row" style={{ marginBottom: index < itemMods.length - 1 ? 4 : 0 }}>
                                  <span className="cs-flyout-row-label-item">{mod.source}</span>
                                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: mod.value >= 0 ? pal.gem : pal.gemLow }}>{fmtMod(mod.value)}</span>
                                </div>
                              ))}
                              <div className="divider-tight" />
                              <div className="cs-flyout-row">
                                <span className="cs-flyout-row-label">Total</span>
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

              <div className="cs-tab-strip">
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
                ].map((tab) => {
                  const isCurrent = combatTab === tab.key;
                  const isDisabled = !!tab.disabled;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => !isDisabled && setTab(tab.key)}
                      className={`cs-tab-btn${isCurrent ? " active" : ""}${isDisabled ? " disabled" : ""}`}
                      style={{
                        background: isCurrent ? pal.accentDim : "transparent",
                        borderColor: isCurrent ? pal.accent : pal.border,
                        color: isCurrent ? pal.accentBright : pal.textMuted,
                      }}
                    >
                      {tab.icon(isCurrent)}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {combatTab === "loadout" && (
                <>
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
                    <div className="cs-attune-banner" style={{ opacity: isEmpty ? 0.45 : 1 }}>
                      <span className="cs-attune-label" style={{ color: isOverLimit ? "#c06060" : pal.textMuted }}>
                        <span style={{ color: isOverLimit ? "#c06060" : pal.accentDim }}>◆</span>
                        Attuned
                      </span>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 2, fontFamily: pal.fontDisplay, fontSize: 14 }}>
                        <span style={{ color: isOverLimit ? "#c06060" : pal.gem }}>{attunedCount}</span>
                        <span style={{ color: pal.textMuted, margin: "0 1px" }}>/</span>
                        <span style={{ color: pal.textMuted }}>3</span>
                      </span>
                      <span className="cs-attune-note" style={{ color: isOverLimit ? "#c06060" : isFull ? pal.accentBright : pal.textMuted }}>
                        · {noteText}
                      </span>
                    </div>
                  );
                })()}

                <div className="loadout-grid">
                  {/* WEAPONS COLUMN */}
                  <div>
                    <div className="cs-col-header">
                      <div className="cs-col-label">Weapons</div>
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
                          <div key={item.id} onClick={() => toggleExpanded(item.id)} className="cs-item-row">
                            <div className="cs-item-row-inner">
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
                              <span className="cs-item-name" style={{ color: nameColor }}>{item.name}</span>
                              {item.mods?.length > 0 && <span className="cs-item-mods">{item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</span>}
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
                              <span className="cs-item-chevron">{expanded ? "▲" : "▼"}</span>
                            </div>
                            {expanded && (
                              <div>
                                {item.description && <div className="cs-item-description">{item.description}</div>}
                                {/* Drop item */}
                                {slug && (
                                  <div className="cs-drop-row" onClick={(e) => e.stopPropagation()}>
                                    {isDropConfirming ? (
                                      <>
                                        <button onClick={confirmDrop} className="cs-drop-confirm-btn">Confirm drop</button>
                                        <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(null); }} className="cs-drop-cancel-btn">Cancel</button>
                                      </>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(item.id); }} className="cs-drop-btn">Drop Item</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="cs-item-empty">No weapons.</div>
                    )}
                  </div>

                  {/* EQUIPMENT COLUMN */}
                  <div>
                    <div className="cs-col-header">
                      <div className="cs-col-label">Equipment</div>
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
                            className="cs-item-row"
                            style={{ cursor: !stepperOpen ? "pointer" : "default" }}
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
                                <span className="cs-item-name" style={{ color: nameColor }}>{item.name}</span>
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
                                  className="cs-potion-btn"
                                >Use</button>
                              )}
                              {!stepperOpen && item.type && <span className="cs-item-type-chip">{itemTypeLabel(item.type)}</span>}
                              {!stepperOpen && item.mods?.length > 0 && <span className="cs-item-mods">{item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</span>}
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
                              <span className="cs-item-chevron">{expanded ? "▲" : "▼"}</span>
                            </div>
                            {expanded && (
                              <div>
                                {item.description && <div className="cs-item-description">{item.description}</div>}
                                {/* Drop item */}
                                {slug && (
                                  <div className="cs-drop-row" onClick={(e) => e.stopPropagation()}>
                                    {isDropConfirming ? (
                                      <>
                                        <button onClick={confirmDrop} className="cs-drop-confirm-btn">Confirm drop</button>
                                        <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(null); }} className="cs-drop-cancel-btn">Cancel</button>
                                      </>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setDropConfirmId(item.id); }} className="cs-drop-btn">Drop Item</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="cs-item-empty">No equipment.</div>
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
                    <div className="cs-coin-section">
                      <div className="cs-coin-label">Coin</div>

                      {coinMode === "gp" ? (
                        <div className="cs-coin-gp-row">
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
                          <span className="cs-coin-gp-label">Gold Pieces</span>
                        </div>
                      ) : (
                        <>
                          <div className="cs-coin-full-summary">
                            <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: pal.textMuted, flexShrink: 0 }}>GP</span>
                            <div className="cs-coin-gp-equiv">
                              <span style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted }}>≈</span>
                              <span style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.gem, marginLeft: 3 }}>{gpEquivalent(currentCoin)}</span>
                              <span style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted, marginLeft: 4 }}>gp</span>
                            </div>
                            <button
                              onClick={() => setFullCoinExpanded((value) => !value)}
                              className="cs-coin-toggle-btn"
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
                    <div className="cs-xp-row">
                      <span className="cs-xp-label">XP</span>
                      <div className="cs-xp-bar-track">
                        <div style={{ height: "100%", width: `${progress * 100}%`, background: isReadyToLevelUp ? pal.gem : pal.accent, borderRadius: 2, transition: "width 0.4s ease" }} />
                      </div>
                      <div className="cs-xp-nums">
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
                  <div className="cs-xp-award-row">
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
                      className="btn-ghost"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                </>
              )}

              {combatTab === "persona" && (
                <>
                  <div className="cs-section-heading">
                    <div style={secHead}>Skills, Spells & Special Abilities</div>
                    <div className="cs-talent-group">
                      {talentGroups.map((group) => (
                        <div key={group.label}>
                          <div className="cs-talent-group-label">
                            {group.label}
                          </div>
                          {group.items.length > 0 ? (
                            <div className="cs-talent-chips">
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
                            <div className="cs-talent-empty">
                              None listed.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {(char.inPlay || []).length > 0 && hasPersonaBadgeContent && <HR color={pal.border} />}

                  {(char.inPlay || []).length > 0 ? (
                    <ul className="cs-trait-list">
                      {char.inPlay.map((item, index) => (
                        <li key={index} className="cs-trait-item">
                          <span className="cs-trait-bullet">◆</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="cs-persona-empty">
                      No persona traits yet. Add them in edit mode under Persona Traits.
                    </div>
                  )}
                </>
              )}

              {combatTab === "combat" && (
                <div style={{ border: isActiveTurn ? `1px solid ${pal.accent}` : "1px solid transparent", borderRadius: 8, padding: isActiveTurn ? "14px 14px 10px" : 0, background: isActiveTurn ? `${pal.accent}10` : "transparent", boxShadow: isActiveTurn ? `0 0 0 1px ${pal.accent}22, 0 0 18px ${pal.accent}22` : "none", transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s" }}>
                  {isActiveTurn && (
                    <div className="cs-active-turn-banner">
                      <div>
                        <div className="cs-active-turn-label">Your Turn</div>
                        <div className="cs-active-turn-desc">You are the active combatant in initiative.</div>
                      </div>
                      <div className="cs-active-turn-dot" style={{ boxShadow: `0 0 10px ${pal.accentBright}` }} />
                    </div>
                  )}

                  {char.concentration?.active && (
                    <div className="cs-conc-banner" style={{ background: `rgba(${pal.name === "Vellum" ? "140,110,70" : "160,104,64"},0.10)` }}>
                      <div className="cs-conc-banner-left">
                        <div className="cs-conc-dot" style={{ boxShadow: `0 0 6px ${pal.accentBright}` }} />
                        <div>
                          <span className="cs-conc-label">Concentrating on</span>
                          <span className="cs-conc-spell">{char.concentration.spell}</span>
                        </div>
                      </div>
                      {slug && (
                        <button onClick={() => {
                          const prev = char.concentration;
                          const concentration = { active: false, spell: "" };
                          setChar((current) => ({ ...current, concentration }));
                          applySessionPatch({ concentration }, { concentration: prev }).catch(() => {});
                        }} className="cs-conc-drop-btn">
                          Drop Concentration
                        </button>
                      )}
                    </div>
                  )}

                  {slug && !char.concentration?.active && (
                    <div className="cs-conc-input-row">
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
                      }} className="cs-set-conc-btn" style={{ opacity: concSpellInput.trim() ? 1 : 0.5 }}>
                        Set Concentration
                      </button>
                    </div>
                  )}

                  {hpMax > 0 && (
                    <div className="cs-hp-card">
                      <div className="cs-hp-card-row">
                        {slug && (
                          <button onClick={() => {
                            const delta = -1;
                            const newVal = Math.max(0, hpCurrent + delta);
                            if (newVal === hpCurrent) return;
                            hpPendingDelta.current += delta;
                            markSessionExpected({ hpCurrent: newVal });
                            setChar((current) => ({ ...current, hpCurrent: newVal }));
                            hpFlushRef.current?.();
                          }} className="cs-hp-stepper">−</button>
                        )}
                        <div className="cs-hp-display">
                          <div className="cs-hp-nums-combat">
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
                              <span onClick={() => slug && setHpEditMode(true)} title={slug ? "Tap to set HP directly" : undefined} className="cs-hp-current-combat" style={{ cursor: slug ? "pointer" : "default" }}>{hpCurrent}</span>
                            )}
                            <span className="cs-hp-slash-combat">/</span>
                            <span className="cs-hp-max-combat">{hpMax}</span>
                          </div>
                          <div className="cs-hp-label">Hit Points</div>
                          {tempHP > 0 && <div className="cs-hp-temp-label">+{tempHP} temp</div>}
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
                          }} className="cs-hp-stepper">+</button>
                        )}
                      </div>
                      <div className="cs-hp-bar-track-combat">
                        <div style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%`, height: "100%", borderRadius: 3, background: hpBarColor, transition: "width 0.25s, background-color 0.25s" }} />
                      </div>
                      {slug && (
                        <div className="cs-temp-hp-row">
                          <span className="cs-temp-hp-label">Temp HP</span>
                          <input type="number" min={0} value={tempHP} onChange={(e) => {
                            const value = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setChar((current) => ({ ...current, tempHP: value }));
                            markSessionExpected({ tempHP: value });
                            tempHpFlushRef.current?.();
                          }} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "4px 8px", outline: "none", width: 72, textAlign: "center" }} />
                        </div>
                      )}
                      {hpCurrent === 0 && hpMax > 0 && (
                        <div className="cs-death-saves">
                          <div className="cs-death-saves-title">Death Saves</div>
                          <div className="cs-death-save-row">
                            <span className="cs-death-save-label" style={{ color: pal.gem }}>Success</span>
                            {[0, 1, 2].map((value) => <div key={value} className="cs-death-save-pip" style={{ border: `1px solid ${pal.gem}` }} />)}
                          </div>
                          <div className="cs-death-save-row">
                            <span className="cs-death-save-label" style={{ color: "#c06060" }}>Failure</span>
                            {[0, 1, 2].map((value) => <div key={value} className="cs-death-save-pip" style={{ border: "1px solid #c06060" }} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hit Dice Tracker */}
                  <div className="cs-hd-card">
                    <HitDiceTracker char={char} slug={slug} applySessionPatch={applySessionPatch} setChar={setChar} pal={pal} />
                  </div>

                  <button onClick={() => {
                    if (!slug) return;
                    const inspiration = !char.inspiration;
                    setChar((current) => ({ ...current, inspiration }));
                    applySessionPatch({ inspiration }, { inspiration: !inspiration }).catch(() => {});
                  }} className="cs-inspiration-btn" style={{ background: char.inspiration ? `${pal.gem}18` : "transparent", border: `1px solid ${char.inspiration ? pal.gem : pal.border}`, cursor: slug ? "pointer" : "default" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: char.inspiration ? pal.gem : "transparent", border: `2px solid ${char.inspiration ? pal.gem : pal.border}`, boxShadow: char.inspiration ? `0 0 8px ${pal.gem}88, 0 0 18px ${pal.gem}33` : "none", flexShrink: 0, transition: "all 0.18s" }} />
                    <span className="cs-inspiration-label" style={{ color: char.inspiration ? pal.accentBright : pal.textMuted }}>Inspiration</span>
                    {char.inspiration && <span className="cs-inspiration-active-badge" style={{ background: `${pal.gem}1a`, border: `1px solid ${pal.gem}55` }}>Active</span>}
                  </button>

                  <div className="divider" />
                  <div style={{ marginBottom: 20 }}>
                    <div className="cs-conditions-heading">Conditions</div>
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
                            <div className="cs-condition-chips">
                              {activeChips.map((chip) => {
                                const color = chip.type === "exhaustion" ? "#c09040" : conditionColorFor(chip.label);
                                return (
                                  <div key={chip.key} className="cs-condition-chip" style={{ background: `${color}26`, border: `1px solid ${color}b3`, color }}>
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
                                        className="cs-condition-remove-btn"
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
                                className="cs-add-condition-btn"
                                style={{ marginBottom: conditionPickerOpen && inactiveConditions.length > 0 ? 10 : 0 }}
                              >
                                ＋ Add Condition
                              </button>

                              {conditionPickerOpen && inactiveConditions.length > 0 && (
                                <div className="cs-condition-picker">
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
                                      className="cs-condition-option-btn"
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
                      <div className="cs-exhaustion-row">
                        <span className="cs-exhaustion-label">Exhaustion</span>
                        <button onClick={() => {
                          const delta = -1;
                          const value = Math.max(0, (char.exhaustionLevel || 0) + delta);
                          if (value === (char.exhaustionLevel || 0)) return;
                          exhPendingDelta.current += delta;
                          markSessionExpected({ exhaustionLevel: value });
                          setChar((current) => ({ ...current, exhaustionLevel: value }));
                          exhFlushRef.current?.();
                        }} className="cs-exh-btn">−</button>
                        <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: (char.exhaustionLevel || 0) > 0 ? pal.gem : pal.textMuted, minWidth: 20, textAlign: "center" }}>{char.exhaustionLevel || 0}</span>
                        <button onClick={() => {
                          const delta = 1;
                          const value = Math.min(6, (char.exhaustionLevel || 0) + delta);
                          if (value === (char.exhaustionLevel || 0)) return;
                          exhPendingDelta.current += delta;
                          markSessionExpected({ exhaustionLevel: value });
                          setChar((current) => ({ ...current, exhaustionLevel: value }));
                          exhFlushRef.current?.();
                        }} className="cs-exh-btn">+</button>
                      </div>
                    )}

                    {slug && (((char.conditions || []).length > 0) || (char.exhaustionLevel || 0) > 0) && (
                      <button onClick={() => {
                        const prevConds = char.conditions || [];
                        const prevExhaustion = char.exhaustionLevel || 0;
                        setChar((current) => ({ ...current, conditions: [], exhaustionLevel: 0 }));
                        applySessionPatch({ conditions: [], exhaustionLevel: 0 }, { conditions: prevConds, exhaustionLevel: prevExhaustion }).catch(() => {});
                      }} className="cs-clear-conditions-btn">
                        Clear All Conditions
                      </button>
                    )}
                  </div>

                  {(() => {
                    const activeSlots = (char.spellSlots || []).filter((slot) => slot.max > 0);
                    if (activeSlots.length === 0) return null;
                    return (
                      <>
                        <div className="divider" />
                        <div>
                          <div className="cs-spell-slots-heading">Spell Slots</div>
                          {activeSlots.map((slot) => (
                            <div key={slot.level} className="cs-spell-slot-row">
                              <div className="cs-spell-slot-level">{SPELL_LEVEL_LABELS[slot.level - 1]}</div>
                              <div className="cs-spell-pips">
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
                              {slot.isPactMagic && <span className="cs-spell-pact-tag">Pact</span>}
                            </div>
                          ))}
                          {slug && (
                            <div className="cs-spell-rest-btns">
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
                              }} className="btn-ghost">Short Rest</button>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {(char.weapons || []).length > 0 && (
                    <>
                      <div className="divider" style={{ margin: "20px 0" }} />
                      <div>
                        <div className="cs-combat-heading">Weapons</div>
                        {char.weapons.map((item) => {
                          const expanded = expandedItems.has(item.id + "-combat");
                          const attackMod = item.mods?.find((mod) => mod.attribute === "Attack Bonus");
                          const damageMod = item.mods?.find((mod) => mod.attribute === "Damage");
                          return (
                            <div key={item.id} className="cs-weapon-card">
                              <div onClick={() => {
                                const next = new Set(expandedItems);
                                const key = item.id + "-combat";
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                setExpandedItems(next);
                              }} className="cs-weapon-card-header">
                                <span className="cs-weapon-card-name">{item.name}</span>
                                {attackMod && <span className="cs-weapon-card-mod">To-hit <span className="cs-weapon-card-mod-val">{attackMod.value}</span></span>}
                                {damageMod && <span className="cs-weapon-card-mod" style={{ marginLeft: 4 }}>Dmg <span className="cs-weapon-card-mod-val">{damageMod.value}</span></span>}
                                <span className="cs-weapon-card-chevron">{expanded ? "▼" : "▶"}</span>
                              </div>
                              {expanded && item.description && <div className="cs-weapon-card-desc">{item.description}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {!(char.hpMax ?? char.hp ?? 0) && !(char.spellSlots || []).length && !(char.weapons || []).length && (
                    <div className="cs-combat-empty">
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
                      <div className="cs-map-label">{activeMap.name || "Active Map"}</div>
                      <div className="cs-map-open-row">
                        <button
                          onClick={() => window.open(`/map-view?theme=${encodeURIComponent((char.palette || "ocean").toLowerCase())}`, "_blank", "noopener,noreferrer")}
                          className="cs-map-open-btn"
                        >
                          Open Window
                        </button>
                      </div>
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
                    <div className="cs-map-empty">
                      <div className="cs-map-empty-text">The DM hasn&apos;t loaded a map yet.</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="cs-collections-nav">
              {char.collections.map((collection) => {
                if (!collection.sections.length) return null;
                return (
                  <div key={collection.id} className="cs-collection-block">
                    <div className="cs-collection-label">
                      {collection.label}
                    </div>
                    <div className="cs-collection-btns">
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
                <h2 className="cs-section-title">{activeSec.title}</h2>
                {activeSec.type === "list" ? (
                  <ul className="cs-section-list">
                    {(activeSec.items || []).map((item, index) => (
                      <li key={index} className="cs-section-list-item">
                        <span className="cs-section-bullet">◆</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    {(activeSec.content || "").split("\n\n").filter(Boolean).map((para, index) => (
                      <p key={index} className="cs-section-paragraph">
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
            <div className="cs-locked-prompt">
              {unlockChecking || unlockLoading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, color: pal.textMuted }}>
                  <div className="dnd-spinner" style={{ borderTopColor: pal.textMuted }} />
                </div>
              ) : (
                <>
                  <div className="cs-locked-label">
                    Full sheet is private
                  </div>
                  <button onClick={handleViewUnlock} className="cs-locked-unlock-btn">
                    🔒 Unlock with password
                  </button>
                </>
              )}
            </div>
          )
        )}

        <footer className="cs-footer">
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
