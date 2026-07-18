# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend
```bash
npm run dev       # Start Vite dev server (reads VITE_API_URL and optional VITE_WS_URL from .env)
npm run build     # Production build to dist/
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

### Backend (from /backend)
```bash
sam build                          # Build Lambda functions
sam deploy                         # Deploy to AWS (see deploy.sh for param overrides)
```

### Full deploy
```bash
./deploy.sh   # Fetches DM hash from SSM, builds backend + frontend, syncs to S3
```

### Seed initial data
```bash
node scripts/migrate.mjs   # Seeds DynamoDB and uploads portraits to S3 (interactive)
```

## Architecture

**Frontend** (`src/`) — React 19 + Vite SPA, React Router v7, plain JS, CSS custom properties for theming (no CSS framework). See ADR-001 and ADR-014 in `design/architecture/decisions.md` for the full CSS architecture.

- `src/components/CharacterSheet.jsx` — Orchestrator component (~800 lines): owns sheet state, auth/unlock flow, save/create/import/export, and session sync; delegates rendering to `CharacterSheetViewMode` and `CharacterSheetEditMode`. The old ~2500-line monolith was decomposed into `src/features/characterSheet/`:
  - `CharacterSheetViewMode.jsx` (~1900 lines) — all view-mode rendering, including the four-tab structure below
  - `CharacterSheetEditMode.jsx` (~650 lines) — edit-mode form sections
  - `theme.jsx` — `PALETTES` named color themes; exported and used by pages for theming
  - `constants.js` — `BLANK_CHARACTER` (canonical default shape for new characters; includes `inspiration: false`), `parseModInt` (strict integer parser using `/^[+-]?\d+$/` to reject dice notation, preventing `parseInt("1d8") === 1` false positives), `MOD_ATTRIBUTES`
  - `ItemEditorModal.jsx` — modal for editing weapons/equipment items
  - Ability score modifiers are computed on-the-fly as `floor((score-10)/2) + item bonuses`, never stored
  - **Four-tab structure** (view mode): `"loadout"` (Inventory), `"persona"` (Persona), `"combat"` (Combat), `"map"` (Map); active tab stored in `sessionStorage` as `dnd_tab_${slug}`, default `"combat"`. Map tab dimmed/disabled when no active map.
  - **Combat tab**: concentration banner, inspiration toggle, condition grid + exhaustion counter, spell slots, weapons quick-reference, **Session Notes** (player notes with per-note share toggle), dice roller — all writable without auth via `patchSession`
  - **Persona tab**: renders the `inPlay[]` trait list with diamond bullet points
  - **Inventory tab**: two-column weapons + equipment grid (`.loadout-grid`)
- `src/components/DiceRoller.jsx` — Self-contained dice roller component. Props: `{ weapons, stats, pal, slug }`. Renders at the bottom of the Combat tab. Owns its own state (roll results, history, advantage mode, free picker state). Broadcasts resolved rolls to the shared roll-history feed via `postCharacterRoll` (fire-and-forget; UI never blocks on it). Key internals: `parseDiceExpr(str)` pure parser (named export), `rollDie(sides)` pure RNG (named export), `DieShape` SVG component (named export), `sessionStorage` key `dnd_dice_open_${slug}` for collapse state.
- `src/components/DmDiceRoller.jsx` — DM-specific dice roller rendered at the bottom of the party column in `DmDashboardPage`. Props: `{ pal, party, onApplyDamage }`. Reuses `parseDiceExpr`, `rollDie`, `DieShape` from `DiceRoller.jsx`. New DM behaviors: ×N repeat (1–8, single 600ms animation then labeled result rows), adv/dis auto-reset to Normal after each roll, "Apply to…" pill row after pure damage rolls (no d20) that calls `onApplyDamage(slug, amount)`. `sessionStorage` key `dnd_dice_dm_open` for collapse state (no slug — DM dashboard has no character context).
- `src/api.js` — all API calls; uses `VITE_API_URL` env var; password sent via `x-character-password` header
  - `VITE_WS_URL` (optional, **Story 36**) — read directly by `src/lib/useSessionSocket.js`, not by `api.js`; the `wss://` URL output as `WsUrl` from `sam deploy`. Absent in `.env` → the WebSocket nudge channel is entirely disabled and the app falls back to ADR-011 polling unchanged; this is the expected state until the WS stack is deployed and the URL is filled in.
  - `getDmParty(dmPassword)` — GET /dm/party; requires DM password header
  - `patchSession(slug, fields, password)` — PATCH /characters/{slug}/session; password optional
  - `patchDmNote(slug, action, dmPassword)` — PATCH /characters/{slug}/dm-notes; DM auth required; action is `{ action: "add", text }` or `{ action: "delete", id }`
  - `getInitiative(dmPassword)` — GET /initiative; requires DM password
  - `putInitiative(dmPassword, data)` — PUT /initiative; requires DM password
  - `getMapLibrary()` — GET /maps; no auth; returns `{ activeMapId, maps[] }`
  - `presignMap(filename, contentType, dmPassword)` — POST /maps/presign; DM auth
  - `postMap(mapData, dmPassword)` — POST /maps; DM auth; registers map after S3 upload
  - `putMapActive(mapId, dmPassword)` — PUT /maps/active; DM auth; sets or clears active map
  - `patchMap(mapId, name, dmPassword)` — PATCH /maps/{mapId}; DM auth; renames map
  - `deleteMap(mapId, dmPassword)` — DELETE /maps/{mapId}; DM auth; removes from DB + S3
  - `getNpcLibrary(dmPassword)` — GET /npc-library; DM auth; returns `{ templates: [{ id, name, abilities: string[], hpMax?, portraitUrl?, updatedAt }] }`
  - `putNpcLibrary(dmPassword, templates)` — PUT /npc-library; DM auth; full array replacement; body `{ templates }`
  - `presignNpcPortrait(filename, contentType, size, dmPassword)` — POST /npc-library/portraits/presign; DM auth; image-only, 5 MB cap; returns `{ uploadUrl, id, s3Key, portraitUrl }`
  - `getCounterWheels(dmPassword)` — GET /counter-wheels; DM auth; returns `{ wheels: [{ id, name, segments, filledCount }] }`
  - `putCounterWheels(dmPassword, wheels, wheelEvent?)` — PUT /counter-wheels; DM auth; full array replacement; optional `wheelEvent: { name, segments }` causes handler to append a `type: "wheel"` roll-history entry
  - `patchMapTokens(mapId, payload, dmPassword)` — PATCH /maps/{mapId}/tokens; DM auth; replaces the `tokens[]` array (and optionally `mapMode`) on a map entry
  - `putMapCalibration(mapId, tokenScale, dmPassword)` — PATCH /maps/{mapId}/calibration; DM auth; sets `tokenScale` (0.5–2.5, server-clamped) on a map entry; called debounced 600ms from the calibration popover (Story 29b)
  - `moveMapToken(mapId, tokenId, x, y, slug)` — PATCH /maps/{mapId}/tokens/{tokenId}/position; no auth; a player dragging their own token (Story 34); server rejects mismatched `slug` or non-character tokens with 403
  - `getSessionState({ dmPassword, slug })` — GET /session-state; **Story 35** (extended in **Story 35b**), the single consolidated polling endpoint. `DmDashboardPage.jsx`, `CharacterModePage.jsx`, `CharacterPage.jsx`, and `MapViewerPage.jsx` each poll this via one `useAdaptivePolling` instance instead of separate per-resource endpoint calls (5, 4, 2, and 1 respectively before consolidation) — every polled page in the app now issues exactly one HTTP request per poll tick. DM variant (pass `dmPassword`): `{ party, initiative, npcCombat, rollHistory, mapLibrary, counterWheels, serverTime }`. Public variant (omit `dmPassword`, optionally pass `slug`): `{ partyStatus, initiativePublic, mapLibrary, rollHistory, serverTime, character? }`. `CharacterPage.jsx` passes `slug` plus whichever credential is cached in `sessionStorage` (`dnd_dm_password` takes precedence over `dnd_char_${slug}`, read fresh on every tick) so the owner/DM sees `playerNotes` as soon as the sheet is unlocked; `MapViewerPage.jsx` uses the public variant with no `slug`. The old per-resource endpoints (`getDmParty`, `getInitiative`, `getNpcCombat`, `getRollHistory`, `getMapLibrary`, `getCharacter`, `getPartyStatus`, `getInitiativePublic`) remain in `api.js` and are still used by true one-shot fetch surfaces (`MapLibraryPage.jsx`, NPC library, counter wheels, the DM dashboard's mount-time auth check) — deprecated for polling use only, not removed.
- `src/lib/useSessionSocket.js` (**Story 36** — WebSocket nudge channel) — `useSessionSocket(onChanged)` connects to `VITE_WS_URL`; on a `{"type":"changed"}` push it calls `onChanged` (the page's queued refetch of `GET /session-state`); exponential backoff reconnect (1s → 30s cap); socket only open while `document.visibilityState === "visible"` (closes on hidden, reopens on visible); exposes `{ connected }`. If `VITE_WS_URL` is unset, the hook is a complete no-op and always returns `{ connected: false }` — callers keep today's ADR-011 polling cadence unchanged. Wired into `DmDashboardPage.jsx` and `CharacterModePage.jsx`: while `connected`, each page's `useAdaptivePolling` `activeMs` stretches from `ACTIVE_POLL_MS` (1s) to `BACKGROUND_POLL_MS` (30s) as a safety net; a nudge still triggers an immediate `queueRefresh(0)`. Both pages (and `CharacterSheetSessionMode.jsx`'s session-mode top bar, via a `wsConnected` prop passed down from `CharacterModePage`) render a small pulsing-dot "Live"/"Polling" indicator in the top bar (`.dm-pulse-dot` on the DM dashboard, `.cs-live-dot`/`.cs-live-indicator` in `characterSheet.css` for the player sheet) — purely cosmetic, no behavior depends on it.
- `src/features/maps/MapViewer.jsx` — reusable pan/zoom image viewer; props: `{ imageUrl, name, height, pal, tokens?, tokenScale?, tokenLayerChildren?, onTokenLayerClick?, onTokenClick?, interactionMode?, panSuppressedRef? }`; pure CSS transform, no canvas/library; used on character sheet Map tab and DM dashboard MapPanel; when `tokenLayerChildren` is passed it renders an absolutely-positioned token overlay sized to the image's natural dimensions, with `--token-scale-multiplier` set inline from the `tokenScale` prop; `panSuppressedRef` (Story 34) is an optional ref whose `.current === true` disables the mouse/touch pan handlers, used while a player drags their own token
- `src/features/dmDashboard/battleMode/BattleModeController.jsx` — exports `TokenChip` (shared token-rendering component used by both the DM map and the player Map sub-tab, renders PC and NPC portraits, player-only poll-move animation, DM-only Pointer-Events long-press remove) and `HeldTokenFloater` (cursor-following ghost token while the DM is placing/moving a token, rendered via portal). Story 34 — `TokenChip` also accepts `ownSlug`, `onMoveToken`, and `panSuppressedRef` (all undefined/no-op for DM-side chips): when `token.type === "character" && token.sourceId === ownSlug` the chip becomes drag-enabled via Pointer Events (own-token affordance ring, drag scale/shadow, optimistic move with animated revert on failure), calling `onMoveToken(tokenId, x, y)` on drop
- `src/features/dmDashboard/MapPanel.jsx` — DM map panel; owns Battle Mode toggle, token placement/held-state machine, and the ⚙ token-scale calibration popover (`CalibrationPopover.jsx`, Story 29b)
- `src/features/dmDashboard/CharacterCard.jsx` — party card shell (Story 38 decomposition): header, portrait, HP bar/stepper, temp HP, status row (conditions/concentration/inspiration), spell slots, saves strip, and modal orchestration (`modalMode`, `showAwardXp`, `showDistributeCoin`). Re-exports `AwardXpModal` and `DistributeCoinModal` from `characterCard/` for backward-compatible import paths (consumed directly by `DmDashboardPage.jsx`). Owns HP optimistic-update state (`optimisticHp`/debounced flush) and the lifted `isFallen`/`isStable` death-save booleans (needed for card-level classes/opacity); everything else death-save-related lives in `DeathSavesStrip`.
  - `src/features/dmDashboard/characterCard/DeathSavesStrip.jsx` — the 0-HP strip: pips, shortcut row (Nat 20/Nat 1/Stable), damage-at-0 prompt, FALLEN tombstone state (Story 19 spec). `forwardRef` exposing `showDmgAtZeroPrompt()` for the shell's HP-stepper/DamageHealModal flows; `isFallen`/`isStable` are props (setters) lifted to the shell, everything else (pip state, shortcut disclosure, timers) is owned locally.
  - `src/features/dmDashboard/characterCard/DamageHealModal.jsx` — focused damage/heal modal (stepper, presets, direct input, Enter/Escape keyboard handling)
  - `src/features/dmDashboard/characterCard/QuickActionPopover.jsx` — the ⋯ popover (Deal Damage/Heal shortcuts, Add Condition, Set Temp HP, Drop Concentration, Short/Long Rest)
  - `src/features/dmDashboard/characterCard/DmNotesStrip.jsx` — collapsible DM notes + shared player notes strip (renamed from the card's former internal `NotesStrip`)
  - `src/features/dmDashboard/characterCard/XpCoinRow.jsx` — XP progress bar + coin panel (Tier-2 collapsible section), award/give buttons
  - `src/features/dmDashboard/characterCard/AwardXpModal.jsx`, `DistributeCoinModal.jsx` — XP award and coin distribution modals, re-exported from `CharacterCard.jsx`
- `src/pages/` — CharactersListPage (index), CharacterPage (view/edit at `/characters/:slug`), CharacterModePage (`/characters/:slug/profile` and `/characters/:slug/session` — owns data fetching for mode-routed character views), NewCharacterPage (create flow), DmDashboardPage (`/dm`), MapLibraryPage (`/maps`, DM-only)
- `src/features/characterSheet/CharacterSheetSessionMode.jsx` — session mode two-column layout component; profile mode navigates back to `CharacterPage`; all writes via `patchSession` without auth; see `design/app-overview.md` for full layout description; also owns `PlayerMapViewer`, the token-layer wrapper around `MapViewer`/`TokenChip` for the Map sub-tab — mostly read-only, except the player's own character token, which is drag-movable in battle mode (Story 34; writes via `moveMapToken`)

**Backend** (`backend/`) — AWS SAM, Node.js 20.x Lambdas, DynamoDB (PAY_PER_REQUEST, PK: `slug`), S3 for portraits.

- 32 Lambda handlers in `backend/src/handlers/`: `list`, `get`, `create`, `update`, `delete`, `verify`, `portrait`, `session`, `dmParty`, `initiative`, `dmNotes`, `getMapLibrary`, `mapPresign`, `postMap`, `putMapActive`, `patchMap`, `patchMapTokens`, `patchMapCalibration`, `moveMapToken`, `deleteMap`, `getPartyStatus`, `getInitiativePublic`, `getNpcCombat`, `putNpcCombat`, `getCounterWheels`, `putCounterWheels`, `getNpcLibrary`, `putNpcLibrary`, `npcPortraitPresign`, `getSessionState`, `wsConnect`, `wsDisconnect`
  - `session.js` — PATCH /characters/{slug}/session; partial update of session fields (hpCurrent, tempHP, spellSlots, conditions, exhaustionLevel, concentration, inspiration, playerNotes); intentionally writable without auth (see ADR-005); DM password accepted via x-character-password
  - `dmParty.js` — GET /dm/party; DM-only; returns projected session-relevant fields for all characters; filters out sentinel slugs (`initiative`, `npc-combat`, `roll-history`, `map-library`, `npc-library`) via `filterPublicCharacterItems()`; per-item projection now delegates to `projectDmPartyItem()` in `backend/src/lib/partyProjection.js` (Story 35, shared with `getSessionState.js`)
  - `dmNotes.js` — PATCH /characters/{slug}/dm-notes; DM auth required; accepts `{ action: "add", text }` or `{ action: "delete", id }`; appends/removes from `dmNotes[]` array in DynamoDB
  - `initiative.js` — GET + PUT /initiative; DM-only; stores initiative order as a single DynamoDB item with `slug: "initiative"`
  - `getPartyStatus.js` — GET /party/status; no auth required; returns `{ visible: boolean, members[] }` with player-safe projection (slug, name, palette, portraitUrl, hpCurrent, hpMax, tempHP, conditions, concentration, inspiration, deathSaves); returns `{ visible: false, members: [] }` when `partyVisibilityEnabled` is false on the party-roster sentinel; per-item projection now delegates to `projectPlayerCharacter()` in `backend/src/lib/partyProjection.js` (Story 35, shared with `getSessionState.js`)
  - `getInitiativePublic.js` — GET /initiative/public; no auth required; returns `{ round, activeTurnIndex, entries[] }` with hidden entries stripped, initiative roll values stripped, and NPC health tiers derived from npc-combat data; entry-stripping/health-tier logic now delegates to `buildPublicInitiativePayload()` in `backend/src/lib/initiativeProjection.js` (Story 35, shared with `getSessionState.js`)
  - `getSessionState.js` — GET /session-state; **Story 35 consolidated polling endpoint** (extended in **Story 35b**), replaces the per-resource polling above for `DmDashboardPage.jsx`, `CharacterModePage.jsx`, `CharacterPage.jsx`, and `MapViewerPage.jsx`. DM variant (valid DM password in `x-character-password`): `{ party, initiative, npcCombat, rollHistory, mapLibrary, counterWheels, serverTime }`. Public variant (no/invalid DM password): `{ partyStatus, initiativePublic, mapLibrary, rollHistory, serverTime }`, plus `character` when `?slug=<slug>` is supplied (same shape/stripping rules as unauthenticated `GET /characters/{slug}`, including `playerNotes` visibility via `applyPlayerNotesVisibility()` against the supplied `x-character-password` — full notes for the verified owner/DM, stripped otherwise; this was already correct going into Story 35b, no handler change was needed). Reads: one `BatchGetItem` for the sentinel records (`initiative`, `npc-combat`, `roll-history`, `map-library`, `party-roster`, `counter-wheels` — `npc-library` intentionally excluded, not polled), one `BatchGetItem` for party-member characters keyed off the roster (plus the `?slug` target for the public variant) — two DynamoDB round trips max. Uses shared projection helpers (see below) so its output matches the old per-resource endpoints field-for-field. The old endpoints are NOT removed — they remain live for true one-shot fetch surfaces (`MapLibraryPage.jsx`, NPC library, counter wheels).
  - `wsConnect.js` / `wsDisconnect.js` — **Story 36 WebSocket nudge channel**, `$connect`/`$disconnect` routes on the separate `WsApi` (`AWS::ApiGatewayV2` WebSocket API, not part of `CharactersApi`). `wsConnect.js` writes `{ connectionId, connectedAt, ttl }` (12h TTL) to the dedicated `WsConnectionsTable`; `wsDisconnect.js` best-effort-deletes the row (the TTL attribute is the real cleanup backstop if this route never fires, e.g. an abrupt network drop).
  - `getPartyRoster.js` — GET /party-roster (DM auth); now also returns `partyVisibilityEnabled` boolean in the response when roster exists
  - `getMapLibrary.js` — GET /maps; no auth required; returns `{ activeMapId, maps[] }` from `slug: "map-library"` sentinel item
  - `mapPresign.js` — POST /maps/presign; DM auth; generates UUID, returns presigned S3 PutObject URL for `maps/{uuid}.{ext}` key in `hunkz-dnd-portraits` bucket
  - `postMap.js` — POST /maps; DM auth; appends map entry to `maps[]` array on sentinel item via `list_append`
  - `putMapActive.js` — PUT /maps/active; DM auth; sets `activeMapId` on sentinel item (accepts `null` to clear)
  - `patchMap.js` — PATCH /maps/{mapId}; DM auth; renames a map entry by ID
  - `patchMapTokens.js` — PATCH /maps/{mapId}/tokens; DM auth; validates and replaces the `tokens[]` array (max 200, each `{ id, type: "character"|"npc", sourceId, x, y }` with `x`/`y` in `[0,1]`) and optionally `mapMode` (`"adventure"` | `"battle"`) on a map entry
  - `patchMapCalibration.js` — PATCH /maps/{mapId}/calibration; DM auth; sets `tokenScale` on a map entry, clamped 0.5–2.5 server-side (mirrors `patchMap.js`'s read-modify-write pattern; preserves `activeMapView` on write)
  - `moveMapToken.js` — PATCH /maps/{mapId}/tokens/{tokenId}/position; **no auth** (ADR-005 trust model, same as `session.js`); body `{ x, y, slug }`; Story 34 — a player moving their own token; validates `token.type === "character"` and `token.sourceId === slug` (403 otherwise), clamps `x`/`y` to `[0,1]`; mirrors `patchMapCalibration.js`'s read-modify-write pattern, updating only the one token's `x`/`y` and preserving all other map/token fields
  - `deleteMap.js` — DELETE /maps/{mapId}; DM auth; removes from DynamoDB then deletes S3 object (best-effort, logs on S3 failure)
  - `getNpcLibrary.js` — GET /npc-library; DM auth; returns `{ templates: [] }` from `slug: "npc-library"` sentinel via `getNpcLibraryState()`
  - `putNpcLibrary.js` — PUT /npc-library; DM auth; validates `Array.isArray(body.templates)`; full array replacement via `saveNpcLibraryState`
  - `npcPortraitPresign.js` — POST /npc-library/portraits/presign; DM auth; image-only (rejects non-image contentType); 5 MB cap (`size` param validated against `MAX_PORTRAIT_SIZE_BYTES = 5 * 1024 * 1024`); S3 key `npc-portraits/{uuid}.{ext}` in `hunkz-dnd-portraits` bucket; returns `{ uploadUrl, id, s3Key, portraitUrl }`
- `backend/src/lib/auth.js` — `verifyPassword(password, item)`: compares against owner hash (DynamoDB) and DM hash (SSM env var `DM_PASSWORD_HASH`)
- `backend/src/lib/db.js` — DynamoDB client wrapper
- `backend/src/lib/specialItems.js` — sentinel slug constants (`INITIATIVE_SLUG`, `NPC_COMBAT_SLUG`, `ROLL_HISTORY_SLUG`, `MAP_LIBRARY_SLUG`, `PARTY_ROSTER_SLUG`, `NPC_LIBRARY_SLUG`, `COUNTER_WHEELS_SLUG`) and `filterPublicCharacterItems()` — single source of truth for sentinel filtering
- `backend/src/lib/specialRecords.js` — helpers for reading/writing sentinel items: `getMapLibraryState()`, `saveMapLibraryState()`, `normalizeMapLibraryRecord()`, `getNpcLibraryState()`, `saveNpcLibraryState()`, `normalizeNpcLibraryRecord()` (passes through `hpMax` and `portraitUrl`), `getCounterWheelsState()`, `saveCounterWheelsState()`, `normalizeCounterWheelsRecord()`
- `backend/src/lib/partyProjection.js` (Story 35) — shared party-member projection: `projectDmPartyItem()` and `projectPlayerCharacter()` (whitelisted field-pick functions, identical output whether the source item came from a Scan or a BatchGetItem), plus the `DM_PARTY_PROJECTION_EXPRESSION`/`DM_PARTY_EXPRESSION_ATTRIBUTE_NAMES` used by `dmParty.js`'s ScanCommand. Used by `dmParty.js`, `getPartyStatus.js`, and `getSessionState.js`.
- `backend/src/lib/initiativeProjection.js` (Story 35) — `buildPublicInitiativePayload(initiative, npcCombat)`: strips hidden entries and raw initiative roll values, derives NPC `healthTier`. Used by `getInitiativePublic.js` and `getSessionState.js`.
- `backend/src/lib/characterProjection.js` (Story 35) — single-character response shaping extracted from `get.js`: `stripPassword()`, `applyPlayerNotesVisibility()` (async, calls `verifyPassword`), `normalizeHpFields()`, `computeIsActiveTurn()`. Used by `get.js` and `getSessionState.js`'s public `?slug=` variant.
- `backend/src/lib/broadcast.js` (Story 36) — `notifySessionChanged()`: scans `WsConnectionsTable`, `PostToConnectionCommand`s `{"type":"changed"}` (via `@aws-sdk/client-apigatewaymanagementapi`, endpoint from `WS_API_ENDPOINT` env var) to every open connection, and prunes any connection that comes back `410 Gone`/`GoneException`. Wrapped so it **never throws and never blocks the write path it's called from** — every failure mode (missing env config, a dead connection, the scan itself failing) is swallowed internally; a no-op if `WS_CONNECTIONS_TABLE`/`WS_API_ENDPOINT` are unset. Called at the end of every session-write handler: `session.js`, `initiative.js` (PUT only), `putNpcCombat.js`, `putCounterWheels.js`, `postCharacterRoll.js`, `postDmRoll.js`, `patchMapTokens.js`, `putMapActive.js`, `patchMapCalibration.js`, `dmNotes.js`, `moveMapToken.js`. See ADR-019 for why the socket carries no payload (a nudge, not the changed data itself).
- `backend/template.yaml` — SAM template; DM password hash passed as parameter override from SSM at deploy time
- S3 bucket `hunkz-dnd` (frontend), `hunkz-dnd-portraits` (portraits + maps under `maps/` prefix, NPC portraits under `npc-portraits/` prefix)
- **Story 36 — WebSocket nudge channel infra**: a separate `WsApi` (`AWS::ApiGatewayV2::Api`, `ProtocolType: WEBSOCKET`, single `prod` stage with `AutoDeploy: true`) alongside the existing `CharactersApi` (HTTP API). Connections live in their own dedicated DynamoDB table, `WsConnectionsTable` (`dnd-ws-connections`, PK `connectionId`, TTL attribute `ttl`, 12h) — a separate table rather than a sentinel row on `CharactersTable`, per the story's stated preference (TTL hygiene is free and sentinel filtering stays simple). Every write-handler Lambda that calls `notifySessionChanged()` gets two extra IAM grants in `template.yaml`: a `DynamoDBCrudPolicy` on `WsConnectionsTable` and an inline `execute-api:ManageConnections` statement scoped to `WsApi`'s `POST /@connections/*` — least-privilege, not granted to every Lambda. `WS_CONNECTIONS_TABLE` and `WS_API_ENDPOINT` are set as `Globals.Function.Environment.Variables` (harmless no-ops for functions that don't call `broadcast.js`). Stack output `WsUrl` (`wss://...`) is what gets set as the frontend's `VITE_WS_URL`.

**Special DynamoDB items**: In addition to character records, the `CharactersTable` stores sentinel items: `slug: "initiative"` (initiative order — now includes `round: number` field, default 1), `slug: "npc-combat"` (NPC HP tracking; NPC object shape: `{ id, name, hpMax, hpCurrent, conditions, initiativeEntryId, notes?, abilities?, portraitUrl?, librarySourceId? }` where `abilities: string[]` stores a persistent ability/spell reference list, `portraitUrl` is an S3 URL from the NPC library, and `librarySourceId` is the `template.id` from the library — all written via `putNpcCombat`), `slug: "roll-history"` (shared roll feed), `slug: "map-library"` (active map + library), `slug: "party-roster"` (ordered party member slugs + `partyVisibilityEnabled: boolean` default `true`; when `false`, `GET /party/status` returns `{ visible: false, members: [] }` so players cannot see party HP/conditions), `slug: "npc-library"` (DM-only creature template library; shape `{ templates: [{ id, name, abilities: string[], hpMax?: number, portraitUrl?: string, updatedAt }] }`; fetched on dashboard mount, not polled; written via `PUT /npc-library` after every save or delete), `slug: "counter-wheels"` (DM-only progress clocks; shape `{ wheels: [{ id, name, segments, filledCount }] }`; `filledCount` is a single number 0..segments (Blades-classic fill-to-here); fetched on mount, written after every tap/create/rename/reset/remove with 300ms debounce; NOT cleared by End Combat). All are filtered from `list.js` and `dmParty.js` via `filterPublicCharacterItems()` in `specialItems.js`.

**Auth model**: Two roles — `owner` (per-character bcrypt hash stored in DynamoDB) and `dm` (single hash from `DM_PASSWORD_HASH` env var set via SSM). DM session stored in `sessionStorage`.

## Character data shape

Key fields stored in DynamoDB: `slug`, `name`, `nameAlt`, `race`, `charClass`, `level`, `palette`, `portraitUrl`, `passwordHash`, `stats` (array of `{name, score, mods[]}`), `weapons` (array), `equipment` (array), `hp`, `hitDice`, `armorType`, `armorTotal`, `spells`, `notes`, `traits`, `playerNotes` (`{ id, text, sharedWithDm, createdAt }[]`; session-writable without auth; stripped from unauthenticated GET responses by `get.js`), `dmNotes` (`{ id, text, createdAt }[]`; DM-only; written via dedicated `/dm-notes` endpoint), `deathSaves` (`{ successes: 0–3, failures: 0–3 }`; session-writable without auth via `patchSession`; added to `SESSION_FIELDS` and `dmParty.js` projection in Story 19; written as full object, never partial; on 3 failures the DM dashboard shows FALLEN state, on NAT20 written atomically with `hpCurrent: 1`).

Each mod entry: `{ attribute: string, value: number }`. Attribute names match `MOD_ATTRIBUTES` constant (includes Strength, Dexterity, Constitution, Wisdom, Intelligence, Charisma, Armor, HP, Hit Dice, Attack Bonus, Damage, Initiative, Speed, Save DC).

**Item shapes:**
- `weapons[]: { id, name, description, mods[], requiresAttunement?, attuned?, equipped? }` — `requiresAttunement` set in edit mode (ItemEditorModal); `attuned` toggled via `patchSession` in view mode; `equipped` defaults to `true` when absent — when explicitly `false`, item mods are excluded from all stat calculations (`_itemBonuses`, ability score flyout, armor breakdown)
- `equipment[]: { id, name, type?, description, mods[], qty?, requiresAttunement?, attuned?, equipped? }` — `type` is a fixed lowercase enum (`""` / `"armor"` / `"shield"` / `"wondrous"` / `"potion"` / `"tool"` / `"ammunition"` / `"quest"` / `"other"`); stored via `ItemEditorModal` select (not free-text); displayed with capitalized label via `itemTypeLabel()` exported from `ItemEditorModal.jsx`; `qty` is a non-negative integer when tracking is on, absent/null when not tracked; `equipped` same as weapons; when `type === "potion"` and `qty > 0`, a `Use` button appears in view mode to decrement qty by 1 via `patchSession`
- Both `weapons` and `equipment` were already in `SESSION_FIELDS` on the backend — no backend changes needed for these new fields
- Drop Item: in view mode, items with a description can be dropped from the expanded description row via a 2-step inline confirmation (`Drop Item` → `Confirm drop` / `Cancel`); writes via `patchSession` after confirmation

## Agents

Five specialist agents follow a **Consult → Strategise → Design → Architect → Build** pipeline. Each stage requires explicit user approval before the next begins.

| Agent | Invoke when | Reads | Writes |
|---|---|---|---|
| `rpg-consultant` | You want a D&D expert's evaluation of features, or want gameplay-level stories written for new features | `design/app-overview.md`, web | `design/stories/` (simple goal-oriented stories: what + why, no UX detail) |
| `design-strategist` | You have a consultant story and want deep interaction design thinking before any HTML is written. Produces a written design brief covering hierarchy, motion spec, interaction model, edge cases. | `design/design-system.md`, `design/app-overview.md`, `design/stories/` | `design/briefs/<name>-brief.md`, appends `## UX Design` to story |
| `ux-designer` | You have a design brief from `design-strategist` and want an interactive HTML prototype built from it. Executes the brief — does not make design decisions. | `design/briefs/`, `design/design-system.md`, `design/stories/` | `design/prototypes/` (new HTML prototype) |
| `code-architect` | **(a)** Review approved stories before implementation — annotates each with tech guidance, scope boundaries, cost/performance notes. **(b)** Periodic codebase audit — produces refactor scope + scale-up backlog | `design/stories/`, `design/architecture/decisions.md`, source files as needed | Stories: appends `## Architect Notes`. Audit: `design/architecture/` |
| `feature-builder` | You've approved a design **and** architect notes are present on all stories | `design/stories/` (with UX Design + Architect Notes), `design/prototypes/`, source files | `src/`, `backend/`, `design/app-overview.md`, `design/design-system.md` |

**Pipeline**: `rpg-consultant` writes the *what/why* → `design-strategist` produces the *design brief* → `ux-designer` *builds the prototype* → `code-architect` adds the *how to build it* → `feature-builder` implements.

**Key principle**: `rpg-consultant` reads `design/app-overview.md` (~2k tokens) instead of source code (~30k tokens). `feature-builder` keeps both `app-overview.md` and `design-system.md` current so downstream agents always have accurate context without reading source.

**Gate**: `feature-builder` will refuse to start if a story is missing `## Architect Notes`. Always run `code-architect` on new stories first.

Example invocations:
```
# Evaluate features and write a story
> Use the rpg-consultant agent to write a story for DM dice rolling

# Produce a design brief (deep interaction design thinking, no HTML)
> Use the design-strategist agent to brief the DM dice roller from design/stories/08-dm-dice-roller.md

# Build the HTML prototype from the brief
> Use the ux-designer agent to prototype the DM dice roller from design/briefs/dm-dice-roller-brief.md

# Review stories before building (run this before every implementation)
> Use the code-architect agent to review the stories in design/stories/

# Audit code health
> Use the code-architect agent to audit the codebase and produce a refactor scope doc

# Implement after approval + architect review
> Use the feature-builder agent to implement the HP tracker from design/stories/hp-tracker.md
```

## Key conventions

- **Styling**: CSS custom properties (`--pal-*`) set at each component root; children use `var(--pal-*)` via CSS cascade. Utility classes in `src/shared.css`; per-component CSS files alongside each component. Inline `style={}` reserved for truly dynamic values only (HP bar widths, computed threshold colors, toggle positions). No runtime `<style>` tag injection. See ADR-014 for the full variable schema and file map.
- `sessionStorage` keys: `dnd_palette_${slug}`, `dnd_dm_password`, `dnd_char_${slug}` (per-character password caching), `dnd_tab_${slug}` (active tab; `"loadout"` | `"persona"` | `"combat"` | `"map"`, default `"combat"`), `dnd_dice_open_${slug}` (dice roller section open/closed, default `false`), `dnd_dice_dm_open` (DM dice roller panel open/closed, default `false`), `dnd_mode_${slug}` (character page mode; `"profile"` | `"session"`, default `"profile"`), `dnd_session_subtab_${slug}` (session mode sub-tab; `"combat"` | `"loadout"` | `"map"` | `"notes"`, default `"combat"`), `dnd_wheels_open` (counter wheels panel open/closed; `"true"` | `"false"` | absent for mode-aware default; no slug suffix — DM dashboard has no character context).
- Ignore legacy/backup files at `src/_backup_of_eoghan_sundayApp.jsx`, `src/_eoghan3.jsx`, `src/_oldApp.jsx`, etc.
