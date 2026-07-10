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
}) {
  const [expanded, setExpanded] = useState(false);
  const [flipCard, setFlipCard] = useState(false);
  const [portraitError, setPortraitError] = useState(false);
  const [longPress, setLongPress] = useState("idle"); // idle | charging | menu
  const [removing, setRemoving] = useState(false);
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

  // HP data — member uses hpCurrent + hp (from dmParty projection); npc uses hpCurrent + hpMax
  const hpCurrent = member?.hpCurrent ?? npc?.hpCurrent ?? null;
  const hpMax = member?.hp ?? member?.hpMax ?? npc?.hpMax ?? null;
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
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      checkFlip();
      setExpanded(true);
    }, 120);
  }, [checkFlip]);

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

  const handlePointerDown = useCallback((e) => {
    if (!isDm || isHeld) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setLongPress("charging");
    longPressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      setLongPress("menu");
    }, LONG_PRESS_MS);
  }, [isDm, isHeld]);

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

  const left = token.x * imageW;
  const top = token.y * imageH;

  const chipClasses = [
    "token-chip",
    token.type === "character" ? "token-chip--pc" : "token-chip--npc",
    isFallen ? "token-chip--fallen" : "",
    isHeld ? "token-chip--ghost" : "",
    // Player-only, and only after the token's first paint — the very first
    // render must NOT carry this class or the token would appear to slide
    // in from (0,0) on mount.
    !isDm && hasMounted ? "token-chip--poll-animated" : "",
    !isDm && !hasMounted ? "token-chip--appearing" : "",
    labelHidden ? "token-chip--label-hidden" : "",
    calibTween ? "token-chip--calib-tween" : "",
    removing ? "token-chip--removing" : "",
  ].filter(Boolean).join(" ");

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
        "--pal-surface-solid": pal?.surfaceSolid || pal?.surface,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPressCharge}
      onPointerCancel={clearLongPressCharge}
      onPointerLeave={clearLongPressCharge}
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
          <button type="button" className="token-longpress-menu-item token-longpress-menu-item--remove" onClick={handleConfirmRemove}>
            ✕ Remove
          </button>
          <button type="button" className="token-longpress-menu-item token-longpress-menu-item--cancel" onClick={handleCancelLongPress}>
            Cancel
          </button>
        </div>
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
