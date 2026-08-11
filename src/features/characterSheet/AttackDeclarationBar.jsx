/**
 * AttackDeclarationBar — Story 57.
 *
 * The fixed-to-viewport bar that drives a player's target-first attack
 * declaration on the session-mode Map sub-tab. Four states (brief §3.3):
 *   PICK   — target chosen, no attack chip yet
 *   ARMED  — attack chip chosen, ready to roll to-hit
 *   RESULT (atk) — to-hit landed; offers DAMAGE or AGAIN
 *   RESULT (dmg) — damage landed; offers AGAIN only
 *
 * Purely presentational plus the small amount of local UI state the brief's
 * §3.4 editable-expression affordance needs (which step is being edited,
 * and the draft text) — every state TRANSITION (select attack, roll, cancel,
 * retarget) is owned by the caller (CharacterSheetSessionMode) and reached
 * here via callback props, per the story's Architect Notes ("Declaration
 * state lives in CharacterSheetSessionMode").
 */
import { useEffect, useRef, useState } from "react";
import { parseDiceExpr } from "../../components/DiceRoller";
import { extractRollValues, formatRollValues } from "../../lib/rollHistory";

function deriveBarState(declaration) {
  if (!declaration) return null;
  if (declaration.gone) return "gone";
  if (!declaration.attack) return "pick";
  if (!declaration.lastRoll) return "armed";
  return declaration.lastRoll.step === "dmg" ? "result-dmg" : "result-atk";
}

