import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getDeathSaveCounts } from "../dashboardShared";
import "../characterCard.css";

// The 0-HP strip: pips, shortcut row, damage-at-0 prompt, FALLEN/stable states (Story 19).
// `isFallen`/`isStable` are lifted to the parent card (needed there for card-level classes/opacity
// and the mounted/hasDeathStripBelow calculations); everything else is owned locally.
// Exposes `showDmgAtZeroPrompt()` via ref for the parent's HP-stepper/damage-modal flows.
const DeathSavesStrip = forwardRef(function DeathSavesStrip(
  { char, optimisticHp, mounted, isFallen, setIsFallen, isStable, setIsStable, commitSessionFields, onForceHpTo1 },
  ref
) {
  const [optimisticDeathSaves, setOptimisticDeathSaves] = useState(() => getDeathSaveCounts(char));
  const deathSavesPendingRef = useRef(false);
  // Damage-at-0 inline prompt: shown after the HP settles at 0 while already at 0
  const [damageAtZeroPrompt, setDamageAtZeroPrompt] = useState(false);
  // Ref to shake the death-save strip
  const deathSavesBlockRef = useRef(null);
  // Shortcut row disclosure state and 30s inactivity auto-collapse
  const [deathShortcutsOpen, setDeathShortcutsOpen] = useState(false);
  const deathShortcutsOpenRef = useRef(false);
  const shortcutsInactivityRef = useRef(null);
  // 12-second auto-resolve timer for damage-at-0 prompt
  const dmgAtZeroTimerRef = useRef(null);

  // Sync death saves from server when not in a pending write
  useEffect(() => {
    if (!deathSavesPendingRef.current) {
      const saves = getDeathSaveCounts(char);
      setOptimisticDeathSaves(saves);
      // Reconcile derived states
      if (saves.failures >= 3) setIsFallen(true);
      else if (saves.failures < 3) setIsFallen(false);
      if (saves.successes >= 3) setIsStable(true);
      else if (saves.successes < 3 && saves.failures < 3) setIsStable(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char.deathSaves]);

  // When HP rises above 0 (healed), clear prompt, shortcuts, and fallen/stable states
  useEffect(() => {
    if (optimisticHp > 0) {
      dismissDmgPrompt();
      closeDeathShortcuts();
      setIsFallen(false);
      setIsStable(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimisticHp]);

  useEffect(() => () => {
    window.clearTimeout(shortcutsInactivityRef.current);
    window.clearTimeout(dmgAtZeroTimerRef.current);
  }, []);

  const commitDeathSaves = useCallback(async (nextSaves) => {
    const clamped = {
      successes: Math.max(0, Math.min(3, nextSaves.successes)),
      failures: Math.max(0, Math.min(3, nextSaves.failures)),
    };
    deathSavesPendingRef.current = true;
    setOptimisticDeathSaves(clamped);
    try {
      await commitSessionFields({ deathSaves: clamped });
    } finally {
      deathSavesPendingRef.current = false;
    }
  }, [commitSessionFields]);

  function triggerDeathSaveShake() {
    const el = deathSavesBlockRef.current;
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 320);
  }

  function resetShortcutsInactivity() {
    window.clearTimeout(shortcutsInactivityRef.current);
    shortcutsInactivityRef.current = window.setTimeout(() => {
      setDeathShortcutsOpen(false);
    }, 30000);
  }

  function openDeathShortcuts() {
    deathShortcutsOpenRef.current = true;
    setDeathShortcutsOpen(true);
    resetShortcutsInactivity();
  }

  function closeDeathShortcuts() {
    window.clearTimeout(shortcutsInactivityRef.current);
    deathShortcutsOpenRef.current = false;
    setDeathShortcutsOpen(false);
  }

  function showDmgAtZeroPrompt() {
    // Collapse shortcuts first if open (180ms), then show prompt
    if (deathShortcutsOpenRef.current) {
      closeDeathShortcuts();
      window.setTimeout(() => _activateDmgPrompt(), 200);
    } else {
      _activateDmgPrompt();
    }
  }

  function _activateDmgPrompt() {
    setDamageAtZeroPrompt(true);
    window.clearTimeout(dmgAtZeroTimerRef.current);
    dmgAtZeroTimerRef.current = window.setTimeout(() => {
      setDamageAtZeroPrompt(false);
    }, 12000);
  }

  function dismissDmgPrompt() {
    window.clearTimeout(dmgAtZeroTimerRef.current);
    setDamageAtZeroPrompt(false);
  }

  // Death save pip tap handlers
  function handleSuccessPip(idx) {
    const current = optimisticDeathSaves.successes;
    let next;
    if (idx < current) {
      next = idx;
    } else {
      next = idx + 1;
    }
    const nextSaves = { ...optimisticDeathSaves, successes: next };
    commitDeathSaves(nextSaves);
    if (next >= 3 && !isStable) {
      setIsStable(true);
      dismissDmgPrompt();
      closeDeathShortcuts();
    }
  }

  function handleFailurePip(idx) {
    const current = optimisticDeathSaves.failures;
    let next;
    if (idx < current) {
      next = idx;
      const nextSaves = { ...optimisticDeathSaves, failures: next };
      commitDeathSaves(nextSaves);
      if (isFallen) setIsFallen(false);
      return;
    } else {
      next = idx + 1;
    }
    const nextSaves = { ...optimisticDeathSaves, failures: next };
    commitDeathSaves(nextSaves);
    setTimeout(() => triggerDeathSaveShake(), 180);
    if (next >= 3 && !isFallen) {
      setIsFallen(true);
      closeDeathShortcuts();
    }
  }

  function handleFrozenPipClick(idx) {
    // Un-fill failures from idx onward → revert from FALLEN to active pip row
    const nextSaves = { ...optimisticDeathSaves, failures: idx };
    commitDeathSaves(nextSaves);
    setIsFallen(false);
  }

  function handleNat20() {
    deathSavesPendingRef.current = true;
    const nextSaves = { successes: 0, failures: 0 };
    setOptimisticDeathSaves(nextSaves);
    setIsFallen(false);
    setIsStable(false);
    dismissDmgPrompt();
    closeDeathShortcuts();
    onForceHpTo1?.();
    commitSessionFields({ hpCurrent: 1, deathSaves: nextSaves })
      .finally(() => { deathSavesPendingRef.current = false; });
  }

  function handleNat1() {
    const current = optimisticDeathSaves.failures;
    const next = Math.min(3, current + 2);
    const nextSaves = { ...optimisticDeathSaves, failures: next };
    deathSavesPendingRef.current = true;
    setOptimisticDeathSaves(nextSaves);
    setTimeout(() => triggerDeathSaveShake(), 240);
    commitDeathSaves(nextSaves).finally(() => { deathSavesPendingRef.current = false; });
    if (next >= 3 && !isFallen) {
      setIsFallen(true);
      closeDeathShortcuts();
    }
  }

  function handleStable() {
    const nextSaves = { successes: 0, failures: 0 };
    commitDeathSaves(nextSaves);
    setIsStable(true);
    setIsFallen(false);
    dismissDmgPrompt();
    closeDeathShortcuts();
  }

  function handleDamageAtZeroFailure(count) {
    const current = optimisticDeathSaves.failures;
    const next = Math.min(3, current + count);
    const nextSaves = { ...optimisticDeathSaves, failures: next };
    commitDeathSaves(nextSaves);
    dismissDmgPrompt();
    setTimeout(() => triggerDeathSaveShake(), 180);
    if (next >= 3 && !isFallen) setIsFallen(true);
  }

  useImperativeHandle(ref, () => ({ showDmgAtZeroPrompt }));

  const deathSaves = optimisticDeathSaves;

  return (
    <div className={`ds-strip-wrap${mounted ? " mounted" : ""}`}>
      <div
        ref={deathSavesBlockRef}
        className={`ds-strip${isFallen ? " fallen" : ""}`}
      >
        {/* Tombstone (FALLEN state — brief §3d) */}
        {isFallen && (
          <div className="ds-tombstone visible">
            <span className="ds-fallen-label">
              <span className="ds-fallen-glyph">⨯</span>Fallen
            </span>
            <div className="ds-frozen-cluster">
              {[0, 1, 2].map((idx) => (
                <button
                  key={`ds-frozen-${idx}`}
                  className="ds-pip"
                  onClick={(e) => { e.stopPropagation(); handleFrozenPipClick(idx); }}
                  title={`Un-fill failure ${idx + 1} — revert from Fallen`}
                >
                  <div className="ds-pip-dot failure-filled frozen" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pip row (hidden in FALLEN, replaced by damage prompt when active) */}
        {!isFallen && (
          <>
            {/* Damage-at-0 prompt — replaces pip row contents (brief §3c) */}
            <div className={`ds-damage-prompt${damageAtZeroPrompt ? " visible" : ""}`}>
              <span className="ds-dmg-label">+ Damage at 0</span>
              <button
                className="ds-dmg-pill fail-one"
                onClick={(e) => { e.stopPropagation(); handleDamageAtZeroFailure(1); }}
              >+1 Fail</button>
              <button
                className="ds-dmg-pill fail-crit"
                onClick={(e) => { e.stopPropagation(); handleDamageAtZeroFailure(2); }}
              >Crit <strong>+2</strong></button>
              <button
                className="ds-dmg-pill no-fail"
                onClick={(e) => { e.stopPropagation(); dismissDmgPrompt(); }}
              >No Fail</button>
            </div>

            {/* Pip row (hidden while damage prompt is showing) */}
            {!damageAtZeroPrompt && (
              <div className="ds-pip-row">
                <span className="ds-label">Death Saves</span>

                {/* Success cluster */}
                <div className="ds-pip-cluster">
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={`ds-s-${idx}`}
                      className="ds-pip"
                      onClick={(e) => { e.stopPropagation(); handleSuccessPip(idx); }}
                      title={`Success ${idx + 1}`}
                    >
                      <div className={`ds-pip-dot ${idx < deathSaves.successes ? "success-filled" : "success-empty"}`} />
                    </button>
                  ))}
                </div>

                <div className="ds-cluster-divider" />

                {/* Failure cluster */}
                <div className="ds-pip-cluster">
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={`ds-f-${idx}`}
                      className="ds-pip"
                      onClick={(e) => { e.stopPropagation(); handleFailurePip(idx); }}
                      title={`Failure ${idx + 1}`}
                    >
                      <div className={`ds-pip-dot ${idx < deathSaves.failures ? "failure-filled" : "failure-empty"}`} />
                    </button>
                  ))}
                </div>

                {/* Disclosure chevron */}
                <button
                  className="ds-chevron-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deathShortcutsOpen) {
                      closeDeathShortcuts();
                    } else {
                      openDeathShortcuts();
                    }
                  }}
                  title={deathShortcutsOpen ? "Hide shortcuts" : "Show shortcuts (NAT 20 / NAT 1 / Stable)"}
                >
                  <span className={`ds-chevron-glyph${deathShortcutsOpen ? " expanded" : ""}`}>⌃</span>
                </button>
              </div>
            )}

            {/* Inner divider + shortcut row (brief §3b) */}
            <div className={`ds-inner-divider${deathShortcutsOpen ? " visible" : ""}`} />
            <div className={`ds-shortcut-row${deathShortcutsOpen ? " expanded" : ""}`}>
              <button
                className="ds-shortcut-pill nat20"
                onClick={(e) => { e.stopPropagation(); handleNat20(); }}
                title="Natural 20 — HP → 1, clear saves"
              >Nat 20</button>
              <button
                className="ds-shortcut-pill nat1"
                onClick={(e) => { e.stopPropagation(); handleNat1(); }}
                title="Natural 1 — +2 failures"
              >Nat 1</button>
              <div className="ds-shortcut-stable">
                <button
                  className="ds-shortcut-pill stable"
                  onClick={(e) => { e.stopPropagation(); handleStable(); }}
                  title="Stabilized via Medicine check or spell — HP stays 0"
                >✦ Stable</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default DeathSavesStrip;
