# NPC Library — Design Brief

> Story 24. A DM-only persistent library of saved creature templates (name + abilities) that can be loaded into the Add Enemy form in any future session. Builds on Story 23's `abilities` field. Produced by design-strategist. Implementation spec for ux-designer.
>
> Core principle: the library is a **second path**, never a required step. A DM who never opens it should feel zero weight from its presence.

---

## 1. Design intent

The DM has just statted a Drow Priestess for tonight's session. Forty seconds of typing spell shorthand into the `abilities` field. Three sessions later, the priestess reappears — and the work is still there, one tap away. That's the entire feeling: **persistent muscle memory for recurring enemies**.

Functionally, the library lives at two touch points and nowhere else:

1. **A "From library" affordance inside the existing Add Enemy form** — a quiet toggle that expands into a list. Closes by default; the form looks unchanged to anyone not using it.
2. **A "Save to library" item inside a new card overflow menu (`⋯`)** — the conventional kebab pattern, holding both this and the existing remove action.

There is **no standalone library page, no library navigation entry, no library modal**. The library only ever appears where it is actionable — picking, or saving. Management (rename, delete) lives inside the picker itself, as inline row affordances.

The mental model: this is a sketchpad of monsters the DM has scribbled before, not a managed compendium.

---

## 2. Information hierarchy

**Within the Add Enemy form (picker collapsed — the 95% state):**

1. Name input (existing, unchanged)
2. HP input (existing, unchanged)
3. Count stepper (existing, unchanged)
4. `+ Add Enemy` button (existing, unchanged)
5. **`◇ From library` toggle (new)** — sits below the helper text in the lightest visual weight available. Should read as a secondary path, never as competition for the primary fields.

**Within the Add Enemy form (picker expanded):**

1. The picker list itself — full-width, scrollable, most-recently-used first
2. Each row: name (Cinzel 14) + ability preview (Crimson Text 11, two-line clamp)
3. Picker close affordance (`× Close library`) — small, top-right of the picker panel
4. Search input — only when `templates.length > 20`, slim, at the top of the picker

**Within the NPC card overflow menu (`⋯`):**

1. **Save to library** (or "Update 'Drow Priestess' in library" when name match exists) — primary intent of the menu
2. Remove from combat — destructive, separated by a divider, in error red

The card itself does **not** show any library badge or icon. A saved-to-library NPC looks identical to an unsaved one. Rationale: the card is for combat, not library status. The DM doesn't need to know "this one is saved" in the middle of a fight — they need to know "this one has 3 HP left."

---

## 3. Annotated wireframes

### 3a. Add Enemy form — picker collapsed (default; matches today's form + one new row)

```
┌──────────────────────────────────────────────────────────┐
│  ADD ENEMY                                               │
│                                                          │
│  [ Name…                              ]  [ HP  ]         │
│  Count: [ 1 ]                                            │
│                                                          │
│  [          + Add Enemy          ]                       │
│                                                          │
│  Use + Init on a card to add it to the turn order.       │
│                                                          │
│  ① ◇ From library                                        │
└──────────────────────────────────────────────────────────┘
```

① **`◇ From library` toggle** — IM Fell English, 11px, uppercase, `letter-spacing: 0.18em`, `pal.textMuted`. Diamond glyph `◇` (11px, `npcPal.accent`) 6px left of the label. Padding `8px 0 2px`, touch target padded to 36px height (44px on the row including the surrounding margin). Sits below the existing helper text, no border, no background. The quietest possible affordance — a bandit-spawning DM must not feel this row pulling at their attention.

On hover (desktop): color shifts to `npcPal.bright`, diamond fills (`◆`). On tap: diamond rotates 45° to `◆` and label cross-fades to "Hide library" — see §4.

### 3b. Add Enemy form — picker expanded, populated

