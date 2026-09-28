import { useEffect, useState } from "react";

// Shared "Text Size" accessibility control — one setting for every page (DM
// and player alike), shown as a stepper in each page's ⋯ menu and applied as
// a zoom on the page root. Stored per browser tab (sessionStorage).

export const TEXT_SCALE_KEY = "dnd_text_scale";
// Earlier builds kept the DM dashboard and player pages separate; the first
// read falls back to whichever of those this tab already had.
const LEGACY_TEXT_SCALE_KEYS = ["dnd_player_text_scale", "dnd_dm_text_scale"];

function readStoredScale() {
  try {
    for (const key of [TEXT_SCALE_KEY, ...LEGACY_TEXT_SCALE_KEYS]) {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return parseFloat(raw);
    }
  } catch {
    // storage unavailable
  }
  return 1;
}

const TEXT_SCALE_STEP = 0.1;
const TEXT_SCALE_MIN = 0.9;
const TEXT_SCALE_MAX = 1.4;

function clampTextScale(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
}

export function useTextScale() {
  const [textScale, setTextScale] = useState(() => clampTextScale(readStoredScale()));

  useEffect(() => {
    try {
      sessionStorage.setItem(TEXT_SCALE_KEY, String(textScale));
    } catch {
      // storage unavailable — the size still applies on this page
    }
  }, [textScale]);

  const roundedTextScalePct = Math.round(textScale * 100);

  const textScaleMenuItem = {
    stepper: true,
    label: "Text Size",
    value: `${roundedTextScalePct}%`,
    onDecrement: () => setTextScale((current) => clampTextScale(Number((current - TEXT_SCALE_STEP).toFixed(2)))),
    onIncrement: () => setTextScale((current) => clampTextScale(Number((current + TEXT_SCALE_STEP).toFixed(2)))),
  };

  return { textScale, roundedTextScalePct, textScaleMenuItem };
}
