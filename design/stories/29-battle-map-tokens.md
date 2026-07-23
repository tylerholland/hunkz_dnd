# Feature Story: Battle Map Tokens

**Status**: Implemented (`765440f`), further polished by Story 29b (also implemented)
**Source**: RPG Consultant
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

Give the DM the ability to place character and NPC tokens on a battle map so the whole party sees a shared, live view of where everyone is during combat — without requiring a full VTT or any client-side grid math. The DM is the sole authority over token positions; players see the state the DM has set, updated within the normal polling interval.

## User stories

- As the DM, I want to place a character or NPC token at a location on the battle map so that the party has a shared positional reference without me having to describe it verbally.
- As the DM, I want to move a token by selecting it and clicking a new location so that I can update positions turn by turn without interrupting the flow of combat.
- As the DM, I want to remove a token from the map (without deleting the character or NPC) so that I can represent death, fleeing, or off-map events.
- As the DM, I want a visual tray showing all available character and NPC tokens so that I know at a glance who has not yet been placed.
- As a player, I want to see the current token positions on the active map so that I understand the spatial situation during combat without asking the DM to re-describe it.
- As a player, I want token positions to update automatically during my turn so that I can see the result of other combatants' moves.

## Functional requirements

### Map type distinction

- Any map in the library can be used as a battle map. The DM explicitly switches a map into "battle map mode" when opening or activating it — this is a per-session toggle, not a permanent property of the map image. In adventure map mode, the map is display-only (current behavior). In battle map mode, the token layer is enabled.
- The distinction is necessary because the token placement data model only makes sense on a map where the DM intends to track positions. It prevents the token tray from cluttering every map view.

### Token source

- Character tokens derive from the existing party roster. The token image is the character's portrait (cropped to a circle, same as the DM dashboard card). Each character gets exactly one token per map.
- NPC tokens derive from the active NPC combat tracker entries. Each NPC entry in the tracker gets one token.
- Tokens are created automatically when the DM enters battle map mode — the DM does not manually create them. They appear in the "unplaced" tray until the DM positions them.

### Placement interaction

- The DM selects a token from the unplaced tray (or an already-placed token on the map) and then clicks the destination on the map to place or move it. This "select then click" model is chosen deliberately over drag-and-drop for two reasons: it works equally well on touch (tablet) where long-press drag is unreliable, and it gives the DM a moment to aim precisely before committing the position.
- When a token is selected, it enters a "held" state visible to the DM only (e.g., highlighted in the tray or shown as a floating indicator following the cursor). Clicking a second time on the map places it. Pressing Escape or clicking the selected token again cancels the selection.
- Moving an already-placed token uses the same flow: click the token on the map to select it, click the new destination to drop it.
- Only the DM can initiate placement or movement. Player token positions are read-only for players.

### What tokens display on the map

- Token image (portrait circle) with a thin palette-colored ring for player characters, a neutral ring for NPCs.
- Name label directly below or inside the token — short enough to read at a glance (first name or short NPC label). No truncation beyond the NPC's existing tracker name.
- No persistent HP bar or condition icons on the token itself at rest. At combat scale, a permanent HP strip on every token creates illegible clutter and duplicates information already visible on the DM dashboard.
- If a character is at 0 HP, the token is visually dimmed (opacity reduced) to signal FALLEN without displaying a number.

### Token hover expand

- When the DM or a player hovers over (or long-presses on touch) a placed token, the token expands gracefully with a CSS transition to reveal a compact HP meter.
- For **character tokens**: shows the character's HP bar (current / max) using the existing health-tier color coding (teal = healthy, yellow = wounded, red = critical). Players see exact HP numbers for their own character; the design may choose whether other players see exact numbers or just the bar.
- For **NPC tokens**: the DM sees the exact HP bar (same as the NPC combat tracker card). Players see only the health tier glow (green/yellow/red, no number) consistent with the existing design decision that NPC exact HP is not disclosed to players.
- The expanded state collapses back on mouse-out / touch-end with a matching exit transition. Only one token expands at a time.
- The animation should feel like the token "breathes open" — the portrait circle grows slightly and the HP bar slides in below it — rather than a separate tooltip appearing from nowhere.

### Player view

