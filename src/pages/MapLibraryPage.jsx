import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { getMapLibrary, putMapActive } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import { PalCtx } from "../features/dmDashboard/dashboardShared";
import DmLoginPrompt from "../features/dmDashboard/DmLoginPrompt";
import MapLibraryModal from "../features/dmDashboard/MapLibraryModal";
import MapUploadModal from "../features/dmDashboard/MapUploadModal";
import { isSupportedMapContentType } from "../features/maps/mapFiles";

export default function MapLibraryPage() {
  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem("dnd_dm_password"));
  const [checking, setChecking] = useState(false);
  const [mapLibrary, setMapLibrary] = useState({ activeMapId: null, activeMapView: null, maps: [] });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const pal = PALETTES.ocean || Object.values(PALETTES)[0];

  const fetchLibrary = useCallback(async () => {
    try {
      const data = await getMapLibrary();
      setMapLibrary(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (authed) fetchLibrary();
  }, [authed, fetchLibrary]);

  const handleLibraryChange = (action) => {
    if (action === "close") return;
    fetchLibrary();
  };

  const handleUploaded = () => {
    fetchLibrary();
    setUploadOpen(false);
    setUploadFile(null);
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

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt checking={checking} onSuccess={(pw) => {
          setDmPassword(pw);
          setChecking(false);
          setAuthed(true);
        }} />
      </PalCtx.Provider>
    );
  }

  return (
    <PalCtx.Provider value={pal}>
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}`,
          color: pal.text,
          position: "relative",
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {draggingOver && (
          <div style={{ position: "fixed", inset: 0, border: `3px dashed ${pal.accent}`, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", zIndex: 900, pointerEvents: "none" }}>
            <div style={{ fontFamily: pal.fontUI, fontSize: 16, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accentBright, background: "rgba(10,15,24,0.9)", padding: "12px 28px", borderRadius: 4 }}>Drop to upload</div>
          </div>
        )}

        {/* Top bar */}
        <div style={{ background: "rgba(11,14,20,0.97)", borderBottom: `1px solid ${pal.border}`, display: "flex", alignItems: "center", gap: 12, padding: "0 24px", height: 48 }}>
          <div style={{ fontFamily: pal.fontDisplay, fontSize: 15, letterSpacing: "0.12em", color: pal.accentBright, flex: 1 }}>Map Library</div>
          <button
            onClick={() => { setUploadFile(null); setUploadOpen(true); }}
            style={{ background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", padding: "5px 13px", cursor: "pointer" }}
          >
            Upload
          </button>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "12px 24px 0" }}>
          <Link to="/dm" style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.textMuted, textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = pal.accentBright; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = pal.textMuted; }}
          >← Campaign</Link>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
          <MapLibraryModal
            mapLibrary={mapLibrary}
            dmPassword={dmPassword}
            onLibraryChange={handleLibraryChange}
            asPage={true}
          />
        </div>

        {uploadOpen && (
          <MapUploadModal
            initialFile={uploadFile}
            dmPassword={dmPassword}
            onUploaded={handleUploaded}
            onClose={() => { setUploadOpen(false); setUploadFile(null); }}
          />
        )}
      </div>
    </PalCtx.Provider>
  );
}
