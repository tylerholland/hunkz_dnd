# Story 24 — NPC Library

**Status**: Design complete — Ready for Architect Notes
**Source**: User direction + RPG Consultant follow-on to Story 23

---

## Context

Story 23 adds a persistent `abilities` field to each NPC card. Once a DM has invested effort in writing a Drow Priestess's spell list or a recurring villain's special attacks, that work should be reusable. Right now, every time the DM spawns that enemy type again, they start from scratch. An NPC library lets the DM save a named creature definition once and reload it in any future session with one tap.

---

## Goal

Give the DM a persistent NPC library — a collection of saved creature templates (name + abilities) — so that recurring enemies, named villains, and frequently-used creature types can be spawned in future sessions without re-entering their abilities. The Add Enemy flow stays lightweight; saving to the library is a second operation on the card after the creature is already on the field.

---

## User stories

1. **As the DM**, I want to save any NPC card's name and ability reference text to a persistent library, so I don't have to re-type a recurring villain's spells or a common enemy type's special attacks in future sessions.

2. **As the DM**, I want to load a saved creature from my library when adding a new NPC to the combat tracker, so I can spawn a named or recurring enemy pre-populated with its ability reference in one step.

3. **As the DM**, I want my library to persist across sessions and End Combat clears, so that creatures I define once are available indefinitely without any maintenance.

4. **As the DM**, I want to update a saved library entry when I've refined a creature's ability text, so the library stays current with my notes without requiring me to delete and re-create the entry.

5. **As the DM**, I want to delete entries from my library, so I can remove creatures that are no longer relevant to the campaign.

6. **As the DM**, I want the Add Enemy form to remain fast and lightweight for enemies I'm using once, so spawning a throwaway bandit doesn't require interacting with the library at all.

---

## Functional requirements

- The NPC library is a persistent collection of creature templates: `{ id, name, abilities }`. Stored server-side, survives End Combat and session resets.
- **Save to library**: an affordance on each NPC card (likely in the `⋯` overflow menu) lets the DM save the current card's name + abilities as a new library entry, or update an existing entry if a match by name already exists.
- **Load from library**: the Add Enemy form gains an optional "From library…" path that opens a compact picker showing saved entries. Selecting an entry pre-fills the name and abilities fields. The count and HP fields remain blank — the DM fills those as normal. The base Add Enemy flow (name + HP + count) is unchanged for DMs who don't use the library.
- **Edit in library**: after loading a creature from the library, the DM can edit its abilities on the card and re-save to update the library entry.
- **Delete from library**: accessible from the library picker or the card's `⋯` overflow.
- **No auto-sync**: editing an NPC card's abilities mid-session does NOT automatically update the library. The DM explicitly chooses to save. This keeps session-time annotations from polluting their canonical creature definitions.

---

## Data model

- New DynamoDB sentinel item: `slug: "npc-library"` with a `templates: []` array of `{ id: uuid, name: string, abilities: string }`.
- New Lambda handlers: `getNpcLibrary` (GET /npc-library, DM auth) and `putNpcLibrary` (PUT /npc-library, DM auth, full array replacement matching the `putNpcCombat` pattern).
- No changes to PC character records, session fields, or existing sentinel items.

---

## Out of scope

- Full stat block templates (CR, all six stats, saving throws, immunities). The library stores name + abilities only — the same lean shape as the card field.
- Player visibility. Library is DM-only.
- Importing from any external compendium or SRD. All entries are DM-authored.
- Nested categories or tags. Flat list for v1; sort by most recently used.

---

## Open questions

- Should "Save to library" offer to update an existing same-name entry, or always create a new one? (Suggested: prompt "Update existing 'Drow Priestess'?" if a name match exists.)
- How many entries is a reasonable library size? No hard limit proposed — DMs will self-regulate. A search/filter field becomes useful above ~20 entries and should be added at that threshold.
- Should the library picker be a modal or an inline dropdown in the Add Enemy form?

---

## UX Design

Design brief: [`design/briefs/npc-library-brief.md`](../briefs/npc-library-brief.md)

