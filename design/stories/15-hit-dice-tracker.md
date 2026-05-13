# Story 15 — Hit Dice Tracker

## Goal

Replace the static "4d10" text field with a proper tracked resource. Hit Dice are a rest mechanic — players spend them during Short Rests to recover HP and recover half of them on a Long Rest. The app currently treats them as a display-only label, which is both mechanically wrong and wastes prime Combat-tab space on a value that belongs alongside spell slots, not HP and Armor.

---

## User stories

**As a player**, I want to see how many Hit Dice I have remaining (e.g., "5 of 7") so I can make informed Short Rest decisions without having to mentally subtract from a static label.

**As a player**, I want to spend Hit Dice during a Short Rest directly from my Combat tab so the current count stays accurate through the session.

**As a player**, I want my Hit Dice to partially restore after a Long Rest (half of max, rounded down, per RAW) so I don't have to track it myself.

**As the DM**, I want Short Rest and Long Rest from the DM dashboard to also update each character's Hit Dice current count, consistent with how spell slots work today.

**As a player (or DM)**, I want the Hit Dice section to stay compact when I'm at full dice, and expand to show the tracker when I've spent some — so it's there when it matters and out of the way when it doesn't.

---

## Functional requirements

### Die size derived from class

The die type (d6, d8, d10, d12) is a frontend constant — no manual entry required. Mapping:

| Class | Hit Die |
|---|---|
| Barbarian | d12 |
| Fighter, Paladin, Ranger | d10 |
| Artificer, Bard, Cleric, Druid, Monk, Rogue, Warlock | d8 |
| Sorcerer, Wizard | d6 |

This map lives in `CharacterSheet.jsx` as a constant (e.g., `HIT_DIE_BY_CLASS`). If `charClass` is unrecognized or unset, fall back to d8.

### Max Hit Dice = character level

`hitDiceMax` is always `character.level`. This is derived on the fly from `level` — never stored separately.

### Tracked current count

`hitDiceCurrent` is a new session field (number). It behaves like `hpCurrent`: writable without auth via `patchSession`, persisted in DynamoDB.

### Spending Hit Dice (Short Rest)

On the Combat tab, a "Spend" button (or stepper) decrements `hitDiceCurrent` by 1 (minimum 0). The player can spend multiple dice; each decrement fires a `patchSession` call (same debounce pattern used by HP). The die size label ("d10") is shown so the player knows what to add to the HP tracker manually. This story does not automate the HP recovery math — the player reads the roll result from the Dice Roller and adjusts HP themselves.

### Long Rest recovery

Long Rest restores half the max Hit Dice, rounded down (minimum 1). Example: a 7th-level Fighter goes from 3 remaining → 3 + 3 = 6 of 7 (half of 7 = 3, rounded down). This applies to the DM's Long Rest action (which already resets spell slots and HP) and to a Long Rest triggered from the Combat tab. `hitDiceCurrent` is capped at `level` (never exceeds max).

### Short Rest — DM dashboard

The existing Short Rest on the DM dashboard already resets Pact Magic spell slots. It should also call `patchSession` for each character to restore Hit Dice by half max (same Long Rest formula) — wait, no: Short Rest does **not** restore Hit Dice in 5e RAW. Short Rest only allows *spending* them. The DM dashboard Short Rest action should leave `hitDiceCurrent` unchanged. **No change needed to Short Rest logic** for Hit Dice.

### Placement on the Combat tab

The Hit Dice tracker sits on the Combat tab, immediately below the HP/Concentration section and immediately above (or grouped with) Spell Slots. It is always visible on the Combat tab — not gated by any "if spells configured" check. It should feel like a sibling resource row to Spell Slots.

### Progressive disclosure

- **Full**: when `hitDiceCurrent === level`, show a compact single-line summary: die count + die type (e.g., "7 d10 ✦ Full"). Spend button still accessible but de-emphasized.
- **Depleted (any)**: show the full tracker row: remaining count, max, die type, and a Spend button.

This mirrors the "collapsed when satisfied, expanded when action needed" pattern already used for Concentration.

