# Feature Story: 36b — Stale-Client Auto-Refresh & Deploy Reload Broadcast

**Status**: Approved — Ready to Build
**Source**: DM request 2026-07-18 (follow-up to Story 36)

---

## Goal

Make deploys self-propagating: every open tab detects when its bundle is stale and reloads itself, and a deploy (or the DM, in an emergency) can push an immediate reload to all connected clients over the Story 36 WebSocket. After this story, no one ever has to be asked to refresh again.

## Why

Frontend deploys only affect future page loads — tabs left open keep running old code indefinitely (old polling cadences, old bugs). With a 3-player table this was solvable by asking, but it shouldn't be a manual step, and mid-session hotfixes need a push lever.

## Model

1. **Version stamp**: the build embeds its git short hash (`VITE_BUILD_VERSION`, injected by `deploy.sh` at build time). `deploy.sh` also writes the same hash to a new sentinel `slug: "app-meta"` (`{ buildVersion, deployedAt }`) via a direct `aws dynamodb put-item` CLI call — no new write endpoint needed.
2. **Detection**: `getSessionState.js` adds `app-meta` to its existing sentinel `BatchGetItem` (still one round trip) and returns `buildVersion` in both variants. Clients compare it to their embedded version on every poll/nudge refetch.
3. **Safe reload**: on mismatch, the client schedules `location.reload()` at a safe moment — deferred while any text input/textarea is focused or a modal is open; retried on the next tick otherwise. A `sessionStorage` guard (`dnd_reloaded_for_<version>`) prevents reload loops if S3 is still serving the old bundle (e.g. mid-sync): reload for a given target version at most once per tab per 5 minutes.
4. **Reload broadcast**: `useSessionSocket` learns a second message type — `{"type":"reload"}` → same safe-reload path (bypasses the version compare; the guard still applies). A new small Lambda `broadcastReload` (no HTTP route; invoked via `aws lambda invoke` from `deploy.sh` after the S3 sync completes) calls the Story 36 broadcast lib with the reload payload.
5. **Dev behavior**: when `VITE_BUILD_VERSION` is absent (local `npm run dev`), the whole feature is a no-op — never reload a dev session.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source. The graph predates Stories 35/36 — read `backend/src/handlers/getSessionState.js`, `backend/src/lib/broadcast.js`, and `src/lib/useSessionSocket.js` directly.
- `app-meta` sentinel: add to `specialItems.js` constants + `RESERVED_CHARACTER_SLUGS`; normalizer in `specialRecords.js` (explicit field pass-through). Absent sentinel → `buildVersion: null` → clients never reload (backward compatible).
- `broadcast.js`: generalize `notifySessionChanged()` minimally to accept a payload (default stays `{"type":"changed"}`); `broadcastReload` Lambda sends `{"type":"reload"}`. Do not change existing call sites.
- Client: put the version-check + safe-reload logic in one new module `src/lib/staleClient.js` consumed by both pages' session-state fan-out and by `useSessionSocket`'s message handler — do not duplicate the safe-moment logic.
- `deploy.sh`: `VERSION=$(git rev-parse --short HEAD)`; pass `VITE_BUILD_VERSION="$VERSION"` to the build; after `aws s3 sync`, `aws dynamodb put-item` the app-meta sentinel, then `aws lambda invoke` the reload broadcast. Order matters: sync first, then version write, then broadcast — so a reloading client always finds the new bundle.
- **Tests**: staleClient unit tests (mismatch → reload scheduled; focused input defers; loop guard; dev no-op), useSessionSocket handles `"reload"`, getSessionState includes `buildVersion`, broadcast payload generalization.
- **Update** CLAUDE.md (sentinel, lib, deploy.sh flow), app-overview, and note in ADR-019.

## Acceptance Criteria

1. Deploying via `deploy.sh` causes an open production tab (new bundle) to reload itself within one poll cycle — or within ~1s if socket-connected.
2. No reload loops when S3 serves a mixed/old bundle; no reloads ever in local dev.
3. A reload never fires while the user is mid-typing or has a modal open — it waits.
4. All tests pass; no new lint problems in touched files; build succeeds.

## Out of Scope

- Migrating tabs running pre-36b bundles (impossible retroactively); service workers/PWA cache control; user-facing "update available" UI.