**Resolved decisions** (open questions in the story above):
1. **Picker UI**: inline expandable section inside the Add Enemy form (not modal, not native dropdown). Triggered by a quiet `◇ From library` toggle below the existing helper text.
2. **Save flow**: a new `⋯` overflow menu on each NPC card holds `◆ Save to library` (and a duplicate of the existing remove action). The card's existing `×` button stays in place — destructive removal does not move into the menu.
3. **Name conflict**: when saving a card whose name matches an existing library entry, the overflow popover surfaces three explicit choices — `Update existing entry`, `Save as new entry`, or dismiss. No silent decision, no modal.
4. **Library management**: deletion lives inline on each picker row (two-tap: `×` → inline `[Delete] [Cancel]` confirmation). No standalone library page. Rename is not in v1 — DMs can update via the card flow.
5. **Empty state**: dashed-border placeholder inside the picker with instructive copy pointing at the card's `⋯` menu as the population path.
6. **Search/filter**: not in v1. A slim search input auto-appears at the top of the picker once `templates.length > 20`. Search matches by name *and* ability text.
7. **MRU sort**: updates on both *save* and *pick*. One `updatedAt` field on each entry; sort descending.
8. **Confirmation feedback**: after a successful save, the popover briefly shows `✓ Saved` (220ms) before dismissing — the only success affirmation in the feature, because the save has no visible effect on the card itself.

**Out of scope for v1**: bulk operations, tagging, cross-DM sharing, external compendium import, library size limits, undo for delete, drag-to-reorder.

**Integration points** in `src/features/dmDashboard/NpcCombatSection.jsx`:
- Add Enemy form (bottom of section): new `LibraryPicker` sub-component below the existing helper text.
- NPC card header row: new `⋯` button between `+ Init` and `×`, opening an `NpcOverflowMenu` popover.

**Backend** (for code-architect): new sentinel `slug: "npc-library"`, two DM-auth endpoints (`GET /npc-library`, `PUT /npc-library`) mirroring the `npc-combat` pattern. One-shot fetch on dashboard mount — not polled.

---

## Architect Notes

**Applies**: ADR-001 (CSS architecture), ADR-002 (feature-sliced modules), ADR-003 (DynamoDB schemaless), ADR-004 (one Lambda per HTTP operation), ADR-005 (DM auth via SSM hash), ADR-007 (`x-character-password` header), ADR-011 (polling + optimistic writes — see note below for why this feature opts out of polling).

**Depends on**: Story 23 (`abilities: string[]` shape on NPC cards). The library stores the same array verbatim. Do not implement this story until Story 23 is rebuilt and shipping the array shape, or the picker preview rendering and `+ New library entry` form will need to be redone.

**Tech approach**: One new DynamoDB sentinel item (`slug: "npc-library"`), two new Lambda handlers (`getNpcLibrary`, `putNpcLibrary`), two new API client functions, two new sub-components in the existing `NpcCombatSection.jsx` (a `LibraryPicker` inside the Add Enemy form, an `NpcOverflowMenu` popover anchored to a new `⋯` button on each NPC card header), and a set of new CSS classes. The library is fetched **once on dashboard mount** and held in `DmDashboardPage`-level state — not polled. Refetch on save or delete. This is a deliberate departure from ADR-011's polling default because the library has a single writer (the DM) and no real-time multi-actor visibility requirement; polling would burn requests for no behavioural benefit.

### Backend

**New sentinel slug** in `backend/src/lib/specialItems.js`:
- Add `const NPC_LIBRARY_SLUG = "npc-library";`, include it in `RESERVED_CHARACTER_SLUGS`, export from the module.
- The filter helper `filterPublicCharacterItems` picks up the new slug automatically via Set membership — `list.js` and `dmParty.js` exclude the library row from public listings with no further change.

**Record helpers** in `backend/src/lib/specialRecords.js`:
- Add `normalizeNpcLibraryRecord(item)` returning `{ templates: [...] }`. Each entry is coerced to `{ id: string, name: string, abilities: string[], updatedAt: string|null }`. Defensively: drop entries without a string `id`; default `name` to `""`; coerce `abilities` via `Array.isArray(...) ? ... : []`; default `updatedAt` to `null` if missing.
- Add `getNpcLibraryState()` / `saveNpcLibraryState({ templates })` mirroring `getNpcCombatState` / `saveNpcCombatState`. The save helper writes `templates` only; per-entry `updatedAt` is the MRU sort key and is distinct from the sentinel item's own `updatedAt` (which `putSpecialRecord` already stamps for record-modification time).
- Export both helpers.