```
┌──────────────────────────────────────────────────────────┐
│  ADD ENEMY                                               │
│                                                          │
│  [ Name…                              ]  [ HP  ]         │
│  Count: [ 1 ]                                            │
│                                                          │
│  [          + Add Enemy          ]                       │
│                                                          │
│  Use + Init on a card to add it to the turn order.       │
│                                                          │
│  ◆ Hide library                              ② × Close   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ③ Drow Priestess                            ⑤ ×    │  │
│  │    ④ ◆ Spells (DC 13): Sacred Flame 1d8 rad…       │  │
│  ├────────────────────────────────────────────────────┤  │
│  │   Goblin Sneak                                ×    │  │
│  │    ◆ Sneak Attack +2d6 once/turn; Disengage…       │  │
│  ├────────────────────────────────────────────────────┤  │
│  │   Bandit Captain                              ×    │  │
│  │    ◆ Multiattack: 2× scimitar, 1× pistol…          │  │
│  ├────────────────────────────────────────────────────┤  │
│  │   Wraith                                            │  │
│  │    ⑥ (no abilities saved)                          │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

② **`× Close`** — IM Fell English, 10px, `pal.textMuted`. Redundant with the toggle (above) but always reachable at the picker's own header — important because once the picker is long, the toggle scrolls off-screen with the form's parent container. 32px touch target.

③ **Template row** — full-width, `padding: 10px 12px 8px`, `border-bottom: 1px solid npcPal.actionBorder` (last row: none). Whole row is tappable. On tap: name pre-fills the form's Name input, abilities are staged for the spawned NPC, picker collapses, focus returns to the **HP input** (the DM's next required decision). Hover: `background: npcPal.chipBg`.

Name: Cinzel, 14px, `npcPal.bright`. No prefix glyph (the `◆` is reserved for the abilities line).

④ **Ability preview** — Crimson Text, 11px, `pal.textBody`, `line-height: 1.45`, `opacity: 0.85`. Leading `◆` glyph (10px, `npcPal.accent`). Two-line clamp via `-webkit-line-clamp: 2`. Indent matches the name (no double-indent — preview belongs to the row, not nested under the name).

⑤ **Row delete `×`** — IM Fell English, 13px, `pal.textMuted`. 32px touch target, right-aligned. Two-tap delete: first tap morphs the row to show `[ Delete? ] [ Cancel ]` (inline, see §3d). No modal. Rationale: deleting a library entry is mild; deleting the wrong one costs ~40 seconds of re-typing, not data loss. A confirmation modal would be heavier than the offense.

⑥ **Saved with no abilities** — `(no abilities saved)`, Crimson Text italic, 11px, `pal.textMuted`. Edge case: a DM might save a card whose `abilities` field is empty (e.g., they wanted to save the name as a marker). Allowed, but visually demoted so it's clear what they're getting.

### 3c. Add Enemy form — picker expanded, empty library

```
┌──────────────────────────────────────────────────────────┐
│  ADD ENEMY                                               │
│                                                          │
│  [ Name…                              ]  [ HP  ]         │
│  Count: [ 1 ]                                            │
│                                                          │
│  [          + Add Enemy          ]                       │
│                                                          │
│  Use + Init on a card to add it to the turn order.       │
│                                                          │
│  ◆ Hide library                                × Close   │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│  │                                                      │ │
│  │ ⑦ Library is empty.                                  │ │
│  │    Save any NPC card from its ⋯ menu to              │ │
│  │    build your library.                               │ │
│  │                                                      │ │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└──────────────────────────────────────────────────────────┘
```

⑦ **Empty state copy** — Crimson Text italic, 13px, `pal.textMuted`, `line-height: 1.55`, padding `20px 16px`, center-aligned. Container: `border: 1px dashed npcPal.actionBorder` (dashed = "not yet, but a place is reserved here"). The dashed border distinguishes this from filled rows without melodrama.

Copy is instructive (tells the DM exactly how to populate), not plaintive. No "Get started" button — there is nothing to start; the population path is via the card menu, and the DM will find it the first time they want to keep an enemy.

### 3d. Inline delete confirmation (replaces row ⑤ tap state)

```
│ ┌────────────────────────────────────────────────────┐  │
│ │   Drow Priestess                                   │  │
│ │    ◆ Spells (DC 13): Sacred Flame 1d8 rad…         │  │
│ │    ⑧ Remove from library?    [ Delete ]  [ Cancel ]│  │
│ └────────────────────────────────────────────────────┘  │
```

⑧ **Inline confirmation row** — appears below the ability preview, pushing the next row down by ~32px (animated, see §4). Crimson Text italic, 12px, `pal.textMuted` for the prompt. `[ Delete ]` button: ghost-destructive, color `#c06060`, border `1px solid rgba(192,96,96,0.4)`. `[ Cancel ]` button: ghost, `pal.textMuted`. Both 32px touch height, 12px font, IM Fell English. 6-second auto-dismiss back to row state with no committed action.

### 3e. NPC card with `⋯` overflow menu (new — currently the card has only `×`)

```
┌──────────────────────────────────────────────────────────┐
│ ⑨ Drow Priestess              ⑩ [+ Init]  ⑪ [⋯]   [×]   │
│   [−]  31 / 44  ███████░░░  [+]                          │
│   [Charmed]                                              │
│  ─────────────────────────────────────────────────────  │
│   ◆ Spells: Sacred Flame…                                │
│  ─────────────────────────────────────────────────────  │
│   [⚔ Dmg]   [✦ Heal]   [+ Cond]                          │
│   ▣ + Note                                             ▼ │
└──────────────────────────────────────────────────────────┘
```

