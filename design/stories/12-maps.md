# Feature Story: Maps

**Status**: Needs UX design  
**Source**: RPG Consultant  
**Prototype**: (leave blank)

---

## Consultant analysis

### How are maps actually used at a D&D table?

There are two completely different use cases that get conflated under "maps":

**Battle maps (tactical)**: A zoomed-in grid of a specific room, dungeon section, or outdoor encounter. Used during active combat to determine positions, movement, line of sight, and spell areas of effect. These change frequently — each new encounter gets a new map. In live play, the DM is the one who controls what the players can see (fog of war, revealed rooms). On tools like Roll20 and Foundry, battle maps are the primary feature and consume enormous complexity: dynamic lighting, fog of war, token movement, grid snapping.

**Region and dungeon maps (exploration)**: A broader view of an area — a city, a dungeon level, an overworld. Used for navigation, planning, and player orientation. These are often pre-drawn art assets (official or third-party) that the DM shares selectively as the party explores.

The critical insight: **fog of war and token movement are the features that make digital battle maps valuable — but they are also the hardest features to build.** Without them, a tactical grid on screen is just an image the DM could share via Discord in 10 seconds. For a small group using this app primarily as a character sheet and session tracker, investing in full tactical VTT features is out of scope and out of proportion to the problem.

### What does the minimal viable maps feature actually do?

The real gap this feature should fill is: **the DM needs a place to load a visual reference that everyone at the table (or in the digital session) can look at together.** This is about shared orientation, not tactical precision.

The most valuable MVP is: the DM can load an image (battle map, region map, dungeon floor plan) and share a view of it with the players. Players see what the DM currently has loaded. The DM can switch maps as the session progresses. No fog of war, no tokens, no grid overlay — those are features for a dedicated VTT.

### Should players see the same map as the DM, a limited version, or nothing?

For this group's use case, the right model is: **players see exactly what the DM has loaded, in full.** Here is the reasoning:

- Fog of war requires either the DM to dynamically reveal sections (complex interaction) or a pre-masked image (DM prep burden). Neither is practical in MVP.
- For a small group playing in person or on a call, the DM already controls what the players see by narration and social contract — "you see the antechamber but the door to the north is closed" doesn't require digital fog.
- If the DM wants to hide something, they simply don't load that map yet.
- The DM is the only one who can change or clear the active map. Players can view but not control it.

This is a deliberate scope constraint, not a limitation. It matches how many small groups actually use digital maps: the DM screenshares or loads an image, everyone looks at the same thing.

### How does a maps feature interact with the NPC combat tracker and initiative tracker?

The initiative tracker and NPC tracker are session tools. The map is a reference surface. These systems don't need to be coupled in MVP. The key connection is workflow, not data: the DM calls a combat encounter, loads the relevant map, adds NPCs to the tracker, and starts initiative. These are sequential steps, not integrated state.

The only integration worth considering is: **the active map should be visible on the DM dashboard** (where the DM already lives during a session), not on a separate page the DM has to navigate away to. If maps live on a separate `/maps` route, the DM has to leave the dashboard to change the map — that's a context-switch that hurts the session flow.

### Are there different map types worth distinguishing?

Yes — but for MVP, do not try to categorize them. The practical difference is:

- **Battle maps**: typically square or rectangular images, often gridded, 50×50 squares or similar. Used for one encounter then set aside.
- **Region/dungeon maps**: often tall, wide, or irregularly shaped. Used for orientation across multiple sessions.

The interaction with both is identical: load image, display, zoom/pan. The DM knows which map serves which purpose; the app doesn't need to know. A single "active map" concept handles both.

### My strong recommendation on scope

Build a **shared image viewer** — not a VTT. The DM uploads a map image, players see it on their character sheet or a dedicated view, the DM can clear it or swap it. Pan and zoom for the DM. No fog of war, no tokens, no grid tools. This is a 2-day feature, not a 2-month one, and it closes the actual gap: players currently have no shared visual reference inside the app.

**On map library vs. single active map**: After further evaluation, the MVP should include a **map library with active-map selection**. The incremental implementation cost over single-map is low (a list endpoint, a thumbnail/name-list UI, a set-active action), but the UX improvement at the table is disproportionately large. DMs who run prepared sessions will upload maps before the session and switch between them in 2 seconds during play. Re-uploading the same map every session is friction the library eliminates. Building single-map first and retrofitting a library later would require rewriting the DM dashboard map UI twice — false economy.

