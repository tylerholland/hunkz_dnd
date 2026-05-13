import { useState } from "react";
import MapViewer from "../maps/MapViewer";
import MapLibraryModal from "./MapLibraryModal";
import { putMapActive, putMapView } from "../../api";
import { displayMapName } from "./MapUploadModal";

export default function MapPanel({ mapLibrary, dmPassword, onLibraryChange, pal }) {
  const [collapsed, setCollapsed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewerState, setViewerState] = useState(null);

  const maps = mapLibrary?.maps || [];
  const activeMapId = mapLibrary?.activeMapId || null;
  const activeMap = maps.find((m) => m.id === activeMapId) || null;
  const publishedView = activeMap && mapLibrary?.activeMapView?.mapId === activeMap.id ? mapLibrary.activeMapView : null;

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

  return (
    <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 5, marginBottom: 12, overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", userSelect: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        {activeMap && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#66cc66", boxShadow: "0 0 6px #66cc66", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: activeMap ? pal.accentBright : pal.textMuted }}>
          Map{collapsed && activeMap ? ` — ${activeMap.name || activeMap.s3Key?.split("/").pop()?.replace(/\.[^.]+$/, "") || "Active"}` : ""}
        </div>
        <div style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted }}>{collapsed ? "▼" : "▲"}</div>
      </div>

      {!collapsed && (
        <div style={{ padding: "0 12px 12px" }}>
          {activeMap ? (
            <>
              <MapViewer
                imageUrl={activeMap.imageUrl}
                name={activeMap.name}
                contentType={activeMap.contentType}
                height={300}
                pal={pal}
                publishedView={publishedView}
                onViewChange={setViewerState}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.textMuted, textAlign: "right" }}>
                  {displayMapName(activeMap)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
      )}

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