- Players see the battle map with tokens as the DM has placed them. The view is static from the player's perspective — no token interaction, no tray.
- Player views update through the existing adaptive polling mechanism. Positions need not be instant; a 1–2 second lag is acceptable during combat turns.
- Each player can still pan and zoom independently on their own device; the token positions are rendered on top of the map in the same coordinate space.

### Token coordinates

- Token positions are stored as fractional coordinates (0.0–1.0 in both axes) relative to the map image's natural dimensions. This approach is resolution-independent: the same position renders correctly regardless of the player's viewport size or zoom level. No grid is assumed.
- Each map stores its own token position array. Switching the active map switches the token layout. Returning to a map that was previously used in battle mode restores the positions from that session (persisted until the DM clears them or ends combat).

### Clearing tokens

- "End Combat" on the DM dashboard (existing action) clears all token positions for the current map. This is the natural end-of-encounter cleanup.
- The DM can also remove individual tokens from the map via a contextual action on the placed token (e.g., long-press or right-click on the token to reveal a remove option).

## Data model changes

New fields on the `map-library` sentinel item, stored per-map entry:

- `mapMode: "adventure" | "battle"` — defaults to `"adventure"`. Set by the DM when activating battle map mode.
- `tokens: [{ id, type, sourceId, x, y }]` — the placed token list for this map.
  - `id`: UUID for this token placement record.
  - `type`: `"character"` or `"npc"`.
  - `sourceId`: character `slug` for type `"character"`, NPC entry `id` for type `"npc"`.
  - `x`, `y`: fractional position (0.0–1.0) relative to the map image dimensions.

New API endpoint needed: `PATCH /maps/:mapId/tokens` — DM auth required. Accepts the full updated `tokens[]` array (replace, not merge). Also accepts `mapMode` update in the same call to allow mode-switching and initial token placement atomically.

The existing `GET /maps` (no auth) returns the `tokens[]` and `mapMode` alongside the existing map fields so players can render token positions without a separate call.

## Out of scope

- Grid snapping, hex grids, or any distance measurement.
- Fog of war or vision/lighting.
- Players moving their own token.
- Animated token movement (smooth path between old and new position).
- Token size categories (Large, Huge, etc.) — all tokens render at the same size.
- Area-of-effect overlays or spell range circles.
- Persistent HP bars or condition icons on the token at rest (hover-expand covers the HP use case).
- Multiple simultaneous battle maps.
- Token import from D&D Beyond, Roll20, or any external tool.

## Open questions

1. **Token size on the map**: What is the right rendered size for tokens relative to a typical battle map? Too large and they obscure terrain; too small and portrait details are unreadable. Needs a UX decision, likely expressed as a fixed pixel size at 1× zoom with a note that it scales with the map zoom level.

2. **Coordinate system when the map is panned/zoomed**: The DM pans and zooms the map during play. When the DM clicks to place a token, the click position must be translated back to the fractional coordinate space of the underlying image, not the viewport. The UX prototype should clarify how this transform is communicated visually (e.g., does the token "snap" visually to the correct image-space position immediately?).

3. **Token tray placement on the DM view**: The token tray (unplaced tokens) needs a home on the DM map panel without obscuring the map. Options include: a strip below the map, a collapsible sidebar overlaid on the map edge, or a separate panel that disappears once all tokens are placed. UX to decide.

4. **NPC token images**: NPC cards in the tracker do not have portrait images. Should NPC tokens use a colored circle with the NPC's initials (similar to the DM dashboard portrait fallback), or a generic silhouette icon? This affects legibility at scale and how easily the DM distinguishes multiple NPCs of the same type (e.g., three Goblin tokens).

5. **What happens to token positions when an NPC is removed from the combat tracker**: ~~Open question~~ **Decision (2026-06-08)**: token stays on the map as a FALLEN dim body marker until the DM explicitly removes it. The Remove action is surfaced inside the hover-expand card (not only via long-press) so the DM can dismiss a fallen enemy's token without leaving the hover interaction.

## UX Design

Brief at `design/briefs/battle-map-tokens-brief.md`.

**Key decisions made in the brief:**

