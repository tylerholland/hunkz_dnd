# Architecture Decisions

> Standing decisions for this project. Maintained by `code-architect`.
> Each entry records what was decided, why, and when to revisit.
> Story notes reference these by ID (e.g., "follows ADR-003") instead of re-explaining.

---

## ADR-001 · Inline React styles (no CSS framework)

**Decision**: All component styling uses inline React style objects. No Tailwind, no CSS modules, no styled-components.

**Rationale**: Keeps the bundle lean, eliminates a build-time dependency, and makes palette-driven theming straightforward — every style value can reference `pal.accent` etc. directly without CSS variables or class generation.

**Exception**: `<style>` tags injected via `useEffect` for `@media` breakpoints and CSS class patterns (`.loadout-grid`, `.character-details-grid`) where inline styles can't express responsive rules.

**Revisit when**: The component count grows large enough that style duplication becomes a maintenance problem, or if a designer needs to work in the codebase without React knowledge.

---

## ADR-002 · Monolithic CharacterSheet.jsx

**Decision**: All character sheet UI — view mode, edit mode, sub-components, modals, constants — lives in one file (`src/components/CharacterSheet.jsx`).

**Rationale**: The app has one primary screen. A single file means zero prop-drilling across files, trivial co-location of related logic, and fast navigation. The cost (file length) is low given the tooling.

**Revisit when**: The file exceeds ~2500 lines and distinct sub-features (e.g., a DM dashboard, a dice roller) are large enough to be genuinely independent. Split by feature, not by component type.

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
