# Feature Story: Session Inventory Editing

**Status**: Ready for implementation
**Source**: User request
**Prototype**: `design/prototypes/session-inventory-editing.html`

## Goal

Right now, adding a new weapon or item to a character's inventory only happens in the classic character sheet's edit mode (the `+ Add Weapon` / `+ Add Item` buttons live in the Weapons/Equipment sections of edit mode, opening `ItemEditorModal`). But loot pickup, buying gear from a merchant, and other inventory changes almost always happen *during* a live session, while the player and DM are already in Session mode looking at the Loadout sub-tab — not while someone is back in the classic sheet's edit mode. Forcing a player to leave the live-play view, unlock/enter edit mode on a completely different page, add the item, save, and navigate back is friction at exactly the moment a player is least likely to want it (mid-scene, DM waiting, party moving on). This story brings the same add-weapon/add-item capability directly into Session mode's own Loadout sub-tab, where the inventory is already being looked at in the moment it matters. It also brings Gold Pieces and XP — both of which change constantly during play from loot, purchases, and encounter rewards — into that same tab, since currently the only editable/visible presentation of GP and XP that a player would routinely see mid-session is in the classic sheet's Combat tab (XP/Coin live management) or edit mode, not in Session mode's Loadout sub-tab.

## User stories

- As a player, I want to add a new weapon or item to my inventory directly from Session mode's Loadout tab, so I can log loot the moment I pick it up without leaving the live-play view.
- As a player, I want to see and adjust my Gold Pieces total from Session mode's Loadout tab, so I can track spending and income as it happens at the table.
- As a player, I want to see and adjust my XP from Session mode's Loadout tab (if my character is XP-tracked), so I don't have to switch to a different mode/page just to log XP the DM awards mid-session.
- As a DM, I want players to be able to self-serve simple inventory additions during play, so I'm not the bottleneck for every "can you add this potion to my sheet" request.

## Functional requirements

- Session mode's Loadout sub-tab gains the same "add a weapon" and "add an item" entry points that exist today in the classic sheet's edit mode — i.e., a player can create a new weapon or equipment entry (name, description, modifiers, type, attunement, quantity — whatever the existing item editor already captures) without leaving Session mode.
- These new entry points write to the same underlying `weapons[]` / `equipment[]` data the classic sheet already reads and writes, so an item added from Session mode shows up identically in the classic sheet's Inventory tab, and vice versa.
- Adding an item from Session mode does not require the character-owner password unlock that the classic sheet's edit mode requires today — it should work the same no-auth-required way the rest of Session mode's live writes already work (equip toggle, attunement toggle, qty stepper, potion use, drop item), since Session mode is designed for frictionless in-the-moment updates.
- Session mode's Loadout sub-tab also displays Gold Pieces (and, if the character uses full denomination tracking, the other coin denominations) and allows adjusting them live, the same way the classic sheet's Combat tab currently allows.
- Session mode's Loadout sub-tab also displays XP (for XP-tracked characters) and allows adjusting it live, matching the classic sheet's existing XP live-management behavior.
- Editing an existing item (not just adding new ones) is not required by this story — the ask is specifically about the "Add Weapon" / "Add Item" creation entry points, GP, and XP. Whether existing per-item editing (renaming, changing mods, etc.) also needs to move or duplicate into Session mode is not part of this story.

## Data model changes

