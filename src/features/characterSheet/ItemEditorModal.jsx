import { useState } from "react";
import { DESCRIPTION_MAX_LENGTH, MOD_ATTRIBUTES, uid } from "./constants";

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

// `seed` pre-fills a NEW item (Story 58 quick-add ⋯) without switching the
// modal into edit mode the way `item` does.
export default function ItemEditorModal({ item, seed, pal, onSave, onClose, onDelete, showType }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(item?.name || seed?.name || "");
  const [desc, setDesc] = useState(item?.description || "");
  const [mods, setMods] = useState(item?.mods || []);
  const [type, setType] = useState(() => {
    const raw = item?.type || "";
    // Normalize legacy free-text values to lowercase for select matching
    return ITEM_TYPE_OPTIONS.find((o) => o.value === raw.toLowerCase()) ? raw.toLowerCase() : "";
  });
  const [requiresAttunement, setRequiresAttunement] = useState(item?.requiresAttunement || false);
  const [attuned, setAttuned] = useState(item?.attuned || false);
  const hadQty = (item?.qty ?? seed?.qty) != null;
  const [qty, setQty] = useState(item?.qty ?? seed?.qty ?? 1);
  // Existing items keep their state (absent = equipped, legacy); new items start stowed.
  const [equipped, setEquipped] = useState(item ? item.equipped !== false : false);

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
    // Quantity — tracked when it already was, when it isn't the default 1,
    // or for consumable types, so a lone Rope doesn't start carrying qty: 1.
    const qtyValue = Math.max(0, parseInt(qty, 10) || 0);
    const consumable = ["potion", "ammunition"].includes(showType ? type : item?.type);
    if (hadQty || qtyValue !== 1 || consumable) {
      saved.qty = qtyValue;
    } else {
      delete saved.qty;
    }
    onSave(saved);
  }

  // Palette CSS variables — set on the overlay so all children can use var(--pal-*)
  // ItemEditorModal renders outside the rootWrap context so it sets its own vars.
  const palVars = {
    "--pal-bg":            pal.bg,
    "--pal-surface":       pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border":        pal.border,
    "--pal-accent":        pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim":    pal.accentDim,
    "--pal-text":          pal.text,
    "--pal-text-body":     pal.textBody,
    "--pal-text-muted":    pal.textMuted,
    "--pal-glow-1":        pal.glow1,
    "--pal-glow-2":        pal.glow2,
    "--pal-gem":           pal.gem,
    "--pal-gem-low":       pal.gemLow,
  };

  return (
    <div className="modal-overlay" style={palVars}>
      <div className="em-modal-panel">
        <div className="em-modal-heading">
          {item ? "Edit Item" : "New Item"}
        </div>

        <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: showType ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div>
            <label className="label-ui" style={{ marginBottom: 5 }}>Name</label>
            <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Cloak of Protection…" />
          </div>
          {showType && (
            <div>
              <label className="label-ui" style={{ marginBottom: 5 }}>Type <span style={{ opacity: 0.5, textTransform: "none", fontSize: 11, letterSpacing: 0 }}>(optional)</span></label>
              <select
                className="input-base"
                style={{ appearance: "none", WebkitAppearance: "none" }}
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
        <div className="em-toggle-row">
          <label className="em-toggle-label" style={{ marginBottom: requiresAttunement ? 8 : 0 }}>
            <input
              type="checkbox"
              checked={requiresAttunement}
              onChange={(e) => {
                setRequiresAttunement(e.target.checked);
                if (!e.target.checked) setAttuned(false);
              }}
              className="em-checkbox"
              style={{ accentColor: pal.accent }}
            />
            <span className="label-ui" style={{ display: "inline", marginBottom: 0, color: requiresAttunement ? pal.accentBright : undefined }}>Requires Attunement</span>
          </label>
          {requiresAttunement && (
            <div style={{ paddingLeft: 25 }}>
              <label className="em-toggle-label">
                <input
                  type="checkbox"
                  checked={attuned}
                  onChange={(e) => setAttuned(e.target.checked)}
                  className="em-checkbox"
                  style={{ accentColor: pal.accent }}
                />
                <span className="label-ui" style={{ display: "inline", marginBottom: 0, color: attuned ? pal.accentBright : undefined }}>Currently Attuned</span>
              </label>
            </div>
          )}
        </div>

        {/* Quantity — always visible; see handleSave for when it's stored */}
        <div className="em-toggle-row">
          <div className="flex-row" style={{ gap: 10 }}>
            <span className="label-ui" style={{ display: "inline", marginBottom: 0 }}>Quantity</span>
            <button
              type="button"
              className="em-qty-btn"
              onClick={() => setQty((value) => Math.max(0, (parseInt(value, 10) || 0) - 1))}
              aria-label="Decrease quantity"
              style={{ border: `1px solid ${pal.border}`, color: pal.accentBright }}
            >−</button>
            <input
              type="number"
              min={0}
              step={1}
              value={qty}
              aria-label="Quantity"
              onChange={(e) => setQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 14, padding: "6px 10px", outline: "none", width: 64, textAlign: "center" }}
            />
            <button
              type="button"
              className="em-qty-btn"
              onClick={() => setQty((value) => (parseInt(value, 10) || 0) + 1)}
              aria-label="Increase quantity"
              style={{ border: `1px solid ${pal.border}`, color: pal.accentBright }}
            >+</button>
          </div>
        </div>

        {/* Equipped */}
        <div className="em-toggle-row">
          <label className="em-toggle-label">
            <input
              type="checkbox"
              checked={equipped}
              onChange={(e) => setEquipped(e.target.checked)}
              className="em-checkbox"
              style={{ accentColor: pal.accent }}
            />
            <span className="label-ui" style={{ display: "inline", marginBottom: 0, color: equipped ? pal.accentBright : undefined }}>Equipped / In use</span>
          </label>
          <div className="em-toggle-hint">
            Unequipped items don't contribute mods to stats.
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="label-ui" style={{ marginBottom: 5 }}>Description <span style={{ opacity: 0.5, textTransform: "none", fontSize: 11, letterSpacing: 0 }}>(shown on tap)</span></label>
          <textarea
            className="input-base"
            style={{ resize: "vertical", minHeight: 80, lineHeight: 1.6 }}
            maxLength={DESCRIPTION_MAX_LENGTH}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the item…"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="em-mod-header">
            <label className="label-ui" style={{ marginBottom: 0 }}>Modifiers</label>
            <button onClick={addMod} className="em-add-mod-btn">+ Add Mod</button>
          </div>
          {mods.length === 0 && (
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>No modifiers — click Add Mod to add one.</div>
          )}
          {mods.map((mod, index) => (
            <div key={index} className="em-mod-row">
              <select
                value={mod.attribute}
                onChange={(e) => updateMod(index, "attribute", e.target.value)}
                className="input-base"
                style={{ width: "auto", flex: 2, appearance: "none", WebkitAppearance: "none" }}
              >
                {MOD_ATTRIBUTES.map((attribute) => <option key={attribute} value={attribute}>{attribute}</option>)}
              </select>
              <input
                className="input-base"
                style={{ flex: 1, textAlign: "center" }}
                value={mod.value}
                onChange={(e) => updateMod(index, "value", e.target.value)}
                placeholder={mod.attribute === "Attack Bonus" ? "total (mod+prof+magic)" : mod.attribute === "Damage" ? "e.g. 1d8+3" : "+2"}
                title={mod.attribute === "Attack Bonus" ? "Enter the total attack bonus: ability modifier + proficiency bonus + any magic item bonus (e.g. STR +3, proficiency +2, magic +1 = enter +6)" : undefined}
              />
              <button onClick={() => removeMod(index)} className="em-remove-btn">×</button>
            </div>
          ))}
        </div>

        <div className="em-modal-actions">
          {onDelete && (
            <button
              type="button"
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              className="btn-ghost em-delete-btn"
              style={{ flex: 1, color: "#c06060", borderColor: confirmDelete ? "#c06060" : undefined }}
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="btn-primary"
            style={{
              flex: 2,
              opacity: !name.trim() ? 0.5 : 1,
            }}
          >
            {item ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