External URL loading (linking to a hosted image rather than uploading) is **not recommended** due to CORS constraints, link rot, and display reliability. Restrict to S3 uploads only.

---

## Goal

Give the DM a way to manage a library of map images and share any one of them with players during a live session, so the group has a common visual reference inside the app without the DM having to screenshare or paste an image link into Discord. The DM uploads maps ahead of time or mid-session, selects which is active, and can swap maps in seconds. Players see whatever the DM has set as active.

---

## User stories

- As the DM, I want to upload a map image to my map library so that it is available to use in any session without re-uploading it each time.
- As the DM, I want to select a map from my library and set it as the active map so that it immediately becomes visible to all players.
- As the DM, I want to upload a new map mid-session and immediately set it as active so that I can handle unplanned encounters without losing session flow.
- As the DM, I want to pan and zoom the active map so that I can focus the group's attention on a specific area of a larger image.
- As the DM, I want to clear the active map as the session progresses so that players see an empty state between scenes.
- As the DM, I want to delete a map from my library so that I can remove maps I no longer use.
- As a player, I want to view the map the DM has set as active on my character sheet so that I can orient myself without screensharing or switching apps.
- As a player, I want to pan and zoom the map independently on my own device so that I can examine details at my own pace during exploration.
- As the DM, I want to access the map library from the DM dashboard (without navigating away) so that I can swap maps mid-session without losing my place in the combat tracker.

---

## Functional requirements

### Map library concept

- The DM maintains a **persistent library of uploaded map images**. Maps in the library survive between sessions and are available for reuse.
- At most one map is "active" at any given time — the currently displayed map. All players see the active map.
- The active map is a reference; it has no associated state (no tokens, no fog, no grid data).
- The active map persists server-side and survives a page refresh. It remains active until the DM explicitly clears it or sets a different map active.
- When no map is active, players see an empty state ("No map loaded").
- Only the DM can upload, delete, set active, or clear the active map.

### Uploading a map

- The DM uploads map images (JPEG or PNG) via the DM dashboard map panel.
- Image upload reuses the existing S3 presigned URL pattern (same as portrait uploads).
- Each uploaded map is assigned a UUID and stored in a dedicated S3 path (e.g., `maps/{uuid}`), distinct from portraits.
- The DM can optionally name the map at upload time (e.g., "Catacombs Level 2"). If no name is given, a default based on the filename is used.
- External URL loading (linking to a hosted image) is **not supported** — uploads only. External URLs introduce CORS failures, link rot, and unreliable display. Reliability at the table is more important than convenience.
- The DM can upload a new map mid-session without losing session flow; the new map is added to the library and can immediately be set as active.

### Map display

- The active map is displayed as a full-bleed image within a defined container.
- Both the DM (on the dashboard) and players (on the character sheet) can pan and zoom the image independently on their own device.
- Pan and zoom state is local to each client — the DM panning does not pan the player's view.
- The map should render at its natural aspect ratio; the container should not distort it.
- On mobile, pinch-to-zoom and drag-to-pan are the expected gestures.

### Map library management

- The DM can view all maps in the library (thumbnail grid or name list — UX to decide).
- Each library entry shows the map name and a thumbnail preview.
- Each library entry has a "Set active" action, a "Rename" action, and a "Delete" action.
- Renaming is inline on the library page: clicking Rename makes the name editable in place; confirming saves; Escape cancels. No page navigation required.
- Deleting a map from the library also deletes the corresponding S3 object. Orphaned S3 files are not acceptable — deletion must be complete.
- If the deleted map was the active map, the active map is cleared (players see empty state).
- There is no maximum library size enforced in MVP; practically, a library of 10–30 maps is typical.

### DM dashboard integration

- A map panel appears on the DM dashboard. Its placement (column, collapsible section, etc.) is for UX to decide.
- The panel shows the active map if one is set, with an option to clear it or swap to a different library map.
- If no map is active, the panel shows an upload prompt and (if the library has entries) a "Choose from library" affordance.
- The DM can upload a new map or select from the library without navigating away from the dashboard.

### Player character sheet integration

- On the character sheet, the active map is accessible when one is loaded. Placement (new tab, Combat tab section, etc.) is for UX to decide.
- Players see a "no map" state when nothing is loaded — they are not shown the upload UI.
- Players do not need to be authenticated to view the active map (same no-auth pattern as the character sheet header).

### Polling

- The player character sheet and DM dashboard poll for the active map on the same adaptive interval as other session data, so a map swap appears on player screens within a few seconds.

---

## Data model changes

### Map library DynamoDB item

