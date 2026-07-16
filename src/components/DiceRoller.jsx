import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { postCharacterRoll } from "../api";
import RollHistoryList from "./RollHistoryList";
import { buildCharacterRollPayload, buildDiceExprLabel, buildLocalRollHistoryEntry } from "../lib/rollHistory";
import { PALETTES } from "../features/characterSheet/theme";
import "./diceRoller.css";

// ── Pure utility functions ─────────────────────────────────────────────────────

/**
 * Parses a dice expression string like "1d8+2d6+3" into groups and flat modifier.
 * Returns { groups: [{count, sides}], flat } or null on failure.
 */
export const parseDiceExpr = (str) => {
  const raw = str.replace(/\s+/g, "").toLowerCase();
  if (!raw) return null;

  const groups = [];
  let flat = 0;

  const regex = /([+-]?\d*)d(\d+)|([+-]?\d+)/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    if (match[2] !== undefined) {
      const countStr = match[1];
      const count = countStr === "" || countStr === "+" ? 1 : countStr === "-" ? -1 : parseInt(countStr, 10);
      const sides = parseInt(match[2], 10);
      if (isNaN(count) || isNaN(sides) || sides < 2) continue;
      const absCount = Math.abs(count);
      if (absCount < 1 || absCount > 30) continue;
      const existing = groups.find(g => g.sides === sides);
      if (existing) existing.count = Math.min(existing.count + absCount, 30);
      else groups.push({ count: absCount, sides });
    } else if (match[3] !== undefined) {
      flat += parseInt(match[3], 10);
    }
  }

  if (groups.length === 0 && flat === 0) return null;
  return { groups, flat };
};

export const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;

const getAttackBonus = (weapon) => {
  const mod = (weapon.mods || []).find(m => m.attribute === "Attack Bonus");
  if (!mod) return null;
  const parsed = parseInt(String(mod.value).trim(), 10);
  return isNaN(parsed) ? null : parsed;
};

const getDamage = (weapon) => {
  const mod = (weapon.mods || []).find(m => m.attribute === "Damage");
  return mod ? mod.value : null;
};

const getAbilityMod = (stat) => {
  const base = Math.floor((stat.score - 10) / 2);
  const itemBonus = (stat.mods || []).reduce((sum, m) => sum + (parseInt(m.value) || 0), 0);
  return base + itemBonus;
};

const fmtMod = (m) => m >= 0 ? `+${m}` : `${m}`;

// ── Die SVG shapes ─────────────────────────────────────────────────────────────
// Each shape is a function(stroke, fill, key) → JSX element
export function DieShape({ sides, stroke, fill }) {
  switch (sides) {
    case 4:   return <polygon points="50,5 95,90 5,90" stroke={stroke} strokeWidth={2} fill={fill} />;
    case 6:   return <rect x="10" y="10" width="80" height="80" rx="8" stroke={stroke} strokeWidth={2} fill={fill} />;
    case 8:   return <polygon points="50,5 95,50 50,95 5,50" stroke={stroke} strokeWidth={2} fill={fill} />;
    case 10:  return <polygon points="50,5 95,38 78,95 22,95 5,38" stroke={stroke} strokeWidth={2} fill={fill} />;
    case 12:  return <polygon points="50,5 93,25 95,72 70,95 30,95 5,72 7,25" stroke={stroke} strokeWidth={2} fill={fill} />;
    case 100: return <circle cx="50" cy="50" r="44" stroke={stroke} strokeWidth={2} fill={fill} />;
    default:  return <polygon points="50,5 95,30 95,70 50,95 5,70 5,30" stroke={stroke} strokeWidth={2} fill={fill} />; // d20
  }
}

const ALL_SIDES = [4, 6, 8, 10, 12, 20, 100];
const STAT_NAMES = ["Strength", "Dexterity", "Constitution", "Wisdom", "Intelligence", "Charisma"];
const STAT_SHORT = { Strength: "STR", Dexterity: "DEX", Constitution: "CON", Wisdom: "WIS", Intelligence: "INT", Charisma: "CHA" };

