# Feature Story: Battle Map Token Polish

**Status**: Implemented (`f34f2a5`, merged `e8952e4`)
**Source**: RPG Consultant
**Prototype**: design/prototypes/battle-map-token-polish.html

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

### Inactive NPC collapsed state

- NPCs in the **Inactive queue** (not yet in initiative) render in a collapsed state by default: only the NPC name and HP meter are shown. DMG / HEAL / COND buttons, the ability reference block, and the notes field are hidden.
- This keeps the combat tracker manageable when 5–10+ inactive enemies are queued. The DM can see at a glance what's waiting without the panel becoming an unscrollable wall of controls.
- Each inactive NPC row has a single expand toggle (chevron or tap on the row) to reveal the full card — DMG / HEAL / COND / abilities / notes — for that enemy only. Collapsing again hides them. Expanded state is local UI only (no persistence).
- Active NPCs (those with an `initiativeEntryId` — i.e. already rolled into initiative) are **not** collapsed; they always show the full card because the DM needs immediate access during their turn.
- The HP meter shown in collapsed state is the same bar used in the full card. If HP reaches 0 the collapsed row still shows the FALLEN indicator (name strike-through or dim) so the DM can see at a glance without expanding.

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

3. **Player token highlight rings should reflect the player's palette/theme color.** Currently the rings appear in a fixed color regardless of the player's chosen theme. Each player character has a `palette` field — the ring should use that character's `--pal-accent` (or equivalent) so players can instantly recognize their own token at a glance. This is as much a usability fix as a polish item.

3. **Does the calibration slider live in the map panel header or in a gear/settings popover?** The Architect Notes called for a gear popover. The UX designer should decide whether a popover adds enough value over an inline slider to justify the extra tap.

4. **What is the visual treatment for the "All placed" tray collapse?** Does it animate closed, or snap? At what point does it become visible (when the last token is placed, or when the tray has zero items visible)?

---

## UX Design

Brief written at `design/briefs/battle-map-token-polish-brief.md`. Refines Story 29's token layer — no redesign of placement, visibility, or data shape. Coordinates with Story 31 (already built and merged) on the shared `portraitUrl` contract.

Key decisions:
- **NPC portrait upload lives on the NPC card's identity circle** (camera-glyph overlay — hover-revealed on pointer devices, persistent at 0.6 opacity on touch), not in the `⋯` menu. Direct manipulation: tap the face to give it a face. Reuses the `/maps/presign` → S3 flow; writes `portraitUrl` immediately via `putNpcCombat` (no separate save step on the live card). Immediate local preview with determinate progress ring during upload.
- **Token renders the portrait when set, hash-tinted initials when not.** NPC ring stays **neutral grey** even with a portrait — the portrait carries identity, the grey ring carries faction (NPC). `onError` always falls back to initials; never a broken-image glyph. Story 31's number badge sits over the portrait unchanged.
- **Story 31 contract: one upload, reused forever.** `portraitUrl` is the same field Story 31's library stores; `Save to library` is a one-way snapshot at save time (resolves open question 2); spawning a library entry pre-fills the portrait — no second upload.
- **Calibration = ⚙ gear popover in the map panel header (confirmed).** 0.5×–2.5× slider with ± steppers + numeric readout, live drag (instant) / ± click (120ms tween), per-map `tokenScale` via debounced `PATCH /maps/{mapId}/calibration`. Tray chips do NOT scale; labels hide below `scale × zoom < 0.6`. Resolves open question 3 (gear popover confirmed over inline slider).
- **Smooth player-side poll-move:** `transform 280ms cubic-bezier(0.2,0.8,0.2,1)` on the player MapViewer only. **Fires on change, never on first mount** (gated on a has-mounted flag so new tokens fade in at position rather than sliding from origin). DM side keeps Story 29's deliberate drop-bounce.
- **Long-press remove (touch, DM-only): 480ms** hold (distinct from 280ms hover-expand) with a clockwise ring-sweep "charge" cue; surfaces a `✕ Remove / Cancel` micro-menu. Parallel path to the hover-card remove and desktop right-click — additive, not a replacement (resolves user-story 4).
- **Player token ring uses the character's palette accent** (resolves open question 3 / usability fix). Palette key comes from `dmParty` (DM side) and the existing `palette` field in `GET /party/status` (player side); applied as a per-token `--token-ring` CSS variable. NPC rings stay grey.
- **Tray collapse:** at `unplacedCount === 0` (and `total > 0`), the 76px tray animates to a 28px `✓ ALL TOKENS PLACED · N` status strip (220ms height + 180ms content crossfade); auto-expands when any token returns to unplaced or DM taps it. Resolves open question 4.
- **Reduced-motion audit:** single authoritative `@media (prefers-reduced-motion: reduce)` block in `tokens.css`. Strategy is *replace, don't merely delete* where motion carries meaning: poll-moves snap, bounces/breathe become instant appears, FALLEN/concentration keep static end-state styling; long-press sweep replaced by a static "Hold to remove" label so the gesture stays usable; upload progress ring kept as static determinate indicator (real system state, not decorative).

