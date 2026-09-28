import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, useImperativeHandle } from "react";
import { MAX_TOKEN_SCALE, MIN_TOKEN_SCALE } from "./battleMode/tokenSizes";
import { liveValuesEqual, useSettlingOverride } from "../../lib/liveSync";

const NO_TOKENS = [];
// Server responses annotate each token with a derived `invisible` flag
// (ADR-023) that local writes don't carry — ignore it when comparing.
function stripDerived(tokens) {
  return (tokens || []).map((token) => {
    const copy = { ...token };
    delete copy.invisible;
    return copy;
  });
}
function tokensEqual(a, b) {
  return liveValuesEqual(stripDerived(a), stripDerived(b));
}
import { createPortal } from "react-dom";
import MapViewer, { getMapZoomModifierLabel, readMapFreeZoomPreference, writeMapFreeZoomPreference } from "../maps/MapViewer";
import MapLibraryModal from "./MapLibraryModal";
import { putMapActive, putMapView, patchMapTokens, putMapCalibration, putMapRotation, putNpcCombat } from "../../api";
import CalibrationPopover from "./battleMode/CalibrationPopover";
import { displayMapName } from "./MapUploadModal";
import { isPdfMap } from "../maps/mapFiles";
import TokenTray from "./battleMode/TokenTray";
import { TokenChip, HeldTokenFloater } from "./battleMode/BattleModeController";
import ConditionGlyphSprite from "./battleMode/ConditionGlyphSprite";
import CombatFxLayer from "../maps/combatFx/CombatFxLayer";
import { buildStrikeEvents, collectTokenHits } from "../maps/combatFx/strikeEvents";
import TakeActionDrawer from "./takeAction/TakeActionDrawer";
import { actionGroups } from "./takeAction/actionOptions";
import {
  resolveDamageState,
  assignAoEStagger,
  resolveCondBand,
  computeEffectivePx,
  useDebouncedValue,
  usePrefersReducedMotion,
  shimmerPhaseOffsetMs,
} from "./battleMode/tokenEffects";
import "./battleMode.css";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Build the map view payload, including center fracs so the player's viewport
// centers on the same point regardless of container size differences.
function buildMapViewPayload(mapId, viewerState) {
  const { translate, scale, pageNumber, naturalSize, containerWidth, containerHeight } = viewerState;
  const W = naturalSize?.w;
  const H = naturalSize?.h;
  const payload = { mapId, translate, scale, pageNumber };
  if (W && H && containerWidth && containerHeight && Number.isFinite(translate?.x) && Number.isFinite(translate?.y)) {
    payload.centerFracX = (containerWidth / 2 - translate.x) / (scale * W);
    payload.centerFracY = (containerHeight / 2 - translate.y) / (scale * H);
  }
  return payload;
}

