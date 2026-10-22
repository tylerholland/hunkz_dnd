import { useCallback, useState } from "react";

// Story 49 — per-person, per-device: show the "Your turn" banner and play the
// chime when your turn comes round (on by default). The End Turn button lights
// up either way.
const KEY = "dnd_turn_alerts";

function read() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function useTurnAlertsPref() {
  const [enabled, setEnabled] = useState(read);
  const toggle = useCallback(() => setEnabled((on) => {
    const next = !on;
    try { localStorage.setItem(KEY, next ? "on" : "off"); } catch { /* storage unavailable */ }
    return next;
  }), []);
  const menuItem = { label: `Turn alerts: ${enabled ? "On" : "Off"}`, onClick: toggle };
  return { enabled, menuItem };
}