⑨ Name (unchanged from Story 23).

⑩ `+ Init` / `− Init` toggle (unchanged — existing).

⑪ **`⋯` overflow button (new)** — IM Fell English, 14px, `pal.textMuted`. 32px square touch target, sits *between* the `+ Init` toggle and the `×` remove button. Hover: color → `npcPal.bright`. Tap: opens the overflow popover anchored to the button's bottom-right corner.

Note: the existing `×` remove stays where it is. Library-related actions go in the kebab; destructive removal stays as a one-tap on the card surface, because removing an enemy mid-combat is a high-frequency action that doesn't deserve a menu hop.

### 3f. Overflow popover — fresh save (no name conflict)

```
                                             ┌──────────────────────┐
                                             │ ⑫ ◆ Save to library  │
                                             ├──────────────────────┤
                                             │ ⑬ × Remove enemy     │
                                             └──────────────────────┘
```

⑫ **Save to library** — Crimson Text, 14px, `npcPal.bright`. Diamond `◆` glyph 8px left, `npcPal.accent`. Padding `10px 14px`. Hover: `background: npcPal.chipBg`. Full-row touch target (44px+ vertical).

⑬ **Remove enemy** — separated by `1px solid npcPal.actionBorder`. Crimson Text, 14px, `#c06060`. Same padding. Acts identically to the existing `×` button (closes popover, removes the NPC). Included in the popover for hit-target redundancy and for DMs who reach the menu first.

Popover container: `background: npcPal.surfaceSolid`, `border: 1px solid npcPal.actionBorder`, `border-radius: 4px`, `min-width: 200px`, `box-shadow: 0 6px 18px rgba(0,0,0,0.4)`. Anchored top-right under the `⋯` button. `z-index: 50` (must clear the active-turn `transform: scaleX(1.02)` of adjacent cards).

### 3g. Overflow popover — name conflict (existing library entry with same name)

```
                                             ┌────────────────────────────┐
                                             │ ⑭ Already in library:      │
                                             │    "Drow Priestess"        │
                                             ├────────────────────────────┤
                                             │ ⑮ ◆ Update existing entry  │
                                             │ ⑯ ◆ Save as new entry      │
                                             ├────────────────────────────┤
                                             │   × Remove enemy           │
                                             └────────────────────────────┘
```

⑭ **Conflict label** — IM Fell English, 10px, uppercase, `letter-spacing: 0.18em`, `pal.textMuted` for "Already in library:", then Crimson Text italic 13px `pal.textBody` for the name on the next line. Padding `10px 14px 8px`. Non-interactive.

⑮ **Update existing entry** — same row style as the fresh-save action. The dominant choice (98% of the time the DM is refining a creature they already saved). Replaces the library entry's `abilities` field in-place; the entry's `id` and most-recently-used position are both refreshed so the updated version surfaces at the top of the picker next time.

⑯ **Save as new entry** — same row style; appends a new entry. The library accepts duplicate names — the DM might intentionally maintain "Drow Priestess (Boss)" and a "Drow Priestess" minion variant with different ability lists.

No modal. The kebab popover holds the entire decision space. Tap outside or `Esc` to dismiss.

---

## 4. Motion spec

Reuse existing dashboard motion vocabulary. The picker expansion mirrors the existing `NpcNotesStrip` collapse/expand pattern.

| Event | Animation | Duration / easing | Communicates |
|---|---|---|---|
| `◇ From library` → `◆ Hide library` | Diamond glyph: 90ms color fill. Label cross-fades. | 90ms ease-out | "This is now active." |
| Picker expand | `max-height: 0 → scrollHeight`, `opacity: 0 → 1`. Rows stagger-fade in with `translateY(-2px) → 0`, 30ms between first 6 rows. | Panel: 220ms ease-out cubic. Row stagger: 120ms each. | "A new surface arrived from below the form." |
| Picker collapse | `max-height → 0`, `opacity → 0`. No row stagger on exit. | 160ms ease-in | Dismissal is faster than entrance — this is optional. |
| Row tap (select template) | Row briefly flashes `background: npcPal.chipBg` (120ms). Picker collapses (160ms). HP input receives `focus()` after 80ms. | — | "Got it. Your next move is HP." |
| Row delete tap (first) | Inline confirmation row: `max-height: 0 → 32px`, `opacity: 0 → 1`. Other rows shift down. | 180ms ease-out | "A decision is needed here, not committed yet." |
| Delete confirmed | Row: `max-height → 0`, `opacity → 0`, `transform: translateX(8px)`. Subsequent rows shift up. | 220ms ease-in | "Gone. The space closed around it." |
| Delete cancelled / auto-dismissed | Confirmation row reverses its entrance. | 180ms ease-in | "Back to safety." |
| `⋯` button tap | Popover: `scale(0.94) → scale(1)`, `opacity: 0 → 1`, transform-origin top-right. | 140ms ease-out cubic | "This menu belongs to that button." |
| `⋯` popover dismiss | `scale(1) → scale(0.94)`, `opacity → 0`. | 100ms ease-in | Getting out of the way. |
| Save to library committed | Popover row briefly shows `✓ Saved` (220ms `npcPal.bright`) before dismissing. | — | The save is the confirmation. |
| Library updated (existing entry) | Same as fresh save. Entry's MRU position refreshes silently. | — | — |
| Search input appears (>20 entries) | Slim search field fades in at top of picker on the open that crosses 20. | 180ms fade | "The shape of this list changed because it grew." |

