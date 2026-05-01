import { useState, useEffect, useRef, useCallback } from "react";

// ── Dice roller CSS keyframes ──────────────────────────────────────────────────
const DICE_CSS = `
@keyframes dr-spin-in {
  0%   { transform: rotate(0deg) scale(0.6); opacity: 0.4; }
  60%  { transform: rotate(380deg) scale(1.08); opacity: 1; }
  80%  { transform: rotate(355deg) scale(0.97); }
  100% { transform: rotate(360deg) scale(1); opacity: 1; }
}
@keyframes dr-land-normal {
  0%   { filter: drop-shadow(0 0 0px rgba(200,144,76,0)); }
  40%  { filter: drop-shadow(0 0 18px rgba(200,144,76,0.7)); }
  100% { filter: drop-shadow(0 0 6px rgba(200,144,76,0.2)); }
}
@keyframes dr-land-crit {
  0%   { filter: drop-shadow(0 0 0px rgba(255,200,40,0)); }
  35%  { filter: drop-shadow(0 0 28px rgba(255,200,40,0.9)); }
  100% { filter: drop-shadow(0 0 10px rgba(255,200,40,0.4)); }
}
@keyframes dr-land-fumble {
  0%   { filter: drop-shadow(0 0 0px rgba(192,60,60,0)); }
  35%  { filter: drop-shadow(0 0 28px rgba(192,60,60,0.9)); }
  100% { filter: drop-shadow(0 0 10px rgba(192,60,60,0.3)); }
}
@keyframes dr-num-cycle {
  0%   { opacity: 0.5; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes dr-reveal-num {
  0%   { transform: scale(0.5) translateY(8px); opacity: 0; }
  70%  { transform: scale(1.15) translateY(-2px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes dr-crit-pulse {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.35); }
  60%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
@keyframes dr-fumble-shake {
  0%   { transform: translateX(0); }
  20%  { transform: translateX(-6px) rotate(-3deg); }
  40%  { transform: translateX(6px) rotate(3deg); }
  60%  { transform: translateX(-4px) rotate(-2deg); }
  80%  { transform: translateX(4px) rotate(2deg); }
  100% { transform: translateX(0); }
}
@keyframes dr-group-reveal {
  0%   { opacity: 0; transform: scale(0.7) translateY(6px); }
  70%  { opacity: 1; transform: scale(1.08) translateY(-1px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
`;

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
export default function DiceRoller({ weapons = [], stats = [], pal, slug }) {
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
      };

      setRollState({ rolling: false, result: resultObj });

      const exprLabel = groups.map(g => `${g.count}d${g.sides}`).join("+") +
        (flat ? (flat > 0 ? `+${flat}` : `${flat}`) : "");
      const modeTag = isD20Attack && advMode !== "normal"
        ? (advMode === "advantage" ? " (adv)" : " (dis)") : "";

      setHistory(prev => [
        { id: Date.now(), dieExpr: exprLabel, label: label + modeTag, total, isCrit, isFumble },
        ...prev,
      ].slice(0, 5));
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

  const rollAbility = (stat) => {
    const mod = getAbilityMod(stat);
    const short = STAT_SHORT[stat.name] || stat.name.slice(0, 3).toUpperCase();
    executeRoll({ groups: [{ count: 1, sides: 20 }], flat: mod, label: `${short} check`, isD20Attack: true });
  };

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
    executeRoll({ groups, flat, label: "Free roll", isD20Attack: false });
  };

  const rollExpr = () => {
    if (!exprInput.trim()) { setExprError("Enter an expression first, e.g. 2d6+1d4+3"); return; }
    const parsed = parseDiceExpr(exprInput.trim());
    if (!parsed || parsed.groups.length === 0) {
      setExprError("Could not parse — use NdX or N terms, e.g. 2d6+1d4+3"); return;
    }
    setExprError("");
    executeRoll({ groups: parsed.groups, flat: parsed.flat, label: `Expr: ${exprInput.trim()}`, isD20Attack: false });
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
  const resultColor = result?.isCrit ? "#ffd060" : result?.isFumble ? "#c06060" : pal.gem;
  const resultNumAnim = result?.isCrit
    ? "dr-crit-pulse 0.7s ease-out"
    : result?.isFumble
    ? "dr-fumble-shake 0.5s ease-out"
    : "dr-reveal-num 0.4s cubic-bezier(0.2,0,0.1,1) forwards";

  // ── Shared micro-styles ───────────────────────────────────────────────────────
  const subLabel = {
    fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em",
    textTransform: "uppercase", color: pal.textMuted, marginBottom: 10,
  };
  const divider = { border: "none", borderTop: `1px solid ${pal.border}`, margin: "14px 0" };
  const rollBtnStyle = (variant) => ({
    fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.10em",
    padding: "4px 10px", borderRadius: 3, cursor: rolling ? "not-allowed" : "pointer",
    opacity: rolling ? 0.45 : 1, transition: "all 0.15s", whiteSpace: "nowrap",
    border: variant === "atk" ? `1px solid ${pal.accent}` : `1px solid ${pal.border}`,
    background: variant === "atk" ? pal.accentDim : "transparent",
    color: variant === "atk" ? pal.accentBright : pal.textMuted,
  });

  return (
    <>
      <style>{DICE_CSS}</style>
      <div style={{
        background: pal.surface, border: `1px solid ${pal.border}`,
        borderRadius: 4, padding: "16px 18px", marginTop: 16,
      }}>
        {/* Header */}
        <div
          onClick={toggleOpen}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
        >
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: pal.textMuted }}>
            Dice
          </div>
          <span style={{
            fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted,
            transition: "transform 0.2s", display: "inline-block",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}>▼</span>
        </div>

        {isOpen && (
          <div style={{ marginTop: 14 }}>

            {/* Advantage strip */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
              <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, marginRight: 4 }}>d20 mode</span>
              {["normal", "advantage", "disadvantage"].map(mode => {
                const isActive = advMode === mode;
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
                    style={{
                      fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.12em",
                      padding: "3px 10px", borderRadius: 3, cursor: "pointer",
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

            {/* Weapons */}
            <div style={subLabel}>Weapons</div>
            {rollerWeapons.length > 0 ? (
              rollerWeapons.map((w, wi) => {
                const atk = getAttackBonus(w);
                const dmg = getDamage(w);
                return (
                  <div key={w.id || wi} style={{
                    display: "flex", alignItems: "center", gap: 8, paddingBottom: 8,
                    borderBottom: wi < rollerWeapons.length - 1 ? `1px solid ${pal.border}` : "none",
                    marginBottom: 8,
                  }}>
                    <span style={{ flex: 1, fontFamily: pal.fontBody, fontSize: 16, color: pal.text }}>{w.name}</span>
                    {atk !== null && (
                      <button disabled={rolling} onClick={() => rollWeaponAtk(w)} style={rollBtnStyle("atk")}>
                        ATK {fmtMod(atk)}
                      </button>
                    )}
                    {dmg && (
                      <button disabled={rolling} onClick={() => rollWeaponDmg(w)} style={rollBtnStyle("dmg")}>
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

            <hr style={divider} />

            {/* Ability checks */}
            <div style={subLabel}>Ability Checks</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
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
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: rolling ? "not-allowed" : "pointer", opacity: rolling ? 0.5 : 1 }}
                  >
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%",
                      border: `2px solid ${pal.border}`, background: pal.surface,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexDirection: "column", position: "relative",
                    }}>
                      <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: pal.gem, lineHeight: 1 }}>{stat.score}</span>
                      <div style={{
                        position: "absolute", bottom: -7, left: -7,
                        width: 22, height: 22, borderRadius: "50%",
                        background: pal.gemLow,
                        border: `2px solid ${pal.surfaceSolid || pal.surface}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: pal.fontDisplay, fontSize: 9,
                        color: isNeg ? "#c06060" : pal.gem,
                      }}>{modStr}</div>
                    </div>
                    <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted }}>{short}</span>
                  </div>
                );
              })}
            </div>

            <hr style={divider} />

            {/* Result stage */}
            {(rolling || result) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 130, padding: "8px 0" }}>
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
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
                    {result.isMultiGroup ? (
                      /* Multi-group: dice row on top, total below */
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
                        {/* Dice shapes row */}
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", justifyContent: "center", flexWrap: "wrap" }}>
                          {result.groups.map((g, gi) => (
                            <div key={gi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, animation: `dr-group-reveal 0.38s cubic-bezier(0.2,0,0.1,1) ${gi * 0.2}s both` }}>
                              <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted }}>{g.rolls.length}d{g.sides}</span>
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
                        <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%" }}>
                          <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted }}>Total</span>
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
                      const hasFlat = result.flat !== 0;
                      const hasMultiRolls = g?.rolls?.length > 1;
                      if (!hasAdv && !hasFlat && !hasMultiRolls) return null;

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
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "center", minHeight: 24 }}>
                          {chips}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            )}

            <hr style={divider} />

            {/* Free picker */}
            <div style={subLabel}>Free Roll</div>

            {/* Die buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
              {ALL_SIDES.map(sides => {
                const isSelected = selectedSides === sides;
                return (
                  <button
                    key={sides}
                    onClick={() => handleDieSelect(sides)}
                    onDoubleClick={() => handleDieDblClick(sides)}
                    title={`d${sides} — double-click to add to combo`}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      cursor: "pointer", border: "none", padding: "5px 3px", borderRadius: 4,
                      background: isSelected ? pal.accentDim : "transparent",
                      filter: isSelected ? `drop-shadow(0 0 5px ${pal.accent})` : "none",
                      transition: "filter 0.15s, background 0.15s",
                    }}
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted }}>Count</span>
              <button onClick={() => setDieCount(c => Math.max(1, c - 1))} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${pal.border}`, background: "transparent", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.gem, minWidth: 24, textAlign: "center" }}>{dieCount}</span>
              <button onClick={() => setDieCount(c => Math.min(10, c + 1))} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${pal.border}`, background: "transparent", color: pal.accentBright, fontFamily: pal.fontDisplay, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>

            {/* Pending combo display */}
            {comboDice.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginRight: 4 }}>Roll</span>
                {comboDice.map((g, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color: pal.accentBright, background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 2, padding: "2px 8px" }}>
                      {g.count}d{g.sides}
                    </span>
                    {i < comboDice.length - 1 && <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color: pal.textMuted }}>+</span>}
                  </span>
                ))}
                {comboMod !== 0 && (
                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color: pal.accentBright, background: pal.accentDim, border: `1px solid ${pal.accent}`, borderRadius: 2, padding: "2px 8px" }}>
                    {comboMod > 0 ? `+${comboMod}` : comboMod}
                  </span>
                )}
              </div>
            )}

            {/* Add die / clear */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 10 }}>
              <button
                onClick={addDieToCombo}
                style={{
                  fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.12em",
                  padding: "4px 12px", borderRadius: 3, cursor: "pointer",
                  border: `1px solid ${pal.accent}`, background: `rgba(160,104,64,0.10)`,
                  color: pal.accentBright, transition: "all 0.15s",
                }}
              >+ Add Die</button>
              {comboDice.length > 0 && (
                <button
                  onClick={clearCombo}
                  style={{
                    fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.12em",
                    padding: "4px 12px", borderRadius: 3, cursor: "pointer",
                    border: `1px solid ${pal.border}`, background: "transparent",
                    color: pal.textMuted, transition: "all 0.15s",
                  }}
                >✕ Clear</button>
              )}
            </div>

            {/* Flat modifier */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted }}>+ Modifier</span>
              <input
                type="number"
                value={comboMod}
                min={-99} max={99}
                onChange={e => setComboMod(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: 72, background: pal.surfaceSolid || pal.surface,
                  border: `1px solid ${pal.border}`, borderRadius: 3,
                  color: pal.gem, fontFamily: pal.fontDisplay, fontSize: 18,
                  textAlign: "center", padding: "2px 6px", outline: "none",
                  MozAppearance: "textfield",
                }}
              />
            </div>

            {/* Big roll button */}
            <button
              disabled={rolling}
              onClick={rollFree}
              style={{
                display: "block", width: "100%", padding: 12,
                fontFamily: pal.fontDisplay, fontSize: 15, letterSpacing: "0.12em",
                borderRadius: 4, cursor: rolling ? "not-allowed" : "pointer",
                border: `1px solid ${pal.accent}`,
                background: "rgba(18,58,78,0.4)",
                color: pal.accentBright, transition: "all 0.15s",
                textTransform: "uppercase", opacity: rolling ? 0.45 : 1, marginBottom: 16,
              }}
            >{getFreeRollLabel()}</button>

            {/* Expression input */}
            <div style={subLabel}>Expression Roll</div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 4 }}>
              <input
                type="text"
                value={exprInput}
                onChange={e => { setExprInput(e.target.value); setExprError(""); }}
                onKeyDown={e => { if (e.key === "Enter") rollExpr(); }}
                placeholder="or type: 2d6+1d4+3"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1, background: pal.surfaceSolid || pal.surface,
                  border: `1px solid ${pal.border}`, borderRadius: 3,
                  color: pal.text, fontFamily: pal.fontUI, fontSize: 13,
                  letterSpacing: "0.06em", padding: "7px 12px", outline: "none", minWidth: 0,
                }}
              />
              <button
                disabled={rolling}
                onClick={rollExpr}
                style={{
                  fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em",
                  padding: "7px 14px", borderRadius: 3, cursor: rolling ? "not-allowed" : "pointer",
                  border: `1px solid ${pal.accent}`, background: pal.accentDim,
                  color: pal.accentBright, transition: "all 0.15s",
                  whiteSpace: "nowrap", opacity: rolling ? 0.45 : 1,
                }}
              >Roll</button>
            </div>
            {exprError && (
              <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.14em", color: "#c06060", marginBottom: 6 }}>
                {exprError}
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <>
                <hr style={divider} />
                <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 10 }}>Recent Rolls</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {history.map((entry, i) => {
                    const opacities = [1.0, 0.45, 0.22, 0, 0];
                    const opacity = opacities[i] ?? 0;
                    if (opacity === 0) return null;
                    return (
                      <div key={entry.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "7px 0", borderBottom: i < history.length - 1 ? `1px solid ${pal.border}` : "none",
                        opacity, transition: "opacity 0.4s",
                      }}>
                        <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted, minWidth: 52 }}>
                          {entry.dieExpr}
                        </span>
                        <span style={{ flex: 1, fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, fontStyle: "italic" }}>
                          {entry.label}
                        </span>
                        <span style={{
                          fontFamily: pal.fontDisplay, fontSize: 20, minWidth: 32, textAlign: "right",
                          color: entry.isCrit ? "#ffd060" : entry.isFumble ? "#c06060" : pal.gem,
                          textShadow: entry.isCrit ? "0 0 6px rgba(255,200,40,0.4)" : "none",
                        }}>{entry.total}</span>
                        {entry.isCrit && (
                          <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 2, color: "#ffd060", border: "1px solid rgba(255,200,40,0.4)", background: "rgba(255,200,40,0.08)" }}>crit!</span>
                        )}
                        {entry.isFumble && (
                          <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 2, color: "#c06060", border: "1px solid rgba(192,60,60,0.4)", background: "rgba(192,60,60,0.08)" }}>fumble</span>
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
