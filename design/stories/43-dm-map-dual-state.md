# Feature Story: DM Dashboard Map — Dual Mode State + Clear Tokens Button

**Status**: Ready for Architect Notes
**Source**: DM feedback

---

## Goal

Three related issues with the DM dashboard's Adventure | Combat map toggle:

1. **Wrong segment highlighted**: The "Combat" segment is highlighted even when the DM is in Adventure (non-combat) mode. The toggle visual is inverted.

2. **Token clearing on mode switch**: Switching between Adventure and Combat modes currently clears all battle map tokens. The DM should be able to have a different map loaded in each mode — tokens and map selection should be preserved per-mode, not wiped when toggling.

3. **No way to clear tokens manually**: The only way to remove tokens today is to switch modes (which clears them unintentionally). A "Clear Tokens" button should be added to the Battle map mode so the DM can explicitly wipe the token layer when starting a new encounter.

## User stories

1. As a DM, when I open the dashboard in Adventure mode, I want the "Adventure" segment to be visually highlighted so I know which mode I'm in at a glance.

2. As a DM, when I switch between Adventure and Combat modes, I want each mode to remember its own active map and token state so I don't lose my combat setup when I briefly check the overworld map.

3. As a DM, when I'm in Combat mode, I want a "Clear Tokens" button on the battle map panel so I can wipe the token layer at the start of a new fight without having to switch modes.

## Scope

### Bug fix — highlight inversion (Story 43a)
- In `DmDashboardPage.jsx`, `isBattleMode` is derived from `dmActiveMap?.mapMode === "battle"`. Determine whether this value is being set incorrectly on load or whether the NavSegment `value` prop and `options` keys are mismatched. Fix so Adventure mode shows the Adventure segment lit.

### Dual map state (Story 43b)
- The dashboard currently holds one `activeMapId` and one token set (`npcCombat`). Introduce a second map slot — `adventureMapId` and `battleMapId` — stored on the `map-library` sentinel (or as a separate `dnd_dm_map_mode` sessionStorage key per-session as a lightweight first pass).
- When the DM switches modes, persist the outgoing mode's active map and restore the incoming mode's last-used map, rather than clearing.
- Tokens (`npcCombat.npcs`) are combat-specific — do not touch them on mode switch.

### Clear Tokens button (Story 43c)
- Add a "Clear Tokens" button inside the battle map panel (visible in Combat mode only).
- The button should be a two-step confirmation (single tap shows "Confirm clear?" with a Cancel, second tap commits) to prevent accidental wipes.
- On confirm, write an empty `npcs: []` array to the `npc-combat` sentinel via `putNpcCombat`.

## Out of scope
- Multiple saved encounter states per map — just one token layer per mode.
- Adventure map token pinning — Adventure mode has no token layer.
- Backend schema changes beyond what's already there for npc-combat.
