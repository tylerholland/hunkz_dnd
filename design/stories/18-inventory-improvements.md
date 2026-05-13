# Story 18 — Inventory Improvements

## Goal

Two small but table-essential additions to the Inventory tab: quantity tracking for consumables and ammunition, and attunement tracking for magic items. Both address friction that comes up constantly in actual play — players losing count of arrows mid-combat, or forgetting which items they are attuned to when the DM calls out the 3-slot limit.

---

## Feature 1: Item Quantity Tracking

### Why it matters

Consumable items — arrows, bolts, rations, torches, healing potions, antitoxins, poison vials, ball bearings, caltrops — deplete during play. Without quantity tracking, players either maintain a separate mental count, cross things out on paper, or just stop tracking entirely and handwave it. The sheet already supports weapons and equipment as first-class items; quantity is the missing field that makes consumables useful.

Ammunition specifically comes up during every combat in which a ranged character is involved. A ranger burning through arrows against a pack of wolves needs to decrement a count after every attack, not open an edit modal to rename an item from "20 arrows" to "17 arrows."

### Rules ground truth

5e does not enforce any mechanical quantity limit on most consumables — the player just has what they have. Ammunition is tracked per the PHB: you recover half of expended ammunition after a battle (rounded down) if you take time to search. The app does not need to model the recovery mechanic; it only needs to track the current count.

Quantity is irrelevant for items that are inherently singular (a longsword, a shield, a bag of holding). The field is optional — items without a `qty` set behave exactly as today.

### Functional requirements

- Equipment items gain an optional `qty` field (positive integer, or absent/null meaning "not tracked").
- When `qty` is set, the current count is displayed inline on the item in the Inventory tab.
- The count can be decremented and incremented directly from the Inventory tab without entering edit mode or any modal — this is a session action, not a character edit.
- The count floors at 0. It should not go negative.
- `qty` is session-writable — no auth required, same rationale as HP and spell slots (ADR-005).
- Items with `qty === 0` should still appear in the list (the player may want to buy more or recover ammunition). They should not disappear or be hidden.
- Setting and removing the `qty` field entirely (toggling tracking on/off for an item) is an edit-mode action, not a session action.
- Weapons do not get quantity tracking. Weapons are durable gear, not consumables. (Exception: thrown weapons with limited supply could be modeled as equipment items by the player if they want to track them.)

### Data model

`qty` is an optional field on equipment items:

```
equipment[]: { id, name, type?, description, mods[], qty? }
```

`qty` is added to the set of session-writable fields (via `patchSession`). The full `equipment` array is the unit of update — the session patch replaces the entire array, same as any other complex field.

---

## Feature 2: Attunement Tracking

### Why it matters

5e limits characters to 3 attuned magic items simultaneously (DMG p. 138). Attunement requires a short rest. This limit comes up whenever the party finds a new magic item and needs to decide who takes it, or when a character wants to swap one attuned item for another.

Without tracking in the app, players forget what they are attuned to. The DM has to ask "wait, how many things are you attuned to?" and the player has to reconstruct it from memory. The sheet can solve this in one glance.

### Rules ground truth

**The 3-slot limit is firm.** A character cannot benefit from a fourth attuned item and cannot attempt to attune to one. (Some features expand this limit, e.g., Artificer capstone at level 20 allows 6 — but that is an edge case the app does not need to handle specially. The counter is the important thing.)

**Attunement is per item, not per character.** A magic item either requires attunement or it does not. If it does, the character must complete a short rest focused on that item to attune; removing attunement requires another short rest or death.

**Not all magic items require attunement.** A +1 sword does not. A ring of protection does. The "requires attunement" flag belongs on the item itself.

**Attunement state is session-relevant.** A character might attune or de-attune during a session (short rests happen in play). Attunement state must be writable without auth (same rationale as inspiration and spell slots).

### Functional requirements

- Both weapons and equipment items gain two optional flags:
  - `requiresAttunement` (boolean): set in edit mode; marks the item as requiring attunement to benefit from. Off by default.
  - `attuned` (boolean): session state; whether the character is currently attuned. Only meaningful when `requiresAttunement` is true. Off by default.
