import { useState, useRef, useEffect, useCallback } from "react";
import { parseDiceExpr, rollDie, DieShape } from "./DiceRoller";

// ── Constants ──────────────────────────────────────────────────────────────────
const ALL_SIDES = [4, 6, 8, 10, 12, 20, 100];

const DICE_CSS = `
@keyframes dm-dr-spin-in {
  0%   { transform: rotate(0deg) scale(0.6); opacity: 0.4; }
  60%  { transform: rotate(380deg) scale(1.08); opacity: 1; }
  80%  { transform: rotate(355deg) scale(0.97); }
  100% { transform: rotate(360deg) scale(1); opacity: 1; }
}
@keyframes dm-dr-land-normal {
  0%   { filter: drop-shadow(0 0 0px rgba(138,180,200,0)); }
  40%  { filter: drop-shadow(0 0 18px rgba(138,180,200,0.7)); }
  100% { filter: drop-shadow(0 0 6px rgba(138,180,200,0.2)); }
}
@keyframes dm-dr-land-crit {
  0%   { filter: drop-shadow(0 0 0px rgba(255,200,40,0)); }
  35%  { filter: drop-shadow(0 0 28px rgba(255,200,40,0.9)); }
  100% { filter: drop-shadow(0 0 10px rgba(255,200,40,0.4)); }
}
@keyframes dm-dr-land-fumble {
  0%   { filter: drop-shadow(0 0 0px rgba(192,60,60,0)); }
  35%  { filter: drop-shadow(0 0 28px rgba(192,60,60,0.9)); }
  100% { filter: drop-shadow(0 0 10px rgba(192,60,60,0.3)); }
}
@keyframes dm-dr-num-cycle {
  0%   { opacity: 0.5; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes dm-dr-reveal-num {
  0%   { transform: scale(0.5) translateY(8px); opacity: 0; }
  70%  { transform: scale(1.15) translateY(-2px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes dm-dr-row-reveal {
  0%   { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Execute a single roll from parsed groups + flat + advMode.
 * Returns a result object: { groups, flat, total, isCrit, isFumble, advKept, advDiscarded, isMultiGroup }
 */
function executeSingleRoll(groups, flat, advMode) {
  const rolledGroups = groups.map(({ count, sides }) => ({
    sides,
    rolls: Array.from({ length: count }, () => rollDie(sides)),
  }));

  const isSingleD20 = groups.length === 1 && groups[0].sides === 20 && groups[0].count === 1;
  let advKept = null, advDiscarded = null;

  if (isSingleD20 && advMode !== "normal") {
    const r2 = rollDie(20);
    const r1 = rolledGroups[0].rolls[0];
    if (advMode === "advantage") {
      advKept = Math.max(r1, r2); advDiscarded = Math.min(r1, r2);
    } else {
      advKept = Math.min(r1, r2); advDiscarded = Math.max(r1, r2);
    }
    rolledGroups[0].rolls[0] = advKept;
  }

  const diceTotal = rolledGroups.reduce((sum, g) => sum + g.rolls.reduce((s, r) => s + r, 0), 0);
  const total = diceTotal + flat;
  const rawRoll = isSingleD20 ? rolledGroups[0].rolls[0] : null;
  const hasD20 = groups.some(g => g.sides === 20);
  const isCrit = hasD20 && rawRoll === 20;
  const isFumble = hasD20 && rawRoll === 1;
  const isMultiGroup = rolledGroups.length > 1;

  return { groups: rolledGroups, flat, total, isCrit, isFumble, advKept, advDiscarded, isMultiGroup };
}

function isDamageRoll(groups) {
  return groups.every(g => g.sides !== 20);
}

function buildExprLabel(groups, flat) {
  const parts = groups.map(g => `${g.count}d${g.sides}`);
  if (flat !== 0) parts.push(flat > 0 ? `+${flat}` : `${flat}`);
  return parts.join("+");
}

// ── DmDiceRoller ───────────────────────────────────────────────────────────────
export default function DmDiceRoller({ pal, party = [], npcs = [], onApplyDamage, onApplyNpcDamage }) {
  // Collapsed/open — persisted
  const [isOpen, setIsOpen] = useState(() =>
    sessionStorage.getItem("dnd_dice_dm_open") === "true"
  );

  // Roll configuration
  const [advMode, setAdvMode] = useState("normal");
  const [repeatCount, setRepeatCount] = useState(1);
  const [selectedSides, setSelectedSides] = useState(20);
  const [dieCount, setDieCount] = useState(1);
  const [comboDice, setComboDice] = useState([]);
  const [comboMod, setComboMod] = useState(0);
  const [exprInput, setExprInput] = useState("");
  const [exprError, setExprError] = useState("");

  // Results
  const [isRolling, setIsRolling] = useState(false);
  const [rollResults, setRollResults] = useState(null); // array of result objects, or null
  const [applyTarget, setApplyTarget] = useState(0); // which result row is selected
  const [cycleNum, setCycleNum] = useState(null);
  const cycleRef = useRef(null);

  // History — last 10, session-only
  const [history, setHistory] = useState([]);

  useEffect(() => () => { if (cycleRef.current) clearInterval(cycleRef.current); }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      sessionStorage.setItem("dnd_dice_dm_open", String(next));
      return next;
    });
  }, []);

  // ── Roll execution ──────────────────────────────────────────────────────────
  const doRoll = useCallback(() => {
    if (isRolling) return;

    let groups, flat;
    if (exprInput.trim()) {
      const parsed = parseDiceExpr(exprInput.trim());
      if (!parsed || parsed.groups.length === 0) {
        setExprError("Could not parse — use NdX or N terms, e.g. 2d6+1d4+3");
        return;
      }
      groups = parsed.groups; flat = parsed.flat;
    } else if (comboDice.length > 0) {
      groups = comboDice; flat = comboMod;
    } else {
      groups = [{ count: dieCount, sides: selectedSides }]; flat = comboMod;
    }

    setExprError("");
    setRollResults(null);
    setApplyTarget(0);
    setIsRolling(true);
    setCycleNum(rollDie(groups[0]?.sides || 20));

    if (cycleRef.current) clearInterval(cycleRef.current);
    cycleRef.current = setInterval(() => {
      setCycleNum(rollDie(groups[0]?.sides || 20));
    }, 90);

    const capturedAdvMode = advMode;

    setTimeout(() => {
      if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
      setCycleNum(null);

      const results = Array.from({ length: repeatCount }, () =>
        executeSingleRoll(groups, flat, capturedAdvMode)
      );

      setRollResults(results);
      setIsRolling(false);

      // Auto-reset adv/dis after roll
      setAdvMode("normal");

      // Add to history
      const exprLabel = buildExprLabel(groups, flat);
      const modeTag = capturedAdvMode !== "normal"
        ? (capturedAdvMode === "advantage" ? " (adv)" : " (dis)") : "";
      const histEntry = {
        id: Date.now() + Math.random(),
        exprLabel,
        modeTag,
        repeatCount,
        results,
        timestamp: Date.now(),
      };
      setHistory(prev => [histEntry, ...prev].slice(0, 10));
    }, 600);
  }, [isRolling, advMode, repeatCount, exprInput, comboDice, comboMod, dieCount, selectedSides]);

  // ── Combo builder ───────────────────────────────────────────────────────────
  const handleDieSelect = (sides) => setSelectedSides(sides);
  const handleDieDblClick = (sides) => {
    setComboDice(prev => {
      const ex = prev.find(g => g.sides === sides);
      if (ex) return prev.map(g => g.sides === sides ? { ...g, count: Math.min(g.count + 1, 10) } : g);
      return [...prev, { sides, count: 1 }];
    });
  };
  const addDieToCombo = () => {
    setComboDice(prev => {
      const ex = prev.find(g => g.sides === selectedSides);
      if (ex) return prev.map(g => g.sides === selectedSides ? { ...g, count: Math.min(g.count + dieCount, 10) } : g);
      return [...prev, { sides: selectedSides, count: dieCount }];
    });
  };
  const clearCombo = () => { setComboDice([]); setComboMod(0); };

  const getFreeRollLabel = () => {
    let expr;
    if (exprInput.trim()) {
      expr = exprInput.trim();
    } else if (comboDice.length > 0) {
      const parts = comboDice.map(g => `${g.count}d${g.sides}`);
      if (comboMod !== 0) parts.push(comboMod > 0 ? `+${comboMod}` : `${comboMod}`);
      expr = parts.join("+");
    } else {
      const suffix = comboMod !== 0 ? (comboMod > 0 ? `+${comboMod}` : comboMod) : "";
      expr = `${dieCount}d${selectedSides}${suffix}`;
    }
    const repeatSuffix = repeatCount > 1 ? ` ×${repeatCount}` : "";
    return `Roll ${expr}${repeatSuffix}`;
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const subLabel = {
    fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em",
    textTransform: "uppercase", color: pal.textMuted, marginBottom: 8,
  };
  const divider = { border: "none", borderTop: `1px solid ${pal.border}`, margin: "12px 0" };
  const circleBtn = (disabled) => ({
    width: 24, height: 24, borderRadius: "50%",
    border: `1px solid ${pal.border}`, background: "transparent",
    color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1,
  });

  // Determine if current result is a damage roll (no d20 in groups)
  const isDmgRoll = rollResults && rollResults.length > 0 &&
    isDamageRoll(rollResults[0].groups);

  // Selected result for apply-to
  const selectedResult = rollResults ? rollResults[Math.min(applyTarget, rollResults.length - 1)] : null;

  return (
    <>
      <style>{DICE_CSS}</style>
      <div style={{
        background: pal.surface,
        border: `1px solid ${pal.border}`,
        borderRadius: 4,
        padding: "14px 16px",
        marginTop: 16,
      }}>
        {/* ── Header ── */}
        <div
          onClick={toggleOpen}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
              <DieShape sides={20} stroke={pal.accent} fill={pal.accentDim} />
            </svg>
            <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: pal.textMuted }}>
              Dice Roller
            </span>
          </div>
          <span style={{
            fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted,
            transition: "transform 0.2s", display: "inline-block",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}>▼</span>
        </div>

        {isOpen && (
          <div style={{ marginTop: 14 }}>

            {/* ── Adv / Dis strip ── */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, marginRight: 2 }}>d20</span>
              {["normal", "advantage", "disadvantage"].map(mode => {
                const isActive = advMode === mode;
                const activeColors = mode === "advantage"
                  ? { border: "#5a9a60", bg: "rgba(60,130,60,0.18)", color: "#88c888" }
                  : mode === "disadvantage"
                  ? { border: "#9a5a5a", bg: "rgba(130,60,60,0.18)", color: "#c88888" }
                  : { border: pal.accent, bg: pal.accentDim, color: pal.accentBright };
                const label = mode === "normal" ? "Normal" : mode === "advantage" ? "Adv." : "Disadv.";
                return (
                  <button
                    key={mode}
                    onClick={() => setAdvMode(mode)}
                    style={{
                      fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.10em",
                      padding: "3px 9px", borderRadius: 3, cursor: "pointer",
                      border: `1px solid ${isActive ? activeColors.border : pal.border}`,
                      background: isActive ? activeColors.bg : "transparent",
                      color: isActive ? activeColors.color : pal.textMuted,
                      transition: "all 0.15s",
                    }}
                  >{label}</button>
                );
              })}
            </div>

            <hr style={divider} />

            {/* ── Die picker ── */}
            <div style={subLabel}>Die</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", marginBottom: 10 }}>
              {ALL_SIDES.map(sides => {
                const isSelected = selectedSides === sides && comboDice.length === 0;
                return (
                  <button
                    key={sides}
                    onClick={() => handleDieSelect(sides)}
                    onDoubleClick={() => handleDieDblClick(sides)}
                    title={`d${sides} — double-click to add to combo`}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      cursor: "pointer", border: "none", padding: "4px 2px", borderRadius: 4,
                      background: isSelected ? pal.accentDim : "transparent",
                      filter: isSelected ? `drop-shadow(0 0 5px ${pal.accent})` : "none",
                      transition: "filter 0.15s, background 0.15s",
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 100 100">
                      <DieShape
                        sides={sides}
                        stroke={isSelected ? pal.accentBright : pal.accent}
                        fill={isSelected ? pal.accentDim : pal.surface}
                      />
                      <text
                        x="50" y="58" textAnchor="middle"
                        fontSize={sides === 100 ? "16" : "18"}
                        fontWeight="500"
                        fill={isSelected ? pal.accentBright : pal.textMuted}
                        fontFamily="Cinzel, serif"
                        opacity="0.8"
                      >{sides === 100 ? "%" : sides}</text>
                    </svg>
                    <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color: isSelected ? pal.accentBright : pal.accent }}>{sides}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Count + modifier row ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 10 }}>
              {/* Die count */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted }}>Count</span>
                <button onClick={() => setDieCount(c => Math.max(1, c - 1))} style={circleBtn(dieCount <= 1)}>−</button>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: pal.gem, minWidth: 20, textAlign: "center" }}>{dieCount}</span>
                <button onClick={() => setDieCount(c => Math.min(10, c + 1))} style={circleBtn(dieCount >= 10)}>+</button>
              </div>
              {/* Flat modifier */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted }}>Mod</span>
                <input
                  type="number"
                  value={comboMod}
                  min={-99} max={99}
                  onChange={e => setComboMod(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: 56, background: pal.surfaceSolid || pal.surface,
                    border: `1px solid ${pal.border}`, borderRadius: 3,
                    color: pal.gem, fontFamily: pal.fontDisplay, fontSize: 15,
                    textAlign: "center", padding: "2px 4px", outline: "none",
                    MozAppearance: "textfield",
                  }}
                />
              </div>
            </div>

            {/* ── Combo chips ── */}
            {comboDice.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, marginRight: 2 }}>Combo</span>
                {comboDice.map((g, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.accentBright, background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 2, padding: "1px 7px" }}>
                      {g.count}d{g.sides}
                    </span>
                    {i < comboDice.length - 1 && <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: pal.textMuted }}>+</span>}
                  </span>
                ))}
                {comboMod !== 0 && (
                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.accentBright, background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 2, padding: "1px 7px" }}>
                    {comboMod > 0 ? `+${comboMod}` : comboMod}
                  </span>
                )}
              </div>
            )}

            {/* ── Add die / Clear combo ── */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
              <button
                onClick={addDieToCombo}
                style={{
                  fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.10em",
                  padding: "3px 10px", borderRadius: 3, cursor: "pointer",
                  border: `1px solid ${pal.accent}`, background: pal.accentDim,
                  color: pal.accentBright, transition: "all 0.15s",
                }}
              >+ Add Die</button>
              {comboDice.length > 0 && (
                <button
                  onClick={clearCombo}
                  style={{
                    fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.10em",
                    padding: "3px 10px", borderRadius: 3, cursor: "pointer",
                    border: `1px solid ${pal.border}`, background: "transparent",
                    color: pal.textMuted, transition: "all 0.15s",
                  }}
                >✕ Clear</button>
              )}
            </div>

            {/* ── Expression input ── */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "stretch" }}>
              <input
                type="text"
                value={exprInput}
                onChange={e => { setExprInput(e.target.value); setExprError(""); }}
                onKeyDown={e => { if (e.key === "Enter") doRoll(); }}
                placeholder="or type: 2d6+1d4+3"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1, background: pal.surfaceSolid || pal.surface,
                  border: `1px solid ${exprError ? "#9a5a5a" : pal.border}`, borderRadius: 3,
                  color: pal.text, fontFamily: pal.fontUI, fontSize: 12,
                  letterSpacing: "0.06em", padding: "6px 10px", outline: "none", minWidth: 0,
                }}
              />
              {exprInput && (
                <button
                  onClick={() => { setExprInput(""); setExprError(""); }}
                  style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, padding: "0 8px", cursor: "pointer" }}
                >✕</button>
              )}
            </div>
            {exprError && (
              <div style={{ fontFamily: pal.fontUI, fontSize: 10, color: "#c88888", marginBottom: 8, letterSpacing: "0.06em" }}>{exprError}</div>
            )}

            {/* ── Repeat count + Roll button row ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              {/* Repeat stepper */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: pal.textMuted }}>×</span>
                <button onClick={() => setRepeatCount(c => Math.max(1, c - 1))} style={circleBtn(repeatCount <= 1)}>−</button>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: repeatCount > 1 ? pal.accentBright : pal.gem, minWidth: 18, textAlign: "center" }}>{repeatCount}</span>
                <button onClick={() => setRepeatCount(c => Math.min(8, c + 1))} style={circleBtn(repeatCount >= 8)}>+</button>
              </div>

              {/* Roll button */}
              <button
                disabled={isRolling}
                onClick={doRoll}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  fontFamily: pal.fontDisplay, fontSize: 13, letterSpacing: "0.10em",
                  borderRadius: 4, cursor: isRolling ? "not-allowed" : "pointer",
                  border: `1px solid ${pal.accent}`,
                  background: `rgba(30,58,78,0.4)`,
                  color: pal.accentBright, transition: "all 0.15s",
                  textTransform: "uppercase", opacity: isRolling ? 0.45 : 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >{getFreeRollLabel()}</button>
            </div>

            {/* ── Result stage ── */}
            {(isRolling || rollResults) && (
              <div style={{ marginBottom: 12 }}>
                {isRolling ? (
                  /* Spinning animation */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 90, padding: "8px 0" }}>
                    <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg
                        style={{ position: "absolute", top: 0, left: 0, width: 80, height: 80, animation: "dm-dr-spin-in 0.6s cubic-bezier(0.3,0,0.2,1) forwards", willChange: "transform" }}
                        viewBox="0 0 100 100"
                      >
                        <DieShape sides={selectedSides} stroke={pal.accent} fill={pal.accentDim} />
                      </svg>
                      <span style={{
                        position: "relative", zIndex: 2,
                        fontFamily: pal.fontDisplay, fontSize: 30, color: pal.gem, userSelect: "none",
                        animation: "dm-dr-num-cycle 0.08s ease-out",
                      }}>{cycleNum ?? "?"}</span>
                    </div>
                  </div>
                ) : rollResults && rollResults.length === 1 ? (
                  /* Single-roll result: full display like player roller */
                  <SingleRollResult result={rollResults[0]} pal={pal} />
                ) : rollResults && rollResults.length > 1 ? (
                  /* Multi-roll result: labeled rows */
                  <MultiRollResults
                    results={rollResults}
                    applyTarget={applyTarget}
                    onSelectTarget={setApplyTarget}
                    pal={pal}
                  />
                ) : null}

                {/* ── Apply-to row ── */}
                {isDmgRoll && selectedResult && (party.length > 0 || npcs.length > 0) && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${pal.border}` }}>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 6 }}>
                      Apply {selectedResult.total} to…
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {party.map(member => (
                        <button
                          key={member.slug}
                          onClick={() => onApplyDamage && onApplyDamage(member.slug, selectedResult.total)}
                          style={{
                            fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em",
                            padding: "4px 10px", borderRadius: 10, cursor: "pointer",
                            border: `1px solid ${pal.accent}`,
                            background: pal.accentDim,
                            color: pal.accentBright,
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(106,143,168,0.3)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = pal.accentDim; }}
                        >{member.name}</button>
                      ))}
                      {npcs.length > 0 && party.length > 0 && (
                        <span style={{ width: 1, background: "rgba(100,130,160,0.25)", margin: "0 3px", alignSelf: "stretch", display: "inline-block" }} />
                      )}
                      {npcs.map(npc => (
                        <button
                          key={npc.id}
                          onClick={() => onApplyNpcDamage && onApplyNpcDamage(npc.id, selectedResult.total)}
                          style={{
                            fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em",
                            padding: "4px 10px", borderRadius: 10, cursor: "pointer",
                            border: "1px solid rgba(122,112,96,0.5)",
                            background: "rgba(30,26,20,0.5)",
                            color: "#b0a080",
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(122,112,96,0.25)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(30,26,20,0.5)"; }}
                        >{npc.name}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <hr style={divider} />

            {/* ── History ── */}
            {history.length > 0 && (
              <>
                <div style={subLabel}>History</div>
                <div>
                  {history.map((entry, i) => {
                    const opacities = [1.0, 1.0, 0.45, 0.45, 0.22, 0.22, 0.1, 0.1, 0, 0];
                    const opacity = opacities[i] ?? 0;
                    if (opacity === 0) return null;

                    const totals = entry.results.map(r => r.total);
                    const summary = entry.repeatCount > 1
                      ? totals.join(", ")
                      : String(totals[0]);
                    const hasCrit = entry.results.some(r => r.isCrit);
                    const hasFumble = entry.results.some(r => r.isFumble);

                    return (
                      <div key={entry.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 0", borderBottom: i < history.length - 1 ? `1px solid ${pal.border}` : "none",
                        opacity, transition: "opacity 0.4s",
                      }}>
                        <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted, minWidth: 44 }}>
                          {entry.exprLabel}
                        </span>
                        {entry.repeatCount > 1 && (
                          <span style={{ fontFamily: pal.fontUI, fontSize: 9, color: pal.textMuted }}>×{entry.repeatCount}</span>
                        )}
                        <span style={{ flex: 1, fontFamily: pal.fontDisplay, fontSize: 13, color: pal.textBody, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {summary}
                        </span>
                        {hasCrit && (
                          <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 2, color: "#ffd060", border: "1px solid rgba(255,200,40,0.4)", background: "rgba(255,200,40,0.08)" }}>crit</span>
                        )}
                        {hasFumble && (
                          <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 2, color: "#c06060", border: "1px solid rgba(192,60,60,0.4)", background: "rgba(192,60,60,0.08)" }}>fumble</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SingleRollResult({ result, pal }) {
  const resultColor = result.isCrit ? "#ffd060" : result.isFumble ? "#c06060" : pal.gem;
  const landAnim = result.isCrit
    ? "dm-dr-land-crit 1.4s ease-out forwards"
    : result.isFumble
    ? "dm-dr-land-fumble 1.2s ease-out forwards"
    : "dm-dr-land-normal 1.2s ease-out forwards";
  const numAnim = result.isCrit
    ? "dm-dr-crit-pulse 0.7s ease-out"
    : result.isFumble
    ? "dm-dr-fumble-shake 0.5s ease-out"
    : "dm-dr-reveal-num 0.4s cubic-bezier(0.2,0,0.1,1) forwards";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "4px 0" }}>
      {result.isMultiGroup ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "center", flexWrap: "wrap" }}>
            {result.groups.map((g, gi) => (
              <div key={gi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.textMuted }}>{g.rolls.length}d{g.sides}</span>
                <div style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg style={{ position: "absolute", top: 0, left: 0, width: 56, height: 56, animation: "dm-dr-land-normal 1.2s ease-out forwards" }} viewBox="0 0 100 100">
                    <DieShape sides={g.sides} stroke={pal.accent} fill={pal.accentDim} />
                  </svg>
                  <span style={{ position: "relative", zIndex: 2, fontFamily: pal.fontDisplay, fontSize: 20, color: pal.gem, animation: "dm-dr-reveal-num 0.4s cubic-bezier(0.2,0,0.1,1) forwards" }}>
                    {g.rolls.reduce((s, r) => s + r, 0)}
                  </span>
                </div>
                <span style={{ fontFamily: pal.fontUI, fontSize: 9, color: pal.textMuted }}>[{g.rolls.join(",")}]</span>
              </div>
            ))}
            {result.flat !== 0 && (
              <div style={{ alignSelf: "center" }}>
                <span style={{ fontFamily: pal.fontDisplay, fontSize: 15, color: pal.textMuted }}>{result.flat > 0 ? `+${result.flat}` : result.flat}</span>
              </div>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%" }}>
            <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted }}>Total</span>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 36, color: pal.gem, animation: "dm-dr-reveal-num 0.4s 0.2s both" }}>{result.total}</span>
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg style={{ position: "absolute", top: 0, left: 0, width: 80, height: 80, willChange: "filter", animation: landAnim }} viewBox="0 0 100 100">
            <DieShape sides={result.groups[0]?.sides || 20} stroke={pal.accent} fill={pal.accentDim} />
          </svg>
          <span style={{ position: "relative", zIndex: 2, fontFamily: pal.fontDisplay, fontSize: 32, color: resultColor, userSelect: "none", animation: numAnim }}>
            {result.total}
          </span>
        </div>
      )}

      {result.isCrit && <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", color: "#ffd060" }}>✦ Critical Hit ✦</div>}
      {result.isFumble && <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", color: "#c06060" }}>✕ Fumble ✕</div>}

      {/* Adv/dis breakdown chips */}
      {!result.isMultiGroup && result.advKept !== null && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.accentBright, background: "rgba(18,32,48,0.7)", border: `1px solid ${pal.accent}`, borderRadius: 2, padding: "2px 7px" }}>{result.advKept}</span>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textBody, background: "rgba(18,32,48,0.7)", border: `1px solid ${pal.border}`, borderRadius: 2, padding: "2px 7px", textDecoration: "line-through", opacity: 0.38 }}>{result.advDiscarded}</span>
        </div>
      )}
    </div>
  );
}

