import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import MapViewer, { getMapZoomModifierLabel, readMapFreeZoomPreference, writeMapFreeZoomPreference } from "../maps/MapViewer";
import MapLibraryModal from "./MapLibraryModal";
import { putMapView, patchMapTokens, putMapCalibration, putMapRotation, putNpcCombat } from "../../api";
import CalibrationPopover from "./battleMode/CalibrationPopover";
import { displayMapName } from "./MapUploadModal";
import { isPdfMap } from "../maps/mapFiles";
import TokenTray from "./battleMode/TokenTray";
import { TokenChip, HeldTokenFloater } from "./battleMode/BattleModeController";
import "./battleMode.css";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function MapPanel({ mapLibrary, dmPassword, onLibraryChange, pal, collapsedOverride = null, party, npcCombat, combatMode, mapSwitching = false, onRegisterBattleToggle }) {
  const [collapsed, setCollapsed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewerState, setViewerState] = useState(null);
  const [mapHeight, setMapHeight] = useState(() => {
    const saved = Number(sessionStorage.getItem("dnd_dm_map_height") || 300);
    return Number.isFinite(saved) ? Math.max(220, Math.min(window.innerHeight - 120, saved)) : 300;
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
  const [dmToast, setDmToast] = useState(null); // "entering" | "leaving" | null
  const dmToastTimerRef = useRef(null);
  const floaterRef = useRef(null);
  const rafRef = useRef(null);
  const viewerContainerRef = useRef(null);
  const autoPubTimerRef = useRef(null);

  // Calibration state (token scale)
  const [localTokenScale, setLocalTokenScale] = useState(null); // null = use server state
  const [calibOpen, setCalibOpen] = useState(false);
  const [calibTweening, setCalibTweening] = useState(false);
  const calibWriteTimerRef = useRef(null);
  const calibTweenTimerRef = useRef(null);
  const tokenResizeWriteTimerRef = useRef(null); // Story 44
  const [localRotation, setLocalRotation] = useState(null); // Story 45 — null = use server state
  const rotationWriteTimerRef = useRef(null); // Story 45

  useEffect(() => {
    if (collapsedOverride === null) return;
    setCollapsed(Boolean(collapsedOverride));
  }, [collapsedOverride]);

  const maps = mapLibrary?.maps || [];
  const activeMapId = mapLibrary?.activeMapId || null;
  const activeMap = maps.find((m) => m.id === activeMapId) || null;
  const publishedView = activeMap && mapLibrary?.activeMapView?.mapId === activeMap.id ? mapLibrary.activeMapView : null;
  const activeMapLabel = activeMap ? displayMapName(activeMap) : "";
  // Optimistic mapMode: local state overrides server until server confirms.
  // combatMode prop intentionally excluded here — it tracks page-level UI chrome,
  // not the map's actual mapMode. Mixing them inverts the toggle direction.
  const isBattleMode = localMapMode !== null ? localMapMode === "battle" : activeMap?.mapMode === "battle";
  const isPdf = activeMap ? isPdfMap({ imageUrl: activeMap.imageUrl, contentType: activeMap.contentType, name: activeMap.name }) : false;

  // Effective tokens: local optimistic state overrides server state
  const effectiveTokens = localTokens !== null ? localTokens : (activeMap?.tokens || []);
  // Effective token scale: local optimistic state overrides server state
  const tokenScale = localTokenScale !== null ? localTokenScale : (activeMap?.tokenScale ?? 1);
  const viewerZoom = viewerState?.scale ?? 1;
  const labelsHidden = tokenScale * viewerZoom < 0.6;

  // Reset local optimistic state only when the active map itself changes.
  // Do NOT depend on activeMap?.tokens — that reference changes every poll tick
  // even when content is unchanged, which would kill the optimistic battle-mode state.
  useEffect(() => {
    setLocalTokens(null);
    setLocalMapMode(null);
    setHeldSourceId(null);
    setHeldType(null);
    setLocalTokenScale(null);
    setCalibOpen(false);
    setLocalRotation(null);
  }, [activeMapId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (calibWriteTimerRef.current) clearTimeout(calibWriteTimerRef.current);
    if (calibTweenTimerRef.current) clearTimeout(calibTweenTimerRef.current);
    if (tokenResizeWriteTimerRef.current) clearTimeout(tokenResizeWriteTimerRef.current);
    if (rotationWriteTimerRef.current) clearTimeout(rotationWriteTimerRef.current);
  }, []);

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

  // Auto-publish the DM's viewport 800ms after pan/zoom settles so players
  // always open the map centred on where the DM is looking (Story 47a).
  useEffect(() => {
    if (!viewerState || !activeMap?.id || !dmPassword) return;
    clearTimeout(autoPubTimerRef.current);
    autoPubTimerRef.current = setTimeout(() => {
      putMapView({
        mapId: activeMap.id,
        translate: viewerState.translate,
        scale: viewerState.scale,
        pageNumber: viewerState.pageNumber,
      }, dmPassword).catch(() => {});
    }, 800);
    return () => clearTimeout(autoPubTimerRef.current);
  }, [viewerState, activeMap?.id, dmPassword]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize handle
  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      const nextHeight = Math.max(220, Math.min(window.innerHeight - 120, resizeState.startHeight + (event.clientY - resizeState.startY)));
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

  const handleScaleChange = useCallback((nextScale, opts) => {
    if (!activeMap) return;
    const clamped = Math.min(2.5, Math.max(0.5, nextScale));
    setLocalTokenScale(clamped);
    // ± steppers / reset get a brief 120ms tween; slider drag stays 1:1 instant.
    if (opts?.tween) {
      setCalibTweening(true);
      if (calibTweenTimerRef.current) clearTimeout(calibTweenTimerRef.current);
      calibTweenTimerRef.current = setTimeout(() => setCalibTweening(false), 140);
    }
    if (calibWriteTimerRef.current) clearTimeout(calibWriteTimerRef.current);
    calibWriteTimerRef.current = setTimeout(() => {
      putMapCalibration(activeMap.id, clamped, dmPassword).then(onLibraryChange).catch(() => { /* ignore — optimistic state holds */ });
    }, 600);
  }, [activeMap, dmPassword, onLibraryChange]);

  // Story 44 — debounced per-token scale write, modelled on handleScaleChange
  const handleResizeToken = useCallback((tokenId, nextScale) => {
    if (!activeMap) return;
    const clamped = Math.min(3.0, Math.max(0.5, nextScale));
    const next = effectiveTokens.map((t) => t.id === tokenId ? { ...t, scale: clamped } : t);
    setLocalTokens(next);
    if (tokenResizeWriteTimerRef.current) clearTimeout(tokenResizeWriteTimerRef.current);
    tokenResizeWriteTimerRef.current = setTimeout(() => {
      patchMapTokens(activeMap.id, { tokens: next }, dmPassword).then(onLibraryChange).catch(() => { /* optimistic state holds */ });
    }, 300);
  }, [activeMap, effectiveTokens, dmPassword, onLibraryChange]);

  // Story 45 — map rotation
  const effectiveRotation = localRotation !== null ? localRotation : (activeMap?.rotation ?? 0);

  const handleRotate = useCallback((delta) => {
    if (!activeMap) return;
    const current = localRotation !== null ? localRotation : (activeMap?.rotation ?? 0);
    const next = (current + delta + 360) % 360;
    setLocalRotation(next);
    if (rotationWriteTimerRef.current) clearTimeout(rotationWriteTimerRef.current);
    rotationWriteTimerRef.current = setTimeout(() => {
      putMapRotation(activeMap.id, next, dmPassword).then(onLibraryChange).catch(() => { /* optimistic state holds */ });
    }, 600);
  }, [activeMap, localRotation, dmPassword, onLibraryChange]);

  const handleToggleBattleMode = useCallback(async () => {
    if (!activeMap || isPdf) return;
    const newMode = isBattleMode ? "adventure" : "battle";
    setLocalMapMode(newMode);
    setHeldSourceId(null);
    setHeldType(null);
    // Show confirmation toast so the DM knows the switch broadcasts to players
    clearTimeout(dmToastTimerRef.current);
    setDmToast(newMode === "battle" ? "entering" : "leaving");
    dmToastTimerRef.current = setTimeout(() => setDmToast(null), 2800);
    try {
      await patchMapTokens(activeMap.id, { tokens: effectiveTokens, mapMode: newMode }, dmPassword);
      onLibraryChange();
    } catch { /* ignore — localMapMode holds optimistic state */ }
  }, [activeMap, isPdf, isBattleMode, effectiveTokens, dmPassword, onLibraryChange]);

  // Register the battle toggle handler with the parent (DmDashboardPage holds a ref)
  useEffect(() => {
    onRegisterBattleToggle?.(handleToggleBattleMode);
    return () => onRegisterBattleToggle?.(null);
  }, [onRegisterBattleToggle, handleToggleBattleMode]);

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

  const handleClearTokensFromMap = useCallback(() => {
    setHeldSourceId(null);
    setHeldType(null);
    writeTokens([]);
  }, [writeTokens]);

  const handleClearNpcsFromMap = useCallback(() => {
    setHeldSourceId(null);
    setHeldType(null);
    const current = localTokens !== null ? localTokens : (activeMap?.tokens || []);
    writeTokens(current.filter((t) => t.type === "character"));
  }, [localTokens, activeMap, writeTokens]);

  // Cache natural image size per mapId so tokens stay correctly positioned when
  // switching back to a previously-loaded map. For cached images, the browser fires
  // onLoad before useEffect([imageUrl]) resets imageNaturalSize to null — meaning
  // MapViewer's naturalSize stays null permanently on second visit. Reading from this
  // cache bypasses the race and gives correct dimensions immediately.
  const naturalSizeByMapRef = useRef({});
  if (activeMapId && viewerState?.naturalSize?.w) {
    naturalSizeByMapRef.current[activeMapId] = viewerState.naturalSize;
  }
  const effectiveNaturalSize = viewerState?.naturalSize || (activeMapId ? naturalSizeByMapRef.current[activeMapId] : null);

  // Build chip nodes for token layer
  const tokenChips = (isBattleMode && effectiveNaturalSize) ? effectiveTokens.map((token) => (
    <TokenChip
      key={token.id}
      token={token}
      imageW={effectiveNaturalSize.w}
      imageH={effectiveNaturalSize.h}
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
      labelHidden={labelsHidden}
      calibTween={calibTweening}
      onResizeToken={handleResizeToken}
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
        {activeMap && !isPdf && (
          <>
            <button
              type="button"
              className="btn-gear"
              onClick={(e) => { e.stopPropagation(); handleRotate(270); }}
              title="Rotate counter-clockwise"
              aria-label="Rotate counter-clockwise"
              style={{ "--pal-accent": pal.accent, "--pal-accent-dim": pal.accentDim, "--pal-text-muted": pal.textMuted }}
            >
              ↺
            </button>
            <button
              type="button"
              className="btn-gear"
              onClick={(e) => { e.stopPropagation(); handleRotate(90); }}
              title="Rotate clockwise"
              aria-label="Rotate clockwise"
              style={{ "--pal-accent": pal.accent, "--pal-accent-dim": pal.accentDim, "--pal-text-muted": pal.textMuted }}
            >
              ↻
            </button>
          </>
        )}
        {activeMap && isBattleMode && (
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn-gear"
              onClick={() => setCalibOpen((v) => !v)}
              title="Token scale calibration"
              aria-label="Token scale calibration"
              style={{ "--pal-accent": pal.accent, "--pal-accent-dim": pal.accentDim, "--pal-text-muted": pal.textMuted }}
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.61.07-.93 0-.32-.03-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.3-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.09-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.3-.07.63-.07.94s.03.64.07.94l-2.03 1.58c-.18.14-.23.4-.12.6l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.09.47 0 .59-.22l1.92-3.32c.12-.21.07-.47-.12-.6l-2.01-1.58z" />
              </svg>
            </button>
            {calibOpen && (
              <CalibrationPopover
                tokenScale={tokenScale}
                onChange={handleScaleChange}
                onClose={() => setCalibOpen(false)}
                pal={pal}
              />
            )}
          </div>
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
                {mapSwitching && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 10,
                    height: mapHeight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.78)",
                    borderRadius: 3,
                    fontFamily: pal.fontUI,
                    fontSize: 15,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(220,232,245,0.92)",
                    pointerEvents: "none",
                  }}>
                    Loading Map…
                  </div>
                )}
                <MapViewer
                  imageUrl={activeMap.imageUrl}
                  name={activeMap.name}
                  contentType={activeMap.contentType}
                  height={mapHeight}
                  pal={pal}
                  publishedView={publishedView}
                  onViewChange={setViewerState}
                  freeZoom={freeZoom}
                  tokenScale={tokenScale}
                  rotation={effectiveRotation}
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
                  onClearTokensFromMap={handleClearTokensFromMap}
                  onClearNpcsFromMap={handleClearNpcsFromMap}
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
          combatMode={combatMode}
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
      {dmToast && createPortal(
        <div className={`dm-mode-toast dm-mode-toast--${dmToast}`}>
          {dmToast === "entering" ? "⚔ Players now see combat" : "⛺ Players now see adventure"}
        </div>,
        document.body
      )}
    </div>
  );
}
