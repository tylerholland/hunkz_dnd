import { useState, useRef, useEffect, useCallback, memo, forwardRef } from "react";
import { npcInitialColor, npcInitials, getPaletteAccent } from "./tokenUtils";
import {
  getBadgeEligibleConditions,
  condBandSlotCount,
  isInvisibleCondition,
  FAMILY_COLORS,
  CHEVRON_STEPS_U,
  CHEVRON_STAGGER_MS,
  BOLT_CORE_COLOR,
} from "./tokenEffects";

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

// ── Story 53 — condition badge column ───────────────────────────────────────
// Badges are pointer-events: none, non-interactive, no resting animation
// (Tier 2, ambient). 0-HP collapses to one summary badge @0.6 opacity rather
// than hiding entirely (compressing beats deleting — "this body is also
// Petrified" occasionally matters).
function ConditionBadge({ item, slot, stacked }) {
  const { meta } = item;
  const color = FAMILY_COLORS[meta.family] || FAMILY_COLORS.unknown;
  const isSummary = slot === "summary";
  return (
    <div
      className={`tk-badge${isSummary ? " tk-badge--summary" : ""}`}
      data-slot={isSummary ? undefined : slot}
      style={{ "--fam": color }}
    >
      {stacked && <div className="tk-badge-stack" />}
      {meta.glyphId === "g-exhaustion" ? (
        <div
          className="tk-gauge"
          style={{ "--fam": color, "--tk-gauge-frac": Math.min(1, (meta.exhaustionLevel || 0) / 6) }}
        />
      ) : (
        <svg><use href={`#${meta.glyphId}`} /></svg>
      )}
    </div>
  );
}

