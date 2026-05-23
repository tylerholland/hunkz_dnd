# Story 23 — NPC Spell and Ability Reference

**Status**: Design updated — needs re-implementation (abilities field changed from string to string[])
**Source**: RPG Consultant
**Brief**: `design/briefs/npc-ability-reference-brief.md`

---

## Consultant analysis

The DM dashboard tracks NPC HP, conditions, initiative position, and concentration. What it does not track is what the NPC can actually do. Every time an enemy spellcaster or special-ability monster takes its turn, the DM must either recall the creature's abilities from memory or break the session's momentum to check an external source — a physical book, a PDF, a browser tab. In a Greyhawk campaign with custom creatures, homebrew adaptations, and setting-specific monsters, no online compendium is available as a fallback. The DM is the sole authority on what an NPC can do.

### The gap in practice

During combat, each NPC turn follows a predictable DM decision tree: What can this creature do? What are its options this round? What are the relevant mechanics (range, targets, save DC, damage expression, effect)? Currently, none of this is in the app. The NPC card surfaces HP and conditions — the results of abilities — but not the abilities themselves. For simple enemies (bandits, wolves) this is fine. For any creature with a meaningful action economy — a wizard, a named villain, a guardian with legendary actions — the DM is working from memory or a book held in the other hand.

### Why not a full stat block?

A full monster stat block (CR, speed, all six stats, saving throws, immunities, every trait and action) is a significant data entry burden and duplicates what the DM already has in their notes or book. It also implies the app is trying to replace the rulebook, which it is not. The right target is narrower: a free-text field where the DM pastes or writes the two or three things they actually need to remember mid-combat for this specific creature — a spell list, a special attack description, legendary action options, a recharge ability, a unique condition it can impose. The format is entirely at the DM's discretion.

### The Greyhawk / custom-source constraint

Because this campaign uses Greyhawk sources and homebrew material rather than the 5e SRD, auto-population from any compendium API is not viable and should not be attempted. Every ability reference must be DM-entered. This is not a limitation to work around — it is the correct design for a campaign where the DM is the authoritative rules source. Free text is the right data model.

### What already exists

NPC cards have a `notes` field (Story 10) used for session-scoped DM annotations that are discarded when combat ends. Ability reference is a different kind of data: it belongs to the NPC definition, persists across encounters, and should be visible at a glance during the turn rather than buried in a collapsible notes strip. It deserves its own field and its own surface treatment on the card.

---

## Goal

Give the DM a persistent, free-text ability reference field on each NPC card so they can see, at a glance during combat, what that creature can do on its turn — without consulting an external source. The field is DM-entered at NPC creation or edit time, works for any content source including homebrew and Greyhawk custom material, and is distinct from the session-scoped notes strip.

---

## User stories

1. **As the DM**, I want to enter a free-text ability reference when I create or edit an NPC card — covering spells, special attacks, recharge abilities, or legendary actions in whatever format suits me — so the information I need for that creature's turn is always available on the card without opening a book.

2. **As the DM**, I want the ability reference to persist across combat sessions on an NPC card, so I do not have to re-enter it each time I use the same recurring enemy (a named villain, a faction spellcaster, a guardian creature that appears in multiple encounters).

3. **As the DM**, I want to see the ability reference directly on an NPC's card during combat — either inline or revealed without leaving the dashboard view — so I can read it quickly on that creature's initiative turn without navigating away.

4. **As the DM**, I want to edit the ability reference on a card I have already created, so I can update it between sessions as I refine my notes or add abilities I forgot to enter initially.

5. **As the DM**, I want the ability reference field to accept any text I paste or type — spell descriptions, damage expressions like "3d6 fire," save DCs, short ability summaries in my own shorthand — with no validation or required structure, so it works equally well for SRD monsters, Greyhawk creatures, and fully homebrew designs.

---

## Functional requirements

