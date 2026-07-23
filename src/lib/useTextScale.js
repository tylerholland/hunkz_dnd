import { useEffect, useState } from "react";

// Shared "Text Size" accessibility control (originally DM-dashboard-only,
// extended to every player-facing / unauthenticated surface — everyone gets
// the same stepper in their ⋯ menu). Callers supply their own sessionStorage
// key so a surface's scale can be scoped independently; PLAYER_TEXT_SCALE_KEY
// is shared across the character library, session mode, and profile mode so
// the preference carries as a player navigates between them.

export const PLAYER_TEXT_SCALE_KEY = "dnd_player_text_scale";

const TEXT_SCALE_STEP = 0.1;
const TEXT_SCALE_MIN = 0.9;
const TEXT_SCALE_MAX = 1.4;

function clampTextScale(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
}

export function useTextScale(storageKey) {
  const [textScale, setTextScale] = useState(() =>
    clampTextScale(parseFloat(sessionStorage.getItem(storageKey) || "1"))
  );

  useEffect(() => {
    sessionStorage.setItem(storageKey, String(textScale));
  }, [storageKey, textScale]);

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