function MultiRollResults({ results, applyTarget, onSelectTarget, pal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {results.map((result, i) => {
        const isSelected = i === applyTarget;
        const critColor = result.isCrit ? "#ffd060" : result.isFumble ? "#c06060" : pal.gem;
        return (
          <div
            key={i}
            onClick={() => onSelectTarget(i)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 3, cursor: "pointer",
              border: `1px solid ${isSelected ? pal.accent : pal.border}`,
              background: isSelected ? pal.accentDim : "transparent",
              transition: "all 0.12s",
              animation: `dm-dr-row-reveal 0.25s ${i * 0.08}s both`,
            }}
          >
            <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted, minWidth: 42 }}>
              Roll {i + 1}
            </span>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: critColor, flex: 1 }}>
              {result.total}
            </span>
            {result.isCrit && (
              <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 2, color: "#ffd060", border: "1px solid rgba(255,200,40,0.4)", background: "rgba(255,200,40,0.08)" }}>✦ CRIT</span>
            )}
            {result.isFumble && (
              <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 2, color: "#c06060", border: "1px solid rgba(192,60,60,0.4)", background: "rgba(192,60,60,0.08)" }}>✕ FUMBLE</span>
            )}
            {result.groups.length === 1 && result.groups[0].rolls.length > 0 && (
              <span style={{ fontFamily: pal.fontUI, fontSize: 9, color: pal.textMuted, fontStyle: "italic" }}>
                [{result.groups[0].rolls.join(",")}
                {result.flat !== 0 ? (result.flat > 0 ? `+${result.flat}` : result.flat) : ""}]
              </span>
            )}
            {isSelected && (
              <span style={{ fontFamily: pal.fontUI, fontSize: 9, color: pal.accentBright }}>◀</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
