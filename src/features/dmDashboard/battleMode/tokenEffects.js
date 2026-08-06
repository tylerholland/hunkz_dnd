import { useEffect, useRef, useState } from "react";

/**
 * tokenEffects.js — shared logic for the Stories 52–55 token-effects cluster
 * (damage flash, persistent condition badges, invisible veil, attack
 * tracer). Single owner so MapPanel.jsx (DM) and PlayerMapViewer
 * (CharacterSheetSessionMode.jsx) can never drift, per each story's
 * Architect Notes.
 *
 * All age arithmetic here is against the caller-supplied `serverTime`
 * (from GET /session-state), never Date.now() — a clock-skewed client must
 * still compute the same answer as every other viewer.
 */

// Non-reactive prefers-reduced-motion read, matching the inline check
// already used elsewhere in this cluster (TokenChip's Phase A rmFlash) —
// this app doesn't need live-toggle reactivity for an OS-level setting.
export function usePrefersReducedMotion() {
  const [reduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  return reduced;
}

// ── Story 52 — damage flash ─────────────────────────────────────────────
export const DAMAGE_FRESHNESS_MS = 4000; // Phase A fires only within this window
export const DAMAGE_OUT_OF_COMBAT_MS = 12000; // Phase B fallback window with no active combat
export const AOE_STAGGER_MS = 70;
export const AOE_STAGGER_CAP = 6;

// Resolve Standard vs Heavy intensity tier for Phase A.
// hpCurrent/hpMax are the entity's CURRENT values (post-damage); the pre-hit
// value is reconstructed as hpCurrent + lastDamageAmount (assumes no
// intervening heal between the hit and this read, true for the freshness
// window this is evaluated in).
export function resolveIntensityTier({ lastDamageAmount, hpCurrent, hpMax }) {
  if (!Number.isFinite(lastDamageAmount) || lastDamageAmount <= 0) return "standard";
  if (!Number.isFinite(hpMax) || hpMax <= 0) return lastDamageAmount > 0 ? "heavy" : "standard";
  if (hpCurrent <= 0) return "heavy";
  if (lastDamageAmount >= 0.25 * hpMax) return "heavy";
  const hpBefore = hpCurrent + lastDamageAmount;
  if (hpBefore > 0.2 * hpMax && hpCurrent <= 0.2 * hpMax) return "heavy"; // crossed below 20%
  return "standard";
}

// Phase B (wound halo) liveness — derived, never a server-side clear.
// phaseB_live = lastDamagedAt
//   && !(entityIsCurrentlyActive && turnStartedAt >= lastDamagedAt)
//   && (inCombat || serverTime - lastDamagedAt <= DAMAGE_OUT_OF_COMBAT_MS)
export function isPhaseBLive({ lastDamagedAt, serverTime, isCurrentlyActiveTurn, turnStartedAt, inCombat }) {
  if (!lastDamagedAt) return false;
  const stampMs = Date.parse(lastDamagedAt);
  if (!Number.isFinite(stampMs)) return false;
  if (isCurrentlyActiveTurn && turnStartedAt) {
    const turnMs = Date.parse(turnStartedAt);
    if (Number.isFinite(turnMs) && turnMs >= stampMs) return false; // shaken off on this entity's own turn start
  }
  if (inCombat) return true;
  const nowMs = Date.parse(serverTime) || Date.now();
  return nowMs - stampMs <= DAMAGE_OUT_OF_COMBAT_MS;
}

// Phase A freshness gate — fires only if the stamp is recent AND newer than
// what this client last rendered for that entity (never on first paint).
// `seenStampsRef` is a Map<entityKey, lastSeenStamp|null> owned by the caller
// (one per map surface) and mutated in place.
export function resolveDamageState(entityKey, damage, ctx, seenStampsRef) {
  const { lastDamagedAt, lastDamageAmount, hpCurrent, hpMax } = damage;
  const { serverTime, isCurrentlyActiveTurn, turnStartedAt, inCombat } = ctx;

  const seen = seenStampsRef.has(entityKey) ? seenStampsRef.get(entityKey) : undefined;
  const isFirstPaint = seen === undefined;
  const isNewStamp = !!lastDamagedAt && lastDamagedAt !== seen;

  let phaseAFresh = false;
  if (lastDamagedAt && isNewStamp && !isFirstPaint) {
    const stampMs = Date.parse(lastDamagedAt);
    const nowMs = Date.parse(serverTime) || Date.now();
    if (Number.isFinite(stampMs) && nowMs - stampMs <= DAMAGE_FRESHNESS_MS) {
      phaseAFresh = true;
    }
  }
  seenStampsRef.set(entityKey, lastDamagedAt || null);

  const phaseBLive = isPhaseBLive({ lastDamagedAt, serverTime, isCurrentlyActiveTurn, turnStartedAt, inCombat });
  const tier = phaseAFresh ? resolveIntensityTier({ lastDamageAmount, hpCurrent, hpMax }) : null;

  return { phaseAFresh, phaseBLive, tier, lastDamageAmount: lastDamageAmount ?? null };
}

// AoE batching — assign a 70ms-stable stagger index to every token whose
// Phase A fired fresh in this same tick (stable order = input order).
// Beyond the cap, Phase A degrades to wash-only (no shockwave/recoil).
export function assignAoEStagger(freshEntityKeysInOrder) {
  const result = new Map();
  freshEntityKeysInOrder.forEach((key, i) => {
    result.set(key, { delayMs: Math.min(i, AOE_STAGGER_CAP) * AOE_STAGGER_MS, washOnly: i >= AOE_STAGGER_CAP });
  });
  return result;
}

// ── Story 53 — persistent condition badges ──────────────────────────────

export const FAMILY_COLORS = {
  control: "#b05878",
  bind: "#c8903c",
  sense: "#8a7cc8",
  physical: "#8fae3c",
  unknown: "#c8c0b4",
};

// rank: 1 = incapacitating … 4 = attrition (lower = higher priority)
const CONDITION_TABLE = {
  unconscious: { family: "control", rank: 1, glyphId: "g-unconscious" },
  paralyzed: { family: "control", rank: 1, glyphId: "g-paralyzed" },
  stunned: { family: "control", rank: 1, glyphId: "g-stunned" },
  petrified: { family: "control", rank: 1, glyphId: "g-petrified" },
  incapacitated: { family: "control", rank: 1, glyphId: "g-incapacitated" },
  restrained: { family: "bind", rank: 2, glyphId: "g-restrained" },
  grappled: { family: "bind", rank: 2, glyphId: "g-grappled" },
  prone: { family: "bind", rank: 2, glyphId: "g-prone" },
  blinded: { family: "sense", rank: 3, glyphId: "g-blinded" },
  charmed: { family: "sense", rank: 3, glyphId: "g-charmed" },
  frightened: { family: "sense", rank: 3, glyphId: "g-frightened" },
  deafened: { family: "sense", rank: 3, glyphId: "g-deafened" },
  poisoned: { family: "physical", rank: 4, glyphId: "g-poisoned" },
};

// Story 54 — Invisible is deliberately excluded from the badge set on every
// viewer identically; it's Story 54's own whole-token treatment.
export function isInvisibleCondition(name) {
  return typeof name === "string" && name.trim().toLowerCase() === "invisible";
}

function normalizeConditionKey(name) {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

// Resolve a single condition (or the synthetic "Exhaustion" entry) to its
// family/rank/glyph. Unrecognised strings get the neutral fallback (rank 4,
// single-dot glyph) — never silently dropped.
export function resolveConditionMeta(name, exhaustionLevel) {
  const key = normalizeConditionKey(name);
  if (key === "exhaustion") {
    // Story 53 — six-segment radial gauge, promoted to Control family/rank
    // at exhaustionLevel >= 4 (5e halves HP max and zeroes speed there).
    const level = Number.isFinite(exhaustionLevel) ? exhaustionLevel : 0;
    return level >= 4
      ? { family: "control", rank: 1, glyphId: "g-exhaustion", exhaustionLevel: level }
      : { family: "physical", rank: 4, glyphId: "g-exhaustion", exhaustionLevel: level };
  }
  const entry = CONDITION_TABLE[key];
  if (entry) return { ...entry };
  return { family: "unknown", rank: 4, glyphId: "g-unknown" };
}

// Badge-eligible set = conditions[] minus Invisible, plus a synthetic
// "Exhaustion" entry when exhaustionLevel >= 1. Tie-break on conditions[]
// array index (application order) — never alphabetical.
export function getBadgeEligibleConditions(conditions, exhaustionLevel) {
  const list = Array.isArray(conditions) ? conditions : [];
  const items = list
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => !isInvisibleCondition(name));

  if (Number.isFinite(exhaustionLevel) && exhaustionLevel >= 1) {
    items.push({ name: "Exhaustion", index: list.length });
  }

  return items
    .map(({ name, index }) => ({ name, index, meta: resolveConditionMeta(name, exhaustionLevel) }))
    .sort((a, b) => (a.meta.rank - b.meta.rank) || (a.index - b.index));
}

// Size-band resolver (shared by badges §53 and the veil ladder §54).
// effective_px = 36 * token.scale * map.tokenScale * viewerZoom
export function resolveCondBand(effectivePx) {
  if (effectivePx >= 30) return "full"; // 3 slots
  if (effectivePx >= 20) return "two"; // 2 slots — everyday mobile case
  if (effectivePx >= 12) return "one"; // 1 slot, collapsed/summary
  return "none";
}

export function condBandSlotCount(band) {
  if (band === "full") return 3;
  if (band === "two") return 2;
  if (band === "one") return 1;
  return 0;
}

// ── Story 54 — invisible token veil ─────────────────────────────────────

// Debounce the shared zoom value 80ms in the parent (not per-chip) so every
// token's condition-band/veil-ladder changes on the same tick — a staggered
// band change across a board would read as a bug. (The brief also calls for
// 2px hysteresis at the boundary; simplified to a pure debounce here — see
// the Stories 52–54 implementation notes for why.)
export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function computeEffectivePx({ tokenScale = 1, mapTokenScale = 1, zoom = 1 }) {
  return 36 * (Number.isFinite(tokenScale) ? tokenScale : 1)
    * (Number.isFinite(mapTokenScale) ? mapTokenScale : 1)
    * (Number.isFinite(zoom) ? zoom : 1);
}

// Deterministic per-token shimmer phase offset (djb2-style hash, same
// approach as npcInitialColor in tokenUtils.js) — never random per mount,
// or every remount would resynchronise every shimmer on the board.
export function shimmerPhaseOffsetMs(id) {
  let hash = 0;
  const str = String(id || "");
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % 3200; // matches the 3.2s shimmer cycle
}

// Token-exit registry (Story 54 §"the vanish") — diff-driven: a token present
// last render and absent this render (an NPC going invisible, server-omitted
// from the player payload) renders as a 500ms fading ghost instead of an
// instant DOM removal. Map switch is always instant; a bulk disappearance
// (>3 at once — "Clear NPCs from Map", encounter end) is also instant, not a
// stealth event; a token that reappears while still a ghost cancels the ghost
// with no re-appear animation (a returning token mounts fresh).
const EXIT_MS = 500;
const EXIT_BULK_CAP = 3;

// ── Story 55 — attack tracer ─────────────────────────────────────────────
// Bolt-only for v1 (Channel is cut entirely — see Story 55 Architect Notes
// risk #4). Geometry is computed in natural-image pixels, never normalised
// fractions, so classification is rotation-invariant and identical on every
// viewer. All constants named per the story's "ship as one named constant,
// tune after a live session" instruction.
export const TRACER_UNIT_PX = 36; // U = 36 * map.tokenScale
export const MELEE_GAP_THRESHOLD_U = 1.0; // gap <= 1.0U -> Strike, else Bolt
export const BOLT_DURATION_FLOOR_MS = 220;
export const BOLT_DURATION_CEILING_MS = 420;
export const LUNGE_FRACTION = 0.06; // 6% translate toward target and back
export const LUNGE_OUT_MS = 140;
export const LUNGE_BACK_MS = 180;
export const LUNGE_TOTAL_MS = LUNGE_OUT_MS + LUNGE_BACK_MS;
export const CHEVRON_STEPS_U = [0.08, 0.24, 0.40]; // × U out from the attacker's rim
export const CHEVRON_STAGGER_MS = 55;
export const CHEVRON_FADE_MS = 200; // 90ms in + 110ms out, per chevron
export const IMPACT_CRESCENT_MS = 120;
export const TRACER_PHASE_A_DELAY_CAP_MS = 480; // Phase A start-delay cap
export const TRACER_CONCURRENCY_CAP = 3; // at most 3 concurrent crescents/tracers
export const TRACER_QUEUE_STAGGER_MS = 250; // beyond the cap, later events get no tracer
export const NPC_BOLT_TINT = "#c0c8c0"; // neutral steel — non-PC attacker
export const BOLT_CORE_COLOR = "#dce8f0"; // cold-steel white core, also the crescent colour

// Resolve Strike vs Bolt from token distance in natural-image pixels (not
// normalised fractions — anisotropic on non-square maps and would
// misclassify melee vs ranged). Rotation never enters this math.
export function classifyTracerGeometry({ attacker, target, imageW, imageH, mapTokenScale }) {
  const scale = Number.isFinite(mapTokenScale) ? mapTokenScale : 1;
  const U = TRACER_UNIT_PX * scale;
  const ax = attacker.x * imageW, ay = attacker.y * imageH;
  const tx = target.x * imageW, ty = target.y * imageH;
  const dx = tx - ax, dy = ty - ay;
  const dist = Math.hypot(dx, dy);
  const rA = (TRACER_UNIT_PX / 2) * (Number.isFinite(attacker.scale) ? attacker.scale : 1) * scale;
  const rB = (TRACER_UNIT_PX / 2) * (Number.isFinite(target.scale) ? target.scale : 1) * scale;
  const gap = dist - rA - rB;
  const kind = gap <= MELEE_GAP_THRESHOLD_U * U ? "strike" : "bolt";
  const bearingRad = Math.atan2(dy, dx); // map-frame bearing, attacker -> target
  const bearingDeg = (bearingRad * 180) / Math.PI;
  const ux = dist > 0 ? dx / dist : 1;
  const uy = dist > 0 ? dy / dist : 0;
  return { ax, ay, tx, ty, dx, dy, dist, gap: Math.max(gap, 1), U, rA, rB, kind, bearingDeg, ux, uy };
}

// Duration scales with distance: 220ms floor, 420ms ceiling — matches the
// reference prototype's clamp(180 + 12*(gap/U), 220, 420) formula.
export function boltDurationMs(gapPx, unitPx) {
  const unit = unitPx > 0 ? unitPx : TRACER_UNIT_PX;
  const gapU = gapPx / unit;
  return Math.min(Math.max(180 + 12 * gapU, BOLT_DURATION_FLOOR_MS), BOLT_DURATION_CEILING_MS);
}

// Choreography clock — single owner shared by both maps (Story 55 amends
// Story 52's fixed 60ms into this supplied parameter). Only the token flash
// waits; HP numerals update immediately and optimistically (ADR-011).
export function resolvePhaseADelayMs(tracerImpactMs) {
  const impact = Number.isFinite(tracerImpactMs) ? tracerImpactMs : 0;
  return Math.min(TRACER_PHASE_A_DELAY_CAP_MS, impact + 60);
}

// Build one tracer event per token whose Phase A just fired fresh AND whose
// lastDamageFrom resolves to another placed token on the CURRENT viewer's
// map. Events beyond TRACER_CONCURRENCY_CAP get no tracer (their Phase A
// flash is unaffected — same wash-only-style degradation as Story 52's AoE
// cap). Shared by MapPanel (DM) and PlayerMapViewer so the two surfaces can
// never draw a different geometry for the same event.
//
// `freshEventsInOrder`: [{ targetTokenId, attackerRef: {type,sourceId} }],
// stable input order (same order the caller iterates its token list in).
export function buildTracerEvents({ tokens, freshEventsInOrder, imageW, imageH, mapTokenScale }) {
  const byTarget = new Map();
  const byAttacker = new Map();
  if (!imageW || !imageH) return { byTarget, byAttacker };

  const list = tokens || [];
  const eligible = [];
  for (const evt of freshEventsInOrder || []) {
    if (!evt?.attackerRef?.type || !evt?.attackerRef?.sourceId) continue;
    const targetToken = list.find((t) => t.id === evt.targetTokenId);
    if (!targetToken) continue;
    const attackerToken = list.find(
      (t) => t.type === evt.attackerRef.type && t.sourceId === evt.attackerRef.sourceId
    );
    if (!attackerToken || attackerToken.id === targetToken.id) continue;
    eligible.push({ targetToken, attackerToken });
  }

  eligible.slice(0, TRACER_CONCURRENCY_CAP).forEach((pair, i) => {
    const geom = classifyTracerGeometry({
      attacker: pair.attackerToken,
      target: pair.targetToken,
      imageW,
      imageH,
      mapTokenScale,
    });
    const startDelayMs = i * TRACER_QUEUE_STAGGER_MS;
    // travelMs: the Bolt's own SVG draw duration, or the Strike lunge's full
    // out-and-back duration — NOT the same as when the impact "lands."
    const travelMs = geom.kind === "bolt" ? boltDurationMs(geom.gap, geom.U) : LUNGE_TOTAL_MS;
    // localImpactMs: t=0 of the "crescent, then +60ms shockwave" choreography
    // (brief §8 Rule 3) — for a Bolt that's arrival (travelMs); for a Strike
    // it's the lunge's peak (LUNGE_OUT_MS), not the full out-and-back.
    const localImpactMs = geom.kind === "bolt" ? travelMs : LUNGE_OUT_MS;
    const impactDelayMs = startDelayMs + localImpactMs;
    const event = {
      kind: geom.kind,
      attackerTokenId: pair.attackerToken.id,
      targetTokenId: pair.targetToken.id,
      geom,
      startDelayMs,
      travelMs,
      impactDelayMs,
      phaseADelayMs: resolvePhaseADelayMs(impactDelayMs),
    };
    byTarget.set(pair.targetToken.id, event);
    if (!byAttacker.has(pair.attackerToken.id)) byAttacker.set(pair.attackerToken.id, event);
  });

  return { byTarget, byAttacker };
}

// 6% of one token-diameter unit (U), toward the target and back — a subtle
// nudge, not a travel. Map-frame dx/dy (no rotation correction — the
// .tk-lunge wrapper it drives sits outside .token-chip's counter-rotation,
// per ADR-021).
export function computeLungeOffsetPx(geom) {
  const lungeDist = LUNGE_FRACTION * geom.U;
  return { lungeX: geom.ux * lungeDist, lungeY: geom.uy * lungeDist };
}

export function useTokenExitGhosts(liveTokens, mapId) {
  const prevTokensRef = useRef(new Map());
  const prevMapIdRef = useRef(mapId);
  const timersRef = useRef(new Map());
  const [ghosts, setGhosts] = useState([]);

  useEffect(() => {
    const liveById = new Map((liveTokens || []).map((t) => [t.id, t]));
    const mapChanged = prevMapIdRef.current !== mapId;
    prevMapIdRef.current = mapId;

    if (mapChanged) {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = new Map();
      setGhosts([]);
      prevTokensRef.current = liveById;
      return;
    }

    const prevById = prevTokensRef.current;
    const newlyGone = [];
    prevById.forEach((token, id) => {
      if (!liveById.has(id)) newlyGone.push(token);
    });

    if (newlyGone.length > 0 && newlyGone.length <= EXIT_BULK_CAP) {
      setGhosts((g) => [...g, ...newlyGone]);
      newlyGone.forEach((token) => {
        const timer = setTimeout(() => {
          setGhosts((g) => g.filter((gh) => gh.id !== token.id));
          timersRef.current.delete(token.id);
        }, EXIT_MS);
        timersRef.current.set(token.id, timer);
      });
    }
    // >EXIT_BULK_CAP simultaneous departures: instant, no ghost animation.

    // Return-during-exit cancels the ghost with no re-appear animation.
    liveById.forEach((_token, id) => {
      if (timersRef.current.has(id)) {
        clearTimeout(timersRef.current.get(id));
        timersRef.current.delete(id);
        setGhosts((g) => g.filter((gh) => gh.id !== id));
      }
    });

    prevTokensRef.current = liveById;
  }, [liveTokens, mapId]);

  useEffect(() => () => timersRef.current.forEach((timer) => clearTimeout(timer)), []);

  return ghosts;
}
