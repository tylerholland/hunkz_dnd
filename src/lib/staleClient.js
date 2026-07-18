// Story 36b — stale-client auto-refresh.
//
// Single owner of "should this tab reload itself, and when is it safe to do
// so" logic. Two triggers funnel into the same safe-reload path:
//
//   1. Version mismatch — every GET /session-state response carries the
//      server's buildVersion (Story 35/35b endpoint, extended in 36b).
//      Callers report it via reportServerBuildVersion() on every poll/nudge
//      refetch; a mismatch against this tab's embedded VITE_BUILD_VERSION
//      schedules a reload.
//   2. Reload broadcast — deploy.sh (or the DM, in an emergency) can push
//      { type: "reload" } over the Story 36 WebSocket. useSessionSocket.js
//      calls handleReloadBroadcast() on that message, bypassing the version
//      compare entirely.
//
// Both entry points funnel through scheduleReload(), which:
//   - defers while a text input/textarea is focused, or a modal is open
//     (retried on a fixed interval until safe)
//   - is guarded by a sessionStorage loop-guard keyed by a "target" string,
//     so a mid-deploy mixed S3 bundle (or a repeated broadcast) can't
//     trigger more than one reload per target per tab per 5 minutes
//
// Complete no-op when VITE_BUILD_VERSION is absent (local `npm run dev`) —
// this tab's embedded version is the master on/off switch for the whole
// feature.

const RELOAD_GUARD_WINDOW_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 1000;

// Broadcast reloads have no "target version" of their own (the push is a
// direct instruction, not a version compare) — they share one fixed guard
// key so repeated/duplicate broadcasts still can't loop a tab.
const BROADCAST_GUARD_TARGET = "broadcast";

// Tracks target keys currently in a deferred retry loop, so repeated calls
// for the same target (e.g. once per poll tick while the user is mid-typing)
// don't stack up duplicate setTimeout chains.
const pendingTargets = new Set();

function getEmbeddedVersion() {
  return import.meta.env.VITE_BUILD_VERSION || null;
}

function isTextInputFocused() {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const nonTextTypes = ["button", "checkbox", "radio", "range", "submit", "reset", "color", "file", "image"];
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !nonTextTypes.includes(type);
  }
  return !!el.isContentEditable;
}

// Every modal component in this app wraps its backdrop in a className
// containing "overlay" (modal-overlay / cc-modal-overlay / eg-modal-overlay /
// cs-hd-modal-overlay / cs-unlock-overlay, etc.) — a broad but low-risk
// heuristic that needs no changes to any existing modal component.
function isModalOpen() {
  if (typeof document === "undefined") return false;
  return !!document.querySelector('[class*="overlay"]');
}

function isSafeToReload() {
  return !isTextInputFocused() && !isModalOpen();
}

function guardKey(target) {
  return `dnd_reloaded_for_${target}`;
}

function withinGuardWindow(target) {
  try {
    const raw = sessionStorage.getItem(guardKey(target));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < RELOAD_GUARD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markReloaded(target) {
  try {
    sessionStorage.setItem(guardKey(target), String(Date.now()));
  } catch {
    // sessionStorage unavailable — worst case is a repeat reload attempt,
    // which is still safe (just not deduped).
  }
}

function defaultReload() {
  if (typeof window !== "undefined" && window.location && typeof window.location.reload === "function") {
    window.location.reload();
  }
}

function scheduleReload(target, { reload = defaultReload } = {}) {
  if (withinGuardWindow(target)) return;
  if (pendingTargets.has(target)) return;
  pendingTargets.add(target);

  const attempt = () => {
    if (withinGuardWindow(target)) {
      pendingTargets.delete(target);
      return;
    }
    if (!isSafeToReload()) {
      setTimeout(attempt, RETRY_DELAY_MS);
      return;
    }
    markReloaded(target);
    pendingTargets.delete(target);
    reload();
  };

  attempt();
}

// Called with the buildVersion field from GET /session-state on every
// poll/nudge refetch. No-op in local dev (embedded version absent) or when
// the server hasn't written the app-meta sentinel yet (buildVersion: null,
// e.g. before the first 36b deploy) — both cases are intentionally
// backward compatible no-ops.
export function reportServerBuildVersion(serverBuildVersion, options) {
  const embedded = getEmbeddedVersion();
  if (!embedded) return;
  if (!serverBuildVersion) return;
  if (serverBuildVersion === embedded) return;
  scheduleReload(serverBuildVersion, options);
}

// Called from useSessionSocket's message handler on { type: "reload" }.
// Bypasses the version compare (deploy.sh/the DM is telling us directly) but
// still funnels through the same safe-moment deferral and loop guard.
export function handleReloadBroadcast(options) {
  const embedded = getEmbeddedVersion();
  if (!embedded) return; // local dev — never reload
  scheduleReload(BROADCAST_GUARD_TARGET, options);
}
