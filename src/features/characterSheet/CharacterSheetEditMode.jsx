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
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse at 30% 20%, ${pal.glow1} 0%, transparent 55%),
                       radial-gradient(ellipse at 75% 80%, ${pal.glow2} 0%, transparent 50%)`,
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "36px 28px 100px" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 36, paddingBottom: 22, borderBottom: `1px solid ${pal.border}`,
            flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ ...secHead, marginBottom: 4 }}>Character Sheet Editor</div>
              <div style={{ fontFamily: pal.fontDisplay, fontSize: 24, color: pal.text, letterSpacing: "0.04em" }}>
                {char.name || "Unnamed Character"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
              {slug && onSave && (
                <button
                  onClick={handleSave}
                  disabled={saveStatus === "saving"}
                  style={{
                    ...inputStyle, width: "auto", padding: "9px 22px",
                    background: saveStatus === "saved" ? pal.accentDim : pal.surface,
                    borderColor: saveStatus === "saved" ? pal.accent : pal.border,
                    color: saveStatus === "saved" ? pal.accentBright : pal.textMuted,
                    fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.08em",
                    opacity: saveStatus === "saving" ? 0.6 : 1,
                  }}
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "Error" : "Save"}
                </button>
              )}
              {!slug && onCreate && (
                <button onClick={() => onCreate(char)} style={{
                  ...inputStyle, width: "auto", padding: "9px 22px",
                  background: pal.accentDim, borderColor: pal.accent,
                  color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.08em",
                }}>
                  Create Character →
                </button>
              )}
              <div style={{ position: "relative", display: "inline-block" }}>
                <button onClick={() => setMenuOpen(!menuOpen)} style={{
                  ...inputStyle, width: "auto", padding: "9px 12px", fontSize: 16,
                  background: menuOpen ? pal.surfaceDim : "transparent",
                }}>
                  ⋯
                </button>
                {menuOpen && (
                  <div style={{
                    position: "absolute", top: "100%", right: 0, background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: 8, zIndex: 10, minWidth: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}>
                    <button onClick={() => { exportJSON(); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 14, cursor: "pointer", borderRadius: 2 }}>
                      Export JSON
                    </button>
                    {!slug && (
                      <button onClick={() => { importRef.current.click(); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 14, cursor: "pointer", borderRadius: 2 }}>
                        Import JSON
                      </button>
                    )}
                    {slug && onDelete && (
                      <button onClick={() => { handleDeleteRequest(); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: "none", color: "#f2b7b7", fontFamily: pal.fontUI, fontSize: 14, cursor: "pointer", borderRadius: 2 }}>
                        Delete Character
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setMode("view")} style={{
                ...inputStyle, width: "auto", padding: "9px 22px",
                background: pal.accentDim, borderColor: pal.accent,
                color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 15, letterSpacing: "0.08em",
              }}>
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
              <input value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder={deletePhrase} style={{ ...inputStyle, width: "100%", marginBottom: 16, background: pal.surfaceSolid }} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={cancelDelete} type="button" style={{ ...inputStyle, width: "auto", padding: "9px 18px", background: pal.surface, borderColor: pal.border, color: pal.textMuted }}>
                  Cancel
                </button>
                <button onClick={handleDelete} type="button" disabled={deleteInput !== deletePhrase || deleteStatus === "deleting"} style={{ ...inputStyle, flex: 1, padding: "9px 18px", background: deleteInput === deletePhrase ? "#b04a4a" : pal.surface, borderColor: deleteInput === deletePhrase ? "#c06060" : pal.border, color: deleteInput === deletePhrase ? "#fff" : pal.textMuted, cursor: deleteInput === deletePhrase ? "pointer" : "not-allowed" }}>
                  {deleteStatus === "deleting" ? "Deleting…" : "Delete Character"}
                </button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Color Theme</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              {(char.portraitUrl || char.portrait) && (
                <img src={char.portraitUrl || char.portrait} alt="portrait" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 4, border: `1px solid ${pal.border}`, flexShrink: 0 }} />
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePortrait} style={{ display: "none" }} />
                <button onClick={() => fileRef.current.click()} style={{ ...inputStyle, width: "auto", padding: "8px 18px" }}>
                  {(char.portraitUrl || char.portrait) ? "Change Image" : "Upload Image"}
                </button>
                {(char.portraitUrl || char.portrait) && (
                  <button onClick={() => { update("portrait", ""); update("portraitUrl", ""); }} style={{ ...inputStyle, width: "auto", padding: "8px 16px", color: pal.textMuted }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={lbl}>Portrait Tagline <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(shown beneath portrait image)</span></label>
            <input style={inputStyle} value={char.tagline || ""} onChange={(e) => update("tagline", e.target.value)} placeholder="A short italicised line shown beneath the portrait…" />
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
                    <select style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", MozAppearance: "none" }} value={char[field] || ""} onChange={(e) => update(field, e.target.value)}>
                      <option value="">{label}</option>
                      {(typeof options === "function" ? options() : options).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input style={inputStyle} value={char[field] || ""} onChange={(e) => update(field, e.target.value)} placeholder={label} />
                  )}
                </div>
              ))}
              <div>
                <label style={lbl}>Level</label>
                <input style={inputStyle} type="number" min={1} max={20} value={char.level || ""} onChange={(e) => update("level", parseInt(e.target.value, 10) || 1)} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Ability Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {char.stats.map((stat, index) => (
                <div key={index} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "12px 14px" }}>
                  <input style={{ ...inputStyle, marginBottom: 8, fontSize: 14 }} value={stat.stat} onChange={(e) => updateStat(index, "stat", e.target.value)} placeholder="Stat name" />
                  <input style={{ ...inputStyle, marginBottom: 8, fontSize: 24, textAlign: "center", fontFamily: pal.fontDisplay }} type="number" min={1} max={20} value={stat.score} onChange={(e) => updateStat(index, "score", e.target.value)} />
                  <input style={{ ...inputStyle, fontSize: 14, color: pal.textMuted }} value={stat.note} onChange={(e) => updateStat(index, "note", e.target.value)} placeholder="Short note…" />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Hit Points <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(max)</span></label>
                <input style={inputStyle} type="number" min={0} value={char.hpMax ?? char.hp ?? ""} onChange={(e) => update("hpMax", parseInt(e.target.value, 10) || 0)} placeholder="e.g. 38" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
              <div>
                <label style={{ ...lbl, marginBottom: 10 }}>Armor & Speed</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                <input style={inputStyle} type="number" min={0} value={char.armorTotal ?? ""} onChange={(e) => update("armorTotal", parseInt(e.target.value, 10) || 0)} placeholder="e.g. 16" />
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
                <div key={level} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                  <div style={{ fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.12em", color: pal.textMuted, minWidth: 34, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ ...lbl, marginBottom: 0, fontSize: 11 }}>Max</label>
                    <input type="number" min={0} max={9} style={{ ...inputStyle, width: 70, textAlign: "center" }} value={slot.max} onChange={(e) => updateSlot("max", parseInt(e.target.value, 10) || 0)} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted }}>
                    <input type="checkbox" checked={slot.isPactMagic || false} onChange={(e) => updateSlot("isPactMagic", e.target.checked)} style={{ accentColor: pal.accent }} />
                    Pact Magic
                  </label>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={lbl}>Key Spells & Abilities <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(comma-separated)</span></label>
            <input style={inputStyle} value={(char.spells || []).join(", ")} onChange={(e) => update("spells", e.target.value.split(",").map((spell) => spell.trim()).filter(Boolean))} placeholder="Hunter's Mark, Misty Step, Pass Without Trace…" />
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Skills</div>
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, marginBottom: 12, fontStyle: "italic" }}>
              Manually select the skills this character has.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CHARACTER_SKILLS.map((key) => {
                const detail = getTalentDetail(key);
                const selected = (char.skills || []).includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    title={detail.description}
                    onClick={() => {
                      const existing = char.skills || [];
                      update("skills", selected ? existing.filter((value) => value !== key) : [...existing, key]);
                    }}
                    style={{
                      background: selected ? `${pal.accent}16` : "transparent",
                      border: `1px solid ${selected ? pal.accent : pal.border}`,
                      borderRadius: 12,
                      padding: "6px 12px",
                      color: selected ? pal.accentBright : pal.textMuted,
                      fontFamily: pal.fontUI,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {detail.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 40 }}>
            <div style={secHead}>Special Abilities</div>
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, marginBottom: 12, fontStyle: "italic" }}>
              Track class, race, or other standout features here for display on the sheet and campaign board.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SPECIAL_ABILITIES.map((key) => {
                const detail = getTalentDetail(key);
                const selected = (char.specialAbilities || []).includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    title={detail.description}
                    onClick={() => {
                      const existing = char.specialAbilities || [];
                      update("specialAbilities", selected ? existing.filter((value) => value !== key) : [...existing, key]);
                    }}
                    style={{
                      background: selected ? `${pal.gem}16` : "transparent",
                      border: `1px solid ${selected ? pal.gem : pal.border}`,
                      borderRadius: 12,
                      padding: "6px 12px",
                      color: selected ? pal.gem : pal.textMuted,
                      fontFamily: pal.fontUI,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {detail.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 40 }}>
            <div style={secHead}>Persona Traits</div>
            {(char.inPlay || []).map((item, index) => (
              <div key={index} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={inputStyle} value={item} onChange={(e) => updateInPlay(index, e.target.value)} placeholder="A trait, ability, or behavioural note…" />
                <button onClick={() => removeInPlay(index)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
            <button onClick={addInPlay} style={{ ...inputStyle, width: "auto", padding: "7px 16px", marginTop: 4, color: pal.accentBright, borderStyle: "dashed" }}>
              + Add Trait
            </button>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secHead}>Weapons</div>
              <button onClick={() => setEditingItem({ listType: "weapons", item: null })} style={{ ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>+ Add Weapon</button>
            </div>
            {(char.weapons || []).length === 0 && (
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No weapons added.</div>
            )}
            {(char.weapons || []).map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text }}>{item.name}</div>
                  {item.mods?.length > 0 && (
                    <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.textMuted, marginTop: 2 }}>
                      {item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditingItem({ listType: "weapons", item })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12, color: pal.accentBright }}>Edit</button>
                <button onClick={() => removeWeapon(item.id)} style={{ ...inputStyle, width: 34, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secHead}>Equipment</div>
              <button onClick={() => setEditingItem({ listType: "equipment", item: null, showType: true })} style={{ ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>+ Add Item</button>
            </div>
            {(char.equipment || []).length === 0 && (
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No equipment added.</div>
            )}
            {(char.equipment || []).map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text }}>{item.name}</span>
                    {item.type && <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.accent, opacity: 0.7 }}>{item.type}</span>}
                  </div>
                  {item.mods?.length > 0 && (
                    <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.textMuted, marginTop: 2 }}>
                      {item.mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditingItem({ listType: "equipment", item, showType: true })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12, color: pal.accentBright }}>Edit</button>
                <button onClick={() => removeEquipment(item.id)} style={{ ...inputStyle, width: 34, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
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
                <input style={{ ...inputStyle, maxWidth: 200 }} type="number" min={0} value={char.xpCurrent ?? 0} onChange={(e) => update("xpCurrent", parseInt(e.target.value, 10) || 0)} placeholder="0" />
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
                <input style={{ ...inputStyle, maxWidth: 200 }} type="number" min={0} value={(char.coin || {}).gp ?? 0} onChange={(e) => update("coin", { ...(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }), gp: parseInt(e.target.value, 10) || 0 })} placeholder="0" />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                {[["cp", "Copper (CP)", "#a07050"], ["sp", "Silver (SP)", "#9aabb8"], ["ep", "Electrum (EP)", "#8f8b80"], ["gp", "Gold (GP)", "#c8a040"], ["pp", "Platinum (PP)", "#c8d0e0"]].map(([denom, label, color]) => (
                  <div key={denom}>
                    <label style={{ ...lbl, color }}>{label}</label>
                    <input style={{ ...inputStyle, color }} type="number" min={0} value={(char.coin || {})[denom] ?? 0} onChange={(e) => update("coin", { ...(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }), [denom]: parseInt(e.target.value, 10) || 0 })} placeholder="0" />
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={secHead}>Collections & Sections</div>
              <button onClick={addCollection} style={{ ...inputStyle, width: "auto", padding: "7px 18px", color: pal.accentBright, borderStyle: "dashed" }}>+ Add Collection</button>
            </div>

            {char.collections.map((collection) => (
              <div key={collection.id} style={{ marginBottom: 40 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                  <input style={{ ...inputStyle, fontFamily: pal.fontDisplay, fontSize: 15, letterSpacing: "0.06em", flex: 1 }} value={collection.label} onChange={(e) => updateCollection(collection.id, "label", e.target.value)} placeholder="Collection name…" />
                  <button onClick={() => removeCollection(collection.id)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                </div>

                {collection.sections.map((section, index) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => onDragStart(collection.id, index)}
                    onDragOver={(e) => onDragOver(e, collection.id, index)}
                    onDrop={() => onDrop(collection.id, index)}
                    onDragEnd={() => { setDragInfo(null); setDragOver(null); }}
                    style={{
                      background: pal.surface,
                      border: `1px solid ${dragOver?.collectionId === collection.id && dragOver?.toIdx === index ? pal.accent : pal.border}`,
                      borderRadius: 4,
                      padding: 14,
                      marginBottom: 10,
                      opacity: dragInfo?.collectionId === collection.id && dragInfo?.fromIdx === index ? 0.45 : 1,
                      transition: "border-color 0.15s, opacity 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                      <span style={{ cursor: "grab", paddingTop: 3 }}><DragHandle color={pal.accent} /></span>
                      <input style={{ ...inputStyle, fontFamily: pal.fontDisplay, letterSpacing: "0.04em", flex: 1 }} value={section.title} onChange={(e) => updateSection(collection.id, section.id, "title", e.target.value)} placeholder="Section title…" />
                      <button onClick={() => updateSection(collection.id, section.id, "type", section.type === "prose" ? "list" : "prose")} title="Toggle between prose and list" style={{ ...inputStyle, width: "auto", padding: "6px 12px", fontSize: 11, flexShrink: 0, color: pal.textMuted, letterSpacing: "0.05em" }}>
                        {section.type === "prose" ? "¶ Prose" : "≡ List"}
                      </button>
                      <button onClick={() => removeSection(collection.id, section.id)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                    </div>

                    {section.type === "prose" ? (
                      <textarea style={{ ...taStyle, minHeight: 110 }} value={section.content || ""} onChange={(e) => updateSection(collection.id, section.id, "content", e.target.value)} placeholder="Write this section…" />
                    ) : (
                      <div>
                        {(section.items || []).map((item, itemIndex) => (
                          <div key={itemIndex} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <input style={inputStyle} value={item} onChange={(e) => updateListItem(collection.id, section.id, itemIndex, e.target.value)} placeholder="List item…" />
                            <button onClick={() => removeListItem(collection.id, section.id, itemIndex)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                          </div>
                        ))}
                        <button onClick={() => addListItem(collection.id, section.id)} style={{ ...inputStyle, width: "auto", padding: "6px 14px", marginTop: 4, color: pal.accentBright, borderStyle: "dashed" }}>
                          + Add Item
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button onClick={() => addSection(collection.id, "prose")} style={{ ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>
                    + Add Prose Section
                  </button>
                  <button onClick={() => addSection(collection.id, "list")} style={{ ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>
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
