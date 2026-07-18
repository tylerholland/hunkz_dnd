# Feature Story: 42 — Profile View Slim-Down

**Status**: Approved — Ready to Build
**Source**: DM request 2026-07-18

---

## Goal

Now that Session mode owns live play, the character sheet's profile surface (`/characters/:slug`, which `❡ Profile` redirects to) sheds its in-session machinery. Keep: header/identity, portrait, **ability scores** block, **Persona** tab, **Inventory** tab, collections/backstory. Remove: the **Combat** tab and the **Map** tab.

## Why

Two surfaces both offering combat tooling splits muscle memory and doubles maintenance. Session mode is strictly better for live play (party strip, initiative, HP hero card, dice with broadcast); the profile should be the between-sessions surface — who the character is, what they carry, how they've grown.

## UX Design

- **Tab strip** becomes two tabs: `Inventory | Persona` (same icon+label style). Default tab: `"loadout"` (Inventory). Stored `dnd_tab_${slug}` values of `"combat"`/`"map"` fall back to the default gracefully — no errors, just land on Inventory.
- **Ability scores block, HP/Hit Dice/Armor row, skills/spells/abilities badge rows, XP/coin panels, collections viewer**: unchanged. (HP shown here is reference, not a live tracker — live HP editing stays in Session mode.)
- **Combat-tab-only features that must not be lost** — they already exist in Session mode: conditions, concentration, spell slots, inspiration, session notes, dice roller. Verify each has a session-mode equivalent before deleting; anything missing gets flagged in the implementation report, not silently dropped.
- **⚔ Session** button in the top bar becomes the primary way into live play (already present).
- Attunement/equip/qty/potion-use interactions on the Inventory tab: keep — they're inventory management, not combat.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- All changes in `src/features/characterSheet/CharacterSheetViewMode.jsx` (~1,900 lines): remove the Combat and Map tab panels, the tab-strip entries, and the now-unused imports (`DiceRoller`, map viewer wiring, condition grid, spell-slot section, concentration banner, session-notes section — verify with `git grep` which are used elsewhere before deleting; `SessionNotesSection` lives in `CharacterSheetSessionMode.jsx` and is untouched).
- `CharacterPage.jsx` (Story 35b) polls `getSessionState({ slug, password })` — after this story the profile surface no longer needs `mapLibrary` from the payload; leave the polling untouched (one request either way) but drop the `activeMap` prop threading if it becomes fully unused.
- Sanity-check `sessionStorage` default handling for `dnd_tab_${slug}` (`"combat"` is the current default — change default to `"loadout"` and coerce invalid stored values).
- Do NOT touch edit mode, session mode, or the DM dashboard. The DM's "↗ Sheet" link opens this surface — the DM manages combat from the dashboard, so no DM regression.
- This shrinks `CharacterSheetViewMode.jsx` substantially — take the free win but do not restructure beyond the removals (no Story-38-style decomposition here).
- **Tests**: update `CharacterSheetViewMode.test.jsx` for the two-tab strip + stored-value coercion; remove tests for deleted panels; verify no session-mode test regressions.
- **Update** CLAUDE.md (four-tab → two-tab description, `dnd_tab_${slug}` values/default) and `design/app-overview.md` (view-mode tab sections, Map-tab section removal). Story Status → Implemented.

## Acceptance Criteria

1. Profile surface shows only Inventory and Persona tabs; stale stored tab values land on Inventory without errors.
2. Every removed Combat-tab capability is confirmed present in Session mode (list them in the report).
3. Ability scores, badges, XP/coin, collections, attunement/qty interactions unchanged.
4. All tests pass; no new lint problems in touched files; build succeeds.

## Out of Scope

- Story 28-style in-place profile editing; nav changes (Story 37); moving Edit Character into the page body (Story 37's scope).
