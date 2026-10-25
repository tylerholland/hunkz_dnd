// Portrait focus — the point of a portrait the homepage orb should centre on
// (a character's `portraitFocus`: { x, y }, fractions of the image, usually
// the face). Turned into a CSS object-position for an object-fit: cover image.

export const DEFAULT_OBJECT_POSITION = "50% 22%";
// The homepage portrait box (width : height) and where the orb's centre sits
// down it.
export const PORTRAIT_BOX = 3 / 3.4;
export const ORB_CENTRE_Y = 0.36;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function normalizeFocus(focus) {
  const x = Number(focus?.x);
  const y = Number(focus?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

/**
 * The object-position that puts `focus` at the orb's centre (horizontally
 * centred, ORB_CENTRE_Y down) in a cover-fitted box, given the image's
 * aspect (naturalWidth / naturalHeight). Units cancel, so the box is taken
 * as width 1.
 */
export function focusObjectPosition(focus, imageAspect, { boxAspect = PORTRAIT_BOX, targetY = ORB_CENTRE_Y } = {}) {
  const f = normalizeFocus(focus);
  if (!f || !(imageAspect > 0)) return DEFAULT_OBJECT_POSITION;
  const boxW = 1;
  const boxH = 1 / boxAspect;
  const scale = Math.max(boxW / imageAspect, boxH); // cover, with image height 1
  const iw = imageAspect * scale;
  const ih = scale;
  const ox = iw - boxW;
  const oy = ih - boxH;
  const px = ox > 1e-6 ? clamp01((f.x * iw - 0.5 * boxW) / ox) : 0.5;
  const py = oy > 1e-6 ? clamp01((f.y * ih - targetY * boxH) / oy) : 0.5;
  return `${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%`;
}
