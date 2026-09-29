import { useCallback, useState } from "react";

// Per-person, per-device choice: show the big animated number when you roll
// from the attack bar (on by default). Your own screen only — nobody else
// sees your overlay either way.
const KEY = "dnd_roll_overlay";

function read() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function useRollOverlayPref() {
  const [enabled, setEnabled] = useState(read);
  const toggle = useCallback(() => setEnabled((on) => {
    const next = !on;
    try { localStorage.setItem(KEY, next ? "on" : "off"); } catch { /* storage unavailable */ }
    return next;
  }), []);
  const menuItem = { label: `Roll animation: ${enabled ? "On" : "Off"}`, onClick: toggle };
  return { enabled, menuItem };
}
