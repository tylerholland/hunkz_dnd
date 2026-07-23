import "./characterSheet.css";
import ChangePasswordForm from "./ChangePasswordForm";
import { CHARACTER_SKILLS, SPECIAL_ABILITIES, getTalentDetail } from "./talentCatalog";
import {
  ALIGNMENT_OPTIONS,
  ALL_SUBCLASS_OPTIONS,
  ARMOR_OPTIONS,
  BACKGROUND_OPTIONS,
  CLASS_OPTIONS,
  RACE_OPTIONS,
  SPELL_LEVEL_LABELS,
  SUBCLASS_OPTIONS,
} from "./constants";
import { DragHandle } from "./CharacterSheetPrimitives";
import { InfoBadge } from "./CharacterTalents";
import ItemEditorModal from "./ItemEditorModal";
import { PALETTES } from "./theme";

export default function CharacterSheetEditMode({ ctx }) {
  const {
    rootWrap,
    pal,
    secHead,
    char,
    importRef,
    importJSON,
    slug,
    onSave,
    handleSave,
    saveStatus,
    onCreate,
    setMenuOpen,
    menuOpen,
    exportJSON,
    handleDeleteRequest,
    onDelete,
    setMode,
    deleteConfirm,
    deletePhrase,
    deleteInput,
    setDeleteInput,
    inputStyle,
    cancelDelete,
    handleDelete,
    deleteStatus,
    update,
    fileRef,
    handlePortrait,
    lbl,
    updateStat,
    addInPlay,
    updateInPlay,
    removeInPlay,
    setEditingItem,
    removeWeapon,
    removeEquipment,
    unlockedPassword,
    setUnlockedPassword,
    addCollection,
    updateCollection,
    removeCollection,
    dragInfo,
    dragOver,
    onDragStart,
    onDragOver,
    onDrop,
    setDragInfo,
    setDragOver,
    updateSection,
    removeSection,
    taStyle,
    updateListItem,
    removeListItem,
    addListItem,
    addSection,
    editingItem,
    updateWeapon,
    addWeapon,
    updateEquipment,
    addEquipment,
  } = ctx;

  return (
    <>
      <div style={rootWrap}>
        <div className="cs-bg-glow" style={{
          background: `radial-gradient(ellipse at 30% 20%, ${pal.glow1} 0%, transparent 55%),
                       radial-gradient(ellipse at 75% 80%, ${pal.glow2} 0%, transparent 50%)`,
        }} />

        <div className="em-content">
          <div className="em-header-bar">
            <div>
              <div style={secHead}>Character Sheet Editor</div>
              <div className="em-header-title">
                {char.name || "Unnamed Character"}
              </div>
            </div>
            <div className="em-header-actions">
              <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
              {slug && onSave && (
                <button
                  onClick={handleSave}
                  disabled={saveStatus === "saving"}
                  style={{
                    opacity: saveStatus === "saving" ? 0.6 : 1,
                    background: saveStatus === "saved" ? pal.accentDim : pal.surface,
                    borderColor: saveStatus === "saved" ? pal.accent : pal.border,
                    color: saveStatus === "saved" ? pal.accentBright : pal.textMuted,
                  }}
                  className="btn-ghost"
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "Error" : "Save"}
                </button>
              )}
              {!slug && onCreate && (
                <button onClick={() => onCreate(char)} className="btn-primary">
                  Create Character →
                </button>
              )}
              <div style={{ position: "relative", display: "inline-block" }}>
                <button onClick={() => setMenuOpen(!menuOpen)} className="btn-ghost" style={{
                  background: menuOpen ? pal.surfaceDim : "transparent",
                  padding: "9px 12px",
                  fontSize: 16,
                }}>
                  ⋯
                </button>
                {menuOpen && (
                  <div className="em-menu-dropdown">
                    <button onClick={() => { exportJSON(); setMenuOpen(false); }} className="em-menu-item">
                      Export JSON
                    </button>
                    {!slug && (
                      <button onClick={() => { importRef.current.click(); setMenuOpen(false); }} className="em-menu-item">
                        Import JSON
                      </button>
                    )}
                    {slug && onDelete && (
                      <button onClick={() => { handleDeleteRequest(); setMenuOpen(false); }} className="em-menu-item" style={{ color: "#f2b7b7" }}>
                        Delete Character
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setMode("view")} className="btn-primary">
                View Sheet →
              </button>
            </div>
          </div>

          {deleteConfirm && (
            <div style={{ background: "rgba(192,80,80,0.14)", border: "1px solid rgba(192,80,80,0.55)", borderRadius: 6, padding: "22px 24px", marginBottom: 24 }}>
              <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 10 }}>
                PERMANENT DELETE
              </div>
              <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: "#f2c6c6", marginBottom: 12 }}>
                Danger zone
              </div>
              <p style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.text, lineHeight: 1.7, marginBottom: 16 }}>
                This action cannot be undone. To delete this character, type the exact phrase shown below and then confirm.
              </p>
              <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f5d7d7", marginBottom: 8 }}>
                Confirmation phrase
              </div>
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: "#ffe8e8", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "10px 14px", marginBottom: 16 }}>
                {deletePhrase || "DELETE this character"}
              </div>
              <input value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder={deletePhrase} className="input-base" style={{ marginBottom: 16, background: pal.surfaceSolid }} />
              <div className="flex-row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button onClick={cancelDelete} type="button" className="btn-ghost">
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  type="button"
                  disabled={deleteInput !== deletePhrase || deleteStatus === "deleting"}
                  style={{
                    flex: 1,
                    background: deleteInput === deletePhrase ? "#b04a4a" : pal.surface,
                    borderColor: deleteInput === deletePhrase ? "#c06060" : pal.border,
                    color: deleteInput === deletePhrase ? "#fff" : pal.textMuted,
                    cursor: deleteInput === deletePhrase ? "pointer" : "not-allowed",
                  }}
                  className="btn-ghost"
                >
                  {deleteStatus === "deleting" ? "Deleting…" : "Delete Character"}
                </button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Color Theme</div>
            <div className="flex-row" style={{ gap: 10, flexWrap: "wrap" }}>
              {Object.entries(PALETTES).map(([key, palette]) => (
                <button key={key} onClick={() => update("palette", key)} style={{
                  padding: "7px 20px", borderRadius: 3, fontSize: 13,
                  fontFamily: palette.fontUI, letterSpacing: "0.05em",
                  background: char.palette === key ? palette.accentDim : "rgba(255,255,255,0.04)",
                  border: `1px solid ${char.palette === key ? palette.accent : pal.border}`,
                  color: char.palette === key ? palette.accentBright : pal.textMuted,
                  transition: "all 0.15s",
                }}>
                  {palette.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={secHead}>Portrait Image</div>
            <div className="flex-row" style={{ gap: 18, alignItems: "flex-start" }}>
              {(char.portraitUrl || char.portrait) && (
                <img src={char.portraitUrl || char.portrait} alt="portrait" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 4, border: `1px solid ${pal.border}`, flexShrink: 0 }} />
              )}
              <div className="flex-row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePortrait} style={{ display: "none" }} />
                <button onClick={() => fileRef.current.click()} className="btn-ghost">
                  {(char.portraitUrl || char.portrait) ? "Change Image" : "Upload Image"}
                </button>
                {(char.portraitUrl || char.portrait) && (
                  <button onClick={() => { update("portrait", ""); update("portraitUrl", ""); }} className="btn-ghost">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={lbl}>Portrait Tagline <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(shown beneath portrait image)</span></label>
            <input className="input-base" value={char.tagline || ""} onChange={(e) => update("tagline", e.target.value)} placeholder="A short italicised line shown beneath the portrait…" />
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Identity</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { field: "name", label: "Character Name", type: "text" },
                { field: "nameAlt", label: "Alias / Epithet", type: "text" },
                { field: "pronunciation", label: "Pronunciation", type: "text" },
                { field: "race", label: "Race", type: "select", options: RACE_OPTIONS },
                { field: "charClass", label: "Class", type: "select", options: CLASS_OPTIONS },
                { field: "subclass", label: "Subclass / Patron", type: "select", options: () => (SUBCLASS_OPTIONS[char.charClass] || ALL_SUBCLASS_OPTIONS) },
                { field: "alignment", label: "Alignment", type: "select", options: ALIGNMENT_OPTIONS },
                { field: "background", label: "Background", type: "select", options: BACKGROUND_OPTIONS },
                { field: "origin", label: "Origin / Homeland", type: "text" },
              ].map(({ field, label, type, options }) => (
                <div key={field}>
                  <label style={lbl}>{label}</label>
                  {type === "select" ? (
                    <select className="input-base" style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none" }} value={char[field] || ""} onChange={(e) => update(field, e.target.value)}>
                      <option value="">{label}</option>
                      {(typeof options === "function" ? options() : options).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="input-base" value={char[field] || ""} onChange={(e) => update(field, e.target.value)} placeholder={label} />
                  )}
                </div>
              ))}
              <div>
                <label style={lbl}>Level</label>
                <input className="input-base" type="number" min={1} max={20} value={char.level || ""} onChange={(e) => update("level", parseInt(e.target.value, 10) || 1)} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Ability Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {char.stats.map((stat, index) => (
                <div key={index} className="em-stat-card">
                  <input className="input-base" style={{ marginBottom: 8, fontSize: 14 }} value={stat.stat} onChange={(e) => updateStat(index, "stat", e.target.value)} placeholder="Stat name" />
                  <input className="input-base" style={{ marginBottom: 8, fontSize: 24, textAlign: "center", fontFamily: pal.fontDisplay }} type="number" min={1} max={20} value={stat.score} onChange={(e) => updateStat(index, "score", e.target.value)} />
                  <input className="input-base" style={{ fontSize: 14, color: pal.textMuted }} value={stat.note} onChange={(e) => updateStat(index, "note", e.target.value)} placeholder="Short note…" />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Hit Points <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(max)</span></label>
                <input className="input-base" type="number" min={0} value={char.hpMax ?? char.hp ?? ""} onChange={(e) => update("hpMax", parseInt(e.target.value, 10) || 0)} placeholder="e.g. 38" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
              <div>
                <label style={{ ...lbl, marginBottom: 10 }}>Armor & Speed</label>
                <div className="flex-row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {ARMOR_OPTIONS.map((opt) => {
                    const selected = char.armorType === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => update("armorType", selected ? "" : opt.value)} style={{ background: selected ? pal.accentDim : "transparent", border: `1px solid ${selected ? pal.accent : pal.border}`, borderRadius: 3, padding: "8px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", color: selected ? pal.accentBright : pal.text }}>{opt.label}</span>
                        {opt.speed && <span style={{ fontFamily: pal.fontBody, fontSize: 11, color: selected ? pal.accent : pal.textMuted, fontStyle: "italic" }}>{opt.speed}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ minWidth: 110 }}>
                <label style={lbl}>Total Armor</label>
                <input className="input-base" type="number" min={0} value={char.armorTotal ?? ""} onChange={(e) => update("armorTotal", parseInt(e.target.value, 10) || 0)} placeholder="e.g. 16" />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Spell Slots</div>
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, marginBottom: 14, fontStyle: "italic" }}>
              Configure max slots per level. Leave at 0 to hide.
            </div>
            {SPELL_LEVEL_LABELS.map((label, index) => {
              const level = index + 1;
              const slot = (char.spellSlots || []).find((entry) => entry.level === level) || { level, max: 0, used: 0, isPactMagic: false };
              const updateSlot = (field, value) => {
                const slots = [...(char.spellSlots || [])];
                const slotIndex = slots.findIndex((entry) => entry.level === level);
                if (slotIndex >= 0) slots[slotIndex] = { ...slots[slotIndex], [field]: value };
                else slots.push({ level, max: 0, used: 0, isPactMagic: false, [field]: value });
                update("spellSlots", slots.filter((entry) => entry.max > 0 || entry.level === level));
              };
              const hasSlot = slot.max > 0;
              const prevSlot = index === 0 ? null : (char.spellSlots || []).find((entry) => entry.level === index);
              const showRow = hasSlot || index === 0 || (prevSlot && prevSlot.max > 0);
              if (!showRow) return null;
              return (
                <div key={level} className="flex-row" style={{ gap: 14, marginBottom: 10 }}>
                  <div style={{ fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.12em", color: pal.textMuted, minWidth: 34, textTransform: "uppercase" }}>{label}</div>
                  <div className="flex-row" style={{ gap: 8 }}>
                    <label style={{ ...lbl, marginBottom: 0, fontSize: 11 }}>Max</label>
                    <input type="number" min={0} max={9} className="input-base" style={{ width: 70, textAlign: "center" }} value={slot.max} onChange={(e) => updateSlot("max", parseInt(e.target.value, 10) || 0)} />
                  </div>
                  <label className="flex-row" style={{ gap: 6, cursor: "pointer", fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted }}>
                    <input type="checkbox" checked={slot.isPactMagic || false} onChange={(e) => updateSlot("isPactMagic", e.target.checked)} style={{ accentColor: pal.accent }} />
                    Pact Magic
                  </label>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={lbl}>Key Spells & Abilities <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(comma-separated)</span></label>
            <input className="input-base" value={(char.spells || []).join(", ")} onChange={(e) => update("spells", e.target.value.split(",").map((spell) => spell.trim()).filter(Boolean))} placeholder="Hunter's Mark, Misty Step, Pass Without Trace…" />
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Skills</div>
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, marginBottom: 12, fontStyle: "italic" }}>
              Manually select the skills this character has.
            </div>
            <div className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
              {CHARACTER_SKILLS.map((key) => {
                const detail = getTalentDetail(key);
                const selected = (char.skills || []).includes(key);
                return (
                  <InfoBadge
                    key={key}
                    pal={pal}
                    label={detail.label}
                    tooltip={detail.description || detail.label}
                    selected={selected}
                    onSelect={() => {
                      const existing = char.skills || [];
                      update("skills", selected ? existing.filter((value) => value !== key) : [...existing, key]);
                    }}
                    color={selected ? pal.accentBright : pal.textMuted}
                    background={selected ? `${pal.accent}16` : "transparent"}
                    border={selected ? pal.accent : pal.border}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 40 }}>
            <div style={secHead}>Special Abilities</div>
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, marginBottom: 12, fontStyle: "italic" }}>
              Track class, race, or other standout features here for display on the sheet and campaign board.
            </div>
            <div className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
              {SPECIAL_ABILITIES.map((key) => {
                const detail = getTalentDetail(key);
                const selected = (char.specialAbilities || []).includes(key);
                return (
                  <InfoBadge
                    key={key}
                    pal={pal}
                    label={detail.label}
                    tooltip={detail.description || detail.label}
                    selected={selected}
                    onSelect={() => {
                      const existing = char.specialAbilities || [];
                      update("specialAbilities", selected ? existing.filter((value) => value !== key) : [...existing, key]);
                    }}
                    color={selected ? pal.gem : pal.textMuted}
                    background={selected ? `${pal.gem}16` : "transparent"}
                    border={selected ? pal.gem : pal.border}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 40 }}>
            <div style={secHead}>Persona Traits</div>
            {(char.inPlay || []).map((item, index) => (
              <div key={index} className="em-list-item-row">
                <input className="input-base" value={item} onChange={(e) => updateInPlay(index, e.target.value)} placeholder="A trait, ability, or behavioural note…" />
                <button onClick={() => removeInPlay(index)} className="btn-ghost" style={{ width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
            <button onClick={addInPlay} className="btn-ghost" style={{ width: "auto", padding: "7px 16px", marginTop: 4, color: pal.accentBright, borderStyle: "dashed" }}>
              + Add Trait
            </button>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div className="flex-row-spread" style={{ marginBottom: 12 }}>
              <div style={secHead}>Weapons</div>
              <button onClick={() => setEditingItem({ listType: "weapons", item: null })} className="btn-ghost" style={{ width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>+ Add Weapon</button>
            </div>
            {(char.weapons || []).length === 0 && (
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No weapons added.</div>
            )}
            {(char.weapons || []).map((item) => (
              <div key={item.id} className="em-item-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="em-item-name">{item.name}</div>
                  {item.mods?.length > 0 && (
                    <div className="em-item-mods">
                      {item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditingItem({ listType: "weapons", item })} className="btn-ghost" style={{ width: "auto", padding: "5px 12px", fontSize: 12, color: pal.accentBright }}>Edit</button>
                <button onClick={() => removeWeapon(item.id)} className="btn-ghost" style={{ width: 34, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 40 }}>
            <div className="flex-row-spread" style={{ marginBottom: 12 }}>
              <div style={secHead}>Equipment</div>
              <button onClick={() => setEditingItem({ listType: "equipment", item: null, showType: true })} className="btn-ghost" style={{ width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>+ Add Item</button>
            </div>
            {(char.equipment || []).length === 0 && (
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No equipment added.</div>
            )}
            {(char.equipment || []).map((item) => (
              <div key={item.id} className="em-item-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex-row" style={{ gap: 8, alignItems: "baseline" }}>
                    <span className="em-item-name">{item.name}</span>
                    {item.type && <span className="em-item-type-tag">{item.type}</span>}
                  </div>
                  {item.mods?.length > 0 && (
                    <div className="em-item-mods">
                      {item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditingItem({ listType: "equipment", item, showType: true })} className="btn-ghost" style={{ width: "auto", padding: "5px 12px", fontSize: 12, color: pal.accentBright }}>Edit</button>
                <button onClick={() => removeEquipment(item.id)} className="btn-ghost" style={{ width: 34, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
          </div>

          {/* Leveling Mode & XP */}
          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Leveling</div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Leveling Mode</label>
              <div style={{ display: "flex", gap: 0, border: `1px solid ${pal.border}`, borderRadius: 3, overflow: "hidden", width: "fit-content" }}>
                {["milestone", "xp"].map((mode) => {
                  const selected = (char.levelingMode || "milestone") === mode;
                  return (
                    <button key={mode} type="button" onClick={() => update("levelingMode", mode)} style={{ background: selected ? pal.accentDim : "transparent", border: "none", borderRight: mode === "milestone" ? `1px solid ${pal.border}` : "none", color: selected ? pal.accentBright : pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "8px 20px", cursor: "pointer" }}>
                      {mode === "milestone" ? "Milestone" : "XP"}
                    </button>
                  );
                })}
              </div>
            </div>
            {(char.levelingMode || "milestone") === "xp" && (
              <div>
                <label style={lbl}>Current XP</label>
                <input className="input-base" style={{ maxWidth: 200 }} type="number" min={0} value={char.xpCurrent ?? 0} onChange={(e) => update("xpCurrent", parseInt(e.target.value, 10) || 0)} placeholder="0" />
              </div>
            )}
          </div>

          {/* Coin */}
          <div style={{ marginBottom: 40 }}>
            <div style={secHead}>Coin</div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Coin Mode</label>
              <div style={{ display: "flex", gap: 0, border: `1px solid ${pal.border}`, borderRadius: 3, overflow: "hidden", width: "fit-content" }}>
                {[["gp", "GP Only"], ["full", "Full Denominations"]].map(([mode, label]) => {
                  const selected = (char.coinMode || "gp") === mode;
                  return (
                    <button key={mode} type="button" onClick={() => update("coinMode", mode)} style={{ background: selected ? pal.accentDim : "transparent", border: "none", borderRight: mode === "gp" ? `1px solid ${pal.border}` : "none", color: selected ? pal.accentBright : pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "8px 20px", cursor: "pointer" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {(char.coinMode || "gp") === "gp" ? (
              <div>
                <label style={lbl}>Gold Pieces (GP)</label>
                <input className="input-base" style={{ maxWidth: 200 }} type="number" min={0} value={(char.coin || {}).gp ?? 0} onChange={(e) => update("coin", { ...(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }), gp: parseInt(e.target.value, 10) || 0 })} placeholder="0" />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                {[["cp", "Copper (CP)", "#a07050"], ["sp", "Silver (SP)", "#9aabb8"], ["ep", "Electrum (EP)", "#8f8b80"], ["gp", "Gold (GP)", "#c8a040"], ["pp", "Platinum (PP)", "#c8d0e0"]].map(([denom, label, color]) => (
                  <div key={denom}>
                    <label style={{ ...lbl, color }}>{label}</label>
                    <input className="input-base" style={{ color }} type="number" min={0} value={(char.coin || {})[denom] ?? 0} onChange={(e) => update("coin", { ...(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }), [denom]: parseInt(e.target.value, 10) || 0 })} placeholder="0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {slug && (
            <div style={{ marginBottom: 40, borderTop: `1px solid ${pal.border}`, paddingTop: 32 }}>
              <div style={secHead}>Change Password</div>
              <ChangePasswordForm pal={pal} inputStyle={inputStyle} lbl={lbl} slug={slug} currentPassword={unlockedPassword} onSuccess={(newPwd) => setUnlockedPassword(newPwd)} />
            </div>
          )}

          <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 32 }}>
            <div className="flex-row-spread" style={{ marginBottom: 24 }}>
              <div style={secHead}>Collections & Sections</div>
              <button onClick={addCollection} className="btn-ghost" style={{ width: "auto", padding: "7px 18px", color: pal.accentBright, borderStyle: "dashed" }}>+ Add Collection</button>
            </div>

            {char.collections.map((collection) => (
              <div key={collection.id} style={{ marginBottom: 40 }}>
                <div className="flex-row" style={{ gap: 10, marginBottom: 16 }}>
                  <input className="input-base" style={{ fontFamily: pal.fontDisplay, fontSize: 15, letterSpacing: "0.06em", flex: 1 }} value={collection.label} onChange={(e) => updateCollection(collection.id, "label", e.target.value)} placeholder="Collection name…" />
                  <button onClick={() => removeCollection(collection.id)} className="btn-ghost" style={{ width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                </div>

                {collection.sections.map((section, index) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => onDragStart(collection.id, index)}
                    onDragOver={(e) => onDragOver(e, collection.id, index)}
                    onDrop={() => onDrop(collection.id, index)}
                    onDragEnd={() => { setDragInfo(null); setDragOver(null); }}
                    className="em-section-card"
                    style={{
                      border: `1px solid ${dragOver?.collectionId === collection.id && dragOver?.toIdx === index ? pal.accent : pal.border}`,
                      opacity: dragInfo?.collectionId === collection.id && dragInfo?.fromIdx === index ? 0.45 : 1,
                    }}
                  >
                    <div className="em-section-card-header">
                      <span style={{ cursor: "grab", paddingTop: 3 }}><DragHandle color={pal.accent} /></span>
                      <input className="input-base" style={{ fontFamily: pal.fontDisplay, letterSpacing: "0.04em", flex: 1 }} value={section.title} onChange={(e) => updateSection(collection.id, section.id, "title", e.target.value)} placeholder="Section title…" />
                      <button onClick={() => updateSection(collection.id, section.id, "type", section.type === "prose" ? "list" : "prose")} title="Toggle between prose and list" className="btn-ghost" style={{ width: "auto", padding: "6px 12px", fontSize: 11, flexShrink: 0, color: pal.textMuted, letterSpacing: "0.05em" }}>
                        {section.type === "prose" ? "¶ Prose" : "≡ List"}
                      </button>
                      <button onClick={() => removeSection(collection.id, section.id)} className="btn-ghost" style={{ width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                    </div>

                    {section.type === "prose" ? (
                      <textarea style={{ ...taStyle, minHeight: 110 }} value={section.content || ""} onChange={(e) => updateSection(collection.id, section.id, "content", e.target.value)} placeholder="Write this section…" />
                    ) : (
                      <div>
                        {(section.items || []).map((item, itemIndex) => (
                          <div key={itemIndex} className="em-list-item-row">
                            <input className="input-base" value={item} onChange={(e) => updateListItem(collection.id, section.id, itemIndex, e.target.value)} placeholder="List item…" />
                            <button onClick={() => removeListItem(collection.id, section.id, itemIndex)} className="btn-ghost" style={{ width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                          </div>
                        ))}
                        <button onClick={() => addListItem(collection.id, section.id)} className="btn-ghost" style={{ width: "auto", padding: "6px 14px", marginTop: 4, color: pal.accentBright, borderStyle: "dashed" }}>
                          + Add Item
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex-row" style={{ gap: 10, marginTop: 6 }}>
                  <button onClick={() => addSection(collection.id, "prose")} className="btn-ghost" style={{ width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>
                    + Add Prose Section
                  </button>
                  <button onClick={() => addSection(collection.id, "list")} className="btn-ghost" style={{ width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>
                    + Add List Section
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editingItem && (
        <ItemEditorModal
          item={editingItem.item}
          pal={pal}
          showType={editingItem.showType}
          onSave={(saved) => {
            if (editingItem.item) {
              if (editingItem.listType === "weapons") updateWeapon(saved.id, saved);
              else updateEquipment(saved.id, saved);
            } else if (editingItem.listType === "weapons") addWeapon(saved);
            else addEquipment(saved);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  );
}
