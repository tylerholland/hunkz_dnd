# Session synchronization

Read for live data, optimistic state, polling, WebSocket signals, or stale-client reloads.

- `getSessionState()` in `src/api.js` is the consolidated live-data endpoint. Live pages (`DmDashboardPage`, `CharacterModePage`, `CharacterPage`, `MapViewerPage`) use `useAdaptivePolling`. Extend this path rather than introducing independent resource pollers; one-shot endpoints still serve mount-time/library actions.
- `backend/src/handlers/getSessionState.js` assembles sentinel/character reads and uses shared party, initiative, and character projections. Preserve consistency with one-shot responses and verified player-note visibility. Credential changes must be reflected in subsequent reads.
- `src/lib/useSessionSocket.js` receives change nudges that request a fresh snapshot. Polling remains the fallback/safety net. An absent `VITE_WS_URL` disables the socket; preserve hidden-tab handling and reconnect behavior.
- Reload signals and server build versions flow through `src/lib/staleClient.js`. An absent `VITE_BUILD_VERSION` disables auto-refresh. Preserve deferral during editing/modal activity and reload loop guards.
- `backend/src/lib/broadcast.js` handles best-effort notifications; failures must not turn successful state writes into failures. New broadcast callers need corresponding SAM permissions/configuration.
- `deploy.sh` uploads the frontend before stamping the `app-meta` sentinel and invoking reload broadcast. Preserve this ordering.
- Keep pending local changes from being overwritten by older snapshots. Inspect each surface's existing queue/ref/version handling rather than assuming optimistic state is handled globally.

Search [ADRs](../decisions.md) for ADR-011/ADR-019 and [realtime strategy](../realtime-sync-strategy.md) only when changing synchronization architecture. Exact response fields belong in handlers/shared projections and [backend reference](../backend-reference.md).
