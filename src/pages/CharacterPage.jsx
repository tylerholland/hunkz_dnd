import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CharacterSheet, { PALETTES } from "../components/CharacterSheet";
import { getCharacter, updateCharacter, deleteCharacter } from "../api";

const ACTIVE_POLL_MS = 1000;
const BACKGROUND_POLL_MS = 5000;

export default function CharacterPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const requestSeqRef = useRef(0);
  const activeRequestCountRef = useRef(0);
  const sessionSyncTimerRef = useRef(null);

  // Read cached palette for this slug so the spinner matches on return visits
  const cachedPalette = sessionStorage.getItem(`dnd_palette_${slug}`);
  const pal = PALETTES[cachedPalette] || null;
  const spinnerColor   = pal ? pal.accent       : "rgba(255,255,255,0.35)";
  const spinnerBg      = pal ? `${pal.accent}22` : "rgba(255,255,255,0.08)";
  const spinnerPageBg  = pal ? pal.bg            : "#0d0f14";

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

  const queueSessionSync = useCallback((delay = 75) => {
    clearTimeout(sessionSyncTimerRef.current);
    sessionSyncTimerRef.current = setTimeout(() => {
      fetchCharacter({ background: true, force: true });
    }, delay);
  }, [fetchCharacter]);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  useEffect(() => {
    if (!slug) return;
    let timeoutId = null;
    let stopped = false;

    const getDelay = () =>
      document.visibilityState === "visible" && document.hasFocus()
        ? ACTIVE_POLL_MS
        : BACKGROUND_POLL_MS;

    const scheduleNext = () => {
      if (stopped) return;
      timeoutId = setTimeout(async () => {
        await fetchCharacter({ background: true });
        scheduleNext();
      }, getDelay());
    };

    const reschedule = () => {
      clearTimeout(timeoutId);
      scheduleNext();
    };

    scheduleNext();
    document.addEventListener("visibilitychange", reschedule);
    window.addEventListener("focus", reschedule);
    window.addEventListener("blur", reschedule);

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", reschedule);
      window.removeEventListener("focus", reschedule);
      window.removeEventListener("blur", reschedule);
    };
  }, [fetchCharacter, slug]);

  useEffect(() => () => clearTimeout(sessionSyncTimerRef.current), []);

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
      <div style={{ ...centeredStyle, background: spinnerPageBg }}>
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
      <div style={centeredStyle}>
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
    />
  );
}

const centeredStyle = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  background: "#0d0f14",
};
