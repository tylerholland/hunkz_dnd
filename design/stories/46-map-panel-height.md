# Feature Story: Map Panel Taller Height Limit

**Status**: Ready for Architect Notes
**Source**: DM feedback

---

## Goal

The map panel currently caps at 720px when dragged to resize. Remove or raise that ceiling so the DM can make the map fill more of the screen on large monitors.

## User stories

1. As a DM with a large monitor, I want to drag the map panel taller than 720px so the map can fill most of my screen during a combat encounter.

## Scope

- Raise the max height cap in `MapPanel.jsx` from 720px to a larger value — either a fixed ceiling (e.g. 1200px) or a viewport-relative ceiling (e.g. `window.innerHeight - 120px` so the top nav and token tray always remain visible).
- Persists to `sessionStorage` as today (`dnd_dm_map_height`).
- No other changes to the resize handle or behaviour.

## Out of scope

- Full-screen / maximise mode.
- Separate height preferences per map or per mode.
