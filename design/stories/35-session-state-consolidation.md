# Feature Story: Consolidated Session-State Endpoint

**Status**: Approved — Ready to Build (build after Stories 34 & 38 merge to avoid churn)
**Source**: Architecture review 2026-07-16

---

## Goal

Replace the polling fan-out (DM dashboard: 5 endpoints; player session mode: 4) with a single `GET /session-state` endpoint that returns everything a client needs in one consistent snapshot. Old endpoints remain live (deprecated for polling use).

## Why

~4 clients × ~5 endpoints × 1s ≈ 70k+ Lambda invocations per session-hour plus matching DynamoDB reads — 5× more than needed. Worse, cross-poll skew means initiative can advance a beat before HP updates. One endpoint = one clock, one snapshot, and the future refetch target for the WebSocket nudge (Story 36).

## UX Design

No visible UI change. Perceived liveness must not regress: same adaptive cadence (1s focused / 5s backgrounded per ADR-011), same optimistic-write + queued-refresh behavior.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- **New handler** `backend/src/handlers/getSessionState.js`, route `GET /session-state`:
  - **DM variant** (valid DM password in `x-character-password`): `{ party, initiative, npcCombat, rollHistory, mapLibrary, counterWheels, serverTime }` — reuse the exact projection/normalizer code paths of `dmParty.js`, `initiative.js`, `getNpcCombat`, roll-history read, `getMapLibraryState()`, `getCounterWheelsState()`. Extract shared projection helpers into `backend/src/lib/` rather than copy-pasting handler bodies.
  - **Public variant** (no/invalid password): `{ partyStatus, initiativePublic, mapLibrary, rollHistory, serverTime }` using the player-safe projections from `getPartyStatus.js` and `getInitiativePublic.js` (hidden entries stripped, rolls stripped, health tiers derived). Optional `?slug=<slug>` additionally returns `character` (same shape/stripping rules as `get.js` unauthenticated — `playerNotes` stripped unless the caller's password verifies for that slug).
  - **Reads**: sentinels via one `BatchGetItem` (initiative, npc-combat, roll-history, map-library, party-roster, counter-wheels, npc-library excluded — not polled by design); party member items via a second `BatchGetItem` keyed off the roster. Two round trips max.
- **Frontend**: add `getSessionState(opts)` to `src/api.js`. In `DmDashboardPage.jsx` and `CharacterModePage.jsx`, replace the multiple `useAdaptivePolling` instances with one polling the consolidated endpoint, fanning the response out to the existing state setters (`cloneLiveValue`/`liveValuesEqual` guards unchanged). Keep `useQueuedRefresh` semantics: any successful write queues one immediate refetch of the single endpoint.
- **Do not delete** the old endpoints or their handlers in this story — non-polled uses (e.g., `MapLibraryPage` one-shot fetch) keep using them. Mark them deprecated-for-polling in CLAUDE.md.
- **Tests**: handler test for both variants (DM auth → full payload; public → stripped payload; `?slug` character inclusion). Frontend: existing page tests updated to mock `getSessionState`.
- **Update** CLAUDE.md endpoint list, `design/app-overview.md` polling section, and note the ADR-011 amendment in `design/architecture/decisions.md`.

## Acceptance Criteria

1. DM dashboard and player session mode each issue exactly one polling request per tick, with identical rendered behavior.
2. Public variant leaks nothing the old public endpoints didn't (compare projections field-by-field in tests).
3. Writes still trigger immediate refresh; optimistic updates unchanged.
4. All tests pass; old endpoints untouched and functional.

## Out of Scope

- WebSocket push (Story 36). Removing deprecated endpoints. Caching layers.
