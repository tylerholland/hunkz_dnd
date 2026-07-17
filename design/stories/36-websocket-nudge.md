# Feature Story: WebSocket Nudge Channel

**Status**: Blocked on Story 35 (session-state consolidation)
**Source**: Architecture review 2026-07-16

---

## Goal

Near-instant sync without payload-over-socket complexity: an API Gateway WebSocket that broadcasts a tiny "state changed" ping whenever any session write lands. Clients that hear the ping immediately refetch `GET /session-state`; clients without a socket fall back to today's polling.

## Why

Polling at 1s is the latency floor and the cost floor. A nudge channel gets sub-second sync AND lets connected clients relax their poll to a 30s safety net — cheaper and faster at once. Because the socket carries no state (just "refetch"), there are no ordering, schema, or replay problems, and a dropped socket degrades gracefully.

## UX Design

No new UI. Optional: reuse the existing pulsing-dot idiom as a tiny "live" indicator in the top bar (green = socket connected, dim = polling fallback). Keep it subtle; no toasts on reconnect.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- **Infra (template.yaml)**: `AWS::ApiGatewayV2` WebSocket API with `$connect` / `$disconnect` routes → two small handlers that put/delete `{ connectionId, connectedAt }` items. Store connections in the existing table under a reserved prefix (e.g. `slug: "ws-connection#<id>"` — add prefix filtering to `filterPublicCharacterItems()`), or a tiny dedicated table if TTL hygiene is cleaner (`ttl` attribute, 12h). Prefer the dedicated table: TTL cleanup is free and sentinel filtering stays simple.
- **Broadcast helper** `backend/src/lib/broadcast.js`: `notifySessionChanged()` — scan/query connections, `PostToConnection` with body `{"type":"changed"}`, delete gone (410) connections. Fire-and-forget: wrap in try/catch, never fail the write path. Call it at the end of every session-write handler (`session.js`, `initiative.js`, `putNpcCombat`, `putCounterWheels`, roll-history writes, map token/active/calibration writes, `dmNotes.js`).
- **Client** `src/lib/useSessionSocket.js`: connects (URL via `VITE_WS_URL`), on message calls the page's `queueRefresh(0)`; exponential backoff reconnect (1s → 30s cap); exposes `connected` boolean. When `connected`, `useAdaptivePolling` interval stretches to 30s (safety net); when not, ADR-011 cadence resumes. Socket only while tab visible — close on `visibilitychange` hidden, reopen on visible.
- **Cost sanity**: 4 clients × 4h session = trivial WS minutes; broadcast Lambda fires per write (~a few hundred per session). Net large reduction vs 1s polling.
- **Tests**: broadcast helper unit test (410 pruning); client hook test for fallback behavior.
- **Update** CLAUDE.md, app-overview, and add an ADR for the nudge-not-payload decision.

## Acceptance Criteria

1. A write from any client is visible on other connected clients in <1s without waiting for a poll tick.
2. Killing the socket (network blip) silently returns clients to polling; no user-visible errors.
3. Write handlers never fail or slow down because broadcast failed.
4. All tests pass.

## Out of Scope

- Payload-over-WS, presence lists, per-entity channels, Web Push notifications (separate future story).