- The Inventory tab shows an attunement slot counter: "Attuned: N / 3". This is always visible (even at 0/3) so the player can quickly see their remaining capacity.
- Items where `requiresAttunement` is true show an attunement indicator. If `attuned` is true, the indicator is active/lit; if false, it shows as unlit/available.
- Tapping the attunement indicator toggles `attuned` on that item. This is a session action — no auth required.
- The UI should prevent (or at minimum warn) the player from marking a fourth item as attuned when 3 slots are already filled. The count in the counter turns to a warning state at 3/3.
- `requiresAttunement` and the initial `attuned` state are set in edit mode (via the item editor). Toggling `attuned` during a session goes through `patchSession`.
- The 3-slot limit applies across both weapons and equipment combined.

### Data model

New optional flags on weapon and equipment items:

```
weapons[]:   { id, name, description, mods[], requiresAttunement?, attuned? }
equipment[]: { id, name, type?, description, mods[], qty?, requiresAttunement?, attuned? }
```

Both `weapons` and `equipment` arrays are added to the set of session-writable fields. The counter (N attuned) is derived on the fly from the arrays — not stored separately.

---

## Out of scope

- Automatic short-rest attunement ritual (the app does not model the time cost; tapping the indicator is the action)
- Expanding the attunement limit beyond 3 (Artificer level 20 edge case; not needed for this party)
- Item rarity or magic item classification beyond the `requiresAttunement` flag
- Tracking which items have been recovered (ammunition recovery after combat)
- Auto-removing attunement on character death

---

## Open questions

1. Should the attunement counter (N / 3) live in the Inventory tab header, or in a dedicated "Magic Items" section? Given that attunement spans both the weapons and equipment columns, the tab level feels right, but the designer should decide placement.
2. When a player tries to attune a fourth item (already at 3/3), should the app hard-block the toggle or show a warning and allow it anyway? The rules say you cannot benefit from a fourth attuned item, but the app cannot enforce "benefit from" — it can only track the count. Recommend: warn visually (counter turns red, indicator flashes) but allow the toggle, since the DM may have granted an exception or the player may be temporarily testing a state. UX designer should decide.
3. Should `qty` appear on items in the Weapons column of the DM party cards? It is useful context for the DM to know a character is down to 3 arrows. Low priority — deferred to UX designer.

---

## UX Design

### Decisions on open questions

**Q1 — Attunement counter placement**: The counter lives in a thin banner row **between the tab strip and the two-column loadout grid** — spanning the full width of both columns. This placement answers the "both weapons and equipment" problem cleanly: it is visually associated with the Inventory tab but above either column. It reads as a tab-level resource (like spell slots on the Combat tab), not a column-level annotation.

**Q2 — Hard-block vs. warn on 4th attunement**: Warn but allow. The toggle fires. The counter text turns `#c06060` (universal error red) and the count reads "4 / 3" with a ⚠ glyph prepended. The just-toggled gem icon does a brief flash pulse (CSS animation, 400ms, two red flickers). No modal, no blocking. The DM may have granted an exception; the app stays out of the way.

**Q3 — qty on DM party cards**: Defer. Do not show qty on DM party cards in this story. The party card strip is already dense. When qty tracking is mature and players actually use it, a targeted DM card update can add a consumables summary. Out of scope here.

---

### Feature 1: Item Quantity — View Mode

**Inline display in the item row**

Qty appears as a small inline count to the right of the item name, separated by a mid-dot `·`. It sits between the name and the type tag (if any):

```
◦◦◦  Arrows · 28            [Tool]   ▼
◦◦◦  Healing Potion · 2             ▼
◦◦◦  Rations · 0            [Food]   ▼     ← depleted state
```

- Count text: 14px Crimson Text, `pal.textMuted`; the `·` separator uses the same style
- The count is part of the row header — always visible without expanding
- When `qty === 0`: count text + separator render in `#c06060` (error red), and the entire item name also dims to `pal.textMuted` (from `pal.text`). The item is not hidden; it remains in position with a "depleted" visual state