---

## Architect Notes

**Applies**: ADR-003 (flat sentinel schema), ADR-004 (one Lambda per op), ADR-005/007 (DM auth via `x-character-password`), ADR-008 (presigned direct S3 upload), ADR-011 (polling + optimistic session writes), ADR-014 (CSS class system, no `<style>` injection), ADR-017 (token layer — **new, added for this story**; backfills the `tokenScale`/`TokenChip`/presign decisions the brief cited as "ADR-017" but which were never recorded).

**Heads-up — the brief's file map and ADR references are partly stale. Verify against these before starting:**
- There is **no `tokens.css`**. The token layer CSS lives in `src/features/dmDashboard/battleMode.css`. All new token styles and the reduced-motion block go there.
- There is **no `MapPanel` token-render code and no separate player token component**. Tokens render through the single shared `TokenChip` (exported from `src/features/dmDashboard/battleMode/BattleModeController.jsx`), used by both DM and player. Do the portrait, ring, poll-move, and long-press work there, gated on the existing `isDm` / `isOwnToken` props — do not fork a player component.
- **"ADR-017" as cited in the story/brief did not exist** until this review. It's now written (see decisions.md). The `tokenScale` field, `--token-scale-multiplier` wiring, and PC palette ring it references are all real and already in code.
- **Story 31 did NOT ship NPC portraits.** `NpcCombatSection.jsx` has no upload code, no `npcPortraitPresign.js` handler exists, and `api.js` has no npc-portrait presign. ADR-018's claim that Story 31 built this is aspirational only. 29b is the story that actually establishes the NPC portrait pipeline.

**1. Portrait upload presign — reuse `POST /maps/presign`, `maps/` prefix. Do NOT add a new handler or prefix.** `mapPresign.js` is already DM-auth, returns a presigned PUT, and writes under `maps/`. Critically, `template.yaml` lines 85–86 grant public `s3:GetObject` on `portraits/*` and `maps/*` **only** — a new `npc/` or `npc-portraits/` prefix would 403 for player-facing tokens until the bucket policy is widened. Reusing `maps/` sidesteps that entirely with zero backend change beyond possibly relaxing the content-type/size caps. `mapPresign.js` currently accepts `image/*` OR `application/pdf` and caps at 50MB, so an image upload already passes as-is. If you want a tighter image-only/5MB path for NPC portraits, add a caller-supplied constraint to `mapPresign.js` rather than cloning it. Add a thin `presignNpcPortrait(...)` wrapper in `api.js` that just calls the existing `/maps/presign` (or reuse `presignMap` directly). See ADR-017 §4 / ADR-018 supersession note.

**2. `putNpcCombat` pass-through — confirmed, no change needed.** `putNpcCombat.js` writes the full array via `saveNpcCombatState({ npcs: body.npcs })`, and `normalizeNpcCombatRecord` (`specialRecords.js` line 25) spreads `...npc`, so any field including `portraitUrl` round-trips automatically. No schema validation blocks it; the only fields the normalizer forces are `initiativeEntryId`, `conditions`, `notes`. Nothing to widen.

