import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Palette/font vars copied from the anchor so the portalled card matches the
// character card it came from (the card sets them inline on its root).
const CARRIED_VARS = [
  "--pal-surface-solid", "--pal-border", "--pal-text", "--pal-text-body", "--pal-text-muted",
  "--pal-accent", "--pal-accent-bright", "--font-ui", "--font-body", "--font-display",
];

const GAP = 6;
const MARGIN = 8;

// Tap-to-open detail card for the DM drawer: name, a meta line and the
// description, anchored to the tapped entry. Portalled to <body> because the
// card is transformed (which would trap position: fixed) and the drawer
// clips overflow. Closes on outside tap, Escape, scroll or resize.
export default function DrawerDetailPopover({ detail, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !detail) return;
    const computed = window.getComputedStyle(detail.anchor);
    for (const name of CARRIED_VARS) {
      const value = computed.getPropertyValue(name);
      if (value) el.style.setProperty(name, value.trim());
    }
    const { rect } = detail;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(MARGIN, rect.left), window.innerWidth - w - MARGIN);
    const below = rect.bottom + GAP;
    const top = below + h > window.innerHeight - MARGIN ? Math.max(MARGIN, rect.top - GAP - h) : below;
    setPos({ top, left });
  }, [detail]);

  useEffect(() => {
    if (!detail) return undefined;
    const onPointer = (e) => {
      if (ref.current?.contains(e.target) || detail.anchor?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const onMove = () => onClose();
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [detail, onClose]);

  if (!detail) return null;
  const style = { top: pos?.top ?? -9999, left: pos?.left ?? -9999 };
  return createPortal(
    <div ref={ref} className="cc-detail-pop" role="dialog" aria-label={detail.title} style={style}>
      <div className="cc-detail-pop__title">{detail.title}</div>
      {detail.meta && <div className="cc-detail-pop__meta">{detail.meta}</div>}
      {detail.body && <div className="cc-detail-pop__body">{detail.body}</div>}
    </div>,
    document.body
  );
}