### Removing Hit Dice from the stats row

The HP / Hit Dice / Armor row in the stats block should become HP / Armor (two items). The Hit Dice display is removed from that row entirely.

### Removing "Hit Dice" from MOD_ATTRIBUTES

`MOD_ATTRIBUTES` currently includes `"Hit Dice"` as a valid modifier target in the `ItemEditorModal`. In 5e, no item or feature modifies a character's Hit Die type or count via a modifier. Remove `"Hit Dice"` from this list. Any existing weapon/equipment mods with `attribute: "Hit Dice"` are effectively inert and can be ignored (no active characters use this).

---

## Data model changes

### New session field: `hitDiceCurrent`

| Field | Type | Location | Notes |
|---|---|---|---|
| `hitDiceCurrent` | number | DynamoDB, session state | Remaining Hit Dice; writable without auth via `patchSession` |

Add `hitDiceCurrent` to:
- `BLANK_CHARACTER` defaults (initial value: `null` or omitted — see migration note below)
- `session.js` handler's allowed session fields
- `dmParty.js` projected fields (DM needs to see current Hit Dice on party cards, or at minimum the Long Rest logic needs to write it)

### Deprecated field: `hitDice`

The existing `hitDice: string` field (e.g., `"4d10"`) is **no longer written or displayed**. It remains in DynamoDB for existing records but is ignored by the frontend after this change. No migration script is needed.

The die size is now derived from `charClass` via the `HIT_DIE_BY_CLASS` constant. The numeric part of the old `hitDice` value (e.g., `4` in `"4d10"`) is now always `level` — so the old stored value is redundant.

### Edit mode

Remove the "Hit Dice" text input from the edit mode "Hit Points & Hit Dice" section. The section label becomes just "Hit Points" (a single HP max input).

---

## Migration / backward compatibility

**Seeding `hitDiceCurrent` for existing characters**: When a character record is loaded and `hitDiceCurrent` is absent (undefined or null), the frontend treats it as equal to `level` (full). No backend migration needed. The value is only written to DynamoDB once the player first spends a die or a rest event fires.

**The old `hitDice` string field**: Leave it in DynamoDB untouched. The frontend simply stops reading it. If a future cleanup script is ever run, the value can be dropped. Do not parse the old string to seed `hitDiceCurrent` — defaulting to full (= level) is safer and simpler, and the discrepancy is a single session's worth of tracking at most.

---

## Out of scope

- Automating HP gain when spending a Hit Die (player reads the Dice Roller result and adjusts HP manually via the existing HP tracker)
- Multiclass Hit Dice (multiple die sizes for a multiclassed character — e.g., 5 Fighter / 3 Wizard has 5d10 + 3d6). This story handles single-class characters only. Multiclass is noted as a future extension.
- Showing Hit Dice on the DM party cards (can be added later; the data will be available via `hitDiceCurrent`)
- Death save or other resource interactions with Hit Dice

---

## Open questions

1. **Short Rest from Combat tab**: The Combat tab currently has Long Rest / Short Rest buttons tied to spell slots. Should the Hit Dice "Spend" action replace those buttons, or should it be a separate control that co-exists with them? The UX designer should resolve this.

2. **Multiclass note in UI**: Should the tracker show a small note like "Multiclass not supported" when level > 1 and the class is unrecognized, or just silently fall back to d8? Probably silent fallback — the note feels noisy.

3. **DM party card**: Should `hitDiceCurrent` and the derived max be visible on the DM party card alongside HP? Deferred to a follow-up, but the data shape should support it.

4. **BLANK_CHARACTER default**: `hitDiceCurrent: null` (treated as full) vs. `hitDiceCurrent: 1` (level 1 = 1 die). `null` is preferred so existing characters don't get an unintended write of `1` before their real level is reflected.

---

## UX Design

**Prototype**: `design/prototypes/hit-dice-tracker.html`

### Compact vs. expanded state decision

Hit Dice use a two-state progressive disclosure model:

