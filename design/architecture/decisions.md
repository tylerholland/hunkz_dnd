# Architecture Decisions

> Standing decisions for this project. Maintained by `code-architect`.
> Each entry records what was decided, why, and when to revisit.
> Story notes reference these by ID (e.g., "follows ADR-003") instead of re-explaining.

---

## ADR-001 · Styling: CSS custom properties + static CSS files *(supersedes original inline-styles decision)*

**Decision**: Component styling uses a layered CSS system — no Tailwind, no CSS Modules, no styled-components, no runtime style injection.

1. **Palette theming via CSS custom properties.** Each component root sets `--pal-*` variables once as an inline `style={{}}` object. All children inherit via CSS cascade — no prop drilling. See ADR-014 for the full variable schema and file map.
2. **Utility classes in `src/shared.css`.** Repeated structural patterns (`.flex-row`, `.btn-ghost`, `.label-ui`, `.input-base`, `.modal-overlay`, etc.) live here. Imported globally via `src/main.jsx`.
3. **Per-component CSS files** for structural rules that belong to one slice. Imported statically at the top of the component file.
4. **Inline `style={}` reserved for truly dynamic values only**: HP bar fill widths, ghost trail positions, computed threshold colors, toggle switch positions — anything that changes on every render.

**What was removed**: All runtime `<style>` tag injection (`DICE_CSS`, `DASHBOARD_CSS`, `GLOBAL_CSS` string constants), all `onMouseEnter`/`onMouseLeave` hover handlers that only toggled style, and the `useDashboardStyles` / `useCharacterSheetGlobalStyles` no-op hooks.

**Constraint**: Do not create a CSS class for a style that appears only once. Three or more uses justifies a class. Do not use CSS Modules.

**Revisit when**: A design system library or CSS-in-JS with proper SSR support becomes warranted — only if the project expands beyond a single-group SPA.

---

## ADR-002 · Feature-sliced screen modules

**Decision**: Large screens are split by feature slice once they become difficult to reason about as single files. The page/container file keeps orchestration state and API wiring; rendering and feature-local helpers move into `src/features/<feature>/`.

**Current shape**:

- `src/components/CharacterSheet.jsx` is the character-sheet container and sync orchestrator.
- `src/features/characterSheet/CharacterSheetViewMode.jsx` owns the unlocked/view rendering.
- `src/features/characterSheet/CharacterSheetEditMode.jsx` owns the edit/create rendering.
- `src/features/characterSheet/` also holds character-sheet-specific constants, theme helpers, primitives, and modal/forms.
- `src/pages/DmDashboardPage.jsx` is the DM campaign container.
- `src/features/dmDashboard/` holds dashboard slices such as the party card, initiative tracker, NPC combat section, login prompt, confirm dialog, and dashboard shared helpers.

**Rationale**: The earlier monolithic approach was fast while the app was small, but once `CharacterSheet.jsx` and `DmDashboardPage.jsx` crossed the practical review threshold, changes became more error-prone and expensive in both human and LLM context. Feature-sliced files keep related behavior together without exploding the project into many tiny generic components.

**Constraint**: Split by feature/domain behavior, not by arbitrary component taxonomy. Avoid "components/", "hooks/", and "utils/" sprawl inside a feature unless the separation is doing real work.

**Revisit when**: A single feature directory becomes too dense or duplicated patterns clearly want promotion into shared modules. The next step is shared primitives only where at least two screens genuinely use the same behavior, not proactive abstraction.

---

## ADR-003 · DynamoDB PAY_PER_REQUEST, flat schema, PK: slug

**Decision**: Single DynamoDB table, no sort key, PK is the character's URL slug. Schema is schemaless — new attributes are added to handler logic without migration.

**Rationale**: At current scale (handful of characters), PAY_PER_REQUEST costs near zero and eliminates capacity planning. Flat schema means no joins and trivially simple handler code.

**Revisit when**: Access patterns require querying by something other than slug (e.g., "all characters for a given campaign"), or character count reaches a scale where full table scans in `list.js` become expensive. At that point, add a GSI or a campaign-level partition key.

---

## ADR-004 · One Lambda per HTTP operation

**Decision**: Each API operation is its own Lambda handler file (`list`, `get`, `create`, `update`, `delete`, `verify`, `portrait`). Shared logic lives in `backend/src/lib/`.

**Rationale**: Independent deployment, clear blast radius, easy to reason about cold starts per endpoint. Shared utilities (auth, db, response formatting) are extracted to `lib/` to avoid duplication without coupling handlers.

**Revisit when**: Handler count exceeds ~15 and the overhead of `template.yaml` maintenance becomes painful, or if cold start latency on infrequently-called functions becomes a user-visible problem. Bundling related operations (e.g., all spell operations) into one handler with internal routing is the likely solution.

---

## ADR-005 · Auth: bcrypt owner hash in DynamoDB + DM hash in SSM

**Decision**: Each character has its own bcrypt password hash stored in DynamoDB. A single DM password hash is stored in SSM Parameter Store and injected as a Lambda env var at deploy time.

**Rationale**: No auth service to maintain. Passwords are never stored in plaintext anywhere. DM hash in SSM keeps it out of source control and out of DynamoDB, with IAM-controlled access.

**Revisit when**: The app expands beyond a single group (i.e., multiple campaigns, multiple DMs). At that point a proper auth layer (Cognito, or a JWT-based system) is warranted. Current model does not support user accounts or session revocation.

---

## ADR-006 · sessionStorage for client-side session state

**Decision**: DM password, per-character passwords, and palette cache are stored in `sessionStorage`. Keys: `dnd_dm_password`, `dnd_palette_${slug}`.

**Rationale**: Sessions clear automatically on tab close — appropriate for a shared/public device scenario. No server-side session management needed.

**Revisit when**: Users report frustration at re-entering passwords frequently, or if the app moves to a multi-user/account model. `localStorage` with an expiry, or a real session token, would be the next step.

---

## ADR-007 · Password sent via request header

**Decision**: Character passwords are sent to the API via the `x-character-password` custom HTTP header, not in the request body or URL.

**Rationale**: Keeps password out of server logs (URL params are often logged), and separates auth credentials from character data in the request structure.

**Revisit when**: Moving to a token-based auth model (see ADR-005), at which point the header would carry a Bearer token instead.

---

## ADR-008 · S3 for portrait storage, direct upload via presigned URL

**Decision**: Character portraits are stored in S3 (`hunkz-dnd-portraits`). The frontend requests a presigned PUT URL from the `portrait` Lambda, then uploads directly from the browser to S3 — no binary data passes through Lambda.

**Rationale**: Keeps Lambda payload sizes small (Lambda has a 6MB response limit). Direct S3 upload is faster for the user and cheaper (no Lambda execution time for the upload).

**Revisit when**: If image processing (resize, format conversion) is needed, a Lambda triggered by S3 events is the natural addition — not piping through the API.

---

## ADR-009 · Frontend hosted on S3 static website

**Decision**: Production frontend is a Vite-built SPA synced to S3 (`hunkz-dnd`) as a static website. No CDN (CloudFront) currently.

**Rationale**: Simplest possible deployment. Cost is effectively zero at current traffic.