**Handlers** (exact mirrors of `getNpcCombat.js` / `putNpcCombat.js`):
- `backend/src/handlers/getNpcLibrary.js` — DM-auth via `verifyPassword`, returns `ok(await getNpcLibraryState())`. ~10 LOC.
- `backend/src/handlers/putNpcLibrary.js` — DM-auth, validates `Array.isArray(body.templates)`, calls `saveNpcLibraryState({ templates: body.templates })`. ~13 LOC.
- No per-template field validation in the handler — DM is the sole writer and the client validates. Same posture as `putNpcCombat`, which also accepts an opaque array.

**SAM template** (`backend/template.yaml`):
- Add `GetNpcLibraryFunction` (Method `get`, Path `/npc-library`, `DynamoDBReadPolicy`) and `PutNpcLibraryFunction` (Method `put`, Path `/npc-library`, `DynamoDBCrudPolicy`) immediately after `PutNpcCombatFunction` (around line 336). Copy-paste the block with substituted handler names; nothing else differs.
- Handler count grows from 22 to 24, still well within the spirit of ADR-004's ~15 threshold — these are thin pass-throughs sharing `lib/`. No consolidation needed yet.

### API client

`src/api.js` — add two functions directly after `putNpcCombat` (around line 145):
```js
export const getNpcLibrary = (dmPassword) =>
  request("/npc-library", {
    headers: { "x-character-password": dmPassword },
  });

export const putNpcLibrary = (dmPassword, templates) =>
  request("/npc-library", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ templates }),
  });
```
Match the `putNpcCombat` pattern exactly — body is `{ templates }` (not the bare array), so the handler can validate the shape.

### Dashboard wiring

`src/pages/DmDashboardPage.jsx`:
- Add `const [npcLibrary, setNpcLibrary] = useState({ templates: [] });`.
- On the initial dashboard fetch (the `Promise.all` block around line 87 that already fetches `getNpcCombat`), add `getNpcLibrary(dmPassword)` to the array and wire its result into `setNpcLibrary`.
- **Do not** include it in the polling loop. Mount-fetched only.
- Add a `refetchNpcLibrary` callback: `() => getNpcLibrary(dmPassword).then(setNpcLibrary).catch(noop)`. Pass it down to `NpcCombatSection` for use after every save/delete.
- Pass `npcLibrary` and `refetchNpcLibrary` (and `dmPassword`, already passed) into `<NpcCombatSection ... />`.
- The payload is small (templates × ~1KB each); re-fetching after every mutation is fine. Do not optimistically update the library state — the round-trip is fast and the surface is small enough that the simpler model wins.

### Frontend components

All new components live as sub-components inside `src/features/dmDashboard/NpcCombatSection.jsx`, alongside `NpcCard`, `NpcAbilityRef`, `NpcNotesStrip`, `NpcDamageHealModal`, `NpcConditionPicker`. Per ADR-002, do not promote any of these to standalone files yet — the section is the natural feature slice.