Store the map library as a single DynamoDB item with a sentinel slug, following the same pattern as `slug: "initiative"` and `slug: "npc-combat"`:

```
{
  slug: "map-library",
  activeMapId: string | null,   // UUID of the currently active map, or null if none
  maps: [
    {
      id: string,               // UUID, assigned at upload time
      name: string,             // DM-supplied label or filename default
      s3Key: string,            // e.g. "maps/{uuid}" — used for S3 deletion
      imageUrl: string,         // full S3 URL for display
      uploadedAt: string        // ISO timestamp
    }
  ]
}
```

- `activeMapId: null` means no map is currently active (cleared state).
- When a map is deleted, its entry is removed from `maps[]` and the S3 object at `s3Key` is deleted. If `activeMapId` matched the deleted entry, it is set to `null`.
- The `s3Key` is stored separately from `imageUrl` to support clean S3 deletion without parsing URLs.

### New API endpoints

- `GET /maps` — returns `{ activeMapId, maps[] }`. No auth required (players and DM poll this). Players only need `activeMapId` and the corresponding `imageUrl`; the full library list is returned to all callers (the library metadata is not sensitive).
- `PUT /maps/active` — sets or clears the active map. Requires DM auth. Body: `{ mapId: string | null }`.
- `DELETE /maps/:mapId` — removes a map from the library and deletes the S3 object. Requires DM auth. Clears `activeMapId` if it matched.
- Presigned URL for image upload: reuse the existing `/portrait` presigned URL pattern with a different S3 key prefix (`maps/{uuid}`). A new endpoint `POST /maps` creates the DynamoDB record after the client completes the S3 upload. Body: `{ id, name, s3Key, imageUrl }`.

### `dmParty.js` filter

Add `slug !== "map-library"` to the existing filter that excludes sentinel items from the party list endpoint.

---

## Out of scope

- Fog of war, dynamic lighting, or selective reveal.
- Token placement, movement, or position tracking.
- Grid overlay or distance measurement.
- Multiple simultaneously active maps (one active at a time).
- Map annotation, drawing, or markup.
- Importing maps from D&D Beyond, Dungeon Alchemist, or any other tool.
- Map permissions beyond "DM controls, players view."
- Synchronizing pan/zoom state between DM and player views (each client pans/zooms independently).
- Any tactical combat automation tied to map position.
- External URL loading — uploads only. External URLs are explicitly excluded for reliability reasons (CORS, link rot).
- Map categorization, tagging, or search within the library.

---

## Open questions

1. **Map placement on the character sheet**: Should the active map appear as a new fourth tab in the character sheet tab strip (alongside Inventory / Persona / Combat), or as a section within one of the existing tabs? A fourth tab keeps the map from cluttering Combat; but Combat is where players are during the sessions when a map matters most. UX to decide.

2. **Map placement on the DM dashboard**: Should the map panel be a fourth column, a collapsible section within the party column, or a fullscreen overlay the DM toggles? The dashboard is already wide at three columns (party, NPCs, initiative). UX to decide.

3. **Library UI on the DM dashboard**: Should the library appear as a thumbnail grid (visual but space-hungry) or a simple name list with "Set active" buttons (compact but less glanceable)? Given that maps may only be named by filename default, thumbnails may be essential for quick identification. UX to decide.

4. **Image upload size limit**: Portrait uploads are small (profile images). Map images can be much larger (5–10 MB for a high-res battle map). What is the practical upload size limit for a good pan/zoom experience on mobile? Architect to advise. A client-side size warning (e.g., "this image is large and may load slowly on mobile") may be sufficient rather than a hard server-side block.

5. **Name field at upload**: Should the DM be required to name a map at upload time, or is naming optional (defaulting to filename)? Optional naming is lower friction but may produce an unreadable library of "dungeon_map_v3_FINAL.png" entries. A required name with a short character limit (e.g., 40 characters) might be worth the small friction for library legibility.

---

## UX Design

**Prototype**: `design/prototypes/maps.html`

---

### Decision 1 — Map panel on the DM dashboard

**Decision: collapsible panel at the top of the party column, above the party cards.**

Rationale for rejecting alternatives:

- **Fourth column** — the dashboard is already three columns wide at ~900 px minimum, and the party column is already the widest. A fourth column would either require a horizontal scroll bar on tablets or compress all three existing columns to the point the initiative tracker and NPC cards become unreadable. The layout doesn't have room.
- **Modal / overlay** — a fullscreen or large overlay keeps the columns clean but breaks the DM's ability to have the map visible *while* watching HP bars and initiative. The DM's primary need at the table is to reference the map and the combat tracker simultaneously — a modal that covers the dashboard defeats that entirely.
- **Slide-in side panel** — same problem as the modal; the DM has to dismiss it to act on the combat tracker underneath.