**Qty stepper (session action, no auth)**

Tapping anywhere on the count text or separator opens an inline micro-stepper in place. The stepper replaces the `name · qty` portion of the row header:

```
◦◦◦  Arrows   [−]  28  [+]   [Tool]   ▲
```

- `−` and `+` buttons: 22×22px, ghost style (`border: 1px solid pal.border`, `borderRadius: 3`, `color: pal.accentBright`), `fontFamily: pal.fontUI`, `fontSize: 16px`
- Count display: 15px Cinzel, `pal.gem`, min-width 28px, text-centered
- Stepper closes on: tapping anywhere outside the row, or after 2 seconds of inactivity (auto-close commits the value)
- `−` is visually disabled (opacity 0.35, pointer-events none) when qty is already 0
- Hold-to-repeat on `−` and `+`: 500ms initial delay, 100ms repeat interval (same pattern as HP stepper on DM cards)
- The row item expands (▲ arrow) while the stepper is open, so it does not look broken — but the stepper is inside the header row, not the expanded body
- Writes via `patchSession({ equipment: [...] })` — debounced 400ms after last tap, same pattern as HP debounce

**Depleted state (qty === 0)**

- Item name: `pal.textMuted` instead of `pal.text`
- Count + separator: `#c06060`
- Drag handle: unchanged (item is still reorderable)
- No strikethrough; the item remains fully functional and expandable
- No auto-hide or auto-archive

---

### Feature 1: Item Quantity — Edit Mode (ItemEditorModal)

A new **Qty** field appears in the ItemEditorModal below the Name / Type row, above Description:

```
[ Name __________________________ ]  [ Type _______ ]

[ ☑ Track quantity ]    [ 14  ]   ← number input; only shown when checked

[ Description ____________________________________________ ]
```

- The checkbox label reads "Track quantity" in IM Fell English 12px uppercase tracked; when unchecked the qty number input is hidden entirely (no half-state)
- Checking the box sets `qty` to `1` as the default (not `0`; a newly tracked item starts with at least one)
- The number input: `width: 72px`, numeric, min 0, step 1; styled as standard input from design system
- Unchecking removes the `qty` field entirely (sets it to `null`/absent), which disables tracking — the item reverts to untracked behavior
- This is an edit-mode action; it saves with the rest of the character via the normal save flow

---

### Feature 2: Attunement — Attunement Banner

A thin banner row sits **between the tab strip and the loadout grid**, spanning the full content width (not split by the two columns):

```
  ◆  Attuned  2 / 3   ·  1 slot remaining
```

- Left: a small ◆ diamond glyph (`pal.accentDim`), then "Attuned" label in IM Fell English 11px uppercase tracked `pal.textMuted`
- Center: the count `2 / 3` in Cinzel 14px `pal.gem` — the current number in gem, the slash and max in `pal.textMuted`
- Right of count: a compact contextual note in IM Fell English 11px italic `pal.textMuted`: "1 slot remaining" / "slots full" / "over limit"
- The banner has no border of its own; it sits in the gap between the tab strip and the grid with `paddingBottom: 12px, borderBottom: 1px solid pal.border, marginBottom: 14px`
- When count is 0/3: entire banner renders at reduced opacity (0.45) — it is present but does not draw attention when there is nothing to track
- When count is 3/3: "slots full" text in `pal.accentBright` (warm amber warning, not red — 3/3 is valid)
- When count is 4+/3 (over limit): count text and note both render in `#c06060`; the ◆ also turns red; note reads "⚠ over limit"
- The banner appears on the Inventory tab only. It is always visible regardless of whether any items have `requiresAttunement`

---

### Feature 2: Attunement — Item Indicators in View Mode

Every item where `requiresAttunement: true` shows a small **gem indicator** at the far right of the item row header, before the expand arrow:

