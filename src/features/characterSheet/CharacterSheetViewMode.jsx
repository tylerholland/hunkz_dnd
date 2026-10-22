import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TopNav, { NavSegment } from "../../components/TopNav";
import { InfoBadge } from "./CharacterTalents";
import { getTalentTooltip } from "./talentCatalog";
import { useTalentCodexVersion } from "./talentCodexStore";
import { computeArmorClass } from "./armorClass";
import InventoryPanel from "./InventoryPanel";
import { useInventoryWrites } from "./useInventoryWrites";
import { HR } from "./CharacterSheetPrimitives";
import { ARMOR_OPTIONS, fmtMod, modOf, parseModInt, normalizeSpells, spellRoleGlyph } from "./constants";
import { renderInline } from "./theme";
import WorldGuideDrawer from "../worldGuide/WorldGuideDrawer";
import { useTextScale } from "../../lib/useTextScale";
import "./characterSheet.css";

export default function CharacterSheetViewMode({ ctx }) {
  useTalentCodexVersion(); // re-render when the DM's codex arrives
  const [guideOpen, setGuideOpen] = useState(false);
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
    movedTabsNotice,
    dismissMovedTabsNotice,
    hoveredStat,
    setHoveredStat,
  } = ctx;

  const navigate = useNavigate();
  const { textScale, textScaleMenuItem } = useTextScale();

  // Inventory, coin and XP — the same panel as Session mode, saved the same
  // way (live session endpoint) with undo on failure.
  const persistInventory = useCallback((fields) => applySessionPatch(fields), [applySessionPatch]);
  const { writeLoadout, commitCoin, commitXp } = useInventoryWrites({ char, setChar, persist: persistInventory });

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
              <InventoryPanel char={char} pal={pal} writeLoadout={writeLoadout} onCommitCoin={commitCoin} onCommitXp={commitXp} />

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

      </div>
    </div>
  );
}
