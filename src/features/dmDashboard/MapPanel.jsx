import { useEffect, useLayoutEffect, useRef, useState } from "react";
import MapViewer, { getMapZoomModifierLabel, readMapFreeZoomPreference, writeMapFreeZoomPreference } from "../maps/MapViewer";
import MapLibraryModal from "./MapLibraryModal";
import { putMapActive, putMapView } from "../../api";
import { displayMapName } from "./MapUploadModal";

export default function MapPanel({ mapLibrary, dmPassword, onLibraryChange, pal, collapsedOverride = null }) {
  const [collapsed, setCollapsed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewerState, setViewerState] = useState(null);
  const [mapHeight, setMapHeight] = useState(() => {
    const saved = Number(sessionStorage.getItem("dnd_dm_map_height") || 300);
    return Number.isFinite(saved) ? Math.max(220, Math.min(720, saved)) : 300;
  });
  const [freeZoom, setFreeZoom] = useState(readMapFreeZoomPreference);
  const bodyRef = useRef(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const resizeStateRef = useRef(null);
  const zoomModifierLabel = getMapZoomModifierLabel();

  useEffect(() => {
    if (collapsedOverride === null) return;
    setCollapsed(Boolean(collapsedOverride));
  }, [collapsedOverride]);

  const maps = mapLibrary?.maps || [];
  const activeMapId = mapLibrary?.activeMapId || null;
  const activeMap = maps.find((m) => m.id === activeMapId) || null;
  const publishedView = activeMap && mapLibrary?.activeMapView?.mapId === activeMap.id ? mapLibrary.activeMapView : null;
  const activeMapLabel = activeMap ? displayMapName(activeMap) : "";

  useEffect(() => {
    sessionStorage.setItem("dnd_dm_map_height", String(mapHeight));
  }, [mapHeight]);

  useEffect(() => {
    writeMapFreeZoomPreference(freeZoom);
  }, [freeZoom]);

  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node) return undefined;

    const updateHeight = () => {
      setBodyHeight(node.scrollHeight);
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateHeight());
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [activeMapId, maps.length, libraryOpen, publishedView]);

  const handleClear = async () => {
    try {
      await putMapActive(null, dmPassword);
      onLibraryChange();
    } catch { /* ignore */ }
  };

  const handleLibraryChange = (action) => {
    if (action === "close") {
      setLibraryOpen(false);
    }
    onLibraryChange();
  };

  const handlePublishView = async () => {
    if (!activeMap || !viewerState) return;
    try {
      await putMapView({
        mapId: activeMap.id,
        translate: viewerState.translate,
        scale: viewerState.scale,
        pageNumber: viewerState.pageNumber,
      }, dmPassword);
      onLibraryChange();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      const nextHeight = Math.max(220, Math.min(720, resizeState.startHeight + (event.clientY - resizeState.startY)));
      setMapHeight(nextHeight);
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      window.document.body.style.cursor = "";
      window.document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const handleResizeStart = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: mapHeight,
    };
    window.document.body.style.cursor = "ns-resize";
    window.document.body.style.userSelect = "none";
  };

  return (
    <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 5, marginBottom: 12, overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={() => {
          setCollapsed((c) => !c);
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", userSelect: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        {activeMap && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#66cc66", boxShadow: "0 0 6px #66cc66", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: activeMap ? pal.accentBright : pal.textMuted }}>
          {activeMap ? `Map: ${activeMapLabel}` : "Map"}
        </div>
        <div style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted }}>{collapsed ? "▼" : "▲"}</div>
      </div>

      <div
        style={{
          maxHeight: collapsed ? 0 : bodyHeight,
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? "translateY(-6px)" : "translateY(0)",
          overflow: "hidden",
          pointerEvents: collapsed ? "none" : "auto",
          transition: "max-height 0.28s ease, opacity 0.22s ease, transform 0.22s ease",
        }}
      >
        <div ref={bodyRef} style={{ padding: "0 12px 12px" }}>
          {activeMap ? (
            <>
              <MapViewer
                imageUrl={activeMap.imageUrl}
                name={activeMap.name}
                contentType={activeMap.contentType}
                height={mapHeight}
                pal={pal}
                publishedView={publishedView}
                onViewChange={setViewerState}
                freeZoom={freeZoom}
              />
              <div
                onPointerDown={handleResizeStart}
                title="Drag to resize map"
                style={{
                  height: 12,
                  marginTop: 4,
                  marginBottom: 4,
                  cursor: "ns-resize",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  touchAction: "none",
                }}
              >
                <div style={{ width: 60, height: 3, borderRadius: 999, background: pal.border, boxShadow: `0 0 0 1px ${pal.border}`, opacity: 0.9 }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={handlePublishView}
                  style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = pal.accentBright; e.currentTarget.style.borderColor = pal.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.borderColor = pal.border; }}
                >
                  Set for Players
                </button>
                <button
                  onClick={() => window.open(`/map-view?theme=${encodeURIComponent((pal.name || "ocean").toLowerCase())}`, "_blank", "noopener,noreferrer")}
                  style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = pal.accentBright; e.currentTarget.style.borderColor = pal.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.borderColor = pal.border; }}
                >
                  Open Window
                </button>
                <button
                  onClick={handleClear}
                  style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#c06060"; e.currentTarget.style.borderColor = "rgba(192,96,96,0.5)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.borderColor = pal.border; }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setLibraryOpen(true)}
                  style={{ background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer" }}
                >
                  Library
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", marginLeft: "auto" }}>
                  <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em", color: pal.textMuted }}>
                    {freeZoom ? "Free Zoom" : `${zoomModifierLabel} + Scroll to Zoom`}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={freeZoom}
                    aria-label="Toggle free zoom"
                    onClick={() => setFreeZoom((value) => !value)}
                    style={{
                      width: 56,
                      height: 26,
                      borderRadius: 999,
                      border: `1px solid ${freeZoom ? pal.accent : pal.border}`,
                      background: freeZoom ? pal.accentDim : "rgba(255,255,255,0.05)",
                      padding: 2,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: freeZoom ? "flex-end" : "flex-start",
                      transition: "background 0.16s ease, border-color 0.16s ease",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: freeZoom ? pal.accentBright : pal.textMuted,
                        boxShadow: freeZoom ? `0 0 8px ${pal.accentDim}` : "none",
                        transition: "background 0.16s ease, box-shadow 0.16s ease",
                      }}
                    />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: "16px 0" }}>
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic", marginBottom: 12 }}>No active map.</div>
              <button
                onClick={() => setLibraryOpen(true)}
                style={{ background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 16px", cursor: "pointer" }}
              >
                {maps.length > 0 ? "Choose from Library" : "Upload a Map"}
              </button>
            </div>
          )}
        </div>
      </div>

      {libraryOpen && (
        <MapLibraryModal
          mapLibrary={mapLibrary}
          dmPassword={dmPassword}
          onLibraryChange={handleLibraryChange}
          asPage={false}
        />
      )}
    </div>
  );
}
