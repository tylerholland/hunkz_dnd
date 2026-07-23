import { useState, useRef, useEffect, useCallback, memo, forwardRef } from "react";
import { npcInitialColor, npcInitials, getPaletteAccent } from "./tokenUtils";

/**
 * BattleModeController
 *
 * Owns the held-state machine (IDLE | HELD), derives the full token display set
 * from party + npcCombat + activeMap.tokens, handles drop math, and calls
 * patchMapTokens on changes.
 *
 * NOTE: This component is used by MapPanel which inlines most of the held-state
 * logic directly for tighter coupling with MapViewer. The TokenChip export is
 * used by both MapPanel (DM view) and CharacterSheetSessionMode (player view).
 */

// ── Per-token size categories (Story 44) ─────────────────────────────────────
const SIZE_STEPS = [0.5, 1.0, 1.5, 2.0, 3.0];
const SIZE_LABELS = {
  0.5: "TINY",
  1.0: "MEDIUM",
  1.5: "LARGE",
  2.0: "HUGE",
  3.0: "GARGANTUAN",
};

function nearestSizeIndex(scale) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < SIZE_STEPS.length; i++) {
    const dist = Math.abs(SIZE_STEPS[i] - scale);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
}

// ── HeldTokenFloater ────────────────────────────────────────────────────────
export const HeldTokenFloater = forwardRef(function HeldTokenFloater(
  { heldSourceId, heldType, party, npcCombat, pal },
  ref
) {
  const member = heldType === "character"
    ? (party || []).find((m) => m.slug === heldSourceId)
    : null;
  const npc = heldType === "npc"
    ? (npcCombat?.npcs || []).find((n) => n.id === heldSourceId)
    : null;

  const ringColor = member ? getPaletteAccent(member.palette) : (pal?.border || "rgba(160,100,55,0.38)");
  const fillColor = npc ? npcInitialColor(npc.id) : ringColor;
  const initials = npc
    ? npcInitials(npc.name)
    : (member ? (member.name || "?")[0].toUpperCase() : "?");

  return (
    <div
      ref={ref}
      className="token-floater"
      style={{
        left: "-9999px",
        top: "-9999px",
        "--token-ring-color": ringColor,
        "--token-fill-color": fillColor,
        "--pal-border": pal?.border,
      }}
    >
      {heldType === "character" && member?.portraitUrl ? (
        <img
          className="token-floater__portrait"
          src={member.portraitUrl}
          alt={member.name}
          draggable={false}
        />
      ) : (
        <div
          className="token-floater__initial"
          style={{ background: fillColor }}
        >
          {initials}
        </div>
      )}
    </div>
  );
});

const LONG_PRESS_MS = 480;