**Zero animation on:** picker scroll, MRU re-ordering between picker opens, error states.

---

## 5. Interaction model

| Action | Trigger | Immediate response | Committed action | Cancel |
|---|---|---|---|---|
| Open library picker | Tap `◇ From library` | Diamond fills, label → "Hide library", picker expands | Component-local state — not persisted | Tap `Hide library` or `× Close` |
| Close picker (without picking) | Tap `Hide library` or `× Close` | Picker collapses | n/a | Tap `◇ From library` again |
| Pick a template | Tap any row | Row flashes, picker collapses, Name field filled, HP input focused | `abilities` staged in form state; rides along on `+ Add Enemy`. MRU updated on pick. | Edit the Name field, or close the picker to clear staged abilities |
| Delete a library entry (start) | Tap `×` on a row | Inline `[Delete] [Cancel]` appears below ability preview | Nothing committed | Tap `Cancel`, or wait 6s for auto-dismiss |
| Delete a library entry (commit) | Tap `[Delete]` | Row collapses, library rewritten without the entry | `PUT /npc-library` with entry removed | **Not undoable** |
| Open `⋯` overflow menu | Tap `⋯` on NPC card | Popover blooms from button's top-right | Component-local state | Tap outside or `Esc` |
| Save fresh (no conflict) | Tap `◆ Save to library` | Popover shows `✓ Saved` (220ms), dismisses | `PUT /npc-library` with new entry | Re-open `⋯` → delete via picker |
| Update existing | Tap `◆ Update existing entry` | `✓ Saved`, dismisses | `PUT /npc-library` with entry replaced + MRU refreshed | Re-save old abilities, or delete via picker |
| Save as new (despite conflict) | Tap `◆ Save as new entry` | `✓ Saved`, dismisses | `PUT /npc-library` with new entry appended | Delete one of the two via picker |
| Search (>20 entries) | Type in search field | Rows filter live by case-insensitive substring on name + abilities | None — local filter only | Clear the field |

**Keyboard:**
- `Esc` — closes picker, popover, or inline-delete confirmation (innermost first).
- `Enter` in search field — selects the first matching row.
- `Tab` order: Name → HP → Count → `+ Add Enemy` → `◇ From library`. Library is the last tab stop by design.

**No drag-to-reorder.** MRU sort is the only sort. Re-saving an entry refreshes its MRU position.

---

## 6. Edge cases and empty states

| Case | Behaviour |
|---|---|
| Library is empty, picker opened | Dashed-border empty state (§3c). `× Close` and `Hide library` still work. |
| Library has 1 entry | Single row. No special layout. |
| Library is large (50+ entries) | Picker max-height: `min(50vh, 360px)` with `overflow-y: auto`. Search input present (auto-shown above 20). |
| Template has empty `abilities` | Row shows `(no abilities saved)` in italic muted. Selectable normally. |
| Template name is very long | Truncate with ellipsis at row width. `title` tooltip on hover (desktop). |
| Template abilities preview is very long | Two-line clamp via `-webkit-line-clamp: 2`. No "show more" — this is a preview. |
| Save fails (network error) | Popover stays open; inline error at bottom: `Couldn't save — try again`, `#c06060`, Crimson Text italic 12px. DM's selection state preserved. |
| DM picks template, edits Name, taps `+ Add Enemy` | Spawned NPC uses edited name + picked template's `abilities`. |
| DM picks template with Count=3 | All 3 spawned NPCs get the same `abilities`. Per-instance after spawn — matches Story 23 behaviour. |
| DM saves card whose abilities were edited mid-session | Updates library with current card's `abilities`. No-auto-sync is one-way; explicit Save pushes current state. |
| Confirmation discoverability | After tap, the `Save to library` row shows `✓ Saved` (220ms, `npcPal.bright`) before popover dismisses. Only success affirmation in the feature — save has no visible effect on the card. |
| End Combat clears all NPCs | Library is untouched. The entire premise of the feature. |
| `npc-library` sentinel doesn't exist (first access) | `GET /npc-library` returns `{ templates: [] }`. Empty-state UI renders. First save creates the item. |