**Why the party column works:** The party column is the widest column and already owns the DM Dice Roller at its bottom. The map panel is a logical companion — both are session tools the DM uses from the same column. The party column scrolls on shorter screens so additional height is acceptable. The panel is collapsible (toggle on the header row) so it doesn't force extra scrolling when not needed. A pulsing green dot on the collapsed header communicates "a map is active" at a glance without the DM needing to expand it.

**Placement within the column:** Map panel sits *above* the party cards (below the column header). This keeps cards — which need to be seen and tapped constantly during combat — in the primary scroll position. The DM opens the map panel when swapping maps, then collapses it and returns to cards for the rest of the encounter.

---

### Decision 2 — Map tab on the character sheet

**Decision: a fourth "Map" tab in the existing tab strip (alongside Inventory | Persona | Combat).**

Rationale:

- The Combat tab is already dense: concentration banner, inspiration, conditions, spell slots, weapons, dice roller. Adding a large image viewer mid-tab would require significant vertical scrolling past combat-critical controls.
- A dedicated tab keeps the map view clean and full-height — players can pan/zoom without other UI elements competing for space.
- The tab is always rendered in the strip, even when no map is active; in that state it is visually dimmed (reduced opacity, `not-allowed` cursor) and non-interactive. This communicates that the feature exists and that the DM hasn't loaded a map yet, without cluttering the tab strip with a conditional element that appears and disappears.
- When a map is active the tab becomes fully interactive. Players tap it when they want to examine the map, then tap back to Combat for their turn. This is a deliberate mode switch — consistent with how players already switch between tabs.
- The tab label is simply "Map" in both states. The inactive visual treatment (dimmed opacity) is sufficient to indicate "nothing here yet" without needing a "No Map" label that draws extra attention.

---

### Library UI

**Thumbnail grid, not a name list.**

A name list only works if maps are well-named. In practice DMs upload files named `dungeon_v3_FINAL_USE_THIS.png` — the filename default produces an unreadable library. Thumbnails provide instant visual identification regardless of name quality. The grid uses `auto-fill` with `minmax(160 px, 1fr)` columns so it adapts from 2 columns on mobile to 4 on wider modals.

Each library card contains:
- Thumbnail image (100 px tall, `object-fit: cover`) — provides instant visual recognition
- Map name (Crimson Text, 13 px) — editable label the DM set at upload time
- Date and file size metadata (IM Fell English, 10 px, muted) — helps distinguish multiple versions
- "● Active" badge in green when this map is currently set as active
- "Set Active" button (primary style) — absent on the already-active card (no action needed)
- "Delete" button (destructive style) — tapping shows an inline confirmation below the card's footer rather than a separate modal, keeping the user in context

The library is opened from two entry points: the "🗺 Map Library" button in the top nav bar (always accessible), and the "Swap" / "Choose from Library" affordances on the map panel itself. Both open the same modal. Upload is presented as a section at the bottom of the same modal so the DM doesn't need a separate UI for managing vs. uploading.

---

### Upload flow

The upload flow is embedded as the lower section of the library modal, not a separate page or dialog. This keeps the DM in context — they can see the library while uploading.

**Steps:**

1. **Drop zone** — file picker button + drag-and-drop target. Accepts JPEG and PNG only. Clicking opens the OS file picker. Drag-and-drop activates a visual highlight on the zone border.
2. **Name + confirm** — after a file is selected, the drop zone is replaced by:
   - A small thumbnail preview (80 × 56 px) so the DM confirms they selected the right file
   - The original filename shown in muted italic text for reference
   - A name input pre-filled by transforming the filename (strip extension, replace hyphens/underscores with spaces, capitalise first letter). The DM can edit before confirming. Max 48 characters.
   - A size warning banner (amber, non-blocking) if the file exceeds 5 MB: "Large image — may load slowly on mobile. Consider resizing before uploading."
   - "← Back" and "Upload Map →" buttons
3. **Progress** — progress bar (animated fill) + percentage label during S3 upload. The upload goes directly to S3 via a presigned URL (same pattern as portrait uploads).
4. **Done** — success banner with the map name confirmed. Two follow-up actions: "Upload Another" (resets to step 1) and "Set as Active" (marks the new map active and closes the modal).