export default function AttackDeclarationBar({
  pal,
  declaration,
  chips,
  rolling,
  advMode,
  onSetAdvMode,
  getAttackExpr,
  onSelectAttack,
  onReopenPicker,
  onCancel,
  onRoll, // ({ step: "atk"|"dmg", exprOverride? })
}) {
  const state = deriveBarState(declaration);

  const [editingStep, setEditingStep] = useState(null); // null | "atk" | "dmg"
  const [exprDraft, setExprDraft] = useState("");
  const [exprError, setExprError] = useState("");
  const [exprOverrides, setExprOverrides] = useState({}); // { atk?: string, dmg?: string }
  const [shakingChipId, setShakingChipId] = useState(null);
  const shakeTimerRef = useRef(null);
  const prevAttackIdRef = useRef(declaration?.attack?.id);

  useEffect(() => () => { if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current); }, []);

  // A different attack (or a fresh declaration) clears any edited expression
  // — an edited expression is scoped to the attack it was typed against.
  useEffect(() => {
    if (declaration?.attack?.id !== prevAttackIdRef.current) {
      prevAttackIdRef.current = declaration?.attack?.id;
      setExprOverrides({});
      setEditingStep(null);
      setExprError("");
    }
  }, [declaration?.attack?.id]);

  if (!state) return null;

  const attack = declaration.attack;
  const targetName = declaration.target?.name || "";

  // The step the PRIMARY button (or, in RESULT-dmg, the only button) would
  // roll next — this is what the Adv/Dis strip gates on (brief §3.4: ATK
  // step only, never damage).
  const nextStep = state === "result-atk" ? "dmg" : "atk";
  const showAdvStrip = !declaration.gone && (state === "armed" || state === "result-dmg");

  function startEdit(step) {
    if (declaration.gone || rolling) return;
    const loaded = exprOverrides[step] ?? getAttackExpr?.(attack, step) ?? "";
    setExprDraft(loaded);
    setExprError("");
    setEditingStep(step);
  }

  function commitEdit() {
    const trimmed = exprDraft.trim();
    if (!trimmed) { setEditingStep(null); setExprError(""); return; }
    const parsed = parseDiceExpr(trimmed);
    if (!parsed || parsed.groups.length === 0) {
      setExprError("Could not parse — try e.g. 1d20+7 or 2d6+3");
      return;
    }
    setExprOverrides((prev) => ({ ...prev, [editingStep]: trimmed }));
    setEditingStep(null);
    setExprError("");
  }

  function fireRoll(step) {
    if (rolling || declaration.gone) return;
    onRoll?.({ step, exprOverride: exprOverrides[step] });
  }

  // Note: `nextStep` already equals "the step whose expression should be
  // shown/edited" in every state (armed → atk; result-atk → dmg;
  // result-dmg → atk, since AGAIN rolls the to-hit step again) — a single
  // derivation, not a per-state special case.
  const chosenExpr = attack
    ? (exprOverrides[nextStep] ?? getAttackExpr?.(attack, nextStep) ?? "")
    : "";

  const lastRoll = declaration.lastRoll;
  const rollValuesText = lastRoll ? formatRollValues(extractRollValues(lastRoll)) : "";
  const totalColor = lastRoll?.isCrit ? "#ffd060" : lastRoll?.isFumble ? "#c06060" : pal.gem;

  return (
    <div className={`cs-atk-bar${declaration.gone ? " cs-atk-bar--gone" : ""}`} data-state={state}>
      <div className="cs-atk-bar-inner">
        {/* Target */}
        <button
          type="button"
          className="cs-atk-target"
          onClick={() => {}}
          disabled={declaration.gone}
          title={targetName}
        >
          <span className="cs-atk-target-glyph">◎</span>
          <span className="cs-atk-target-name">
            {declaration.gone ? <span className="cs-atk-target-gone">{targetName} — GONE</span> : targetName}
          </span>
        </button>

        {/* Cancel */}
        <button type="button" className="cs-atk-cancel" onClick={onCancel} aria-label="Cancel declaration">×</button>

        {!declaration.gone && <div className="cs-atk-divider" />}

        {/* PICK — attack picker row */}
        {!declaration.gone && state === "pick" && (
          <div className="cs-atk-picker">
            {chips.length === 0 && (
              <span className="cs-atk-picker-empty">No weapons or attack spells configured.</span>
            )}
            {chips.map((chip, i) => {
              const prevChip = chips[i - 1];
              const showDivider = prevChip && prevChip.kind === "weapon" && chip.kind === "spell";
              return (
                <div key={chip.id} style={{ display: "flex", alignItems: "center" }}>
                  {showDivider && <span className="cs-atk-chip-divider" />}
                  <button
                    type="button"
                    className={`cs-atk-chip${shakingChipId === chip.id ? " cs-atk-chip-shake" : ""}`}
                    data-kind={chip.kind}
                    data-state={chip.spent ? "spent" : "ready"}
                    onClick={() => {
                      if (chip.spent) {
                        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
                        setShakingChipId(chip.id);
                        shakeTimerRef.current = setTimeout(() => setShakingChipId(null), 270);
                        return;
                      }
                      onSelectAttack(chip);
                    }}
                  >
                    {chip.kind === "spell" && <span className="cs-atk-chip-glyph">✶</span>}
                    <span className="cs-atk-chip-name">{chip.name}</span>
                    {chip.spent ? (
                      <span className="cs-atk-chip-slot">SLOTS 0</span>
                    ) : chip.toHit ? (
                      <span className="cs-atk-chip-tohit">{chip.toHit}</span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ARMED / RESULT — chosen chip (+ editable expr) + result readout */}
        {!declaration.gone && state !== "pick" && attack && (
          <div className="cs-atk-chosen">
            <button type="button" className="cs-atk-chosen-chip" onClick={onReopenPicker}>
              {attack.kind === "spell" && <span className="cs-atk-chip-glyph">✶</span>}
              <span className="cs-atk-chosen-name">{attack.name}</span>
              {editingStep === nextStep ? (
                <input
                  className="cs-atk-chosen-expr-input"
                  autoFocus
                  value={exprDraft}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { setExprDraft(e.target.value); setExprError(""); }}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") { e.preventDefault(); setEditingStep(null); setExprError(""); }
                  }}
                />
              ) : (
                <span
                  className="cs-atk-chosen-expr"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(nextStep);
                  }}
                >
                  {chosenExpr}
                </span>
              )}
            </button>

            {lastRoll && (
              <div className="cs-atk-result">
                {rollValuesText && <span className="cs-atk-result-dice">{rollValuesText}</span>}
                <span className="cs-atk-result-total" style={{ color: totalColor }}>{lastRoll.total}</span>
                {lastRoll.isCrit && <span className="cs-atk-result-badge cs-atk-result-badge--crit">CRIT</span>}
                {lastRoll.isFumble && <span className="cs-atk-result-badge cs-atk-result-badge--fumble">FUMBLE</span>}
              </div>
            )}
          </div>
        )}

        {exprError && <div className="cs-atk-expr-error">{exprError}</div>}

        {/* Adv/Dis strip — to-hit step only (brief §3.4) */}
        {showAdvStrip && (
          <div className="cs-atk-adv-strip">
            {["normal", "advantage", "disadvantage"].map((mode) => (
              <button
                key={mode}
                type="button"
                data-mode={mode}
                className={`cs-atk-adv-btn${advMode === mode ? " active" : ""}`}
                onClick={() => onSetAdvMode?.(mode)}
                title={mode === "normal" ? "Normal" : mode === "advantage" ? "Advantage" : "Disadvantage"}
              >
                {mode === "normal" ? "N" : mode === "advantage" ? "ADV" : "DIS"}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        {!declaration.gone && (
          <div className="cs-atk-actions">
            {state === "armed" && (
              <button type="button" className="cs-atk-roll btn-primary" disabled={rolling} onClick={() => fireRoll("atk")}>
                ATTACK
              </button>
            )}
            {state === "result-atk" && (
              <>
                {attack?.damage && (
                  <button type="button" className="cs-atk-roll btn-primary" disabled={rolling} onClick={() => fireRoll("dmg")}>
                    ⚔ DAMAGE
                  </button>
                )}
                <button type="button" className="cs-atk-secondary btn-ghost" disabled={rolling} onClick={() => fireRoll("atk")}>
                  ↺ AGAIN
                </button>
              </>
            )}
            {state === "result-dmg" && (
              <button type="button" className="cs-atk-roll btn-primary" disabled={rolling} onClick={() => fireRoll("atk")}>
                ↺ AGAIN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