- NPC cards in the `npcCombat` record gain a new optional field: `abilities` (free text string, no maximum enforced in the UI).
- The DM can enter and edit the `abilities` text when creating a new NPC card and when editing an existing one. The edit interaction must be reachable from the card during a live session without navigating away from the dashboard.
- The `abilities` text is displayed on the NPC card in a way that does not obscure HP and condition state (the information the DM needs continuously). The content should be readable without a secondary page load or route change.
- When `abilities` is empty, the card shows a quiet affordance to add reference text. It does not render an empty field or placeholder block that adds visual noise during sessions where the NPC is simple.
- The `abilities` field persists with the NPC definition — it is part of the NPC object stored in the `npc-combat` DynamoDB sentinel item, not part of the session-scoped notes strip. It survives "End Combat" and reappears when the same NPC is used in a future session.
- The existing session-scoped `notes` strip (added in Story 10) remains as-is. Ability reference and session notes are distinct: one is a pre-authored reference, the other is a live annotation. They do not merge.
- The DM can clear the `abilities` field at any time, reducing the card back to its minimal state.

---

## Data model changes

- `npcCombat` NPC objects (stored in the `npc-combat` sentinel item) gain an optional `abilities` field: `string | undefined`. Absence is treated identically to an empty string.
- No changes to PC character records, the `initiative` sentinel, or any player-facing data paths.
- The `putNpcCombat` write path already handles the full NPC array; no new API endpoint is needed — the field rides along with existing writes.

---

## Out of scope

- Auto-population of ability text from any external source (D&D Beyond, Open5e, any compendium API). All content is DM-entered.
- Structured ability modeling (action type, range, target count, damage type). The field is free text only.
- Player visibility. Ability reference is DM-only. It is never surfaced on player character sheets or through any player-accessible endpoint.
- Per-ability roll buttons or integrated dice interactions. The DM uses the existing DM dice roller for any rolls; the ability field is a reference, not an action trigger.
- NPC spell slot tracking. That is a separate concern and explicitly deferred.

---

## Open questions

- Should `abilities` survive the "End Combat" clear action, or should clearing combat also wipe the ability text? The intent above is that it persists (it is a definition field, not a session annotation), but this has UX implications for how "End Combat" is communicated to the DM.
- How should the ability reference be displayed when it is long? A two-line truncate-with-expand pattern keeps the card compact; a full-height scrollable area keeps all content accessible but grows the card significantly. This is a UX tradeoff for the designer to resolve.
- Should there be a way to mark specific abilities as used this round or this encounter (e.g., a recharge ability that has fired)? This starts to look like structured tracking rather than a reference field. Worth a separate story if the DM finds they want it.

---

## UX Design

**Brief**: `design/briefs/npc-ability-reference-brief.md`

### Scope summary

- **Placement**: inline in NPC card body, between conditions row and action button row. Never obscures HP/conditions; distinct from the bottom session-notes strip.
- **Collapsed default**: two-line truncate with leading `◆` diamond (Cinzel, `npcPal.accent`), Crimson Text 13px, `pal.textBody`. "Show more" appears only when content overflows.
- **Empty state**: single quiet `+ Ability reference` micro-label (IM Fell English 10px, `pal.textMuted`). The lightest possible affordance — bandit cards must not look under-furnished.
- **Expanded**: full text with preserved line breaks, capped at `min(60vh, 480px)` with internal scroll. Pencil `✎` (right-aligned in the Show less row) opens inline edit.
- **Edit**: textarea replaces the read-mode block in place (no modal). `Cancel` + `Clear field` (destructive) + `Save`. `Esc` cancels; `⌘/Ctrl+Enter` saves. DM never leaves the dashboard.
- **Auto-expand on active turn**: when this NPC becomes the active turn in initiative, abilities auto-expand for the duration of that turn, then collapse on turn-off. The DM never taps to see abilities on the creature's own turn.
- **Persists with NPC definition**: `abilities: string` field on `npcCombat.npcs[]` entries, written via existing `putNpcCombat` path. No new endpoint, no new auth.
- **Distinct from session notes strip**: ability reference in card body (composed, persistent); notes remain a bottom drawer (scrappy, session-scoped). Spatial separation communicates the difference.