**3. `patchMapCalibration` Lambda — new, clone `patchMap.js` exactly.**
- Route: `PATCH /maps/{mapId}/calibration`, add to `template.yaml`.
- Auth: DM (`x-character-password` → `verifyPassword` → `role === "dm"`), same 4-line preamble as `patchMap.js`.
- Write pattern: identical to `patchMap.js` — `getMapLibraryState()`, `findIndex` on `maps[]` by `mapId`, spread-update `{ ...maps[idx], tokenScale: clamped }`, `saveMapLibraryState({ activeMapId, activeMapView, maps })`. **Do not drop `activeMapView`** — `patchMap.js` passes it through and so must this. Clamp `tokenScale` to 0.5–2.5 server-side (the normalizer already re-clamps on read, but validate at the edge too). Add `putMapCalibration(mapId, tokenScale, dmPassword)` to `api.js`, debounced 600ms client-side per the brief. This is small.

**4. `getPartyStatus.js` projection — `palette` already present, no change.** `PLAYER_VISIBLE_FIELDS` (line 8) includes `palette`, and the `ProjectionExpression` (line 51) fetches it. The player MapViewer just needs to feed these `members` as the `party` prop into `TokenChip`. Also confirm `tokenScale` reaches the player: it comes from `GET /maps` (unauthenticated, ADR-012), not party status — make sure the player CharacterModePage passes the active map's `tokenScale` into `MapViewer`.

**5. First-mount transition gate.** The poll-move `transition` must be absent on first paint. Simplest correct pattern: a per-token `hasMountedRef = useRef(false)` plus a `useEffect(() => { hasMountedRef.current = true; }, [])` inside `TokenChip`; apply the transition CSS class (e.g. `token-chip--animated`) only when `hasMountedRef.current` is true AND `!isDm`. A plain no-deps `useEffect` is sufficient — it runs after the first commit, so the initial render paints the token at position with no transition class, and subsequent position changes (new poll data) render with it. **No `requestAnimationFrame` double-frame flush is needed** here because the class is applied on re-render, not on the same frame as the position mount. (rAF would only be needed if you were toggling the class on the *same* element in the *same* commit as the initial position — you're not.) Keep the transition on `transform`/`translate`, not `left`/`top` (the chip already positions via `left`/`top` inline — you may need to switch positional updates to a `translate` transform so the compositor animates it; flag this, it's the one non-trivial refactor in the poll-move item).

**6. Long-press gesture — use Pointer Events, not mouse.** The prototype's `mousedown`/`mouseup` + `setTimeout` will not fire on touch, which is the entire point of this feature (DM on a tablet). Use `pointerdown` (start timer), `pointerup`/`pointercancel`/`pointerleave` (clear timer), and call `setPointerCapture` on the element so a drag doesn't escape it. This covers mouse, touch, and stylus in one path. The 480ms threshold is fine to coexist with Story 29's 280ms hover-expand: hover-expand is driven by `onMouseEnter`/`setTimeout(120)` (see `handleMouseEnter`, currently 120ms not 280ms — verify the brief's "280ms" number against the code, which shows 120ms), and the long-press is `pointerdown`-driven — they use different event families and different timers, no conflict. Gate long-press on `isDm` only.

**7. Token scale CSS variable — already the right pattern, already wired.** `MapViewer.jsx` sets `--token-scale-multiplier` as an inline style on the `.token-layer` wrapper from the `tokenScale` prop (line ~323), and `.token-chip` reads it in its `transform: ... scale(var(--token-scale-multiplier, 1))` (`battleMode.css` line 24). It is set as an inline style prop (correct per ADR-014 — dynamic value), not a class. No new mechanism needed; the calibration control just changes the `tokenScale` prop value.

**8. `prefers-reduced-motion` — no existing blocks to conflict with.** Grep confirms there is currently **zero** `prefers-reduced-motion` usage anywhere in `src/`. So this is a clean single-block addition. Put it at the bottom of `battleMode.css` (not `tokens.css` — doesn't exist). Follow the brief's replace-don't-delete strategy. There's no risk of clobbering an existing reduced-motion rule.

**9. Scope boundary / regression avoidance vs. Story 31.** Story 31 (npc-library) is merged. Files 29b touches that 31 also touches: `NpcCombatSection.jsx` (31 added the `⋯` menu with Save-to-library / Remove), `api.js`, `putNpcCombat.js`. Guidance:
- The camera-overlay upload lives on the identity circle (per brief §3.1), *not* in the `⋯` menu — so it does not collide with 31's menu items. Keep them independent.
- `normalizeNpcCombatRecord` needs **no widening** — it already spreads `...npc` (confirmed §2). This is different from ADR-018's warning about `normalizeNpcLibraryRecord`, which projects field-by-field; if you later carry `portraitUrl` into the *library* (Story 31's sentinel), that normalizer WILL need the field added. But 29b writes only `npc-combat`, which passes through freely.
- The Story 31 "one upload, reused forever" contract is a save-time snapshot; 29b does not need to implement any library write — just write `portraitUrl` on the combat NPC. Don't add a live link.