**Full state** (`hitDiceCurrent === level`): a single compact line — `◆ Hit Dice  N dX  [Full]  [Spend]`. The diamond bullet (◆) matches the Persona tab trait list style — a familiar, low-weight marker. The count and die type are Cinzel numerals but at 18px (not the 44px used for HP), so they read as reference info rather than a live resource. A "Full" badge (dim gem-colored border pill) makes the state explicit. The Spend button is present but de-emphasized with 60% opacity — reachable but not calling for attention.

**Depleted state** (any dice spent): the section expands to show:
- Section header with title + current/max in Cinzel — count in amber (`#c8a040`) for a soft warning; turns error-red (`#c06060`) when ≤ 25% remaining or at zero
- Pip grid — one 26×4px rounded square per Hit Die, filled (gem-tinted) when available, hollow/faded when spent. This gives an immediate spatial sense of depletion vs. the abstract number. Pips are 26px with 7px gap; at level 20 they wrap to 3 rows (~8 per row) — still glanceable.
- A warning strip (amber background, amber border) appears when ≤ 25% remaining
- Spend action row (see below)

**Rationale**: The full/depleted toggle mirrors the Concentration banner pattern already used on the Combat tab — hidden when satisfied, visible when action is needed. The specific visual weight escalation (dim single-line → amber count → red count → red count + warning strip) matches the urgency of the resource state.

### Spend interaction

Tap the **Spend** button on the tracker row opens a modal:

1. **Die display** — large Cinzel "dX" showing the die type (56px), reinforcing what the player will roll
2. **Stepper** — "Dice to spend" stepper 1 to current count (− and + buttons with Cinzel numbers, same pattern as HP damage modal)
3. **HP Recovery preview panel** — `Expected HP Recovery: N – M` where N = (count × (1 + CON mod)) and M = (count × (dieSize + CON mod)); formula shown below: "NdX + M (CON mod ×N)". This is informational only — it shows the range before rolling. The player still rolls manually (Dice Roller) and adjusts HP themselves, consistent with story out-of-scope decision.
4. **Confirm button** — amber-tinted "Spend N Dice"; Cancel as ghost button. Escape / backdrop tap cancels.

On confirm: optimistic `patchSession({ hitDiceCurrent: current - n })`. A toast confirms: "Spent N dice — adjust HP from dice roll."

**Open question resolution (Q1)**: The Hit Dice Spend interaction is a **separate control** from the Short/Long Rest buttons in the Spell Slots section. Rationale: spending Hit Dice and resting spell slots are independent actions that can happen at different points in a Short Rest. The Spend button on the Hit Dice row is the entry point; the rest buttons below Spell Slots remain unchanged. No new rest buttons are needed for Hit Dice.

### Stats row change

The HP / Hit Dice / Armor row in the stats block becomes **HP / Armor** (two values). This is cleaner at every viewport:
- Two 44px Cinzel numbers balance naturally with `gap: 52px` and `justify-content: center`
- No three-way crowding on narrow mobile screens
- The removed static "4d10" label was reference info anyway; now it lives as a live counter in the right place (Combat tab)

The existing `hp-row-frame` CSS requires no change to the container — just removing the Hit Dice `<div>`. The two remaining stats center themselves automatically via flexbox.

### DM campaign card treatment

A small passive indicator is shown in the meta row (bottom of the party card, alongside AC) when any Hit Dice have been spent:
- **Nothing** when `hitDiceCurrent === level` (or null, treated as full) — no clutter when all is well
- **Amber pulsing dot + "N/max HD" label** when any dice are spent — same amber color used on the tracker (`#c8a040`), pulsing animation at 2s ease-in-out. Label is IM Fell English 10px uppercase, ~4 characters ("4/7 HD").
- **Red dot + red label** when `hitDiceCurrent ≤ 1` or ≤ 25% — same `#c06060` as other critical states; card border does not change (HP criticality already uses the border for low HP; the dot is a distinct signal)

**Placement**: Meta row at the bottom of the card, right-aligned after AC badge. This is the lowest-priority position on the card, appropriate for passive information the DM can't directly act on. The DM's action (if any) is to create a Short Rest opportunity, not to click anything.

