# Feature Story: Players Move Their Own Token

**Status**: Approved — Ready to Build
**Source**: DM priority list 2026-07-16 (must-have)

---

## Goal

A player viewing the battle map (session-mode Map sub-tab, or the character sheet Map tab) can drag **their own PC token** to a new position. Everyone else sees the move on their next poll. Players cannot move NPC tokens or other players' tokens.

## Why

The token layer is currently DM-writes/players-watch. Letting a player move their own token turns the map from a broadcast into a shared table — the single biggest "we're playing together" signal for remote sessions.

## UX Design

- **Affordance**: the player's own token (token.type === "character" && token.sourceId === their slug) gets a subtle idle affordance — slightly brighter ring using `--pal-accent-bright` and `cursor: grab` — on maps where `mapMode === "battle"`. Other tokens are unchanged and non-interactive for players.
- **Drag**: Pointer Events (pointerdown → setPointerCapture → pointermove → pointerup), matching the DM-side placement machinery's conventions. While dragging: token scales to 1.08, drops a soft shadow, `cursor: grabbing`. The token follows the pointer in image-natural coordinates (same normalized 0–1 space as stored x/y).
- **Drop**: on pointerup, position clamps to [0,1]; token settles with the existing poll-move ease animation. Optimistic: token stays where dropped; on API failure, it animates back to the last server position and a quiet toast/inline note "Couldn't move token" appears for 3s.
- **No drag** when: no active map, map is not in battle mode, the player's token isn't placed on the map, or the viewer is panning/zooming (a drag that starts on the player's own token moves the token; drags starting anywhere else pan the map — this is the existing `onTokenLayerClick` vs pan disambiguation extended to drag).
- **Touch**: same pointer-events path; token drag takes precedence over single-finger pan when the touch starts on the own-token hit area (44px minimum).
- **Reconciliation**: while a drag is in progress, incoming poll positions for that token are ignored; after drop + successful write, polls resume as source of truth.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- **Backend — new handler** `backend/src/handlers/moveMapToken.js`: `PATCH /maps/{mapId}/tokens/{tokenId}/position`, **no auth** (ADR-005 trust model, same as `patchSession`). Body: `{ x, y, slug }`. Validation: x/y numbers clamped to [0,1]; map exists; token exists; `token.type === "character"`; `token.sourceId === body.slug` (reject otherwise with 403). Read-modify-write on the `map-library` sentinel updating only that token's x/y — mirror `patchMapCalibration.js`'s read-modify-write pattern and preserve `activeMapView`/other fields on write. Add to `backend/template.yaml` following the existing map-route pattern.
- **Do NOT** loosen `patchMapTokens` (full-array replace stays DM-only). The player path is single-token, position-only, by design.
- **Frontend — API**: add `moveMapToken(mapId, tokenId, x, y, slug)` to `src/api.js` (no password header).
- **Frontend — components**: the player-side render path is `CharacterSheetSessionMode.jsx` → `PlayerMapViewer` → `MapViewer` + `TokenChip` (`battleMode/BattleModeController.jsx`). Add an `ownSlug` prop threaded to `TokenChip`; when a chip is own-token and draggable, attach the pointer handlers there. `MapViewer` already supports `interactionMode` and `onTokenLayerClick` — extend minimally rather than forking the viewer. The character-sheet Map tab (view mode) uses the same wrapper; both surfaces get the feature via the shared component.
- **Drag-vs-pan**: suppress MapViewer pan while a token drag is active (a `draggingRef` or callback prop from the token layer is fine; do not introduce global state).
- **Poll suppression during drag**: PlayerMapViewer already animates poll moves; gate application of polled position for the own token behind `!isDragging`.
- **Tests**: unit-test the handler validation (wrong slug → 403, NPC token → 403, x/y clamped) following existing backend handler test patterns if present; frontend test that own token renders draggable and others don't (see `MapViewer.test.jsx` for harness patterns).
- **Update** `design/app-overview.md` (Map tab + session mode sections) and CLAUDE.md's API list after implementation.

## Acceptance Criteria

1. Player in session mode with an active battle-mode map can drag only their own token; move persists and appears on DM dashboard within one poll cycle.
2. A crafted request moving another character's token (mismatched slug) or an NPC token is rejected server-side.
3. Failed write reverts the token with animation; UI never blocks.
4. DM token interactions (place, move, long-press remove) are unchanged.
5. `npm run test:frontend` passes; new handler validated.

## Out of Scope

- Movement range/grid snapping, movement history, turn-gated movement.
- Players placing or removing tokens (DM-only).