export default function MapPanel({ mapLibrary, dmPassword, onLibraryChange, pal, collapsedOverride = null, party, npcCombat, combatMode, mapSwitching = false, serverTime, initiative, rollHistory, onRequestAction, ref }) {
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
  const [heldSourceId, setHeldSourceId] = useState(null);
  const [heldType, setHeldType] = useState(null);
  const floaterRef = useRef(null);
  const rafRef = useRef(null);
  const viewerContainerRef = useRef(null);
  const autoPubTimerRef = useRef(null);

  // Calibration state (token scale)
  const [calibOpen, setCalibOpen] = useState(false);
  const [calibTweening, setCalibTweening] = useState(false);
  const calibWriteTimerRef = useRef(null);
  const calibTweenTimerRef = useRef(null);
  const tokenResizeWriteTimerRef = useRef(null); // Story 44
  const rotationWriteTimerRef = useRef(null); // Story 45

  useEffect(() => {
    if (collapsedOverride === null) return;
    setCollapsed(Boolean(collapsedOverride));
  }, [collapsedOverride]);

  const maps = mapLibrary?.maps || [];
  // Instant "Clear": the panel empties now; the server catches up behind it.
  const {
    value: activeMapId, begin: beginActiveMap, settle: settleActiveMap,
  } = useSettlingOverride(mapLibrary?.activeMapId || null);
  const activeMap = maps.find((m) => m.id === activeMapId) || null;
  const publishedView = activeMap && mapLibrary?.activeMapView?.mapId === activeMap.id ? mapLibrary.activeMapView : null;
  const activeMapLabel = activeMap ? displayMapName(activeMap) : "";
  // Story: combatMode is the single server-persisted source of truth (see
  // ADR-029) — the DM's own map panel now reads the same flag players derive
  // isBattleMode from, instead of a separate per-map mapMode field.
  const isBattleMode = !!combatMode;
  const isPdf = activeMap ? isPdfMap({ imageUrl: activeMap.imageUrl, contentType: activeMap.contentType, name: activeMap.name }) : false;

  // Effective tokens: local optimistic state overrides server state
  // Optimistic overrides that hand back to the server once a write lands
  // (useSettlingOverride) — so the DM's own moves are instant AND player
  // token drags / other changes still appear afterwards.
  const {
    value: effectiveTokens, begin: beginTokens, settle: settleTokens, reset: resetTokens,
  } = useSettlingOverride(activeMap?.tokens || NO_TOKENS, { equals: tokensEqual });
  // Effective token scale: local optimistic state overrides server state
  const {
    value: tokenScale, begin: beginTokenScale, settle: settleTokenScale, reset: resetTokenScale,
  } = useSettlingOverride(activeMap?.tokenScale ?? 1);
  // Story 45 — map rotation
  const {
    value: effectiveRotation, begin: beginRotation, settle: settleRotation, reset: resetRotation,
  } = useSettlingOverride(activeMap?.rotation ?? 0);
  const viewerZoom = viewerState?.scale ?? 1;
  const labelsHidden = tokenScale * viewerZoom < 0.6;

  // Stories 52–54 — shared effects state. seenStampsRef persists the last
  // rendered lastDamagedAt per token id across renders (freshness gate — see
  // tokenEffects.js resolveDamageState); reset per map switch below.
  const seenStampsRef = useRef(new Map());
  const inCombat = (initiative?.entries?.length || 0) > 0;
  const activeEntry = (initiative?.entries || [])[initiative?.activeTurnIndex ?? 0] || null;
  // 80ms debounce on the shared zoom value so every chip's condition band
  // changes on the same tick (a staggered band change would read as a bug).
  const debouncedZoom = useDebouncedValue(viewerZoom, 80);

  // Reset local optimistic state only when the active map itself changes.
  // Do NOT depend on activeMap?.tokens — that reference changes every poll tick
  // even when content is unchanged, which would kill the optimistic battle-mode state.
  useEffect(() => {
    resetTokens();
    setHeldSourceId(null);
    setHeldType(null);
    resetTokenScale();
    setCalibOpen(false);
    resetRotation();
    seenStampsRef.current = new Map();
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
    const seq = beginActiveMap(null);
    try {
      await putMapActive(null, dmPassword);
      onLibraryChange();
    } catch { /* override releases back to the server's active map */ }
    finally { settleActiveMap(seq); }
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
      await putMapView(buildMapViewPayload(activeMap.id, viewerState), dmPassword);
      onLibraryChange();
    } catch { /* ignore */ }
  };

  // Auto-publish the DM's viewport 800ms after pan/zoom settles so players
  // always open the map centred on where the DM is looking (Story 47a).
  useEffect(() => {
    if (!viewerState || !activeMap?.id || !dmPassword) return;
    clearTimeout(autoPubTimerRef.current);
    autoPubTimerRef.current = setTimeout(() => {
      putMapView(buildMapViewPayload(activeMap.id, viewerState), dmPassword).catch(() => {});
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

  const writeTokens = useCallback(async (newTokens) => {
    const payload = { tokens: newTokens };
    // A full write supersedes a pending debounced resize write — the resized
    // scale is already in newTokens, and the older snapshot would clobber this.
    if (tokenResizeWriteTimerRef.current) {
      clearTimeout(tokenResizeWriteTimerRef.current);
      tokenResizeWriteTimerRef.current = null;
    }
    // Apply optimistically so UI responds immediately
    const seq = beginTokens(newTokens);
    try {
      await patchMapTokens(activeMap.id, payload, dmPassword);
      onLibraryChange();
    } catch { /* the override releases back to server state after settling */ }
    finally { settleTokens(seq); }
  }, [activeMap, dmPassword, onLibraryChange, beginTokens, settleTokens]);

  const handleScaleChange = useCallback((nextScale, opts) => {
    if (!activeMap) return;
    const clamped = Math.min(2.5, Math.max(0.5, nextScale));
    const seq = beginTokenScale(clamped);
    // ± steppers / reset get a brief 120ms tween; slider drag stays 1:1 instant.
    if (opts?.tween) {
      setCalibTweening(true);
      if (calibTweenTimerRef.current) clearTimeout(calibTweenTimerRef.current);
      calibTweenTimerRef.current = setTimeout(() => setCalibTweening(false), 140);
    }
    if (calibWriteTimerRef.current) clearTimeout(calibWriteTimerRef.current);
    calibWriteTimerRef.current = setTimeout(() => {
      putMapCalibration(activeMap.id, clamped, dmPassword).then(onLibraryChange).catch(() => {}).finally(() => settleTokenScale(seq));
    }, 600);
  }, [activeMap, dmPassword, onLibraryChange, beginTokenScale, settleTokenScale]);

  // Story 44 — debounced per-token scale write, modelled on handleScaleChange
  // Story 65 — `match` is a token id, or a predicate (the NPC card's ⋯ menu
  // resizes every token of that NPC by sourceId).
  const handleResizeToken = useCallback((match, nextScale) => {
    if (!activeMap) return;
    const clamped = Math.min(MAX_TOKEN_SCALE, Math.max(MIN_TOKEN_SCALE, nextScale));
    const isMatch = typeof match === "function" ? match : (t) => t.id === match;
    const next = effectiveTokens.map((t) => isMatch(t) ? { ...t, scale: clamped } : t);
    const seq = beginTokens(next);
    if (tokenResizeWriteTimerRef.current) clearTimeout(tokenResizeWriteTimerRef.current);
    tokenResizeWriteTimerRef.current = setTimeout(() => {
      tokenResizeWriteTimerRef.current = null;
      patchMapTokens(activeMap.id, { tokens: next }, dmPassword).then(onLibraryChange).catch(() => {}).finally(() => settleTokens(seq));
    }, 300);
  }, [activeMap, effectiveTokens, dmPassword, onLibraryChange, beginTokens, settleTokens]);

  useImperativeHandle(ref, () => ({
    resizeNpcTokens(npcId, nextScale) {
      handleResizeToken((t) => t.type === "npc" && t.sourceId === npcId, nextScale);
    },
  }), [handleResizeToken]);

  const handleRotate = useCallback((delta) => {
    if (!activeMap) return;
    const next = (effectiveRotation + delta + 360) % 360;
    const seq = beginRotation(next);
    if (rotationWriteTimerRef.current) clearTimeout(rotationWriteTimerRef.current);
    rotationWriteTimerRef.current = setTimeout(() => {
      putMapRotation(activeMap.id, next, dmPassword).then(onLibraryChange).catch(() => {}).finally(() => settleRotation(seq));
    }, 600);
  }, [activeMap, effectiveRotation, dmPassword, onLibraryChange, beginRotation, settleRotation]);

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
    // Story 65 — a move keeps the token's per-token size.
    const existing = effectiveTokens.find((t) => t.sourceId === heldSourceId);
    const newToken = {
      id: genId(),
      type: heldType,
      sourceId: heldSourceId,
      x: frac.x,
      y: frac.y,
      ...(Number.isFinite(existing?.scale) ? { scale: existing.scale } : {}),
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
    await writeTokens([]);
  }, [writeTokens]);

  const handleClearTokensFromMap = useCallback(() => {
    setHeldSourceId(null);
    setHeldType(null);
    writeTokens([]);
  }, [writeTokens]);

  const handleClearNpcsFromMap = useCallback(() => {
    setHeldSourceId(null);
    setHeldType(null);
    const current = effectiveTokens;
    writeTokens(current.filter((t) => t.type === "character"));
  }, [effectiveTokens, writeTokens]);

  // Cache natural image size per mapId so tokens stay correctly positioned when
  // switching back to a previously-loaded map. For cached images, the browser fires
  // onLoad before useEffect([imageUrl]) resets imageNaturalSize to null — meaning
  // MapViewer's naturalSize stays null permanently on second visit. Reading from this
  // cache bypasses the race and gives correct dimensions immediately.
  const naturalSizeByMapRef = useRef({});
  if (activeMapId && viewerState?.naturalSize?.w) {
    naturalSizeByMapRef.current[activeMapId] = viewerState.naturalSize;
  }
  // Evict entries for maps no longer in the library — otherwise every map
  // ever viewed across a multi-day session accumulates a permanent entry
  // here (harmless per-entry, but unbounded over a long-lived session).
  // Mirrors the cache-set above: mutated directly during render, not in an
  // effect, so it stays correct on the same tick a map is deleted.
  for (const id of Object.keys(naturalSizeByMapRef.current)) {
    if (!maps.some((m) => m.id === id)) delete naturalSizeByMapRef.current[id];
  }
  const effectiveNaturalSize = viewerState?.naturalSize || (activeMapId ? naturalSizeByMapRef.current[activeMapId] : null);

  // Stories 52–55 — resolve damage/condition-band/veil/tracer state once per
  // token, here in the parent, not inside TokenChip (which is memo'd and
  // would otherwise recompute per chip on every pan frame). Computed in an
  // effect (not useMemo) because it reads/mutates seenStampsRef — refs may
  // only be touched outside render — and stored in state, so the resolved
  // objects keep a stable identity across pure pan/zoom renders (unaffected
  // by this effect) and TokenChip's memo() keeps working. One render's lag
  // between new poll data landing and the resolved effects appearing is
  // imperceptible against a ~1–2s poll cadence. debouncedZoom only changes
  // on its own tick.
  const reducedMotion = usePrefersReducedMotion();
  const [resolvedByTokenId, setResolvedByTokenId] = useState(new Map());
  // ADR-031 — combat FX: strike events detected this tick (damage + heal
  // stamps). CombatFxLayer plays each id exactly once, so a later poll that
  // still carries the same event can't replay it or cut it short.
  const [strikeEvents, setStrikeEvents] = useState([]);
  const healSeenRef = useRef(new Map());
  const missSeenRef = useRef(new Map());
  useEffect(() => {
    const partyList = party || [];
    const npcList = npcCombat?.npcs || [];
    const rawDamageStates = new Map();
    const freshKeysInOrder = [];
    const hits = [];
    for (const token of effectiveTokens) {
      const member = token.type === "character" ? partyList.find((m) => m.slug === token.sourceId) : null;
      const npc = token.type === "npc" ? npcList.find((n) => n.id === token.sourceId) : null;
      const subject = member || npc;
      const isCurrentlyActiveTurn = token.type === "character"
        ? activeEntry?.slug === token.sourceId
        : activeEntry?.npcId === token.sourceId;
      const state = resolveDamageState(
        token.id,
        {
          lastDamagedAt: subject?.lastDamagedAt ?? null,
          lastDamageAmount: subject?.lastDamageAmount ?? null,
          hpCurrent: subject?.hpCurrent ?? null,
          hpMax: subject?.hpMax ?? subject?.hp ?? null,
        },
        { serverTime, isCurrentlyActiveTurn, turnStartedAt: initiative?.turnStartedAt, inCombat },
        seenStampsRef.current
      );
      rawDamageStates.set(token.id, state);
      if (state.phaseAFresh) freshKeysInOrder.push(token.id);
      // ADR-031/032 — every damage/heal plays a strike (Story 52's freshness
      // gate, reused); a chosen action (lastFx) or a miss plays exactly as
      // chosen. Attacker refs are already stripped server-side when hidden.
      hits.push(...collectTokenHits({
        token,
        subject,
        damageFresh: state.phaseAFresh,
        serverTime,
        healSeen: healSeenRef.current,
        missSeen: missSeenRef.current,
      }));
    }
    // Evict stale entries — otherwise every token id ever placed on this map
    // across a multi-day session (NPCs spawned/removed encounter after
    // encounter) accumulates a permanent entry here.
    const liveTokenIds = new Set(effectiveTokens.map((t) => t.id));
    for (const id of seenStampsRef.current.keys()) {
      if (!liveTokenIds.has(id)) seenStampsRef.current.delete(id);
    }
    for (const seen of [healSeenRef.current, missSeenRef.current]) {
      for (const id of seen.keys()) if (!liveTokenIds.has(id)) seen.delete(id);
    }
    const staggerByKey = assignAoEStagger(freshKeysInOrder);
    const result = new Map();
    for (const token of effectiveTokens) {
      const rawState = rawDamageStates.get(token.id);
      const stagger = staggerByKey.get(token.id);
      const damageState = rawState && {
        ...rawState,
        // ADR-031 — the combat FX layer now owns the moment of impact (flash,
        // shake, knockback); the chip keeps only the lingering wound state.
        phaseAFresh: false,
        delayMs: stagger?.delayMs ?? 0,
        washOnly: !!stagger?.washOnly,
      };
      const effectivePx = computeEffectivePx({ tokenScale: token.scale, mapTokenScale: tokenScale, zoom: debouncedZoom });
      const condBand = resolveCondBand(effectivePx);
      // Story 54 — the DM always sees the server-computed flag; NPC invisible
      // renders SECRET (veiled + hatch + ◇), PC invisible renders VEILED
      // identically to the player's own view (no ◇ — false claim otherwise).
      const veil = token.invisible
        ? { veiled: true, secret: token.type === "npc" }
        : { veiled: false, secret: false };
      result.set(token.id, {
        damageState,
        condBand,
        veil,
        shimmerDelayMs: shimmerPhaseOffsetMs(token.id),
      });
    }
    setResolvedByTokenId(result);

    const strikes = buildStrikeEvents({
      hits,
      tokens: effectiveTokens,
      party: partyList,
      rolls: rollHistory || [],
      imageW: effectiveNaturalSize?.w,
      imageH: effectiveNaturalSize?.h,
      mapTokenScale: tokenScale,
    });
    if (strikes.length > 0) setStrikeEvents(strikes);
    // effectiveNaturalSize and rollHistory intentionally excluded from deps —
    // the image size is partly ref-derived (naturalSizeByMapRef) and changes
    // on the same poll/pan/zoom cadence as the deps below, and rollHistory
    // arrives in the same poll as the damage stamp it explains.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTokens, party, npcCombat, serverTime, initiative, tokenScale, debouncedZoom]);

  // ── ADR-032 — DM Take Action: long-press an actor, then its target, then
  // pick the action; the Deal Damage pop-up (owned by the dashboard) applies it.
  const [actionFlow, setActionFlow] = useState({ step: "idle", actorId: null, targetId: null });
  const handleDmAction = useCallback((tokenId) => {
    setActionFlow((flow) => (flow.step === "target"
      ? { ...flow, step: "pick", targetId: tokenId }
      : { step: "target", actorId: tokenId, targetId: null }));
  }, []);
  const cancelActionFlow = useCallback(() => setActionFlow({ step: "idle", actorId: null, targetId: null }), []);
  const actionTokens = useMemo(() => ({
    actor: effectiveTokens.find((t) => t.id === actionFlow.actorId) || null,
    target: effectiveTokens.find((t) => t.id === actionFlow.targetId) || null,
  }), [effectiveTokens, actionFlow.actorId, actionFlow.targetId]);
  // A token removed mid-flow ends the flow (derived, no effect needed).
  const flowStep = actionFlow.step !== "idle" && (!actionTokens.actor || (actionFlow.step === "pick" && !actionTokens.target))
    ? "idle"
    : actionFlow.step;
  const describeToken = useCallback((token) => {
    if (!token) return null;
    if (token.type === "character") {
      const member = (party || []).find((m) => m.slug === token.sourceId);
      return { type: "character", sourceId: token.sourceId, name: member?.name || "Unknown", member };
    }
    const npc = (npcCombat?.npcs || []).find((n) => n.id === token.sourceId);
    return { type: "npc", sourceId: token.sourceId, name: npc?.name || "Unknown" };
  }, [party, npcCombat]);
  const actorInfo = describeToken(actionTokens.actor);
  const targetInfo = describeToken(actionTokens.target);
  const handlePickAction = useCallback((action) => {
    if (!actorInfo || !targetInfo) return;
    onRequestAction?.({
      actor: { type: actorInfo.type, sourceId: actorInfo.sourceId, name: actorInfo.name },
      target: { type: targetInfo.type, sourceId: targetInfo.sourceId, name: targetInfo.name },
      action,
      onDone: cancelActionFlow,
    });
  }, [actorInfo, targetInfo, onRequestAction, cancelActionFlow]);
  useEffect(() => {
    if (flowStep === "idle") return undefined;
    function onKey(e) {
      if (e.key === "Escape" && !document.querySelector(".ta-overlay")) cancelActionFlow();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flowStep, cancelActionFlow]);
  const dmTargeting = flowStep === "target";

  // Build chip nodes for token layer.
  const tokenChips = (isBattleMode && effectiveNaturalSize) ? (
    <>
      {effectiveTokens.map((token) => {
        const resolved = resolvedByTokenId.get(token.id) || {};
        return (
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
            onDmAction={onRequestAction ? handleDmAction : undefined}
            dmTargeting={dmTargeting}
            dmActionRole={flowStep === "idle" ? null
              : token.id === actionFlow.actorId ? "actor"
              : flowStep === "pick" && token.id === actionFlow.targetId ? "target"
              : null}
            damageState={resolved.damageState}
            condBand={resolved.condBand}
            veil={resolved.veil}
            shimmerDelayMs={resolved.shimmerDelayMs}
          />
        );
      })}
    </>
  ) : null;

  return (
    <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 5, marginBottom: 12, overflow: "hidden" }}>
      {/* Story 53 — condition glyph sprite, rendered once per map surface. */}
      <ConditionGlyphSprite />
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
                  overlay={isBattleMode ? <CombatFxLayer events={strikeEvents} rotation={effectiveRotation} reducedMotion={reducedMotion} /> : null}
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

              {isBattleMode && onRequestAction && (
                <TakeActionDrawer
                  step={flowStep}
                  actorName={actorInfo?.name}
                  targetName={targetInfo?.name}
                  self={!!actionTokens.actor && actionTokens.actor.id === actionTokens.target?.id}
                  groups={flowStep === "pick" ? actionGroups(actorInfo) : null}
                  onPick={handlePickAction}
                  onTargetSelf={() => actionTokens.actor && handleDmAction(actionTokens.actor.id)}
                  onRetarget={() => actionTokens.actor && setActionFlow({ step: "target", actorId: actionTokens.actor.id, targetId: null })}
                  onCancel={cancelActionFlow}
                />
              )}

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
    </div>
  );
}
