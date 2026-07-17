# Refactor Story: CharacterCard Decomposition

**Status**: Implemented
**Source**: Codebase audit 2026-07-16

---

## Goal

Break `src/features/dmDashboard/CharacterCard.jsx` (~2,040 lines) into focused modules with **zero behavior change**. This is a pure structural refactor.

## Why

CharacterCard is the new monolith: death saves, damage/heal modal, quick-action popover, DM notes strip, and XP/coin widgets all live inline. It sits in the graph's weakest community (cohesion 0.07) and nearly every party-facing story has to wade through it. Smaller modules mean cheaper future stories and safer parallel agent work.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query "CharacterCard"` and `graphify explain "CharacterCard()"` before reading source.
- **Target layout** — new directory `src/features/dmDashboard/characterCard/`:
  - `DeathSavesStrip.jsx` — the 0-HP strip: pips, shortcut row, damage-at-0 prompt, FALLEN/stable states (see Story 19 for the full spec; behavior is the spec).
  - `DamageHealModal.jsx` — the focused damage/heal modal (stepper, presets, direct input).
  - `QuickActionPopover.jsx` — the ⋯ popover (Add Condition, Set Temp HP, Drop Concentration, rest action tokens).
  - `DmNotesStrip.jsx` — collapsible DM notes + shared player notes strip.
  - `XpCoinRow.jsx` — XP progress + coin panels with award/give buttons.
  - `CharacterCard.jsx` stays as the shell (header, HP bar/stepper, conditions, badges) composing the above. Keep it under ~700 lines.
- **Exports**: `AwardXpModal` and `DistributeCoinModal` are imported by `DmDashboardPage.jsx` from `CharacterCard.jsx` — preserve those import paths via re-export from the original module path, or update the importer; either way `git grep` for all importers first and leave no broken path.
- **CSS**: `characterCard.css` may be split alongside or left whole — do not rename existing class names (tests and stories reference them). No visual diffs.
- **Mechanical discipline**: move code verbatim; resist "improving while moving." Props over context for the extracted pieces (the card already passes `pal`, `char`, callbacks). Keep `onRegisterOpen` (DmDiceRoller "Apply to…" hook) working — it threads into DamageHealModal opening.
- **Safety net**: `npm run test:frontend` must pass before and after; `NpcCombatSection.test.jsx` and dashboard tests exercise adjacent surfaces. Add one smoke test per extracted component (renders with minimal props).
- **Update** CLAUDE.md's frontend file map after the split. `design/app-overview.md` describes behavior, not files — should need no change beyond the DM-notes strip sentence that names `CharacterCard.jsx` state ownership.

## Acceptance Criteria

1. No behavior or visual change (manual pass over: HP stepper, damage/heal, death saves full lifecycle, notes, XP award, coin give, ⋯ popover, Apply-to flow).
2. `CharacterCard.jsx` ≤ ~700 lines; extracted modules have no circular imports.
3. All existing tests pass unmodified (except import paths if moved); new smoke tests added.
4. CLAUDE.md file map updated.

## Out of Scope

- Any behavior/UX change; `CharacterSheetViewMode.jsx` (~1,900 lines) decomposition — candidate for a follow-up story after this pattern proves out.