Per the story's "Out of scope" section, the DM card Hit Dice display is deferred to a follow-up. The data (`hitDiceCurrent`) will be projected by `dmParty.js` so the rendering can be added later without a data model change.

### Mobile considerations

- **Spend button tap target**: The inline Spend button on the full-state row and the expanded Spend button on the depleted row are both sized for fat-finger use (≥32px tall, ≥48px wide including padding). Touch targets meet the 44px minimum for the modal stepper buttons.
- **Pip grid** at level 20 (20 pips at 26px + 7px gap): wraps to ~3 rows on a 360px viewport. Still readable. Pip size is 26px — enough to show filled vs. empty without being so large they overwhelm the row.
- **Modal**: `max-width: 420px`, full-bleed on narrow screens with 20px side padding. Large Cinzel die type (56px) is a quick visual anchor when the player opens the modal in dim light.
- **Low-warning strip text** ("◈ N of M Hit Dice remaining") is font-size 11px with letter-spacing 0.1em — above the 12px floor but with tracking to keep it readable. Reviewed and acceptable as contextual metadata rather than primary content.
- **Color contrast in dim light**: Amber (`#c8a040`) and gem-blue (`#8ab4c8`) are both warm-bright against the dark ocean background. The spent pip state (faded border, no fill) degrades gracefully — even at low screen brightness, the contrast between filled and empty pips is legible.

### Resolved open questions

1. **Q1 — Short Rest from Combat tab**: Resolved. Hit Dice Spend is a **separate control** that co-exists with the existing Short/Long Rest buttons under Spell Slots. The two actions are independent; no UI consolidation.

2. **Q2 — Multiclass note**: Resolved as silent fallback to d8. No UI note.

3. **Q3 — DM party card**: Deferred per story scope. Data shape (`hitDiceCurrent` in `dmParty.js` projection) supports it when ready. Indicator design specified above for when it is implemented.

4. **Q4 — BLANK_CHARACTER default**: `null` confirmed. Renders as full state (current = level) without a write.

### New open questions

- **Inline single-die spend shortcut**: Should a single-tap minus button on the tracker row (no modal, no preview) be offered as a faster path when the player just wants to spend one die quickly? The modal adds clarity (HP recovery range) that's useful during deliberation; the inline path is faster for experienced players who know their die. Recommend: inline stepper on the row decrements optimistically without a modal; the modal is only opened via the explicit "Spend" button for multi-die or deliberate use. This is a builder call — the prototype shows the modal-first approach.
- **Spend count persistence across modal opens**: Should the stepper value reset to 1 each time the modal opens, or remember the last value? Recommend reset to 1 (conservative default — prevents accidentally double-spending).

---

## Architect Notes

**Applies**: ADR-002, ADR-003, ADR-005, ADR-011

**Tech approach**: One new session field: `hitDiceCurrent` (number). Added to `SESSION_FIELDS` in `backend/src/handlers/session.js` and to `LIVE_SESSION_FIELDS` in `constants.js`. Default when absent: treat as `level` (full) — the frontend uses `char.hitDiceCurrent ?? char.level` wherever the value is needed. `hitDiceCurrent` is added to the `BLANK_CHARACTER` as `null` (not `0` and not a specific number — `null` signals "treat as full" without assuming level). The `HIT_DIE_BY_CLASS` map is a new constant in `constants.js`; keys must exactly match the `CLASS_OPTIONS` string values already defined there (`"Barbarian"`, `"Fighter"`, etc. — confirmed from the existing constant). Default for unrecognized class: `8`. `hitDiceCurrent` is added to `dmParty.js` ProjectionExpression — required for the Long Rest logic on the dashboard to compute the correct restore delta, and for the future DM card indicator described in the UX design.