None. This story reuses the existing `weapons[]`, `equipment[]`, `coin`/`coinMode`, and `xpCurrent`/`levelingMode` fields exactly as they are already shaped and written today (see `CLAUDE.md` character data shape and `design/app-overview.md`'s data structures section). No new fields, no new item shape, no new session-state fields.

## Out of scope

- Any new item types, modifier types, or attunement/quantity rules beyond what the existing item editor already supports.
- Editing (as opposed to adding) existing weapons/equipment from Session mode.
- Removing or changing the classic sheet's own edit-mode Weapons/Equipment sections — see the open question below.
- Any change to how GP/XP are calculated, awarded, or thresholds for leveling — this is purely about where they're visible/editable, not the underlying progression logic.

## Open questions

- **Does this replace or add to the classic sheet's existing inventory editing?** The user's own framing was that once this exists in Session mode, the classic view's editing "doesn't matter much" — but they did not say to remove it. This story should be read as strictly additive (a second entry point) unless and until an explicit decision is made to remove the classic sheet's `+ Add Weapon` / `+ Add Item` edit-mode controls. That removal, if wanted, should be scoped as part of (or alongside) Story 59, which is already looking at simplifying the classic Profile view's tabs — not assumed here.
- Should adding an item from Session mode support the same full item editor (attunement, qty tracking, description, mods) in one step, or a simplified quick-add (name only, with details filled in later via the classic sheet)? The user's request implies parity with the existing "Add Weapon"/"Add Item" experience, but the full `ItemEditorModal` was designed for a between-session editing context — whether all of its fields make sense to expose in the middle of live play is a design question for `design-strategist`.
- If GP/XP become editable in two places (Session mode's Loadout tab and the classic sheet's Combat tab), do we need any UI treatment to avoid a player or DM being confused about which one is "the real one" — or is this a non-issue since both write to the same underlying fields and both are already live-synced?

---

## UX Design

**Brief**: `design/briefs/session-inventory-editing-brief.md` — the authoritative spec.

**Prototype**: `design/prototypes/session-inventory-editing.html` — one column (Equipment), the
compose row with repeat-capture and comma-bulk stagger, and the coin delta pad with simulated
remote drift.

**Tier**: 2 for the coin/XP ledger band (ambient, always readable, never competing with HP or
conditions); 3 for item creation (on-demand, zero resting footprint beyond one affordance row
per column).

**OQ-1 resolved — strictly additive, and they are not duplicates.** Keep the classic edit-mode
`+ Add Weapon` / `+ Add Item`. The two entry points serve different acts on the same array:
Session mode is **capture** (no auth, name-first, repeatable, seconds), classic edit mode is
**authoring** (password-gated, full fidelity, between sessions). Removing the classic controls
remains a Story 59 call and is not assumed here.

**OQ-2 resolved — inline compose row by default, `ItemEditorModal` on demand.** A full modal for
"+1 torch" is a wall of checkboxes over the map on a phone and imports the editing mental model
Session mode has otherwise avoided; a name-only quick-add with no escape hatch strands anyone who
does know the item's stats. Ship both: a 44px `+ WEAPON` / `+ ITEM` row at the foot of each column
expands **in place** into a compose row (name input + qty chip on equipment + `ADD` + `⋯`), and
`⋯` opens the existing `ItemEditorModal` pre-seeded with whatever's typed. **Zero new editor
built.**

Three ergonomics carry the design: **the column chooses the array** (no type picker — tapping
`+ WEAPON` vs `+ ITEM` is the decision); **the input clears and keeps focus on commit** (a hoard is
four items, not one — this non-animation is the most important interaction in the brief); and
**comma-bulk entry reusing Story 56's exact `.cs-spell-row-enter` keyframe and stagger constants**
(`Rope, Torch, Rations` + Enter → three rows). A trailing ` xN` on an equipment name parses into
`qty` (`Arrows x20`).

**The session-mode `ItemEditorModal` hides the Modifiers section (`showMods={false}`).** ADR-005
draws the auth line at *state* vs *definition* — qty/attunement/equipped are state, but a `+5 Armor`
mod recomputes every derived stat on the sheet and is definition. An unauthenticated surface should
not mint arbitrary mods. Flagged as reversible in one prop if the table disagrees (brief OQ-2).

**Coin is a delta pad, not a stepper.** Coin changes are deltas ("spent 45", "found 137"), so
hold-to-repeat ±1 is punishment. Tapping the GP total opens an **inline** pad —
`[− SPEND][+ GAIN][= SET]`, numeric input, accumulating quick-chips `1 · 5 · 10 · 25 · 50 · 100`,
explicit `APPLY`. It borrows the DM `DamageHealModal`'s vocabulary (big number, preset jumps,
direct entry, confirm) but stays in place, because every other Session-mode write does. In `full`
coin mode the four minor denominations form a **fixed 4-slot rail with zeros dimmed but present** —
positional stability beats sparseness here, or the row reflows on every transaction.

**XP is deliberately lighter than coin** — the DM awards it party-wide from the dashboard, so the
player side is correction/logging. Slim bar + `+ XP` into the same pad. **Crossing the next
threshold never auto-levels** (level is a definition field): the bar fills, a one-shot gold pulse
fires in the counter-wheel completion gradient, and the numerals read `LEVEL N READY`.

**Order in the tab: list → coin → XP**, deliberately diverging from the classic Inventory tab's
grid → XP → coin. Coin changes ten times more often mid-session and is conceptually part of
inventory; XP is progression, not loadout.

**The reduction that pays for this**: the `+` row *is* the empty state (no "No weapons" line above
a button), the compose row *replaces* the `+` row rather than stacking below it, and the ledger band
renders only what exists (milestone character → no XP strip at all; `gp` mode → one 36px row).

**OQ-3 resolved — two editable surfaces is a non-issue, provided one rule holds: rebase at commit,
never at open.** Adds append to the *latest polled* array at the moment `ADD` fires; coin/XP apply
the signed delta to the *freshest polled base*. If the DM changes coin while the pad is open, the
delta is preserved, the base is rebased, and an inline note says so (`+50 gp from the DM — applied
to new total`) — never a silent clobber, never overwriting what the player typed. All four writes
are optimistic via `patchSession(slug, fields, null)`; on failure the row collapses out and the
typed text is restored to the compose input. **No new fields, no new endpoint, no added polling.**

**Cross-references**: reuses Story 56's `.cs-spell-row-enter` stagger and `uid()` verbatim; extends
Story 51's "no re-sort under poll" rule to cover *insertion* (a player-added row appends to the end
of its sort group with the standard 500ms value-flash and does not re-sort an open DM drawer);
reserves no long-press, since Story 57 owns that gesture on the adjacent Map sub-tab.

**Prototype: recommended, scoped tight.** The load-bearing decisions are felt, not read — the
repeat-capture rhythm after the third item, the comma-bulk stagger at 4+ rows, and the pad's
chip-accumulation with a simulated remote-drift button. One column only. Not the full grid, not the
XP bar, not `ItemEditorModal`.

**Open questions carried forward** (brief §12): (1) **resolved** — XP/coin confirmed to live in the
classic **Inventory** tab (checked directly against source; `app-overview.md`'s stale Combat-tab
reference has been corrected); neither is an extractable component today, so the brief's planned new
`SessionLedger.jsx` is the right path; (2) `showMods={false}`; (3) trailing `xN` parsing on by
default; (4) pad chip denominations; (5) whether the classic **view-mode** Inventory tab should get
the same no-auth quick-add — recommended deferral to Story 59; (6) whether the DM wants any "added
this session" marker.
