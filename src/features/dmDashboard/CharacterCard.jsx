import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { patchSession } from "../../api";
import { PALETTES } from "../characterSheet/theme";
import { useDebouncedOptimisticNumberFlush } from "../../lib/liveSync";
import {
  PalCtx,
  conditionStyle,
  getDeathSaveCounts,
  getHpTone,
  getPartyCardActiveSurface,
  getPartyCardPalette,
  getSpellSlotGroups,
  toTitleCase,
  useHoldToRepeat,
  withAlpha,
} from "./dashboardShared";
import { AwardXpModal } from "./characterCard/AwardXpModal";
import { DistributeCoinModal } from "./characterCard/DistributeCoinModal";
import DamageHealModal from "./characterCard/DamageHealModal";
import QuickActionPopover from "./characterCard/QuickActionPopover";
import DmNotesStrip from "./characterCard/DmNotesStrip";
import XpCoinRow from "./characterCard/XpCoinRow";
import DeathSavesStrip from "./characterCard/DeathSavesStrip";
import "./characterCard.css";

export { AwardXpModal } from "./characterCard/AwardXpModal";
export { DistributeCoinModal } from "./characterCard/DistributeCoinModal";

function ExternalLinkIcon({ color }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path d="M3 2.25H1.75a.75.75 0 0 0-.75.75v6.25c0 .414.336.75.75.75H8a.75.75 0 0 0 .75-.75V8" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 1h4v4" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 1 4.75 6.25" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CharacterCard({
  char,
  dmPassword,
  onUpdate,
  onCommitSessionUpdates,
  onRegisterOpen,
  onPopoverOpenChange,
  isActiveTurn = false,
  allParty = [],
  showTier2 = true,
  dimmed = false,
  onHeaderClick,
}) {
  const pal = useContext(PalCtx);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [showAwardXp, setShowAwardXp] = useState(false);
  const [showDistributeCoin, setShowDistributeCoin] = useState(false);
  const [coinExpanded, setCoinExpanded] = useState(false);
  const charPal = PALETTES[char.palette] || PALETTES.ocean;
  const cardPal = getPartyCardPalette(charPal, pal);

  const hpMax = char.hpMax ?? char.hp ?? null;
  const serverHp = char.hpCurrent ?? null;
  const hasHp = serverHp !== null && hpMax !== null && hpMax > 0;

  const [optimisticHp, setOptimisticHp] = useState(serverHp ?? 0);
  const optimisticHpRef = useRef(serverHp ?? 0);
  const serverHpRef = useRef(serverHp ?? 0);
  const hpMaxRef = useRef(hpMax ?? 0);
  const pendingDeltaRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const [deltaIndicator, setDeltaIndicator] = useState(null);
  const [hpFeedback, setHpFeedback] = useState(null);
  const [removingConds, setRemovingConds] = useState([]);
  const [fadingConcentration, setFadingConcentration] = useState(null);
  const hpFeedbackTimeoutRef = useRef(null);
  const prevAnimatedHpRef = useRef(serverHp ?? 0);
  const removalTimersRef = useRef(new Map());
  const concentrationFadeTimeoutRef = useRef(null);
  const prevConcentrationRef = useRef(char.concentration);

  const [optimisticXp, setOptimisticXp] = useState(char.xpCurrent ?? 0);
  const xpPendingRef = useRef(false);
  const [optimisticCoin, setOptimisticCoin] = useState(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  const coinPendingRef = useRef(false);

  // Death saves — full pip/shortcut/FALLEN behavior lives in DeathSavesStrip; isFallen/isStable
  // are lifted here because the card shell needs them for its own classes/opacity (ADR-011).
  const wasAtZeroRef = useRef(false);
  const initialSaves = getDeathSaveCounts(char);
  const [isFallen, setIsFallen] = useState(() => initialSaves.failures >= 3);
  const [isStable, setIsStable] = useState(() => initialSaves.successes >= 3);
  const deathSavesRef = useRef(null);

  useEffect(() => {
    optimisticHpRef.current = optimisticHp;
  }, [optimisticHp]);

  useEffect(() => {
    onPopoverOpenChange?.(popoverOpen);
  }, [onPopoverOpenChange, popoverOpen]);

  useEffect(() => {
    hpMaxRef.current = hpMax ?? 0;
    if (serverHp !== null) {
      serverHpRef.current = serverHp;
    }
    if (pendingDeltaRef.current === 0 && !flushInFlightRef.current) {
      setOptimisticHp(serverHp ?? 0);
      optimisticHpRef.current = serverHp ?? 0;
    }
  }, [serverHp, hpMax]);

  useEffect(() => {
    if (!xpPendingRef.current) setOptimisticXp(char.xpCurrent ?? 0);
  }, [char.xpCurrent]);

  useEffect(() => {
    if (!coinPendingRef.current) setOptimisticCoin(char.coin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  }, [char.coin]);

  useEffect(() => {
    setCoinExpanded(false);
  }, [char.slug, char.coinMode]);

  // When HP rises above 0 (healed), the death-save-specific state (prompt/shortcuts/fallen/stable)
  // resets inside DeathSavesStrip itself; this only resets the HP-domain "was at zero" tracker.
  useEffect(() => {
    if (optimisticHp > 0) {
      wasAtZeroRef.current = false;
    }
  }, [optimisticHp]);

  useEffect(() => {
    const previous = prevAnimatedHpRef.current;
    if (typeof previous === "number" && previous !== optimisticHp) {
      const nextFeedback = optimisticHp < previous ? "damage" : "heal";
      setHpFeedback(nextFeedback);
      window.clearTimeout(hpFeedbackTimeoutRef.current);
      hpFeedbackTimeoutRef.current = window.setTimeout(() => setHpFeedback(null), nextFeedback === "damage" ? 300 : 250);
    }
    prevAnimatedHpRef.current = optimisticHp;
  }, [optimisticHp]);

  useEffect(() => () => {
    window.clearTimeout(hpFeedbackTimeoutRef.current);
    window.clearTimeout(concentrationFadeTimeoutRef.current);
    removalTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    removalTimersRef.current.clear();
  }, []);

  const getTargetHp = useCallback(
    () => Math.max(0, Math.min(hpMaxRef.current ?? 0, optimisticHpRef.current)),
    []
  );
  const commitHp = useCallback(
    async (targetHp) => {
      // Detect damage-at-0 stepper path: HP settles at 0 while already at 0
      // wasAtZeroRef tracks whether the character was at 0 before the gesture started
      if (targetHp === 0 && wasAtZeroRef.current) {
        deathSavesRef.current?.showDmgAtZeroPrompt();
      }
      return patchSession(char.slug, { hpCurrent: targetHp }, dmPassword);
    },
    [char.slug, dmPassword]
  );
  const rollbackHp = useCallback((previousServerHp) => {
    optimisticHpRef.current = previousServerHp;
    setOptimisticHp(previousServerHp);
  }, [setOptimisticHp]);
  const debouncedFlushRef = useDebouncedOptimisticNumberFlush({
    enabled: hasHp,
    delay: 300,
    fieldName: "hpCurrent",
    getTargetValue: getTargetHp,
    serverValueRef: serverHpRef,
    inFlightRef: flushInFlightRef,
    pendingDeltaRef,
    commitValue: commitHp,
    setLocalValue: rollbackHp,
    requestSync: onUpdate,
  });

  function applyDelta(delta) {
    const current = optimisticHpRef.current;
    const newOptimistic = Math.max(0, Math.min(hpMax ?? 0, current + delta));
    const actualDelta = newOptimistic - current;
    if (actualDelta === 0) return;
    // Track whether the character was at 0 before this gesture began
    // (only set on the first tick of a new gesture when pendingDelta was 0)
    if (pendingDeltaRef.current === 0 && delta < 0) {
      wasAtZeroRef.current = current === 0;
    }
    pendingDeltaRef.current += actualDelta;
    optimisticHpRef.current = newOptimistic;
    setOptimisticHp(newOptimistic);
    setDeltaIndicator({ value: pendingDeltaRef.current, key: Date.now() });
    debouncedFlushRef.current();
  }

  useEffect(() => {
    if (onRegisterOpen) {
      onRegisterOpen(char.slug, () => {
        setModalMode("damage");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char.slug]);

  const minusBind = useHoldToRepeat(() => applyDelta(-1));
  const plusBind = useHoldToRepeat(() => applyDelta(1));

  const displayHp = hasHp ? optimisticHp : null;
  const hpPct = hasHp ? Math.max(0, Math.min(1, optimisticHp / hpMax)) : 0;
  const hpDanger = hasHp && hpPct < 0.25;
  const hpTone = getHpTone(cardPal, hpPct);

  const conditions = Array.isArray(char.conditions) ? char.conditions : [];
  const concentration = char.concentration;
  const isConcentrating = concentration?.active;
  const concentrationKey = `${concentration?.active ? "1" : "0"}|${concentration?.spell || ""}`;

  useEffect(() => {
    const previousConcentration = prevConcentrationRef.current;
    if (previousConcentration?.active && !isConcentrating) {
      setFadingConcentration(previousConcentration);
      window.clearTimeout(concentrationFadeTimeoutRef.current);
      concentrationFadeTimeoutRef.current = window.setTimeout(() => setFadingConcentration(null), 200);
    } else if (isConcentrating) {
      setFadingConcentration(null);
    }
    prevConcentrationRef.current = concentration;
  }, [concentrationKey, concentration, isConcentrating]);

  const visibleConds = [...conditions, ...removingConds.filter((condition) => !conditions.includes(condition))];
  const concentrationDisplay = isConcentrating ? concentration : fadingConcentration;
  const conScore = char.stats?.find((s) => s.stat === "Constitution")?.score ?? 10;
  const conItemBonus = [...(char.weapons || []), ...(char.equipment || [])].reduce((sum, item) => {
    return sum + (item.mods || []).filter((m) => m.attribute === "Constitution").reduce((s, m) => s + (parseInt(m.value, 10) || 0), 0);
  }, 0);
  const conSaveMod = Math.floor((conScore - 10) / 2) + conItemBonus;

  // Saves strip computations (Story 20)
  const allItems = [...(char.weapons || []), ...(char.equipment || [])];
  const equippedItems = allItems.filter((item) => item.equipped !== false);
  const wisScore = char.stats?.find((s) => s.stat === "Wisdom")?.score ?? 10;
  const wisItemBonus = equippedItems.reduce((sum, item) => {
    return sum + (item.mods || []).filter((m) => m.attribute === "Wisdom").reduce((s, m) => s + (parseInt(m.value, 10) || 0), 0);
  }, 0);
  const dexScore = char.stats?.find((s) => s.stat === "Dexterity")?.score ?? 10;
  const dexItemBonus = equippedItems.reduce((sum, item) => {
    return sum + (item.mods || []).filter((m) => m.attribute === "Dexterity").reduce((s, m) => s + (parseInt(m.value, 10) || 0), 0);
  }, 0);
  const speedItemBonus = equippedItems.reduce((sum, item) => {
    return sum + (item.mods || []).filter((m) => m.attribute === "Speed").reduce((s, m) => s + (parseInt(m.value, 10) || 0), 0);
  }, 0);
  const passivePerception = 10 + Math.floor((wisScore - 10) / 2) + wisItemBonus;
  const wisSaveMod = Math.floor((wisScore - 10) / 2) + wisItemBonus;
  const dexSaveMod = Math.floor((dexScore - 10) / 2) + dexItemBonus;
  const SPEED_ZERO_CONDITIONS = ["Restrained", "Paralyzed", "Petrified", "Grappled"];
  const activeConditions = Array.isArray(char.conditions) ? char.conditions : [];
  const speedZeroed = SPEED_ZERO_CONDITIONS.some((c) => activeConditions.includes(c));
  const baseSpeed = char.speed ?? 30;
  const netSpeed = speedZeroed ? 0 : baseSpeed + speedItemBonus;
  const showSpeed = netSpeed !== 30 || speedItemBonus !== 0;
  const formatSaveMod = (mod) => (mod >= 0 ? "+" : "") + mod;
  const conSaveLabel = (conSaveMod >= 0 ? "+" : "") + conSaveMod;
  const hasStatusRow = visibleConds.length > 0 || !!concentrationDisplay || !!char.inspiration;
  const spellSlotGroups = getSpellSlotGroups(char.spellSlots || []);
  const showDeathSaves = hasHp && optimisticHp === 0 && (!isStable || isFallen);
  const metaParts = [toTitleCase(char.race), toTitleCase(char.charClass), char.level ? `Lvl ${char.level}` : null].filter(Boolean);

  const commitSessionFields = useCallback(async (fields) => {
    if (!fields || typeof fields !== "object") return false;

    if (onCommitSessionUpdates) {
      return onCommitSessionUpdates([{ slug: char.slug, ...fields }]);
    }

    try {
      await patchSession(char.slug, fields, dmPassword);
      onUpdate();
      return true;
    } catch {
      onUpdate();
      return false;
    }
  }, [char.slug, dmPassword, onCommitSessionUpdates, onUpdate]);

  async function removeCondition(cond) {
    if (removingConds.includes(cond)) return;
    setRemovingConds((current) => [...current, cond]);

    const timerId = window.setTimeout(async () => {
      const updated = conditions.filter((condition) => condition !== cond);
      const success = await commitSessionFields({ conditions: updated });
      if (success === false) {
        setRemovingConds((current) => current.filter((condition) => condition !== cond));
        removalTimersRef.current.delete(cond);
        return;
      }
      const cleanupTimerId = window.setTimeout(() => {
        setRemovingConds((current) => current.filter((condition) => condition !== cond));
        removalTimersRef.current.delete(cond);
      }, 170);
      removalTimersRef.current.set(cond, cleanupTimerId);
    }, 150);

    removalTimersRef.current.set(cond, timerId);
  }

  const initial = (char.name || "?").charAt(0).toUpperCase();

  const cardBorderColor = hpDanger ? "rgba(192,96,96,0.45)" : cardPal.border;
  const stripeColor = hpDanger ? "#c06060" : cardPal.accent;
  const activeSurface = isActiveTurn
    ? getPartyCardActiveSurface(charPal, pal, cardPal)
    : cardPal.surface;

  function handlePopoverUpdate(action) {
    if (action === "shortRest" || action === "longRest") onUpdate(action);
    else onUpdate();
  }

  // Palette CSS variables set once on the card root — all children inherit via cascade
  const cardPalVars = {
    "--pal-bg": cardPal.bg,
    "--pal-surface": cardPal.surface,
    "--pal-surface-solid": cardPal.surfaceSolid,
    "--pal-border": cardPal.border,
    "--pal-accent": cardPal.accent,
    "--pal-accent-bright": cardPal.accentBright,
    "--pal-accent-dim": cardPal.accentDim,
    "--pal-text": cardPal.text,
    "--pal-text-body": cardPal.textBody,
    "--pal-text-muted": cardPal.textMuted,
    "--pal-gem": cardPal.gem,
    "--pal-gem-low": cardPal.gemLow,
    "--pal-ui-border": cardPal.uiBorder,
    "--font-display": cardPal.fontDisplay,
    "--font-body": cardPal.fontBody,
    "--font-ui": cardPal.fontUI,
    // Active-turn animation vars (referenced by .dm-active-turn keyframe in dashboard.css)
    ...(isActiveTurn ? {
      "--turn-color": cardPal.accent,
      "--turn-glow": withAlpha(cardPal.accent, 0.35),
    } : {}),
    // Portrait outer glow ring — accent at low alpha, palette-aware
    "--pal-portrait-glow": withAlpha(cardPal.accent, 0.25),
  };

  const isHpZero = hasHp && optimisticHp === 0;
  const cardClasses = [
    "cc-card",
    isActiveTurn ? "dm-active-turn" : "",
    isHpZero ? "hp-zero" : "",
    isFallen ? "fallen" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={cardClasses}
      style={{
        ...cardPalVars,
        background: activeSurface,
        border: `1px solid ${cardBorderColor}`,
        zIndex: popoverOpen ? 200 : isActiveTurn ? 2 : 1,
        transform: isActiveTurn ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isActiveTurn ? `0 4px 18px ${cardPal.accent}24` : "none",
        opacity: isStable && !isFallen ? 0.85 : undefined,
      }}
    >
      {/* Left accent stripe — color is dynamic (hp danger vs normal) */}
      <div className="cc-stripe" style={{ background: stripeColor }} />

      {/* Active-turn glow bar along bottom edge */}
      {isActiveTurn && (
        <div
          className="cc-turn-bar"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${cardPal.accent} 14%, ${cardPal.accentBright} 50%, ${cardPal.accent} 86%, transparent 100%)`,
            boxShadow: `0 0 18px ${cardPal.accent}99`,
          }}
        />
      )}

      <div className="cc-header-grid">
        {/* Portrait */}
        <div className="cc-portrait">
          {char.portraitUrl ? (
            <img src={char.portraitUrl} alt={char.name} />
          ) : (
            <span className="cc-portrait-initial">{initial}</span>
          )}
        </div>

        {/* Character body */}
        <div
          className="cc-identity"
          style={{ cursor: onHeaderClick ? "pointer" : "default" }}
          onClick={onHeaderClick}
        >
          {/* Name row — AC badge moved to actions column */}
          <div className="cc-name-row">
            <div
              className="cc-name-text"
              style={{ textShadow: isActiveTurn ? `0 0 10px ${cardPal.accent}55` : "none" }}
            >{char.name || "Unknown"}</div>
          </div>

          {/* Race · Class · Level + external link */}
          <div className="cc-meta-row">
            <span className="cc-meta-text">
              {metaParts.join(" · ")}
            </span>
            <Link
              to={`/characters/${char.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${char.name || "character"} sheet`}
              className="cc-external-link"
            >
              <ExternalLinkIcon color={cardPal.textMuted} />
            </Link>
          </div>
        </div>

        {/* Actions column: kebab menu + AC badge + popover */}
        <div className="cc-actions-col">
          <button
            onClick={() => setPopoverOpen((value) => !value)}
            className={`cc-kebab-btn${popoverOpen ? " active" : ""}`}
            title="More actions"
          >⋯</button>
          <div className="cc-ac-badge">
            AC {char.armorTotal ?? "—"}
          </div>

          {popoverOpen && (
            <QuickActionPopover
              char={char}
              pal={cardPal}
              basePal={charPal}
              onClose={() => setPopoverOpen(false)}
              onUpdate={handlePopoverUpdate}
              onOpenHpModal={setModalMode}
              onCommitFields={commitSessionFields}
            />
          )}
        </div>
      </div>

      {/* Full-width section below header */}
      <div className="cc-card-body">
          {/* HP row */}
          {hasHp && (
            <div className="cc-hp-row">
              <button
                className="btn-stepper-sm"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); minusBind.start(); }}
                onPointerUp={minusBind.stop}
                onPointerCancel={minusBind.stop}
                title="Deal 1 damage (hold to repeat)"
              >−</button>
              <div className="cc-hp-nums">
                <span className="cc-hp-current" style={{ color: hpTone.text }}>{displayHp}</span>
                <span className="cc-hp-sep">/</span>
                <span className="cc-hp-max">{hpMax}</span>
              </div>
              <div className="cc-hp-bar">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const segStart = idx / 5;
                  const segFill = Math.max(0, Math.min(1, (hpPct - segStart) * 5));
                  return (
                    <div key={idx} className="cc-hp-seg">
                      {/* Fill width is dynamic — must stay inline */}
                      <div style={{ position: "absolute", inset: 0, width: `${segFill * 100}%`, background: hpTone.fill, transition: "width 0.25s ease" }} />
                    </div>
                  );
                })}
                {hpFeedback && (
                  <div
                    className={`dm-hp-feedback ${hpFeedback === "damage" ? "dm-hp-feedback-damage" : "dm-hp-feedback-heal"}`}
                    style={{
                      background: hpFeedback === "damage"
                        ? "linear-gradient(90deg, rgba(192,96,96,0.28) 0%, rgba(192,96,96,0.08) 100%)"
                        : `linear-gradient(90deg, ${cardPal.accentBright}3d 0%, transparent 100%)`,
                      boxShadow: hpFeedback === "heal" ? `0 0 14px ${cardPal.accentBright}55 inset` : "none",
                    }}
                  />
                )}
              </div>
              <button
                className="btn-stepper-sm"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); plusBind.start(); }}
                onPointerUp={plusBind.stop}
                onPointerCancel={plusBind.stop}
                title="Heal 1 HP (hold to repeat)"
              >+</button>
              {deltaIndicator && (
                <span key={deltaIndicator.key} className="dm-hp-delta" style={{ color: hpTone.text }}>
                  {deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : `${deltaIndicator.value}`}
                </span>
              )}
            </div>
          )}

          {/* Temp HP */}
          {hasHp && char.tempHP > 0 && (
            <div className="cc-temp-hp-row">
              <span className="cc-temp-hp-badge">
                +{char.tempHP} temp
              </span>
            </div>
          )}

          {/* Status row: conditions, concentration, inspiration */}
          {hasStatusRow && (
            <div className="cc-status-row" style={{ marginBottom: spellSlotGroups.length > 0 ? 8 : 6 }}>
              {visibleConds.map((cond) => {
                const cs = conditionStyle(cond);
                const isRemoving = removingConds.includes(cond);
                return (
                  <span
                    key={cond}
                    onClick={() => removeCondition(cond)}
                    title={`Remove ${cond}`}
                    className={isRemoving ? "dm-condition-exit" : "dm-condition-enter"}
                    style={{ background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 10, color: cs.color, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", cursor: "pointer" }}
                  >{cond} ×</span>
                );
              })}
              {concentrationDisplay && (
                <span className={`cc-concentration${!isConcentrating && fadingConcentration ? " dm-fade-out" : ""}`}>
                  <span className="dm-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: cardPal.accentBright, boxShadow: `0 0 5px ${cardPal.accentBright}`, flexShrink: 0, display: "inline-block" }} />
                  {concentrationDisplay.spell || "Concentrating"}
                  <span className="cc-con-save">· CON {conSaveLabel}</span>
                </span>
              )}
              {char.inspiration && (
                <span className="cc-inspiration">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: cardPal.gem, boxShadow: `0 0 6px ${cardPal.gem}66`, display: "inline-block" }} />
                  Inspired
                </span>
              )}
            </div>
          )}

          {/* Spell slots */}
          {spellSlotGroups.length > 0 && (
            <div className="cc-slots-row">
              {spellSlotGroups.map((slot) => (
                <div key={slot.key} className="cc-slot-group">
                  <span className="cc-slot-label">
                    L{slot.label}
                  </span>
                  {Array.from({ length: slot.max }).map((_, pipIdx) => {
                    const remaining = slot.max - slot.used;
                    const filled = pipIdx < remaining;
                    return (
                      <span
                        key={`${slot.key}-${pipIdx}`}
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: filled ? cardPal.gem : "transparent",
                          border: `1.5px solid ${filled ? cardPal.gem : cardPal.uiBorder}`,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Saves strip (Story 20) */}
          {hasHp && (
            <div className="cc-saves-strip">
              <span className="cc-saves-perc-label">Perc</span>
              <span className="cc-saves-perc-value">{passivePerception}</span>
              <div className="cc-saves-divider-dot" />
              <div className="cc-saves-triad">
                <div className="cc-save-pair">
                  <span className="cc-save-pair-label">Wis</span>
                  <span className="cc-save-pair-value">{formatSaveMod(wisSaveMod)}</span>
                </div>
                <span className="cc-save-sep">·</span>
                <div className="cc-save-pair">
                  <span className="cc-save-pair-label">Con</span>
                  <span className="cc-save-pair-value">{formatSaveMod(conSaveMod)}</span>
                </div>
                <span className="cc-save-sep">·</span>
                <div className="cc-save-pair">
                  <span className="cc-save-pair-label">Dex</span>
                  <span className="cc-save-pair-value">{formatSaveMod(dexSaveMod)}</span>
                </div>
              </div>
              {showSpeed && (
                <>
                  <div className="cc-saves-divider-dot" />
                  <span
                    className="cc-saves-speed-value"
                    style={speedZeroed ? { color: "#c06060" } : undefined}
                  >{netSpeed}ft</span>
                </>
              )}
            </div>
          )}

          {/* Tier-2 collapse: XP + Coin */}
          <XpCoinRow
            char={char}
            cardPal={cardPal}
            optimisticXp={optimisticXp}
            optimisticCoin={optimisticCoin}
            coinExpanded={coinExpanded}
            setCoinExpanded={setCoinExpanded}
            setShowAwardXp={setShowAwardXp}
            setShowDistributeCoin={setShowDistributeCoin}
            showTier2={showTier2}
          />
      </div>

      <DmNotesStrip
        slug={char.slug}
        dmNotes={char.dmNotes || []}
        sharedPlayerNotes={char.sharedPlayerNotes || []}
        dmPassword={dmPassword}
        pal={cardPal}
        hasDeathStripBelow={showDeathSaves}
      />

      {/* Death Saves Strip — mounts below Notes when HP = 0 (brief §3a–§3e) */}
      <DeathSavesStrip
        ref={deathSavesRef}
        char={char}
        optimisticHp={optimisticHp}
        mounted={showDeathSaves}
        isFallen={isFallen}
        setIsFallen={setIsFallen}
        isStable={isStable}
        setIsStable={setIsStable}
        commitSessionFields={commitSessionFields}
        onForceHpTo1={() => { serverHpRef.current = 1; setOptimisticHp(1); }}
      />

      {modalMode && (
        <DamageHealModal
          char={{ ...char, hpCurrent: optimisticHp }}
          mode={modalMode}
          dmPassword={dmPassword}
          onClose={() => setModalMode(null)}
          onOptimisticUpdate={(newHp) => {
            const wasZero = optimisticHp === 0;
            setOptimisticHp(newHp);
            if (modalMode === "damage" && wasZero && newHp === 0) {
              deathSavesRef.current?.showDmgAtZeroPrompt();
            }
          }}
          onSync={onUpdate}
        />
      )}

      {showAwardXp && (
        <AwardXpModal
          char={{ ...char, xpCurrent: optimisticXp }}
          dmPassword={dmPassword}
          onClose={() => setShowAwardXp(false)}
          onUpdate={onUpdate}
          onOptimisticUpdate={(updates) => {
            const me = updates.find((u) => u.slug === char.slug);
            if (me) { xpPendingRef.current = true; setOptimisticXp(me.xpCurrent); setTimeout(() => { xpPendingRef.current = false; }, 3000); }
          }}
          forParty={false}
          party={allParty}
        />
      )}

      {showDistributeCoin && (
        <DistributeCoinModal
          char={{ ...char, coin: optimisticCoin }}
          dmPassword={dmPassword}
          onClose={() => setShowDistributeCoin(false)}
          onUpdate={onUpdate}
          onOptimisticUpdate={(updates) => {
            const me = updates.find((u) => u.slug === char.slug);
            if (me) { coinPendingRef.current = true; setOptimisticCoin(me.coin); setTimeout(() => { coinPendingRef.current = false; }, 3000); }
          }}
          forParty={false}
          party={allParty}
        />
      )}
    </div>
  );
}
