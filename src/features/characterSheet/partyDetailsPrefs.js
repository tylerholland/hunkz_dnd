// Remembered per device: which teammates this player keeps expanded.
const OPEN_KEY = "dnd_party_details_open";

export function readOpenPartyDetails() {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function writeOpenPartyDetails(set) {
  try { localStorage.setItem(OPEN_KEY, JSON.stringify([...set])); } catch { /* storage unavailable */ }
}
