import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CharacterSheet, { PALETTES } from "../components/CharacterSheet";
import { updateCharacter, deleteCharacter, getSessionState } from "../api";
import { useAdaptivePolling, useQueuedRefresh } from "../lib/liveSync";
import { reportServerBuildVersion } from "../lib/staleClient";
import "./pages.css";

export default function CharacterPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [mapLibrary, setMapLibrary] = useState({ activeMapId: null, activeMapView: null, maps: [] });
  const requestSeqRef = useRef(0);
  const activeRequestCountRef = useRef(0);

  // Read cached palette for this slug so the spinner matches on return visits
  const cachedPalette = sessionStorage.getItem(`dnd_palette_${slug}`);
  const pal = PALETTES[cachedPalette] || null;
  const spinnerColor   = pal ? pal.accent       : "rgba(255,255,255,0.35)";
  const spinnerBg      = pal ? `${pal.accent}22` : "rgba(255,255,255,0.08)";
  const spinnerPageBg  = pal ? pal.bg            : "#0d0f14";

  // Story 35b — one consolidated request per poll tick instead of two
  // (character + map library). The cached credential (DM password takes
  // precedence over the per-character owner password, mirroring the
  // unlock precedence in CharacterSheet.jsx) is read fresh on every tick
  // so the owner/DM variant (with playerNotes) kicks in as soon as the
  // sheet is unlocked mid-session.
  const fetchSessionState = useCallback(async ({ background = false, force = false } = {}) => {
    if (!slug) return;
    if (background && activeRequestCountRef.current > 0 && !force) return;

    const requestId = ++requestSeqRef.current;
    activeRequestCountRef.current += 1;
    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      const dmPwd = sessionStorage.getItem("dnd_dm_password");
      const charPwd = sessionStorage.getItem(`dnd_char_${slug}`);
      const password = dmPwd || charPwd || undefined;

      const d = await getSessionState({ slug, dmPassword: password });
      if (!Array.isArray(d?.character?.collections)) {
        throw new Error("Invalid character payload");
      }
      if (requestId !== requestSeqRef.current) return;
      setData(d.character);
      if (d.character?.palette) sessionStorage.setItem(`dnd_palette_${slug}`, d.character.palette);
      setMapLibrary(d.mapLibrary || { activeMapId: null, activeMapView: null, maps: [] });
      reportServerBuildVersion(d.buildVersion);
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

  const queueSessionSync = useQueuedRefresh(fetchSessionState);

  useEffect(() => {
    fetchSessionState();
  }, [fetchSessionState]);

  useAdaptivePolling({
    enabled: !!slug,
    poll: fetchSessionState,
  });

  const activeMap = mapLibrary.maps?.find((m) => m.id === mapLibrary.activeMapId) || null;
  const activeMapView = activeMap && mapLibrary.activeMapView?.mapId === activeMap.id ? mapLibrary.activeMapView : null;

  const handleSave = async (charData, password) => {
    await updateCharacter(slug, charData, password);
    setData(charData);
    if (charData?.palette) sessionStorage.setItem(`dnd_palette_${slug}`, charData.palette);
  };

  const handleDelete = async (password) => {
    await deleteCharacter(slug, password);
    sessionStorage.removeItem(`dnd_char_${slug}`);
    sessionStorage.removeItem(`dnd_palette_${slug}`);
    navigate("/");
  };

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
    <CharacterSheet
      initialData={data}
      slug={slug}
      onSave={handleSave}
      onDelete={handleDelete}
      onSessionSync={queueSessionSync}
      activeMap={activeMap}
      activeMapView={activeMapView}
    />
  );
}

// centeredStyle replaced by .page-centered CSS class in pages.css