The name input being pre-filled is the key UX decision here: it lowers friction enough that most DMs will simply confirm the default, but the editable field means the library stays clean for DMs who do rename things.

---

### Pan/zoom interaction model

Both the DM preview (in the map panel) and the player viewer (in the Map tab) use the same CSS transform approach with no external library:

- The map image is rendered on a `<canvas>` element (or could be an `<img>` tag) positioned `absolute` inside an `overflow: hidden` container.
- `transform: translate(Xpx, Ypx) scale(S)` with `transform-origin: 0 0` is the only CSS property changed during interaction.
- **Pan**: `mousedown` + `mousemove` on desktop; single-touch `touchmove` on mobile. Delta from previous position added to translate values.
- **Zoom**: `wheel` event on desktop (centred on cursor position — translates so the point under the cursor stays fixed); two-finger pinch (`touchmove` with `e.touches.length === 2`, distance change mapped to scale delta) on mobile.
- **Clamping**: translate values are clamped so the image edge cannot move past the midpoint of the viewport in either axis, preventing the user from panning entirely off the map.
- **Scale limits**: 0.2× minimum, 8× maximum — practical limits for dungeon map zoom.
- **Reset**: a "Reset view" button (DM panel) / "Reset" button (player tab) sets translate to (0,0) and scale to 1.
- **Zoom display**: the player viewer shows the current zoom percentage in the controls bar below the image. This gives the player a reference when examining fine detail.
- **Hint tooltip**: "Drag to pan · Scroll or pinch to zoom" shown on first display as a faint overlay in the bottom-right corner. Fades out after the first interaction event.

Pan/zoom state is entirely local to each client — it is never sent to or read from the server. The DM panning to show a specific room does not affect the player's view.

---

### Mobile considerations

**Player character sheet (Map tab):**
- The viewer container is fixed at 420 px height on desktop. On mobile (viewport ≤ 560 px) this should expand to `calc(100vh - 160px)` to give the player as much screen as possible.
- Pinch-to-zoom and drag-to-pan are the primary interactions on mobile. `touch-action: none` on the viewer container is required to prevent the browser from intercepting scroll and pinch gestures.
- The tab strip with four tabs may be tight on narrow phones (≤ 360 px). If overflow occurs, the tab labels can be hidden and only icons shown — a `@media (max-width: 360px)` rule hiding `.tab-label` elements keeps the strip usable.

**DM dashboard map panel:**
- The full dashboard stacks to a single column below 900 px. On a tablet in portrait (768 px), the DM typically uses the single-column stacked layout. The map panel appears at the top of the stacked party column, which is natural — the DM scrolls down to reach cards.
- The map preview inside the panel is 180 px tall in the prototype; on mobile this provides a glanceable reference without taking over the screen. The DM is more likely to interact with the full library via the modal on a tablet where pinch interaction is comfortable.

**Library modal:**
- The modal is `max-width: 680 px` and fills the viewport width on mobile with 16 px side padding. The thumbnail grid collapses to 2 columns on narrow viewports.
- The upload drop zone degrades gracefully on mobile — the drag-and-drop affordance becomes irrelevant, but the "Click to choose" tap target remains the primary action (opens the OS file picker).

---

### Open questions for the architect

1. **Presigned URL flow for map uploads vs. portrait uploads**: Portrait uploads use an existing presigned URL endpoint (`/portrait`). Map uploads need a similar presigned URL but with the `maps/{uuid}` S3 key prefix. The cleanest approach is a dedicated `POST /maps/presign` endpoint that returns a presigned PUT URL and the assigned UUID, followed by a `POST /maps` to write the DynamoDB record after the client confirms the upload succeeded. Alternatively, the existing portrait endpoint could accept a `type=map` parameter — but conflating the two creates coupling. Architect to advise on whether a new Lambda handler is warranted or the portrait handler can be parameterised.

2. **S3 key strategy and CDN caching**: Portrait images use a single key per character and overwrite on update. Map images are immutable once uploaded (a new upload always creates a new UUID key). This means no cache-busting is needed for map URLs — `imageUrl` can be served with long cache headers. However, the S3 bucket configuration for portraits may set different cache control headers than what maps need. Architect to confirm whether `hunkz-dnd-portraits` (or a new `hunkz-dnd-maps` bucket) is the right home, and what cache header strategy applies.

