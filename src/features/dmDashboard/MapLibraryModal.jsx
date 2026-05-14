import { useState } from "react";
import { putMapActive, patchMap, deleteMap } from "../../api";
import MapUploadModal, { displayMapName } from "./MapUploadModal";
import MapThumbnail from "../maps/MapThumbnail";
import "./mapLibrary.css";

export default function MapLibraryModal({ mapLibrary, dmPassword, onLibraryChange, asPage = false }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [error, setError] = useState("");

  const maps = mapLibrary?.maps || [];
  const activeMapId = mapLibrary?.activeMapId || null;

  // Static palette values — this component does not receive a pal prop so
  // hardcoded ocean-palette hex values are used (same as before the refactor).
  const accent       = "#6a8fa8";
  const accentBright = "#a0c0d0";
  const accentDim    = "rgba(30,58,78,0.7)";
  const border       = "rgba(100,130,160,0.28)";
  const textMuted    = "#3a5a6a";
  const text         = "#c8bfaf";
  const surface      = "rgba(18,32,48,0.6)";
  const thumbHeight  = asPage ? 140 : 100;

  // CSS custom properties for children that reference var(--pal-*)
  const palVars = {
    "--pal-surface":       surface,
    "--pal-surface-solid": "#111e2c",
    "--pal-border":        border,
    "--pal-accent":        accent,
    "--pal-accent-bright": accentBright,
    "--pal-accent-dim":    accentDim,
    "--pal-text":          text,
    "--pal-text-body":     "#b0a898",
    "--pal-text-muted":    textMuted,
    "--font-ui":           "'IM Fell English', Georgia, serif",
    "--font-body":         "'Crimson Text', Georgia, serif",
  };

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
    <div className="map-lib-grid">
      {maps.map((map) => {
        const isActive   = map.id === activeMapId;
        const isRenaming = renamingId === map.id;
        const isDeleting = deletingId === map.id;

        return (
          <div
            key={map.id}
            className="map-lib-card"
            style={{ background: surface, border: `1px solid ${isActive ? accent : border}` }}
          >
            <div style={{ position: "relative" }}>
              <MapThumbnail map={map} alt={displayMapName(map)} style={{ width: "100%", height: thumbHeight }} />
              {isActive && <div className="map-lib-active-dot" />}
            </div>

            <div className="map-lib-card-body">
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
                    className="input-base map-lib-rename-input"
                    style={{ background: "rgba(18,32,48,0.7)", borderColor: accent, fontSize: 13, padding: "4px 7px" }}
                  />
                  <div className="map-lib-btn-row">
                    <button
                      onClick={() => handleSaveRename(map.id)}
                      className="map-lib-btn"
                      style={{ background: accentDim, border: `1px solid ${accent}`, color: accentBright }}
                    >Save</button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="map-lib-btn"
                      style={{ border: `1px solid ${border}`, color: textMuted }}
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: "'Crimson Text', Georgia, serif", fontSize: 13, color: text, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {displayMapName(map)}
                </div>
              )}

              {isActive && !isRenaming && (
                <div style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: 11, letterSpacing: "0.1em", color: "#66cc66" }}>● Active</div>
              )}

              {!isRenaming && !isDeleting && (
                <div className="map-lib-actions">
                  {!isActive && (
                    <button
                      onClick={() => handleSetActive(map.id)}
                      className="map-lib-btn"
                      style={{ background: accentDim, border: `1px solid ${accent}`, color: accentBright, padding: "4px 0" }}
                    >Set Active</button>
                  )}
                  <div className="map-lib-btn-row">
                    <button
                      onClick={() => handleStartRename(map)}
                      className="map-lib-btn"
                      style={{ border: `1px solid ${border}`, color: textMuted }}
                    >Rename</button>
                    <button
                      onClick={() => { setDeletingId(map.id); setRenamingId(null); }}
                      className="map-lib-btn"
                      style={{ border: "1px solid rgba(192,96,96,0.3)", color: "#c06060" }}
                    >Delete</button>
                  </div>
                </div>
              )}

              {isDeleting && (
                <div style={{ marginTop: "auto" }}>
                  <div style={{ fontFamily: "'Crimson Text', Georgia, serif", fontSize: 12, color: "#c06060", marginBottom: 4 }}>Delete this map?</div>
                  <div className="map-lib-btn-row">
                    <button
                      onClick={() => handleDelete(map.id)}
                      className="map-lib-btn"
                      style={{ background: "rgba(120,40,40,0.3)", border: "1px solid rgba(192,96,96,0.5)", color: "#c06060" }}
                    >Delete</button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="map-lib-btn"
                      style={{ border: `1px solid ${border}`, color: textMuted }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const emptyState = <div className="map-lib-empty">No maps in library. Upload one to get started.</div>;

  const content = (
    <div style={palVars}>
      <div className="flex-row-spread" style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: accentBright }}>Map Library</div>
        <div className="flex-row" style={{ gap: 10 }}>
          <button
            onClick={() => { setUploadFile(null); setUploadOpen(true); }}
            className="btn-primary"
            style={{ padding: "6px 14px" }}
          >
            Upload
          </button>
          {!asPage && (
            <button
              onClick={() => onLibraryChange("close")}
              aria-label="Close map library"
              className="btn-ghost"
              style={{ fontSize: 13, lineHeight: 1, padding: "6px 10px" }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ color: "#c06060", fontFamily: "'Crimson Text', Georgia, serif", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

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
    <div
      className="modal-overlay"
      style={{ zIndex: 999 }}
      onClick={(e) => { if (e.target === e.currentTarget) { /* close handled by parent */ } }}
    >
      <div
        className="modal-panel"
        style={{ maxWidth: 680, maxHeight: "85vh", overflowY: "auto", background: "rgba(10,15,24,0.97)" }}
      >
        {content}
      </div>
    </div>
  );
}
