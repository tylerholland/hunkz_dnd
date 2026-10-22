import { useSyncExternalStore } from "react";

// Story 39 — the Talent Codex on this page: the DM's overrides for skill and
// special-ability descriptions ({ key: { description?, atTable? } }).
// api.js fetches it whenever session state reports a new codex version;
// getTalentDetail() (talentCatalog.js) merges it over the built-in text.
let entries = {};
let loadedVersion = null;
let fetchingVersion = null;
const listeners = new Set();

export function getTalentOverride(key) {
  return entries[key] || null;
}

/** True when `version` is newer than what this page holds (and not already loading). */
export function needsTalentCodex(version) {
  if (!Number.isFinite(version) || version === loadedVersion || version === fetchingVersion) return false;
  fetchingVersion = version;
  return true;
}

export function setTalentCodex(nextEntries, version) {
  entries = nextEntries && typeof nextEntries === "object" ? nextEntries : {};
  loadedVersion = Number.isFinite(version) ? version : loadedVersion;
  fetchingVersion = null;
  listeners.forEach((fn) => fn());
}

export function talentCodexFetchFailed() {
  fetchingVersion = null;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-render when the codex arrives or changes. Returns its version. */
export function useTalentCodexVersion() {
  return useSyncExternalStore(subscribe, () => loadedVersion, () => loadedVersion);
}