// ── Story 55 — melee "velocity chevron" burst ───────────────────────────
// Three small `>` marks stepping outward from the attacker's rim along the
// real attacker→target bearing, lighting up in sequence during the lunge.
// A close-in motion cue, not a projectile — travels only CHEVRON_STEPS_U (up
// to 0.40U) regardless of how far apart the two tokens are. Rendered inside
// .tk-hit (upright via .token-chip's existing counter-rotation, per the
// brief's composition rules) — --map-rotation is inherited from .token-layer
// and added back in CSS so the SCREEN-space bearing is correct at every map
// rotation without any JS-side correction (see the crescent below for the
// same trick).
function ChevronBurst({ bearingDeg, unitPx, startDelayMs }) {
  return (
    <>
      {CHEVRON_STEPS_U.map((stepU, i) => (
        <div
          key={i}
          className="tk-chevron-wrap"
          style={{
            transform: `rotate(calc(var(--map-rotation, 0deg) + ${bearingDeg}deg)) translateX(${(stepU * unitPx).toFixed(1)}px)`,
          }}
        >
          <svg
            className="tk-chevron"
            viewBox="0 0 10 14"
            style={{ animationDelay: `${startDelayMs + i * CHEVRON_STAGGER_MS}ms` }}
            aria-hidden="true"
          >
            <path d="M2,1 L8,7 L2,13" fill="none" stroke={BOLT_CORE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </>
  );
}

// ── Story 55 — impact crescent ──────────────────────────────────────────
// A short arc on the TARGET's circumference, oriented on the attacker→target
// bearing (rendered on the side facing the attacker). Fires for both Strike
// and Bolt — the one visual element every tracer kind shares. Same
// --map-rotation trick as the chevrons above.
function ImpactCrescent({ bearingDeg, delayMs, held }) {
  return (
    <div
      className={`tk-crescent${held ? " tk-crescent--held" : " tk-crescent--play"}`}
      style={{
        transform: `rotate(calc(var(--map-rotation, 0deg) + ${bearingDeg}deg + 180deg))`,
        animationDelay: held ? undefined : `${delayMs}ms`,
      }}
      aria-hidden="true"
    />
  );
}

function ConditionBadgeColumn({ eligible, isFallen, condBand }) {
  const slots = condBandSlotCount(condBand);
  if (slots === 0 || !eligible || eligible.length === 0) return null;

  if (isFallen) {
    return (
      <div className="tk-cond-col" style={{ opacity: 0.6 }}>
        <ConditionBadge item={eligible[0]} slot="summary" stacked={eligible.length > 1} />
      </div>
    );
  }

  const shown = eligible.slice(0, slots);
  const truncated = eligible.length > slots;

  return (
    <div className="tk-cond-col">
      {shown.map((item, i) => (
        <ConditionBadge
          key={item.name + i}
          item={item}
          slot={String(i + 1)}
          stacked={truncated && i === shown.length - 1}
        />
      ))}
    </div>
  );
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

  // Story 54 — "the DM must know what they're placing." The floater is
  // DM-only and never crosses a viewer boundary, so checking conditions
  // directly here (rather than the server-computed per-token `invisible`
  // flag, which doesn't exist yet for a token not yet on the map) isn't the
  // client-side re-derivation the story warns against — that rule is about
  // the player-vs-DM omission, which this floater never participates in.
  const heldConditions = member?.conditions ?? npc?.conditions ?? [];
  const veiled = Array.isArray(heldConditions) && heldConditions.some(isInvisibleCondition);

  return (
    <div
      ref={ref}
      className="token-floater"
      data-veil-secret={veiled ? "1" : undefined}
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
          style={veiled ? { filter: "grayscale(0.35)", opacity: 0.55 } : undefined}
        />
      ) : (
        <div
          className="token-floater__initial"
          style={{ background: fillColor, ...(veiled ? { filter: "grayscale(0.35)", opacity: 0.55 } : null) }}
        >
          {initials}
        </div>
      )}
      {veiled && (
        <svg className="tk-secret-mark" viewBox="0 0 10 10" aria-hidden="true" style={{ opacity: 1 }}>
          <polygon points="5,0.5 9.5,5 5,9.5 0.5,5" />
        </svg>
      )}
    </div>
  );
});

const LONG_PRESS_MS = 480;

// Story 57 — player-facing NPC hold-to-target gesture (ADR-028). Deliberately
// a separate, independently-named constant rather than reusing LONG_PRESS_MS
// above: the two thresholds are 20ms apart by design (brief OQ-7) and belong
// to two different personas' gestures on the same shared component, so they
// must be free to drift independently rather than silently coupled.
const TARGET_HOLD_MS = 500;
// The single most important constant in the gesture design (brief §7.1) — a
// cancel condition on the chip's OWN pointer timer, not a routing decision
// (ADR-028 #1): MapViewer's pan runs on an entirely separate Mouse/Touch
// event family and is never called into from here.
const TARGET_MOVE_CANCEL_PX = 8;

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
  // Stories 52–54 — resolved once per render in the parent (MapPanel /
  // PlayerMapViewer), not recomputed per-chip on every pan frame.
  // damageState: { phaseAFresh, phaseBLive, tier, staggerDelayMs, washOnly } | null
  damageState,
  // condBand: "full" | "two" | "one" | "none" — Story 53's size-band resolver
  condBand = "full",
  // veil: { veiled: boolean, secret: boolean } — Story 54, server-derived
  veil,
  // exiting: true while this chip is a fading Story 54 vanish ghost
  exiting = false,
  shimmerDelayMs = 0,
  // Story 55 — resolved once per render in the parent, alongside damageState.
  // lungeState: { lungeX, lungeY, bearingDeg, unitPx, startDelayMs } | null —
  // present only while THIS token is the attacker of a live Strike.
  lungeState = null,
  // impactState: { bearingDeg, delayMs } | null — present only while THIS
  // token is the target of a live tracer (Strike or Bolt).
  impactState = null,
  // Story 57 — player-facing NPC hold-to-target (player view only; absent/
  // undefined for DM chips and for PC tokens, which keeps every existing DM
  // and own-token-drag interaction on this shared component untouched).
  // onTargetToken(tokenId) fires when the hold commits; the caller decides
  // toggle/retarget semantics (this component only reports the gesture).
  onTargetToken,
  // targeted: true while this specific placed token is the player's current
  // declaration target — a boolean per chip (not the declaration object)
  // so a retarget elsewhere on the map doesn't change this chip's prop
  // identity and defeat memo().
  targeted = false,
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
  // Story 52 — reduced-motion Phase A substitute: a static hot rim held
  // ~900ms instead of the recoil/wash/shockwave animation, then settles to
  // ordinary Phase B (motion may be removed; meaning may not).
  const [rmFlash, setRmFlash] = useState(false);
  const rmFlashTimerRef = useRef(null);
  // Story 55 — reduced-motion crescent substitute: held static (no
  // scale/fade animation) for IMPACT_CRESCENT_MS + 180ms instead of the
  // 120ms scale-and-fade, per the brief's reduced-motion table ("impact
  // crescent held static 300ms so the attack is still readable").
  const [rmCrescent, setRmCrescent] = useState(false);
  const rmCrescentTimerRef = useRef(null);
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

  // ── Story 57 — player-facing NPC hold-to-target charge state ───────────
  const [targetCharge, setTargetCharge] = useState("idle"); // idle | charging
  const targetChargeTimerRef = useRef(null);
  const targetPointerOriginRef = useRef(null);
  const canTarget = !isDm && !!onTargetToken && token.type === "npc" && !isHeld;

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

  useEffect(() => {
    if (!damageState?.phaseAFresh) return undefined;
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) return undefined;
    setRmFlash(true);
    if (rmFlashTimerRef.current) clearTimeout(rmFlashTimerRef.current);
    rmFlashTimerRef.current = setTimeout(() => setRmFlash(false), 900);
    return undefined;
  }, [damageState?.phaseAFresh]);

  useEffect(() => () => {
    if (rmFlashTimerRef.current) clearTimeout(rmFlashTimerRef.current);
  }, []);

  useEffect(() => {
    if (!impactState) return undefined;
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) return undefined;
    setRmCrescent(true);
    if (rmCrescentTimerRef.current) clearTimeout(rmCrescentTimerRef.current);
    rmCrescentTimerRef.current = setTimeout(() => setRmCrescent(false), impactState.delayMs + 300);
    return undefined;
  }, [impactState]);

  useEffect(() => () => {
    if (rmCrescentTimerRef.current) clearTimeout(rmCrescentTimerRef.current);
  }, []);

  // HP data — member uses hpCurrent + hpMax (hpMax is always the normalized,
  // authoritative value from partyProjection.js's projectPlayerCharacter()/
  // projectDmPartyItem(); the raw `hp` field is a legacy/edit-mode field that
  // can disagree with it and must only be a fallback, not take priority);
  // npc uses hpCurrent + hpMax
  const hpCurrent = member?.hpCurrent ?? npc?.hpCurrent ?? null;
  const hpMax = member?.hpMax ?? member?.hp ?? npc?.hpMax ?? null;
  const isFallen = hpCurrent !== null && hpCurrent <= 0;

  // Story 53 — conditions/exhaustion for the badge column and detail card.
  // Invisible is deliberately excluded from this set on every viewer
  // identically (Story 54's own whole-token treatment).
  const rawConditions = member?.conditions ?? npc?.conditions ?? [];
  const exhaustionLevel = member?.exhaustionLevel ?? 0; // NPCs have no exhaustion field

  // Story 54 — server-derived flag only; never re-derived client-side.
  const veiled = !!veil?.veiled;
  const secret = !!veil?.secret;

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
    // Story 57 (ADR-028 #4) — same precedent: the mouse is already over the
    // chip while a target-charge is in progress (the hover timer would
    // otherwise fire ~380ms before the 500ms hold commits), so suppress the
    // detail card while charging or the reticle draws in under the card.
    if (targetCharge === "charging") return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      checkFlip();
      setExpanded(true);
    }, 120);
  }, [checkFlip, resizeActive, targetCharge]);

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

  // ── Story 57 — player-facing NPC hold-to-target (ADR-028) ───────────────
  const clearTargetCharge = useCallback(() => {
    if (targetChargeTimerRef.current) {
      clearTimeout(targetChargeTimerRef.current);
      targetChargeTimerRef.current = null;
    }
    targetPointerOriginRef.current = null;
    setTargetCharge((current) => (current === "charging" ? "idle" : current));
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
    // Story 55 (ADR-021) — .token-chip's parent is now .tk-lunge, not
    // .token-layer (one extra wrapper level) — --map-rotation is still
    // correctly readable via inheritance from either element, but the
    // getBoundingClientRect() geometry below needs the actual .token-layer
    // (spans the full natural image; .tk-lunge has no intrinsic size).
    const layerEl = chipRef.current?.parentElement?.parentElement;
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
    // Story 55 (ADR-021) — two levels up now (.tk-lunge sits between
    // .token-chip and .token-layer); see the identical note in startDrag.
    const layerEl = chipRef.current?.parentElement?.parentElement;
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
    // Story 57 — player hold-to-target (ADR-028). This is the documented
    // insertion point: a player pressing an NPC token used to fall straight
    // through to the `if (!isDm || isHeld) return;` guard below and do
    // nothing at all. canTarget is NPC-only and player-only, so there is no
    // possible collision with canDrag above (own-PC-only).
    if (canTarget) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      targetPointerOriginRef.current = { x: e.clientX, y: e.clientY };
      setTargetCharge("charging");
      targetChargeTimerRef.current = setTimeout(() => {
        // Commits mid-press, at the moment the threshold is crossed — not on
        // release (brief §7.1). Suppress the trailing click (ADR-028 #3) so
        // a completed hold doesn't also fire the tap-to-inspect path.
        suppressClickRef.current = true;
        targetChargeTimerRef.current = null;
        targetPointerOriginRef.current = null;
        setTargetCharge("idle");
        onTargetToken?.(token.id);
      }, TARGET_HOLD_MS);
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
  }, [canDrag, startDrag, canTarget, onTargetToken, token.id, isDm, isHeld]);

  const handlePointerMove = useCallback((e) => {
    if (isDragging) { moveDrag(e); return; }
    // Story 57 — the 8px movement threshold is purely a CANCEL condition on
    // this chip's own timer (ADR-028 #1); there is nothing to hand off to —
    // MapViewer's pan runs on a separate Mouse/Touch event family and is
    // already receiving this same gesture independently.
    if (targetCharge === "charging" && targetPointerOriginRef.current) {
      const dx = e.clientX - targetPointerOriginRef.current.x;
      const dy = e.clientY - targetPointerOriginRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > TARGET_MOVE_CANCEL_PX) {
        clearTargetCharge();
      }
    }
  }, [isDragging, moveDrag, targetCharge, clearTargetCharge]);

  const handlePointerUp = useCallback((e) => {
    if (isDragging) {
      releaseDrag(e);
      return;
    }
    clearLongPressCharge();
    clearTargetCharge();
  }, [isDragging, releaseDrag, clearLongPressCharge, clearTargetCharge]);

  const handlePointerCancel = useCallback((e) => {
    if (isDragging) {
      cancelDrag(e);
      return;
    }
    clearLongPressCharge();
    clearTargetCharge();
  }, [isDragging, cancelDrag, clearLongPressCharge, clearTargetCharge]);

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
      if (targetChargeTimerRef.current) clearTimeout(targetChargeTimerRef.current);
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
    !isDm && !hasMounted ? "token-chip--appearing" : "",
    labelHidden ? "token-chip--label-hidden" : "",
    calibTween ? "token-chip--calib-tween" : "",
    removing ? "token-chip--removing" : "",
    canDrag ? "token-chip--own-draggable" : "",
    isDragging ? "token-chip--dragging" : "",
    isDm && resizeActive ? "token-chip--resize-active" : "",
    exiting ? "token-chip--exiting" : "",
    rmFlash ? "tk-rm-flash" : "",
  ].filter(Boolean).join(" ");

  // Stories 52–54 — derived render flags. `veiled`/`secret` come from the
  // server-computed flag only (never re-derived from `rawConditions` here —
  // that would be a second source of truth for a security-relevant rule).
  const tkHitClasses = [
    "tk-hit",
    damageState?.phaseAFresh && damageState.tier === "heavy" ? "tk-flash-heavy" : "",
    damageState?.phaseAFresh && damageState.tier === "standard" ? "tk-flash-standard" : "",
    exiting ? "tk-token-exit" : "",
  ].filter(Boolean).join(" ");
  const showWound = !!damageState?.phaseBLive && !isFallen;
  const eligibleConditions = getBadgeEligibleConditions(rawConditions, exhaustionLevel);

  // Story 44 — current scale for the stepper readout
  const currentScale = Number.isFinite(token.scale) ? token.scale : 1.0;
  const currentSizeIdx = nearestSizeIndex(currentScale);
  const currentLabel = SIZE_LABELS[SIZE_STEPS[currentSizeIdx]] || "MEDIUM";

  // Story 55 — ADR-021's outer wrapper. .token-chip already carries position
  // (--token-x/-y) baked into its own single `transform` alongside the
  // counter-rotation and both size multipliers (see the file-header note on
  // the Stories 52–54 CSS block) — there is no separate `.token-pos`
  // wrapper. .tk-lunge is therefore introduced as a new OUTER ancestor
  // (unlike .tk-hit, which is an inner child) so the lunge's translate() is
  // expressed in map-frame (natural-image, pre-counter-rotation) space —
  // .token-chip's counter-rotation would otherwise point it the wrong way on
  // a rotated map. --token-x/-y move here; .token-chip's own transform below
  // drops them (battleMode.css).
  // token-chip--poll-animated now lives here (not on .token-chip) — position
  // (--token-x/-y) moved to this wrapper (ADR-021), so the smooth player-
  // side poll-move transition must transition THIS element's transform.
  // Player-only, and only after the token's first paint — the very first
  // render must NOT carry this class or the token would appear to slide in
  // from (0,0) on mount. Suppressed during an active drag so the token
  // tracks the pointer instantly instead of easing behind it.
  const lungeClasses = [
    "tk-lunge",
    lungeState ? "tk-lunge--play" : "",
    !isDm && hasMounted && !isDragging ? "token-chip--poll-animated" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={lungeClasses}
      style={{
        "--token-x": `${left}px`,
        "--token-y": `${top}px`,
        "--lunge-x": `${lungeState ? lungeState.lungeX.toFixed(1) : 0}px`,
        "--lunge-y": `${lungeState ? lungeState.lungeY.toFixed(1) : 0}px`,
        animationDelay: lungeState ? `${lungeState.startDelayMs}ms` : undefined,
      }}
    >
    <div
      ref={chipRef}
      className={chipClasses}
      data-expanded={expanded ? "true" : "false"}
      data-wounded={showWound ? "1" : undefined}
      data-veil={veiled && !secret ? "1" : undefined}
      data-veil-secret={secret ? "1" : undefined}
      data-viewer={isDm ? "dm" : "player"}
      data-cond-band={condBand}
      data-targeted={targeted ? "1" : undefined}
      style={{
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
        "--tk-shimmer-delay": `${shimmerDelayMs}ms`,
      }}
      onMouseEnter={exiting ? undefined : handleMouseEnter}
      onMouseLeave={exiting ? undefined : handleMouseLeave}
      onClick={exiting ? undefined : handleClick}
      onPointerDown={exiting ? undefined : handlePointerDown}
      onPointerMove={exiting ? undefined : handlePointerMove}
      onPointerUp={exiting ? undefined : handlePointerUp}
      onPointerCancel={exiting ? undefined : handlePointerCancel}
      onPointerLeave={exiting ? undefined : handlePointerLeave}
    >
      {/* .tk-hit — Story 52's recoil / Story 54's vanish wrapper. Wraps the
          portrait, ring, and every effect/badge layer so damage recoil (or
          the NPC vanish) moves the whole visible chip together, without ever
          touching .token-chip's own transform (fully claimed by rotation and
          the two size multipliers — see the file-header note on the Stories
          52–54 CSS block). Story 55 — also carries the impact crescent
          (target) and the chevron burst (attacker); the tracer-derived
          phaseADelayMs (when present) overrides the plain AoE-stagger delay
          so the flash waits for the tracer to land (brief §8 Rule 3). */}
      <div
        className={tkHitClasses}
        style={damageState?.phaseAFresh && damageState.delayMs ? { animationDelay: `${damageState.delayMs}ms` } : undefined}
      >
        {/* Story 55 — impact crescent (target only, both Strike and Bolt). */}
        {impactState && (
          <ImpactCrescent bearingDeg={impactState.bearingDeg} delayMs={impactState.delayMs} held={rmCrescent} />
        )}
        {/* Story 55 — velocity chevrons (attacker only, Strike only). */}
        {lungeState && (
          <ChevronBurst bearingDeg={lungeState.bearingDeg} unitPx={lungeState.unitPx} startDelayMs={lungeState.startDelayMs} />
        )}
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

        {/* Story 54 — veil ring/hatch/sheen (portrait-layer only; never dims
            .token-chip itself, which would drag badges/drag-affordance down
            with it). */}
        {(veiled || secret) && (
          <>
            <svg className="tk-veil-ring" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="18" />
            </svg>
            <div className="tk-veil-sheen" />
          </>
        )}
        {secret && <div className="tk-veil-hatch" />}
        {secret && (
          <svg className="tk-secret-mark" viewBox="0 0 10 10" aria-hidden="true">
            <polygon points="5,0.5 9.5,5 5,9.5 0.5,5" />
          </svg>
        )}

        {/* Story 52 — damage flash overlays. Conditionally mounted only,
            never present at opacity 0 (perf: no idle compositor work). */}
        {damageState?.phaseAFresh && <div className="tk-wash" />}
        {showWound && <div className="tk-wound" />}
        {damageState?.phaseAFresh && damageState.tier === "heavy" && !damageState.washOnly && (
          <div className="tk-shock" />
        )}

        {/* Story 53 — condition badge column. Absent from the DOM entirely
            when there are no eligible conditions (the common case). */}
        <ConditionBadgeColumn
          eligible={eligibleConditions}
          isFallen={isFallen}
          condBand={condBand}
        />
      </div>

      {/* Story 57 — target charge sweep (player-only, while the hold is in
          progress). Lives inside .token-chip (ADR-021) so it inherits Story
          45's counter-rotation for free. Reuses the DM long-press ring's
          exact stroke-dashoffset mechanism/geometry — a transition whose
          duration equals the hold threshold is a 1:1 progress meter with no
          JS animation loop — under a new class name so its own
          reduced-motion treatment (a static dot, not `display:none`) can
          differ from the DM ring's. */}
      {canTarget && targetCharge === "charging" && (
        <svg className="tk-target-charge-ring" viewBox="0 0 44 44">
          <circle className="track" cx="22" cy="22" r="19" />
          <circle
            className="fill"
            cx="22"
            cy="22"
            r="19"
            style={{ strokeDasharray: 119.4, strokeDashoffset: 0 }}
          />
        </svg>
      )}
      {canTarget && targetCharge === "charging" && (
        <div className="tk-target-charge-dot" aria-hidden="true" />
      )}

      {/* Story 57 — the reticle: a declared target, private to the viewing
          player (palette-tinted via --pal-accent-bright, not a universal
          colour — brief §3.1). Four diagonal bracket arcs sitting outside
          the faction ring, gaps at N/E/S/W so Story 54's ◇ slot and Story
          53's badge column stay clear. Built the same way as the existing
          .tk-veil-ring / .token-longpress-ring — one circle, a
          stroke-dasharray gapped into four equal arcs, rather than four
          hand-authored path elements. Black under-stroke (a second, wider
          circle) keeps it legible over any portrait/palette (brief §3.1). */}
      {targeted && (
        <svg className="tk-target-ring" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="tk-target-ring-under" cx="26" cy="26" r="23" />
          <circle className="tk-target-ring-stroke" cx="26" cy="26" r="23" />
        </svg>
      )}

      {/* Name label */}
      <div className="token-chip__label" style={{ color: pal?.text }}>
        {name.split(" ")[0]}
      </div>

      {/* HP hover card */}
      <div className={`token-hp-card${flipCard ? " token-hp-card--flip" : ""}`}>
        <div className="token-hp-card__name">{name}</div>

        {/* Story 54 — the authoritative record; first row of the condition
            block on every viewer (being barely present outranks being
            poisoned). SECRET gets a DM-only second line. */}
        {(veiled || secret) && (
          <div className="token-hp-card__invis-line">
            ◇ INVISIBLE
            {isDm && secret && (
              <div className="token-hp-card__secret-line">◦ Unseen by players</div>
            )}
          </div>
        )}

        {/* Story 53 — every active condition by name, in the same priority
            order as the badge column (superset, not a differently-sorted
            list). Exhaustion is the one item shown numerically here. */}
        {eligibleConditions.length > 0 && (
          <div className="token-hp-card__cond-block">
            {eligibleConditions.map((item, i) => (
              <div key={item.name + i} className="token-hp-card__cond-line" style={{ color: FAMILY_COLORS[item.meta.family] }}>
                {item.name === "Exhaustion" ? `EXHAUSTION ${item.meta.exhaustionLevel}` : String(item.name).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Story 52 — Phase B wound line. Suppressed on FALLEN; damage
            amount hidden for a player viewing an NPC (whose exact HP is
            already hidden from players elsewhere on this card). */}
        {showWound && (
          <div className="token-hp-card__wound-line">
            {!isDm && token.type === "npc"
              ? "◦ Recently wounded"
              : `◦ Took ${damageState?.lastDamageAmount ?? "?"} — hasn't acted`}
          </div>
        )}

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
    </div>
  );
});

// ── BattleModeController ─────────────────────────────────────────────────────
// Not actively used by MapPanel (logic inlined there), but kept as a re-export
// point for completeness and future use.
export default function BattleModeController() {
  return null;
}
