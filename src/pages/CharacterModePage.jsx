import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PALETTES } from "../components/CharacterSheet";
import {
  getCharacter,
  updateCharacter,
  deleteCharacter,
  getMapLibrary,
  getPartyStatus,
  getInitiativePublic,
} from "../api";
import { useAdaptivePolling, useQueuedRefresh } from "../lib/liveSync";
import CharacterSheetSessionMode from "../features/characterSheet/CharacterSheetSessionMode";
import "./pages.css";

function deriveModeFromPath(pathname) {
  if (pathname.endsWith("/session")) return "session";
  if (pathname.endsWith("/profile")) return "profile";
  return null;
}

export default function CharacterModePage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const location = useLocation();

  // Mode comes from URL path; sessionStorage provides a fallback on first visit
  const pathMode = deriveModeFromPath(location.pathname);
  const storedMode = sessionStorage.getItem(`dnd_mode_${slug}`);
  const initialMode = pathMode || storedMode || "profile";

  const [mode, setModeState] = useState(initialMode);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapLibrary, setMapLibrary] = useState({ activeMapId: null, activeMapView: null, maps: [] });
  const [partyStatus, setPartyStatus] = useState({ visible: true, members: [] });
  const [initiativeData, setInitiativeData] = useState({ round: 1, activeTurnIndex: 0, entries: [] });

  const requestSeqRef = useRef(0);
  const activeRequestCountRef = useRef(0);
  // Track whether we've already applied auto-switch logic
  const autoSwitchedRef = useRef(false);

  // Palette spinner colors derived from cached palette
  const cachedPalette = sessionStorage.getItem(`dnd_palette_${slug}`);
  const pal = PALETTES[cachedPalette] || null;
  const spinnerColor = pal ? pal.accent : "rgba(255,255,255,0.35)";
  const spinnerBg = pal ? `${pal.accent}22` : "rgba(255,255,255,0.08)";
  const spinnerPageBg = pal ? pal.bg : "#0d0f14";

  // Persist mode and navigate to matching URL
  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    sessionStorage.setItem(`dnd_mode_${slug}`, newMode);
    navigate(`/characters/${slug}/${newMode}`, { replace: true });
  }, [slug, navigate]);

  // Keep mode in sync when URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    const urlMode = deriveModeFromPath(location.pathname);
    if (urlMode && urlMode !== mode) {
      setModeState(urlMode);
      sessionStorage.setItem(`dnd_mode_${slug}`, urlMode);
    }
  }, [location.pathname, mode, slug]);

  // Character data fetch
  const fetchCharacter = useCallback(async ({ background = false, force = false } = {}) => {
    if (!slug) return;
    if (background && activeRequestCountRef.current > 0 && !force) return;

    const requestId = ++requestSeqRef.current;
    activeRequestCountRef.current += 1;
    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      const d = await getCharacter(slug);
      if (!Array.isArray(d?.collections)) {
        throw new Error("Invalid character payload");
      }
      if (requestId !== requestSeqRef.current) return;
      setData(d);
      if (d?.palette) sessionStorage.setItem(`dnd_palette_${slug}`, d.palette);
      setError(null);
    } catch {
      if (requestId !== requestSeqRef.current) return;
      setError("not_found");
    } finally {
      activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
      if (!background && requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [slug]);

  const queueSessionSync = useQueuedRefresh(fetchCharacter);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  useAdaptivePolling({ enabled: !!slug, poll: fetchCharacter });

  // Map library fetch
  const fetchMapLibrary = useCallback(async () => {
    try {
      const d = await getMapLibrary();
      setMapLibrary(d || { activeMapId: null, activeMapView: null, maps: [] });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMapLibrary(); }, [fetchMapLibrary]);
  useAdaptivePolling({ enabled: !!slug, poll: fetchMapLibrary });

  // Party status fetch (unauthenticated)
  const fetchPartyStatus = useCallback(async () => {
    try {
      const d = await getPartyStatus();
      setPartyStatus(d || { visible: true, members: [] });
    } catch { /* ignore — strip will show empty state */ }
  }, []);

  useEffect(() => { fetchPartyStatus(); }, [fetchPartyStatus]);
  useAdaptivePolling({ enabled: !!slug, poll: fetchPartyStatus });

  // Initiative public fetch (unauthenticated)
  const fetchInitiative = useCallback(async () => {
    try {
      const d = await getInitiativePublic();
      setInitiativeData(d || { round: 1, activeTurnIndex: 0, entries: [] });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchInitiative(); }, [fetchInitiative]);
  useAdaptivePolling({ enabled: !!slug, poll: fetchInitiative });

  // Auto-switch to session mode when initiative is active and no stored preference
  useEffect(() => {
    if (autoSwitchedRef.current) return;
    if (!storedMode && pathMode === null) {
      // No explicit URL segment and no sessionStorage pref
      const { entries, round } = initiativeData;
      if (Array.isArray(entries) && entries.length > 0 && round > 0) {
        autoSwitchedRef.current = true;
        setMode("session");
      }
    }
  }, [initiativeData, storedMode, pathMode, setMode]);

  // Handlers
  const handleSave = async (charData, password) => {
    await updateCharacter(slug, charData, password);
    setData(charData);
    if (charData?.palette) sessionStorage.setItem(`dnd_palette_${slug}`, charData.palette);
  };

  const handleDelete = async (password) => {
    await deleteCharacter(slug, password);
    sessionStorage.removeItem(`dnd_char_${slug}`);
    sessionStorage.removeItem(`dnd_palette_${slug}`);
    sessionStorage.removeItem(`dnd_mode_${slug}`);
    navigate("/");
  };

  const activeMap = mapLibrary.maps?.find((m) => m.id === mapLibrary.activeMapId) || null;
  const activeMapView = activeMap && mapLibrary.activeMapView?.mapId === activeMap.id
    ? mapLibrary.activeMapView
    : null;

  if (loading) {
    return (
      <div className="page-centered" style={{ background: spinnerPageBg }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `2px solid ${spinnerBg}`, borderTopColor: spinnerColor,
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-centered" style={{ background: "#0d0f14" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 16, opacity: 0.5, color: "#6a8fa8", fontFamily: "sans-serif" }}>
          404
        </div>
        <div style={{ fontFamily: "'Crimson Text', Georgia, serif", fontSize: 18, color: "#6a8fa8" }}>
          No character found for <em>{slug}</em>.
        </div>
        <div style={{ marginTop: 8, fontSize: 14, opacity: 0.5, color: "#6a8fa8", fontFamily: "sans-serif" }}>
          <a href="/" style={{ color: "inherit" }}>← Back to characters</a>
        </div>
      </div>
    );
  }

  return (
    <CharacterSheetSessionMode
      initialData={data}
      slug={slug}
      mode={mode}
      setMode={setMode}
      onSave={handleSave}
      onDelete={handleDelete}
      onSessionSync={queueSessionSync}
      activeMap={activeMap}
      activeMapView={activeMapView}
      partyStatus={partyStatus}
      initiativeData={initiativeData}
    />
  );
}
