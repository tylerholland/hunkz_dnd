# Feature Story: Large Enemy Token Size Options

**Status**: Done — steps 0.5/1/2/3/4/6× with 5e labels; size row in token hover card + NPC ⋯ menu (backend cap raised to 6.0)
**Source**: User request
**Prototype**: (leave blank — ux-designer fills this in, if needed; see note below)

## Goal

Story 44 already added per-token resize for NPC tokens on the DM's battle map (a stepper on the token card cycling through preset size multipliers). The DM wants a genuinely large option added to that same stepper — something in the 4x-6x range of a standard character token — for big enemies (e.g., a dragon or giant) where the current maximum reads as barely bigger than a normal combatant.

## Root cause / current state (confirmed in source)

`src/features/dmDashboard/battleMode/BattleModeController.jsx:26` defines the available sizes as `SIZE_STEPS = [0.5, 1.0, 1.5, 2.0, 3.0]`, with matching `SIZE_LABELS` for the stepper's readout (e.g., "MEDIUM"). 3.0x is the current ceiling — there's no size option anywhere near the 4x-6x range requested.

## Functional requirements

- Extend `SIZE_STEPS` (and `SIZE_LABELS`) with one or more larger presets in the requested ~4x-6x range, reachable from the same per-token resize stepper already used for NPC tokens (Story 44's UI — no new interaction pattern needed).
- Confirm the existing resize stepper UI (dot/notch row, `⤢ Resize` control) scales sensibly with more steps added — it currently renders one notch per entry in `SIZE_STEPS`.
- Confirm a token at the new larger sizes still behaves correctly for existing per-token mechanics that key off scale/position (drag, rotation, targeting reticle, damage flash, condition indicator, invisibility veil) — these all currently assume the 0.5x-3.0x range but should be scale-agnostic in principle.

## Data model changes

None expected. Token size is already stored as a numeric `scale` on the token record (`token.scale`, Story 44) — this only changes which discrete values `SIZE_STEPS` offers, not how scale is persisted or applied.

## Out of scope

- Changing player-facing token rendering/interaction (this is the DM's own per-token resize control, NPC tokens only, same as Story 44).
- Free-form/continuous token scaling — this stays a preset stepper, consistent with the existing pattern.

## Open questions

- Exact new preset value(s) and labels: is a single new "huge" preset (e.g., 5.0x) enough, or does the DM want a couple of new steps (e.g., 4.0x and 6.0x, maybe labeled "Large"/"Huge" or similar D&D size-category terms)? Given this reuses an existing, already-designed interaction, a UX design pass is likely unnecessary unless the answer here changes the interaction itself (e.g., wanting a different control for very large tokens rather than more notches on the same stepper).