### Open questions for user

1. Full cross-session persistence ("survives End Combat") requires an NPC template library — brief defaults to documenting the limitation and deferring that to a future story.
2. Auto-expand on active turn — ships on by default; drop from v1 if too aggressive.
3. Add Enemy form — no abilities field at creation time (brief default); edit on card after creation.

---

## Architect Notes

> **Replaces prior Architect Notes.** The data model shifted from `abilities: string` to `abilities: string[]`. The previous string-based implementation in `NpcAbilityRef` (lines ~269–461 of `NpcCombatSection.jsx`) must be torn out and rewritten. Re-use the surrounding NPC card scaffolding and the existing `.npc-ability-ref*` CSS class names — most CSS stays, with new rules added for the per-entry list and the inline add-row.

**Applies**: ADR-001 (CSS architecture), ADR-002 (feature-sliced modules), ADR-003 (DynamoDB schemaless), ADR-011 (optimistic session writes)

**Tech approach**: `abilities` becomes an ordered array of strings — each entry is a discrete ability or spell line, capped at 255 chars per entry by the input's `maxLength` (no array-length cap; DMs are the only writers and DynamoDB's 400KB item ceiling is not at risk). Persisted via the existing `putNpcCombat` Lambda — no new endpoint, no new auth, no backend changes. The frontend `NpcAbilityRef` sub-component is rewritten to render three discrete states (read-collapsed, read-expanded, edit) over a structured list rather than a single textarea blob. Story 24 depends on this shape — `templates[].abilities` in the NPC library is the same `string[]`, so a card load from library or a save to library can move the array verbatim without per-entry parsing.

**Data model**: Each entry in `npcCombat.npcs[]` gets `abilities: string[]` (optional; treat missing or non-array as `[]`). Per-entry strings are trimmed before commit; whitespace-only entries are dropped at save time so the array never contains empty strings. The existing `putNpcCombat` handler is pass-through — `saveNpcCombatState({ npcs: body.npcs })` writes the entire `npcs` array via `PutCommand` and `normalizeNpcCombatRecord` in `specialRecords.js` uses spread (`...npc`), preserving unknown fields on read. **One small backend note**: if `normalizeNpcCombatRecord` is ever extended to coerce `abilities` to an array, that's fine, but it's not required for this story. The frontend should defensively coerce on read (`Array.isArray(npc.abilities) ? npc.abilities : []`) to tolerate legacy string values from any existing rows still in DynamoDB during the rollout window. After the first save on each NPC, the field is canonicalised to an array.

**Migration / backward compatibility**: Any NPCs already in DynamoDB from the prior implementation will have `abilities: string` (single string). The new component must accept both shapes on read. Easiest path: `const list = Array.isArray(npc.abilities) ? npc.abilities : (typeof npc.abilities === "string" && npc.abilities.trim() ? [npc.abilities] : []);`. The first edit-and-save on that NPC will rewrite the field to `string[]`. No formal migration script needed.