**10. Inactive NPC collapsed state — pure UI, no backend.** `NpcCombatSection.jsx` already distinguishes active vs. inactive NPCs via `initiativeEntryId`. Add a `collapsedSet` state (a `Set<id>` initialized to include all inactive IDs on mount, updated on add/remove from initiative). Render inactive NPCs with only name + HP bar when their id is in `collapsedSet`; show a chevron toggle to expand. The HP bar in collapsed view can reuse the existing `npc-hp-bar` element. On transition to active (DM rolls initiative for an NPC), remove its id from `collapsedSet` so it opens automatically. Keep collapsed state local — do not persist to `putNpcCombat`. The collapsed row should still show the FALLEN visual (existing `.npc-fallen` class or equivalent) when `hpCurrent === 0`.

**In scope**: NPC portrait upload on combat card + token render; `patchMapCalibration` endpoint + calibration popover; smooth player poll-move (transform-based, mount-gated); Pointer-Events long-press remove (DM); tray collapse strip; reduced-motion block in `battleMode.css`; inactive NPC collapsed state.
**Out**: per-token scale; library portrait upload (Story 31's surface); path interpolation; grid/hex/fog; any new S3 prefix or bucket-policy change; any player token interaction.

**Cost notes**: One new tiny Lambda (`patchMapCalibration`) — negligible at PAY_PER_REQUEST + handful of users; debounced 600ms so writes are sparse. Portrait upload reuses the existing bucket and presign Lambda — no new AWS resource. Orphaned S3 objects on NPC removal are acceptable (matches map-library behaviour). No cost concern.

**Performance notes**: Poll-move must transition `transform` (compositor) not `left`/`top` (layout) — the current chip positions via `left`/`top`, so moving to a translate transform for animated tokens is the one thing to get right or you'll cause layout thrash on every poll. Scale changes go through the single CSS variable — no token-list re-render, good. Portrait `<img>` should carry `loading="lazy"`/`decoding="async"`; `onError` → initials fallback is mandatory (never a broken-image glyph).

**Dependencies**: None blocking — Story 31 already merged. The `tokenScale` field, `--token-scale-multiplier`, PC palette ring, and `TokenChip` all already exist from Story 29.

**Risks / decisions needed**:
- **The brief cites "280ms" for the hover-expand hold; the code shows 120ms** (`handleMouseEnter`). Confirm the intended hover-expand delay before wiring the 480ms long-press against it, so the two thresholds are correctly staged.
- **Positional animation refactor**: switching animated tokens from `left`/`top` to `transform: translate` is the highest-risk change; verify it doesn't regress the DM drop-bounce or hover-card flip positioning (which reads `getBoundingClientRect`).
- Confirm you're comfortable reusing the `maps/` S3 prefix for NPC portraits (ADR-017 §4 recommends it); the alternative (`npc-portraits/` prefix) requires a `template.yaml` bucket-policy edit and is not worth it.

**Build order** (presign path first, then the independents):
1. **`patchMapCalibration` Lambda + route + `api.js`** — self-contained backend, unblocks the calibration UI. (small)
2. **Calibration popover** in the map panel header, writing via #1. Uses the already-wired `--token-scale-multiplier`. (small–medium)
3. **NPC portrait upload** — `api.js` presign wrapper (reuse `/maps/presign`) + camera overlay on the NPC card circle + `putNpcCombat` write of `portraitUrl` + NPC-portrait branch in `TokenChip` render (add the `token.type === "npc" && npc.portraitUrl` case at line ~198 with `onError` fallback). Portrait render and upload are independent of #1–2. (medium)
4. **Smooth poll-move** — transform refactor + mount-gate in `TokenChip`, player-only. Independent. (medium — highest risk)
5. **Long-press remove** (Pointer Events, DM-only) + **tray collapse** strip. Both independent and small. (small each)
6. **Reduced-motion block** in `battleMode.css` — do LAST so it covers every motion point added in 1–5 in one authoritative pass. (small)