- **Token tray**: 76px strip mounted below the MapViewer (not overlaid), split PC / NPC halves by a divider. Collapses to a 28px "All placed" status strip when all tokens are on the map.
- **Token appearance**: 36px portrait circle at 1× zoom, scales with MapViewer transform. PC tokens use `pal.accent` ring; NPC tokens use neutral grey `pal.border` ring. NPC initials use a hash-tinted fill from NPC `id` to distinguish identical enemies.
- **Placement**: "select then click" confirmed. Held token rides 36px above finger on touch. Cancel via `× Cancel` pill (44px touch target), tap source again, or Escape.
- **Hover-expand**: "breathes open" — portrait grows 36→48px (220ms overshoot cubic), HP card unfolds below (+80ms delay, 200ms ease-out), name label slides down (+120ms delay). Total: 320ms open, 180ms synchronised close. Only one expanded at a time.
- **HP visibility**: DM sees exact HP on all tokens. Players see exact HP on own token and other PCs (if `partyVisibilityEnabled`). Players see health-tier glow line only on NPC tokens — no numerals, no fill bar.
- **Drop animation**: held token snaps to image-space coordinate with overshoot cubic + 1.0→1.08→1.0 scale bounce (300ms total). The most important animation in the feature.
- **FALLEN state**: token opacity 0.4, ring desaturated 60%, faint red inset shadow. No number.
- **End Combat**: clears all token positions + flips mapMode back to "adventure." Confirmation prompt required when tokens are placed.
- **Fractional coordinates (0.0–1.0)**: resolution-independent. Clamped at image bounds on drop.
- **Open question for owner**: should an NPC removed from the tracker auto-remove its token or leave a FALLEN "body" marker? Brief recommends body marker (leave until DM removes manually).

---

## Architect Notes

**Applies**: ADR-001 (CSS architecture), ADR-002 (feature-sliced screens), ADR-003 (flat DynamoDB schema), ADR-004 (one Lambda per HTTP op), ADR-005 (DM auth model), ADR-011 (adaptive polling + optimistic writes), ADR-012 (unauthenticated maps read), ADR-014 (CSS variable schema), **ADR-016 (token layer in MapViewer)**, **ADR-017 (token persistence + endpoints)**. The brief itself was the trigger for ADR-016 and ADR-017 — read both before starting.

---

### 1. Scope boundaries — what is genuinely in this story

