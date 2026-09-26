import ItemTypeIcon from "./ItemTypeIcon";
import { ITEM_TYPE_ICON_LABELS, itemIconType } from "./sessionLoadout";
import "./sessionLoadout.css";

// Leading equip toggle shared by the Session Loadout and profile Inventory
// rows: the item's type icon, solid when equipped, outline when stowed.
export default function ItemEquipToggle({ item, kind, onToggle }) {
  const isEquipped = item.equipped !== false;
  const iconType = itemIconType(kind, item);
  return (
    <button
      type="button"
      className={`cs-sm-ld-equip${isEquipped ? " on" : ""}`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={isEquipped}
      aria-label={`${isEquipped ? "Unequip" : "Equip"} ${item.name}`}
      title={`${ITEM_TYPE_ICON_LABELS[iconType]} · ${isEquipped ? "Equipped — click to stow" : "Stowed — click to equip"}`}
    >
      <ItemTypeIcon type={iconType} filled={isEquipped} />
    </button>
  );
}