**Attuned state** (`attuned: true`):
- A 10×10px filled circle rendered in `pal.gem` with a subtle glow: `boxShadow: 0 0 5px 1px pal.gem` (opacity ~0.5)
- A pulsing animation: opacity cycles 0.75 → 1.0 → 0.75 over 2.2s (same keyframe pattern as the concentration banner dot)
- Tooltip on hover: "Attuned" in IM Fell English

**Not attuned state** (`requiresAttunement: true`, `attuned: false`):
- A 10×10px hollow circle: `border: 1.5px solid pal.textMuted`, `borderRadius: 50%`, background transparent
- No glow, no pulse — visually inert
- Tooltip on hover: "Requires attunement — tap to attune"
- The item name renders in `pal.textBody` (slightly muted) rather than `pal.text` — subtle visual signal that the item is not yet active

**Items with no attunement requirement** (`requiresAttunement` absent or false):
- No indicator at all — unchanged from today

**Tap to toggle attunement**:
- Tapping the gem indicator toggles `attuned`. This is the only tap target for attunement toggle — tapping the item name or expand arrow does not toggle it.
- The indicator tap area is 28×28px minimum (larger than the 10px visual dot) for comfortable touch
- On toggling to attuned at count 3/3 (would become 4/3): toggle fires, count updates to 4/3, counter turns red, the newly-attuned indicator does a 400ms flash-pulse in red before settling into the normal attuned gem glow. No blocking dialog.
- No auth required (session action)

**Row layout with indicator** (right-to-left from expand arrow):
```
◦◦◦  Ring of Barahir   [CHA +2]  ●  ▼     ← attuned
◦◦◦  Amulet of Health  [HP +4]   ○  ▼     ← requires attunement, not yet attuned
◦◦◦  Rope, Hempen                   ▼     ← no attunement (no indicator)
```

---

### Feature 2: Attunement — Edit Mode (ItemEditorModal)

Below the Name / Type row and above the Qty field, a single toggle row:

```
[ ☑ Requires attunement ]
[ ☑ Currently attuned   ]   ← only shown when "Requires attunement" is checked
```

- Both are standard checkboxes with IM Fell English 12px uppercase labels, same style as the Qty checkbox
- "Currently attuned" is hidden entirely when `requiresAttunement` is unchecked
- Unchecking "Requires attunement" also clears `attuned: false` implicitly (backend should enforce; UI hides the field)
- These fields save with the character via the normal edit-mode save. They set the initial state; live toggling happens in view mode via `patchSession`

---

### Coexistence with the XP strip (Story 17)

The XP strip from Story 17 sits at the **bottom** of the Inventory tab content, after the loadout grid. The attunement banner sits at the **top** of the Inventory tab content, before the loadout grid. They do not interact or overlap.

Layout order within the Inventory tab (top to bottom):
1. Attunement banner (new — spans full width)
2. Two-column `.loadout-grid` (weapons left, equipment right)
3. XP strip (Story 17 — spans full width, `borderTop: 1px solid pal.border`)

---

### Qty in the Equipment column header area

The Equipment column header today reads just "Equipment" in the `loadout-col-label` style. No change is needed to this label — the qty stepper lives on individual rows, not in the column header.

---

### States summary table

| Item state | Name color | Qty display | Gem indicator |
|---|---|---|---|
| Plain item | `pal.text` | — | — |
| Requires attunement, not attuned | `pal.textBody` | n/a | Hollow circle `pal.textMuted` |
| Attuned | `pal.text` | n/a | Filled gem with pulse + glow |
| Has qty, qty > 0 | `pal.text` | `· N` in `pal.textMuted` | (as above if applicable) |
| Has qty, qty = 0 (depleted) | `pal.textMuted` | `· 0` in `#c06060` | (as above if applicable) |

---

### Prototype

See `design/prototypes/inventory-improvements.html`.

---

## Architect Notes

### 1. Data model changes

**New fields on item objects:**

```js
// equipment item
{ id, name, type?, description, mods[], qty?, requiresAttunement?, attuned? }

// weapon item
{ id, name, description, mods[], requiresAttunement?, attuned? }
```