**Long Rest — two call sites, different behavior**:
- `CharacterSheetViewMode.jsx` Long Rest button (under Spell Slots): currently only resets spell slots — confirmed by source inspection. It must be updated to also patch `hitDiceCurrent: Math.min(current + Math.floor(level / 2), level)`. The `level` and current `hitDiceCurrent` values are both available in the component's `char` prop. The floor-half formula: `Math.max(1, Math.floor(level / 2))` dice restored, capped at `level`.
- `DmDashboardPage.jsx` `doLongRest()`: currently patches `hpCurrent` and `spellSlots` for all party members in parallel. Must also include `hitDiceCurrent` in each patch. `level` is already in the party projection (`#l` alias confirmed). Current `hitDiceCurrent` is also now in the projection, so the formula can be computed client-side: `Math.min((char.hitDiceCurrent ?? char.level) + Math.max(1, Math.floor(char.level / 2)), char.level)`.

**Short Rest**: No change to Short Rest logic. Short Rest does NOT restore Hit Dice in 5e RAW. The existing `doShortRest()` in `DmDashboardPage.jsx` (which only resets Pact Magic slots) is correct as-is. The Combat tab Short Rest button (which resets Pact Magic only) is also correct as-is. The "Spend" action on the Hit Dice tracker is the only Short Rest interaction that touches `hitDiceCurrent` — it decrements, not restores.

**Removing `hitDice` from `BLANK_CHARACTER` and edit mode**: Remove the `hitDice: ""` field from `BLANK_CHARACTER`. Remove the "Hit Dice" text input from `CharacterSheetEditMode.jsx` (the HP & Hit Dice section becomes HP-only). The `hitDice` field in existing DynamoDB records is harmless — schemaless storage, stale attributes are ignored. The stats block rendering in `CharacterSheetViewMode.jsx` currently checks `char.hitDice` to conditionally render the Hit Dice column (line ~295, ~321 in current source). That check and the entire Hit Dice display block in the stats row must be removed. The condition gate (`hpMax > 0 || char.hitDice || armorType || armorTotal > 0`) should drop the `char.hitDice` term.

**Removing `"Hit Dice"` from `MOD_ATTRIBUTES`**: Remove from the array in `constants.js`. No currently-active character is known to use a `"Hit Dice"` modifier — the product owner has confirmed this. Existing DynamoDB records with a `Hit Dice` mod attribute will render harmlessly as an unknown-attribute entry if they exist (the frontend iterates mod entries; if `attribute` is not in `MOD_ATTRIBUTES` it simply won't appear in the attribute selector dropdown but any saved value still renders in the item mod list). Safe to remove from the selectable list with no migration needed.

**Scope boundary**: In scope — `hitDiceCurrent` session field, `HIT_DIE_BY_CLASS` constant, Combat tab tracker (full and depleted states), Spend modal, Long Rest update at both call sites, removal of `hitDice` from stats row and edit mode, removal of `"Hit Dice"` from `MOD_ATTRIBUTES`. Out of scope — automated HP recovery math, multiclass hit dice, DM card indicator (data will be available; rendering deferred per story).

**Dependencies**: This story touches three files with existing logic that must be modified precisely: `session.js` (add field), `dmParty.js` (add projection), `DmDashboardPage.jsx` `doLongRest()` (add `hitDiceCurrent` to each patch), `CharacterSheetViewMode.jsx` (add Long Rest patch + remove Hit Dice stats row + add tracker UI). `CharacterSheetEditMode.jsx` (remove Hit Dice input). `constants.js` (add `HIT_DIE_BY_CLASS`, add `hitDiceCurrent: null` to `BLANK_CHARACTER`, remove `"Hit Dice"` from `MOD_ATTRIBUTES`, add `"hitDiceCurrent"` to `LIVE_SESSION_FIELDS`). No new backend endpoint needed.

**Risks / decisions needed**:
1. **Inline spend shortcut vs. modal-only**: the UX open question. Recommendation is inline `−` decrement (no modal, immediate optimistic patch for single-die spend) plus a modal "Spend" button for multi-die + HP recovery preview. The builder should implement the inline path; the modal is additive.
2. **Spend modal stepper reset**: reset to 1 on each open (conservative — prevents accidental double-spend). No state persistence needed.
3. No other open decisions remain.
