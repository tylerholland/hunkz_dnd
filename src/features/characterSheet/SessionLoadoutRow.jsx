import ItemTypeIcon from "./ItemTypeIcon";
import { ITEM_TYPE_ICON_LABELS, itemIconType } from "./sessionLoadout";
import "./sessionLoadout.css";

// Story 58 follow-up — a Loadout row. Tapping the name opens the item editor
// (edit / delete); the chip toggles equipped without opening anything.
export default function SessionLoadoutRow({ item, kind, enterProps = {}, onEdit, onToggleEquipped }) {
  const isEquipped = item.equipped !== false;
  const iconType = itemIconType(kind, item);
  return (
    <div
      className={`cs-sm-ld-row${isEquipped ? "" : " stowed"}${enterProps.className ? ` ${enterProps.className}` : ""}`}
      style={enterProps.style}
    >
      <button type="button" className="cs-sm-ld-name" onClick={onEdit} title={`Edit ${item.name}`}>
        {item.name}
      </button>
      {item.requiresAttunement && (
        <span
          className={`cs-sm-ld-attune${item.attuned ? " on" : ""}`}
          title={item.attuned ? "Attuned" : "Requires attunement"}
        />
      )}
      {item.qty != null && <span className="cs-sm-ld-qty">×{item.qty}</span>}
      <button
        type="button"
        className={`cs-sm-ld-equip${isEquipped ? " on" : ""}`}
        onClick={onToggleEquipped}
        aria-pressed={isEquipped}
        aria-label={`${isEquipped ? "Unequip" : "Equip"} ${item.name}`}
        title={`${ITEM_TYPE_ICON_LABELS[iconType]} · ${isEquipped ? "Equipped — click to stow" : "Stowed — click to equip"}`}
      >
        <ItemTypeIcon type={iconType} filled={isEquipped} />
      </button>
    </div>
  );
}