3. **Map image load on the client**: The player sheet polls `GET /maps` on the same adaptive interval as other session data. When `activeMapId` changes, the client fetches the new `imageUrl`. Large maps (5–10 MB) will cause a noticeable load delay on mobile. Consider whether a thumbnail-resolution version should be stored alongside the full-resolution image (e.g., generated by a Lambda on upload via Sharp or similar) so the initial load shows a fast-loading preview while the full resolution loads in the background. Architect to evaluate cost vs. benefit for this group's scale (3 players, ~10–30 maps total).

4. **`dmParty.js` filter**: The consultant's data model proposes a `slug: "map-library"` sentinel item in the characters table. The `dmParty.js` handler already filters out `slug: "initiative"` and `slug: "npc-combat"`. The architect should confirm the filter list is maintained in one place (not duplicated across handlers) to prevent future sentinel items from leaking into the party payload.

5. **Active map polling on the player sheet**: `GET /maps` is a new endpoint polled by both the DM dashboard and all player sheets. Confirm this fits within the existing adaptive polling infrastructure (ADR-011) and that the `getRollHistory`-style pattern used by the DM dashboard also covers `GET /maps` — or whether `GET /maps` should be bundled into `GET /dm/party` for the DM and returned as a top-level field on the character endpoint for players (avoiding a separate poll).

---

## Architect Notes

**Applies**: ADR-003, ADR-004, ADR-008, ADR-011

**Tech approach**:

**Presigned URL + DynamoDB record flow — two Lambdas, not one**

Do not extend the existing `portrait.js` handler with a `type=map` param. Portrait presign is coupled to a character slug, requires owner/DM auth against a specific character's DynamoDB item, and uses the key pattern `portraits/{slug}-{timestamp}.{ext}`. Maps have none of those characteristics — they are not character-scoped, and they authenticate as DM-only. A separate `backend/src/handlers/mapPresign.js` Lambda is the correct boundary (ADR-004: one Lambda per HTTP operation). It exposes `POST /maps/presign`, requires DM auth via `x-character-password` (same `verifyPassword` / `auth.role === "dm"` pattern as `getNpcCombat.js`), generates a UUID v4, returns `{ uploadUrl, id, s3Key, imageUrl }` with key `maps/{uuid}.{ext}`, and signs a presigned `PutObjectCommand` against `PORTRAITS_BUCKET` — no new bucket needed (see S3 section below). The client uploads directly to S3 using the presigned URL, then calls `POST /maps` to register the record in DynamoDB.

The DynamoDB registration (`POST /maps` → `backend/src/handlers/postMap.js`) writes the map entry into the `slug: "map-library"` sentinel item using an `UpdateCommand` that appends to the `maps` array. This is separate from presign so that a failed S3 upload does not create an orphaned DynamoDB record — the client only calls `POST /maps` after the S3 PUT returns 200. `DELETE /maps/:mapId` goes in `backend/src/handlers/deleteMap.js`. It requires DM auth, removes the map from the `maps[]` array, clears `activeMapId` if it matched, and calls `DeleteObjectCommand` on the S3 key stored in `s3Key`. The existing `S3Client` in `portrait.js` uses `PutObjectCommand` only — `deleteMap.js` will import `DeleteObjectCommand` from `@aws-sdk/client-s3`; this is available in the same SDK package already in `package.json`, no new dependency. `PUT /maps/active` goes in `backend/src/handlers/putMapActive.js` — DM auth, writes `activeMapId` field on the sentinel item.

A `PATCH /maps/:mapId` endpoint (`backend/src/handlers/patchMap.js`) handles rename. It requires DM auth, accepts `{ name: string }`, and updates just the `name` field of the matching entry in the `maps[]` array using a DynamoDB `UpdateExpression`. No S3 interaction needed — only the DynamoDB record changes. The frontend sends the new name after the DM confirms the inline edit; on error it reverts the displayed name optimistically.

All five map Lambdas (`mapPresign`, `postMap`, `deleteMap`, `putMapActive`, `patchMap`) plus the read `getMapLibrary` go in `backend/src/handlers/`. Add all six to `backend/template.yaml` following the exact pattern of `GetNpcCombatFunction` / `PutNpcCombatFunction`. All six need `DynamoDBCrudPolicy` on `CharactersTable`; `mapPresign` and `deleteMap` additionally need `S3WritePolicy` on `PortraitsBucket`.

**Sentinel slug registration**

The single source of truth for sentinel slugs is `backend/src/lib/specialItems.js`. Add `MAP_LIBRARY_SLUG = "map-library"` to the constants and add it to `RESERVED_CHARACTER_SLUGS`. That is the only change needed — `filterPublicCharacterItems` (called by both `dmParty.js` and `list.js`) will automatically exclude the new item with no changes to those handlers. The feature-builder must not manually add a filter to `dmParty.js`; that would break the single-source contract. Add corresponding tests to `backend/src/lib/specialItems.test.cjs`.

