# Bug: Initiative Round Counter Doesn't Increment on Next-Turn Wrap

**Status**: Ready for implementation (bug fix — no design needed)
**Source**: User bug report

## Symptom

Clicking "Next Turn" through a full cycle of the initiative order advances turns correctly, but the round counter never ticks up when it wraps back to the first combatant. Not blocking, but reported as clearly wrong.

## Root cause (confirmed in source)

`InitiativeTracker.jsx`'s `handleNextTurn` (`src/features/dmDashboard/InitiativeTracker.jsx:63-72`) correctly detects the wrap and computes `nextRound = currentRound + 1`, passing `{ entries, activeTurnIndex: next, round: nextRound }` to `onCommitInitiative`.

That handler is `commitInitiativeUpdate` in `src/pages/DmDashboardPage.jsx:415-452`. Its `normalized` object (lines 418-421) only copies `entries` and `activeTurnIndex` from whatever was passed in — `round` is silently dropped before it's ever set into state or sent to `putInitiative`. So the incremented round computed by the caller never reaches the server or the optimistic UI update; `initiative.round` just stays whatever it already was.

## Fix

Include `round` in the `normalized` object in `commitInitiativeUpdate` (falling back to the current `initiative.round ?? 1` when the caller doesn't pass one, matching how `activeTurnIndex` already defaults). Check the other call sites of `commitInitiativeUpdate`/`putInitiative` in `DmDashboardPage.jsx` (e.g. `handlePromoteToNpc` at line ~487, which also omits `round`) for the same omission, so adding/removing initiative entries doesn't reset or drop the round counter either.

## Regression coverage

Add a test (alongside the existing `InitiativeTracker.test.jsx`) asserting that advancing turns through a full wrap results in a committed payload with `round` incremented, and that non-wrapping "Next Turn" calls preserve the existing round.
