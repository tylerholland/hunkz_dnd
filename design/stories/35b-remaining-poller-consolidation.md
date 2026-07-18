# Feature Story: 35b — Consolidate the Remaining Pollers

**Status**: Approved — Ready to Build
**Source**: Story 35 implementation follow-up (AWS quota pressure, 2026-07-17)

---

## Goal

Fold the last two polling surfaces into `GET /session-state`, so **every** polled page in the app issues exactly one request per tick:

- `CharacterPage.jsx` (`/characters/:slug`, classic sheet) — currently polls `getCharacter` + `getMapLibrary` (2 requests/tick)
- `MapViewerPage.jsx` (`/map-view`) — currently polls `getMapLibrary` (1 request/tick, but a separate Lambda from session-state)

## Why

Story 35 consolidated the DM dashboard and session mode, but the classic sheet is the page players habitually leave open — at 2 requests/tick it's now the single largest remaining contributor to the free-tier quota burn. Finishing the job makes "requests per open tab per tick" exactly 1 everywhere, and means the Story 36 socket-relaxation covers every surface.

## UX Design

No visible change. Same data, same cadence, same optimistic behavior.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source. Note the graph predates Story 35: read `backend/src/handlers/getSessionState.js` and `src/api.js`'s `getSessionState` directly.
- **CharacterPage.jsx**: replace the two `useAdaptivePolling` instances with one polling `getSessionState({ slug, password })` where `password` is the cached credential (`sessionStorage.dnd_char_${slug}` or `dnd_dm_password`) so the owner/DM variant returns the full character (including `playerNotes`, per the existing `?slug` verification path in `getSessionState.js`). Fan out `response.character` → existing character state and `response.mapLibrary` → existing map state. If the backend's `?slug` path doesn't currently accept/verify a password header for the character projection, extend `getSessionState.js` minimally to do so — reuse `verifyPassword` exactly as `get.js` does; do not weaken stripping for unauthenticated callers.
- **MapViewerPage.jsx**: replace `getMapLibrary` polling with `getSessionState()` (public variant), using `response.mapLibrary`. Keep everything else identical.
- **Do not** touch one-shot fetch surfaces (`MapLibraryPage`) or the mount-fetch patterns (NPC library, counter wheels).
- **Tests**: per-page "exactly one getSessionState request per poll tick" tests, cloned from the Story 35 pattern in `DmDashboardPage.test.jsx` / `CharacterModePage.test.jsx`. If extending the password path in `getSessionState.js`, add a handler test: correct owner password → `playerNotes` present; wrong/absent → stripped.
- **Update** CLAUDE.md polling notes, `design/app-overview.md`, and extend the ADR-011 amendment (remove the "still-unconsolidated pollers" caveat).
- **Merge-order note**: Story 36 is being built in parallel on different pages; expect doc-file merge reconciliation, not code conflicts.

## Acceptance Criteria

1. Every polled page (`/dm`, `/characters/:slug/session|profile`, `/characters/:slug`, `/map-view`) issues exactly one request per poll tick, verified by test.
2. Classic sheet behavior unchanged: owner sees playerNotes, unauthenticated visitors don't; map tab still updates.
3. All tests pass; no new lint problems in touched files; build succeeds.

## Out of Scope

- Removing the deprecated endpoints; WebSocket work (Story 36).
