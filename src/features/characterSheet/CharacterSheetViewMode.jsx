import { useState, useRef, useEffect, useMemo } from "react";
import { useHoldToRepeat } from "../../lib/useHoldToRepeat";
import { Link, useNavigate } from "react-router-dom";
import TopNav, { NavSegment } from "../../components/TopNav";
import { InfoBadge } from "./CharacterTalents";
import { getTalentTooltip } from "./talentCatalog";
import ItemEditorModal, { itemTypeLabel } from "./ItemEditorModal";
import { computeArmorClass } from "./armorClass";
import ItemEquipToggle from "./ItemEquipToggle";
import { HR } from "./CharacterSheetPrimitives";
import { ARMOR_OPTIONS, XP_THRESHOLDS, COIN_COLORS, fmtMod, modOf, parseModInt, normalizeSpells, spellRoleGlyph } from "./constants";
import { renderInline } from "./theme";
import WorldGuideDrawer from "../worldGuide/WorldGuideDrawer";
import { useTextScale } from "../../lib/useTextScale";
import "./characterSheet.css";

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

export default function CharacterSheetViewMode({ ctx }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [fullCoinExpanded, setFullCoinExpanded] = useState(false);
  const [xpAwardOpen, setXpAwardOpen] = useState(false);
  const [xpAwardValue, setXpAwardValue] = useState("100");
  // Qty stepper: id of the equipment item whose stepper is open, or null
  const [qtyStepperOpenId, setQtyStepperOpenId] = useState(null);
  // Attunement over-limit flash: set of item ids currently flashing red
  const [attunementFlashing, setAttunementFlashing] = useState(new Set());
  // Drop item confirm: id of item pending drop confirmation, or null
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
    hpMax,
    hpCurrent,
    tempHP,
    hpPct,
    hpBarColor,
    hpBonus,
    secHead,
    inputStyle,
    movedTabsNotice,
    dismissMovedTabsNotice,
    editingItem,
    setEditingItem,
    expandedItems,
    toggleExpanded,
    hoveredStat,
    setHoveredStat,
    updateWeapon,
    addWeapon,
    updateEquipment,
    addEquipment,
  } = ctx;

  const navigate = useNavigate();
  const { textScale, textScaleMenuItem } = useTextScale();

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

  // Story 56 — tolerant read of `spells` (ADR-024) memoized against the raw
  // field so the merged attacks list + badge row don't remint ids (and
  // remount) on every poll tick.
  const normalizedSpells = useMemo(() => normalizeSpells(char.spells), [char.spells]);

  const skillItems = (char.skills || []).map((skill) => ({ key: skill, label: skill.replace(/\b\w/g, (ch) => ch.toUpperCase()) }));
  const spellItems = normalizedSpells.map((spell) => ({
    key: spell.id,
    label: spell.role ? (
      <>
        <span className={`cs-spell-glyph${spell.role === "heal" ? " heal" : ""}`}>{spellRoleGlyph(spell.role)}</span>
        {" "}{spell.name}
      </>
    ) : spell.name,
    tooltip: spell.description || `Spell: ${spell.name}`,
  }));
  const abilityItems = (char.specialAbilities || []).map((ability) => ({ key: ability, label: ability.replace(/\b\w/g, (ch) => ch.toUpperCase()) }));
  const talentGroups = [
    {
      label: "Skills",
      singular: "Skill",
      items: skillItems,
      color: pal.accentBright,
      border: `${pal.accent}66`,
      bg: `${pal.accent}16`,
      catalog: true,
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
      catalog: true,
    },
  ];
  const hasPersonaBadgeContent = talentGroups.some((group) => group.items.length > 0);

  return (
    <div style={{ ...rootWrap, zoom: textScale }}>
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
        center={slug ? (
          <NavSegment
            options={[{ key: "profile", label: "❡ Profile" }, { key: "session", label: "⚔ Session" }]}
            value="profile"
            onChange={(v) => { if (v === "session") navigate(`/characters/${slug}/session`); }}
          />
        ) : null}
        menuItems={[
          { label: unlockState === "unlocked" ? "Edit Character" : "🔒 Edit Character", onClick: handleEditClick },
          { label: "Export JSON", onClick: exportJSON },
          { label: "All Characters", href: "/" },
          { label: "Chronicle", href: "/chronicle" },
          { divider: true },
          textScaleMenuItem,
        ]}
      />

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
                const { total: effectiveAc, parts: armorBreakdown } = computeArmorClass(char);
                const armorOpt = ARMOR_OPTIONS.find((option) => option.value === char.armorType);
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
                    {effectiveAc > 0 && (
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
                                <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: entry.base ? pal.textMuted : pal.textBody, fontStyle: entry.base ? "italic" : "normal" }}>{entry.label}</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: entry.value >= 0 ? pal.gem : pal.gemLow }}>{entry.base ? entry.value : entry.value >= 0 ? `+${entry.value}` : entry.value}</span>
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

              {/* Story 59 — the tab strip is gone; Inventory and Persona are plain
                  sections, and Combat/Map live in Session mode. One-time notice
                  for returning users whose last tab no longer exists. */}
              {movedTabsNotice && (
                <div className="cs-moved-notice" role="status">
                  <span>Combat and Map now live in <Link to={`/characters/${slug}/session`} className="cs-moved-notice__link">⚔ Session mode →</Link></span>
                  <button type="button" className="cs-moved-notice__close" onClick={dismissMovedTabsNotice} aria-label="Dismiss">×</button>
                </div>
              )}

              <div className="cs-profile-section-title">Inventory</div>
              {(
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
                          e?.stopPropagation();
                          const prevWeapons = char.weapons;
                          const updated = char.weapons.map((w) => w.id === item.id ? { ...w, equipped: !isEquipped } : w);
                          setChar((c) => ({ ...c, weapons: updated }));
                          applySessionPatch({ weapons: updated }, { weapons: prevWeapons }).catch(() => {});
                        }

                        function useOne(e) {
                          e.stopPropagation();
                          const prevWeapons = char.weapons;
                          const updated = char.weapons.map((w) => w.id === item.id && w.qty != null ? { ...w, qty: Math.max(0, w.qty - 1) } : w);
                          setChar((c) => ({ ...c, weapons: updated }));
                          applySessionPatch({ weapons: updated }, { weapons: prevWeapons }).catch(() => {});
                        }

                        return (
                          <div key={item.id} onClick={() => toggleExpanded(item.id)} className="cs-item-row">
                            <div className="cs-item-row-inner">
                              {/* Equip toggle — type icon, shared with Session Loadout */}
                              <ItemEquipToggle item={item} kind="weapons" onToggle={toggleEquipped} />
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
                                {/* Use Item (qty-tracked items) — replaces Drop Item */}
                                {slug && item.qty != null && item.qty > 0 && (
                                  <div className="cs-drop-row" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={useOne} className="cs-use-btn" title="Use one">Use Item</button>
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
                          e?.stopPropagation();
                          const prevEquipment = char.equipment;
                          const updated = char.equipment.map((eq) => eq.id === item.id ? { ...eq, equipped: !isEquipped } : eq);
                          setChar((c) => ({ ...c, equipment: updated }));
                          applySessionPatch({ equipment: updated }, { equipment: prevEquipment }).catch(() => {});
                        }

                        function useOne(e) {
                          e.stopPropagation();
                          patchEquipmentQty(item.qty - 1);
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
                              {/* Equip toggle — type icon, shared with Session Loadout */}
                              <ItemEquipToggle item={item} kind="equipment" onToggle={toggleEquipped} />
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
                                {/* Use Item (qty-tracked items) — replaces Drop Item */}
                                {slug && item.qty != null && item.qty > 0 && (
                                  <div className="cs-drop-row" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={useOne} className="cs-use-btn" title="Use one">Use Item</button>
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

              <HR color={pal.border} />
              <div className="cs-profile-section-title">Persona</div>
              {(
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
                                  tooltip={item.tooltip ?? (group.catalog ? getTalentTooltip(item.key) : `${group.singular}: ${item.label}`)}
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
                  ) : null}
                </>
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
          <div className="cs-footer-credit">Combat effect art: The Free Archives © Dreams Circle</div>
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