**Component structure**: Keep `NpcAbilityRef` as a sibling sub-component in `NpcCombatSection.jsx` (the existing position is correct per ADR-002 — do not move it to its own file). Internal shape:
- Props: `{ abilities: string[], isActiveTurn, npcPal, onSave }` where `onSave(nextAbilities: string[]) => Promise<boolean>` mirrors today's signature with an array payload instead of a string.
- Local state: `expanded: bool`, `editing: bool`, `draft: string[]` (a working copy of the array used only in edit mode), `addInput: string` (the current text in the inline `+ Add ability…` field).
- The `[Done]` button commits `draft` via `onSave` (one network write for the whole array). `Cancel` discards `draft`.
- Inside edit mode, **each entry is a row** with a `[−]` remove button to the left of the text. Remove is **one-tap** with no confirmation (the brief explicitly says re-adding is cheap and a confirm step is friction; this mirrors the brief's earlier "Clear field" → "Save" two-step at the array level — i.e. `Cancel` is still the undo).
- The inline add row contains a text input + `[+]` button. Pressing `Enter` in the input is equivalent to clicking `[+]`. Each append clears the input but does **not** commit to the server — the entire array only flushes on `Done`.
- Character counter shows on the active text input (the add field, or whichever entry input is focused if the design later supports inline-editing existing entries — for v1, existing entries are not editable, only removable; the DM removes and re-adds to revise).

**Three read/edit states the component must render**:
1. **Empty (`abilities.length === 0` && !editing)**: single quiet `+ Ability reference` micro-button. Same `.npc-ability-ref-toggle[data-empty="true"]` styling as today.
2. **Read-collapsed (default when populated)**: render the first 3 entries as `◆` list items (each as a `.npc-ability-ref-item` row), then a footer row with `Show all N` (only when `abilities.length > 3`) on the left and `✎` pencil on the right. If `abilities.length <= 3`, the footer shows only the pencil.
3. **Read-expanded**: render all entries as `◆` list items, footer with `Show less` + `✎`.
4. **Edit**: render each entry as a `.npc-ability-ref-edit-row` (with `[−]` button + text), then the inline `+ Add ability…` row, then `[Cancel] [Done]` action buttons. No `Clear field` button is needed any more — removing every entry one at a time is equivalent and the array shape makes the per-entry remove the right primitive.

**Auto-expand on active turn**: Unchanged from the original brief — auto-expand to the **read-expanded** state (state 3 above) when `isActiveTurn` becomes true and `abilities.length > 0` and `!editing`. Auto-collapse to read-collapsed (state 2) on turn-off, unless `editing` is true. Never auto-enter edit mode. The existing effect in the current implementation is the right shape; just update the guard condition.

**Files to change**:
- `src/features/dmDashboard/NpcCombatSection.jsx` — rewrite the `NpcAbilityRef` function (currently lines ~269–461) and update its call site (lines ~734–744) to pass `abilities` as an array and accept `string[]` from `onSave`. Keep `NpcCard`'s render insertion point unchanged. The `commitNpcList` flow at the parent level needs no change — it already takes the full `npcs` array.
- `src/features/dmDashboard/npcCombat.css` — keep the existing `.npc-ability-ref`, `.npc-ability-ref-diamond`, `.npc-ability-ref-toggle`, `.npc-ability-ref-toggle[data-empty="true"]`, `.npc-ability-ref-edit-row`, `.npc-ability-ref-editor`, `.npc-ability-ref-actions`, `.npc-ability-ref-counter` rules where they are (lines 273–377). **Delete** `.npc-ability-ref-preview` (the line-clamp container — no longer needed; each entry is rendered as a discrete row) and `.npc-ability-ref-full` (the pre-wrap block — same reason). **Add** new classes for the per-entry list and edit row layout:
  - `.npc-ability-ref-list` — `ul`-style block (use plain divs; no list markers) for the entries; gap `4px`.
  - `.npc-ability-ref-item` — single read-mode row: `display: flex`, `align-items: flex-start`, gap `6px`, font Crimson Text 13, color `var(--pal-text-body)`. Includes a leading `◆` span (reuse `.npc-ability-ref-diamond` styling) and the text. `word-break: break-word` so long single entries wrap.
  - `.npc-ability-ref-row` — single edit-mode row: `display: flex`, gap `6px`, items center. `[−]` button on the left (ghost, destructive on hover), text input filling the remainder. The input uses `.input-base` styling but with `var(--npc-accent)` border on focus.
  - `.npc-ability-ref-remove` — the `[−]` button styling (`color: var(--pal-text-muted)`, `:hover { color: #c06060; }`, 24px min square).
  - `.npc-ability-ref-add-row` — the inline `+ Add ability…` input + `[+]` button row, same layout as the edit row.
  - `.npc-ability-ref-add-btn` — the `[+]` button (ghost, `color: var(--npc-accent)`, `:hover { color: var(--npc-bright); }`, 24px min square).
- Backend: **no changes required**.

**Trimming and validation**:
- On `Done`: filter `draft` to remove entries that are empty or whitespace-only, then trim each surviving entry. Commit the cleaned array. If the cleaned array is empty, the card returns to the empty state on next render.
- The inline `+ Add ability…` button is a no-op when the input is empty or whitespace. Disable visually (`opacity: 0.5`, `cursor: not-allowed`) in that state.
- `maxLength={255}` on every text input — the add field, and any future per-entry edit input. The counter affordance from the original brief (appears within 30 chars of 255) applies to whichever input is currently focused.

**Auto-expand interaction with edit mode**: The existing effect (lines 289–295) is correct in shape but should be revised:
```
useEffect(() => {
  if (editing) return; // never touch state mid-edit
  if (isActiveTurn && abilities.length > 0) setExpanded(true);
  else setExpanded(false);
}, [isActiveTurn, abilities.length, editing]);
```
Guard against `editing` first; only then drive `expanded` from `isActiveTurn`.

**Optimistic write pattern**: Use the existing `commitNpcList` path from `NpcCombatSection`. The `onSave` callback at the `NpcCard` call site (lines 738–743 today) becomes:
```
onSave={async (nextAbilities) => {
  const updatedNpcs = (allNpcsRef.current || []).map((entry) =>
    entry.id === npc.id ? { ...entry, abilities: nextAbilities } : entry
  );
  return onCommitNpcs(updatedNpcs);
}}
```
Identical to today, just `nextAbilities` is `string[]` not `string`. The optimistic merge in `DmDashboardPage.commitNpcCombatUpdate` (lines 220–243) already handles full-array round-tripping correctly.

**Scope risks the feature-builder must watch**:
1. **Backward-compatible read** — without the `Array.isArray(npc.abilities) ? npc.abilities : ...` coercion described above, any NPC saved before this rebuild will crash the component on `.map`. Add the coercion at the top of `NpcAbilityRef` (or at the call site) before passing in.
2. **Removing the last entry mid-edit** — `draft.length === 0` is a valid intermediate state in edit mode. The `[Done]` button still commits (writing `[]`), which round-trips the card back to the empty state. Don't disable `[Done]` on `draft.length === 0`; the DM might intentionally clear the field.
3. **`Show all N` count must reflect the saved array, not draft** — in read mode the toggle says `Show all 6` based on `abilities.length`. In edit mode the toggle is not shown.
4. **Active-turn re-expand after exit-edit** — when the DM saves and `editing` flips back to `false`, the effect runs again; if it's still this NPC's turn the card re-expands. That's correct, but ensure the effect's dependency list includes `editing` (see snippet above) so it actually fires on edit exit.
5. **Concurrent write clobbering** — same risk as conditions/HP; not new to this story. `allNpcsRef.current` is the latest snapshot; build the updated array from it (not from a stale closure).
6. **Stripping the now-unused `.npc-ability-ref-preview` and `.npc-ability-ref-full` rules** — do this in the same CSS change. Leaving dead classes around is exactly the rot ADR-001 is meant to prevent.
7. **Empty-state hit area** — the empty-state `+ Ability reference` button keeps the existing `min-height: 32px` and tap target. Don't shrink it just because the new edit mode no longer auto-opens a textarea.

**Performance / cost**: No new infrastructure. Existing `putNpcCombat` Lambda handles the write; payload size grows linearly with array length, with a practical ceiling around `255 × 20 entries ≈ 5KB per NPC` — trivial against DynamoDB's 400KB item limit and far below the API Gateway 10MB request cap. Polling cadence is unchanged. No new event handlers or animations beyond the existing `.dm-condition-enter`/`exit` vocabulary, which can be reused for entry add/remove if desired (not required for v1).

**No new ADR needed** — this story uses existing patterns end-to-end. The `string[]` shape is a data model refinement within the schemaless DynamoDB pattern of ADR-003; it doesn't change the architecture.