Add `normalizeMapLibraryRecord` and `getMapLibraryState` / `saveMapLibraryState` helpers to `backend/src/lib/specialRecords.js`, following the exact pattern of `getNpcCombatState` / `saveNpcCombatState`. This keeps all sentinel record I/O in one place.

**Polling integration — one new poll loop, wired via `useAdaptivePolling`**

The recommended approach is a dedicated lightweight `GET /maps` endpoint (`backend/src/handlers/getMapLibrary.js`) that returns `{ activeMapId, maps[] }` with no auth required (players need the active map URL without logging in — matching the no-auth pattern for the character sheet header described in the functional requirements). This is the simplest path and avoids coupling the map state into `GET /dm/party` or `GET /characters/:slug` responses, which would require touching two already-complex handlers and two polling call sites.

On the DM dashboard (`src/pages/DmDashboardPage.jsx`): add a fifth `useAdaptivePolling` call — same structure as the existing `getRollHistory` poll added in story 11. Add `getMapLibrary(dmPassword)` to `src/api.js`. Wire into `DmDashboardPage`'s state as `mapLibrary` / `setMapLibrary`. The DM map panel component (`src/features/dmDashboard/MapPanel.jsx`) reads from this state.

On the player character sheet (`src/pages/CharacterPage.jsx` / `src/components/CharacterSheet.jsx`): add one `useAdaptivePolling` call for `getMapLibrary()` (no auth header needed). The Map tab in `CharacterSheetViewMode.jsx` receives `activeMap` (the entry from `maps[]` whose `id === activeMapId`, or `null`) as a prop. This is the only new polling loop on the character page — it does not interfere with the existing character data poll.

**S3 key strategy and bucket**

Use the existing `hunkz-dnd-portraits` bucket (`PortraitsBucket` in `template.yaml`) under a `maps/` prefix. A separate bucket adds IAM surface, a new CloudFormation resource, and a separate CORS rule — all unnecessary at current scale. The existing bucket already has `PublicAccessBlockConfiguration` set to allow public, a CORS rule for `GET` and `PUT`, and a bucket policy granting `s3:GetObject` on `portraits/*`. Add a parallel statement granting `s3:GetObject` on `maps/*` to `PortraitsBucketPolicy` in `template.yaml` — this is a one-line change to the `Resource` field (make it an array: `["${PortraitsBucket.Arn}/portraits/*", "${PortraitsBucket.Arn}/maps/*"]`). Map keys are `maps/{uuid}.{ext}` (immutable; UUID assigned at presign time). No cache-busting is needed because keys never reuse a UUID. The presigned `PutObjectCommand` in `mapPresign.js` must set `ContentType` to the client-supplied `image/jpeg` or `image/png` — same as portrait.js does. `<img src={imageUrl}>` rendering in the map viewer is a direct src attribute, not a fetch/XHR, so no CORS issue on the display side.

**New frontend route and auth gate**

Create `src/pages/MapLibraryPage.jsx` at route `/maps`. This is a full-page DM-only view (for managing the library outside of a session). Auth gate uses `sessionStorage.getItem("dnd_dm_password")` — identical to `DmDashboardPage`. If no DM session, render the existing `DmLoginPrompt` component from `src/features/dmDashboard/DmLoginPrompt.jsx`. Add the route to `src/main.jsx` (or wherever routes are defined). Navigation: the top nav on `CharactersListPage` (when DM-authenticated) gains a "Maps" link alongside "Campaign"; the Map Library page has a "← Campaign" back link to `/dm`.

The library modal the UX design describes (opened from within the DM dashboard) is a different entry point to the same data. The feature-builder should implement `src/features/dmDashboard/MapLibraryModal.jsx` as a reusable component used both by the modal trigger on the dashboard and as the primary content of `MapLibraryPage.jsx`. Do not duplicate the library grid UI.

**Pan/zoom component**

Implement `src/features/maps/MapViewer.jsx` — a self-contained component that takes `{ imageUrl, pal }` props and owns all pan/zoom state locally. Used both in `MapPanel.jsx` (DM dashboard) and in the Map tab of `CharacterSheetViewMode.jsx`. No external library — `transform: translate(Xpx, Ypx) scale(S)` on an `<img>` inside an `overflow: hidden` container, per the UX design spec. Touch handling requires `touch-action: none` on the container. Keep this component under 200 lines; the math is straightforward and does not warrant a library.