**In scope for first ship**:
- Battle Mode toggle on `MapPanel` (DM only).
- Auto-populated PC + NPC token tray below the MapViewer when Battle Mode is on.
- Select-then-tap placement (DM only); held-state floater that follows cursor/finger.
- Drop animation (the brief's most-important animation: overshoot transition + 1.0→1.08→1.0 bounce).
- Fractional `(x, y)` storage; clamp to `[0, 1]` on drop.
- Render placed tokens on both DM and player MapViewer.
- Hover-expand HP card with the visibility rules in brief §13.
- FALLEN dim state driven by `hpCurrent <= 0`.
- "End Combat" clears tokens + flips `mapMode → "adventure"` on the active map.
- New `PATCH /maps/{mapId}/tokens` endpoint (handles `tokens` and `mapMode` in one call).
- Image maps only.

**Defer to follow-ups (and the brief's §16 calibration is one of these)**:
- **Token scale calibration (brief §16)**. This is a self-contained sub-feature with its own endpoint, gear popover, popover bottom-sheet on mobile, debounced write, and CSS-variable plumbing. It is genuinely useful but it can ship after the core token layer works. Bundling it doubles the surface area of the first PR. **Recommend cutting §16 to Story 29b** and shipping the v1 with `tokenScale` always `1.0`. The ADR-017 schema already includes `tokenScale` with a default, so adding the slider later is purely additive.
- **PDF maps with tokens.** Click-to-fractional math needs `naturalWidth` and `naturalHeight`. For PDFs that flows through `PdfCanvas` and requires reading the rendered canvas size — meaningful extra work. **Recommend gating Battle Mode to image maps in v1** (disable the toggle on PDF maps with a tooltip "Tokens not yet supported on PDF maps").
- **Smooth 280ms poll-induced token movement on player view (brief §8).** Nice but optional for first ship. Instant snap is acceptable; add the CSS `transition: transform 280ms ease-out` on token wrappers in a polish pass after confirming poll cadence doesn't fight the transition.
- **Concentration dot on the 36px token rest state (brief §5).** Brief flags it as cuttable. Cut for v1; hover-expand card already carries the concentration row. Re-add if playtest asks for it.
- **Long-press remove menu on touch (brief §7).** Hover-expand has a `Remove from map` action per the 2026-06-08 decision; that covers the v1 need. The 480ms long-press menu is a desktop-parity feature for later.
- **"All tokens placed → 28px status strip" tray collapse (brief §9).** Polish; ship with the tray simply showing "All placed" inside its normal 76px footprint.
- **`prefers-reduced-motion` audit (brief §10).** Add as a CSS pass after motion is wired; not a v1 blocker.

**Out of scope (explicitly forbidden in v1, not just deferred)**:
- Any grid, snap, distance, AoE, fog, vision.
- Players moving any token (read-only enforced server-side by the DM-only PATCH route).
- Token import/export.
- More than one active battle map.

---

### 2. MapViewer token layer — how to extend the pan/zoom pipeline

`src/features/maps/MapViewer.jsx` is currently a pure pan/zoom primitive. It has one transform applied to either the `<img>` (line 286) or the `<div>` wrapping `PdfCanvas` (line 266). Both use `transformOrigin: "0 0"` and `transform: translate(${translate.x}px, ${translate.y}px) scale(${scale})`.

**Add tokens as a sibling layer inside the same scrolling container, sharing the same transform.** Concrete shape:

```jsx
<div
  ref={containerRef}
  onMouseDown={...}
  // existing handlers
>
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      transformOrigin: "0 0",
      transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    }}
  >
    {/* existing img or PdfCanvas */}
    {tokenLayer && imageNaturalSize && (
      <div className="token-layer" style={{ position: "absolute", inset: 0, "--token-scale-multiplier": tokenScale }}>
        {tokens.map((t) => (
          <TokenChip key={t.id} token={t} imageW={imageNaturalSize.w} imageH={imageNaturalSize.h} ... />
        ))}
      </div>
    )}
  </div>
  ...
</div>
```

Each `TokenChip` positions itself in image-space pixels:
```jsx
style={{ position: "absolute", left: t.x * imageW, top: t.y * imageH, transform: "translate(-50%, -50%)" }}
```

That sits the token center on the fractional coordinate. Because it's inside the `scale(${scale})` transform, the token's CSS pixel size automatically multiplies by `scale` — exactly what the brief §5.3 requires.

**Reading `naturalWidth` / `naturalHeight`**: add an `onLoad` to the `<img>` that captures `e.target.naturalWidth` / `.naturalHeight` into state, plus pass it up to the parent via a new `onImageLoad` callback so MapPanel can use it for its drop calculation. The DM's click → fractional translation lives in MapPanel, not MapViewer.

**Click → fractional translation** (the formula MapPanel needs):
```js
const rect = mapContainerRef.current.getBoundingClientRect();
const offsetX = e.clientX - rect.left - translate.x;
const offsetY = e.clientY - rect.top - translate.y;
const fracX = offsetX / (scale * naturalWidth);
const fracY = offsetY / (scale * naturalHeight);
// clamp to [0, 1] before sending
```

MapPanel already receives `viewerState` (`{ translate, scale, pageNumber }`) via the existing `onViewChange={setViewerState}` (MapPanel.jsx:160). Extend that callback's payload to include `naturalSize` once the image loads, or add a parallel `onImageLoad` prop.

**MapViewer prop additions** (minimal, additive):
- `tokens: Token[]` — array of `{ id, type, sourceId, x, y, /* visual props */ }` to render (already pre-merged with PC/NPC data by the parent — see §4 below).
- `tokenScale: number` — default `1`, applies via the CSS variable.
- `onTokenLayerClick(frac, event)` — fires when the token layer is clicked while the DM is in HELD state (player view doesn't pass this).
- `onTokenClick(tokenId, event)` — for pickup of placed tokens.
- `onImageLoad({ naturalWidth, naturalHeight })` — fires after the image's `onLoad`.
- `interactionMode?: "dm" | "player" | undefined` — gates whether the layer accepts pointer events for drop/pickup. Default undefined = no interaction = backward-compat with existing callers (MapViewerPage, character-sheet Map tab).

Do **not** internalise held-state inside MapViewer. It belongs in MapPanel.

**Backward compatibility**: Existing callers of `MapViewer` (`MapViewerPage.jsx`, `CharacterSheetViewMode.jsx`, `CharacterSheetSessionMode.jsx`, the `<MapPanel>` instance in `DmDashboardPage`) must not break when no `tokens` prop is passed. The token layer renders `null` when `tokens` is undefined/empty.

---

### 3. MapPanel changes — extract a `BattleMode` slice

Current `MapPanel.jsx` is 272 lines and already mixes layout, library modal trigger, view-publish, resize handle, and free-zoom toggle. Adding the full Battle Mode machine (toggle, tray, held-state, drop animation, calibration popover) inline will push it past the practical-review threshold ADR-002 was written for.

**Recommendation**: Extract the battle-mode UI to `src/features/dmDashboard/battleMode/` per ADR-002:

- `src/features/dmDashboard/battleMode/BattleModeController.jsx` — owns held-state machine (`IDLE | HELD`), held token id, derives tokens-with-data from `party` + `npcCombat` + `mapLibrary.activeMap.tokens`, handles drop math, calls `patchMapTokens`.
- `src/features/dmDashboard/battleMode/TokenTray.jsx` — the 76px strip below the map; PC half + NPC half + divider; renders unplaced chips.
- `src/features/dmDashboard/battleMode/BattleModeToggle.jsx` — the `⚔ Battle Mode` pill for the panel header.
- (Defer for v2:) `src/features/dmDashboard/battleMode/CalibrationPopover.jsx` for the gear/slider — only added when §16 ships.

`MapPanel.jsx` gains:
- A `battleMode` prop or, more cleanly, the `BattleModeController` rendered inside the panel body when `activeMap.mapMode === "battle"`.
- New header chrome: the `<BattleModeToggle>` pill alongside the existing collapse caret.
- An optional render of `<TokenTray>` below the MapViewer (replaces nothing; sits between MapViewer and the resize handle).

The held-token floating follower (the cursor-attached chip) belongs as a portal-rendered fixed-position element controlled by BattleModeController so it can render outside MapPanel's overflow:hidden box. Use `document.body` as the portal target.

**Map sources for tokens** (DM side):
- PC tokens: derived from `party` (DmDashboardPage state already polled from `getDmParty`). One token per party member; sourceId = character `slug`.
- NPC tokens: derived from `npcCombat.npcs` (also already polled). One token per NPC; sourceId = NPC `id`.
- The "expected" token set for a map = union of PC slugs + NPC ids. The "unplaced" tray = expected minus placed (those in `activeMap.tokens` with a matching sourceId).

**Edge case in token derivation**: When a PC is removed from the party roster or an NPC is removed from the tracker but their token is still in `activeMap.tokens`, that token still renders as an "orphan FALLEN body" per the 2026-06-08 decision. BattleModeController must not filter these out — the tray just doesn't show a chip for them.

---

### 4. Data flow

```
GET /maps (polled by everyone, no auth)
   ↓
mapLibrary state in DmDashboardPage / CharacterModePage / MapViewerPage
   ↓
activeMap = mapLibrary.maps.find(m => m.id === activeMapId)
   ↓
activeMap.tokens[], activeMap.mapMode, activeMap.tokenScale
```

**DM side (DmDashboardPage → MapPanel → BattleModeController)**:
- DmDashboardPage already passes `mapLibrary` and `dmPassword` to `<MapPanel>` (DmDashboardPrototypePage.jsx:1031–1037). Add `party` and `npcCombat` to that prop set; BattleModeController needs them for token derivation and the hover-expand HP card.
- Token writes use the existing optimistic-write pattern (ADR-011): BattleModeController applies the local `tokens[]` change immediately, calls `patchMapTokens`, then calls `queueDashboardRefresh(0)` (DmDashboardPrototypePage exposes a parallel `fetchDashboardData({ force: true })` via `onLibraryChange`). Use the same callback; do not invent a new polling channel.

**Player side (CharacterModePage → CharacterSheetSessionMode → MapViewer)**:
- `mapLibrary` is already polled (CharacterModePage.jsx:117). Pass `activeMap.tokens`, `activeMap.tokenScale`, and the party/NPC visibility-rule inputs (`partyStatus`, character's own slug) down to `<MapViewer>` (or to the existing `CharacterSheetSessionMode`, which currently constructs `<MapViewer>` itself).
- The HP card is hover-only; no extra polling cost.
- Players need *health tier* for NPCs but not exact HP. The brief expects this to be computed client-side from the *NPC* HP — but the player doesn't get NPC HP at all (per ADR-015's `getInitiativePublic` shape, which derives `healthTier` server-side). **Decision needed**: extend `getPartyStatus` or `getInitiativePublic` to publish NPC `healthTier` keyed by NPC id, so the token hover-card can look it up. Probably the cleanest answer is to add NPC entries to `GET /initiative/public` (already returns `healthTier`) and have the client cross-reference token `sourceId === entry.id`. Confirm with brief author before implementing. (Flagged in §8 below.)

**Open Map Window page (`MapViewerPage.jsx`)**: It already polls `getMapLibrary` and renders `<MapViewer>`. Same prop additions as the player side. No interaction = read-only token render. Good.

---

### 5. Backend

**New handlers**:

1. `backend/src/handlers/patchMapTokens.js`
   - Route: `PATCH /maps/{mapId}/tokens`
   - DM auth (same pattern as `patchMap.js`)
   - Body: `{ tokens: Token[], mapMode?: "adventure" | "battle" }`
   - Validation: tokens must be an array; each token has `id` (string), `type` (`"character" | "npc"`), `sourceId` (string), `x` (number in `[0, 1]`), `y` (number in `[0, 1]`). Reject otherwise with `400`.
   - Behavior: load `getMapLibraryState()`, find map by `mapId`, mutate that entry's `tokens` and optionally `mapMode`, `saveMapLibraryState(...)`. Mirror `patchMap.js:16–25`.

2. `backend/src/handlers/patchMapCalibration.js` (only ships with the calibration follow-up — defer if §16 is cut)
   - Route: `PATCH /maps/{mapId}/calibration`
   - Body: `{ tokenScale: number }` clamped server-side to `[0.5, 2.5]`.
   - Same load-mutate-save pattern.

**`normalizeMapLibraryRecord()` in `backend/src/lib/specialRecords.js`** (lines 135–146): add defaults for the new fields inside the `maps.map(...)` block:
```js
maps: Array.isArray(item?.maps) ? item.maps.map((map) => ({
  ...map,
  contentType: inferMapContentType(map),
  mapMode: map?.mapMode === "battle" ? "battle" : "adventure",
  tokens: Array.isArray(map?.tokens) ? map.tokens : [],
  tokenScale: Number.isFinite(map?.tokenScale) ? Math.min(2.5, Math.max(0.5, map.tokenScale)) : 1.0,
})) : [],
```

This ensures legacy map entries (created before this story) deserialise with safe defaults. No migration needed.

**`backend/template.yaml`**: add `PatchMapTokensFunction` (and later `PatchMapCalibrationFunction`) following the `PatchMapFunction` block (lines 474–487). `DynamoDBCrudPolicy` on `CharactersTable`. No S3 policy needed.

**`src/api.js`**: add `patchMapTokens(mapId, payload, dmPassword)`. Pattern mirrors `patchMap`. (Add `patchMapCalibration` when that lands.)

**DynamoDB item-size sanity**: The `map-library` sentinel item now stores `mapMode`, `tokens[]`, `tokenScale` per map. Per ADR-017, a 50-map library with 30 tokens each is well under the 400 KB item limit. No throttling concerns.

**Item-size protection**: validate `tokens.length <= 200` server-side (`patchMapTokens.js`). At 100 bytes per token that's 20 KB; the library can still hold dozens of maps comfortably. Reject `400` above the limit so a buggy client can't bloat the item.

---

### 6. CSS architecture

Per ADR-014, new feature gets its own CSS file. Recommend:

- **`src/features/dmDashboard/battleMode.css`** — new file, imported by `BattleModeController.jsx`. Owns: token chip base styles (36px circle, ring, outline), token states (HELD glow halo, FALLEN dim, concentration dot), HP hover-card layout, token tray strip, divider, drop-bounce keyframe, hover-expand keyframes.
- Token-position pixel values stay inline per ADR-014's "what stays inline" rules (the `left: x*W, top: y*H` is a runtime computed value).
- `--token-scale-multiplier` is a CSS variable defined on the token-layer wrapper (set inline because it changes per map calibration).
- Animation keyframes (`drop-bounce`, `breathe-open`, `breathe-close`, `glow-pulse`) go inside `battleMode.css`. **No `<style>` tag injection.** The brief mentions `<style>` injection in passing — ignore it; ADR-001 prohibits this.

Add the new file path to ADR-014's "CSS file map" table when it's created (feature-builder owns that update via the standing rule that `app-overview.md` / `decisions.md` stay current).

**Do not extend `mapLibrary.css`** — that's specifically for the library modal. The token feature is its own slice.

---

### 7. Performance

**Per-token re-render on poll tick is the main risk.** `getDmParty`, `getInitiative`, and `getMapLibrary` all run on the 1s adaptive polling tick (ADR-011). With ~10 tokens on screen this is fine. Concerns and mitigations:

1. **Token list identity churn**. `mapLibrary.maps[].tokens` comes from a fresh JSON parse every poll. If `tokens[]` content is unchanged, React still gets a new array reference and will re-render the layer. Wrap each `<TokenChip>` in `React.memo` with a shallow prop check, and key by `token.id`. The chip props that actually change (`x`, `y`, `hpCurrent` from the character lookup) will pass through; the rest stay referentially stable.

2. **HP card on hover**: read HP from the *party* / *npcCombat* state, not from the token record. The token record only holds `(id, type, sourceId, x, y)`. The TokenChip looks up `party.find(p => p.slug === token.sourceId)` or `npcCombat.npcs.find(n => n.id === token.sourceId)`. Memoise the lookup map (`new Map(party.map(...))`) at the layer level so each chip's lookup is O(1).

3. **Pointer-move during HELD**: the floating follower uses `transform: translate(${clientX}px, ${clientY}px)` driven by a single `pointermove` listener attached to `document` (not React state). Set the transform directly on the floater's ref via `requestAnimationFrame`. Do *not* setState on every pointer move — that would re-render the whole panel at 60 Hz. Pattern: ref the floater, rAF-throttle, write `.style.transform` directly.

4. **Slider drag (calibration follow-up)**: brief calls for 1:1 thumb-to-token coupling. Implement by writing `--token-scale-multiplier` directly on the wrapper's `style` from the slider's `onInput` handler (skip React state) — exactly the brief's intuition. State catches up on `onChange` (drag end). The 600ms debounce applies only to the network write.

5. **Hover-expand "breathes open" animation**: pure CSS keyframes triggered by a single `data-expanded="true"` attribute on the chip. No JS animation, no requestAnimationFrame.

6. **`prefers-reduced-motion`**: gate keyframes with `@media (prefers-reduced-motion: reduce)` blocks setting `transition: none; animation: none`.

7. **PDF maps**: `PdfCanvas` rendered at `renderScale: 1.8` already (MapViewer.jsx:272). If tokens ever support PDFs, naturalWidth/naturalHeight must come from the rendered canvas size, not the raw PDF dims. Gate to images in v1.

---

### 8. Corrections to the brief

Most of the brief is solid; these specific items need adjustment before the feature-builder treats them as instructions:

1. **§14 "Files to touch" understates the split.** The brief implies all DM-side logic fits in `MapPanel.jsx`. With the held-state machine, tray, floater portal, and drop animation, MapPanel will balloon past the ADR-002 threshold. Extract to `src/features/dmDashboard/battleMode/` as in §3 above.

2. **§5 "Token name label" — `pal.text` for PC name on a pill against light terrain**. The brief specifies a black pill behind the text. Fine, but ensure the chip's outer outline (`rgba(0,0,0,0.4)`) lives on the *circle*, not duplicated on the label pill — the brief is ambiguous. Use one outline element to avoid stacking.

3. **§5 "transform-origin: center" for hover-expand grow**. Tokens are absolutely positioned with `transform: translate(-50%, -50%)` to center on their fractional coord. Adding a *scale* to that transform tangles with the centering translate. Use `transform: translate(-50%, -50%) scale(${expanded ? 48/36 : 1})` — combined in one transform — or use a CSS custom property and apply scale to a child wrapper. Worth a brief code review when the chip lands.

4. **§6 HP card flips above the token if in bottom 25%**. The card is rendered inside the transformed wrapper, so "bottom 25% of viewport" is a viewport-space test. Compute against `chipRef.getBoundingClientRect()` against the MapViewer container's rect, not against the document. Trivial but easy to get wrong.

5. **§7 "PATCH fires 200ms debounce to absorb rapid sequential placements"**. The endpoint replaces the whole `tokens[]` array. The debounce should *coalesce* multi-drop sequences but must not lose intermediate state across the debounce window. Pattern: keep `tokens[]` in local state, write to it synchronously on every drop, debounce only the *network call*. The optimistic-update model in ADR-011 already handles this — use `liveSync.js` primitives, do not roll a new debouncer.

6. **§7 Drop animation "transition from screen position to image-space coordinate"**. The held floater lives in document.body (fixed-position portal); the placed token lives inside the transformed wrapper. They are in different transform contexts. To animate the transition you cannot just animate one element's `transform`. Pattern: on drop, compute the floater's final on-screen position by reverse-transforming the fractional coord; animate the floater's screen `transform` to that position over 180ms; then synchronously mount the real token at the fractional coord and unmount the floater (FLIP-style swap). This is the trickiest single piece of the feature — budget time for it.

7. **§8 "Token poll move (player) → 280ms smooth transition"**. Implement as `transition: left 280ms ease-out, top 280ms ease-out` on each `TokenChip`. Cheap because transitions only fire when `(x, y)` changes between polls. But: the first time a chip mounts (token appears mid-combat), the transition must not fire from `0,0`. Set `transition: none` on mount, then enable it on the next frame via `requestAnimationFrame`. Standard SSR-style flicker dodge.

8. **§13 "Players see health tier glow only on NPC tokens"**. The token record doesn't carry HP. The player has no `getNpcCombat` access (DM-only). Options:
   - **Recommended**: extend `getInitiativePublic` to expose `healthTier` for *all* combatants (already does for NPCs per ADR-015) and have the player token look up `healthTier` by initiative-entry id → token sourceId. But token sourceId is the *NPC id*, not the initiative entry id. So `getInitiativePublic` entries need a `npcId?` field that matches token sourceId. Modest backend tweak.
   - Alternative: ship v1 with no health-tier indicator on player-side NPC tokens. The hover-card simply omits the bar. The DM still sees full HP. Simpler. Recommend this for v1 and add the public NPC-health-tier feed in a follow-up.

9. **§15 open question #4 ("`partyVisibilityEnabled` — does it hide token positions or only hover-expand HP?")**. ADR-015 already established that `partyVisibilityEnabled: false` returns `{ visible: false, members: [] }` from `getPartyStatus`. The brief's recommendation (positions visible, only HP hidden) **conflicts with the ADR-015 model**. If the player has no party data, the token hover-card has nothing to show. Two coherent options:
   - Tokens for *other PCs* hide entirely when `partyVisibilityEnabled: false` (consistent with ADR-015).
   - Tokens render but the hover-card says "Party visibility off." Requires a separate "render token positions" flag distinct from "render party data" — a new field on the sentinel. Avoid in v1.
   
   **Recommend v1**: when `partyVisibilityEnabled: false`, the player MapViewer renders only their own token and NPC tokens. Other PC tokens are hidden. This is the simplest extension of the existing ADR-015 contract.

10. **§16 calibration popover — cut from v1.** See scope boundary in §1 above. The ADR-017 schema includes `tokenScale` with a default, so adding the slider later costs no migration.

---

### 9. Risks / decisions needed

1. **(Resolved by recommendation, needs sign-off)** Split Story 29 into 29a (core tokens) and 29b (calibration slider, smooth poll transitions, PDF support, long-press menu)? Recommended yes.
2. **NPC health tier on player view** — decide between "ship v1 without it" and "extend `getInitiativePublic` to expose NPC health tier by NPC id." See §8 item 8.
3. **`partyVisibilityEnabled: false` + other PC tokens** — confirm the v1 behavior recommended in §8 item 9 (hide other PCs entirely on player view when visibility is off).
4. **PDF map gating** — confirm v1 Battle Mode is disabled for PDF maps with a tooltip.
5. **Drop animation portal swap** — feature-builder should prototype the floater→placed-token handoff (§8 item 6) early; this is the highest-risk implementation detail.
6. **MapViewer's `onViewChange` callback shape** is already used by MapPanel for the "Set for Players" publish view (MapPanel.jsx:74–85). Adding `naturalSize` to the payload is backward-compatible (existing consumers ignore extra fields), but coordinate it so the publish-view path doesn't accidentally start writing image dims into the sentinel.
