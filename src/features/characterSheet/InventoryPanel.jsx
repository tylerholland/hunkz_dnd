import { useState } from "react";
import ItemEditorModal from "./ItemEditorModal";
import SessionQuickAdd from "./SessionQuickAdd";
import SessionLoadoutRow from "./SessionLoadoutRow";
import SessionLedger from "./SessionLedger";

const ATTUNEMENT_SLOTS = 3;
const COLUMNS = [
  { kind: "weapons", title: "Weapons", addLabel: "+ Add Weapon", itemLabel: "Weapon" },
  { kind: "equipment", title: "Equipment", addLabel: "+ Add Item", itemLabel: "Item" },
];

// The character's inventory — weapons, equipment, coin and XP — as one panel,
// used by both the Session and Profile views so they look and behave the
// same: quick add, edit (pencil → item editor), equip/stow, expand, quantity,
// Use Item, attunement. Writes go through `useInventoryWrites`.
export default function InventoryPanel({ char, pal, writeLoadout, onCommitCoin, onCommitXp }) {
  const [quickAddOpen, setQuickAddOpen] = useState(null); // "weapons" | "equipment" | null
  const [itemDetails, setItemDetails] = useState(null); // { kind, item?, seed? }
  const [recentAdds, setRecentAdds] = useState({}); // id → stagger index (row enter animation)
  const [expanded, setExpanded] = useState(() => new Set());
  const [attuneFlash, setAttuneFlash] = useState(null); // id of a row going over the limit

  const lists = { weapons: char?.weapons || [], equipment: char?.equipment || [] };
  const attunedCount = [...lists.weapons, ...lists.equipment].filter((item) => item.requiresAttunement && item.attuned).length;
  const anyAttunement = [...lists.weapons, ...lists.equipment].some((item) => item.requiresAttunement);

  function addItems(kind, items) {
    if (items.length === 0) return Promise.resolve(false);
    const addedIds = new Set(items.map((item) => item.id));
    setRecentAdds((prev) => {
      const merged = { ...prev };
      items.forEach((item, index) => { merged[item.id] = index; });
      return merged;
    });
    setTimeout(() => setRecentAdds((prev) => {
      const rest = { ...prev };
      addedIds.forEach((id) => delete rest[id]);
      return rest;
    }), 1000);
    return writeLoadout(
      kind,
      (list) => [...list, ...items],
      (list) => list.filter((item) => !addedIds.has(item.id)),
    );
  }

  const updateItem = (kind, id, changes) => writeLoadout(kind, (list) => list.map((item) => {
    if (item.id !== id) return item;
    // A full item from the editor replaces the row; a partial (equip toggle) merges.
    return changes.id === id ? changes : { ...item, ...changes };
  }));
  const deleteItem = (kind, id) => writeLoadout(kind, (list) => list.filter((item) => item.id !== id));
  // Use one of a qty-tracked item (potion, arrows, rations). Stops at 0.
  const adjustQty = (kind, id, delta) => writeLoadout(kind, (list) => list.map((item) => (
    item.id === id && item.qty != null ? { ...item, qty: Math.max(0, item.qty + delta) } : item
  )));

  function toggleAttuned(kind, item) {
    const attuning = !item.attuned;
    if (attuning && attunedCount >= ATTUNEMENT_SLOTS) {
      setAttuneFlash(item.id);
      setTimeout(() => setAttuneFlash((current) => (current === item.id ? null : current)), 400);
    }
    updateItem(kind, item.id, { attuned: attuning });
  }

  const toggleExpanded = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const enterProps = (id) => (id in recentAdds
    ? { className: "cs-spell-row-enter", style: { animationDelay: `${recentAdds[id] * 40}ms` } }
    : {});

  const overLimit = attunedCount > ATTUNEMENT_SLOTS;

  return (
    <div className="cs-inventory-panel">
      {anyAttunement && (
        <div className={`cs-inv-attune${overLimit ? " over" : ""}`} aria-live="polite">
          <span className="cs-inv-attune-gem" aria-hidden="true">◆</span>
          Attuned {attunedCount} / {ATTUNEMENT_SLOTS}
          {overLimit && <span className="cs-inv-attune-note"> · over the limit</span>}
        </div>
      )}
      <div className="cs-sm-loadout-grid">
        {COLUMNS.map(({ kind, title, addLabel, itemLabel }) => (
          <div key={kind}>
            <div className="cs-col-header">
              <div className="cs-col-label">{title}</div>
              <button
                type="button"
                className={`cs-sm-ld-addbtn${quickAddOpen === kind ? " active" : ""}`}
                // Keep focus in an open compose row so its blur-to-close
                // doesn't fire first and turn this toggle into a reopen.
                onMouseDown={(e) => { if (quickAddOpen === kind) e.preventDefault(); }}
                onClick={() => setQuickAddOpen((current) => (current === kind ? null : kind))}
                aria-expanded={quickAddOpen === kind}
              >{addLabel}</button>
            </div>
            <SessionQuickAdd
              kind={kind}
              label={itemLabel}
              open={quickAddOpen === kind}
              onClose={() => setQuickAddOpen((current) => (current === kind ? null : current))}
              onAdd={(items) => addItems(kind, items)}
              onOpenDetails={(seed) => setItemDetails({ kind, seed })}
            />
            {lists[kind].map((item) => (
              <SessionLoadoutRow
                key={item.id}
                item={item}
                kind={kind}
                enterProps={enterProps(item.id)}
                onEdit={() => setItemDetails({ kind, item })}
                expanded={expanded.has(item.id)}
                onToggleExpand={() => toggleExpanded(item.id)}
                onUse={() => adjustQty(kind, item.id, -1)}
                onAdjustQty={(delta) => adjustQty(kind, item.id, delta)}
                onToggleEquipped={() => updateItem(kind, item.id, { equipped: item.equipped === false })}
                onToggleAttuned={() => toggleAttuned(kind, item)}
                attuneFlash={attuneFlash === item.id}
              />
            ))}
          </div>
        ))}
      </div>
      <SessionLedger char={char} onCommitCoin={onCommitCoin} onCommitXp={onCommitXp} />

      {itemDetails && (
        <ItemEditorModal
          item={itemDetails.item}
          seed={itemDetails.seed}
          pal={pal}
          showType={itemDetails.kind === "equipment"}
          onClose={() => setItemDetails(null)}
          onSave={(item) => {
            const { kind, item: existing } = itemDetails;
            setItemDetails(null);
            if (existing) updateItem(kind, existing.id, item);
            else addItems(kind, [item]);
          }}
          onDelete={itemDetails.item ? () => {
            const { kind, item: existing } = itemDetails;
            setItemDetails(null);
            deleteItem(kind, existing.id);
          } : undefined}
        />
      )}
    </div>
  );
}
