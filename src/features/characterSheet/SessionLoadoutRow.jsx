import "./sessionLoadout.css";

// Story 58 follow-up — a Loadout row. Tapping the name opens the item editor
// (edit / delete); the chip toggles equipped without opening anything.
export default function SessionLoadoutRow({ item, enterProps = {}, onEdit, onToggleEquipped }) {
  const isEquipped = item.equipped !== false;
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
        title={isEquipped ? "Equipped — click to stow" : "Stowed — click to equip"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4L8 1.5Z"
            fill={isEquipped ? "currentColor" : "none"}
            fillOpacity={isEquipped ? 0.25 : 0}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {isEquipped && <path d="m5.5 8 1.8 1.8L10.8 6.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </button>
    </div>
  );
}
