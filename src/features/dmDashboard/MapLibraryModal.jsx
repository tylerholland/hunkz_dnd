import { useState } from "react";
import { putMapActive, patchMap, deleteMap } from "../../api";
import MapUploadModal, { displayMapName } from "./MapUploadModal";
import MapThumbnail from "../maps/MapThumbnail";

export default function MapLibraryModal({ mapLibrary, dmPassword, onLibraryChange, asPage = false }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [error, setError] = useState("");

  const maps = mapLibrary?.maps || [];
  const activeMapId = mapLibrary?.activeMapId || null;

  const accent = "#6a8fa8";
  const accentBright = "#a0c0d0";
  const accentDim = "rgba(30,58,78,0.7)";
  const border = "rgba(100,130,160,0.28)";
  const textMuted = "#3a5a6a";
  const text = "#c8bfaf";
  const surface = "rgba(18,32,48,0.6)";
  const fontUI = "'IM Fell English', Georgia, serif";
  const fontBody = "'Crimson Text', Georgia, serif";
  const thumbHeight = asPage ? 140 : 100;

  const handleSetActive = async (mapId) => {
    setError("");
    try {
      await putMapActive(mapId, dmPassword);
      onLibraryChange();
    } catch { setError("Failed to set active map."); }
  };

  const handleStartRename = (map) => {
    setRenamingId(map.id);
    setRenameValue(map.name || "");
    setDeletingId(null);
  };

  const handleSaveRename = async (mapId) => {
    setError("");
    try {
      await patchMap(mapId, renameValue, dmPassword);
      onLibraryChange();
      setRenamingId(null);
    } catch { setError("Failed to rename map."); }
  };

  const handleDelete = async (mapId) => {
    setError("");
    try {
      await deleteMap(mapId, dmPassword);
      onLibraryChange();
      setDeletingId(null);
    } catch { setError("Failed to delete map."); }
  };

  const handleUploaded = () => {
    onLibraryChange();
    setUploadOpen(false);
    setUploadFile(null);
  };

  const grid = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(clamp(160px, calc(33% - 12px), 280px), 1fr))", gap: 16 }}>
      {maps.map((map) => {
        const isActive = map.id === activeMapId;
        const isRenaming = renamingId === map.id;
        const isDeleting = deletingId === map.id;

        return (
          <div key={map.id} style={{ background: surface, border: `1px solid ${isActive ? accent : border}`, borderRadius: 5, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "relative" }}>
              <MapThumbnail map={map} alt={displayMapName(map)} style={{ width: "100%", height: thumbHeight }} />
              {isActive && (
                <div style={{ position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: "50%", background: "#66cc66", boxShadow: "0 0 6px #66cc66" }} />
              )}
            </div>

            <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {isRenaming ? (
                <div>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value.slice(0, 48))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(map.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    style={{ width: "100%", background: "rgba(18,32,48,0.7)", border: `1px solid ${accent}`, borderRadius: 3, color: text, fontFamily: fontBody, fontSize: 13, padding: "4px 7px", outline: "none", boxSizing: "border-box", marginBottom: 4 }}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleSaveRename(map.id)} style={{ flex: 1, background: accentDim, border: `1px solid ${accent}`, borderRadius: 3, color: accentBright, fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "3px 0", cursor: "pointer" }}>Save</button>
                    <button onClick={() => setRenamingId(null)} style={{ flex: 1, background: "transparent", border: `1px solid ${border}`, borderRadius: 3, color: textMuted, fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "3px 0", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: fontBody, fontSize: 13, color: text, lineHeight: 1.3, wordBreak: "break-word" }}>{displayMapName(map)}</div>
              )}

              {isActive && !isRenaming && (
                <div style={{ fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", color: "#66cc66" }}>● Active</div>
              )}

              {!isRenaming && !isDeleting && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "auto" }}>
                  {!isActive && (
                    <button onClick={() => handleSetActive(map.id)} style={{ background: accentDim, border: `1px solid ${accent}`, borderRadius: 3, color: accentBright, fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "4px 0", cursor: "pointer" }}>Set Active</button>
                  )}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleStartRename(map)} style={{ flex: 1, background: "transparent", border: `1px solid ${border}`, borderRadius: 3, color: textMuted, fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "3px 0", cursor: "pointer" }}>Rename</button>
                    <button onClick={() => { setDeletingId(map.id); setRenamingId(null); }} style={{ flex: 1, background: "transparent", border: "1px solid rgba(192,96,96,0.3)", borderRadius: 3, color: "#c06060", fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "3px 0", cursor: "pointer" }}>Delete</button>
                  </div>
                </div>
              )}

              {isDeleting && (
                <div style={{ marginTop: "auto" }}>
                  <div style={{ fontFamily: fontBody, fontSize: 12, color: "#c06060", marginBottom: 4 }}>Delete this map?</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleDelete(map.id)} style={{ flex: 1, background: "rgba(120,40,40,0.3)", border: "1px solid rgba(192,96,96,0.5)", borderRadius: 3, color: "#c06060", fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "3px 0", cursor: "pointer" }}>Delete</button>
                    <button onClick={() => setDeletingId(null)} style={{ flex: 1, background: "transparent", border: `1px solid ${border}`, borderRadius: 3, color: textMuted, fontFamily: fontUI, fontSize: 11, letterSpacing: "0.1em", padding: "3px 0", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const emptyState = (
    <div style={{ padding: "40px 0", textAlign: "center", fontFamily: fontBody, fontSize: 14, color: textMuted, fontStyle: "italic" }}>
      No maps in library. Upload one to get started.
    </div>
  );

  const content = (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: fontUI, fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: accentBright }}>Map Library</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => { setUploadFile(null); setUploadOpen(true); }}
            style={{ background: accentDim, border: `1px solid ${accent}`, borderRadius: 4, color: accentBright, fontFamily: fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer" }}
          >
            Upload
          </button>
          {!asPage && (
            <button
              onClick={() => onLibraryChange("close")}
              aria-label="Close map library"
              style={{
                background: "transparent",
                border: `1px solid ${border}`,
                borderRadius: 4,
                color: textMuted,
                fontFamily: fontUI,
                fontSize: 13,
                lineHeight: 1,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ color: "#c06060", fontFamily: fontBody, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {maps.length === 0 ? emptyState : grid}

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

  if (asPage) return content;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) { /* close handled by parent */ } }}
    >
      <div style={{ background: "rgba(10,15,24,0.97)", border: `1px solid ${border}`, borderRadius: 6, padding: 28, width: "100%", maxWidth: 680, maxHeight: "85vh", overflowY: "auto", position: "relative" }}>
        {content}
      </div>
    </div>
  );
}
