import { Link } from "react-router-dom";
import DiceRoller from "../../components/DiceRoller";
import { InfoBadge } from "./CharacterTalents";
import ItemEditorModal from "./ItemEditorModal";
import { HR } from "./CharacterSheetPrimitives";
import { ARMOR_OPTIONS, CONDITIONS, SPELL_LEVEL_LABELS, fmtMod, modOf, parseModInt } from "./constants";
import { renderInline } from "./theme";

export default function CharacterSheetViewMode({ ctx }) {
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
  } = ctx;

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

          {(char.conditions || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 16 }}>
              {char.conditions.map((cond) => (
                <span key={cond} style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "3px 10px", borderRadius: 12, border: `1px solid ${pal.accent}`, color: pal.accentBright }}>{cond}</span>
              ))}
            </div>
          )}

          {char.concentration?.active && (
            <div style={{ marginTop: 14, fontFamily: pal.fontUI, fontSize: 13, color: pal.accentBright, letterSpacing: "0.06em" }}>
              ◈ Concentrating: {char.concentration.spell}
            </div>
          )}
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
              {((char.hpMax ?? char.hp ?? 0) > 0 || char.hitDice || char.armorType || char.armorTotal > 0) && (() => {
                const acBonus = _itemBonuses["Armor"] || 0;
                const effectiveAc = (char.armorTotal || 0) + acBonus;
                const diceParts = char.hitDice ? (char.hitDice.match(/(\d+|[a-zA-Z]+|[+\-])/g) || []) : [];
                const armorOpt = ARMOR_OPTIONS.find((option) => option.value === char.armorType);
                const topPad = armorOpt ? 24 : 0;

                return (
                  <div style={{ display: "flex", justifyContent: "center", gap: 52, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {(char.hpMax ?? char.hp ?? 0) > 0 && (
                      <div style={{ textAlign: "center", paddingTop: topPad }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 44, color: pal.gem, lineHeight: 1 }}>{hpCurrent}</span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.textMuted, lineHeight: 1 }}>/</span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 30, color: pal.accent, lineHeight: 1 }}>{hpMax}</span>
                        </div>
                        {tempHP > 0 && <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.accentBright, letterSpacing: "0.08em", marginTop: 2 }}>+{tempHP} temp</div>}
                        {hpMax > 0 && (
                          <div style={{ width: "100%", height: 4, borderRadius: 2, background: pal.border, marginTop: 6, overflow: "hidden", minWidth: 80 }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%`, height: "100%", borderRadius: 2, background: hpBarColor, transition: "width 0.25s, background-color 0.25s" }} />
                          </div>
                        )}
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 5 }}>Hit Points</div>
                        {hpBonus !== 0 && <div style={{ fontFamily: pal.fontBody, fontSize: 11, color: pal.accent, fontStyle: "italic", opacity: 0.8, marginTop: 2 }}>{char.hpMax ?? char.hp} base {hpBonus > 0 ? "+" : ""}{hpBonus} item</div>}
                      </div>
                    )}
                    {char.hitDice && (
                      <div style={{ textAlign: "center", paddingTop: topPad }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
                          {diceParts.map((part, index) => <span key={index} style={{ fontFamily: pal.fontDisplay, fontSize: /^\d+$/.test(part) ? 44 : 22, color: pal.accent, lineHeight: 1 }}>{part}</span>)}
                        </div>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 5 }}>Hit Dice</div>
                      </div>
                    )}
                    {(armorOpt || char.armorTotal > 0) && (
                      <div style={{ textAlign: "center" }}>
                        {armorOpt && <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent, marginBottom: 5 }}>{armorOpt.label}{armorOpt.speed ? ` · ${armorOpt.speed}` : ""}</div>}
                        {char.armorTotal > 0 && (
                          <>
                            <div style={{ fontFamily: pal.fontDisplay, fontSize: 44, color: pal.accentBright, lineHeight: 1 }}>{effectiveAc}</div>
                            {acBonus !== 0 && <div style={{ fontFamily: pal.fontBody, fontSize: 11, color: pal.accent, fontStyle: "italic", opacity: 0.8, marginTop: 2 }}>{char.armorTotal} base {acBonus > 0 ? "+" : ""}{acBonus} item</div>}
                          </>
                        )}
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 5 }}>Armor</div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <HR color={pal.border} />
              <div style={secHead}>Ability Scores · Level {char.level}</div>

              {(() => {
                const modSources = {};
                [...(char.weapons || []), ...(char.equipment || [])].forEach((item) => {
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

              <HR color={pal.border} />
              <div style={{ marginBottom: 4 }}>
                <div style={secHead}>Skills, Spells & Special Abilities</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    {
                      label: "Skills",
                      items: (char.skills || []).map((skill) => ({ key: skill, label: skill.replace(/\b\w/g, (ch) => ch.toUpperCase()) })),
                      color: pal.accentBright,
                      border: `${pal.accent}66`,
                      bg: `${pal.accent}16`,
                    },
                    {
                      label: "Spells",
                      items: (char.spells || []).map((spell) => ({ key: spell, label: spell })),
                      color: pal.accent,
                      border: pal.border,
                      bg: pal.surface,
                    },
                    {
                      label: "Special Abilities",
                      items: (char.specialAbilities || []).map((ability) => ({ key: ability, label: ability.replace(/\b\w/g, (ch) => ch.toUpperCase()) })),
                      color: pal.gem,
                      border: `${pal.gem}55`,
                      bg: `${pal.gem}14`,
                    },
                  ].map((group) => (
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
                              tooltip={`${group.label.slice(0, -1)}: ${item.label}`}
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

              <HR color={pal.border} />
              <div style={{ display: "flex", margin: "0 -30px 24px" }}>
                {[
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
                    key: "combat",
                    label: "Combat",
                    icon: (activeTab) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2 L17 5 L17 10 Q17 15 10 18 Q3 15 3 10 L3 5 Z" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
                        <path d="M10 6 L10 13 M7 9.5 L13 9.5" stroke={activeTab ? pal.accentBright : pal.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                ].map((tab, index, allTabs) => {
                  const isCurrent = combatTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setTab(tab.key)}
                      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, height: 64, fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer", background: isCurrent ? pal.accentDim : "transparent", border: `1px solid ${isCurrent ? pal.accent : pal.border}`, borderRight: index < allTabs.length - 1 ? "none" : `1px solid ${isCurrent ? pal.accent : pal.border}`, color: isCurrent ? pal.accentBright : pal.textMuted, transition: "border-color 0.15s, background 0.15s, color 0.15s" }}
                    >
                      {tab.icon(isCurrent)}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {combatTab === "loadout" && (
                <div className="loadout-grid">
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim }}>Weapons</div>
                      {onSave && <button onClick={() => setEditingItem({ listType: "weapons", item: null })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12 }}>+ Add Weapon</button>}
                    </div>
                    {(char.weapons || []).length > 0 ? (
                      char.weapons.map((item) => {
                        const expanded = expandedItems.has(item.id);
                        return (
                          <div key={item.id} onClick={() => item.description && toggleExpanded(item.id)} style={{ padding: "9px 0", borderBottom: `1px solid ${pal.border}`, cursor: item.description ? "pointer" : "default" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.text }}>{item.name}</span>
                              {item.mods?.length > 0 && <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted }}>{item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</span>}
                              {item.description && <span style={{ marginLeft: "auto", color: pal.accentDim, fontSize: 11, fontFamily: pal.fontUI }}>{expanded ? "▲" : "▼"}</span>}
                            </div>
                            {expanded && item.description && <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, marginTop: 6, lineHeight: 1.6, fontStyle: "italic" }}>{item.description}</div>}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No weapons.</div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim }}>Equipment</div>
                      {onSave && <button onClick={() => setEditingItem({ listType: "equipment", item: null, showType: true })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12 }}>+ Add Item</button>}
                    </div>
                    {(char.equipment || []).length > 0 ? (
                      char.equipment.map((item) => {
                        const expanded = expandedItems.has(item.id);
                        return (
                          <div key={item.id} onClick={() => item.description && toggleExpanded(item.id)} style={{ padding: "9px 0", borderBottom: `1px solid ${pal.border}`, cursor: item.description ? "pointer" : "default" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.text }}>{item.name}</span>
                              {item.type && <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.accent, opacity: 0.75 }}>{item.type}</span>}
                              {item.mods?.length > 0 && <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted }}>{item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</span>}
                              {item.description && <span style={{ marginLeft: "auto", color: pal.accentDim, fontSize: 11, fontFamily: pal.fontUI }}>{expanded ? "▲" : "▼"}</span>}
                            </div>
                            {expanded && item.description && <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, marginTop: 6, lineHeight: 1.6, fontStyle: "italic" }}>{item.description}</div>}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No equipment.</div>
                    )}
                  </div>
                </div>
              )}

              {combatTab === "persona" && (
                <>
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {CONDITIONS.map((condition) => {
                        const isActive = (char.conditions || []).includes(condition);
                        return (
                          <button key={condition} onClick={() => {
                            if (!slug) return;
                            const prevConds = char.conditions || [];
                            const conditions = isActive ? prevConds.filter((value) => value !== condition) : [...prevConds, condition];
                            setChar((current) => ({ ...current, conditions }));
                            applySessionPatch({ conditions }, { conditions: prevConds }).catch(() => {});
                          }} style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", padding: "4px 12px", borderRadius: 12, background: isActive ? pal.gem : "transparent", border: `1px solid ${isActive ? pal.accent : pal.border}`, color: isActive ? pal.bg : pal.textMuted, cursor: slug ? "pointer" : "default", transition: "all 0.15s" }}>
                            {condition}
                          </button>
                        );
                      })}
                    </div>

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
                                if (window.confirm("Long rest — reset all spell slots?")) {
                                  const prevSlots = char.spellSlots || [];
                                  const spellSlots = prevSlots.map((slot) => ({ ...slot, used: 0 }));
                                  setChar((current) => ({ ...current, spellSlots }));
                                  applySessionPatch({ spellSlots }, { spellSlots: prevSlots }).catch(() => {});
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

                  <DiceRoller weapons={char.weapons || []} stats={char.stats || []} pal={pal} slug={slug} />
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
