import { useState, useRef } from "react";
import { putMapActive } from "../../api";
import MapUploadModal, { displayMapName } from "./MapUploadModal";
import MapThumbnail from "../maps/MapThumbnail";
import { isSupportedMapContentType } from "../maps/mapFiles";

export default function MapLibraryStrip({ mapLibrary, dmPassword, onLibraryChange }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const maps = mapLibrary?.maps || [];
  const activeMapId = mapLibrary?.activeMapId || null;

  const accent = "#6a8fa8";
  const accentBright = "#a0c0d0";
  const accentDim = "rgba(30,58,78,0.7)";
  const border = "rgba(100,130,160,0.28)";
  const textMuted = "#3a5a6a";
  const surface = "rgba(18,32,48,0.55)";
  const fontUI = "'IM Fell English', Georgia, serif";
  const fontBody = "'Crimson Text', Georgia, serif";

  const handleSetActive = async (mapId) => {
    try {
      await putMapActive(mapId, dmPassword);
      onLibraryChange();
    } catch { /* ignore */ }
  };

  const handleUploaded = (newMap) => {
    onLibraryChange();
    setUploadOpen(false);
    setUploadFile(null);
    // Optionally set as active immediately
    handleSetActive(newMap.id);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setDraggingOver(true);
  };

  const handleDragLeave = () => {
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDraggingOver(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDraggingOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && isSupportedMapContentType(f.type)) {
      setUploadFile(f);
      setUploadOpen(true);
    }
  };

  return (
    <div
      style={{ position: "relative", marginTop: 14, width: "100%", borderLeft: `1px solid ${border}`, paddingLeft: 20, paddingRight: 10, boxSizing: "border-box" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{ fontFamily: fontUI, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: textMuted, marginBottom: 8 }}>Map Library</div>

      <div style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        paddingBottom: 8,
        border: draggingOver ? `2px dashed ${accent}` : "2px dashed transparent",
        borderRadius: 5,
        padding: draggingOver ? 8 : 0,
        background: draggingOver ? "rgba(100,130,160,0.05)" : "transparent",
        transition: "border-color 0.15s, background 0.15s",
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
      }}>
        {/* Upload button */}
        <button
          onClick={() => { setUploadFile(null); setUploadOpen(true); }}
          style={{
            flexShrink: 0,
            width: 80,
            height: 80,
            background: surface,
            border: `1px dashed ${border}`,
            borderRadius: 4,
            color: textMuted,
            fontFamily: fontUI,
            fontSize: 20,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accentBright; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textMuted; }}
        >
          <span>+</span>
          <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Upload</span>
        </button>

        {maps.map((map) => {
          const isActive = map.id === activeMapId;
          return (
            <div key={map.id} style={{ flexShrink: 0, width: 80, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ position: "relative" }}>
                <MapThumbnail map={map} alt={displayMapName(map)} style={{ width: 80, height: 60, borderRadius: 3, border: `1px solid ${isActive ? accent : border}` }} />
                {isActive && (
                  <div style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "#66cc66", boxShadow: "0 0 5px #66cc66" }} />
                )}
              </div>
              <div style={{ fontFamily: fontBody, fontSize: 11, color: textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>{displayMapName(map)}</div>
              {!isActive && (
                <button
                  onClick={() => handleSetActive(map.id)}
                  style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 3, color: textMuted, fontFamily: fontUI, fontSize: 10, letterSpacing: "0.1em", padding: "2px 0", cursor: "pointer", width: "100%" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accentBright; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textMuted; }}
                >
                  Set Active
                </button>
              )}
              {isActive && (
                <div style={{ fontFamily: fontUI, fontSize: 10, letterSpacing: "0.1em", color: "#66cc66", textAlign: "center" }}>● Active</div>
              )}
            </div>
          );
        })}

        {maps.length === 0 && (
          <div style={{ fontFamily: fontBody, fontSize: 13, color: textMuted, fontStyle: "italic", display: "flex", alignItems: "center", paddingLeft: 8 }}>No maps yet</div>
        )}
      </div>

      {draggingOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontFamily: fontUI, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: accentBright, background: "rgba(10,15,24,0.85)", padding: "6px 16px", borderRadius: 3 }}>Drop to upload</div>
        </div>
      )}

      {uploadOpen && (
        <MapUploadModal
          initialFile={uploadFile}
          dmPassword={dmPassword}
          onUploaded={handleUploaded}
          onClose={() => { setUploadOpen(false); setUploadFile(null); }}
        />
      )}
    </div>
  );
}
