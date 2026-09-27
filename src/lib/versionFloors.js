// Record-version floors (ADR-030). The server stamps every character and
// sentinel record with a monotonically increasing `version`; writes return the
// version they produced (`versions` in the response body, noted centrally by
// api.js). A screen must never apply data older than the newest version it
// has written or already applied — that is exactly the "a poll that was in
// flight during my write snaps my change back" case, and the out-of-order
// case between two other people's writes.
//
// Versions are per-record counters (+1 per write). Numbers stay exact up to
// 2^53 (~9e15): at 100 writes/second, forever, one record would need ~2.8
// million years to get there — they cannot realistically run out.

const floors = new Map();

export function characterVersionKey(slug) {
  return `char:${slug}`;
}

// Record versions reported by a write response.
export function noteVersions(versions) {
  if (!versions || typeof versions !== "object") return;
  for (const [key, version] of Object.entries(versions)) {
    if (Number.isFinite(version) && version > (floors.get(key) ?? -1)) floors.set(key, version);
  }
}

// Should incoming data for `key` at `version` be applied? False when it is
// older than something this screen has already written or applied. Accepting
// raises the floor. Data without a version (older server) is always accepted.
export function acceptVersion(key, version) {
  if (!Number.isFinite(version)) return true;
  const floor = floors.get(key);
  if (floor !== undefined && version < floor) return false;
  floors.set(key, version);
  return true;
}

export function resetVersionFloors() {
  floors.clear();
}
