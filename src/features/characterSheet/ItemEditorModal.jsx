import { useState } from "react";
import { MOD_ATTRIBUTES, uid } from "./constants";

export default function ItemEditorModal({ item, pal, onSave, onClose, showType }) {
  const [name, setName] = useState(item?.name || "");
  const [desc, setDesc] = useState(item?.description || "");
  const [mods, setMods] = useState(item?.mods || []);
  const [type, setType] = useState(item?.type || "");

  const inputStyle = {
    background: pal.surface,
    border: `1px solid ${pal.border}`,
    borderRadius: 3,
    color: pal.text,
    fontFamily: pal.fontBody,
    fontSize: 15,
    padding: "8px 12px",
    width: "100%",
    outline: "none",
  };

  const lbl = {
    fontFamily: pal.fontUI,
    fontSize: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: pal.textMuted,
    display: "block",
    marginBottom: 5,
  };

  const addMod = () => setMods((m) => [...m, { attribute: MOD_ATTRIBUTES[0], value: "" }]);
  const removeMod = (index) => setMods((m) => m.filter((_, idx) => idx !== index));
  const updateMod = (index, field, value) => {
    setMods((m) => m.map((mod, idx) => idx !== index ? mod : { ...mod, [field]: value }));
  };

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      id: item?.id || uid(),
      name: name.trim(),
      description: desc.trim(),
      mods,
      ...(showType ? { type: type.trim() } : {}),
    });
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 200,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: pal.surfaceSolid,
        border: `1px solid ${pal.border}`,
        borderRadius: 6,
        padding: "28px 24px",
        width: "100%",
        maxWidth: 480,
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 20 }}>
          {item ? "Edit Item" : "New Item"}
        </div>

        <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: showType ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div>
            <label style={lbl}>Name</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Cloak of Protection…" />
          </div>
          {showType && (
            <div>
              <label style={lbl}>Type <span style={{ opacity: 0.5, textTransform: "none", fontSize: 11, letterSpacing: 0 }}>(optional)</span></label>
              <input style={inputStyle} value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Armour, Potion…" />
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Description <span style={{ opacity: 0.5, textTransform: "none", fontSize: 11, letterSpacing: 0 }}>(shown on tap)</span></label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 80, lineHeight: 1.6 }}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the item…"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <label style={{ ...lbl, marginBottom: 0 }}>Modifiers</label>
            <button onClick={addMod} style={{
              background: "transparent",
              border: `1px dashed ${pal.border}`,
              borderRadius: 3,
              color: pal.accentBright,
              fontFamily: pal.fontBody,
              fontSize: 13,
              padding: "4px 12px",
              cursor: "pointer",
            }}>+ Add Mod</button>
          </div>
          {mods.length === 0 && (
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>No modifiers — click Add Mod to add one.</div>
          )}
          {mods.map((mod, index) => (
            <div key={index} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <select
                value={mod.attribute}
                onChange={(e) => updateMod(index, "attribute", e.target.value)}
                style={{ ...inputStyle, width: "auto", flex: 2, appearance: "none", WebkitAppearance: "none" }}
              >
                {MOD_ATTRIBUTES.map((attribute) => <option key={attribute} value={attribute}>{attribute}</option>)}
              </select>
              <input
                style={{ ...inputStyle, flex: 1, textAlign: "center" }}
                value={mod.value}
                onChange={(e) => updateMod(index, "value", e.target.value)}
                placeholder={mod.attribute === "Attack Bonus" ? "total (mod+prof+magic)" : mod.attribute === "Damage" ? "e.g. 1d8+3" : "+2"}
                title={mod.attribute === "Attack Bonus" ? "Enter the total attack bonus: ability modifier + proficiency bonus + any magic item bonus (e.g. STR +3, proficiency +2, magic +1 = enter +6)" : undefined}
              />
              <button onClick={() => removeMod(index)} style={{
                background: "transparent",
                border: `1px solid ${pal.border}`,
                borderRadius: 3,
                color: pal.textMuted,
                fontFamily: pal.fontBody,
                fontSize: 18,
                width: 34,
                height: 34,
                cursor: "pointer",
                flexShrink: 0,
              }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...inputStyle, width: "auto", flex: 1, padding: "9px 16px", cursor: "pointer", textAlign: "center" }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            ...inputStyle,
            flex: 2,
            padding: "10px 16px",
            textAlign: "center",
            background: pal.accentDim,
            borderColor: pal.accent,
            color: pal.accentBright,
            fontFamily: pal.fontUI,
            letterSpacing: "0.08em",
            cursor: "pointer",
            opacity: !name.trim() ? 0.5 : 1,
          }}>
            {item ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
