import { useRef, useState, useEffect, useCallback } from "react";
import PdfCanvas from "./PdfCanvas";
import { isPdfMap } from "./mapFiles";

export const ZOOM_LOCK_STORAGE_KEY = "dnd_map_free_zoom";

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function getMapZoomModifierLabel() {
  return isApplePlatform() ? "Cmd" : "Ctrl";
}

export function readMapFreeZoomPreference() {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(ZOOM_LOCK_STORAGE_KEY) === "true";
}

export function writeMapFreeZoomPreference(value) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ZOOM_LOCK_STORAGE_KEY, String(Boolean(value)));
}

export default function MapViewer({
  imageUrl,
  name,
  contentType,
  height = 320,
  pal,
  publishedView = null,
  allowResetToPublished = false,
  autoFollowPublished = false,
  resetLabel = "DM View",
  onViewChange,
  freeZoom,
  // Token layer props (all optional — no-op when absent for backward compat)
  tokens,
  tokenScale = 1,
  onImageLoad,
  onTokenLayerClick,
  onTokenClick,
  interactionMode,
  tokenLayerChildren,
  containerRefOut,
  // Story 34 — a ref whose .current is set true by the token layer while a
  // player is dragging their own token, so pan doesn't fight the drag.
  panSuppressedRef,
  // Story 45 — map rotation (0/90/180/270). Rotates the image in-place via CSS
  // transform with center origin; resets pan/zoom on change so the rotated map
  // re-anchors predictably inside the container box.
  rotation = 0,
}) {
  const containerRef = useRef(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imageNaturalSize, setImageNaturalSize] = useState(null);
  const [showHint, setShowHint] = useState(true);
  const [hintFaded, setHintFaded] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [internalFreeZoom] = useState(readMapFreeZoomPreference);

  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const stateRef = useRef({ translate: { x: 0, y: 0 }, scale: 1 });
  const imgRef = useRef(null);
  const pdfMode = isPdfMap({ imageUrl, contentType, name });
  const lastPublishedTokenRef = useRef(null);
  const pendingCenterFracApplyRef = useRef(false);
  const modifierKeyLabel = getMapZoomModifierLabel();
  const zoomUnlocked = typeof freeZoom === "boolean" ? freeZoom : internalFreeZoom;
  const handlePdfLoad = useCallback(({ numPages }) => {
    setPageCount(numPages);
    setPageNumber((value) => Math.min(Math.max(1, value), numPages));
  }, []);

  // Sync stateRef with state
  useEffect(() => { stateRef.current.translate = translate; }, [translate]);
  useEffect(() => { stateRef.current.scale = scale; }, [scale]);
  useEffect(() => {
    onViewChange?.({
      translate,
      scale,
      pageNumber,
      naturalSize: imageNaturalSize,
      containerWidth: containerRef.current?.clientWidth ?? 0,
      containerHeight: containerRef.current?.clientHeight ?? 0,
    });
  }, [translate, scale, pageNumber, onViewChange, imageNaturalSize]);

  // Reset on imageUrl change.
  // For cached images the browser fires onLoad before this effect runs, so
  // setImageNaturalSize({w,h}) gets called first and then null overwrites it —
  // leaving imageNaturalSize permanently null (no second onLoad). Fix: after the
  // null reset, re-read from the img DOM element within the same batch; if the
  // image is already decoded, the {w,h} setter wins and the token layer renders.
  useEffect(() => {
    setTranslate({ x: 0, y: 0 });
    setScale(1);
    setPageNumber(1);
    setPageCount(1);
    setImageNaturalSize(null);
    lastPublishedTokenRef.current = null;
    stateRef.current = { translate: { x: 0, y: 0 }, scale: 1 };
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [imageUrl]);

  // Story 45 — reset pan/zoom whenever rotation changes so the rotated map
  // re-anchors predictably inside the fixed-height container box.
  useEffect(() => {
    setTranslate({ x: 0, y: 0 });
    setScale(1);
    stateRef.current = { translate: { x: 0, y: 0 }, scale: 1 };
  }, [rotation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose containerRef to parent if requested
  useEffect(() => {
    if (containerRefOut) containerRefOut.current = containerRef.current;
  });

  const applyPublishedView = useCallback(() => {
    if (!publishedView) return;
    const nextScale = Number.isFinite(publishedView?.scale) ? publishedView.scale : 1;
    const nextPage = Number.isFinite(publishedView?.pageNumber) ? Math.max(1, Math.floor(publishedView.pageNumber)) : 1;

    const cfx = publishedView?.centerFracX;
    const cfy = publishedView?.centerFracY;
    const W = imageNaturalSize?.w;
    const H = imageNaturalSize?.h;
    const cw = containerRef.current?.clientWidth;
    const ch = containerRef.current?.clientHeight;

    let nextTranslate;
    if (Number.isFinite(cfx) && Number.isFinite(cfy) && W && H && cw && ch) {
      // Convert center-image-fraction back to a local translate so the same
      // point on the image lands at the center of *this* container.
      nextTranslate = {
        x: cw / 2 - cfx * W * nextScale,
        y: ch / 2 - cfy * H * nextScale,
      };
      pendingCenterFracApplyRef.current = false;
    } else {
      nextTranslate = {
        x: Number.isFinite(publishedView?.translate?.x) ? publishedView.translate.x : 0,
        y: Number.isFinite(publishedView?.translate?.y) ? publishedView.translate.y : 0,
      };
      // Mark pending so we retry once the image natural size is known.
      if (Number.isFinite(cfx) && Number.isFinite(cfy)) {
        pendingCenterFracApplyRef.current = true;
      }
    }

    stateRef.current.translate = nextTranslate;
    stateRef.current.scale = nextScale;
    setTranslate(nextTranslate);
    setScale(nextScale);
    setPageNumber(nextPage);
  }, [publishedView, imageNaturalSize]);

  useEffect(() => {
    if (!autoFollowPublished) return;
    const token = publishedView?.updatedAt || null;
    if (!token || token === lastPublishedTokenRef.current) return;
    lastPublishedTokenRef.current = token;
    applyPublishedView();
  }, [autoFollowPublished, publishedView?.updatedAt, applyPublishedView]);

  // Re-apply once the image loads if the first apply couldn't use center fracs.
  useEffect(() => {
    if (!autoFollowPublished || !imageNaturalSize || !pendingCenterFracApplyRef.current) return;
    applyPublishedView();
  }, [autoFollowPublished, imageNaturalSize, applyPublishedView]);

  // Hint fade after 3s
  useEffect(() => {
    if (!imageUrl) return;
    const t1 = setTimeout(() => setHintFaded(true), 3000);
    const t2 = setTimeout(() => setShowHint(false), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [imageUrl]);

  const dismissHint = useCallback(() => {
    setHintFaded(true);
    setTimeout(() => setShowHint(false), 400);
  }, []);

  const clampScale = (s) => Math.min(5, Math.max(0.5, s));

  // Mouse events
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (panSuppressedRef?.current) return;
    dismissHint();
    dragRef.current = { startX: e.clientX, startY: e.clientY, tx: stateRef.current.translate.x, ty: stateRef.current.translate.y };
    e.preventDefault();
  }, [dismissHint, panSuppressedRef]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = { x: dragRef.current.tx + dx, y: dragRef.current.ty + dy };
    stateRef.current.translate = next;
    setTranslate({ ...next });
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const handleWheel = useCallback((e) => {
    const modifierHeld = isApplePlatform() ? e.metaKey : e.ctrlKey;
    if (!zoomUnlocked && !modifierHeld) {
      return;
    }
    e.preventDefault();
    dismissHint();
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { scale: prevScale, translate: prevTrans } = stateRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextScale = clampScale(prevScale * factor);
    // Zoom towards cursor
    const nextTx = mx - (mx - prevTrans.x) * (nextScale / prevScale);
    const nextTy = my - (my - prevTrans.y) * (nextScale / prevScale);
    const next = { x: nextTx, y: nextTy };
    stateRef.current.scale = nextScale;
    stateRef.current.translate = next;
    setScale(nextScale);
    setTranslate({ ...next });
  }, [dismissHint, zoomUnlocked]);

  // Touch events
  const handleTouchStart = useCallback((e) => {
    if (panSuppressedRef?.current) return;
    dismissHint();
    if (e.touches.length === 1) {
      dragRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        tx: stateRef.current.translate.x,
        ty: stateRef.current.translate.y,
      };
    } else if (e.touches.length === 2) {
      dragRef.current = null;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchRef.current = {
        startDist: Math.hypot(dx, dy),
        startScale: stateRef.current.scale,
        midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, [dismissHint, panSuppressedRef]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      const next = { x: dragRef.current.tx + dx, y: dragRef.current.ty + dy };
      stateRef.current.translate = next;
      setTranslate({ ...next });
    } else if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const nextScale = clampScale(pinchRef.current.startScale * (dist / pinchRef.current.startDist));
      stateRef.current.scale = nextScale;
      setScale(nextScale);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragRef.current = null;
    pinchRef.current = null;
  }, []);

  // Attach wheel listener (non-passive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleReset = () => {
    setTranslate({ x: 0, y: 0 });
    setScale(1);
    stateRef.current = { translate: { x: 0, y: 0 }, scale: 1 };
  };

  const zoomPct = Math.round(scale * 100);
  const controlShellBg = "rgba(8,12,18,0.84)";
  const controlBorder = "rgba(200,220,235,0.18)";
  const controlText = pal.accentBright || pal.text;
  const controlMutedText = pal.text || pal.accentBright;
  const zoomHintText = zoomUnlocked
    ? "Drag to pan · Scroll or pinch to zoom"
    : `Drag to pan · ${modifierKeyLabel} + scroll or pinch to zoom`;

  if (!imageUrl) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", background: pal.surface, borderRadius: 4 }}>
        <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted }}>No map loaded</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          height,
          overflow: "hidden",
          cursor: dragRef.current ? "grabbing" : "grab",
          background: "#0a0a0f",
          borderRadius: 4,
          position: "relative",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {pdfMode ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "center",
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
          >
            <PdfCanvas
              src={imageUrl}
              pageNumber={pageNumber}
              renderScale={1.8}
              onDocumentLoad={handlePdfLoad}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "center",
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt={name || "Map"}
              draggable={false}
              style={{ maxWidth: "none", display: "block" }}
              onLoad={(e) => {
                const w = e.target.naturalWidth;
                const h = e.target.naturalHeight;
                setImageNaturalSize({ w, h });
                onImageLoad?.({ naturalWidth: w, naturalHeight: h });
              }}
            />
            {imageNaturalSize && (tokens || tokenLayerChildren) && (
              <div
                className="token-layer"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: imageNaturalSize.w,
                  height: imageNaturalSize.h,
                  "--token-scale-multiplier": tokenScale,
                  "--map-rotation": `${rotation ?? 0}deg`,
                  pointerEvents: interactionMode === "dm" ? "auto" : "none",
                }}
                onClick={onTokenLayerClick ? (e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (!rect.width || !rect.height) return;
                  const vx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const vy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                  // Convert visual (rotated) fracs → natural image fracs
                  const rot = rotation ?? 0;
                  let fracX, fracY;
                  if (rot === 90)       { fracX = vy;      fracY = 1 - vx; }
                  else if (rot === 180) { fracX = 1 - vx;  fracY = 1 - vy; }
                  else if (rot === 270) { fracX = 1 - vy;  fracY = vx; }
                  else                  { fracX = vx;      fracY = vy; }
                  onTokenLayerClick({ x: fracX, y: fracY }, e);
                } : undefined}
              >
                {tokenLayerChildren}
              </div>
            )}
          </div>
        )}

        {showHint && (
          <div style={{
            position: "absolute",
            bottom: 44,
            right: 8,
            background: "rgba(0,0,0,0.65)",
            borderRadius: 3,
            padding: "5px 10px",
            fontFamily: pal.fontUI,
            fontSize: 11,
            letterSpacing: "0.1em",
            color: "rgba(200,200,200,0.8)",
            pointerEvents: "none",
            transition: "opacity 0.4s",
            opacity: hintFaded ? 0 : 1,
          }}>
            {zoomHintText}
          </div>
        )}
      </div>

      {/* Controls overlay */}
      <div style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: controlShellBg,
        border: `1px solid ${controlBorder}`,
        borderRadius: 6,
        padding: "6px 7px",
        boxShadow: "0 3px 14px rgba(0,0,0,0.35)",
        backdropFilter: "blur(2px)",
      }}>
        {allowResetToPublished && publishedView && (
          <button
            onClick={applyPublishedView}
            style={{
              height: 28,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${controlBorder}`,
              borderRadius: 3,
              color: controlText,
              fontFamily: pal.fontUI,
              fontSize: 11,
              letterSpacing: "0.08em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              padding: "0 9px",
              marginRight: 4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = pal.text; e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = controlText; e.currentTarget.style.borderColor = controlBorder; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            {resetLabel}
          </button>
        )}
        {pdfMode && pageCount > 1 && (
          <>
            <button
              onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
              disabled={pageNumber <= 1}
              style={{
                width: 32,
                height: 28,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${controlBorder}`,
                borderRadius: 3,
                color: pageNumber <= 1 ? pal.textMuted : controlText,
                fontFamily: pal.fontBody,
                fontSize: 14,
                cursor: pageNumber <= 1 ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                opacity: pageNumber <= 1 ? 0.55 : 1,
              }}
            >
              ‹
            </button>
            <span style={{ fontFamily: pal.fontUI, fontSize: 11, color: controlMutedText, letterSpacing: "0.05em", marginRight: 4 }}>
              {pageNumber}/{pageCount}
            </span>
            <button
              onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
              disabled={pageNumber >= pageCount}
              style={{
                width: 32,
                height: 28,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${controlBorder}`,
                borderRadius: 3,
                color: pageNumber >= pageCount ? pal.textMuted : controlText,
                fontFamily: pal.fontBody,
                fontSize: 14,
                cursor: pageNumber >= pageCount ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                opacity: pageNumber >= pageCount ? 0.55 : 1,
              }}
            >
              ›
            </button>
          </>
        )}
        <span style={{ fontFamily: pal.fontUI, fontSize: 11, color: controlMutedText, letterSpacing: "0.05em", marginRight: 4 }}>{zoomPct}%</span>
        {[
          { label: "+", action: () => { const s = clampScale(stateRef.current.scale * 1.2); stateRef.current.scale = s; setScale(s); } },
          { label: "−", action: () => { const s = clampScale(stateRef.current.scale / 1.2); stateRef.current.scale = s; setScale(s); } },
          { label: "⟳", action: handleReset },
        ].map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            style={{
              width: 28,
              height: 28,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${controlBorder}`,
              borderRadius: 3,
              color: controlText,
              fontFamily: pal.fontBody,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = pal.text; e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = controlText; e.currentTarget.style.borderColor = controlBorder; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