// ── DiceRoller component ───────────────────────────────────────────────────────
const DiceRoller = forwardRef(function DiceRoller({ weapons = [], stats = [], pal, slug }, ref) {
  const [isOpen, setIsOpen] = useState(() => {
    if (!slug) return true;
    return sessionStorage.getItem(`dnd_dice_open_${slug}`) !== "false";
  });

  const [advMode, setAdvMode] = useState("normal");

  const [rollState, setRollState] = useState({ rolling: false, result: null });

  const [history, setHistory] = useState([]);

  // Free picker
  const [selectedSides, setSelectedSides] = useState(20);
  const [dieCount, setDieCount] = useState(1);
  const [comboDice, setComboDice] = useState([]);
  const [comboMod, setComboMod] = useState(0);
  const [exprInput, setExprInput] = useState("");
  const [exprError, setExprError] = useState("");

  // Cycling number during animation
  const [cycleNum, setCycleNum] = useState(null);
  const cycleRef = useRef(null);

  useEffect(() => () => { if (cycleRef.current) clearInterval(cycleRef.current); }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      if (slug) sessionStorage.setItem(`dnd_dice_open_${slug}`, String(next));
      return next;
    });
  }, [slug]);

  const ensureOpen = useCallback(() => {
    setIsOpen(prev => {
      if (!prev && slug) sessionStorage.setItem(`dnd_dice_open_${slug}`, "true");
      return true;
    });
  }, [slug]);

  // ── Core roll executor ───────────────────────────────────────────────────────
  const executeRoll = useCallback(({ groups, flat, label, isD20Attack = false }) => {
    if (rollState.rolling) return;

    ensureOpen();
    setExprError("");

    const rolledGroups = groups.map(({ count, sides }) => ({
      sides,
      rolls: Array.from({ length: count }, () => rollDie(sides)),
    }));

    const isSingleD20 = groups.length === 1 && groups[0].sides === 20 && groups[0].count === 1;
    let advKept = null, advDiscarded = null;
    if (isD20Attack && isSingleD20 && advMode !== "normal") {
      const r2 = rollDie(20);
      const r1 = rolledGroups[0].rolls[0];
      if (advMode === "advantage") {
        advKept = Math.max(r1, r2); advDiscarded = Math.min(r1, r2);
      } else {
        advKept = Math.min(r1, r2); advDiscarded = Math.max(r1, r2);
      }
      rolledGroups[0].rolls[0] = advKept;
    }

    // 2d6 ability check adv/dis: roll a third d6, keep top 2 (adv) or bottom 2 (dis)
    const isAbility2d6 = groups.length === 1 && groups[0].sides === 6 && groups[0].count === 2;
    let keptRolls = null, droppedRoll = null;
    if (isAbility2d6 && advMode !== "normal") {
      const r3 = rollDie(6);
      const all3 = [...rolledGroups[0].rolls, r3].sort((a, b) => a - b);
      if (advMode === "advantage") {
        // keep top 2
        keptRolls = [all3[1], all3[2]];
        droppedRoll = all3[0];
      } else {
        // keep bottom 2
        keptRolls = [all3[0], all3[1]];
        droppedRoll = all3[2];
      }
      rolledGroups[0].rolls = keptRolls;
    }

    const diceTotal = rolledGroups.reduce((sum, g) => sum + g.rolls.reduce((s, r) => s + r, 0), 0);
    const total = diceTotal + flat;
    const rawRoll = isSingleD20 ? rolledGroups[0].rolls[0] : null;
    const isCrit = isD20Attack && rawRoll === 20;
    const isFumble = isD20Attack && rawRoll === 1;
    const isMultiGroup = rolledGroups.length > 1;

    setRollState({ rolling: true, result: null });
    setCycleNum(rollDie(groups[0]?.sides || 20));

    if (cycleRef.current) clearInterval(cycleRef.current);
    cycleRef.current = setInterval(() => {
      setCycleNum(rollDie(groups[0]?.sides || 20));
    }, 90);

    const resolveTime = isMultiGroup ? 1050 + (groups.length - 1) * 280 + 300 : 1050;

    setTimeout(() => {
      if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
      setCycleNum(null);

      const resultObj = {
        groups: rolledGroups, flat, total, isCrit, isFumble,
        label, advKept, advDiscarded, isMultiGroup,
        keptRolls, droppedRoll,
      };
      resultObj.exprLabel = buildDiceExprLabel(groups, flat);

      setRollState({ rolling: false, result: resultObj });

      const modeTag = advMode !== "normal" && (isD20Attack || isAbility2d6)
        ? (advMode === "advantage" ? " (adv)" : " (dis)") : "";

      setHistory(prev => [
        buildLocalRollHistoryEntry({
          id: Date.now(),
          label: label + modeTag,
          result: resultObj,
        }),
        ...prev,
      ].slice(0, 5));

      if (slug) {
        postCharacterRoll(slug, buildCharacterRollPayload({
          label: label + modeTag,
          result: resultObj,
        })).catch(() => {});
      }
    }, resolveTime);
  }, [rollState.rolling, advMode, ensureOpen]);

  // ── Roll handlers ────────────────────────────────────────────────────────────
  const rollWeaponAtk = (weapon) => {
    const bonus = getAttackBonus(weapon);
    executeRoll({ groups: [{ count: 1, sides: 20 }], flat: bonus !== null ? bonus : 0, label: `${weapon.name} ATK`, isD20Attack: true });
  };

  const rollWeaponDmg = (weapon) => {
    const dmgStr = getDamage(weapon);
    if (!dmgStr) return;
    const parsed = parseDiceExpr(dmgStr);
    if (!parsed || parsed.groups.length === 0) return;
    executeRoll({ groups: parsed.groups, flat: parsed.flat, label: `${weapon.name} DMG`, isD20Attack: false });
  };

  const rollAbility = useCallback((statOrName) => {
    const stat = typeof statOrName === "string"
      ? (stats || []).find(s => s.name === statOrName) || { name: statOrName, score: 10, mods: [] }
      : statOrName;
    const mod = getAbilityMod(stat);
    executeRoll({ groups: [{ count: 2, sides: 6 }], flat: mod, label: `${stat.name} Check`, isD20Attack: false });
  }, [stats, executeRoll]);

  useImperativeHandle(ref, () => ({ rollAbility }), [rollAbility]);

  const rollFree = () => {
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
    executeRoll({ groups, flat, label: "Free Roll", isD20Attack: false });
  };

  const rollExpr = () => {
    if (!exprInput.trim()) { setExprError("Enter an expression first, e.g. 2d6+1d4+3"); return; }
    const parsed = parseDiceExpr(exprInput.trim());
    if (!parsed || parsed.groups.length === 0) {
      setExprError("Could not parse — use NdX or N terms, e.g. 2d6+1d4+3"); return;
    }
    setExprError("");
    executeRoll({ groups: parsed.groups, flat: parsed.flat, label: "Free Roll", isD20Attack: false });
  };

  // ── Combo builder ────────────────────────────────────────────────────────────
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
    if (exprInput.trim()) return `Roll: ${exprInput.trim()}`;
    if (comboDice.length > 0) {
      const parts = comboDice.map(g => `${g.count}d${g.sides}`);
      if (comboMod !== 0) parts.push(comboMod > 0 ? `+${comboMod}` : `${comboMod}`);
      return `Roll ${parts.join(" + ")}`;
    }
    const suffix = comboMod !== 0 ? (comboMod > 0 ? `+${comboMod}` : comboMod) : "";
    return `Roll ${dieCount}d${selectedSides}${suffix}`;
  };

  const rollerWeapons = weapons.filter(w => getAttackBonus(w) !== null || getDamage(w) !== null);

  const { result, rolling } = rollState;
  // Dynamic: crit/fumble colors change per roll result
  const resultColor = result?.isCrit ? "#ffd060" : result?.isFumble ? "#c06060" : pal.gem;
  const resultNumAnim = result?.isCrit
    ? "dr-crit-pulse 0.7s ease-out"
    : result?.isFumble
    ? "dr-fumble-shake 0.5s ease-out"
    : "dr-reveal-num 0.4s cubic-bezier(0.2,0,0.1,1) forwards";

  // Dynamic: vellum palette gets a different roll button background
  const primaryRollBg = pal === PALETTES.vellum ? pal.accentDim : "rgba(18,58,78,0.4)";

  return (
    <div
      className="dice-roller-panel"
      style={{
        "--pal-surface":       pal.surface,
        "--pal-surface-solid": pal.surfaceSolid,
        "--pal-border":        pal.border,
        "--pal-accent":        pal.accent,
        "--pal-accent-bright": pal.accentBright,
        "--pal-accent-dim":    pal.accentDim,
        "--pal-text":          pal.text,
        "--pal-text-body":     pal.textBody,
        "--pal-text-muted":    pal.textMuted,
        "--pal-gem":           pal.gem,
        "--pal-gem-low":       pal.gemLow,
      }}
    >
      {/* Header */}
      <div
        onClick={toggleOpen}
        className="flex-row-spread"
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        <span className="label-ui" style={{ marginBottom: 0 }}>Dice</span>
        <span className={`dice-chevron${isOpen ? " open" : ""}`}>▼</span>
      </div>

      {isOpen && (
        <div style={{ marginTop: 14 }}>

          {/* Advantage strip */}
          <div className="flex-row" style={{ gap: 6, marginBottom: 2 }}>
            <span className="label-ui-sm" style={{ marginBottom: 0, marginRight: 4 }}>Roll mode</span>
            {["normal", "advantage", "disadvantage"].map(mode => {
              const isActive = advMode === mode;
              // Dynamic: three distinct color sets for the active state
              const activeColors = mode === "advantage"
                ? { border: "#5a9a60", bg: "rgba(60,130,60,0.18)", color: "#88c888" }
                : mode === "disadvantage"
                ? { border: "#9a5a5a", bg: "rgba(130,60,60,0.18)", color: "#c88888" }
                : { border: pal.accent, bg: pal.accentDim, color: pal.accentBright };
              const label = mode === "normal" ? "Normal" : mode === "advantage" ? "Advantage" : "Disadv.";
              return (
                <button
                  key={mode}
                  onClick={() => setAdvMode(mode)}
                  className="dice-mode-btn"
                  style={isActive ? {
                    border: `1px solid ${activeColors.border}`,
                    background: activeColors.bg,
                    color: activeColors.color,
                  } : undefined}
                >{label}</button>
              );
            })}
          </div>

          <hr className="divider" style={{ margin: "14px 0" }} />

          {/* Weapons */}
          <div className="dice-sub-label">Weapons</div>
          {rollerWeapons.length > 0 ? (
            rollerWeapons.map((w, wi) => {
              const atk = getAttackBonus(w);
              const dmg = getDamage(w);
              return (
                <div key={w.id || wi} className="flex-row" style={{
                  gap: 8, paddingBottom: 8,
                  borderBottom: wi < rollerWeapons.length - 1 ? `1px solid ${pal.border}` : "none",
                  marginBottom: 8,
                }}>
                  <span style={{ flex: 1, fontFamily: pal.fontBody, fontSize: 16, color: pal.text }}>{w.name}</span>
                  {atk !== null && (
                    <button
                      disabled={rolling}
                      onClick={() => rollWeaponAtk(w)}
                      className="dice-weapon-btn"
                      style={{
                        border: `1px solid ${pal.accent}`,
                        background: pal.accentDim,
                        color: pal.accentBright,
                      }}
                    >
                      ATK {fmtMod(atk)}
                    </button>
                  )}
                  {dmg && (
                    <button
                      disabled={rolling}
                      onClick={() => rollWeaponDmg(w)}
                      className="dice-weapon-btn"
                      style={{
                        border: `1px solid ${pal.border}`,
                        background: "transparent",
                        color: pal.textMuted,
                      }}
                    >
                      DMG {dmg}
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, fontStyle: "italic", color: pal.textMuted, marginBottom: 12 }}>
              No weapons configured — add them in Inventory.
            </div>
          )}

          <hr className="divider" style={{ margin: "14px 0" }} />

          {/* Ability checks */}
          <div className="dice-sub-label">Ability Checks</div>
          <div className="flex-row" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
            {STAT_NAMES.map(name => {
              const stat = (stats || []).find(s => s.name === name) || { name, score: 10, mods: [] };
              const mod = getAbilityMod(stat);
              const short = STAT_SHORT[name];
              const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
              const isNeg = mod < 0;
              return (
                <div
                  key={name}
                  title={`Roll ${short} check`}
                  onClick={() => !rolling && rollAbility(stat)}
                  className="flex-col"
                  style={{ alignItems: "center", gap: 4, cursor: rolling ? "not-allowed" : "pointer", opacity: rolling ? 0.5 : 1 }}
                >
                  <div className="flex-col" style={{
                    width: 56, height: 56, borderRadius: "50%",
                    border: `2px solid ${pal.border}`, background: pal.surface,
                    alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}>
                    <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: pal.gem, lineHeight: 1 }}>{stat.score}</span>
                    <div className="flex-row" style={{
                      position: "absolute", bottom: -7, left: -7,
                      width: 22, height: 22, borderRadius: "50%",
                      background: pal.gemLow,
                      border: `2px solid ${pal.surfaceSolid || pal.surface}`,
                      justifyContent: "center",
                      fontFamily: pal.fontDisplay, fontSize: 9,
                      color: isNeg ? "#c06060" : pal.gem,
                    }}>{modStr}</div>
                  </div>
                  <span className="label-ui-sm" style={{ marginBottom: 0 }}>{short}</span>
                </div>
              );
            })}
          </div>

          <hr className="divider" style={{ margin: "14px 0" }} />

          {/* Result stage */}
          {(rolling || result) && (
            <div className="dice-result-stage">
              {rolling ? (
                <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg
                    style={{ position: "absolute", top: 0, left: 0, width: 100, height: 100, animation: "dr-spin-in 1.0s cubic-bezier(0.3,0,0.2,1) forwards", willChange: "transform" }}
                    viewBox="0 0 100 100"
                  >
                    <DieShape sides={selectedSides} stroke={pal.accent} fill={pal.accentDim} />
                  </svg>
                  <span style={{
                    position: "relative", zIndex: 2,
                    fontFamily: pal.fontDisplay, fontSize: 36, color: pal.gem, userSelect: "none",
                    animation: "dr-num-cycle 0.08s ease-out",
                  }}>{cycleNum ?? "?"}</span>
                </div>
              ) : result ? (
                <div className="flex-col" style={{ alignItems: "center", gap: 6, width: "100%" }}>
                  {result.isMultiGroup ? (
                    /* Multi-group: dice row on top, total below */
                    <div className="flex-col" style={{ alignItems: "center", gap: 10, width: "100%" }}>
                      {/* Dice shapes row */}
                      <div className="flex-row" style={{ gap: 10, alignItems: "flex-end", justifyContent: "center", flexWrap: "wrap" }}>
                        {result.groups.map((g, gi) => (
                          <div key={gi} className="flex-col" style={{ alignItems: "center", gap: 4, animation: `dr-group-reveal 0.38s cubic-bezier(0.2,0,0.1,1) ${gi * 0.2}s both` }}>
                            <span className="label-ui-sm" style={{ marginBottom: 0 }}>{g.rolls.length}d{g.sides}</span>
                            <div style={{ position: "relative", width: 70, height: 70, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg style={{ position: "absolute", top: 0, left: 0, width: 70, height: 70, animation: "dr-land-normal 1.2s ease-out forwards", willChange: "filter" }} viewBox="0 0 100 100">
                                <DieShape sides={g.sides} stroke={pal.accent} fill={pal.accentDim} />
                              </svg>
                              <span style={{ position: "relative", zIndex: 2, fontFamily: pal.fontDisplay, fontSize: 24, color: pal.gem, userSelect: "none", animation: "dr-reveal-num 0.4s cubic-bezier(0.2,0,0.1,1) forwards" }}>
                                {g.rolls.reduce((s, r) => s + r, 0)}
                              </span>
                            </div>
                            <span style={{ fontFamily: pal.fontUI, fontSize: 9, color: pal.textMuted }}>[{g.rolls.join(", ")}]</span>
                          </div>
                        ))}
                        {result.flat !== 0 && (
                          <div style={{ alignSelf: "center" }}>
                            <span style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: pal.textMuted }}>{result.flat > 0 ? `+${result.flat}` : result.flat}</span>
                          </div>
                        )}
                      </div>
                      {/* Total below the dice */}
                      <div className="flex-col" style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 10, alignItems: "center", gap: 2, width: "100%" }}>
                        <span className="label-ui-sm" style={{ marginBottom: 0 }}>Total</span>
                        <span style={{ fontFamily: pal.fontDisplay, fontSize: 40, color: pal.gem, animation: "dr-reveal-num 0.4s 0.3s both" }}>{result.total}</span>
                      </div>
                    </div>
                  ) : (
                    /* Single die */
                    <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg
                        style={{
                          position: "absolute", top: 0, left: 0, width: 100, height: 100, willChange: "filter",
                          animation: result.isCrit ? "dr-land-crit 1.4s ease-out forwards" : result.isFumble ? "dr-land-fumble 1.2s ease-out forwards" : "dr-land-normal 1.2s ease-out forwards",
                        }}
                        viewBox="0 0 100 100"
                      >
                        <DieShape sides={result.groups[0]?.sides || 20} stroke={pal.accent} fill={pal.accentDim} />
                      </svg>
                      <span style={{
                        position: "relative", zIndex: 2, fontFamily: pal.fontDisplay, fontSize: 38,
                        color: resultColor, userSelect: "none", willChange: "transform",
                        animation: resultNumAnim,
                      }}>{result.total}</span>
                    </div>
                  )}

                  {/* Crit / fumble / label */}
                  {result.isCrit && (
                    <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#ffd060", marginTop: 4 }}>
                      ✦ CRITICAL HIT ✦
                    </div>
                  )}
                  {result.isFumble && (
                    <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c06060", marginTop: 4 }}>
                      ✕ FUMBLE ✕
                    </div>
                  )}
                  {!result.isCrit && !result.isFumble && result.label && (
                    <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginTop: 2 }}>
                      {result.label}
                    </div>
                  )}

                  {/* Breakdown chips */}
                  {!result.isMultiGroup && (() => {
                    const g = result.groups[0];
                    const hasAdv = result.advKept !== null && result.advDiscarded !== null;
                    const has2d6Adv = result.droppedRoll != null && Array.isArray(result.keptRolls);
                    const hasFlat = result.flat !== 0;
                    const hasMultiRolls = g?.rolls?.length > 1;
                    if (!hasAdv && !has2d6Adv && !hasFlat && !hasMultiRolls) return null;

                    const chipStyle = (variant) => ({
                      fontFamily: pal.fontDisplay, fontSize: 13,
                      color: variant === "used" ? pal.accentBright : pal.textBody,
                      background: "rgba(30,18,12,0.7)",
                      border: `1px solid ${variant === "used" ? pal.accent : pal.border}`,
                      borderRadius: 2, padding: "2px 8px",
                      textDecoration: variant === "discarded" ? "line-through" : "none",
                      opacity: variant === "discarded" ? 0.38 : 1,
                    });
                    const sep = (key) => <span key={key} style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.textMuted }}>+</span>;

                    const chips = [];
                    if (hasAdv) {
                      chips.push(<span key="kept" style={chipStyle("used")} title="kept">{result.advKept}</span>);
                      chips.push(<span key="disc" style={{ ...chipStyle("discarded"), textDecoration: "line-through", opacity: 0.38 }} title="discarded">{result.advDiscarded}</span>);
                    } else if (has2d6Adv) {
                      result.keptRolls.forEach((r, i) => {
                        chips.push(<span key={`k${i}`} style={chipStyle("used")} title="kept">{r}</span>);
                        if (i < result.keptRolls.length - 1) chips.push(sep(`ks${i}`));
                      });
                      chips.push(sep("ds"));
                      chips.push(<span key="dropped" style={chipStyle("discarded")} title="dropped">{result.droppedRoll}</span>);
                    } else if (hasMultiRolls) {
                      g.rolls.forEach((r, i) => {
                        chips.push(<span key={`r${i}`} style={chipStyle("normal")}>{r}</span>);
                        if (i < g.rolls.length - 1) chips.push(sep(`p${i}`));
                      });
                    }
                    if (hasFlat) {
                      if (chips.length) chips.push(sep("flsep"));
                      chips.push(<span key="flat" style={chipStyle("normal")}>{result.flat > 0 ? `+${result.flat}` : result.flat}</span>);
                    }
                    if (chips.length) {
                      chips.push(<span key="eq" style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.textMuted }}>=</span>);
                      chips.push(
                        <span key="total" style={{ ...chipStyle("used"), fontSize: 15, padding: "3px 12px", background: pal.accentDim, borderColor: pal.accentBright }}>
                          {result.total}
                        </span>
                      );
                    }

                    return (
                      <div className="dice-chips-row">
                        {chips}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          )}

          <hr className="divider" style={{ margin: "14px 0" }} />

          {/* Free picker */}
          <div className="dice-sub-label">Free Roll</div>

          {/* Die buttons */}
          <div className="flex-row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
            {ALL_SIDES.map(sides => {
              const isSelected = selectedSides === sides;
              return (
                <button
                  key={sides}
                  onClick={() => handleDieSelect(sides)}
                  onDoubleClick={() => handleDieDblClick(sides)}
                  title={`d${sides} — double-click to add to combo`}
                  className={`dice-die-btn${isSelected ? " selected" : ""}`}
                >
                  <svg width="44" height="44" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color: isSelected ? pal.accentBright : pal.accent, letterSpacing: "0.05em" }}>{sides}</span>
                </button>
              );
            })}
          </div>

          {/* Count stepper */}
          <div className="flex-row" style={{ justifyContent: "center", gap: 12, marginBottom: 12 }}>
            <span className="label-ui-sm" style={{ marginBottom: 0 }}>Count</span>
            <button onClick={() => setDieCount(c => Math.max(1, c - 1))} className="dice-circle-btn">−</button>
            <span style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.gem, minWidth: 24, textAlign: "center" }}>{dieCount}</span>
            <button onClick={() => setDieCount(c => Math.min(10, c + 1))} className="dice-circle-btn">+</button>
          </div>

          {/* Pending combo display */}
          {comboDice.length > 0 && (
            <div className="flex-row" style={{ justifyContent: "center", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
              <span className="label-ui-sm" style={{ marginBottom: 0, marginRight: 4 }}>Roll</span>
              {comboDice.map((g, i) => (
                <span key={i} className="flex-row" style={{ gap: 4 }}>
                  <span className="dice-combo-chip">{g.count}d{g.sides}</span>
                  {i < comboDice.length - 1 && <span className="dice-combo-sep">+</span>}
                </span>
              ))}
              {comboMod !== 0 && (
                <span className="dice-combo-chip">
                  {comboMod > 0 ? `+${comboMod}` : comboMod}
                </span>
              )}
            </div>
          )}

          {/* Add die / clear */}
          <div className="flex-row" style={{ gap: 8, justifyContent: "center", marginBottom: 10 }}>
            <button
              onClick={addDieToCombo}
              className="btn-primary"
              style={{ fontSize: 12, padding: "4px 12px" }}
            >+ Add Die</button>
            {comboDice.length > 0 && (
              <button
                onClick={clearCombo}
                className="btn-ghost"
                style={{ fontSize: 12, padding: "4px 12px" }}
              >✕ Clear</button>
            )}
          </div>

          {/* Flat modifier */}
          <div className="flex-row" style={{ justifyContent: "center", gap: 8, marginBottom: 10 }}>
            <span className="label-ui-sm" style={{ marginBottom: 0 }}>+ Modifier</span>
            <input
              type="number"
              value={comboMod}
              min={-99} max={99}
              onChange={e => setComboMod(parseInt(e.target.value, 10) || 0)}
              className="dice-mod-input"
              style={{ width: 72, fontSize: 18, padding: "2px 6px" }}
            />
          </div>

          {/* Big roll button */}
          <button
            disabled={rolling}
            onClick={rollFree}
            className="dice-roll-btn"
            style={{ background: primaryRollBg }}
          >{getFreeRollLabel()}</button>

          {/* Expression input */}
          <div className="dice-sub-label">Expression Roll</div>
          <div className="flex-row" style={{ gap: 8, alignItems: "stretch", marginBottom: 4 }}>
            <input
              type="text"
              value={exprInput}
              onChange={e => { setExprInput(e.target.value); setExprError(""); }}
              onKeyDown={e => { if (e.key === "Enter") rollExpr(); }}
              placeholder="or type: 2d6+1d4+3"
              autoComplete="off"
              spellCheck={false}
              className="dice-expr-input"
            />
            <button
              disabled={rolling}
              onClick={rollExpr}
              className="btn-primary"
              style={{ fontSize: 11, padding: "7px 14px", whiteSpace: "nowrap" }}
            >Roll</button>
          </div>
          {exprError && (
            <div className="dice-expr-error">{exprError}</div>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <hr className="divider" style={{ margin: "14px 0" }} />
              <RollHistoryList
                pal={pal}
                title="Recent Rolls"
                entries={history}
                opacities={[1.0, 0.45, 0.22, 0, 0]}
              />
            </>
          )}

        </div>
      )}
    </div>
  );
});

export default DiceRoller;
