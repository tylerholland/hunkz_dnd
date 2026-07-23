# Feature Story: Map Rotation

**Status**: Implemented (`e651200`)
**Source**: DM feedback

---

## Goal

Allow the DM to rotate the battle map image so that a scanned or downloaded map oriented sideways can be corrected, or so the DM can orient a map to match the physical table layout.

## User stories

1. As a DM, I want to rotate the map 90° clockwise or counter-clockwise so I can fix a sideways image without having to edit it externally.

2. As a DM, I want the rotation to persist so the map stays in the correct orientation after a page refresh.

3. As a player, I want to see the map at the DM-set rotation so my view matches the DM's.

## Scope

- Rotation in 90° increments only (0°, 90°, 180°, 270°). No free-rotation.
- Rotation stored as a `rotation` integer (0 / 90 / 180 / 270) on the map entry in the `map-library` sentinel.
- Controls live in the map panel header (alongside the existing calibration popover), visible in both Adventure and Battle mode.
- Token positions (`x`, `y`) are always stored in the **pre-rotation image coordinate space** — the token layer rotates with the map so no token position migration is needed.
- Players see the rotated map and correctly-placed tokens via `PlayerMapViewer`.

## Out of scope

- Free-rotation / arbitrary degree input.
- Per-session rotation (rotation is permanent until changed by the DM).
- Rotating the map via gesture (pinch-rotate).

---

## Architect Notes

**Applies**: ADR-003 (additive sentinel field), ADR-004 (one Lambda per op), ADR-011 (polling data flow), ADR-018 (`patchMapCalibration` clone precedent), ADR-019 (WS nudge on write). Story 29b's calibration path is the template for nearly all of this.

**Tech approach**: Store `rotation` (0/90/180/270) as an additive field on each map entry in the `map-library` sentinel. On the backend, clone `patchMapCalibration.js` verbatim into a new `patchMapRotation.js` (`PATCH /maps/{mapId}/rotation`, DM auth, read-modify-write, preserves `activeMapView`, calls `notifySessionChanged()` at the end). Do NOT extend `patchMap.js` — it is name-only, and each per-map mutation already has its own focused handler (calibration, tokens, active, position); a dedicated handler keeps that landscape consistent and validation honest (whitelist to the four legal values, reject anything else with `badRequest`). Add the default in `normalizeMapLibraryRecord` (`backend/src/lib/specialRecords.js:143-149`), mirroring the `tokenScale` line at 148: `rotation: [0,90,180,270].includes(map?.rotation) ? map.rotation : 0` — per ADR-017's rule, widening the sentinel shape means the normalizer must pass the new field through in the same change or it is silently dropped. On the frontend, add `rotation` as a prop to `MapViewer` and fold it into the existing transform string at `MapViewer.jsx:298` and `:315`: `translate(...) scale(...) rotate(${rotation}deg)`. The token layer (`MapViewer.jsx:331-352`) is nested *inside* that transformed div, so it inherits the rotation automatically with zero extra handling — this is why token `x`/`y` stay in pre-rotation coordinate space (matches the Scope note). Add `api.js` `putMapRotation(mapId, rotation, dmPassword)` next to `putMapCalibration`.

**Scope boundary**:
- IN: `rotation` field + normalizer default; `patchMapRotation.js` handler + route in `template.yaml` (copy calibration's IAM/WS grants); `api.js` helper; `rotate()` in the two `MapViewer` transform strings + `rotation` prop; ↺/↻ buttons in `MapPanel.jsx` header next to the ⚙ calibration button (`:387`), with optimistic local state; `rotation` passed to `MapViewer` from both `MapPanel` and `PlayerMapViewer` (`CharacterSheetSessionMode.jsx:1367`).
- OUT: any free-rotation input; token coordinate migration (none needed); rotation on the DM published-view (`activeMapView`) — rotation is a per-map property, not per-view; touching `patchMap.js`.

**Performance notes**: None. `rotate()` is a compositor-only CSS transform on the same element that already animates translate/scale — no layout, no repaint of the token layer. `getSessionState` already returns the full map object; adding one integer field is free.

**Cost notes**: No new AWS resources. One additional route on the existing `CharactersApi` HTTP API and one small Lambda (ADR-004); writes are DM-triggered and rare. `notifySessionChanged` reuses the Story 36 WS channel. Effectively zero at current scale.

**Dependencies**: None. `rotation` rides the existing `map-library` → `getSessionState.mapLibrary` → `activeMap` data flow to both `MapPanel` and `PlayerMapViewer`; no new endpoint and no player-side fetch change (Scope point 5 confirmed — `activeMap` is passed whole to `PlayerMapViewer` at `CharacterSheetSessionMode.jsx:1166`).

**Risks / decisions needed**:
- *Container dimensions at 90°/270°.* The viewer container is a fixed-`height` box with `overflow: hidden`; the image is `transformOrigin: "0 0"` and absolutely positioned. Rotating 90°/270° about the top-left corner moves the image out of the visible box (a 1920×1080 map rotated 90° occupies a 1080-wide × 1920-tall footprint originating off-frame). The pan translate is in screen space and does not auto-recenter. Decide the reset contract: **on rotation change, reset translate/scale** (call the same `setTranslate({0,0})/setScale(1)` reset used on `imageUrl` change, `MapViewer.jsx:92-104`) so the map re-anchors predictably, and use `transformOrigin: "center"` (or a 90°-aware translate offset) so the rotated image lands inside the box rather than off-screen. Simplest robust option: switch the origin to center and reset view on rotation. This is the one real implementation subtlety — flag it for the builder to verify visually at all four angles, both DM and player side.
- Confirm the ↺/↻ buttons compute `(rotation + 90) % 360` / `(rotation + 270) % 360` and that the optimistic local value (like `localTokenScale`/`localMapMode` in `MapPanel`) holds until the next poll echoes it.
- No user decision required before build; the container-origin/reset behavior is an implementation choice the builder can make within these notes.
