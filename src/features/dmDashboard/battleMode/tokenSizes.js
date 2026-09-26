// Per-token size presets (Story 44, extended by Story 65). Multipliers of a
// standard character token, labelled with 5e size categories; Colossal is a
// homebrew step past Gargantuan for dragons, titans and the like.
export const SIZE_STEPS = [0.5, 1.0, 2.0, 3.0, 4.0, 6.0];
export const SIZE_LABELS = {
  0.5: "TINY",
  1.0: "MEDIUM",
  2.0: "LARGE",
  3.0: "HUGE",
  4.0: "GARGANTUAN",
  6.0: "COLOSSAL",
};
export const MIN_TOKEN_SCALE = SIZE_STEPS[0];
export const MAX_TOKEN_SCALE = SIZE_STEPS[SIZE_STEPS.length - 1];

export function nearestSizeIndex(scale) {
  const value = Number.isFinite(scale) ? scale : 1.0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < SIZE_STEPS.length; i++) {
    const dist = Math.abs(SIZE_STEPS[i] - value);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
}

// Next preset in `direction` (+1 / −1). A legacy off-preset scale (e.g. the
// old 1.5×) steps to the neighbouring preset rather than skipping one.
export function stepTokenScale(scale, direction) {
  const value = Number.isFinite(scale) ? scale : 1.0;
  if (direction > 0) return SIZE_STEPS.find((step) => step > value + 1e-6) ?? MAX_TOKEN_SCALE;
  return [...SIZE_STEPS].reverse().find((step) => step < value - 1e-6) ?? MIN_TOKEN_SCALE;
}

export function sizeLabel(scale) {
  const value = Number.isFinite(scale) ? scale : 1.0;
  return SIZE_LABELS[value] || SIZE_LABELS[SIZE_STEPS[nearestSizeIndex(value)]];
}