**Scope boundary**: The feature-builder implements five new Lambda handlers (`mapPresign`, `postMap`, `deleteMap`, `putMapActive`, `getMapLibrary`), updates to `specialItems.js` and `specialRecords.js`, `template.yaml` additions (five functions + bucket policy update), four new frontend components (`MapPanel.jsx`, `MapLibraryModal.jsx`, `MapViewer.jsx`, `MapLibraryPage.jsx`), updates to `src/api.js` (three new exports: `getMapPresignUrl`, `postMap`, `deleteMap`, `putMapActive`, `getMapLibrary`), one new polling loop in `DmDashboardPage.jsx`, one new polling loop in `CharacterPage.jsx` / `CharacterSheet.jsx`, the fourth tab in `CharacterSheetViewMode.jsx`, and the "Maps" nav link in `CharactersListPage.jsx`. The feature-builder must update `design/app-overview.md` after implementation.

Out of scope for this story: thumbnail generation (Sharp/Lambda@Edge), any change to `GET /characters/:slug` or `GET /dm/party` response shapes, fog of war, tokens, or any tactical map functionality.

**Performance notes**:

Map images at 5–10 MB will cause 3–8 second load times on a typical mobile connection (LTE ~10 Mbps). No thumbnail pipeline is warranted at this group's scale (3 players, ~10–30 maps, each loaded at most once per session). The right mitigation is a client-side size warning in the upload flow (already specified by UX: amber banner above 5 MB) to nudge the DM toward smaller files. The `<img>` browser cache will retain the loaded image for the session so switching back to the same map has no reload cost. A thumbnail pipeline would require a Sharp Lambda layer or Lambda layer for Node.js image processing — real operational overhead for negligible benefit at 3-player scale. Revisit if the group grows or if load times become a reported friction point.

The polling payload for `GET /maps` is small — the full `maps[]` array with 30 entries is under 5 KB. No pagination needed.

**Cost notes**:

At current scale: 3 player sheets + 1 DM dashboard each polling `GET /maps` at 1 Hz while focused. That is ~4 Lambda invocations/second during a 4-hour session = ~57,600 invocations per session. Well within Lambda free tier (1M invocations/month). DynamoDB reads at PAY_PER_REQUEST: ~57,600 GetItem calls per session at $0.25/million = negligible. S3 storage for 30 maps at 5 MB average = 150 MB = effectively zero cost ($0.023/GB/month). S3 GET requests for map image loads: 3 players × 30 swaps per session = 90 GETs per session = negligible. No cost concern at this scale.

**Dependencies**:

- `@aws-sdk/client-s3` `DeleteObjectCommand` — already in the S3 SDK package imported by `portrait.js`, no new package install needed. Confirm `DeleteObjectCommand` is exported from the installed version by checking `backend/package.json` for the `@aws-sdk/client-s3` version.
- `uuid` or `crypto.randomUUID()` for UUID generation in `mapPresign.js` — Node.js 20.x has `crypto.randomUUID()` natively; no new dependency needed.
- `DmLoginPrompt.jsx` must exist (it does, per `decisions.md` Feature Index) before `MapLibraryPage.jsx` can reuse it.

**Decisions resolved**:

1. **Map name field — optional.** The name field is optional. If left blank, display the filename with extension stripped and underscores/dashes converted to spaces (e.g., `catacombs_level_2.png` → `Catacombs Level 2`). This display transform applies at render time; the raw filename is stored as the fallback. No schema change needed — store `name: ""` and let the frontend apply the transform when `name` is empty.

2. **File size cap — add `content-length-range` condition at 15 MB.** Feature-builder adds this as a condition in `mapPresign.js`. One-line addition, prevents runaway storage.

3. **`GET /maps` public — accepted.** Full map library (names + URLs) is readable by unauthenticated callers. Intentional at current trust model. See ADR-012 in `decisions.md` for revisit guidance if the app is ever commercialised.

4. **`deleteMap.js` S3 deletion error handling** — if the S3 `DeleteObjectCommand` fails after the DynamoDB update (or vice versa), the library and S3 will be inconsistent. For a 3-player app, a best-effort approach (delete DynamoDB entry first, attempt S3 delete, log on failure) is acceptable. A full two-phase commit is out of scope. The feature-builder should delete from DynamoDB first (so the app no longer references the object), then delete from S3. If S3 deletion fails, log the `s3Key` for manual cleanup — do not roll back the DynamoDB deletion.