// ── TokenChip ────────────────────────────────────────────────────────────────
// Used by MapPanel (DM view) and CharacterSheetSessionMode (player view).
export const TokenChip = memo(function TokenChip({
  token,
  imageW,
  imageH,
  party,
  npcCombat,
  isDm,
  isOwnToken,
  partyVisibilityEnabled,
  isHeld,
  onTokenClick,
  onRemoveToken,
  viewerContainerRef,
  pal,
  labelHidden,
  calibTween,
  // Story 34 — own-token drag (player view only; absent/undefined for DM
  // chips, which keeps all existing DM interactions untouched).
  ownSlug,
  onMoveToken,
  panSuppressedRef,
  // Story 44 — per-token resize (DM view only, NPC tokens only).
  onResizeToken,
}) {
  const [expanded, setExpanded] = useState(false);
  const [flipCard, setFlipCard] = useState(false);
  const [portraitError, setPortraitError] = useState(false);
  const [longPress, setLongPress] = useState("idle"); // idle | charging | menu
  const [removing, setRemoving] = useState(false);
  // Story 44 — resize stepper state
  const [resizeActive, setResizeActive] = useState(false);
  // State (not a ref) so the mount-gate can be read safely during render —
  // false on the very first paint (no transition class), flips true right
  // after via the effect below so the token's first position is instant.
  const [hasMounted, setHasMounted] = useState(false);
  const chipRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const collapseTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressMenuTimerRef = useRef(null);
  const suppressClickRef = useRef(false);

  // ── Story 34 drag state ──────────────────────────────────────────────
  // isDragging + dragPos track the live pointer-follow position while the
  // pointer is down. optimisticPos holds the dropped position after
  // release, overriding the polled token.x/y until the next poll confirms
  // it (or the write fails, in which case it reverts to dragOrigin).
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState(null);
  const [optimisticPos, setOptimisticPos] = useState(null);
  const [dragFailed, setDragFailed] = useState(false);
  const dragOriginRef = useRef(null);
  const dragRotationRef = useRef(0);
  const dragPointerIdRef = useRef(null);
  const optimisticTimeoutRef = useRef(null);

  const canDrag = !isDm && !!ownSlug && token.type === "character" && token.sourceId === ownSlug;

  useEffect(() => {
    return () => {
      if (optimisticTimeoutRef.current) clearTimeout(optimisticTimeoutRef.current);
    };
  }, []);

  const member = token.type === "character"
    ? (party || []).find((m) => m.slug === token.sourceId)
    : null;
  const npc = token.type === "npc"
    ? (npcCombat?.npcs || []).find((n) => n.id === token.sourceId)
    : null;

  // Visual data
  const name = member?.name || npc?.name || "Unknown";
  const ringColor = token.type === "character"
    ? getPaletteAccent(member?.palette)
    : (pal?.border || "rgba(160,100,55,0.38)");
  const fillColor = npc ? npcInitialColor(npc.id) : ringColor;
  const initials = npc ? npcInitials(npc.name) : (name[0] || "?").toUpperCase();
  const portraitUrl = token.type === "character" ? member?.portraitUrl : npc?.portraitUrl;
  const showPortrait = !!portraitUrl && !portraitError;

  useEffect(() => {
    setPortraitError(false);
  }, [portraitUrl]);

  // Mark mounted after first commit — the poll-animated class only applies
  // on renders AFTER this, so the token's first paint is always instant.
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // HP data — member uses hpCurrent + hpMax (hpMax is always the normalized,
  // authoritative value from partyProjection.js's projectPlayerCharacter()/
  // projectDmPartyItem(); the raw `hp` field is a legacy/edit-mode field that
  // can disagree with it and must only be a fallback, not take priority);
  // npc uses hpCurrent + hpMax
  const hpCurrent = member?.hpCurrent ?? npc?.hpCurrent ?? null;
  const hpMax = member?.hpMax ?? member?.hp ?? npc?.hpMax ?? null;
  const isFallen = hpCurrent !== null && hpCurrent <= 0;

  // HP visibility rules (brief §13)
  const showExactHp = isDm
    || (token.type === "character" && isOwnToken)
    || (token.type === "character" && partyVisibilityEnabled && !isOwnToken);
  const showHpHidden = !isDm && token.type === "character" && !partyVisibilityEnabled && !isOwnToken;
  const showNpcGlow = !isDm && token.type === "npc";

  // HP bar tier
  function getHpTier(cur, max) {
    if (cur === null || max === null || max <= 0) return "healthy";
    const pct = cur / max;
    if (pct > 0.5) return "healthy";
    if (pct >= 0.2) return "wounded";
    return "critical";
  }

  const hpTier = getHpTier(hpCurrent, hpMax);
  const hpBarPct = hpMax > 0 ? Math.max(0, Math.min(1, (hpCurrent || 0) / hpMax)) : 0;

  // Check if card should flip above token (bottom 25% of viewer)
  const checkFlip = useCallback(() => {
    if (!chipRef.current || !viewerContainerRef?.current) return;
    const chipRect = chipRef.current.getBoundingClientRect();
    const containerRect = viewerContainerRef.current.getBoundingClientRect();
    const bottomQuarter = containerRect.top + containerRect.height * 0.75;
    setFlipCard(chipRect.bottom > bottomQuarter);
  }, [viewerContainerRef]);

  const handleMouseEnter = useCallback(() => {
    // Story 44 — suppress hover-expand while resize stepper is open so the
    // HP card doesn't pop over the stepper panel.
    if (resizeActive) return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      checkFlip();
      setExpanded(true);
    }, 120);
  }, [checkFlip, resizeActive]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setExpanded(false);
    }, 60);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  const handleClick = useCallback((e) => {
    if (suppressClickRef.current) {
      // A long-press just fired (menu surfaced) — swallow the trailing click
      // that pointerup would otherwise generate.
      suppressClickRef.current = false;
      e.stopPropagation();
      return;
    }
    if (onTokenClick) {
      e.stopPropagation();
      onTokenClick(token.id, e);
    }
    // If no onTokenClick (e.g. during HELD state), let the click propagate to
    // the token layer so placement fires at this position.
  }, [token.id, onTokenClick]);

  // ── Long-press remove (Pointer Events, DM-only) ─────────────────────────
  // Uses Pointer Events (not mouse events) so this works identically for
  // mouse, touch, and stylus in one path — mousedown/mouseup would never
  // fire on touch, which is the entire point of this gesture.
  const clearLongPressCharge = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPress((current) => (current === "charging" ? "idle" : current));
  }, []);

  // ── Own-token drag (Pointer Events, player-only, Story 34) ──────────────
  // Shares the Pointer Events approach with the DM long-press gesture above
  // so mouse, touch, and stylus all follow one code path.
  const startDrag = useCallback((e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    dragPointerIdRef.current = e.pointerId;
    dragOriginRef.current = { x: token.x, y: token.y };
    // Read the map's rotation once, up front — it can't change mid-drag, so
    // re-reading it via getComputedStyle() on every pointermove (as this used
    // to do) is pure wasted style recalculation on the hottest path in the
    // gesture, which was visible as jitter on a rotated map.
    const layerEl = chipRef.current?.parentElement;
    dragRotationRef.current = layerEl
      ? parseFloat(getComputedStyle(layerEl).getPropertyValue('--map-rotation')) || 0
      : 0;
    if (panSuppressedRef) panSuppressedRef.current = true;
    if (optimisticTimeoutRef.current) {
      clearTimeout(optimisticTimeoutRef.current);
      optimisticTimeoutRef.current = null;
    }
    setDragFailed(false);
    setOptimisticPos(null);
    setDragPos({ x: token.x, y: token.y });
    setIsDragging(true);
  }, [token.x, token.y, panSuppressedRef]);

  const moveDrag = useCallback((e) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    const layerEl = chipRef.current?.parentElement;
    if (!layerEl) return;
    const rect = layerEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const vx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const vy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const rot = dragRotationRef.current;
    let fracX, fracY;
    if (rot === 90)       { fracX = vy;      fracY = 1 - vx; }
    else if (rot === 180) { fracX = 1 - vx;  fracY = 1 - vy; }
    else if (rot === 270) { fracX = 1 - vy;  fracY = vx; }
    else                  { fracX = vx;      fracY = vy; }
    setDragPos({ x: fracX, y: fracY });
  }, []);

  const releaseDrag = useCallback((e) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    dragPointerIdRef.current = null;
    if (panSuppressedRef) panSuppressedRef.current = false;
    const origin = dragOriginRef.current || { x: token.x, y: token.y };
    const dropped = dragPos || origin;
    setIsDragging(false);
    setDragPos(null);

    // A tap/click without meaningful movement — skip the write entirely.
    const moved = Math.abs(dropped.x - origin.x) > 0.0015 || Math.abs(dropped.y - origin.y) > 0.0015;
    if (!moved) return;

    setOptimisticPos(dropped);
    Promise.resolve(onMoveToken?.(token.id, dropped.x, dropped.y))
      .then(() => {
        optimisticTimeoutRef.current = setTimeout(() => setOptimisticPos(null), 6000);
      })
      .catch(() => {
        // Revert with animation back to the last known-good server position —
        // the .token-chip--poll-animated transition (already applied for
        // player-side chips) carries the glide.
        setOptimisticPos(origin);
        setDragFailed(true);
        optimisticTimeoutRef.current = setTimeout(() => {
          setOptimisticPos(null);
          setDragFailed(false);
        }, 3000);
      });
  }, [dragPos, onMoveToken, token.id, token.x, token.y, panSuppressedRef]);

  const cancelDrag = useCallback((e) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    dragPointerIdRef.current = null;
    if (panSuppressedRef) panSuppressedRef.current = false;
    setIsDragging(false);
    setDragPos(null);
  }, [panSuppressedRef]);

  const handlePointerDown = useCallback((e) => {
    if (canDrag) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startDrag(e);
      return;
    }
    if (!isDm || isHeld) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setLongPress("charging");
    longPressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      setLongPress("menu");
    }, LONG_PRESS_MS);
  }, [canDrag, startDrag, isDm, isHeld]);

  const handlePointerMove = useCallback((e) => {
    if (isDragging) moveDrag(e);
  }, [isDragging, moveDrag]);

  const handlePointerUp = useCallback((e) => {
    if (isDragging) {
      releaseDrag(e);
      return;
    }
    clearLongPressCharge();
  }, [isDragging, releaseDrag, clearLongPressCharge]);

  const handlePointerCancel = useCallback((e) => {
    if (isDragging) {
      cancelDrag(e);
      return;
    }
    clearLongPressCharge();
  }, [isDragging, cancelDrag, clearLongPressCharge]);

  const handlePointerLeave = useCallback(() => {
    // Pointer capture keeps the drag active regardless of the pointer
    // visually leaving the chip's box, so do nothing here while dragging.
    if (isDragging) return;
    clearLongPressCharge();
  }, [isDragging, clearLongPressCharge]);

  // Dismiss the menu on outside pointerdown, Escape, or after 4s idle.
  useEffect(() => {
    if (longPress !== "menu") return undefined;
    function handleOutside(e) {
      if (chipRef.current && !chipRef.current.contains(e.target)) {
        setLongPress("idle");
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setLongPress("idle");
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    longPressMenuTimerRef.current = setTimeout(() => setLongPress("idle"), 4000);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(longPressMenuTimerRef.current);
    };
  }, [longPress]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (longPressMenuTimerRef.current) clearTimeout(longPressMenuTimerRef.current);
    };
  }, []);

  const handleConfirmRemove = useCallback((e) => {
    e.stopPropagation();
    setLongPress("idle");
    setRemoving(true);
    setTimeout(() => { onRemoveToken?.(token.id); }, 180);
  }, [onRemoveToken, token.id]);

  const handleCancelLongPress = useCallback((e) => {
    e.stopPropagation();
    setLongPress("idle");
  }, []);

  // ── Story 44 — resize stepper handlers ──────────────────────────────────

  const handleOpenResize = useCallback((e) => {
    e.stopPropagation();
    checkFlip();
    setLongPress("idle");
    setResizeActive(true);
  }, [checkFlip]);

  const handleCloseResize = useCallback(() => {
    setResizeActive(false);
  }, []);

  const handleStepSize = useCallback((direction) => {
    const currentScale = Number.isFinite(token.scale) ? token.scale : 1.0;
    const idx = nearestSizeIndex(currentScale);
    const nextIdx = Math.max(0, Math.min(SIZE_STEPS.length - 1, idx + direction));
    const nextScale = SIZE_STEPS[nextIdx];
    if (nextScale !== currentScale) {
      onResizeToken?.(token.id, nextScale);
    }
  }, [token.id, token.scale, onResizeToken]);

  useEffect(() => {
    if (!resizeActive) return undefined;
    function handleKeyDown(e) {
      if (e.key === "+" || e.key === "=") { e.preventDefault(); handleStepSize(1); }
      else if (e.key === "-") { e.preventDefault(); handleStepSize(-1); }
      else if (e.key === "Escape") { e.preventDefault(); handleCloseResize(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [resizeActive, handleStepSize, handleCloseResize]);

  useEffect(() => {
    if (!resizeActive) return undefined;
    function handleOutside(e) {
      if (chipRef.current && !chipRef.current.contains(e.target)) {
        handleCloseResize();
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [resizeActive, handleCloseResize]);

  // Rendered position: live drag position while dragging, else the
  // optimistic post-drop position pending poll confirmation, else the
  // server/poll-driven token.x/y (Story 34 §"Reconciliation"). Once a fresh
  // poll delivers a token.x/y matching the optimistic value, this naturally
  // falls back to trusting props — no extra effect/setState needed to
  // "release" the override; the failsafe timeout in releaseDrag/catch
  // clears the state itself for the failure and long-idle cases.
  const OPTIMISTIC_EPS = 0.0005;
  const optimisticConfirmed = !!optimisticPos
    && Math.abs(token.x - optimisticPos.x) < OPTIMISTIC_EPS
    && Math.abs(token.y - optimisticPos.y) < OPTIMISTIC_EPS;
  const effectiveOptimisticPos = optimisticConfirmed ? null : optimisticPos;
  const renderX = dragPos ? dragPos.x : (effectiveOptimisticPos ? effectiveOptimisticPos.x : token.x);
  const renderY = dragPos ? dragPos.y : (effectiveOptimisticPos ? effectiveOptimisticPos.y : token.y);
  const left = renderX * imageW;
  const top = renderY * imageH;

  const chipClasses = [
    "token-chip",
    token.type === "character" ? "token-chip--pc" : "token-chip--npc",
    isFallen ? "token-chip--fallen" : "",
    isHeld ? "token-chip--ghost" : "",
    // Player-only, and only after the token's first paint — the very first
    // render must NOT carry this class or the token would appear to slide
    // in from (0,0) on mount. Suppressed during an active drag so the token
    // tracks the pointer instantly instead of easing behind it.
    !isDm && hasMounted && !isDragging ? "token-chip--poll-animated" : "",
    !isDm && !hasMounted ? "token-chip--appearing" : "",
    labelHidden ? "token-chip--label-hidden" : "",
    calibTween ? "token-chip--calib-tween" : "",
    removing ? "token-chip--removing" : "",
    canDrag ? "token-chip--own-draggable" : "",
    isDragging ? "token-chip--dragging" : "",
    isDm && resizeActive ? "token-chip--resize-active" : "",
  ].filter(Boolean).join(" ");

  // Story 44 — current scale for the stepper readout
  const currentScale = Number.isFinite(token.scale) ? token.scale : 1.0;
  const currentSizeIdx = nearestSizeIndex(currentScale);
  const currentLabel = SIZE_LABELS[SIZE_STEPS[currentSizeIdx]] || "MEDIUM";

  return (
    <div
      ref={chipRef}
      className={chipClasses}
      data-expanded={expanded ? "true" : "false"}
      style={{
        "--token-x": `${left}px`,
        "--token-y": `${top}px`,
        "--token-ring-color": ringColor,
        "--token-fill-color": fillColor,
        "--pal-border": pal?.border,
        "--pal-text": pal?.text,
        "--pal-text-muted": pal?.textMuted,
        "--pal-gem": pal?.gem,
        "--pal-accent": pal?.accent,
        "--pal-accent-bright": pal?.accentBright,
        "--pal-surface-solid": pal?.surfaceSolid || pal?.surface,
        // Story 44 — per-token size multiplier, stacked on global --token-scale-multiplier
        "--token-size-mult": currentScale,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      {/* Portrait or initial — NPC portraits (Story 29b) use the same
          element/classes as PC portraits; the ring stays neutral grey via
          the .token-chip--npc selector regardless of portrait presence. */}
      {showPortrait ? (
        <img
          className="token-chip__portrait"
          src={portraitUrl}
          alt={name}
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setPortraitError(true)}
        />
      ) : (
        <div className="token-chip__initial">
          {initials}
        </div>
      )}

      {/* Name label */}
      <div className="token-chip__label" style={{ color: pal?.text }}>
        {name.split(" ")[0]}
      </div>

      {/* HP hover card */}
      <div className={`token-hp-card${flipCard ? " token-hp-card--flip" : ""}`}>
        <div className="token-hp-card__name">{name}</div>

        {showExactHp && hpCurrent !== null && hpMax !== null && (
          <div className="token-hp-card__numerals">
            {hpCurrent}/{hpMax}
          </div>
        )}
        {showHpHidden && (
          <div className="token-hp-card__numerals token-hp-card__numerals--hidden">
            HP hidden by DM
          </div>
        )}

        {showExactHp && hpCurrent !== null && hpMax !== null && (
          <div className="token-hp-card__bar-wrap">
            <div
              className={`token-hp-card__bar-fill token-hp-card__bar-fill--${hpTier}`}
              style={{ width: `${Math.round(hpBarPct * 100)}%` }}
            />
          </div>
        )}

        {showNpcGlow && (
          <div className={`token-hp-card__glow-line token-hp-card__glow-line--${hpTier}`} />
        )}

        {isDm && isFallen && onRemoveToken && (
          <button
            type="button"
            className="token-hp-card__remove-btn"
            onClick={(e) => { e.stopPropagation(); onRemoveToken(token.id); }}
          >
            Remove from map
          </button>
        )}
      </div>

      {/* Long-press remove — ring-sweep charge cue + micro-menu (DM only) */}
      {isDm && longPress !== "idle" && (
        <>
          <svg className={`token-longpress-ring${longPress === "charging" ? " charging" : ""}`} viewBox="0 0 44 44">
            <circle className="track" cx="22" cy="22" r="19" />
            <circle
              className="fill"
              cx="22"
              cy="22"
              r="19"
              style={{
                strokeDasharray: 119.4,
                strokeDashoffset: longPress === "charging" ? 0 : 119.4,
              }}
            />
          </svg>
          <div className="token-longpress-hold-label">Hold to remove</div>
        </>
      )}
      {isDm && longPress === "menu" && (
        <div className="token-longpress-menu" onClick={(e) => e.stopPropagation()}>
          {/* Story 44 — ⤢ Resize row, NPC tokens only */}
          {token.type === "npc" && onResizeToken && (
            <button
              type="button"
              className="token-longpress-menu-item token-longpress-menu-item--resize"
              onClick={handleOpenResize}
            >
              ⤢ Resize
            </button>
          )}
          <button type="button" className="token-longpress-menu-item token-longpress-menu-item--remove" onClick={handleConfirmRemove}>
            ✕ Remove
          </button>
          <button type="button" className="token-longpress-menu-item token-longpress-menu-item--cancel" onClick={handleCancelLongPress}>
            Cancel
          </button>
        </div>
      )}

      {/* Story 44 — Per-token resize stepper panel (DM only, NPC tokens only) */}
      {isDm && resizeActive && token.type === "npc" && onResizeToken && (
        <div
          className={`token-resize-stepper${flipCard ? " token-resize-stepper--flip" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="token-resize-stepper__readout">
            <span className="token-resize-stepper__label">{currentLabel}</span>
            <span className="token-resize-stepper__mult">{SIZE_STEPS[currentSizeIdx]}×</span>
          </div>
          <div className="token-resize-stepper__track">
            {SIZE_STEPS.map((step, i) => (
              <span
                key={step}
                className={`token-resize-stepper__notch${i === currentSizeIdx ? " token-resize-stepper__notch--active" : ""}`}
              />
            ))}
          </div>
          <div className="token-resize-stepper__controls">
            <button
              type="button"
              className="token-resize-stepper__btn"
              onClick={(e) => { e.stopPropagation(); handleStepSize(-1); }}
              disabled={currentSizeIdx === 0}
              aria-label="Decrease token size"
            >
              −
            </button>
            <button
              type="button"
              className="token-resize-stepper__btn"
              onClick={(e) => { e.stopPropagation(); handleStepSize(1); }}
              disabled={currentSizeIdx === SIZE_STEPS.length - 1}
              aria-label="Increase token size"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="token-resize-stepper__done"
            onClick={(e) => { e.stopPropagation(); handleCloseResize(); }}
          >
            Done
          </button>
        </div>
      )}

      {/* Failed-move toast (Story 34) — quiet inline note, 3s */}
      {dragFailed && (
        <div className="token-drag-toast">Couldn&apos;t move token</div>
      )}
    </div>
  );
});

// ── BattleModeController ─────────────────────────────────────────────────────
// Not actively used by MapPanel (logic inlined there), but kept as a re-export
// point for completeness and future use.
export default function BattleModeController() {
  return null;
}
