import ItemEquipToggle from "./ItemEquipToggle";
import "./sessionLoadout.css";

// Story 58 follow-up — a Loadout row, laid out like the profile Inventory:
// equip icon on the left, expand caret on the right. Expanding shows the
// description and modifiers inline, with Use Item (qty-tracked items) and Edit.
export default function SessionLoadoutRow({ item, kind, enterProps = {}, expanded = false, onToggleExpand, onEdit, onToggleEquipped, onUse }) {
  const isEquipped = item.equipped !== false;
  const canUse = !!onUse && item.qty != null && item.qty > 0;
  const mods = (item.mods || []).filter((mod) => mod && mod.attribute && String(mod.value ?? "").trim() !== "");
  return (
    <div
      className={`cs-sm-ld-row${isEquipped ? "" : " stowed"}${expanded ? " expanded" : ""}${enterProps.className ? ` ${enterProps.className}` : ""}`}
      style={enterProps.style}
    >
      <div className="cs-sm-ld-main">
        <ItemEquipToggle item={item} kind={kind} onToggle={onToggleEquipped} />
        <button
          type="button"
          className="cs-sm-ld-name"
          onClick={onToggleExpand}
          aria-expanded={expanded}
        >
          <span className="cs-sm-ld-name-text">{item.name}</span>
          {item.qty != null && <span className={`cs-sm-ld-qty${item.qty === 0 ? " depleted" : ""}`}>×{item.qty}</span>}
          {item.requiresAttunement && (
            <span
              className={`cs-sm-ld-attune${item.attuned ? " on" : ""}`}
              title={item.attuned ? "Attuned" : "Requires attunement"}
            />
          )}
          <span className="cs-sm-ld-caret" aria-hidden="true">{expanded ? "▲" : "▼"}</span>
        </button>
      </div>
      {expanded && (
        <div className="cs-sm-ld-details">
          {item.description && <div className="cs-sm-ld-desc">{item.description}</div>}
          {mods.length > 0 && (
            <div className="cs-sm-ld-mods">{mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</div>
          )}
          <div className="cs-sm-ld-actions">
            {canUse && (
              <button type="button" className="cs-sm-ld-action" onClick={onUse} title="Use one">Use Item</button>
            )}
            <button type="button" className="cs-sm-ld-action" onClick={onEdit}>Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}