---

## 7. Mobile vs desktop delta

| Surface | < 560px (phone) | ≥ 900px (desktop) |
|---|---|---|
| `◇ From library` toggle | Identical | Identical |
| Picker max-height | `min(50vh, 320px)` | `min(50vh, 360px)` |
| Picker row | Full-width stack; `×` stays right-aligned | Identical |
| `⋯` overflow popover | `min-width: 180px`; shifts left if it would overflow viewport right edge | `min-width: 200px`, top-right anchored |
| Inline delete confirmation | Buttons full-width-stack below 380px (44px-tall rows) | Inline side by side |
| Search input (>20 entries) | Full-width sticky at picker top | Same |

Nothing disappears on mobile. Nothing reflows beyond natural stacking.

---

## 8. Resolved decisions (open questions from the story, answered)

| Story question | Decision | Rationale |
|---|---|---|
| Save to library — update existing or always new? | **Both, surfaced as a forced choice.** Name-match → popover shows "Update existing" + "Save as new" + dismiss. No silent decision. | DM may want either. Guessing wrong destroys their work. |
| Reasonable library size — search threshold? | **Search input auto-appears above 20 entries.** Below that, no search field. | 20 is the canonical "scannable list" ceiling. |
| Library picker — modal or inline dropdown? | **Inline expandable section inside the Add Enemy form.** | Modal yanks the DM out of context. Native dropdown can't show ability previews. Inline expansion preserves spatial memory. |

---

## 9. What the brief does *not* spec (deliberately deferred)

- **Bulk operations** (multi-select delete, batch save). Out of v1.
- **Tagging / categorization.** Story is explicit: flat list, MRU sort.
- **Sharing libraries between users / campaigns.** Not in this product.
- **Importing from external compendia.** Out of scope per story.
- **A "Recently picked" vs "Recently saved" distinction.** MRU updates on either — unified is simpler.
- **Library size warnings.** No limit; search handles large lists.

---

## 10. Data model (for architect)

- New sentinel item: `slug: "npc-library"`, `templates: [{ id: uuid, name: string, abilities: string[], updatedAt: ISO string }]`.
- `abilities` is an ordered array of individual ability/spell strings (each up to 255 chars), matching the `abilities: string[]` shape defined in Story 23.
- `updatedAt` is the MRU sort key. Updated on save *and* on pick.
- New endpoints (DM-auth, matching `putNpcCombat` shape):
  - `GET /npc-library` — returns `{ templates: [...] }` sorted by `updatedAt` descending.
  - `PUT /npc-library` — full-array replacement (matches `putNpcCombat` pattern).
- Filter `slug: "npc-library"` from `list.js` and `dmParty.js` via `filterPublicCharacterItems()` in `specialItems.js`.
- Polling: **not polled.** One fetch on dashboard mount; cache in component state; refetch only on save or delete.
- No changes to `npc-combat`, `initiative`, or character records.

---

## 11. Implementation paths

- **`src/features/dmDashboard/NpcCombatSection.jsx`**:
  - Add `LibraryPicker` sub-component (expandable picker inside Add Enemy form).
  - Add `NpcOverflowMenu` sub-component (`⋯` popover) — new sibling to NpcCard, holds save-to-library + remove actions.
  - Add `⋯` button to the NPC card header row between `+ Init` and `×`.
- **`src/features/dmDashboard/npcCombat.css`** — new classes: `.npc-lib-toggle`, `.npc-lib-picker`, `.npc-lib-row`, `.npc-lib-row-preview`, `.npc-lib-empty`, `.npc-overflow-btn`, `.npc-overflow-popover`, `.npc-overflow-item`.
- **`src/api.js`** — add `getNpcLibrary(dmPassword)` and `putNpcLibrary(dmPassword, templates)`.
- **Backend** — new handlers `getNpcLibrary.js` and `putNpcLibrary.js` + new route entries in `template.yaml`. Follow exact pattern of `getNpcCombat` / `putNpcCombat`. Add `NPC_LIBRARY_SLUG = "npc-library"` to `specialItems.js`.
