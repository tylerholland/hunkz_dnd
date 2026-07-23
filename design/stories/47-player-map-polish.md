# Feature Story: Player Map View Polish — Centred View + NPC Token Names

**Status**: Implemented (`eb23684`) — Stories 47a + 47b
**Source**: DM/Player feedback from live session

---

## Goal

Two small but noticeable rough edges in the player map experience:

1. **Player view opens at the wrong position.** When a player opens the Map tab, the pan/zoom starts at the top-left corner of the image, even if the DM has panned to the centre of the map. The player should open centred on whatever part of the map the DM is currently looking at.

2. **NPC tokens show "Unknown" instead of the NPC's name and avatar.** On the player's map view, NPC tokens render without a name or portrait. There is no DM-facing toggle to control this visibility, so NPC names and avatars should be visible to players by default.

---

## User stories

1. As a player, when the DM activates the Map tab and I open it, I want the map to open already centred on the area the DM is focused on, so I don't have to hunt around a large map to find where the action is.

2. As a player, when I look at the battle map, I want to see NPC token names and portraits so I can identify who I'm fighting without having to ask the DM.

---

## Scope

### Story 47a — Sync player view to DM centre

The DM's `MapViewer` pan/zoom state is local client state and not currently broadcast. The simplest approach: extend the existing `activeMapView` field (already on the `map-library` sentinel, used by `MapLibraryStrip`) to carry the DM's current viewport centre fraction `{ cx, cy }` (values 0–1 in natural image space). The DM's `MapPanel` writes this periodically (debounced, not on every pan frame). When the player's `PlayerMapViewer` loads or the active map changes, it reads `activeMapView.cx / activeMapView.cy` and initialises the `MapViewer` pan so that point is centred in the player's viewport.

- DM side: debounced write (e.g. 800ms) from `MapPanel` on pan/zoom settle, using the existing `patchMapCalibration`-style pattern or a new `putMapView` endpoint. Consider whether to reuse the existing `activeMapView` shape or extend it — `activeMapView` already carries `{ mapId, scale, panX, panY }` so extending with `cx/cy` or replacing panX/panY is the cleanest path.
- Player side: `PlayerMapViewer` passes an `initialCenter` prop to `MapViewer`; `MapViewer` applies it only on first render for a given map (so the player can still freely pan afterward).
- Out of scope: live real-time pan mirroring (following the DM as they move). Just initial placement on open/map-switch.

### Story 47b — Show NPC names and avatars on player token chips

`TokenChip` in `BattleModeController.jsx` already renders NPC portraits and names on the DM side. On the player side (`PlayerMapViewer`), the same `TokenChip` is used but `npcCombat` data is not currently passed down to the player's session mode, so NPC tokens fall back to showing "Unknown."

- Pass `npcCombat` (already available on `CharacterSheetSessionMode` from the session state poll) through `PlayerMapViewer` into the `TokenChip` rendering so NPC tokens display name and portrait.
- No new backend work — `npcCombat` is already in the public session-state response.
- Future: if the DM ever wants to hide NPC identities (e.g. unknown monster reveal mechanic), add a per-NPC or per-session `hidden` flag. For now, show everything.