`BLANK_CHARACTER` in `src/features/characterSheet/constants.js` already initializes `weapons: []` and `equipment: []` — no change needed there. Empty arrays mean no items, so new fields are additive and optional; no migration is required.

`LIVE_SESSION_FIELDS` in `constants.js` already includes `"weapons"` and `"equipment"` (added in a prior story). No change needed to that list.

**Session patch shape for qty and attunement toggles:** Both write the entire array, same as the existing inspiration/spellSlots pattern:

```js
// qty decrement on equipment item with id "abc"
applySessionPatch(
  { equipment: char.equipment.map(i => i.id === "abc" ? { ...i, qty: Math.max(0, i.qty - 1) } : i) },
  { equipment: prevEquipment }
)

// attunement toggle on a weapon
applySessionPatch(
  { weapons: char.weapons.map(i => i.id === "xyz" ? { ...i, attuned: !i.attuned } : i) },
  { weapons: prevWeapons }
)
```

The session handler (`backend/src/handlers/session.js`) already accepts `weapons` and `equipment` as top-level fields in `SESSION_FIELDS`. No backend changes required.

---

### 2. Component scope

Files that change:

| File | What changes |
|---|---|
| `src/features/characterSheet/CharacterSheetViewMode.jsx` | Attunement banner (new block before `.loadout-grid`), qty display + inline stepper on equipment rows, gem indicator on weapon + equipment rows, attunement toggle handler, derived attunement count |
| `src/features/characterSheet/ItemEditorModal.jsx` | New `requiresAttunement`, `attuned`, and qty checkbox/input fields; `handleSave` must pass through these fields; currently only outputs `{ id, name, description, mods, type? }` |
| `src/features/characterSheet/CharacterSheetEditMode.jsx` | Verify it passes all item fields through when saving — the edit-mode save flow must not strip the new fields. Check the save handler at lines ~1464–1471 of ViewMode where `updatedChar` is assembled: the saved item from `ItemEditorModal` is spread directly, so as long as `handleSave` in the modal includes the new fields, EditMode is not a separate touch point |

No changes needed to `constants.js`, `session.js`, `api.js`, `CharacterSheet.jsx`, or any DM dashboard files.

---

### 3. Session writability

Both `weapons` and `equipment` are already in `SESSION_FIELDS` on the backend. Qty changes (equipment only) and attunement toggles (both arrays) are straightforwardly session-writable — no auth, same pattern as spell slots.

**Attunement on weapons vs. equipment:** No special handling needed. Both arrays go through the same `patchSession` path. The derived attunement count is computed on the fly from `[...weapons, ...equipment].filter(i => i.attuned).length` — never stored.

The over-limit warning (4+/3) is purely frontend state derived from the count. No enforcement at the backend level needed or desired (per the UX decision to warn but allow).

---

### 4. Hold-to-repeat for qty stepper

Do **not** build fresh. `useHoldToRepeat` already exists in `src/features/dmDashboard/dashboardShared.js` (exported, 500ms delay, 80ms repeat interval). The design specifies 500ms delay / 100ms interval — the existing hook defaults are 500ms / 80ms, close enough; adjust the `interval` argument if the 20ms difference matters.

`CharacterSheetViewMode.jsx` currently does not import from `dashboardShared`. The builder has two options:
- Import `useHoldToRepeat` directly from `dashboardShared.js` (cross-feature import — works, but slightly impure per ADR-002)
- Promote `useHoldToRepeat` to `src/lib/liveSync.js` or a new `src/lib/useHoldToRepeat.js` shared primitive, then import from there in both files

Recommend promoting to `src/lib/` — it is a general UI primitive with no DM-dashboard semantics, and it is already used in three DM dashboard files. One-time move, then both ViewMode and dashboard import from the shared location. This is the right call under ADR-002 ("shared primitives only where at least two screens genuinely use the same behavior").

The hold-to-repeat pattern for the qty stepper: use `onPointerDown` / `setPointerCapture` / `onPointerUp` / `onPointerCancel` exactly as the HP stepper in `CharacterCard.jsx` does (lines 345–374).

---

### 5. Attunement banner placement

