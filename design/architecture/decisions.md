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