**`LibraryPicker`** — rendered inside the Add Enemy form (today's block around lines 971–990 of `NpcCombatSection.jsx`). Props: `{ templates, dmPassword, onPick, onDelete, onCreate, npcPal, pal }`.
- `onPick(template)` — called when a row is tapped. The parent uses this to set `addName`, leave `addHp` blank (per brief §3b annotation ③), and stage `pickedAbilities: string[]` (new state at the `NpcCombatSection` level) for use when `handleAddNpcs` runs. Also closes the picker and focuses the HP input.
- `onDelete(templateId)` — called after the inline `[Delete]` confirmation. Parent writes the updated library via `putNpcLibrary`, then calls `refetchNpcLibrary`.
- `onCreate({ name, abilities })` — called when the inline `+ New library entry` form is submitted. Parent appends to library, writes, refetches.
- Local state: `open: bool`, `pendingDelete: string|null` (id currently in two-tap confirm), `search: string` (used when `templates.length > 20`), `creating: bool` (inline `+ New library entry` form open).
- **Not** a portal/modal — inline expanding block sitting below the existing helper text. Expand animation uses JS-measured `scrollHeight` toggling between `0` and the measured height (the existing dashboard expand vocabulary; do not invent new animations).

**`NpcOverflowMenu`** — rendered inline next to the existing `×` button in `NpcCard`'s header (the `flex-row` block at lines 633–654). Props: `{ npc, libraryTemplates, dmPassword, onLibraryWrite, onRemove, npcPal, pal }`.
- `onLibraryWrite(updatedTemplates)` — caller writes via `putNpcLibrary` and calls `refetchNpcLibrary`.
- Internal state: `popoverOpen: bool`, `savedFlash: bool` (drives the 220ms `✓ Saved` affirmation before dismiss).
- Name-conflict detection: case-insensitive, trimmed match — `templates.find((t) => t.name.trim().toLowerCase() === npc.name.trim().toLowerCase())`. If found, render the three-choice variant (§3g); else render the single-action variant (§3f).
- Click-outside dismissal: attach a `mousedown` listener on `document` when the popover opens, remove on close. Standard popover pattern — do not introduce a portal library. Guard against the same `mousedown` event that opened the popover closing it immediately (defer the listener with `setTimeout(..., 0)` or check `event.target.closest(".npc-overflow-popover, .npc-overflow-btn")`).

**`NpcCard` header change** — add a `⋯` button (`.npc-overflow-btn`) between the existing `+ Init` toggle and the `×` remove button. Wire the click to open the popover. The popover renders as a sibling positioned absolutely within the same header row — set `position: relative` on the row, `position: absolute` on the popover with `right: 0; top: 100%;`. Brief calls for `z-index: 50` to clear the active-turn `transform: scaleX(1.02)` on adjacent cards — set this in CSS.

**Staging picked abilities through `handleAddNpcs`**: today (lines 833–851 of `NpcCombatSection.jsx`) `handleAddNpcs` builds new NPC objects from `addName`/`addHp`/`addCount` only. Add a `pickedAbilities: string[]` state (default `[]`) that the picker sets via `onPick`. When `handleAddNpcs` runs, every spawned NPC gets `abilities: [...pickedAbilities]` (a shallow copy per spawn so the cards become independent post-spawn, matching brief §6: multiple NPCs of same type → per-instance). Clear `pickedAbilities` to `[]` after the add. If the DM edits the Name field between picking and adding, `pickedAbilities` is unchanged — the abilities ride along with whatever name lands in the form.

**MRU update on pick**: Per brief §4, picking a template **also** bumps its `updatedAt`. The picker's `onPick` callback must therefore write to the library (`putNpcLibrary` with the same array, the picked entry's `updatedAt` refreshed) **in addition to** staging the name+abilities locally. Fire-and-forget — do not block the picker close on it (the DM's next action, typing HP, must not be blocked). Refetch the library after the write resolves so the next picker open reflects the new MRU order.

**`+ New library entry` reuses Story 23's editor**: The brief's `+ New library entry` inline form is structurally the same per-entry array editor used in `NpcAbilityRef`'s edit mode (Story 23). Extract that editor body (the per-entry rows + add-row + char counter) into a small helper component `AbilitiesListEditor({ value, onChange, npcPal })` in the same file. Both `NpcAbilityRef` (when entering edit mode) and the library's `+ New library entry` form render this helper. This handoff is the cleanest part of the dependency between the two stories — do not skip the extraction.

### New CSS classes

All in `src/features/dmDashboard/npcCombat.css`. Append after the existing NPC Card section, before `/* ─── Add enemy form ─── */` (line 379) — or in a new section block at the end of the file, either is fine. Names match brief §11:

- `.npc-lib-toggle` — the `◇ From library` row (IM Fell English 11px, uppercase, letter-spacing `0.18em`, color `var(--pal-text-muted)`, padding `8px 0 2px`, `min-height: 36px`). Hover shifts to `var(--npc-bright)`. The `◇ → ◆` glyph swap is content-level — toggle two spans or use `::before` with a `[data-open]` attribute on the wrapper.
- `.npc-lib-picker` — expandable container. `max-height: min(50vh, 360px)` (320px on phone via media query), `overflow-y: auto`, `border: 1px solid var(--npc-action-border)`, `border-radius: 4px`, `margin-top: 6px`.
- `.npc-lib-picker[data-state="empty"]` — adds `border-style: dashed` and removes the row chrome.
- `.npc-lib-row` — `padding: 10px 12px 8px`, `border-bottom: 1px solid var(--npc-action-border)`, `:last-child { border-bottom: none; }`, `:hover { background: var(--npc-chip-bg); }`, `cursor: pointer`.
- `.npc-lib-row-name` — Cinzel 14, `var(--npc-bright)`, `display: flex`, `justify-content: space-between` so the per-row `×` sits right-aligned.
- `.npc-lib-row-preview` — Crimson Text 11, `var(--pal-text-body)`, `opacity: 0.85`, two-line clamp via `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;`. Render the first 2 entries of `abilities[]` joined with `" · "`, then `" · + N more"` when `abilities.length > 2`. Leading `◆` glyph included.
- `.npc-lib-row-empty-abilities` — italicised `(no abilities saved)`, 11px, `var(--pal-text-muted)`.
- `.npc-lib-row-delete-confirm` — inline confirmation row (wireframe 3d). `display: flex`, `gap: 8px`, `padding-top: 6px`. Buttons reuse the existing ghost vocabulary.
- `.npc-lib-empty` — dashed-border empty state. `border: 1px dashed var(--npc-action-border)`, `padding: 20px 16px`, `text-align: center`, italic Crimson Text 13 in `var(--pal-text-muted)`.
- `.npc-lib-search` — slim full-width search input shown above 20 entries (reuse `.input-base` if applicable; 12px font).
- `.npc-overflow-btn` — the `⋯` button. Same dimensions/feel as `.btn-npc-remove` but the muted dot character at 14px. Requires `position: relative` on the parent header row.
- `.npc-overflow-popover` — `position: absolute`, `top: 100%`, `right: 0`, `background: var(--pal-surface-solid)`, `border: 1px solid var(--npc-action-border)`, `border-radius: 4px`, `min-width: 200px` (180px below 560px viewport via media query), `box-shadow: 0 6px 18px rgba(0,0,0,0.4)`, `z-index: 50`, `padding: 4px 0`.
- `.npc-overflow-item` — Crimson Text 14, `var(--npc-bright)`, padding `10px 14px`, `:hover { background: var(--npc-chip-bg); }`. Variant `.npc-overflow-item--destructive` swaps the colour to `#c06060`.
- `.npc-overflow-conflict-label` — the "Already in library:" header (IM Fell English 10px uppercase, letter-spacing `0.18em`, `var(--pal-text-muted)`) plus the name line (Crimson Text italic 13, `var(--pal-text-body)`).
- `.npc-overflow-divider` — `1px solid var(--npc-action-border)` separator inside the popover.

Per ADR-001, no `style={}` for any of the above. Inline styles remain reserved for truly dynamic values (active-turn `--turn-color`/`--turn-glow`, JS-measured picker `max-height` during expand). The picker expand animation uses the same JS-measured `scrollHeight` toggle vocabulary already in use elsewhere in the dashboard — do not invent new keyframes.

### Polling and live-sync (out of scope)

The library is **not polled**. Mount-fetch + refetch-on-write only. If a future feature requires multi-DM visibility (two DMs editing the library from two browsers), follow ADR-011 and add polling to the dashboard polling loop. At current single-DM scale, polling the library would consume ~86,400 extra Lambda invocations per day per dashboard tab with zero behavioural benefit. Document this opt-out in the implementation PR description.

### Scope boundary — explicit in / out

**In scope**:
- Backend sentinel + 2 Lambdas + 2 SAM routes + `NPC_LIBRARY_SLUG` in `specialItems.js` + normalize/get/save helpers in `specialRecords.js`.
- `LibraryPicker` inline component: expand toggle, scrollable list, MRU sort, inline two-tap delete with 6-second auto-dismiss, empty-state, search input on `templates.length > 20`.
- `+ New library entry` inline form at the bottom of the picker, reusing the `AbilitiesListEditor` helper extracted from Story 23's `NpcAbilityRef` edit mode.
- `NpcOverflowMenu` popover: single-action save variant + 3-choice conflict variant + destructive `× Remove enemy` duplicate.
- `⋯` button on the NPC card header between `+ Init` and `×`.
- Staging `pickedAbilities` for the next `+ Add Enemy` action; respects `Count > 1` (every spawned NPC gets its own array copy).
- MRU `updatedAt` bump on both save and pick. Client-side sort by `updatedAt desc` on every picker open.
- `✓ Saved` 220ms affirmation in the popover before dismissal.

**Explicitly out**:
- Standalone library management page or route.
- Rename in v1 (DM updates by saving over from the card menu).
- Polling the library state.
- Drag-to-reorder, tagging, bulk operations, undo for delete, library size warnings, cross-DM/cross-campaign sharing, external compendium import.
- Per-template ability roll buttons. The library is a reference store; rolls go through the existing DM dice roller.

### Scope risks the feature-builder must watch

1. **Story 23 must land first.** Both the row preview ("first 2 abilities + `+ N more`") and the `+ New library entry` form rely on the `abilities: string[]` shape. Building on the prior string shape will require painful rework.
2. **Extract `AbilitiesListEditor` from Story 23 before starting the library editor.** If Story 23 ships with the array editor still inline inside `NpcAbilityRef`, do the extraction as the first commit in this story.
3. **`updatedAt` is per-entry, not per-record.** Easy mistake: stamping the sentinel item's own `updatedAt` (which `putSpecialRecord` writes automatically) and treating that as the MRU sort key. Each `templates[i].updatedAt` must be set explicitly at save and at pick time, on the client.
4. **Pick-fires-write race.** Picking a template both stages local state and fires a background MRU `putNpcLibrary`. If the DM rapid-fires `+ Add Enemy` before the MRU write resolves, that's fine — the spawned NPC carries the staged array independent of library state. Do not block the spawn on the library write.
5. **Click-outside dismissal of the popover** must not eat the `⋯` button's own click that opened it. Standard fix: bind the `mousedown` listener inside `setTimeout(..., 0)` after open, or `event.target.closest(".npc-overflow-popover, .npc-overflow-btn")` check.
6. **Name conflict is case-insensitive and trimmed.** `"Goblin"` vs `"goblin "` are conflicting. Implement the comparator once at the top of `NpcOverflowMenu` and reuse for save-flow branching and (if implemented) duplicate-warning UI.
7. **Save as new entry creates a duplicate-name entry intentionally.** Do not de-duplicate on the backend or filter the picker by unique name. The brief explicitly allows multiple `"Drow Priestess"` entries.
8. **Empty-state first-load path.** No `npc-library` row exists yet → `normalizeNpcLibraryRecord(null)` returns `{ templates: [] }`. First save creates the row via `putSpecialRecord` → `PutCommand`. No special-case in the handler. Verify in dev by deleting the row and round-tripping.
9. **20-entry search threshold** — show the search input on every picker open once `templates.length > 20`. Hide again if the array drops below the threshold after a delete. The search is purely local filter — case-insensitive substring on `name` and the **joined** abilities (`abilities.join(" ")`).
10. **Inline delete two-tap timer** — 6-second auto-dismiss for `[Delete] [Cancel]`. Store the timer in a ref and clear on unmount, on cancel, on confirm, and when the picker closes. Same leak pitfall as Story 23's 4-second auto-collapse.
11. **`+ New library entry` is inline, not a modal.** It expands inside the picker (push the rest of the list down). Reusing the `AbilitiesListEditor` helper keeps the per-entry input + `[+]` + char counter behaviour consistent.
12. **Concurrent writes between NPC combat and library** — the two sentinel items are independent; no cross-write coordination needed. The dashboard's existing optimistic merge for `npc-combat` is unaffected.

### Performance / cost

- Two new Lambdas at default 128MB memory — copy `getNpcCombat` / `putNpcCombat` config in `template.yaml`. No `MemorySize` override. Cold start is acceptable on a fetch that runs once per dashboard mount.
- DynamoDB: PAY_PER_REQUEST, one new sentinel item, ~1KB per template entry. At 100 templates → ~100KB item, well under the 400KB limit. Per-write WCU is 1. Cost remains negligible.
- No new S3 objects.
- Client memory: ~100 templates × ~1KB = ~100KB in `DmDashboardPage` state. Inconsequential.
- Picker scroll container (`max-height: min(50vh, 360px)` with `overflow-y: auto`) bounds DOM render cost even at 200+ templates.

### New ADR? — no

This story uses existing patterns end-to-end (sentinel-item DynamoDB record per ADR-003, one Lambda per HTTP op per ADR-004, DM-only header auth per ADR-005/007, inline feature components per ADR-002, CSS classes per ADR-001/014). The one notable choice — opting out of ADR-011's polling for library state — is feature-local rather than architectural and is justified by the single-writer access pattern. Document the opt-out in the PR description. If the app later gains multi-DM support (ADR-005's revisit condition), revisit the polling decision then. No new ADR required.
