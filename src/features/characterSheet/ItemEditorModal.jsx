import { useState } from "react";
import { MOD_ATTRIBUTES, uid } from "./constants";

export const ITEM_TYPE_OPTIONS = [
  { value: "", label: "(none)" },
  { value: "armor", label: "Armor" },
  { value: "shield", label: "Shield" },
  { value: "wondrous", label: "Wondrous" },
  { value: "potion", label: "Potion" },
  { value: "tool", label: "Tool" },
  { value: "ammunition", label: "Ammunition" },
  { value: "quest", label: "Quest" },
  { value: "other", label: "Other" },
];

export function itemTypeLabel(value) {
  const opt = ITEM_TYPE_OPTIONS.find((o) => o.value === (value || "").toLowerCase());
  return opt ? opt.label : value || "";
}

export default function ItemEditorModal({ item, pal, onSave, onClose, showType }) {
  const [name, setName] = useState(item?.name || "");
  const [desc, setDesc] = useState(item?.description || "");
  const [mods, setMods] = useState(item?.mods || []);
  const [type, setType] = useState(() => {
    const raw = item?.type || "";
    // Normalize legacy free-text values to lowercase for select matching
    return ITEM_TYPE_OPTIONS.find((o) => o.value === raw.toLowerCase()) ? raw.toLowerCase() : "";
  });
  const [requiresAttunement, setRequiresAttunement] = useState(item?.requiresAttunement || false);
  const [attuned, setAttuned] = useState(item?.attuned || false);
  const [trackQty, setTrackQty] = useState(item?.qty != null);
  const [qty, setQty] = useState(item?.qty ?? 1);
  const [equipped, setEquipped] = useState(item?.equipped !== false);

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
    const saved = {
      // Spread existing item to preserve any fields not managed by this modal,
      // then override with the current editor state.
      ...(item || {}),
      id: item?.id || uid(),
      name: name.trim(),
      description: desc.trim(),
      mods,
      ...(showType ? { type } : {}),
      equipped,
    };
    // Attunement
    if (requiresAttunement) {
      saved.requiresAttunement = true;
      saved.attuned = attuned;
    } else {
      delete saved.requiresAttunement;
      delete saved.attuned;
    }
    // Quantity
    if (trackQty) {
      saved.qty = Math.max(0, parseInt(qty, 10) || 0);
    } else {
      delete saved.qty;
    }
    onSave(saved);
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
              <select
                style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none" }}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {ITEM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Attunement */}
        <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 14, marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: requiresAttunement ? 8 : 0 }}>
            <input
              type="checkbox"
              checked={requiresAttunement}
              onChange={(e) => {
                setRequiresAttunement(e.target.checked);
                if (!e.target.checked) setAttuned(false);
              }}
              style={{ width: 15, height: 15, accentColor: pal.accent, cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{ ...lbl, display: "inline", marginBottom: 0, color: requiresAttunement ? pal.accentBright : pal.textMuted }}>Requires Attunement</span>
          </label>
          {requiresAttunement && (
            <div style={{ paddingLeft: 25 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={attuned}
                  onChange={(e) => setAttuned(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: pal.accent, cursor: "pointer", flexShrink: 0 }}
                />
                <span style={{ ...lbl, display: "inline", marginBottom: 0, color: attuned ? pal.accentBright : pal.textMuted }}>Currently Attuned</span>
              </label>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 14, marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: trackQty ? 8 : 0 }}>
            <input
              type="checkbox"
              checked={trackQty}
              onChange={(e) => {
                setTrackQty(e.target.checked);
                if (e.target.checked && (qty == null || qty === "")) setQty(1);
              }}
              style={{ width: 15, height: 15, accentColor: pal.accent, cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{ ...lbl, display: "inline", marginBottom: 0, color: trackQty ? pal.accentBright : pal.textMuted }}>Track Quantity</span>
          </label>
          {trackQty && (
            <div style={{ paddingLeft: 25, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ ...lbl, display: "inline", marginBottom: 0 }}>Current qty</span>
              <input
                type="number"
                min={0}
                step={1}
                value={qty}
                onChange={(e) => setQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 14, padding: "6px 10px", outline: "none", width: 72 }}
              />
            </div>
          )}
        </div>

        {/* Equipped */}
        <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 14, marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={equipped}
              onChange={(e) => setEquipped(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: pal.accent, cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{ ...lbl, display: "inline", marginBottom: 0, color: equipped ? pal.accentBright : pal.textMuted }}>Equipped / In use</span>
          </label>
          <div style={{ paddingLeft: 25, fontFamily: pal.fontBody, fontSize: 12, color: pal.textMuted, marginTop: 4, fontStyle: "italic" }}>
            Unequipped items don't contribute mods to stats.
          </div>
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
