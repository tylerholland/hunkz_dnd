import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PALETTES } from "../components/CharacterSheet";
import {
  updateCharacter,
  deleteCharacter,
  getSessionState,
  verifyPassword as apiVerify,
} from "../api";
import { useAdaptivePolling, useQueuedRefresh, ACTIVE_POLL_MS, BACKGROUND_POLL_MS } from "../lib/liveSync";
import { useSessionSocket } from "../lib/useSessionSocket";
import { reportServerBuildVersion } from "../lib/staleClient";
import CharacterSheetSessionMode from "../features/characterSheet/CharacterSheetSessionMode";
import "./pages.css";

function deriveModeFromPath(pathname) {
  if (pathname.endsWith("/session")) return "session";
  if (pathname.endsWith("/profile")) return "profile";
  return null;
}

function readStoredCredential(slug) {
  const dmPwd = sessionStorage.getItem("dnd_dm_password");
  if (dmPwd !== null) {
    return {
      password: dmPwd,
      onFail: () => sessionStorage.removeItem("dnd_dm_password"),
    };
  }

  const charPwd = sessionStorage.getItem(`dnd_char_${slug}`);
  if (charPwd !== null) {
    return {
      password: charPwd,
      onFail: () => sessionStorage.removeItem(`dnd_char_${slug}`),
    };
  }

  return { password: "", onFail: null };
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
  const [npcCombat, setNpcCombat] = useState({ npcs: [] });
  // Stories 52–54 — GET /session-state's serverTime for damage/condition age
  // arithmetic on the player's Map sub-tab.
  const [serverTime, setServerTime] = useState(null);
  const [authState, setAuthState] = useState(() => (slug ? "checking" : "locked"));
  const [sessionPassword, setSessionPassword] = useState(null);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState(null);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);

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

  // Interim until Story 42's in-place profile view: profile mode redirects to
  // the classic sheet. The old placeholder ("Open Full Character Sheet" stub)
  // read as a blank page.
  useEffect(() => {
    if (mode === "profile") navigate(`/characters/${slug}`, { replace: true });
  }, [mode, slug, navigate]);

  const applyVerifiedAccess = useCallback((password, role) => {
    setSessionPassword(password);
    setAuthState("authed");
    setUnlockError(null);
    if (role === "dm") sessionStorage.setItem("dnd_dm_password", password);
    else sessionStorage.setItem(`dnd_char_${slug}`, password);
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setAuthState("locked");
      return;
    }

    let cancelled = false;
    setAuthState("checking");
    setSessionPassword(null);
    setUnlockError(null);
    setUnlockInput("");

    const { password, onFail } = readStoredCredential(slug);

    (async () => {
      try {
        const result = await apiVerify(slug, password);
        if (cancelled) return;
        if (result.valid) {
          applyVerifiedAccess(password, result.role);
          return;
        }
      } catch {}

      if (cancelled) return;
      onFail?.();
      setAuthState("locked");
    })();

    return () => {
      cancelled = true;
    };
  }, [applyVerifiedAccess, slug]);

  // Story 35 — one consolidated request per poll tick instead of 4
  // (character, map library, party status, public initiative).
  const fetchSessionState = useCallback(async ({ background = false, force = false } = {}) => {
    if (!slug || authState !== "authed") return;
    if (background && activeRequestCountRef.current > 0 && !force) return;

    const requestId = ++requestSeqRef.current;
    activeRequestCountRef.current += 1;
    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      const d = await getSessionState({ slug, dmPassword: sessionPassword });
      if (!Array.isArray(d?.character?.collections)) {
        throw new Error("Invalid character payload");
      }
      if (requestId !== requestSeqRef.current) return;
      setData(d.character);
      if (d.character?.palette) sessionStorage.setItem(`dnd_palette_${slug}`, d.character.palette);
      setMapLibrary(d.mapLibrary || { activeMapId: null, activeMapView: null, maps: [] });
      setPartyStatus(d.partyStatus || { visible: true, members: [] });
      setInitiativeData(d.initiativePublic || { round: 1, activeTurnIndex: 0, entries: [] });
      setNpcCombat(d.npcCombat || d.npcCombatPublic || { npcs: [] });
      setServerTime(d.serverTime || null);
      reportServerBuildVersion(d.buildVersion);
      setError(null);
    } catch {
      if (requestId !== requestSeqRef.current) return;
      setError("not_found");
    } finally {
      activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [authState, sessionPassword, slug]);

  const queueSessionSync = useQueuedRefresh(fetchSessionState);

  useEffect(() => {
    if (authState !== "authed") return;
    fetchSessionState();
  }, [authState, fetchSessionState]);

  // Story 36 — WebSocket nudge channel. When connected, a "changed" push
  // triggers an immediate refetch and the adaptive poll interval relaxes to
  // the 30s safety net; when not connected, ADR-011 cadence resumes unchanged.
  const handleSessionChanged = useCallback(() => queueSessionSync(0), [queueSessionSync]);
  const { connected: wsConnected } = useSessionSocket(handleSessionChanged);

  useAdaptivePolling({
    enabled: !!slug && authState === "authed",
    poll: fetchSessionState,
    activeMs: wsConnected ? BACKGROUND_POLL_MS : ACTIVE_POLL_MS,
  });

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
  // Derived from server truth (battleMapId) so it updates atomically with putMapActive,
  // avoiding the race where patchMapTokens PutCommand could revert activeMapId.
  const isBattleMode = !!(mapLibrary.activeMapId && mapLibrary.activeMapId === mapLibrary.battleMapId);

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setUnlockSubmitting(true);
    setUnlockError(null);

    try {
      const result = await apiVerify(slug, unlockInput);
      if (result.valid) {
        applyVerifiedAccess(unlockInput, result.role);
        setUnlockInput("");
      } else {
        setAuthState("locked");
        setUnlockError("Incorrect password.");
      }
    } catch {
      setAuthState("locked");
      setUnlockError("Could not verify password. Please try again.");
    } finally {
      setUnlockSubmitting(false);
    }
  };

  if (authState !== "authed") {
    return (
      <div className="page-centered" style={{ background: spinnerPageBg, padding: 24 }}>
        {authState === "checking" ? (
          <>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `2px solid ${spinnerBg}`, borderTopColor: spinnerColor,
              animation: "spin 0.7s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <form
            onSubmit={handleUnlockSubmit}
            style={{
              width: "100%",
              maxWidth: 360,
              background: pal?.surfaceSolid || "#111e2c",
              border: `1px solid ${pal?.border || "rgba(106,143,168,0.18)"}`,
              borderRadius: 6,
              padding: "28px 24px 24px",
              color: pal?.text || "#c8d8e4",
            }}
          >
            <div style={{
              fontFamily: pal?.fontUI || "IM Fell English",
              fontSize: 11,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: pal?.textMuted || "#6a8fa8",
              marginBottom: 10,
            }}>
              Character Session
            </div>
            <div style={{
              fontFamily: pal?.fontDisplay || "Cinzel",
              fontSize: 24,
              marginBottom: 8,
            }}>
              Password Required
            </div>
            <p style={{
              margin: "0 0 16px",
              fontFamily: pal?.fontBody || "serif",
              color: pal?.textBody || pal?.text || "#c8d8e4",
              lineHeight: 1.6,
            }}>
              Enter this character&apos;s password or the DM password to open the session page.
            </p>
            <input
              type="password"
              autoFocus
              value={unlockInput}
              onChange={(e) => setUnlockInput(e.target.value)}
              placeholder="Character or DM password"
              style={{
                width: "100%",
                background: pal?.surface || "rgba(0,0,0,0.3)",
                border: `1px solid ${pal?.border || "rgba(106,143,168,0.18)"}`,
                borderRadius: 3,
                color: pal?.text || "#c8d8e4",
                fontFamily: pal?.fontBody || "serif",
                fontSize: 16,
                padding: "10px 12px",
                outline: "none",
              }}
            />
            {unlockError ? (
              <div style={{
                marginTop: 10,
                color: "#d27f7f",
                fontFamily: pal?.fontBody || "serif",
                fontSize: 14,
              }}>
                {unlockError}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={unlockSubmitting}
              style={{
                width: "100%",
                marginTop: 16,
                background: "transparent",
                border: `1px solid ${pal?.accent || "#d07a3a"}`,
                borderRadius: 3,
                color: pal?.accentBright || pal?.accent || "#d07a3a",
                fontFamily: pal?.fontUI || "IM Fell English",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "10px 14px",
                cursor: unlockSubmitting ? "default" : "pointer",
                opacity: unlockSubmitting ? 0.65 : 1,
              }}
            >
              {unlockSubmitting ? "Checking..." : "Unlock Session"}
            </button>
          </form>
        )}
      </div>
    );
  }

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
      isBattleMode={isBattleMode}
      sessionPassword={sessionPassword}
      partyStatus={partyStatus}
      initiativeData={initiativeData}
      npcCombat={npcCombat}
      wsConnected={wsConnected}
      serverTime={serverTime}
    />
  );
}