**Revisit when**: Latency from a single region becomes noticeable for users, HTTPS is required on a custom domain (S3 static hosting doesn't support it natively), or the app goes public. CloudFront + ACM is the standard next step.

---

## ADR-010 · parseModInt for numeric item modifier values

**Decision**: Item modifier values use `parseModInt` (`/^[+-]?\d+$/.test(v)`) rather than `parseInt`. Anything that doesn't match a bare integer (including dice notation like "1d8") returns `NaN` and is ignored.

**Rationale**: `parseInt("1d8")` returns `1`, silently applying a spurious +1 modifier. Strict validation prevents data entry errors from corrupting calculated stats.

**Revisit when**: If dice-notation modifiers become a desired feature (e.g., "+1d4 fire damage"), a proper dice expression parser would replace this check — not a relaxed regex.

---

## ADR-011 · Real-time sync: adaptive polling + optimistic session writes

**Context**: Story 05 (DM Dashboard) requires that changes to session state (HP, spell slots, conditions, concentration, inspiration) made by a player on their sheet or by the DM on the dashboard appear on all connected views without a manual refresh. Four options were evaluated:

1. **API Gateway WebSocket API** — native to SAM (`AWS::Serverless::HttpApi` does not support WebSocket; a separate `AWS::ApiGatewayV2::Api` with `ProtocolType: WEBSOCKET` is required). Requires a DynamoDB connections table to track active connection IDs, `$connect` / `$disconnect` / `$default` Lambda handlers, and `@connections` API calls to push messages. Cold starts on the connection handlers add latency on session open. Significant operational surface for a 3-player group.

2. **Server-Sent Events (SSE)** — poor fit. Lambda executes synchronously and returns a response; it cannot hold a connection open for streaming. Would require a long-polling shim or a persistent compute layer (e.g., an EC2 instance or ECS task), both of which contradict the serverless architecture.

3. **AWS AppSync GraphQL subscriptions** — purpose-built for real-time data. Clean DX. However, it is an entirely new service with its own IAM policies, schema language, resolver configuration, and pricing model. The operational and cognitive cost is disproportionate to a 3-player use case. Worth revisiting if the app expands to multiple campaigns.

4. **Short-interval polling** — each connected client calls existing GET endpoints on a short cadence. No new AWS services, no connection management, no cold start concerns, works correctly through Lambda's stateless model. The implementation can adapt the interval by tab state and trigger immediate refetches after successful writes, which reduces perceived latency without introducing push infrastructure.

**Decision**: Adopt adaptive polling rather than WebSockets. Player sheets poll `GET /characters/{slug}`. The DM dashboard polls both `GET /dm/party` and `GET /initiative`. Poll cadence is:

- `1000ms` while the tab is visible and focused
- `5000ms` while the tab is backgrounded or unfocused

Both pages use a self-scheduling `setTimeout` loop rather than a fixed `setInterval` so the cadence can change immediately on `visibilitychange`, `focus`, or `blur`.

**Implementation detail**: Polling is implemented in the frontend page components, not in the backend. Each page tracks outstanding requests and skips background polls while a fetch is already in flight, unless a forced sync is explicitly requested. This avoids overlapping request storms and stale-response races.

**Code location note**: The shared polling and optimistic-sync primitives live in `src/lib/liveSync.js`. Feature-specific orchestration still lives in the page/container files, but new realtime behavior should start from the shared utilities rather than re-implementing debounce, polling cadence, or immediate-refetch timers ad hoc.

**Authoritative sync model**:

- The server remains the source of truth for all session fields.
- Both the DM dashboard and character page perform optimistic UI updates for "live" fields such as `hpCurrent`, `tempHP`, `conditions`, `concentration`, `inspiration`, `spellSlots`, and `exhaustionLevel`.
- After a successful session write, the page schedules an immediate background refetch instead of waiting for the next polling tick.
- Incoming polled data is merged carefully: if a field has a pending optimistic expectation, the local optimistic value is preserved until the server payload matches it. Once the server echoes the expected value, the optimistic marker is cleared and normal sync resumes.

**Debounce / batching rule**:

- Repeated HP increment/decrement actions use optimistic local state plus a stable debounced flush.
- The UI updates on every click or hold-repeat tick.
- Network writes are collapsed to the latest target HP after a short debounce window rather than issuing one request per tick.
- The outgoing request sends the latest clamped absolute value, not "server base + last delta", to avoid stale-base race conditions.
- If further clicks happen while a write is in flight, another flush is queued after the current request completes.

**Rationale**: The real-time requirement is "appears without a manual refresh." Adaptive 1s/5s polling satisfies this with acceptable latency and very low AWS cost, while avoiding the operational surface of WebSockets, SSE, or AppSync. Immediate post-write refetching and optimistic local state remove most of the perceived lag without requiring push infrastructure.

**Operational note**: This is intentionally conservative architecture. A future model or agent working in this codebase should prefer preserving the polling + optimistic-write contract unless there is an explicit decision to introduce push infrastructure. Changes to polling cadence, write coalescing, or incoming merge logic can easily create subtle race conditions between the DM dashboard and character page.

**Revisit when**: Player count exceeds ~20 concurrent sessions, polling traffic becomes material, or the product expands to a public SaaS model where sub-second push latency is a product requirement. At that point, AppSync subscriptions or an API Gateway WebSocket API can replace polling, but only with explicit connection-subscription design and a retained server-authoritative reconciliation path.

**Amendment (Story 35, 2026-07-17) — consolidated polling endpoint + 30s hidden-tab interval**:

Polling traffic became material sooner than "Revisit when" anticipated — idle browser tabs polling 4–5 separate endpoints at 1s pushed the AWS account to 85% of the free-tier request quota well before 20 concurrent sessions. Two changes were made without abandoning the polling model:

- **Consolidated endpoint**: `GET /session-state` replaces the DM dashboard's 5-endpoint poll (`GET /dm/party`, `/initiative`, `/npc-combat`, `/roll-history`, `/maps`) and the player session mode's 4-endpoint poll (`GET /characters/{slug}`, `/party/status`, `/initiative/public`, `/maps`) with a single request per tick. The handler (`backend/src/handlers/getSessionState.js`) branches on DM-vs-public auth from the same `x-character-password` header used elsewhere, does one `BatchGetItem` for the sentinel records and one `BatchGetItem` for party-member characters (keyed off the party roster) — two DynamoDB round trips max, versus five separate Lambda invocations before. `DmDashboardPage.jsx` and `CharacterModePage.jsx` were updated to use a single `useAdaptivePolling` instance calling `getSessionState` and fan the response out to their existing state setters; `useQueuedRefresh`/optimistic-merge semantics are unchanged. The old per-resource endpoints are **not removed** — non-polling one-shot callers (e.g. `MapLibraryPage`) keep using them, and they remain deprecated-for-polling rather than deleted.
- **Hidden-tab interval raised from 5s to 30s**: `BACKGROUND_POLL_MS` in `src/lib/liveSync.js` moved from `5000` to `30000`. A backgrounded/unfocused tab now polls 6x less often; the 1000ms focused/visible cadence is unchanged.

**Amendment (Story 35b, 2026-07-17) — remaining pollers consolidated**:

`CharacterPage.jsx` (the classic, non-session-mode sheet at `/characters/:slug`) and `MapViewerPage.jsx` (`/map-view`) were the two polling surfaces Story 35 left out of scope. Both now poll `GET /session-state` too:

- `CharacterPage.jsx` replaced its two `useAdaptivePolling` instances (`getCharacter` + `getMapLibrary`) with one, calling `getSessionState({ slug, dmPassword: <cached credential> })` and fanning `response.character` / `response.mapLibrary` out to existing state. The cached credential is read fresh from `sessionStorage` on every tick (DM password takes precedence over the per-character owner password, mirroring the unlock precedence already in `CharacterSheet.jsx`), so the owner/DM variant — which includes `playerNotes` — kicks in automatically as soon as the sheet is unlocked mid-session, without a remount.
- `MapViewerPage.jsx` replaced its `getMapLibrary` poll with the public (no-credential) variant of `getSessionState()`, using `response.mapLibrary`.
- No backend change was needed: `getSessionState.js`'s `?slug=` path already ran `applyPlayerNotesVisibility()` (shared with `get.js`) against the supplied `x-character-password` header, so owner/DM callers already received full `playerNotes` and unauthenticated callers already had them stripped — this was verified by existing handler tests before Story 35b started.

Every polled page in the app (`/dm`, `/characters/:slug/session|profile`, `/characters/:slug`, `/map-view`) now issues exactly one HTTP request per poll tick. The old per-resource endpoints (`getCharacter`, `getMapLibrary`, etc.) remain in `api.js`, still used by true one-shot fetch surfaces (`MapLibraryPage.jsx`, NPC library, counter wheels) — deprecated for polling use only, not removed.

---

## ADR-012 · Public map library endpoint

**Decision**: `GET /maps` returns the full map library (all map names, S3 URLs, and `activeMapId`) to unauthenticated callers. Map images stored under `maps/*` in S3 are also public objects.

**Rationale**: Players need to poll the active map without authenticating — the character sheet header is visible without a password and the map should follow the same no-auth pattern. Requiring auth for the map poll would add a login gate for a read-only visual reference. At the current trust model (one small friend group, no sensitive data in map filenames), this is an acceptable tradeoff.

**Known exposure**: An unauthenticated caller can enumerate all map names and image URLs in the library. If the DM uses map names that spoil plot details, those names are technically readable by anyone who knows the API URL. At current scale this is not a meaningful risk.

**Revisit when**: The app is commercialised, opened to multiple campaigns/groups, or the DM starts using map names that carry plot-sensitive information. At that point, `GET /maps` should require DM auth for the full library list and return only `{ activeMapId, activeMapUrl, activeMapName }` for unauthenticated callers — the minimal payload players actually need.

---

## ADR-013 · 5e rule tables as frontend constants

**Decision**: Immutable official 5e rule tables (XP thresholds by level, Hit Die size by class, proficiency bonus by level, etc.) are stored as named exported constants in `src/features/characterSheet/constants.js`. No backend storage.

**Rationale**: These values are fixed by the 5e ruleset and identical across all characters. Storing them in DynamoDB would add no value and waste a read unit per fetch. Keeping them alongside `BLANK_CHARACTER` and `MOD_ATTRIBUTES` in `constants.js` centralizes all game-rule constants in one file, which is already the established pattern for `CONDITIONS`, `SPELL_LEVEL_LABELS`, `ARMOR_OPTIONS`, etc.

**Naming convention**: Use the most descriptive name that makes the source clear — e.g., `XP_THRESHOLDS` (indexed by level, 1–20), `HIT_DIE_BY_CLASS` (keyed by the string values in `CLASS_OPTIONS`).

**Revisit when**: A future feature requires server-side rule evaluation (e.g., a Lambda computing encounter difficulty). At that point, rule tables would move to a shared JSON in `backend/src/lib/` and the frontend would import from there or from a shared package. Not warranted at current scale.

---

## ADR-014 · CSS architecture: variable schema, file map, and inline-style rules

**Context**: Migrated from ~900 inline style objects across all components to a static CSS class system. See `design/architecture/css-migration-checklist.md` for the per-file migration record.

**CSS custom property schema** (set at each component root, inherited by children):

| Variable | Palette key |
|---|---|
| `--pal-bg` | `bg` |
| `--pal-surface` | `surface` |
| `--pal-surface-solid` | `surfaceSolid` |
| `--pal-border` | `border` |
| `--pal-accent` | `accent` |
| `--pal-accent-bright` | `accentBright` |
| `--pal-accent-dim` | `accentDim` |
| `--pal-text` | `text` |
| `--pal-text-body` | `textBody` |
| `--pal-text-muted` | `textMuted` |
| `--pal-glow-1` | `glow1` |
| `--pal-glow-2` | `glow2` |
| `--pal-gem` | `gem` |
| `--pal-gem-low` | `gemLow` |
| `--font-display` | `fontDisplay` |
| `--font-body` | `fontBody` |
| `--font-ui` | `fontUI` |

Per-card palette scoping works: each `.card[style]` root can set different `--pal-*` values; CSS inheritance means all children inside that card use that card's palette without any JS.

**CSS file map**:

| File | Scope |
|---|---|
| `src/index.css` | Global reset, body/html, scrollbar, spinner, grid utilities |
| `src/shared.css` | `:root` variable defaults + all shared utility classes |
| `src/features/characterSheet/characterSheet.css` | Character sheet view mode, edit mode, item editor |
| `src/features/dmDashboard/dashboard.css` | Dashboard layout, keyframes, animation utility classes |
| `src/features/dmDashboard/characterCard.css` | DM party card and its sub-components |
| `src/features/dmDashboard/npcCombat.css` | NPC combat section + initiative tracker |
| `src/features/dmDashboard/mapLibrary.css` | Map library modal |
| `src/components/diceRoller.css` | Shared between `DiceRoller` and `DmDiceRoller`; all dice keyframes |
| `src/pages/pages.css` | Shared page-level structural classes |

**What stays inline** (rule for all future work):
- HP / resource bar fill widths (`width: "${pct}%"`)
- Ghost trail positions and widths (absolutely positioned overlays)
- Per-row computed colors (threshold-based HP tone, active-turn glow)
- Condition chip colors via `--pill-color` custom property
- Toggle switch thumb position (boolean state → pixel value)
- `onFocus`/`onBlur` border color when the hover color is a runtime palette value

**What must not stay inline**:
- Any style that is identical across three or more elements → CSS class
- Hover / focus states → CSS `:hover` / `:focus` rules
- Structural layout (padding, gap, border-radius, display, flex) → CSS class or component CSS file
- Animation keyframes → CSS file (never a `<style>` tag injection)

**Revisit when**: Per-component CSS files accumulate enough one-off rules that a CSS-in-JS scoping strategy (CSS Modules, vanilla-extract) would reduce specificity conflicts. Not warranted at current scale.

---

## ADR-015 · Typed (non-roll) entries in the shared roll-history feed

**Context**: Story 30 (Counter Wheels) requires a creation-only "administrative" note (`◷ [name] — N segments`, no numeric total) to appear in the shared `roll-history` feed alongside dice rolls. The existing feed is implicitly single-shaped: every row is a dice roll. Both write paths (`postCharacterRoll.js`, `postDmRoll.js`) hard-require `exprLabel`, a finite numeric `total`, and a non-empty numeric `rollValues` array; `RollHistoryRow` always renders a numeric total. A wheel note has none of these.

**Decision**: Introduce an explicit `type` discriminator on roll-history events. Existing dice events are `type: "roll"` (treated as the implicit default when `type` is absent — no migration of stored rows needed). New non-roll entries carry `type: "wheel"` (and the pattern extends to future administrative note types). The storage layer (`appendRollHistoryEvent`) already persists arbitrary event objects without schema enforcement, so no change is needed there — the discriminator is enforced at the edges:

- **Write**: do NOT route wheel notes through `postCharacterRoll`/`postDmRoll` (their validation rejects total-less payloads). The wheel creation write appends the note as part of the same DM-auth write that creates the wheel, or via a dedicated minimal append. A wheel event record omits `total`/`rollValues` and instead carries `{ type: "wheel", name, segments, createdAt, id }`.
- **Render**: `RollHistoryRow` branches on `entry.type`. `"wheel"` (and any non-`"roll"` type) renders the note layout — clock glyph + italic name + muted segment count, no numeric total, no crit/fumble badges. `"roll"`/absent renders the existing dice layout unchanged.

**Constraint**: Keep the discriminator branch shallow — one note layout variant, not a plugin system. The feed is a flat list of mostly-rolls with occasional notes, not a generic event timeline.

**Revisit when**: A third+ entry type is added, or notes need their own filtering/retention separate from rolls. At that point a small per-type render registry replaces the inline branch.

---

## ADR-016 · `counter-wheels` sentinel for campaign-scoped DM scratch state

**Context**: Story 30 needs DM-only counter wheels (progress clocks) that persist across refreshes and survive "End Combat" (unlike `initiative` / `npc-combat`, which are combat-scoped and cleared). This is the first piece of DM state that is campaign-scoped scratch data — not tied to a character, not tied to a combat encounter.

**Decision**: Store wheels in a new `slug: "counter-wheels"` sentinel item, following the established sentinel pattern (ADR-003): add `COUNTER_WHEELS_SLUG` to `specialItems.js` (and to `RESERVED_CHARACTER_SLUGS` so it is filtered from `list.js` / `dmParty.js`), add `getCounterWheelsState()` / `saveCounterWheelsState()` / `normalizeCounterWheelsRecord()` to `specialRecords.js`, and expose `GET /counter-wheels` + `PUT /counter-wheels` (both DM-auth, per ADR-004 one-Lambda-per-op) modeled on the `npc-library` handlers. Stored shape: `{ wheels: [{ id, name, segments, filledCount }] }` where `filledCount: number` (0..segments) — a single count, NOT a boolean array (resolved fill-semantics question: Blades-classic fill-to-here). `PUT` is a full-array replacement (same contract as `putNpcLibrary`).

**Critical constraint**: The `counter-wheels` sentinel MUST NOT be cleared by any "End Combat" / encounter-teardown path. Whatever code clears `initiative` and `npc-combat` must not touch this slug.

**Revisit when**: Multiple campaigns/groups exist (ADR-005 trigger) — at that point campaign-scoped sentinels need a campaign partition key rather than a single fixed slug.

---

## ADR-017 · Dedicated NPC-portrait presign endpoint; per-purpose presign handlers over a shared one

**Context**: Story 31 (NPC Library with HP + Portraits) needs NPC creature portraits uploaded to S3. Two existing presign handlers were candidates to reuse: `portrait.js` (character portraits, requires a character `slug` + owner/DM auth, `portraits/` prefix) and `mapPresign.js` (DM-auth, `maps/` prefix, 50MB cap, accepts `application/pdf`). Neither fits: NPC portraits are DM-owned (not per-character), are image-only (no PDF), and warrant a tighter size cap than a full-page battle map.

**Decision**: Add a dedicated `POST /npc-library/portraits/presign` handler (`npcPortraitPresign.js`), cloned from `mapPresign.js` but with: an `npc-portraits/` S3 key prefix, image-only `contentType` validation (reject anything not `image/*`), and a 5MB declared-size cap enforced at the Lambda. DM auth via the `x-character-password` header (ADR-005/ADR-007). Reuses the existing `hunkz-dnd-portraits` bucket — no new bucket. This follows ADR-004 (one Lambda per operation) and ADR-008 (direct S3 upload via presigned PUT, no binary through Lambda). **This shipped as part of Story 31** — `npcPortraitPresign.js`, the `npc-portraits/` bucket-policy grant, and `api.js`'s `presignNpcPortrait()` are all real and in use from the Enemies Gallery library editor.

**Rationale**: Per-purpose presign handlers keep each one's validation honest to its actual constraints (auth model, prefix, cap, content types). A single shared presign that branches on a `purpose` param would accumulate conditional validation and blur ownership semantics. At the current handler count the extra Lambda is cheap.

**Also recorded here — sentinel-shape expansion is additive and backwards-compatible**: Story 31 expands the existing `npc-library` sentinel (ADR-003) template shape from `{ id, name, abilities, updatedAt }` to add `hpMax?` and `portraitUrl?`. The rule: when widening a sentinel shape, the corresponding `normalize*Record` function in `specialRecords.js` MUST be updated in the same change — it projects each record field-by-field, so any new field is silently dropped on read until the normalizer passes it through. Older records without the new fields normalize to `null`/absent and are valid (no migration).

**Revisit when**: If image processing (resize/thumbnail generation) is wanted, an S3-event-triggered Lambda is the path (per ADR-008), not piping through the presign endpoint. If a third image-upload purpose appears with the same DM-auth + image-only + small-cap profile, consolidating the NPC and that purpose into one handler may be worth it — but not before.

---

## ADR-018 · Battle-map token polish (Story 29b): reuses ADR-017's NPC-portrait presign, per-map `tokenScale`, shared `TokenChip`

**Context**: Story 29 shipped the token layer with a `tokenScale` field and a shared `TokenChip` component but no NPC portraits. Story 31 separately shipped the dedicated NPC-portrait presign path (ADR-017), used from the Enemies Gallery library editor. Story 29b adds portrait upload directly on the *live combat tracker card* (before an NPC is ever saved to the library), a calibration control for `tokenScale`, and token-layer motion polish.

**Decisions**:

1. **NPC portrait upload on the combat card reuses ADR-017's existing `/npc-library/portraits/presign` endpoint and `npc-portraits/` prefix — not a new endpoint and not the `maps/` prefix.** An earlier draft of this story planned to reuse `mapPresign.js`/`maps/` instead, on the assumption that Story 31 had not yet built a dedicated presign path; by the time 29b was implemented Story 31 had already shipped ADR-017 in full (bucket policy included), so 29b's combat-card upload calls the existing `presignNpcPortrait()` directly. The combat-card upload (`NpcCardPortrait` in `NpcCombatSection.jsx`) reuses the existing `NpcThumb` component (portrait-or-initials, `onError` fallback) rather than a parallel render implementation — the upload affordance is a camera-overlay wrapper composed *around* `NpcThumb`, not a replacement for it.

2. **Per-map token scale is a single `tokenScale` number on each `map-library` map entry**, clamped 0.5–2.5, default 1.0, already enforced in `normalizeMapLibraryRecord`. New in this story: `PATCH /maps/{mapId}/calibration` (`patchMapCalibration.js`, cloned from `patchMap.js`'s read-modify-write pattern, preserves `activeMapView`) and a ⚙ gear-popover UI (`CalibrationPopover.jsx`) in the DM map panel header, debounced 600ms.

3. **One shared `TokenChip`** (`src/features/dmDashboard/battleMode/BattleModeController.jsx`) renders both DM and player tokens and both PC and NPC portraits, branching on `isDm`/`isOwnToken`. Player-only poll-move animation (`transform`/translate-based, 280ms, mount-gated so it never fires on first paint) is gated inside this shared component, not forked into a second component. DM-only long-press remove uses Pointer Events (not mouse events) so it works identically for mouse, touch, and stylus.

4. **`prefers-reduced-motion: reduce`** — a single authoritative block at the bottom of `battleMode.css` covers every motion point in the token layer (drop bounce, hover-expand, HP card slide-in, poll-move, tray collapse, long-press charge ring). Strategy is replace-don't-merely-delete: transitions snap to instant end-state rather than being removed outright where the motion carries meaning (e.g. long-press charge becomes a static "Hold to remove" label). The upload progress ring in `npcCombat.css` is deliberately exempt — it reflects genuine upload progress, not decoration.

**Revisit when**: Per-token scale, grid snapping, or token image processing is wanted, or a second story needs the same "upload before it has a permanent home" pattern this establishes for NPC portraits.

**Story 44 update (2026-07-20) — per-token scale (the first "Revisit when" trigger above, resolved additively)**: Per-token resize ships as an additive `scale: number` field on each object in a map's `tokens[]`, not a new sentinel or endpoint. It reuses this ADR's shared `TokenChip` (branching on `isDm`/NPC-only for the `⤢ Resize` control) and the existing `patchMapTokens` write path (debounced 300ms in `MapPanel.jsx`, mirroring `patchMapCalibration`'s debounce). Rendering stacks a new per-chip `--token-size-mult` CSS var *multiplicatively* onto this story's global `--token-scale-multiplier` inside the same `transform: scale(calc(...))` on `.token-chip` — the two are orthogonal (global calibration vs. per-token size). Clamp is `[0.5, 3.0]` (distinct from calibration's `[0.5, 2.5]`), enforced in `patchMapTokens.js` on write and defaulted to `1.0` in `normalizeMapLibraryRecord`'s per-token map on read (per ADR-017's widen-the-normalizer-in-the-same-change rule). No migration (absent = 1.0), no new AWS resource. Grid snapping and token image processing remain deferred. See `design/stories/44-per-token-resize.md`.

---

## ADR-019 · WebSocket nudge channel: push a signal, not the payload

**Context**: Story 36. AWS free-tier request quota was at 85% under 1s polling (ADR-011); a true push transport was needed to both cut request volume and shrink latency below one poll tick, without taking on the schema/ordering/replay complexity of streaming actual state deltas over a socket (or a managed service like AppSync).

**Decision**: The WebSocket carries exactly one message shape, `{"type":"changed"}`, and nothing else. Every session-write handler (`session.js`, `initiative.js` PUT, `putNpcCombat.js`, `putCounterWheels.js`, `postCharacterRoll.js`, `postDmRoll.js`, `patchMapTokens.js`, `putMapActive.js`, `patchMapCalibration.js`, `dmNotes.js`, `moveMapToken.js`) calls a shared `notifySessionChanged()` (`backend/src/lib/broadcast.js`) after a successful write, which fans the nudge out to every open connection via `PostToConnectionCommand`. Connected clients react by immediately calling the exact same `GET /session-state` (Story 35) they already poll — there is no separate "apply this delta" code path, no client-side merge logic, and no risk of a client's local state drifting from a socket message arriving out of order relative to a poll response, because both paths converge on the same read.

**Consequences**:
- The socket is a *cache-invalidation signal*, not a data channel. If a client misses a nudge (dropped connection, brief network blip), the worst case is one extra poll tick of staleness before the connection recovers or the 30s safety-net poll fires — never incorrect state, never a stuck/partial UI.
- No new client-side reconciliation logic was needed: `queueRefresh(0)`/`fetchSessionState({background:true, force:true})` already existed from Story 35's polling and are reused verbatim as the nudge handler.
- Connection bookkeeping lives in a dedicated `WsConnectionsTable` (DynamoDB, TTL 12h) rather than a sentinel row on `CharactersTable` — connection churn (dozens of connect/disconnect events per session) is a different access pattern from character/session data and benefits from free TTL cleanup rather than manual pruning logic (`$disconnect` deletion is best-effort; TTL is the real backstop).
- `notifySessionChanged()` is wrapped so it can never throw or meaningfully block the write path it's called from: a missing `WS_API_ENDPOINT`/`WS_CONNECTIONS_TABLE`, a `410 Gone` connection, or the connections scan itself failing are all swallowed internally. A broadcast failure must never turn into a write failure.
- IAM for `execute-api:ManageConnections` and CRUD on `WsConnectionsTable` is granted only to the specific write-handler Lambdas that call `broadcast.js` — not globally — keeping the blast radius of a compromised handler unchanged from before this story.

**Revisit when**: A feature genuinely needs sub-poll-tick *data* (not just a signal) — e.g. cursor-position streaming for a shared pointer, or live typing indicators. At that point a second, purpose-built message type is the right extension point; do not overload `{"type":"changed"}` to also carry a payload.

**Story 36b update**: The socket now carries a second, equally minimal message shape — `{"type":"reload"}` — for the stale-client auto-refresh feature. This does not weaken the "signal, not payload" principle above: `{"type":"reload"}` is still a signal (a direct instruction, "reload now"), not data. `notifySessionChanged()` was generalized to take an optional payload (defaulting to `{"type":"changed"}`, so every existing call site is unchanged) specifically so this second signal type could reuse the exact same connection-scan/post/prune machinery rather than duplicating it. The `{"type":"reload"}` message is sent by a new standalone Lambda, `broadcastReload.js` (no HTTP route — invoked directly via `aws lambda invoke` from `deploy.sh`, after the frontend S3 sync and the `app-meta` version-stamp write both complete), not by any session-write handler. See `src/lib/staleClient.js` for the receiving end (version-compare + reload-broadcast handling share one safe-reload code path).

---

## ADR-020 · One shared in-card drawer for DM party-card Tier-3 reference; loadout rides the existing polled payload

**Context**: Stories 50 (Capability Rail + Codex) and 51 (Loadout drawer) both add on-demand reference detail to the DM party card, and both design briefs assume they share a container — but they describe *different* containers. Brief 50 says the codex is the container and 51 appends two stacked sections to it (`Skills → Abilities → Spells → Weapons → Inventory`); brief 51 says 50 has no drawer at all and may append a fourth tab to 51's tab strip. Both also independently claim to render Spells. Left unresolved, whichever story ships second rewrites the first one's container.

Separately, the card already has a third expanding region — `DmNotesStrip` — with its own local `open` state, and brief 51 proposes folding it into a shared footer band.

**Decisions**:

1. **One drawer component per card, not one per feature.** `src/features/dmDashboard/characterCard/CardDrawer.jsx` owns the single bounded, internally-scrolling expand region below the card body, and every Tier-3 section that opens into it (notes, codex clusters, loadout tabs). Its open state is a single `openSection: null | "notes" | "skills" | "abilities" | "spells" | "weapons" | "items"` string, which makes intra-card mutual exclusion (both briefs require it) a property of the data type rather than coordination logic between three sibling components. `DmNotesStrip` becomes a section renderer inside it and stops owning `open`.

2. **Section-vs-tab is a per-section render choice, not a container property.** The container provides the band, the bounded height (`min(48vh, 420px)`), the internal scroll, and the open/close motion. Whether a given `openSection` renders as a stacked list or as one pane of a tab strip is decided inside that section's renderer. This is what lets the two stories disagree about presentation without either one restructuring the container.

3. **Dashboard-wide single-open accordion lives in `DmDashboardPage.jsx`**, as an `openDrawerSlug` state plus an `onDrawerOpenChange(slug, section)` callback on `CharacterCard` — extending the existing `openCardPopoverSlug`/`onPopoverOpenChange` pattern rather than inventing a second coordination mechanism. Scroll-anchoring on open reuses the existing `cardItemRefs` slug→node map.

4. **Spells render in exactly one place inside the drawer.** Whichever pass lands first owns the spells section; the second consumes it. `spells` is `string[]` free text with no level/school metadata, so there is nothing to differentiate two treatments anyway.

5. **DM loadout data rides the existing consolidated poll, not an on-demand fetch.** `weapons` and `equipment` are added to `DM_PARTY_FIELDS` / `DM_PARTY_PROJECTION_EXPRESSION` in `backend/src/lib/partyProjection.js`, which serves both `dmParty.js` and the `getSessionState.js` DM variant (ADR-011 Story 35 amendment). This is **DynamoDB-cost-neutral**: both the `ScanCommand` and the `BatchGetItem` are already charged on full item size, so a wider projection changes response bytes only, not RCUs — and it avoids a second fetch path, a per-drawer loading state, and the staleness that would defeat brief 51's live-value-flash requirement. `PLAYER_VISIBLE_FIELDS` is **not** widened — loadout must not leak to players via `GET /party/status`.

**Constraints**:
- Drawer content must be derived once on open and not re-derived per poll tick. `DmNotesStrip`'s existing `if (!open) return;` sync-deferral is the established precedent to copy.
- No DOM measurement for chip overflow. The dashboard applies a user text scale (`useTextScale`, CSS `zoom`) and cards re-render on every poll tick, so pixel measurement is both unreliable and expensive. Overflow budgets are computed from label lengths against the fixed, small catalogs in `talentCatalog.js`.
- Cross-slice import of `src/features/characterSheet/talentCatalog.js` from `src/features/dmDashboard/` is accepted — `DmDashboardPage.jsx` already imports `PALETTES` from `../features/characterSheet/theme`, so this direction is established, not new (ADR-002).

**Revisit when**: A fourth Tier-3 section wants the drawer and the `openSection` union stops being self-explanatory, or party size / per-character item counts grow enough that the widened poll payload becomes material (rough trigger: party > ~10, or > ~40 items/character with long descriptions). At that point the loadout section moves to an on-demand fetch on drawer open and the projection narrows back.

---

## ADR-021 · Token chip DOM: nested transform wrappers (prerequisite for Stories 52–55)

**Context**: Stories 52–55 all animate the map token. Their briefs assume a DOM hierarchy of `L0 .token-pos` → `.tk-lunge` (55) → `.tk-hit` (52/54) → `.token-chip`. **That hierarchy does not exist.** Today `.token-chip` is a single flat element that simultaneously carries: absolute position (`--token-x`/`--token-y`), the `translate(-50%,-50%)` centring offset, the Story 29b calibration scale (`--token-scale-multiplier`), the Story 44 per-token scale (`--token-size-mult`), the Story 34 drag scale (`--token-drag-scale`), and the Story 45 counter-rotation — all composed into **one** `transform` declaration (`src/features/dmDashboard/battleMode.css:35`), which is then re-stated verbatim in five more places (poll-move transition, `tkTokenBounce` keyframes ×3 stops, the removal keyframe). It also owns every pointer handler and `z-index: 10`.

Any keyframe that animates `transform` on `.token-chip` silently drops position, calibration scale, per-token scale, and counter-rotation. This is the single largest implementation hazard in the cluster and it is shared by three of the four stories.

**Decision**: Before any of Stories 52–55 ship, split `.token-chip` into a wrapper chain, each layer owning exactly one transform concern:

```
.token-pos     position + centring + poll-move transition + drop bounce + drag translate   (L0)
 └ .tk-lunge   translate() ONLY — Story 55 melee lunge. Outside counter-rotation, so the
   │           lunge vector is in map space and points correctly on a rotated map.
   └ .tk-hit   scale() ONLY — Story 52 impact recoil, Story 54 NPC vanish.
     └ .token-chip   counter-rotation + --token-scale-multiplier + --token-size-mult +
                     --token-drag-scale. Keeps all pointer handlers, hover card, badges.
```

`.tk-lunge` and `.tk-hit` are permanent structural elements (bare `<div>`s, no transform/transition/`will-change` at rest) — they cannot be conditionally inserted without remounting the chip and losing hover/drag state. All effect overlays (`.tk-wash`, `.tk-wound`, `.tk-shock`, `.tk-veil-*`, `.tk-secret-mark`, condition badges) are `pointer-events: none`, conditionally rendered, and never present at `opacity: 0`.

**Constraints**:
- `--token-scale-multiplier` is set on `.token-layer` by `MapViewer.jsx` and inherits; it must keep landing on `.token-chip`, not on a new wrapper, or calibration silently applies twice.
- Do **not** create `tokens.css`. The briefs reference it; the real file is `src/features/dmDashboard/battleMode.css`. All new symbology classes, keyframes, family colour tokens, size bands, and the single authoritative `prefers-reduced-motion` block extend that file (ADR-014).
- The repo-wide rule from Story 45 stands: never use the CSS `rotate` property, only `transform`.
- Existing regression specs `src/features/dmDashboard/battleMode/TokenChip.test.jsx` must pass unchanged across the restructure — they are the safety net for it.

**Rationale**: Doing this split once, as an isolated no-visual-change refactor, is far cheaper than doing it three times inside three feature branches that each need it. Doing it inside Story 52 and then re-cutting it for Story 55 is the predictable failure.

**Revisit when**: A fifth transform concern appears. At that point the chain is deep enough to warrant a single `TokenChipFrame` component owning the wrapper stack rather than inline JSX.

---

## ADR-022 · Token effect state rides existing records as derived server stamps — no new sentinel, no new endpoint

**Context**: Stories 52 and 55 need cross-viewer-synchronised "this entity was just damaged, by whom" state. Options considered: a new `attack-events` sentinel; a client-side inference from polled HP deltas; extra fields on the existing character / `npc-combat` records.

**Decision**: Damage/attack state is written as additional attributes on records that already exist, in the **same write** as the HP change:

| Field | Written on | By |
|---|---|---|
| `lastDamagedAt` (ISO, server clock) | character item / each `npc-combat` NPC object | `session.js`, `putNpcCombat.js` |
| `lastDamageAmount` (number) | same | same |
| `lastDamageFrom` (`{type,sourceId}` or `null`) | same | same |
| `turnStartedAt` (ISO, server clock) | `initiative` sentinel | `initiative.js` (PUT) |

Rejected alternatives and why:
- **A separate `attack-events` sentinel** — two DynamoDB items cannot be updated in one non-transactional call, so the damage stamp and the attacker ref could land in *different* poll payloads. The 60ms two-beat choreography cannot survive that. Also a second write on the hot damage path.
- **Client-side inference of the attacker from `activeTurnIndex`** — provably wrong on the player's map, because `buildPublicInitiativePayload()` strips hidden entries, so a player's `entries` array does not index-align with the DM's. Also racy on the DM's own map (apply damage + tap Next Turn can coalesce into one payload). A wrong tracer actively misinforms about positioning; worse than no tracer.
- **Client-side inference of "HP went down" from poll deltas** — every tab-return and map switch would replay old impacts, and no two clients would agree.

**Two consequences that make this cheap**:

1. **Every PC HP write in the app already funnels through `PATCH /characters/{slug}/session`** — the DM card's debounced HP flush, `commitPartySessionUpdates`, the dice roller's "Apply to…", the `DamageHealModal`, the ±1 stepper, and the player's own sheet. Stamping in `session.js` therefore covers 100% of PC damage paths with **zero client changes**. `session.js` already does a `GetCommand` for the character before writing, so the previous `hpCurrent` is in hand for free. Widening that to a `BatchGetCommand` for `{slug, "initiative"}` resolves the attacker in the same round trip — no added latency.
2. **Every NPC HP write funnels through `PUT /npc-combat`**. That handler is currently a blind full-array replace with no read; it gains one `getNpcCombatState()` (already exported from `specialRecords.js`) to diff per-NPC `hpCurrent`, plus the initiative read for the attacker ref.

**Phase B (wound residue) clearing is derived, not written**: rather than a cross-item write that clears `lastDamagedAt` when the turn advances into an entity, `initiative.js` stamps `turnStartedAt` on the initiative sentinel whenever `activeTurnIndex` or `round` changes. Clients then derive: *the wound halo is live unless this entity is the currently-active one and `turnStartedAt >= lastDamagedAt`* (plus a 12s `serverTime` window when there is no active combat). Both operands are server clocks on records every viewer already polls, so every viewer — including one who joined mid-combat — computes the identical answer, with no extra write on either the damage path or the turn-advance path.

**All age arithmetic uses the `serverTime` field already on `GET /session-state`, never `Date.now()`** — a clock-skewed phone would otherwise never flash, or flash constantly.

**Stale stamps are never an error.** A `lastDamagedAt` that outlives its window, or a `lastDamageFrom` naming a creature no longer on the map, is silently ignored. No cleanup state, no migration (absent = never damaged).

**Cost**: zero new AWS resources. One extra DynamoDB read on the damage path and on the initiative PUT, both human-frequency actions on a PAY_PER_REQUEST table (ADR-003). Response payload grows by ~3 small attributes per party member and per NPC.

**Revisit when**: an explicit targeting UI is built (which would supply the attacker/target directly and make `turnStartedAt`/`lastDamageFrom` inference unnecessary), or a feature needs a genuine event *log* rather than a latest-value stamp — at which point the roll-history sentinel's typed-entry pattern (ADR-015) is the precedent, not a new sentinel.

---

## ADR-023 · Player-facing map/token visibility is enforced in server-side projections, on every unauthenticated path

**Context**: Story 54 (invisible NPCs absent from the player map) and Story 53 (NPC conditions visible to players, except on hidden initiative entries) both change what the player-facing payload contains. Today `PlayerMapViewer` filters tokens **client-side** (`CharacterSheetSessionMode.jsx`) for `partyVisibilityEnabled`. Extending that pattern to invisibility would put the invisible creature's exact coordinates in devtools and make the feature theatre.

**Decision**: Anything a player is not permitted to know is removed **server-side**, in a shared projection helper, on **every** path that can serve it unauthenticated. Concretely:

1. **A derived `invisible` boolean per token**, computed once server-side from the subject's `conditions` (normalised: trimmed, case-insensitive match on `"invisible"`), emitted in both `getSessionState.js` variants. The DM client must **not** re-derive it — if the `◇` marker and the omission are computed independently they can drift, and the guarantee "the DM's map is a strict superset of every player's map, and `◇` marks exactly the difference" becomes false. The flag is **derived, never stored**: `patchMapTokens.js` and `moveMapToken.js` must not accept or round-trip an `invisible` field from a client.
2. **The public variant omits every `type:"npc"` token whose flag is true**, from the `mapLibrary.maps[].tokens[]` array — and so must **`getMapLibrary.js`**, which is a six-line fully unauthenticated `GET /maps` handler (ADR-012) returning the sentinel verbatim. **This is the leak a `getSessionState`-only fix would miss.** Both handlers call the same helper.
3. **NPC `conditions` are added to the public NPC payload** (`npcCombatPublic` in `getSessionState.js`, today stripped to `{id, name, portraitUrl}`), gated on the NPC's linked initiative entry not being `hidden` — reusing the DM's existing hide-entry toggle as the single secrecy lever, with no new field and no new UI. `initiativeProjection.js` already computes the hidden-entry set and is the natural home for the gate.
4. **`lastDamageFrom` is stripped server-side whenever the referenced attacker is invisible or linked to a hidden initiative entry** (Story 55). A tracer originating from an empty square leaks the attacker's position as effectively as rendering its token.

**Fail-open, deliberately**: if a token's subject cannot be resolved (orphaned `sourceId`), it renders and is treated as *not* invisible. Fail-closed would hide a token from players while the DM's map shows it with no `◇`, silently breaking the superset guarantee — the DM would stop trusting the marker, which is the whole value of the feature. Document this; do not "harden" it.

**Accepted residual leak**: Story 31 number badges leave gaps in the visible numbering, letting a player infer that *some* hidden creature exists. That is existence, not position — the only thing 5e invisibility conceals. The DM's escape hatch is hiding the initiative entry.

**Constraint**: `PLAYER_VISIBLE_FIELDS` in `partyProjection.js` stays a whitelist. When widening it, widen `DM_PARTY_PROJECTION_EXPRESSION` in the same change or `dmParty.js`'s Scan silently drops the new attributes (the same rule ADR-017 states for `normalize*Record`).

**Revisit when**: a real fog-of-war / line-of-sight system is wanted (per-viewer visible-region computation), or players get any surface that reports a token *count* — no player-facing UI may ever report a count that includes omitted tokens.

---

## ADR-024 · Character field shape evolution: tolerant client normaliser + lazy write-through, never a migration script

**Context**: Story 56 changes `spells` from `string[]` to an array of objects. This is the first time a *populated, player-authored* character field changes shape. Options considered: a one-shot migration script over the table; a server-side normaliser in the outgoing projection (the precedent set by `normalizeHpFields()` in `characterProjection.js`, which synthesises `hpCurrent`/`hpMax` from legacy `hp`); a tolerant client-side reader.

**Decision**: Shape changes to character fields are absorbed **client-side, at read time, in one named normaliser per field**, and the new shape is persisted **only as a side effect of the next ordinary save**. Concretely for spells: `normalizeSpells()` in `src/features/characterSheet/constants.js`, called at every render site; a bare `string` entry becomes `{ id, name }` with no other keys. `PUT /characters/{slug}` (`update.js`) is a merge-and-store with **no per-field validation or schema**, so the new shape needs zero backend change — the first time a player opens edit mode and saves, that character's spells are structured.

Rejected alternatives and why:
- **A migration script** (`scripts/migrate.mjs`-style pass over the table) — needs the tolerant reader anyway (a stale client, an unmigrated export, a hand-edited item, and the seed JSONs in `src/characters/` all still produce legacy shapes), so it is pure additional risk on a live table for zero removed code. At a handful of characters it also cannot pay for the cost of writing and testing it.
- **Server-side normalisation in the projection**, per `normalizeHpFields()` — correct for that case because it fills scalar defaults. Wrong here because normalising an object array requires **minting identity** (`id`), and a server minting non-deterministic ids on every read produces a different id per response, which is worse than no id. It would also have to be applied on at least three paths (`get.js`, both `getSessionState.js` variants, and `dmParty.js`'s Scan) versus one client helper.

**Two hard constraints on any such normaliser**:
1. **Synthesised ids must be deterministic** (e.g. `legacy:<index>:<name>`), never `crypto.randomUUID()`. The normaliser runs on every poll tick (ADR-011); a fresh id per call changes every React key and remounts the whole list on a 1–30s cadence. Real ids are minted **once, in the editor, at creation time**, and only then persisted.
2. **The legacy shape is never surfaced as a defect.** No "migrate", "categorize", or "uncategorized" prompt, badge, or banner. A legacy entry renders identically to a new entry whose optional keys are unset. Absent optional keys are the unset state — never `null`, `""`, or a sentinel string like `"none"`; the UI **deletes** the key.

**Constraint on the write path**: a field whose shape is evolving stays on the ordinary edit-mode `PUT`. Do **not** add it to `SESSION_FIELDS` in `session.js` at the same time — a shape change and a second concurrent write path landing together makes any read-tolerance bug undiagnosable. (`spells` deliberately stays out of `SESSION_FIELDS`: brief OQ-1.)

**Revisit when**: a field shape change lands on data a player cannot re-save through the UI (i.e. no natural write-through path exists), or when the tolerant branch of a normaliser outlives the last legacy record by long enough that deleting it is worth a one-off migration. Also revisit if a field ever needs the *server* to reason about its structure — at which point the shape must be normalised server-side and the field validated in `update.js`, which today validates nothing.

---

## ADR-025 · Attack-capable spells reuse the weapon mod *value formats*, not the `mods[]` structure

**Context**: Story 56 gives spells a `role`, and Story 57's amendment adds `level?`, `toHit?`, `damage?` so a declared spell attack has something to roll and a slot to check. The tempting move is to give spells a `mods[]` array so weapons and spells share one shape and one code path.

**Decision**: Spells stay structurally separate from `weapons[]`/`equipment[]` — no `mods[]`, no `equipped`, no `attuned`, no `qty`, no `type` — but the **two roll-relevant string formats are copied verbatim** from the weapon mod values the dice roller already parses:

| Spell field | Same format as | Consumed by |
|---|---|---|
| `toHit?: string` | a weapon's `mods[]` entry with `attribute: "Attack Bonus"` — a signed integer bonus (`"+7"`), **not** a full expression | `parseInt` → `executeRoll({ groups:[{count:1,sides:20}], flat })` |
| `damage?: string` | a weapon's `mods[]` entry with `attribute: "Damage"` — a dice expression (`"2d6+3"`) | `parseDiceExpr` (exported from `DiceRoller.jsx`) |

This is what makes a spell attack and a weapon attack collapse into **one** roll path: `getAttackBonus`/`getDamage` in `DiceRoller.jsx` become field lookups over a shared `{ id, kind, name, toHit, damage }` adapter shape rather than two parallel implementations. `toHit` as a bare bonus rather than `"1d20+7"` is the load-bearing half — a full expression would need its own roll branch and would diverge from every weapon in the app the first time someone edited one.

Rejected: `mods[]` on spells. It pulls `ItemEditorModal`'s mod editor back in (the exact weight Story 56 exists to avoid), and `MOD_ATTRIBUTES` carries AC/Speed/attunement concepts that are meaningless on a spell. Two optional freeform strings are not a mod system.

**`level` is authored, never derived.** `0` means cantrip and is a *meaningful* value, so an empty level input must produce an **absent** key — `parseInt(input, 10) || 0` is a bug here, since it silently turns "unspecified" into "cantrip, always castable". Whether a slot is spent (including Pact Magic pools) is computed by the consumer against `spellSlots`, not stored.

**Does not trigger ADR-010's revisit.** ADR-010 constrains numeric *mod* values via `parseModInt`; the app already stores dice notation in the `"Damage"` mod value and parses it with `parseDiceExpr`. These two fields follow that established split, not a relaxation of ADR-010.

**Revisit when**: spells need a third roll-relevant value (a save DC, an area, a damage type) — at that point a small `spellRoll: { ... }` sub-object is the right shape, not more top-level keys, and the save-vs-attack-roll distinction the RPG consultant deferred (Story 55 §RPG Consultant §1) becomes the reason to build it.

---

## ADR-026 · Roll provenance: declaration context rides the roll-history event as structured optional fields, never a baked label string

**Context**: Story 57 needs a roll to carry *who it was aimed at* and *with what* into the shared `roll-history` sentinel, so the feed reads `Longsword → ◎ Goblin 2` instead of a bare total. The cheap-looking move is to bake the string into the existing `label` field, which needs **zero** backend and renderer change (`postCharacterRoll.js` already stores `label` verbatim, and `RollHistoryRow` already renders it via `normalizeRollActionLabel`).

**Decision**: Reject the baked-label shortcut. Declaration context is carried as **two structured optional fields** on the roll-history event, and the renderer composes the display string from them:

```js
target?: { type: "npc", sourceId: string, name: string }   // name captured at declaration time
attack?: { kind: "weapon"|"spell", id: string, name: string }
```

- **`label` stays exactly what it is today** — `"Longsword ATK"`, plus the `(adv)`/`(dis)` tag `executeRoll` appends. Do not concatenate target text into it.
- `postCharacterRoll.js` validates and passes both through, following the same optional-field style as `isCrit`/`isFumble`: absent when not supplied, never `null`. Existing callers are unchanged and existing stored rows stay valid (no migration — same additive rule as ADR-015's `type` discriminator, which this does **not** extend: a declared attack is still `type: "roll"`, not a new row type).
- `RollHistoryRow` renders the target in the existing action-label slot when `entry.target` is present. One glyph, `◎` (U+25CE), no new row type, no extra vertical space.

**Rationale**: a baked string is lossy and unparseable. The two named downstream consumers both need `sourceId` as data, not prose — the DM "Apply to…" pre-selection follow-on (brief OQ-6, "~10 lines" once the data exists) and Story 55's Channel correlation window both key off `target.sourceId` and `attack.kind`. Baking the label means the first consumer has to regex the display string back apart, or a second write path gets added later to carry what should have been there from the start.

**The captured name is authoritative for display; `sourceId` is allowed to dangle.** A history entry is a historical statement, and it must stay correct after the NPC is renamed, duplicated (Story 24's numbered spawn), or deleted. **Never resolve the name via a live lookup at render time.** A consumer that acts on `sourceId` must tolerate it referring to nothing.

**Constraint**: this is roll *provenance*, not a damage or targeting record. It does not write HP, does not participate in ADR-022's damage stamps, and no gameplay state may be derived from its presence or absence — a roll fired from the ordinary roller panel carries neither field and is equally valid.

**Revisit when**: a third provenance dimension is wanted (a save DC, a damage type, an AoE target list) — at that point these collapse into one `declaration: { ... }` sub-object rather than more top-level keys. Also revisit if the DM's `postDmRoll.js` needs the same fields; today it deliberately does not (Story 57 is player-only).

---

## ADR-027 · `DiceRoller` is the single roll engine; new entry points extend its imperative handle and pass overrides as arguments

**Context**: Story 57's Attack Bar is a second entry point into rolling. `executeRoll` in `src/components/DiceRoller.jsx` already owns the whole pipeline — dice generation, advantage/disadvantage, crit/fumble detection, the ~1050ms cycling-number reveal, local history, and the `postCharacterRoll` broadcast. `DiceRoller` is **already** a `forwardRef` exposing `useImperativeHandle(ref, () => ({ rollAbility }))`, and session mode **already** holds a `diceRollerRef` and mounts the roller *outside* the sub-tab panels, so it stays mounted across sub-tab switches.

**Decision**: There is exactly one roll engine. A new entry point **extends the existing imperative handle** (`{ rollAbility, rollAttack, ... }`) and calls the same `executeRoll`. Do not lift `executeRoll` out into a hook, do not duplicate it, and do not let a caller assemble its own dice and only borrow the display.

**Two hard rules that follow, both bug traps observed in the current implementation**:

1. **Any value a second entry point needs to override must be passed as an argument to `executeRoll`, never read from `DiceRoller`'s own state.** `executeRoll` closes over `advMode` state and uses it in **two** places — the adv/dis dice logic *and* the `modeTag` that gets appended to the broadcast label. A caller supplying its own advantage mode must thread it through the parameter object so **both** sites see it; overriding only the dice logic silently drops `(adv)` from the shared feed, which is real information. The same applies to a caller-supplied dice expression.
2. **`executeRoll` resolves asynchronously and returns nothing.** It sets `rollState` after `resolveTime` (1050ms for a single group) and silently early-returns `if (rollState.rolling)`. A second entry point that needs the result must be given an explicit completion callback in the parameter object, and must handle the "a roll was already in flight, nothing happened" case rather than waiting forever in an armed state.

**Also note**: `executeRoll` calls `ensureOpen()`, which force-opens the roller panel and writes `dnd_dice_open_${slug}`. A caller rolling from a different surface must decide deliberately whether that side effect is wanted; suppress it via a parameter rather than by reordering state.

**Rationale**: forking the roll path is how two surfaces in the same app start disagreeing about what a critical hit is. The cost of the imperative handle is one function in an object that already exists.

**Revisit when**: a third entry point needs the engine, or a roll needs to happen with no `DiceRoller` mounted at all. At that point `executeRoll` and its pure helpers move to `src/lib/rolling.js` with the component consuming it — but only then, and as a mechanical extraction with the existing specs as the safety net.

---

## ADR-028 · Token-layer gestures: two independent event families; only a drag may suppress pan

**Context**: Story 57 adds a player-facing hold gesture to `TokenChip`. The token surface already carries the DM's long-press menu, the player's own-token drag (Story 34), map pan, and pinch-zoom. The briefs treat these as one dispatch problem ("movement >8px → map pan"), which mis-describes the code and invites a feature-builder to write routing logic that double-handles the gesture.

**How it actually works, verified against source**:

- **`TokenChip` uses Pointer Events** (`onPointerDown`/`Move`/`Up`/`Cancel`, `setPointerCapture`) — chosen so mouse, touch, and stylus follow one path.
- **`MapViewer` pan/pinch uses Mouse and Touch events** (`handleMouseDown`/`handleTouchStart`), on an ancestor, with `touch-action: none` on the container.

These are **separate event streams that both fire**. A press on a token starts the chip's pointer gesture *and* the ancestor's pan gesture simultaneously, and they coexist today — that is precisely how the DM's long-press already works alongside pan.

**Decisions**:

1. **A movement threshold on a chip gesture is a *cancel* condition, not a routing decision.** Exceeding it clears the chip's own timer and nothing else. The pan is already running in the other event family; there is nothing to hand off to. Never call into `MapViewer`'s pan from a chip handler, and never `stopPropagation`/`preventDefault` on a chip gesture that is meant to fall through to pan.
2. **`panSuppressedRef` is set by drags only.** It is the one mechanism that stops `MapViewer` panning (both `handleMouseDown` and `handleTouchStart` early-return on it). Story 34's drag sets it because a drag must consume the movement. A hold/long-press gesture must **not** set it — doing so breaks pan-started-on-a-token, which is a common thing to do on a crowded map.
3. **A gesture that commits must suppress the trailing click.** `handleClick` fires on pointerup regardless; the existing `suppressClickRef` flag is the established mechanism and any new committing gesture must set it, or the gesture fires *and* the tap action fires.
4. **A gesture that has a hover-triggered visual on the same element must suppress that visual while charging.** The detail card (`expanded`) is driven purely by `onMouseEnter` with a 120ms delay, so on desktop any press on a chip also pops the card. The precedent to copy is Story 44's `if (resizeActive) return;` guard at the top of `handleMouseEnter`.
5. **Pointer capture is safe but must be paired with an explicit movement check.** `setPointerCapture` retargets pointer events only — it does not affect the Mouse/Touch pan family. But it changes boundary-event semantics, so do not rely on `onPointerLeave` to cancel a gesture; track distance from the pointerdown origin in a ref and test it in `onPointerMove`.
6. **Hold durations are named constants, and near-duplicates are not allowed to drift silently.** `LONG_PRESS_MS = 480` (DM menu) already exists. A second hold threshold must be its own clearly-named constant next to it with a comment saying why it differs, or reuse it.

**Charge-progress affordance**: a CSS `stroke-dashoffset` transition whose `transition-duration` equals the hold threshold is a 1:1 elapsed-time progress meter for free — no `requestAnimationFrame` loop. `.token-longpress-ring` already does exactly this; copy the mechanism. Note that the reduced-motion block sets `display: none` on that class, so a new charge affordance needs its own class to give it a different reduced-motion treatment.

**Revisit when**: `MapViewer`'s pan is migrated to Pointer Events (which would make the two families one and change every rule above), or a chip gesture genuinely needs to consume movement without being a drag.

---

## Feature Index

This is a navigation aid for humans and future agents. It mirrors the feature language in `design/app-overview.md` and points to the primary code locations for each area.

### Character Library

- Page: `src/pages/CharactersListPage.jsx`
- Character summary fetch: `src/pages/CharactersListPage.jsx`
- Frontend guard against malformed/internal rows: `src/pages/CharactersListPage.jsx`
- Regression spec: `src/pages/CharactersListPage.test.jsx`
- **Shared page-level CSS**: `src/pages/pages.css`

### Character Sheet

- Container / sync orchestration: `src/components/CharacterSheet.jsx`
- Container sync spec: `src/components/CharacterSheet.test.jsx`
- View mode render: `src/features/characterSheet/CharacterSheetViewMode.jsx`
- View mode turn-state spec: `src/features/characterSheet/CharacterSheetViewMode.test.jsx`
- Edit mode render: `src/features/characterSheet/CharacterSheetEditMode.jsx`
- **Component CSS (view + edit + item editor)**: `src/features/characterSheet/characterSheet.css`
- Theme / palette definitions: `src/features/characterSheet/theme.jsx`
- Sheet constants and blank model: `src/features/characterSheet/constants.js`
- Shared talents catalog and badge/tooltip UI: `src/features/characterSheet/talentCatalog.js`, `src/features/characterSheet/CharacterTalents.jsx`
- Talents / tooltip regression spec: `src/features/characterSheet/CharacterTalents.test.jsx`
- Shared sheet primitives: `src/features/characterSheet/CharacterSheetPrimitives.jsx`
- Item editor modal: `src/features/characterSheet/ItemEditorModal.jsx`
- Password change form: `src/features/characterSheet/ChangePasswordForm.jsx`
- Dice roller used on character sheets: `src/components/DiceRoller.jsx`
- **Shared dice roller CSS + keyframes**: `src/components/diceRoller.css`
- Shared roll event formatting: `src/lib/rollHistory.js`
- Shared roll history row renderer: `src/components/RollHistoryList.jsx`

### Character Detail Pages

- Existing character route and polling: `src/pages/CharacterPage.jsx`
- New character flow: `src/pages/NewCharacterPage.jsx`
- Character route regression spec: `src/pages/CharacterPage.test.jsx`
- **Shared page-level CSS**: `src/pages/pages.css`

### Shared Realtime Utilities

- Adaptive polling, queued background refresh, debounce, optimistic live-field merge, and shared numeric flush hook: `src/lib/liveSync.js`

### DM Campaign

- Container / polling / orchestration: `src/pages/DmDashboardPage.jsx`
- Container regression spec: `src/pages/DmDashboardPage.test.jsx`
- Shared dashboard helpers and polling constants: `src/features/dmDashboard/dashboardShared.js`
- **Dashboard layout CSS + all animation keyframes**: `src/features/dmDashboard/dashboard.css`
- **Party card CSS**: `src/features/dmDashboard/characterCard.css`
- **NPC combat + initiative tracker CSS**: `src/features/dmDashboard/npcCombat.css`
- **Map library modal CSS**: `src/features/dmDashboard/mapLibrary.css`
- DM auth prompt: `src/features/dmDashboard/DmLoginPrompt.jsx`
- DM auth checking loader: `src/features/dmDashboard/DmAuthLoader.jsx`
- DM auth prompt spec: `src/features/dmDashboard/DmLoginPrompt.test.jsx`
- Player party card slice: `src/features/dmDashboard/CharacterCard.jsx`
- Initiative tracker: `src/features/dmDashboard/InitiativeTracker.jsx`
- Initiative optimistic-update spec: `src/features/dmDashboard/InitiativeTracker.test.jsx`
- NPC combat section: `src/features/dmDashboard/NpcCombatSection.jsx`
- NPC active-turn spec: `src/features/dmDashboard/NpcCombatSection.test.jsx`
- Shared confirm dialog: `src/features/dmDashboard/ConfirmDialog.jsx`
- Dice roller used on the DM campaign page: `src/components/DmDiceRoller.jsx`
- **Shared dice roller CSS + keyframes**: `src/components/diceRoller.css`
- DM dice roller spec: `src/components/DmDiceRoller.test.jsx`
- Shared roll history row renderer: `src/components/RollHistoryList.jsx`
- Counter wheels panel (Story 30): `src/features/dmDashboard/` (new slice) + `src/pages/DmDashboardPage.jsx` (orchestration), CSS in `src/features/dmDashboard/`

### Backend Character APIs

- Public character list: `backend/src/handlers/list.js`
- Public character fetch: `backend/src/handlers/get.js`
- Character create/update/delete: `backend/src/handlers/create.js`, `backend/src/handlers/update.js`, `backend/src/handlers/delete.js`
- Password verify: `backend/src/handlers/verify.js`
- Portrait presign/upload helper: `backend/src/handlers/portrait.js`
- Live session patch endpoint: `backend/src/handlers/session.js`

### Backend DM / Realtime Support

- DM party aggregate: `backend/src/handlers/dmParty.js`
- Initiative read/write: `backend/src/handlers/initiative.js`
- NPC combat read/write: `backend/src/handlers/getNpcCombat.js`, `backend/src/handlers/putNpcCombat.js`
- Character roll event ingest: `backend/src/handlers/postCharacterRoll.js`
- DM roll history fetch: `backend/src/handlers/getRollHistory.js`
- Reserved internal record definitions and public filters: `backend/src/lib/specialItems.js`
- Shared initiative / NPC combat / roll-history record facade: `backend/src/lib/specialRecords.js`
- Counter wheels read/write (Story 30): `backend/src/handlers/getCounterWheels.js`, `backend/src/handlers/putCounterWheels.js`
- Shared auth/db/response helpers: `backend/src/lib/auth.js`, `backend/src/lib/db.js`, `backend/src/lib/response.js`
- Backend reserved-record specs: `backend/src/lib/specialItems.test.cjs`, `backend/src/lib/specialRecords.test.cjs`, `backend/src/handlers/list.test.cjs`, `backend/src/handlers/get.test.cjs`