The banner goes **inside the `{combatTab === "loadout" && (...)}` block** in `CharacterSheetViewMode.jsx`, starting at line 696. The current structure is:

```
{combatTab === "loadout" && (
  <>
    <div className="loadout-grid">
      ...weapons column...
      ...equipment column...
    </div>
    {/* Coin Section */}
    ...
  </>
)}
```

Insert the attunement banner as the **first child** of the `<>` fragment, before `<div className="loadout-grid">`. If Story 17's XP strip follows the same pattern (appended after the coin section), the tab order will naturally be: banner → grid → coin → XP strip, which matches the UX spec.

The banner only needs to render when at least one item across both arrays has `requiresAttunement: true` — wait, the UX spec says "always visible regardless of whether any items have requiresAttunement." Honor that. Compute `attunedCount` and `requiresAttunementCount` unconditionally.

---

### 6. Scope boundaries

Explicitly out of scope (confirmed from story + architect review):

- No DM party card changes — qty does not appear on `CharacterCard.jsx`
- No backend schema migration — new fields are additive; DynamoDB schemaless model (ADR-003) absorbs them automatically
- No changes to `dmParty.js` — it returns the full item arrays already; new fields ride along for free
- No new Lambda handler — `session.js` already covers both `weapons` and `equipment`
- No attunement enforcement at the API layer — warn-but-allow is purely frontend
- `BLANK_CHARACTER` items arrays stay empty — no need to add default item shapes
- No Artificer level-20 6-slot exception
- No ammunition recovery mechanic

**Flag — ItemEditorModal save shape:** The current `handleSave` in `ItemEditorModal.jsx` constructs the saved object explicitly and conditionally spreads `type`. It does **not** pass through unknown fields from the incoming `item` prop. After this story, it must also pass through `requiresAttunement`, `attuned`, and `qty` (where applicable). Failing to do so would silently wipe these fields whenever an item is opened and re-saved in edit mode. This is the highest-priority correctness risk in the whole story.

---

### 7. Risk flags

**Auto-close timer for qty stepper:** The 2-second inactivity auto-close requires a `useRef` for the timer ID that is cleared on every interaction (button press) and on component unmount. There is no existing example of this pattern in `CharacterSheetViewMode.jsx` — it will be new code. The builder must ensure cleanup in a `useEffect` return to avoid memory leaks, and must ensure the timer does not fire during an active hold-to-repeat sequence (clear timer on `onPointerDown`, restart on `onPointerUp`/`onPointerCancel`).

**Over-limit warning state:** The 4/3 flash-pulse on the gem indicator is a CSS animation triggered by toggling a class or inline style. Since ViewMode uses inline styles throughout (ADR-001), implement via a `<style>` tag injection (same pattern as concentration banner pulse) keyed to a unique class name. The "newly-attuned" flash needs to be transient — cleared after 400ms. Use a `useRef` + `setTimeout` to set a per-item "flashing" state flag, then clear it. Keep this local to the item row render, not global component state.

**Stepper open state:** The open/closed state for the qty stepper (`stepperOpenId`) should be a single `useState` at the loadout section level (one item open at a time). Clicking outside the row should close it — add a `useEffect` with a `pointerdown` document listener (same pattern as the armor flyout at line 442 in `CharacterCard.jsx`). Clear the active stepper ID on close.

**`ItemEditorModal` field wiring (reiterated):** The modal currently initializes local state from `item?.qty`, `item?.requiresAttunement`, `item?.attuned` — none of these exist yet. The builder must add `useState` for each, conditionally render the fields, and include them in the `onSave` call. When `requiresAttunement` is unchecked, force `attuned: false` in the saved object. When the qty checkbox is unchecked, omit `qty` from the saved object (or set to `null`/`undefined`).

**Debounce on qty writes:** The design calls for a 400ms debounce after the last tap. `liveSync.js` already has debounce utilities used for HP and XP. Use the same `applySessionPatch` optimistic pattern — update local `char` state immediately via `setChar`, queue the debounced network write. Do not issue one request per hold-repeat tick.
