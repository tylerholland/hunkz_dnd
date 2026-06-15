# Feature Story: Battle Map Token Polish

**Status**: Needs UX design
**Source**: RPG Consultant
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

Story 29 shipped the core token layer — placement, movement, hover-expand HP cards, and the FALLEN dim state. This follow-up delivers the polish items the Architect Notes explicitly deferred from Story 29: NPC token portrait images (the biggest new capability, feeding directly into the NPC library in Story 31), a per-map token scale calibration slider so the DM can match token size to the map's grid, smooth CSS transitions on player-side token movement so positions feel live rather than jumped, a long-press remove gesture for touch devices, and tray collapse polish. It also closes the `prefers-reduced-motion` audit gap the architect flagged.

The NPC portrait upload is the most consequential item in this story. It establishes the image pipeline and storage contract that Story 31's NPC library will reuse — an NPC portrait uploaded here IS the portrait that appears on battle map tokens every time that NPC is spawned from the library. These two stories must be sequenced: 29b first, 31 second.

## User stories

1. As the DM, I want to upload a portrait image for an NPC so that its battle map token shows a face or artwork instead of a colored-initial circle, making it easier to distinguish three goblins from a named villain at a glance.

2. As the DM, I want to adjust a scale slider on the map panel so that tokens resize to match the grid squares on the current battle map — a dungeon tile map with small squares needs smaller tokens than a wide outdoor map.

3. As a player, I want token positions to animate smoothly into their new locations between my polling updates so that seeing the rogue dash across the room feels live rather than teleporting.

4. As the DM on a tablet, I want to long-press a placed token to get a remove option so I can clear a token without needing to hover or expand it first.

5. As the DM, I want the unplaced token tray to collapse to a slim status strip once all tokens are on the map so the strip stops consuming space at the bottom of the map panel during active play.

6. As a player who prefers reduced motion, I want token animations to respect my operating system preference so I am not distracted or made uncomfortable during a session.

## Functional requirements

### NPC token portrait upload

- Each NPC card in the combat tracker gains the ability to have a portrait image associated with it. The DM uploads an image from the NPC card directly.
- The uploaded image is stored in S3 (same bucket and path convention as character portraits and map images — `hunkz-dnd-portraits`). It is not a character record; it belongs to the NPC's combat tracker entry.
- Once uploaded, the portrait is stored as a URL on the NPC object in the `npc-combat` sentinel (new field: `portraitUrl: string`). The NPC's battle map token renders using this image instead of the colored-initial circle.
- If no portrait is uploaded, the NPC token continues to use the existing colored-initial fallback. This is not a required field.
- The portrait upload uses the existing presign flow (same as character portraits and map uploads): the DM selects a file, the client requests a presigned URL, uploads directly to S3, then stores the resulting public URL on the NPC.
- **Cross-reference Story 31**: the `portraitUrl` field on the NPC combat object is the same field that Story 31's NPC library entries will store. When an NPC is saved to the library, its `portraitUrl` travels with it. When a library entry is spawned into combat, the portrait is already set. One upload, reused forever.

### Token scale calibration

- A scale control on the DM map panel (separate from pan/zoom) lets the DM resize all tokens on the active map from 0.5× to 2.5× of the default token size.
- The scale applies to all tokens on that map uniformly. It is not per-token.
- The scale value is stored as `tokenScale` on the map entry in the `map-library` sentinel. The ADR-017 schema already includes this field with a default of 1.0 — no schema change is needed, only the UI and the write endpoint.
- The write uses a new API endpoint (or extends the existing `PATCH /maps/{mapId}/tokens` endpoint to accept `tokenScale`). See the Architect Notes from Story 29 which already called for `patchMapCalibration`.
- Players see tokens at the scale the DM has set. Scale changes are reflected on the next poll.

### Smooth player-side token movement

- When a token's position changes between polling updates on a player's device, the token transitions smoothly to its new position over approximately 280ms rather than jumping instantly.
- This is a CSS transition on the token's positional properties. It fires only when the position actually changes, not on first mount.
- On first mount (when a token appears mid-combat), no transition fires — the token appears at its position immediately rather than sliding in from 0,0.
- This change is purely visual and applies to the player-facing `MapViewer` context. On the DM side, where the DM is actively placing tokens, the same instant-placement behavior from Story 29 remains (the drop animation is already a deliberate designed motion, not a poll-transition).

### Long-press remove menu on touch

- On touch devices, a long-press (approximately 480ms hold) on a placed token surfaces a contextual remove action.
- This is an alternative access path to the remove action already available in the hover-expand card. It does not replace that action — it adds a parallel touch-native gesture.
- The remove action is DM-only. Players have no token interaction on touch or otherwise.

### Tray collapse polish

- When every token in the tray has been placed on the map, the tray collapses from its full-height strip to a slim status indicator (approximately 28px) showing something like "All placed."
- When any token is removed from the map back to unplaced, the tray expands back to full height.
- This is a visual polish item only — the underlying token data and placement logic are unchanged from Story 29.

### Reduced-motion audit

- All animations introduced in Story 29 and this story — the drop bounce, the hover-expand breathe, the HP card slide-in, the smooth poll transition, the tray collapse — must respect the `prefers-reduced-motion: reduce` media query.
- Under reduced motion: transitions and keyframe animations are either disabled or replaced with instant state changes. No element should appear to move across the screen.
- This is an audit pass, not a new feature: verify each animation point and add the appropriate `@media (prefers-reduced-motion: reduce)` override.

## Data model changes

- `portraitUrl: string` added as an optional field on NPC objects in the `npc-combat` sentinel. Shape: `{ id, name, hpMax, hpCurrent, conditions, initiativeEntryId, notes?, abilities?, portraitUrl? }`. Written via the existing `putNpcCombat` pass-through. No backend schema migration needed — the field is simply absent on older NPC records and treated as "no portrait" by the client.
- `tokenScale` on map entries in `map-library` already exists per ADR-017. No new field needed. The new work is the write endpoint and the UI control to set it.
- No changes to character records, PC session fields, or initiative data.

## Out of scope

- Per-token scale (individual tokens sized differently from each other on the same map).
- NPC portrait editing outside the combat tracker (no standalone portrait library separate from Story 31's NPC library).
- Animated paths between old and new token positions (smooth transition yes, path interpolation no).
- Portrait upload from the NPC library directly (that is Story 31's responsibility; here the upload lives on the combat tracker card).
- Grid snapping, hex grids, distance measurement, fog of war.
- Player-initiated token interaction of any kind.

## Open questions

1. **Where exactly does the portrait upload live on the NPC card UI?** Options include: inside the `⋯` overflow menu, inline on the card header next to the initials circle, or inside the NPC notes/ability edit area. The UX designer should decide based on card density and how it will flow into Story 31.

2. **Should portrait images uploaded via this story be automatically picked up by Story 31's NPC library save flow?** The intent is yes — saving an NPC to the library should carry the `portraitUrl` along with name, hpMax, and abilities. But Story 31 needs to confirm this is the one-way contract (library stores whatever is on the card at save time) rather than some live-link.

3. **Does the calibration slider live in the map panel header or in a gear/settings popover?** The Architect Notes called for a gear popover. The UX designer should decide whether a popover adds enough value over an inline slider to justify the extra tap.

4. **What is the visual treatment for the "All placed" tray collapse?** Does it animate closed, or snap? At what point does it become visible (when the last token is placed, or when the tray has zero items visible)?
