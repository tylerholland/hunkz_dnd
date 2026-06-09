import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import MapViewer, { getMapZoomModifierLabel, readMapFreeZoomPreference, writeMapFreeZoomPreference } from "../maps/MapViewer";
import MapLibraryModal from "./MapLibraryModal";
import { putMapActive, putMapView, patchMapTokens } from "../../api";
import { displayMapName } from "./MapUploadModal";
import { isPdfMap } from "../maps/mapFiles";
import TokenTray from "./battleMode/TokenTray";
import { TokenChip, HeldTokenFloater } from "./battleMode/BattleModeController";
import BattleModeToggle from "./battleMode/BattleModeToggle";
import "./battleMode.css";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function MapPanel({ mapLibrary, dmPassword, onLibraryChange, pal, collapsedOverride = null, party, npcCombat }) {
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

  // Battle mode state
  const [localTokens, setLocalTokens] = useState(null); // null = use server state
  const [localMapMode, setLocalMapMode] = useState(null); // null = use server state
  const [heldSourceId, setHeldSourceId] = useState(null);
  const [heldType, setHeldType] = useState(null);
  const floaterRef = useRef(null);
  const rafRef = useRef(null);
  const viewerContainerRef = useRef(null);

  useEffect(() => {
    if (collapsedOverride === null) return;
    setCollapsed(Boolean(collapsedOverride));
  }, [collapsedOverride]);

  const maps = mapLibrary?.maps || [];
  const activeMapId = mapLibrary?.activeMapId || null;
  const activeMap = maps.find((m) => m.id === activeMapId) || null;
  const publishedView = activeMap && mapLibrary?.activeMapView?.mapId === activeMap.id ? mapLibrary.activeMapView : null;
  const activeMapLabel = activeMap ? displayMapName(activeMap) : "";
  // Optimistic mapMode: local state overrides server until server confirms
  const isBattleMode = localMapMode !== null ? localMapMode === "battle" : activeMap?.mapMode === "battle";
  const isPdf = activeMap ? isPdfMap({ imageUrl: activeMap.imageUrl, contentType: activeMap.contentType, name: activeMap.name }) : false;

  // Effective tokens: local optimistic state overrides server state
  const effectiveTokens = localTokens !== null ? localTokens : (activeMap?.tokens || []);

  // Reset local optimistic state only when the active map itself changes.
  // Do NOT depend on activeMap?.tokens — that reference changes every poll tick
  // even when content is unchanged, which would kill the optimistic battle-mode state.
  useEffect(() => {
    setLocalTokens(null);
    setLocalMapMode(null);
    setHeldSourceId(null);
    setHeldType(null);
  }, [activeMapId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [activeMapId, maps.length, libraryOpen, publishedView, isBattleMode]);

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

  // Resize handle
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

  // ── Battle mode ──────────────────────────────────────────────────────────

  const writeTokens = useCallback(async (newTokens, newMapMode) => {
    const payload = { tokens: newTokens };
    if (newMapMode !== undefined) payload.mapMode = newMapMode;
    // Apply optimistically so UI responds immediately
    setLocalTokens(newTokens);
    if (newMapMode !== undefined) setLocalMapMode(newMapMode);
    try {
      await patchMapTokens(activeMap.id, payload, dmPassword);
      onLibraryChange();
    } catch { /* ignore — optimistic state holds until next poll */ }
  }, [activeMap, dmPassword, onLibraryChange]);

  const handleToggleBattleMode = useCallback(async () => {
    if (!activeMap || isPdf) return;
    const newMode = isBattleMode ? "adventure" : "battle";
    if (isBattleMode && effectiveTokens.length > 0) {
      if (!window.confirm(`Disable Battle Mode? This will clear all ${effectiveTokens.length} placed token${effectiveTokens.length === 1 ? "" : "s"}.`)) return;
    }
    setHeldSourceId(null);
    setHeldType(null);
    await writeTokens([], newMode);
  }, [activeMap, isPdf, isBattleMode, effectiveTokens, writeTokens]);

  // Escape key cancels held state
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && heldSourceId) {
        setHeldSourceId(null);
        setHeldType(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [heldSourceId]);

  // rAF-driven floater tracking
  useEffect(() => {
    if (!heldSourceId) return;

    const handlePointerMove = (e) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (floaterRef.current) {
          floaterRef.current.style.left = `${e.clientX}px`;
          floaterRef.current.style.top = `${e.clientY}px`;
        }
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [heldSourceId]);

  const handleSelectToken = useCallback((sourceId, type) => {
    setHeldSourceId((prev) => prev === sourceId ? null : sourceId);
    setHeldType(type);
  }, []);

  // Drop held token back into the tray (removes it from the map entirely)
  const handleDropToTray = useCallback(() => {
    if (!heldSourceId) return;
    const next = effectiveTokens.filter((t) => t.sourceId !== heldSourceId);
    setHeldSourceId(null);
    setHeldType(null);
    writeTokens(next);
  }, [heldSourceId, effectiveTokens, writeTokens]);

  const handleTokenLayerClick = useCallback((frac) => {
    if (!heldSourceId || !activeMap) return;
    const newToken = {
      id: genId(),
      type: heldType,
      sourceId: heldSourceId,
      x: frac.x,
      y: frac.y,
    };
    // Remove any existing token for this source (move, not duplicate)
    const filtered = effectiveTokens.filter((t) => t.sourceId !== heldSourceId);
    const next = [...filtered, newToken];
    setHeldSourceId(null);
    setHeldType(null);
    writeTokens(next);
  }, [heldSourceId, heldType, activeMap, effectiveTokens, writeTokens]);

  const handleTokenClick = useCallback((tokenId) => {
    const token = effectiveTokens.find((t) => t.id === tokenId);
    if (!token) return;
    if (heldSourceId === token.sourceId) {
      setHeldSourceId(null);
      setHeldType(null);
    } else {
      setHeldSourceId(token.sourceId);
      setHeldType(token.type);
    }
  }, [effectiveTokens, heldSourceId]);

  const handleRemoveToken = useCallback((tokenId) => {
    const next = effectiveTokens.filter((t) => t.id !== tokenId);
    writeTokens(next);
  }, [effectiveTokens, writeTokens]);

  const handleEndCombat = useCallback(async () => {
    setHeldSourceId(null);
    setHeldType(null);
    await writeTokens([], "adventure");
  }, [writeTokens]);

  const handleResetTray = useCallback(() => {
    setHeldSourceId(null);
    setHeldType(null);
    writeTokens([]);
  }, [writeTokens]);

  // Build chip nodes for token layer
  const tokenChips = isBattleMode ? effectiveTokens.map((token) => (
    <TokenChip
      key={token.id}
      token={token}
      imageW={viewerState?.naturalSize?.w || 1}
      imageH={viewerState?.naturalSize?.h || 1}
      party={party || []}
      npcCombat={npcCombat || { npcs: [] }}
      isDm={true}
      isOwnToken={false}
      partyVisibilityEnabled={true}
      isHeld={heldSourceId === token.sourceId}
      onTokenClick={handleTokenClick}
      onRemoveToken={handleRemoveToken}
      viewerContainerRef={viewerContainerRef}
      pal={pal}
    />
  )) : null;

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
          {activeMap ? `Map: ${activeMapLabel}` : "Map"}
        </div>
        {activeMap && (
          <BattleModeToggle
            active={isBattleMode}
            disabled={isPdf}
            onClick={(e) => { e.stopPropagation(); handleToggleBattleMode(); }}
            pal={pal}
          />
        )}
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
              <div style={{ position: "relative" }}>
                <MapViewer
                  imageUrl={activeMap.imageUrl}
                  name={activeMap.name}
                  contentType={activeMap.contentType}
                  height={mapHeight}
                  pal={pal}
                  publishedView={publishedView}
                  onViewChange={setViewerState}
                  freeZoom={freeZoom}
                  interactionMode={isBattleMode ? "dm" : undefined}
                  onTokenLayerClick={isBattleMode && heldSourceId ? handleTokenLayerClick : undefined}
                  onTokenClick={isBattleMode ? handleTokenClick : undefined}
                  tokenLayerChildren={tokenChips}
                  containerRefOut={viewerContainerRef}
                />
                {isBattleMode && heldSourceId && (
                  <button
                    type="button"
                    className="token-cancel-pill"
                    onClick={() => { setHeldSourceId(null); setHeldType(null); }}
                  >
                    × Cancel
                  </button>
                )}
              </div>

              {isBattleMode && (
                <TokenTray
                  party={party || []}
                  npcCombat={npcCombat || { npcs: [] }}
                  placedTokens={effectiveTokens}
                  heldId={heldSourceId}
                  onSelect={handleSelectToken}
                  onDropToTray={handleDropToTray}
                  onEndCombat={handleEndCombat}
                  onResetTray={handleResetTray}
                  pal={pal}
                />
              )}

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

      {/* Held token floater — rendered in document.body so it escapes overflow:hidden */}
      {heldSourceId && createPortal(
        <HeldTokenFloater
          ref={floaterRef}
          heldSourceId={heldSourceId}
          heldType={heldType}
          party={party || []}
          npcCombat={npcCombat || { npcs: [] }}
          pal={pal}
        />,
        document.body
      )}
    </div>
  );
}
