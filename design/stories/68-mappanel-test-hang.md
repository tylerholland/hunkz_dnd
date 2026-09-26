# Bug: MapPanel Test Hangs the Vitest Run

**Status**: Ready for implementation (bug fix — no design needed)
**Source**: Found while verifying Stories 50/51/64 (2026-09-25)

## Symptom

`src/features/dmDashboard/MapPanel.test.jsx` never finishes. The run sits at `MapPanel.test.jsx 0/1` while one fork worker burns 100% CPU, so `npm run test:frontend` and `npm test` hang indefinitely. That's been observed at 15+ minutes. Every other frontend test passes (70/70).

The test is currently `it.skip`'d so the suite completes.

## Likely cause (unconfirmed)

This is probably an infinite render or effect loop in `MapPanel.jsx` under the test's props: an active map with `activeMapView: null`, and mocked `MapViewer`, `MapLibraryModal` and `api`. A spinning CPU with no timeout points at synchronous re-rendering, not a pending promise.

`MapPanel.jsx` was last changed in `0ff12ac` (the Story 55 attack-tracer fix, which touched the WS-nudge / poll path around line 417). That's the first place to look. It's worth checking whether the hang also happens in the real app with no active map view. If so, this is a user-facing CPU bug, not just a test issue.

## Fix

1. Reproduce with `npx vitest run src/features/dmDashboard/MapPanel.test.jsx` after un-skipping. Add a `testTimeout` for the diagnosis run so it fails fast.
2. Find the effect or state update that re-triggers itself, and fix it in `MapPanel.jsx`. Fix the test only if the loop comes from its mocks.
3. Un-skip the test and confirm the full suite finishes.
