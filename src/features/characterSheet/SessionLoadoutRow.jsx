import ItemEquipToggle from "./ItemEquipToggle";
import "./sessionLoadout.css";

// Story 58 follow-up — a Loadout row, laid out like the profile Inventory:
// equip icon on the left, expand caret on the right. Expanding shows the
// description and modifiers inline, with Use Item for qty-tracked items. A
// pencil (Edit) appears beside the caret on hover.
export default function SessionLoadoutRow({ item, kind, enterProps = {}, expanded = false, onToggleExpand, onEdit, onToggleEquipped, onUse, onAdjustQty }) {
  const isEquipped = item.equipped !== false;
  const canUse = !!onUse && item.qty != null && item.qty > 0;
  const toggle = () => { if (expandable) onToggleExpand?.(); };
  const mods = (item.mods || []).filter((mod) => mod && mod.attribute && String(mod.value ?? "").trim() !== "");
  const hasQty = item.qty != null;
  // Only rows with something behind them expand; the caret's slot stays
  // reserved either way so the edit pencil never shifts position.
  const expandable = !!item.description || mods.length > 0 || hasQty;
  const isOpen = expandable && expanded;
  return (
    <div
      className={`cs-sm-ld-row${isEquipped ? "" : " stowed"}${isOpen ? " expanded" : ""}${enterProps.className ? ` ${enterProps.className}` : ""}`}
      style={enterProps.style}
    >
      <div className="cs-sm-ld-main">
        <ItemEquipToggle item={item} kind={kind} onToggle={onToggleEquipped} />
        <button
          type="button"
          className={`cs-sm-ld-name${expandable ? "" : " static"}`}
          onClick={toggle}
          aria-expanded={expandable ? isOpen : undefined}
        >
          <span className="cs-sm-ld-name-text">
            {item.name}
            {hasQty && item.qty !== 1 && <span className={`cs-sm-ld-qty${item.qty === 0 ? " depleted" : ""}`}> ({item.qty})</span>}
          </span>
          {item.requiresAttunement && (
            <span
              className={`cs-sm-ld-attune${item.attuned ? " on" : ""}`}
              title={item.attuned ? "Attuned" : "Requires attunement"}
            />
          )}
        </button>
        {/* Edit — pencil revealed on row hover/focus (always shown when
            expanded, and on touch screens that can't hover) */}
        <button
          type="button"
          className="cs-sm-ld-edit"
          onClick={onEdit}
          aria-label={`Edit ${item.name}`}
          title="Edit"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.2 2.3a1.6 1.6 0 0 1 2.3 0l.2.2a1.6 1.6 0 0 1 0 2.3L5.6 12.9 2.2 13.8l.9-3.4Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="m10 3.5 2.5 2.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
        {expandable ? (
          <button
            type="button"
            className="cs-sm-ld-caret"
            onClick={toggle}
            aria-label={isOpen ? `Collapse ${item.name}` : `Expand ${item.name}`}
            tabIndex={-1}
          >{isOpen ? "▲" : "▼"}</button>
        ) : (
          <span className="cs-sm-ld-caret cs-sm-ld-caret--empty" aria-hidden="true" />
        )}
      </div>
      {isOpen && (
        <div className="cs-sm-ld-details">
          {hasQty && (
            <div className="cs-sm-ld-qtyrow">
              <span className="cs-sm-ld-qtylabel">Quantity:</span>
              <button type="button" className="cs-sm-ld-qtybtn" onClick={() => onAdjustQty?.(-1)} disabled={!onAdjustQty || item.qty <= 0} aria-label={`Decrease ${item.name} quantity`}>−</button>
              <span className={`cs-sm-ld-qtyvalue${item.qty === 0 ? " depleted" : ""}`} aria-live="polite">{item.qty}</span>
              <button type="button" className="cs-sm-ld-qtybtn" onClick={() => onAdjustQty?.(1)} disabled={!onAdjustQty} aria-label={`Increase ${item.name} quantity`}>+</button>
            </div>
          )}
          {item.description && <div className="cs-sm-ld-desc">{item.description}</div>}
          {mods.length > 0 && (
            <div className="cs-sm-ld-mods">{mods.map((mod) => `${mod.attribute} ${mod.value}`).join(" · ")}</div>
          )}
          {canUse && (
            <div className="cs-sm-ld-actions">
              <button type="button" className="cs-sm-ld-action" onClick={onUse} title="Use one">Use Item</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
