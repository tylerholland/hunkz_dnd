import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { PALETTES } from "../components/CharacterSheet";
import { getDmParty, patchSession, getInitiative, putInitiative, getNpcCombat, putNpcCombat, verifyPassword } from "../api";
import DmDiceRoller from "../components/DmDiceRoller";

// ── Dashboard palette (switchable via context) ───────────────────────────────
const PalCtx = createContext(PALETTES.ocean);

// ── Responsive styles injected once ─────────────────────────────────────────
const DASHBOARD_CSS = `
  @keyframes pulseDot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .dm-pulse-dot {
    animation: pulseDot 2.5s ease-in-out infinite;
  }
  @keyframes hpDeltaFloat {
    0%   { opacity: 1; transform: translateY(0); }
    70%  { opacity: 1; transform: translateY(-18px); }
    100% { opacity: 0; transform: translateY(-26px); }
  }
  .dm-hp-delta {
    position: absolute;
    right: 6px;
    top: -2px;
    font-size: 13px;
    font-weight: 600;
    pointer-events: none;
    animation: hpDeltaFloat 0.75s ease-out forwards;
    z-index: 10;
  }
  @keyframes dmTurnGlow {
    0%, 100% { box-shadow: 0 0 0 1px var(--turn-color), 0 0 16px 3px var(--turn-glow); }
    50%       { box-shadow: 0 0 0 1px var(--turn-color), 0 0 28px 8px var(--turn-glow); }
  }
  .dm-active-turn {
    animation: dmTurnGlow 2.2s ease-in-out infinite;
  }
  @media (max-width: 1100px) {
    .dm-layout { grid-template-columns: 1fr 300px !important; }
    .dm-npc-col {
      grid-column: 1 / 2;
      border-left: none !important;
      border-top: 1px solid rgba(100,130,160,0.18) !important;
      padding-left: 0 !important;
      padding-top: 20px !important;
      margin-top: 20px !important;
    }
  }
  @media (max-width: 700px) {
    .dm-layout { grid-template-columns: 1fr !important; }
    .dm-party-col { padding-right: 0 !important; }
    .dm-npc-col { grid-column: 1 / 2 !important; }
    .dm-init-col {
      border-left: none !important;
      border-top: 1px solid rgba(100,130,160,0.18) !important;
      padding-left: 0 !important;
      padding-top: 20px !important;
      margin-top: 20px !important;
    }
  }
`;

const ACTIVE_POLL_MS = 1000;
const BACKGROUND_POLL_MS = 5000;

// Reversible experiment:
// When the dashboard itself is in Vellum mode, character cards read better if
// we render each character palette as a lighter "paper" variant locally here.
// Remove this helper + the `cardPal` call site in CharacterCard to undo.
const VELLUM_CARD_MODE = {
  ink: "#332517",
  paper: "#fbf7f0",
  paperAlt: "#f3ebde",
  line: "#d4c2a3",
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map(ch => ch + ch).join("")
    : clean;
  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function mixHex(a, b, ratioB = 0.5) {
  const ratioA = 1 - ratioB;
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mixed = {
    r: Math.round(ca.r * ratioA + cb.r * ratioB),
    g: Math.round(ca.g * ratioA + cb.g * ratioB),
    b: Math.round(ca.b * ratioA + cb.b * ratioB),
  };
  return `#${[mixed.r, mixed.g, mixed.b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getActiveTurnSurface(baseSurface, accent, topAlpha = 0.22, bottomAlpha = 0.08) {
  return `linear-gradient(180deg, ${withAlpha(accent, topAlpha)} 0%, ${withAlpha(accent, bottomAlpha)} 58%, ${baseSurface} 100%)`;
}

function getPartyCardPalette(basePal, dashboardPal) {
  if (dashboardPal !== PALETTES.vellum) {
    return {
      ...basePal,
      uiBorder: "rgba(100,130,160,0.28)",
    };
  }

  const tintRatio = basePal === PALETTES.nightwood ? 0.24 : 0.18;
  const tintRatioStrong = basePal === PALETTES.nightwood ? 0.3 : 0.24;
  const paperTint = mixHex(VELLUM_CARD_MODE.paper, basePal.accent, tintRatio);
  const paperTintStrong = mixHex(VELLUM_CARD_MODE.paperAlt, basePal.accent, tintRatioStrong);
  const accent = mixHex(basePal.accent, VELLUM_CARD_MODE.ink, 0.24);
  const accentBright = mixHex(basePal.accent, VELLUM_CARD_MODE.ink, 0.42);
  const text = mixHex(basePal.text, VELLUM_CARD_MODE.ink, 0.52);
  const textMuted = mixHex(basePal.textMuted || basePal.accent, VELLUM_CARD_MODE.ink, 0.28);
  const surfaceSolid = mixHex(paperTintStrong, basePal.surfaceSolid, 0.14);
  const borderTone = mixHex(basePal.accent, VELLUM_CARD_MODE.line, 0.42);

  return {
    ...basePal,
    surface: withAlpha(mixHex(paperTint, basePal.surfaceSolid, 0.1), 0.7),
    surfaceSolid,
    border: withAlpha(borderTone, 0.72),
    accent,
    accentBright,
    accentDim: withAlpha(mixHex(basePal.accent, paperTintStrong, 0.7), 0.82),
    text,
    textBody: mixHex(basePal.textBody || basePal.text, VELLUM_CARD_MODE.ink, 0.48),
    textMuted,
    gem: mixHex(basePal.gem || basePal.accent, VELLUM_CARD_MODE.ink, 0.34),
    gemLow: withAlpha(mixHex(basePal.accent, paperTintStrong, 0.56), 0.94),
    uiBorder: withAlpha(borderTone, 0.62),
  };
}

function useDashboardStyles() {
  useEffect(() => {
    const id = "dm-dashboard-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = DASHBOARD_CSS;
    document.head.appendChild(style);
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, []);
}

// ── Standard D&D conditions ──────────────────────────────────────────────────
const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

// ── Condition chip color ─────────────────────────────────────────────────────
function conditionStyle(cond) {
  const map = {
    Poisoned:      { bg: "rgba(80,160,80,0.15)",   border: "rgba(80,160,80,0.4)",   color: "#88c888" },
    Prone:         { bg: "rgba(200,144,64,0.14)",  border: "rgba(200,144,64,0.38)", color: "#c89060" },
    Blinded:       { bg: "rgba(180,120,120,0.14)", border: "rgba(180,80,80,0.38)",  color: "#c08080" },
    Charmed:       { bg: "rgba(160,100,200,0.14)", border: "rgba(140,80,180,0.38)", color: "#b880e0" },
    Frightened:    { bg: "rgba(200,160,60,0.14)",  border: "rgba(180,140,40,0.38)", color: "#d0b050" },
    Paralyzed:     { bg: "rgba(120,120,200,0.14)", border: "rgba(80,80,180,0.38)",  color: "#8888e0" },
    Stunned:       { bg: "rgba(160,80,160,0.14)",  border: "rgba(140,60,140,0.38)", color: "#c060c0" },
    Unconscious:   { bg: "rgba(100,100,100,0.18)", border: "rgba(80,80,80,0.4)",    color: "#909090" },
  };
  return map[cond] || { bg: "rgba(100,130,160,0.14)", border: "rgba(100,130,160,0.35)", color: pal.accentBright };
}

// ── HP bar color ─────────────────────────────────────────────────────────────
function hpBarColor(pct) {
  if (pct > 0.5) return "linear-gradient(90deg, #3a7a40 0%, #58b860 100%)";
  if (pct > 0.2) return "linear-gradient(90deg, #a06020 0%, #d08030 100%)";
  return "linear-gradient(90deg, #8a2020 0%, #c06060 100%)";
}

// ── Auth gate (password prompt) ──────────────────────────────────────────────
function DmLoginPrompt({ onSuccess }) {
  const pal = useContext(PalCtx);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Use a known endpoint to verify the DM password.
      // verifyPassword against a placeholder slug will fail if slug doesn't exist,
      // so we use getDmParty directly as the auth check.
      await getDmParty(pw);
      sessionStorage.setItem("dnd_dm_password", pw);
      onSuccess(pw);
    } catch (err) {
      setError(err.status === 403 ? "Incorrect DM password." : "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        background: pal.surfaceSolid,
        border: `1px solid ${pal.border}`,
        borderRadius: 8,
        padding: "36px 40px",
        width: "100%",
        maxWidth: 360,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: pal.fontDisplay,
          fontSize: 20,
          letterSpacing: "0.1em",
          color: pal.accentBright,
          marginBottom: 6,
        }}>DM Dashboard</div>
        <div style={{
          fontFamily: pal.fontUI,
          fontSize: 12,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: pal.textMuted,
          marginBottom: 24,
        }}>Enter DM Password</div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: "100%",
              background: `rgba(18,32,48,0.7)`,
              border: `1px solid ${error ? "#c06060" : pal.accent}`,
              borderRadius: 4,
              color: pal.text,
              fontFamily: pal.fontBody,
              fontSize: 16,
              padding: "10px 14px",
              outline: "none",
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />
          {error && (
            <div style={{
              color: "#c06060",
              fontFamily: pal.fontUI,
              fontSize: 12,
              marginBottom: 10,
            }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading || !pw}
            style={{
              width: "100%",
              background: loading || !pw ? "rgba(18,32,48,0.3)" : `rgba(18,32,48,0.6)`,
              border: `1px solid ${pal.accent}`,
              borderRadius: 4,
              color: pal.accentBright,
              fontFamily: pal.fontUI,
              fontSize: 13,
              letterSpacing: "0.16em",
              padding: "10px 0",
              cursor: loading || !pw ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying…" : "Enter Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Hold-to-repeat hook ──────────────────────────────────────────────────────
function useHoldToRepeat(onTick, delay = 500, interval = 80) {
  const holdTimerRef = useRef(null);
  const holdIntervalRef = useRef(null);

  function start() {
    onTick();
    holdTimerRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(onTick, interval);
    }, delay);
  }

  function stop() {
    clearTimeout(holdTimerRef.current);
    clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
  }

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { start, stop };
}

// ── Simple debounce utility ──────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

function initiativesEqual(a, b) {
  if (!a || !b) return false;
  if ((a.activeTurnIndex ?? 0) !== (b.activeTurnIndex ?? 0)) return false;
  const aEntries = a.entries || [];
  const bEntries = b.entries || [];
  if (aEntries.length !== bEntries.length) return false;
  return JSON.stringify(aEntries) === JSON.stringify(bEntries);
}

// ── Damage/Heal modal ────────────────────────────────────────────────────────
const DAMAGE_PRESETS = [3, 5, 8, 10, 15, 20];

function DamageHealModal({ char, mode, dmPassword, onClose, onOptimisticUpdate, onSync }) {
  const pal = useContext(PalCtx);
  const [amount, setAmount] = useState(0);
  const hpMax = char.hpMax ?? char.hp ?? 0;
  const serverHp = char.hpCurrent ?? 0;
  const isHeal = mode === "heal";
  const accentColor = isHeal ? "#5a9a5a" : "#c06060";
  const accentBright = isHeal ? "#88c888" : "#d08080";

  function confirm() {
    const newHp = Math.max(0, Math.min(hpMax, serverHp + (isHeal ? amount : -amount)));
    onOptimisticUpdate(newHp);
    patchSession(char.slug, { hpCurrent: newHp }, dmPassword)
      .then(() => onSync?.())
      .catch(() => {
        onOptimisticUpdate(serverHp);
      });
    onClose();
  }

  function adjustAmount(delta) {
    setAmount(prev => Math.max(0, prev + delta));
  }

  const minusBind = useHoldToRepeat(() => adjustAmount(-1));
  const plusBind = useHoldToRepeat(() => adjustAmount(1));

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
      if ((e.key === "Enter") && amount > 0) confirm();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepBtnStyle = {
    width: 44,
    height: 44,
    borderRadius: 4,
    border: `1px solid ${accentColor}`,
    background: "rgba(18,32,48,0.7)",
    color: accentBright,
    fontFamily: pal.fontDisplay,
    fontSize: 22,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    userSelect: "none",
    touchAction: "none",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 300, padding: 24,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: pal.surfaceSolid,
        border: `1px solid ${accentColor}`,
        borderRadius: 8,
        padding: "28px 28px 24px",
        width: "100%",
        maxWidth: 340,
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}>
        {/* Title */}
        <div style={{
          fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.28em",
          textTransform: "uppercase", color: accentColor, marginBottom: 4,
        }}>
          {isHeal ? "✦ Heal" : "⚔ Deal Damage"}
        </div>
        <div style={{
          fontFamily: pal.fontDisplay, fontSize: 16, letterSpacing: "0.06em",
          color: pal.accentBright, marginBottom: 4,
        }}>{char.name}</div>
        <div style={{
          fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted, marginBottom: 20,
        }}>
          HP: {serverHp} / {hpMax}
        </div>

        {/* Amount stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button
            {...{}}
            style={stepBtnStyle}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); minusBind.start(); }}
            onPointerUp={minusBind.stop}
            onPointerCancel={minusBind.stop}
          >−</button>

          <input
            type="number"
            min="0"
            value={amount}
            onChange={e => setAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
            style={{
              flex: 1,
              background: "rgba(18,32,48,0.8)",
              border: `1px solid ${accentColor}`,
              borderRadius: 4,
              color: accentBright,
              fontFamily: pal.fontDisplay,
              fontSize: 36,
              textAlign: "center",
              padding: "8px 6px",
              outline: "none",
              minWidth: 0,
            }}
          />

          <button
            style={stepBtnStyle}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); plusBind.start(); }}
            onPointerUp={plusBind.stop}
            onPointerCancel={plusBind.stop}
          >+</button>
        </div>

        {/* Preset buttons */}
        <div style={{ display: "flex", gap: 5, marginBottom: 20, flexWrap: "wrap" }}>
          {DAMAGE_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              style={{
                flex: "1 0 auto",
                minWidth: 36,
                background: amount === p ? `${accentColor}22` : "transparent",
                border: `1px solid ${amount === p ? accentColor : "rgba(100,130,160,0.28)"}`,
                borderRadius: 3,
                color: amount === p ? accentBright : pal.textMuted,
                fontFamily: pal.fontDisplay,
                fontSize: 14,
                padding: "5px 4px",
                cursor: "pointer",
              }}
            >{p}</button>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: "transparent",
              border: `1px solid rgba(100,130,160,0.28)`,
              borderRadius: 4,
              color: pal.textMuted,
              fontFamily: pal.fontUI,
              fontSize: 12,
              letterSpacing: "0.12em",
              padding: "9px 0",
              cursor: "pointer",
            }}
          >Cancel</button>
          <button
            onClick={confirm}
            disabled={amount === 0}
            style={{
              flex: 2,
              background: amount === 0 ? "rgba(18,32,48,0.3)" : `${accentColor}22`,
              border: `1px solid ${amount === 0 ? "rgba(100,130,160,0.2)" : accentColor}`,
              borderRadius: 4,
              color: amount === 0 ? pal.textMuted : accentBright,
              fontFamily: pal.fontUI,
              fontSize: 12,
              letterSpacing: "0.14em",
              padding: "9px 0",
              cursor: amount === 0 ? "not-allowed" : "pointer",
              opacity: amount === 0 ? 0.6 : 1,
            }}
          >{isHeal ? "Heal" : "Apply Damage"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Quick action popover (⋯ menu — condition, tempHP, concentration, rests) ──
function QuickActionPopover({ char, dmPassword, onClose, onUpdate, initialMode = null, initialVal = "" }) {
  const pal = useContext(PalCtx);
  const [mode, setMode] = useState(initialMode); // null | "condition" | "tempHp"
  const [inputVal, setInputVal] = useState(initialVal);
  const [selectedConds, setSelectedConds] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function applyConditions() {
    const existing = char.conditions || [];
    const merged = Array.from(new Set([...existing, ...selectedConds]));
    await patchSession(char.slug, { conditions: merged }, dmPassword);
    onUpdate();
    onClose();
  }

  async function applyTempHp() {
    const val = parseInt(inputVal, 10);
    if (isNaN(val) || val < 0) return;
    await patchSession(char.slug, { tempHP: val }, dmPassword);
    onUpdate();
    onClose();
  }

  async function clearConcentration() {
    await patchSession(char.slug, { concentration: { active: false, spell: "" } }, dmPassword);
    onUpdate();
    onClose();
  }

  const actionStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    fontFamily: pal.fontUI,
    fontSize: 13,
    letterSpacing: "0.08em",
    color: pal.text,
    cursor: "pointer",
    borderBottom: `1px solid ${pal.border}`,
    transition: "background 0.12s",
  };

  const isConcentrating = char.concentration?.active;

  return (
    <div ref={ref} style={{
      position: "absolute",
      right: 0,
      top: 34,
      zIndex: 100,
      background: pal.surfaceSolid,
      border: `1px solid rgba(100,130,160,0.32)`,
      borderRadius: 5,
      minWidth: 210,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      overflow: "hidden",
    }}>
      <div style={{
        fontFamily: pal.fontUI,
        fontSize: 10,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: pal.textMuted,
        padding: "9px 14px 8px",
        borderBottom: `1px solid ${pal.border}`,
      }}>
        {char.name} — More Actions
      </div>

      {mode === null && (
        <>
          <div
            style={actionStyle}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(106,143,168,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = ""}
            onClick={() => setMode("condition")}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>◈</span> Add Condition
          </div>
          <div
            style={actionStyle}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(106,143,168,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = ""}
            onClick={() => setMode("tempHp")}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>⬡</span> Set Temp HP
          </div>
          {isConcentrating && (
            <div
              style={{ ...actionStyle, color: "#c06060" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(192,96,96,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}
              onClick={clearConcentration}
            >
              <span style={{ width: 18, textAlign: "center", color: "#c06060", fontSize: 15 }}>○</span> Drop Concentration
            </div>
          )}
          <div
            style={actionStyle}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(106,143,168,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = ""}
            onClick={() => { onClose(); onUpdate("shortRest"); }}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>◑</span> Short Rest
          </div>
          <div
            style={{ ...actionStyle, borderBottom: "none" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(106,143,168,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = ""}
            onClick={() => { onClose(); onUpdate("longRest"); }}
          >
            <span style={{ width: 18, textAlign: "center", color: pal.accentBright, fontSize: 15 }}>⏾</span> Long Rest
          </div>
        </>
      )}

      {mode === "tempHp" && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted, marginBottom: 8 }}>Temp HP amount</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min="0"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                background: "rgba(18,32,48,0.7)",
                border: `1px solid ${pal.accent}`,
                borderRadius: 3,
                color: pal.text,
                fontFamily: pal.fontDisplay,
                fontSize: 16,
                padding: "6px 10px",
                outline: "none",
              }}
            />
            <button
              onClick={applyTempHp}
              style={{
                background: "rgba(18,32,48,0.6)",
                border: `1px solid ${pal.accent}`,
                borderRadius: 3,
                color: pal.accentBright,
                fontFamily: pal.fontUI,
                fontSize: 12,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >Apply</button>
          </div>
          <button
            onClick={() => { setMode(null); setInputVal(""); }}
            style={{ background: "none", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, marginTop: 8, cursor: "pointer" }}
          >← Back</button>
        </div>
      )}

      {mode === "condition" && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, color: pal.textMuted, marginBottom: 8 }}>Select conditions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
            {ALL_CONDITIONS.map(cond => {
              const cs = conditionStyle(cond);
              const selected = selectedConds.includes(cond);
              return (
                <span
                  key={cond}
                  onClick={() => setSelectedConds(prev =>
                    prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
                  )}
                  style={{
                    background: selected ? cs.bg : "transparent",
                    border: `1px solid ${selected ? cs.border : pal.border}`,
                    borderRadius: 10,
                    color: selected ? cs.color : pal.textMuted,
                    fontFamily: pal.fontUI,
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    cursor: "pointer",
                  }}
                >{cond}</span>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={applyConditions}
              disabled={selectedConds.length === 0}
              style={{
                flex: 1,
                background: "rgba(18,32,48,0.6)",
                border: `1px solid ${pal.accent}`,
                borderRadius: 3,
                color: pal.accentBright,
                fontFamily: pal.fontUI,
                fontSize: 11,
                padding: "6px 0",
                cursor: selectedConds.length === 0 ? "not-allowed" : "pointer",
                opacity: selectedConds.length === 0 ? 0.5 : 1,
              }}
            >Add Selected</button>
            <button
              onClick={() => { setMode(null); setSelectedConds([]); }}
              style={{ background: "none", border: `1px solid ${pal.border}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, padding: "6px 10px", cursor: "pointer" }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Character card ────────────────────────────────────────────────────────────
function CharacterCard({ char, dmPassword, onUpdate, onRegisterOpen, isActiveTurn = false }) {
  const pal = useContext(PalCtx);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null); // null | "damage" | "heal"
  const charPal = PALETTES[char.palette] || PALETTES.ocean;
  const cardPal = getPartyCardPalette(charPal, pal);

  const hpMax = char.hpMax ?? char.hp ?? null;
  const serverHp = char.hpCurrent ?? null;
  const hasHp = serverHp !== null && hpMax !== null && hpMax > 0;

  // Optimistic HP state
  const [optimisticHp, setOptimisticHp] = useState(serverHp ?? 0);
  const optimisticHpRef = useRef(serverHp ?? 0);
  const serverHpRef = useRef(serverHp ?? 0);
  const hpMaxRef = useRef(hpMax ?? 0);
  const pendingDeltaRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const [deltaIndicator, setDeltaIndicator] = useState(null); // { value, key }

  // Keep ref in sync with state so hold-to-repeat closures always see the current value
  useEffect(() => {
    optimisticHpRef.current = optimisticHp;
  }, [optimisticHp]);

  // Track latest server/base values and only accept server sync when we're not mid-gesture/write
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

  // Debounced flush
  const debouncedFlushRef = useRef(null);
  useEffect(() => {
    debouncedFlushRef.current?.cancel?.();
    debouncedFlushRef.current = debounce(async () => {
      if (flushInFlightRef.current) return;

      const targetHp = Math.max(0, Math.min(hpMaxRef.current ?? 0, optimisticHpRef.current));
      const previousServerHp = serverHpRef.current ?? 0;

      if (targetHp === previousServerHp) {
        pendingDeltaRef.current = 0;
        return;
      }

      pendingDeltaRef.current = 0;
      flushInFlightRef.current = true;

      try {
        await patchSession(char.slug, { hpCurrent: targetHp }, dmPassword);
        serverHpRef.current = targetHp;
        onUpdate();
      } catch {
        serverHpRef.current = previousServerHp;
        optimisticHpRef.current = previousServerHp;
        setOptimisticHp(previousServerHp);
      } finally {
        flushInFlightRef.current = false;
        if (pendingDeltaRef.current !== 0 || optimisticHpRef.current !== serverHpRef.current) {
          debouncedFlushRef.current?.();
        }
      }
    }, 300);
    return () => debouncedFlushRef.current?.cancel?.();
  }, [char.slug, dmPassword, onUpdate]);

  function applyDelta(delta) {
    const current = optimisticHpRef.current;
    const newOptimistic = Math.max(0, Math.min(hpMax ?? 0, current + delta));
    const actualDelta = newOptimistic - current;
    if (actualDelta === 0) return;
    pendingDeltaRef.current += actualDelta;
    optimisticHpRef.current = newOptimistic;
    setOptimisticHp(newOptimistic);
    // Show accumulated delta indicator
    setDeltaIndicator({ value: pendingDeltaRef.current, key: Date.now() });
    debouncedFlushRef.current();
  }

  // Register external open-with-damage callback (from DmDiceRoller "Apply to…")
  useEffect(() => {
    if (onRegisterOpen) {
      onRegisterOpen(char.slug, (val) => {
        setModalMode("damage");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char.slug]);

  const minusBind = useHoldToRepeat(() => applyDelta(-1));
  const plusBind = useHoldToRepeat(() => applyDelta(1));

  const displayHp = hasHp ? optimisticHp : null;
  const hpPct = hasHp ? Math.max(0, Math.min(1, optimisticHp / hpMax)) : 0;
  const hpDanger = hasHp && hpPct < 0.2;

  const conditions = Array.isArray(char.conditions) ? char.conditions : [];
  const visibleConds = conditions.slice(0, 3);
  const overflowCount = conditions.length - visibleConds.length;

  const concentration = char.concentration;
  const isConcentrating = concentration?.active;

  async function removeCondition(cond) {
    const updated = conditions.filter(c => c !== cond);
    await patchSession(char.slug, { conditions: updated }, dmPassword);
    onUpdate();
  }

  const initial = (char.name || "?").charAt(0).toUpperCase();

  const cardBorderColor = hpDanger ? "rgba(192,96,96,0.45)" : cardPal.border;

  const stripeColor = hpDanger ? "#c06060" : cardPal.accent;
  const activeSurface = isActiveTurn
    ? getActiveTurnSurface(cardPal.surfaceSolid, cardPal.accent, 0.18, 0.07)
    : cardPal.surface;

  const stepBtnStyle = {
    width: 28,
    height: 28,
    borderRadius: 3,
    border: `1px solid ${cardPal.uiBorder}`,
    background: "transparent",
    color: cardPal.accentBright,
    fontFamily: cardPal.fontDisplay,
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    userSelect: "none",
    touchAction: "none",
  };

  function handlePopoverUpdate(action) {
    if (action === "shortRest" || action === "longRest") {
      // bubble up to parent which owns the confirm dialog
      onUpdate(action);
    } else {
      onUpdate();
    }
  }

  return (
    <div
      className={isActiveTurn ? "dm-active-turn" : undefined}
      style={{
        background: activeSurface,
        border: `1px solid ${cardBorderColor}`,
        borderRadius: 6,
        marginBottom: 12,
        position: "relative",
        overflow: "visible",
        ...(isActiveTurn ? {
          "--turn-color": cardPal.accent,
          "--turn-glow": `${cardPal.accent}66`,
        } : {}),
      }}
    >
      {/* Left palette stripe */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 3,
        borderRadius: "6px 0 0 6px",
        background: stripeColor,
      }} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 14,
        padding: "14px 14px 10px 18px",
        alignItems: "start",
      }}>
        {/* Portrait */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: `2px solid ${cardPal.accent}`,
          background: cardPal.surfaceSolid,
          overflow: "hidden",
        }}>
          {char.portraitUrl ? (
            <img
              src={char.portraitUrl}
              alt={char.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
            />
          ) : (
            <span style={{
              fontFamily: cardPal.fontDisplay,
              fontSize: 20,
              color: cardPal.gem,
            }}>{initial}</span>
          )}
        </div>

        {/* Card info */}
        <div>
          <div style={{
            fontFamily: cardPal.fontDisplay,
            fontSize: 17,
            letterSpacing: "0.06em",
            color: cardPal.accentBright,
            marginBottom: 3,
          }}>{char.name || "Unknown"}</div>
          <div style={{
            fontFamily: cardPal.fontUI,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: cardPal.textMuted,
            marginBottom: 10,
          }}>
            {[char.race, char.charClass, char.level ? `Lvl ${char.level}` : null]
              .filter(Boolean).join(" · ")}
          </div>

          {/* HP number row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{
                fontFamily: cardPal.fontDisplay,
                fontSize: 22,
                lineHeight: 1,
                color: hpDanger ? "#c06060" : cardPal.gem,
              }}>
                {hasHp ? displayHp : "—"}
              </span>
              {hasHp && (
                <>
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 14, color: cardPal.textMuted }}>/</span>
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 14, color: cardPal.textMuted }}>{hpMax}</span>
                </>
              )}
            </div>
            {char.tempHP > 0 && (
              <span style={{
                background: cardPal.accentDim,
                border: `1px solid ${cardPal.accent}`,
                borderRadius: 8,
                padding: "1px 7px",
                fontFamily: cardPal.fontUI,
                fontSize: 10,
                letterSpacing: "0.08em",
                color: cardPal.accentBright,
              }}>+{char.tempHP} temp</span>
            )}
          </div>

          {/* HP stepper + bar row */}
          {hasHp && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, position: "relative" }}>
              <button
                style={stepBtnStyle}
                onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); minusBind.start(); }}
                onPointerUp={minusBind.stop}
                onPointerCancel={minusBind.stop}
                title="Deal 1 damage (hold to repeat)"
              >−</button>

              {/* HP bar */}
              <div style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                overflow: "hidden",
                background: cardPal.gemLow,
                position: "relative",
              }}>
                <div style={{
                  height: "100%",
                  width: `${hpPct * 100}%`,
                  borderRadius: 3,
                  background: hpBarColor(hpPct),
                  transition: "width 0.25s ease",
                }} />
              </div>

              <button
                style={stepBtnStyle}
                onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); plusBind.start(); }}
                onPointerUp={plusBind.stop}
                onPointerCancel={plusBind.stop}
                title="Heal 1 HP (hold to repeat)"
              >+</button>

              {/* Delta indicator */}
              {deltaIndicator && (
                <span
                  key={deltaIndicator.key}
                  className="dm-hp-delta"
                  style={{ color: cardPal.gem }}
                >
                  {deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : `${deltaIndicator.value}`}
                </span>
              )}
            </div>
          )}

          {/* Conditions + indicators */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {visibleConds.map(cond => {
              const cs = conditionStyle(cond);
              return (
                <span
                  key={cond}
                  onClick={() => removeCondition(cond)}
                  title={`Remove ${cond}`}
                  style={{
                    background: cs.bg,
                    border: `1px solid ${cs.border}`,
                    borderRadius: 10,
                    color: cs.color,
                    fontFamily: cardPal.fontUI,
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    cursor: "pointer",
                  }}
                >{cond} ×</span>
              );
            })}
            {overflowCount > 0 && (
              <span style={{
                fontFamily: cardPal.fontUI,
                fontSize: 10,
                color: cardPal.textMuted,
                letterSpacing: "0.1em",
              }}>+{overflowCount} more</span>
            )}
            {isConcentrating && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.12em", color: cardPal.accentBright }}>
                <span className="dm-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: cardPal.accentBright, boxShadow: `0 0 5px ${cardPal.accentBright}`, flexShrink: 0, display: "inline-block" }} />
                {concentration.spell || "Concentrating"}
              </span>
            )}
            {char.inspiration && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: cardPal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: cardPal.gem }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: cardPal.gem, boxShadow: `0 0 6px ${cardPal.gem}66`, display: "inline-block" }} />
                Inspired
              </span>
            )}
          </div>
        </div>

        {/* Card right: AC + ⋯ menu + sheet link */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, position: "relative" }}>
          <div style={{
            background: cardPal.surfaceSolid,
            border: `1px solid ${cardPal.uiBorder}`,
            borderRadius: 4,
            padding: "5px 10px",
            textAlign: "center",
            minWidth: 46,
          }}>
            <div style={{ fontFamily: cardPal.fontDisplay, fontSize: 20, lineHeight: 1, color: cardPal.gem }}>
              {char.armorTotal ?? "—"}
            </div>
            <div style={{ fontFamily: cardPal.fontUI, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: cardPal.textMuted }}>AC</div>
          </div>

          {/* ⋯ overflow menu button */}
          <button
            onClick={() => setPopoverOpen(v => !v)}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1px solid ${popoverOpen ? cardPal.accent : cardPal.uiBorder}`,
              background: popoverOpen ? cardPal.accentDim : "transparent",
              color: cardPal.accentBright,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              letterSpacing: "0.05em",
            }}
            title="More actions"
          >⋯</button>

          <Link
            to={`/characters/${char.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: cardPal.fontUI,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: cardPal.textMuted,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >↗ Sheet</Link>

          {popoverOpen && (
            <QuickActionPopover
              char={char}
              dmPassword={dmPassword}
              onClose={() => setPopoverOpen(false)}
              onUpdate={handlePopoverUpdate}
            />
          )}
        </div>
      </div>

      {/* Damage / Heal action buttons row */}
      {hasHp && (
        <div style={{
          display: "flex",
          gap: 6,
          padding: "0 14px 12px 18px",
        }}>
          <button
            onClick={() => setModalMode("damage")}
            style={{
              flex: 1,
              background: "rgba(192,96,96,0.08)",
              border: "1px solid rgba(192,96,96,0.3)",
              borderRadius: 4,
              color: "#d08080",
              fontFamily: charPal.fontUI,
              fontSize: 12,
              letterSpacing: "0.1em",
              padding: "6px 0",
              cursor: "pointer",
              transition: "background 0.12s, border-color 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(192,96,96,0.18)"; e.currentTarget.style.borderColor = "#c06060"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(192,96,96,0.08)"; e.currentTarget.style.borderColor = "rgba(192,96,96,0.3)"; }}
          >⚔ Damage</button>
          <button
            onClick={() => setModalMode("heal")}
            style={{
              flex: 1,
              background: "rgba(80,160,80,0.08)",
              border: "1px solid rgba(80,160,80,0.3)",
              borderRadius: 4,
              color: "#88c888",
              fontFamily: charPal.fontUI,
              fontSize: 12,
              letterSpacing: "0.1em",
              padding: "6px 0",
              cursor: "pointer",
              transition: "background 0.12s, border-color 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(80,160,80,0.18)"; e.currentTarget.style.borderColor = "#5a9a5a"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(80,160,80,0.08)"; e.currentTarget.style.borderColor = "rgba(80,160,80,0.3)"; }}
          >✦ Heal</button>
        </div>
      )}

      {/* Damage/Heal modal */}
      {modalMode && (
        <DamageHealModal
          char={{ ...char, hpCurrent: optimisticHp }}
          mode={modalMode}
          dmPassword={dmPassword}
          onClose={() => setModalMode(null)}
          onOptimisticUpdate={newHp => setOptimisticHp(newHp)}
          onSync={onUpdate}
        />
      )}
    </div>
  );
}

// ── NPC combat tracker ────────────────────────────────────────────────────────
const NPC_ACCENT = "#7a7060";
const NPC_BRIGHT = "#b0a080";
const NPC_SURFACE = "rgba(30,26,20,0.6)";
const NPC_BORDER = "rgba(120,110,90,0.3)";

function getNpcCardPalette(dashboardPal) {
  if (dashboardPal !== PALETTES.vellum) {
    return {
      surface: NPC_SURFACE,
      border: NPC_BORDER,
      accent: NPC_ACCENT,
      bright: NPC_BRIGHT,
      track: "rgba(40,34,24,0.8)",
      chipBg: "rgba(122,112,96,0.12)",
      actionBorder: NPC_BORDER,
    };
  }

  const paperTint = mixHex(VELLUM_CARD_MODE.paper, NPC_ACCENT, 0.2);
  const paperTintStrong = mixHex(VELLUM_CARD_MODE.paperAlt, NPC_ACCENT, 0.28);
  const accent = mixHex(NPC_ACCENT, VELLUM_CARD_MODE.ink, 0.24);
  const borderTone = mixHex(NPC_ACCENT, VELLUM_CARD_MODE.line, 0.36);

  return {
    surface: withAlpha(mixHex(paperTint, "#6b5c49", 0.08), 0.62),
    border: withAlpha(borderTone, 0.56),
    accent,
    bright: mixHex(NPC_BRIGHT, VELLUM_CARD_MODE.ink, 0.22),
    track: withAlpha(mixHex(paperTintStrong, "#6b5c49", 0.18), 0.7),
    chipBg: withAlpha(mixHex(paperTintStrong, accent, 0.18), 0.78),
    actionBorder: withAlpha(borderTone, 0.48),
  };
}

function npcHpStatus(npc) {
  if (npc.hpCurrent <= 0) return "dead";
  if (npc.hpCurrent < npc.hpMax / 2) return "bloodied";
  return "alive";
}

function NpcCard({ npc, allNpcsRef, isActiveTurn, dmPassword, onUpdate, onOpenModal, onOpenConditions, onRemove }) {
  const pal = useContext(PalCtx);
  const npcPal = getNpcCardPalette(pal);
  const status = npcHpStatus(npc);
  const isDead = status === "dead";
  const isBloodied = status === "bloodied";

  const serverHp = npc.hpCurrent;
  const hpMax = npc.hpMax;
  const [optimisticHp, setOptimisticHp] = useState(serverHp);
  const optimisticHpRef = useRef(serverHp);
  const serverHpRef = useRef(serverHp);
  const hpMaxRef = useRef(hpMax);
  const pendingDeltaRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const [deltaIndicator, setDeltaIndicator] = useState(null);

  useEffect(() => { optimisticHpRef.current = optimisticHp; }, [optimisticHp]);
  useEffect(() => {
    hpMaxRef.current = hpMax;
    serverHpRef.current = serverHp;
    if (pendingDeltaRef.current === 0 && !flushInFlightRef.current) {
      setOptimisticHp(serverHp);
      optimisticHpRef.current = serverHp;
    }
  }, [serverHp, hpMax]);

  const debouncedFlushRef = useRef(null);
  useEffect(() => {
    debouncedFlushRef.current?.cancel?.();
    debouncedFlushRef.current = debounce(async () => {
      if (flushInFlightRef.current) return;
      const targetHp = Math.min(hpMaxRef.current, Math.max(-999, optimisticHpRef.current));
      const prevServerHp = serverHpRef.current;
      if (targetHp === prevServerHp) { pendingDeltaRef.current = 0; return; }
      pendingDeltaRef.current = 0;
      flushInFlightRef.current = true;
      const updatedNpcs = (allNpcsRef.current || []).map(n =>
        n.id === npc.id ? { ...n, hpCurrent: targetHp } : n
      );
      try {
        await putNpcCombat(dmPassword, { npcs: updatedNpcs });
        serverHpRef.current = targetHp;
        onUpdate();
      } catch {
        serverHpRef.current = prevServerHp;
        optimisticHpRef.current = prevServerHp;
        setOptimisticHp(prevServerHp);
      } finally {
        flushInFlightRef.current = false;
        if (pendingDeltaRef.current !== 0 || optimisticHpRef.current !== serverHpRef.current) {
          debouncedFlushRef.current?.();
        }
      }
    }, 300);
    return () => debouncedFlushRef.current?.cancel?.();
  }, [npc.id, dmPassword, onUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyDelta(delta) {
    const cur = optimisticHpRef.current;
    const next = Math.min(hpMax, Math.max(-999, cur + delta));
    const actual = next - cur;
    if (actual === 0) return;
    pendingDeltaRef.current += actual;
    optimisticHpRef.current = next;
    setOptimisticHp(next);
    setDeltaIndicator({ value: pendingDeltaRef.current, key: Date.now() });
    debouncedFlushRef.current();
  }

  const minusBind = useHoldToRepeat(() => applyDelta(-1));
  const plusBind = useHoldToRepeat(() => applyDelta(1));

  const hpPct = hpMax > 0 ? Math.max(0, Math.min(1, optimisticHp / hpMax)) : 0;
  const hpBarColor = isDead ? "#8c3030" : isBloodied ? "#b07030" : npcPal.accent;
  const leftStripe = isDead ? "#8c3030" : isBloodied ? "#c07030" : npcPal.accent;
  const cardBorder = isDead ? "rgba(192,60,60,0.4)" : isBloodied ? "rgba(180,100,40,0.5)" : npcPal.border;
  const activeSurface = isActiveTurn && !isDead
    ? getActiveTurnSurface(
      npcPal.surface,
      isBloodied ? "#c07030" : npcPal.accent,
      0.22,
      0.08
    )
    : npcPal.surface;

  const glowStyle = isActiveTurn && !isDead ? {
    "--turn-color": isBloodied ? "#b07030" : npcPal.accent,
    "--turn-glow": isBloodied ? "rgba(176,112,48,0.42)" : withAlpha(npcPal.accent, 0.36),
    boxShadow: isBloodied
      ? "0 0 0 1px rgba(176,112,48,0.7), 0 0 18px 4px rgba(176,112,48,0.26)"
      : `0 0 0 1px ${withAlpha(npcPal.accent, 0.74)}, 0 0 18px 4px ${withAlpha(npcPal.accent, 0.24)}`,
  } : {};

  const conditions = Array.isArray(npc.conditions) ? npc.conditions : [];

  return (
    <div
      data-active-turn={isActiveTurn && !isDead ? "true" : undefined}
      className={isActiveTurn && !isDead ? "dm-active-turn" : undefined}
      style={{
        background: activeSurface,
        border: `1px solid ${cardBorder}`,
        borderRadius: 5,
        marginBottom: 10,
        position: "relative",
        opacity: isDead ? 0.75 : 1,
        overflow: "visible",
        ...glowStyle,
      }}
    >
      {/* Left stripe */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "5px 0 0 5px", background: leftStripe }} />

      <div style={{ padding: "10px 10px 0 14px" }}>
        {/* Name row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
            <span style={{
              fontFamily: pal.fontDisplay, fontSize: 15, letterSpacing: "0.05em",
              color: isDead ? pal.textMuted : npcPal.bright,
              textDecoration: isDead ? "line-through" : "none",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{npc.name}</span>
            {isBloodied && !isDead && (
              <span style={{
                fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", padding: "2px 7px", borderRadius: 8,
                background: "rgba(180,100,40,0.14)", border: "1px solid rgba(180,100,40,0.45)", color: "#d09050", flexShrink: 0,
              }}>Bloodied</span>
            )}
            {isDead && (
              <span style={{
                fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", padding: "2px 7px", borderRadius: 8,
                background: "rgba(192,60,60,0.14)", border: "1px solid rgba(192,60,60,0.4)", color: "#c06060", flexShrink: 0,
              }}>Dead</span>
            )}
          </div>
          <button
            onClick={onRemove}
            style={{ background: "transparent", border: "none", color: pal.textMuted, fontSize: 14, cursor: "pointer", padding: "2px 4px", borderRadius: 3, lineHeight: 1, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = "#c06060"; e.currentTarget.style.background = "rgba(192,96,96,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = ""; }}
          >×</button>
        </div>

        {/* HP row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 4 }}>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, lineHeight: 1, color: isDead ? "#c06060" : isBloodied ? "#c07830" : npcPal.bright }}>
            {optimisticHp}
          </span>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>/</span>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 12, color: pal.textMuted }}>{hpMax}</span>
        </div>

        {/* HP stepper + bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 6, position: "relative" }}>
          <button
            onPointerDown={minusBind.start} onPointerUp={minusBind.stop} onPointerLeave={minusBind.stop}
            style={{ width: 26, height: 16, borderRadius: 3, border: `1px solid ${npcPal.actionBorder}`, background: "transparent", color: pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", touchAction: "none" }}
          >−</button>
          <div style={{ flex: 1, padding: "0 5px" }}>
            <div style={{ height: 5, borderRadius: 3, overflow: "hidden", background: npcPal.track }}>
              <div style={{ height: "100%", borderRadius: 3, width: `${hpPct * 100}%`, background: hpBarColor, transition: "width 0.3s ease" }} />
            </div>
          </div>
          <button
            onPointerDown={plusBind.start} onPointerUp={plusBind.stop} onPointerLeave={plusBind.stop}
            style={{ width: 26, height: 16, borderRadius: 3, border: `1px solid ${npcPal.actionBorder}`, background: "transparent", color: pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none", touchAction: "none" }}
          >+</button>
          {deltaIndicator && (
            <div
              key={deltaIndicator.key}
              className="dm-hp-delta"
              style={{ color: deltaIndicator.value > 0 ? "#88c888" : "#d08080" }}
            >{deltaIndicator.value > 0 ? `+${deltaIndicator.value}` : deltaIndicator.value}</div>
          )}
        </div>

        {/* Conditions */}
        {conditions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
            {conditions.map(c => (
              <span
                key={c}
                onClick={() => {
                  const updated = conditions.filter(x => x !== c);
                  const updatedNpcs = (allNpcsRef.current || []).map(n =>
                    n.id === npc.id ? { ...n, conditions: updated } : n
                  );
                  putNpcCombat(dmPassword, { npcs: updatedNpcs }).then(onUpdate).catch(() => {});
                }}
                style={{
                  fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                  background: "rgba(140,110,180,0.14)", border: "1px solid rgba(140,110,180,0.38)", color: "#c098e0",
                }}
                title="Click to remove"
              >{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 5, padding: "6px 10px 8px", borderTop: `1px solid ${npcPal.actionBorder}`, marginTop: 2 }}>
        <button onClick={() => onOpenModal("damage")} style={{ flex: 1, background: "transparent", border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(192,96,96,0.5)"; e.currentTarget.style.color = "#d08080"; e.currentTarget.style.background = "rgba(192,96,96,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = npcPal.actionBorder; e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = "transparent"; }}
        >⚔ Dmg</button>
        <button onClick={() => onOpenModal("heal")} style={{ flex: 1, background: "transparent", border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(80,160,80,0.5)"; e.currentTarget.style.color = "#88c888"; e.currentTarget.style.background = "rgba(80,160,80,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = npcPal.actionBorder; e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = "transparent"; }}
        >✦ Heal</button>
        <button onClick={onOpenConditions} style={{ flex: 1, background: "transparent", border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 0", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(140,110,180,0.5)"; e.currentTarget.style.color = "#c098e0"; e.currentTarget.style.background = "rgba(140,110,180,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = npcPal.actionBorder; e.currentTarget.style.color = pal.textMuted; e.currentTarget.style.background = "transparent"; }}
        >+ Cond</button>
      </div>
    </div>
  );
}

function NpcCombatSection({ npcCombat, initiative, dmPassword, onUpdate }) {
  const pal = useContext(PalCtx);
  const npcPal = getNpcCardPalette(pal);
  const allNpcsRef = useRef(npcCombat.npcs || []);
  useEffect(() => { allNpcsRef.current = npcCombat.npcs || []; }, [npcCombat.npcs]);

  const [modalTarget, setModalTarget] = useState(null); // { npc, mode }
  const [condTarget, setCondTarget] = useState(null);   // npc
  const [addName, setAddName] = useState("");
  const [addHp, setAddHp] = useState("");
  const [addCount, setAddCount] = useState(1);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const npcs = npcCombat.npcs || [];

  // Active turn NPC id
  const sorted = [...(initiative.entries || [])].sort((a, b) => b.initiative - a.initiative);
  const activeEntry = sorted[initiative.activeTurnIndex ?? 0];
  const activeTurnNpcId = activeEntry?.npcId ?? null;
  const activeTurnEntryId = activeEntry?.id ?? null;
  const activeTurnNpcName = !activeEntry?.isPC ? (activeEntry?.name || "").trim().toLowerCase() : "";

  async function handleAddNpcs() {
    if (!addName.trim() || !addHp) return;
    const hpMax = parseInt(addHp, 10);
    if (isNaN(hpMax) || hpMax <= 0) return;
    const count = Math.max(1, Math.min(8, parseInt(addCount, 10) || 1));
    const newNpcs = Array.from({ length: count }, (_, i) => ({
      id: "npc-" + Date.now() + i + Math.random().toString(36).slice(2, 5),
      name: count > 1 ? `${addName.trim()} ${String.fromCharCode(65 + i)}` : addName.trim(),
      hpMax,
      hpCurrent: hpMax,
      conditions: [],
      initiativeEntryId: null,
    }));
    const updated = [...npcs, ...newNpcs];
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      setAddName(""); setAddHp(""); setAddCount(1);
      onUpdate();
    } catch (_) {}
  }

  async function handleRemoveNpc(npcId) {
    const updated = npcs.filter(n => n.id !== npcId);
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      onUpdate();
    } catch (_) {}
  }

  async function handleEndCombat() {
    try {
      await putNpcCombat(dmPassword, { npcs: [] });
      setShowEndConfirm(false);
      onUpdate();
    } catch (_) {}
  }

  // Optimistic update from Damage/Heal modal
  function handleModalOptimistic(npcId, newHp) {
    allNpcsRef.current = (allNpcsRef.current || []).map(n =>
      n.id === npcId ? { ...n, hpCurrent: newHp } : n
    );
  }

  async function handleModalConfirm(npcId, newHp) {
    const updated = (allNpcsRef.current || []).map(n =>
      n.id === npcId ? { ...n, hpCurrent: newHp } : n
    );
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      onUpdate();
    } catch {
      // revert handled by NpcCard's serverHp sync
    }
  }

  async function handleAddCondition(npcId, cond) {
    if (!cond) return;
    const updated = (allNpcsRef.current || []).map(n =>
      n.id === npcId && !n.conditions.includes(cond) ? { ...n, conditions: [...n.conditions, cond] } : n
    );
    try {
      await putNpcCombat(dmPassword, { npcs: updated });
      setCondTarget(null);
      onUpdate();
    } catch (_) {}
  }

  return (
    <div className="dm-npc-col" style={{ borderLeft: `1px solid ${pal.border}`, paddingLeft: 20, paddingRight: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted }}>
          Enemies{npcs.length > 0 ? ` · ${npcs.length}` : ""}
        </span>
        {npcs.length > 0 && (
          <button
            onClick={() => setShowEndConfirm(true)}
            style={{ background: "transparent", border: "1px solid rgba(160,80,60,0.45)", borderRadius: 3, color: "#c08070", fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(160,80,60,0.15)"; e.currentTarget.style.borderColor = "rgba(192,96,80,0.7)"; e.currentTarget.style.color = "#e0a090"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(160,80,60,0.45)"; e.currentTarget.style.color = "#c08070"; }}
          >End Combat ×</button>
        )}
      </div>

      {/* NPC cards */}
      {npcs.length === 0 ? (
        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", color: pal.textMuted, padding: "12px 0 16px", textAlign: "center" }}>
          No enemies tracked yet.<br />Add below or tap an NPC in initiative.
        </div>
      ) : (
        npcs.map(npc => (
          <NpcCard
            key={npc.id}
            npc={npc}
            allNpcsRef={allNpcsRef}
            isActiveTurn={
              activeTurnNpcId === npc.id ||
              (activeTurnEntryId !== null && npc.initiativeEntryId === activeTurnEntryId) ||
              (!!activeTurnNpcName && (npc.name || "").trim().toLowerCase() === activeTurnNpcName)
            }
            dmPassword={dmPassword}
            onUpdate={onUpdate}
            onOpenModal={mode => setModalTarget({ npc, mode })}
            onOpenConditions={() => setCondTarget(npc)}
            onRemove={() => handleRemoveNpc(npc.id)}
          />
        ))
      )}

      {/* Add NPC form */}
      <div style={{ background: npcPal.surface, border: `1px dashed ${npcPal.actionBorder}`, borderRadius: 5, padding: 14, marginTop: 4 }}>
        <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 10 }}>Add Enemy</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            type="text" placeholder="Name…" value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddNpcs()}
            style={{ flex: 1, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "7px 10px", outline: "none" }}
          />
          <input
            type="number" placeholder="HP" value={addHp}
            onChange={e => setAddHp(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddNpcs()}
            style={{ width: 64, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15, padding: "7px 8px", outline: "none", textAlign: "center" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted }}>Count:</span>
          <input
            type="number" min="1" max="8" value={addCount}
            onChange={e => setAddCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
            style={{ width: 44, background: npcPal.track, border: `1px solid ${npcPal.actionBorder}`, borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 14, padding: "4px 6px", outline: "none", textAlign: "center" }}
          />
          {addCount > 1 && addName.trim() && (
            <span style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, fontStyle: "italic" }}>
              → {addName.trim()} A–{String.fromCharCode(64 + parseInt(addCount) || 1)}
            </span>
          )}
        </div>
        <button
          onClick={handleAddNpcs}
          style={{ width: "100%", background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, borderRadius: 3, color: npcPal.bright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", padding: "8px 0", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.background = withAlpha(npcPal.accent, 0.22); }}
          onMouseLeave={e => { e.currentTarget.style.background = npcPal.chipBg; }}
        >+ Add Enemy</button>
      </div>

      {/* Damage/Heal modal for NPCs */}
      {modalTarget && (
        <NpcDamageHealModal
          npc={modalTarget.npc}
          mode={modalTarget.mode}
          onClose={() => setModalTarget(null)}
          onOptimisticUpdate={newHp => handleModalOptimistic(modalTarget.npc.id, newHp)}
          onConfirm={newHp => handleModalConfirm(modalTarget.npc.id, newHp)}
        />
      )}

      {/* Condition picker for NPCs */}
      {condTarget && (
        <NpcConditionPicker
          npc={condTarget}
          onAdd={cond => handleAddCondition(condTarget.id, cond)}
          onClose={() => setCondTarget(null)}
        />
      )}

      {/* End Combat confirm */}
      {showEndConfirm && (
        <ConfirmDialog
          title="End Combat"
          message="Remove all NPC tracking? Initiative and party state are not affected."
          onConfirm={handleEndCombat}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  );
}

function NpcDamageHealModal({ npc, mode, onClose, onOptimisticUpdate, onConfirm }) {
  const pal = useContext(PalCtx);
  const [amount, setAmount] = useState(0);
  const isHeal = mode === "heal";
  const accentColor = isHeal ? "#5a9a5a" : "#c06060";
  const accentBright = isHeal ? "#88c888" : "#d08080";
  const minusBind = useHoldToRepeat(() => setAmount(a => Math.max(0, a - 1)));
  const plusBind  = useHoldToRepeat(() => setAmount(a => a + 1));

  function confirm() {
    const newHp = isHeal
      ? Math.min(npc.hpMax, npc.hpCurrent + amount)
      : npc.hpCurrent - amount;
    onOptimisticUpdate(newHp);
    onConfirm(newHp);
    onClose();
  }

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); if (e.key === "Enter") confirm(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={onClose}>
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${accentColor}`, borderRadius: 8, padding: "24px 28px", maxWidth: 340, width: "90%" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 4 }}>
          {isHeal ? "✦ Heal" : "⚔ Deal Damage"} — {npc.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "20px 0" }}>
          <button onPointerDown={minusBind.start} onPointerUp={minusBind.stop} onPointerLeave={minusBind.stop}
            style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${accentColor}`, background: "transparent", color: accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer" }}>−</button>
          <input type="number" value={amount} min="0"
            onChange={e => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
            style={{ width: 90, background: "transparent", border: "none", borderBottom: `2px solid ${accentColor}`, color: accentBright, fontFamily: pal.fontDisplay, fontSize: 42, textAlign: "center", outline: "none" }} />
          <button onPointerDown={plusBind.start} onPointerUp={plusBind.stop} onPointerLeave={plusBind.stop}
            style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${accentColor}`, background: "transparent", color: accentBright, fontFamily: pal.fontDisplay, fontSize: 22, cursor: "pointer" }}>+</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 20 }}>
          {[3, 5, 8, 10, 15, 20].map(p => (
            <button key={p} onClick={() => setAmount(p)}
              style={{ padding: "5px 12px", borderRadius: 4, border: `1px solid ${amount === p ? accentColor : "rgba(100,130,160,0.32)"}`, background: amount === p ? `rgba(${isHeal ? "80,160,80" : "192,96,96"},0.15)` : "transparent", color: amount === p ? accentBright : pal.textMuted, fontFamily: pal.fontDisplay, fontSize: 14, cursor: "pointer" }}
            >{p}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 4, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "8px 0", cursor: "pointer" }}>Cancel</button>
          <button onClick={confirm} style={{ flex: 2, background: `rgba(${isHeal ? "80,160,80" : "192,96,96"},0.15)`, border: `1px solid ${accentColor}`, borderRadius: 4, color: accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "8px 0", cursor: "pointer" }}>
            {isHeal ? `Heal ${amount}` : `Deal ${amount} damage`}
          </button>
        </div>
      </div>
    </div>
  );
}

function NpcConditionPicker({ npc, onAdd, onClose }) {
  const pal = useContext(PalCtx);
  const existing = new Set(npc.conditions || []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={onClose}>
      <div style={{ background: pal.surfaceSolid, border: `1px solid ${pal.accent}`, borderRadius: 8, padding: "20px 24px", maxWidth: 360, width: "90%" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.accentBright, marginBottom: 14 }}>Add Condition — {npc.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_CONDITIONS.map(c => (
            <button key={c} disabled={existing.has(c)}
              onClick={() => onAdd(c)}
              style={{ padding: "5px 12px", borderRadius: 10, border: `1px solid ${existing.has(c) ? pal.border : pal.accent}`, background: existing.has(c) ? "transparent" : "rgba(106,143,168,0.1)", color: existing.has(c) ? pal.textMuted : pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", cursor: existing.has(c) ? "not-allowed" : "pointer" }}
            >{c}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, width: "100%", background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 4, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", padding: "8px 0", cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

// ── Initiative tracker ────────────────────────────────────────────────────────
function InitiativeTracker({ initiative, party, onCommitInitiative, onPromoteToNpc, npcCombat }) {
  const pal = useContext(PalCtx);
  const [newName, setNewName] = useState("");
  const [newInit, setNewInit] = useState("");
  const [pcRolls, setPcRolls] = useState({});
  const [promoteOpenId, setPromoteOpenId] = useState(null);
  const [promoteHp, setPromoteHp] = useState("");
  const vellumTurnButtonBg = pal === PALETTES.vellum
    ? getActiveTurnSurface(withAlpha(mixHex(VELLUM_CARD_MODE.paperAlt, pal.accent, 0.14), 0.82), pal.accent, 0.16, 0.05)
    : "rgba(18,32,48,0.5)";

  const entries = [...(initiative.entries || [])].sort((a, b) => b.initiative - a.initiative);
  const activeTurnIndex = initiative.activeTurnIndex ?? 0;
  const activeSortedIndex = activeTurnIndex < entries.length ? activeTurnIndex : 0;

  // PCs not yet in initiative
  const existingSlugs = new Set((initiative.entries || []).map(e => e.slug).filter(Boolean));
  const availablePCs = (party || []).filter(c => !existingSlugs.has(c.slug));

  async function handleNextTurn() {
    if (entries.length === 0) return;
    const next = (activeTurnIndex + 1) % entries.length;
    await onCommitInitiative(
      { entries: initiative.entries || [], activeTurnIndex: next },
      { optimistic: true }
    );
  }

  async function handleAddPC(char) {
    const roll = pcRolls[char.slug] ?? "";
    const initNum = parseInt(roll, 10);
    const entry = {
      id: "id" + Date.now() + Math.random().toString(36).slice(2, 6),
      slug: char.slug,
      name: char.name || char.nameAlt || char.slug,
      initiative: isNaN(initNum) ? 0 : initNum,
      isPC: true,
      npcId: null,
    };
    const updated = [...(initiative.entries || []), entry];
    await onCommitInitiative({ entries: updated, activeTurnIndex: initiative.activeTurnIndex ?? 0 });
    setPcRolls(r => { const n = { ...r }; delete n[char.slug]; return n; });
  }

  async function handleAddEntry() {
    if (!newName.trim()) return;
    const initNum = parseInt(newInit, 10);
    const entry = {
      id: "id" + Date.now() + Math.random().toString(36).slice(2, 6),
      name: newName.trim(),
      initiative: isNaN(initNum) ? 0 : initNum,
      isPC: false,
      npcId: null,
    };
    const updated = [...(initiative.entries || []), entry];
    await onCommitInitiative({ entries: updated, activeTurnIndex: initiative.activeTurnIndex ?? 0 });
    setNewName("");
    setNewInit("");
  }

  async function handleRemove(id) {
    const updated = (initiative.entries || []).filter(e => e.id !== id);
    await onCommitInitiative({ entries: updated, activeTurnIndex: 0 });
  }

  async function handleClear() {
    await onCommitInitiative({ entries: [], activeTurnIndex: 0 });
  }

  return (
    <div className="dm-init-col" style={{
      borderLeft: `1px solid ${pal.border}`,
      paddingLeft: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{
          fontFamily: pal.fontUI,
          fontSize: 11,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: pal.textMuted,
        }}>Initiative Order</span>
        <button
          onClick={handleClear}
          style={{
            background: "transparent",
            border: "none",
            color: pal.textMuted,
            fontFamily: pal.fontUI,
            fontSize: 11,
            letterSpacing: "0.12em",
            cursor: "pointer",
            padding: "3px 0",
          }}
          onMouseEnter={e => e.target.style.color = "#c06060"}
          onMouseLeave={e => e.target.style.color = pal.textMuted}
        >Clear ×</button>
      </div>

      <button
        onClick={handleNextTurn}
        disabled={entries.length === 0}
        style={{
          background: entries.length === 0 ? "transparent" : vellumTurnButtonBg,
          border: `1px solid ${entries.length === 0 ? pal.border : pal.accent}`,
          borderRadius: 4,
          color: entries.length === 0 ? pal.textMuted : pal.accentBright,
          fontFamily: pal.fontUI,
          fontSize: 12,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          padding: "9px 0",
          width: "100%",
          cursor: entries.length === 0 ? "not-allowed" : "pointer",
          marginBottom: 10,
        }}
      >▶ Next Turn</button>

      {entries.length === 0 ? (
        <div style={{
          fontFamily: pal.fontUI,
          fontSize: 12,
          color: pal.textMuted,
          textAlign: "center",
          padding: "20px 0",
          letterSpacing: "0.08em",
        }}>No initiative set — add combatants below</div>
      ) : (
        <ul style={{ listStyle: "none", marginBottom: 14, padding: 0 }}>
          {entries.map((entry, idx) => {
            const isCurrent = idx === activeSortedIndex;
            const isPromoteOpen = promoteOpenId === entry.id;
            // HP dot for tracked NPCs
            const trackedNpc = !entry.isPC && entry.npcId
              ? (npcCombat?.npcs || []).find(n => n.id === entry.npcId)
              : null;
            let hpDotColor = null;
            if (trackedNpc) {
              if (trackedNpc.hpCurrent <= 0) hpDotColor = "#8c3030";
              else if (trackedNpc.hpCurrent < trackedNpc.hpMax / 2) hpDotColor = "#b07030";
              else hpDotColor = "#5a9060";
            }
            const canPromote = !entry.isPC && !entry.npcId && onPromoteToNpc;
            return (
              <li key={entry.id} style={{ marginBottom: 3 }}>
                <div
                  onClick={canPromote ? () => setPromoteOpenId(isPromoteOpen ? null : entry.id) : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: isPromoteOpen ? "4px 4px 0 0" : 4,
                    background: isCurrent ? "rgba(106,143,168,0.12)" : pal.surface,
                    border: `1px solid ${isCurrent ? pal.accent : isPromoteOpen ? "rgba(122,112,96,0.5)" : pal.border}`,
                    cursor: canPromote ? "pointer" : "default",
                  }}
                  onMouseEnter={canPromote ? e => { if (!isCurrent) e.currentTarget.style.borderColor = "rgba(122,112,96,0.5)"; } : undefined}
                  onMouseLeave={canPromote ? e => { if (!isCurrent && !isPromoteOpen) e.currentTarget.style.borderColor = pal.border; } : undefined}
                >
                  <span style={{
                    fontFamily: pal.fontDisplay,
                    fontSize: 18,
                    color: isCurrent ? pal.accentBright : pal.gem,
                    width: 28,
                    textAlign: "center",
                    flexShrink: 0,
                  }}>{entry.initiative}</span>
                  <span style={{
                    fontFamily: pal.fontBody,
                    fontSize: 15,
                    color: isCurrent ? pal.accentBright : pal.text,
                    fontWeight: isCurrent ? 600 : 400,
                    flex: 1,
                    fontStyle: !entry.isPC ? "italic" : "normal",
                  }}>{entry.name}</span>
                  {hpDotColor && (
                    <span style={{
                      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                      background: hpDotColor,
                      boxShadow: `0 0 4px ${hpDotColor}`,
                      display: "inline-block",
                    }} title={`${trackedNpc.hpCurrent}/${trackedNpc.hpMax} HP`} />
                  )}
                  {!entry.isPC && !entry.npcId && (
                    <span style={{
                      fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em",
                      textTransform: "uppercase", color: pal.textMuted,
                      background: "rgba(100,130,160,0.1)", border: `1px solid ${pal.border}`,
                      borderRadius: 8, padding: "1px 6px",
                    }}>NPC</span>
                  )}
                  {isCurrent && (
                    <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: pal.accentBright, whiteSpace: "nowrap" }}>◀ Now</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleRemove(entry.id); }}
                    style={{
                      background: "transparent", border: "none", color: pal.textMuted,
                      fontSize: 14, cursor: "pointer", padding: "2px 4px", borderRadius: 3, lineHeight: 1,
                    }}
                    onMouseEnter={e => { e.target.style.color = "#c06060"; e.target.style.background = "rgba(192,96,96,0.1)"; }}
                    onMouseLeave={e => { e.target.style.color = pal.textMuted; e.target.style.background = ""; }}
                  >×</button>
                </div>
                {/* Promote-to-NPC inline form */}
                {isPromoteOpen && (
                  <div style={{
                    padding: "10px 12px",
                    background: "rgba(30,26,20,0.6)",
                    border: "1px solid rgba(122,112,96,0.5)",
                    borderTop: "none",
                    borderRadius: "0 0 4px 4px",
                  }}>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 7 }}>Set max HP to track this enemy</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="number"
                        placeholder="HP"
                        value={promoteHp}
                        onChange={e => setPromoteHp(e.target.value)}
                        onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") { const n = parseInt(promoteHp, 10); if (n > 0) { onPromoteToNpc(entry.id, n); setPromoteOpenId(null); setPromoteHp(""); } } }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{
                          width: 72, background: "rgba(18,14,10,0.6)",
                          border: "1px solid rgba(122,112,96,0.45)", borderRadius: 3,
                          color: pal.text, fontFamily: pal.fontDisplay, fontSize: 16,
                          padding: "6px 8px", outline: "none", textAlign: "center",
                        }}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); const n = parseInt(promoteHp, 10); if (n > 0) { onPromoteToNpc(entry.id, n); setPromoteOpenId(null); setPromoteHp(""); } }}
                        style={{
                          background: "rgba(122,112,96,0.2)", border: "1px solid #7a7060",
                          borderRadius: 3, color: "#b0a080", fontFamily: pal.fontUI,
                          fontSize: 11, letterSpacing: "0.14em", padding: "6px 12px", cursor: "pointer",
                        }}
                      >Track HP</button>
                      <button
                        onClick={e => { e.stopPropagation(); setPromoteOpenId(null); setPromoteHp(""); }}
                        style={{ background: "transparent", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, cursor: "pointer", padding: "4px 6px" }}
                      >Cancel</button>
                    </div>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, marginTop: 5, fontStyle: "italic" }}>Creates an NPC card linked to this entry.</div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* PC roster — party members not yet in initiative */}
      {availablePCs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em",
            textTransform: "uppercase", color: pal.textMuted, marginBottom: 8,
          }}>Add Characters</div>
          {availablePCs.map(char => (
            <div key={char.slug} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{
                fontFamily: pal.fontBody, fontSize: 14, color: pal.text, flex: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{char.name || char.nameAlt || char.slug}</span>
              <input
                type="number"
                placeholder="Roll"
                value={pcRolls[char.slug] ?? ""}
                onChange={e => setPcRolls(r => ({ ...r, [char.slug]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleAddPC(char)}
                style={{
                  width: 52, background: pal.surface,
                  border: `1px solid rgba(100,130,160,0.32)`, borderRadius: 3,
                  color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15,
                  padding: "5px 6px", outline: "none", textAlign: "center",
                }}
              />
              <button
                onClick={() => handleAddPC(char)}
                style={{
                  background: "transparent", border: `1px solid rgba(100,130,160,0.32)`,
                  borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI,
                  fontSize: 13, padding: "5px 10px", cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.background = "rgba(106,143,168,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.background = "transparent"; }}
              >+</button>
            </div>
          ))}
        </div>
      )}

      <div style={{
        fontFamily: pal.fontUI,
        fontSize: 11,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: pal.textMuted,
        marginBottom: 8,
      }}>Add Combatant</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          placeholder="Name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAddEntry()}
          style={{
            flex: 1,
            background: pal.surface,
            border: `1px solid rgba(100,130,160,0.32)`,
            borderRadius: 3,
            color: pal.text,
            fontFamily: pal.fontBody,
            fontSize: 14,
            padding: "7px 10px",
            outline: "none",
          }}
        />
        <input
          type="number"
          placeholder="Init"
          value={newInit}
          onChange={e => setNewInit(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAddEntry()}
          style={{
            width: 50,
            background: pal.surface,
            border: `1px solid rgba(100,130,160,0.32)`,
            borderRadius: 3,
            color: pal.text,
            fontFamily: pal.fontDisplay,
            fontSize: 15,
            padding: "7px 6px",
            outline: "none",
            textAlign: "center",
          }}
        />
        <button
          onClick={handleAddEntry}
          style={{
            background: "transparent",
            border: `1px solid rgba(100,130,160,0.32)`,
            borderRadius: 3,
            color: pal.accentBright,
            fontFamily: pal.fontUI,
            fontSize: 13,
            padding: "7px 12px",
            cursor: "pointer",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.background = "rgba(106,143,168,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.background = "transparent"; }}
        >Add</button>
      </div>
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  const pal = useContext(PalCtx);
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: pal.surfaceSolid,
        border: `1px solid ${pal.accent}`,
        borderRadius: 8,
        padding: "28px 32px",
        maxWidth: 400,
        width: "90%",
      }}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 17, color: pal.accentBright, marginBottom: 12 }}>{title}</div>
        <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.textBody, marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              border: `1px solid ${pal.border}`,
              borderRadius: 4,
              color: pal.textMuted,
              fontFamily: pal.fontUI,
              fontSize: 12,
              letterSpacing: "0.14em",
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              background: "rgba(18,32,48,0.6)",
              border: `1px solid ${pal.accent}`,
              borderRadius: 4,
              color: pal.accentBright,
              fontFamily: pal.fontUI,
              fontSize: 12,
              letterSpacing: "0.14em",
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function DmDashboardPage() {
  useDashboardStyles();

  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(false);
  const [party, setParty] = useState([]);
  const [initiative, setInitiative] = useState({ entries: [], activeTurnIndex: 0 });
  const [npcCombat, setNpcCombat] = useState({ npcs: [] });
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }
  const [restNotice, setRestNotice] = useState("");
  const [palKey, setPalKey] = useState(() => sessionStorage.getItem("dnd_dm_palette") || "ocean");
  const pal = PALETTES[palKey] || PALETTES.ocean;

  // Map of slug → openWithDamage fn registered by CharacterCard
  const cardOpenFnsRef = useRef({});
  const requestSeqRef = useRef(0);
  const activeRequestCountRef = useRef(0);
  const refreshTimerRef = useRef(null);
  const initiativeServerRef = useRef(initiative);
  const initiativeExpectedRef = useRef(null);
  const initiativeWriteInFlightRef = useRef(false);
  const queuedInitiativeRef = useRef(null);

  const fetchDashboardData = useCallback(async ({ background = false, force = false } = {}) => {
    if (!dmPassword) return;
    if (background && activeRequestCountRef.current > 0 && !force) return;

    const requestId = ++requestSeqRef.current;
    activeRequestCountRef.current += 1;

    try {
      const [partyData, initData, npcData] = await Promise.all([
        getDmParty(dmPassword),
        getInitiative(dmPassword),
        getNpcCombat(dmPassword),
      ]);
      if (requestId !== requestSeqRef.current) return;
      setParty(partyData);
      initiativeServerRef.current = initData;
      if (initiativeExpectedRef.current && !initiativesEqual(initData, initiativeExpectedRef.current)) {
        // Keep the optimistic local turn state until the server catches up or the write fails.
      } else {
        if (initiativeExpectedRef.current && initiativesEqual(initData, initiativeExpectedRef.current)) {
          initiativeExpectedRef.current = null;
        }
        setInitiative(initData);
      }
      setNpcCombat(npcData);
    } catch (_) {
      // Silent — show stale data rather than error on poll failure
    } finally {
      activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
    }
  }, [dmPassword]);

  const queueDashboardRefresh = useCallback((delay = 75) => {
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      fetchDashboardData({ background: true, force: true });
    }, delay);
  }, [fetchDashboardData]);

  const commitInitiativeUpdate = useCallback(async (nextInitiative, { optimistic = false } = {}) => {
    if (!dmPassword) return;

    const normalized = {
      entries: nextInitiative.entries || [],
      activeTurnIndex: nextInitiative.activeTurnIndex ?? 0,
    };

    queuedInitiativeRef.current = normalized;

    if (optimistic) {
      initiativeExpectedRef.current = normalized;
      setInitiative(normalized);
    }

    if (initiativeWriteInFlightRef.current) return;

    while (queuedInitiativeRef.current) {
      const target = queuedInitiativeRef.current;
      queuedInitiativeRef.current = null;
      initiativeWriteInFlightRef.current = true;
      initiativeExpectedRef.current = target;

      try {
        await putInitiative(dmPassword, target);
        initiativeServerRef.current = target;
        queueDashboardRefresh(0);
      } catch (_) {
        initiativeExpectedRef.current = null;
        queuedInitiativeRef.current = null;
        setInitiative(initiativeServerRef.current);
        queueDashboardRefresh(0);
        break;
      } finally {
        initiativeWriteInFlightRef.current = false;
      }
    }
  }, [dmPassword, queueDashboardRefresh]);

  const handleRegisterOpen = useCallback((slug, fn) => {
    cardOpenFnsRef.current[slug] = fn;
  }, []);

  const handleApplyDamage = useCallback((slug, amount) => {
    const fn = cardOpenFnsRef.current[slug];
    if (fn) fn(amount);
  }, []);

  const handleApplyNpcDamage = useCallback(async (npcId, amount) => {
    setNpcCombat(prev => {
      const updated = (prev.npcs || []).map(n =>
        n.id === npcId ? { ...n, hpCurrent: n.hpCurrent - amount } : n
      );
      putNpcCombat(dmPassword, { npcs: updated }).then(() => queueDashboardRefresh(0)).catch(() => {});
      return { npcs: updated };
    });
  }, [dmPassword, queueDashboardRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromoteToNpc = useCallback(async (entryId, hpMax) => {
    const entry = initiative.entries.find(e => e.id === entryId);
    if (!entry) return;
    const npcId = "npc-" + Date.now() + Math.random().toString(36).slice(2, 5);
    const newNpc = {
      id: npcId,
      name: entry.name,
      hpMax,
      hpCurrent: hpMax,
      conditions: [],
      initiativeEntryId: entryId,
    };
    const updatedNpcs = [...(npcCombat.npcs || []), newNpc];
    const updatedEntries = initiative.entries.map(e =>
      e.id === entryId ? { ...e, npcId } : e
    );
    try {
      await Promise.all([
        putNpcCombat(dmPassword, { npcs: updatedNpcs }),
        putInitiative(dmPassword, { entries: updatedEntries, activeTurnIndex: initiative.activeTurnIndex ?? 0 }),
      ]);
      queueDashboardRefresh(0);
    } catch (_) {}
  }, [dmPassword, initiative, npcCombat, queueDashboardRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called by CharacterCard onUpdate — handles rest actions from ⋯ popover
  const handleCardUpdate = useCallback((action) => {
    if (action === "shortRest") {
      setConfirmDialog({
        title: "Short Rest",
        message: "Reset Pact Magic (Warlock) spell slots for all characters. Standard spell slots and HP are not affected.",
        onConfirm: doShortRest,
      });
    } else if (action === "longRest") {
      setConfirmDialog({
        title: "Long Rest",
        message: "Reset all spell slots and restore all characters to max HP. This cannot be undone.",
        onConfirm: doLongRest,
      });
    } else {
      queueDashboardRefresh();
    }
  }, [queueDashboardRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate stored password on mount
  useEffect(() => {
    if (!dmPassword) return;
    getDmParty(dmPassword)
      .then(data => {
        setParty(data);
        setAuthed(true);
      })
      .catch(() => {
        sessionStorage.removeItem("dnd_dm_password");
        setDmPassword("");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Adaptive polling
  useEffect(() => {
    if (!authed) return;

    let timeoutId = null;
    let stopped = false;

    const getDelay = () =>
      document.visibilityState === "visible" && document.hasFocus()
        ? ACTIVE_POLL_MS
        : BACKGROUND_POLL_MS;

    const scheduleNext = () => {
      if (stopped) return;
      timeoutId = setTimeout(async () => {
        await fetchDashboardData({ background: true });
        scheduleNext();
      }, getDelay());
    };

    const reschedule = () => {
      clearTimeout(timeoutId);
      scheduleNext();
    };

    fetchDashboardData({ background: true, force: true });
    scheduleNext();
    document.addEventListener("visibilitychange", reschedule);
    window.addEventListener("focus", reschedule);
    window.addEventListener("blur", reschedule);

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", reschedule);
      window.removeEventListener("focus", reschedule);
      window.removeEventListener("blur", reschedule);
    };
  }, [authed, fetchDashboardData]);

  useEffect(() => () => clearTimeout(refreshTimerRef.current), []);

  function handleLoginSuccess(pw) {
    setDmPassword(pw);
    setAuthed(true);
  }

  function handleEndSession() {
    sessionStorage.removeItem("dnd_dm_password");
    setDmPassword("");
    setAuthed(false);
    clearTimeout(refreshTimerRef.current);
  }

  async function doLongRest() {
    setConfirmDialog(null);
    await Promise.all(
      party.map(char =>
        patchSession(char.slug, {
          hpCurrent: char.hpMax ?? char.hp ?? 0,
          spellSlots: Array.isArray(char.spellSlots)
            ? char.spellSlots.map(s => ({ ...s, used: 0 }))
            : char.spellSlots,
        }, dmPassword)
      )
    );
    setRestNotice("Long rest applied — all HP and spell slots restored.");
    setTimeout(() => setRestNotice(""), 4000);
    queueDashboardRefresh(0);
  }

  async function doShortRest() {
    setConfirmDialog(null);
    await Promise.all(
      party.map(char =>
        patchSession(char.slug, {
          spellSlots: Array.isArray(char.spellSlots)
            ? char.spellSlots.map(s => s.isPactMagic ? { ...s, used: 0 } : s)
            : char.spellSlots,
        }, dmPassword)
      )
    );
    setRestNotice("Short rest applied — Pact Magic slots restored.");
    setTimeout(() => setRestNotice(""), 4000);
    queueDashboardRefresh(0);
  }

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt onSuccess={handleLoginSuccess} />
      </PalCtx.Provider>
    );
  }

  const btnStyle = {
    background: "rgba(18,32,48,0.5)",
    border: `1px solid ${pal.accent}`,
    borderRadius: 3,
    color: pal.accentBright,
    fontFamily: pal.fontUI,
    fontSize: 12,
    letterSpacing: "0.14em",
    padding: "7px 16px",
    cursor: "pointer",
  };

  const btnSecondary = {
    ...btnStyle,
    background: "transparent",
    borderColor: "rgba(100,130,160,0.32)",
    color: pal.textMuted,
  };

  return (
    <PalCtx.Provider value={pal}>
    <div style={{
      background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%), ${pal.bg}`,
      minHeight: "100vh",
      color: pal.text,
      fontFamily: pal.fontBody,
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "14px 24px",
        borderBottom: `1px solid rgba(100,130,160,0.32)`,
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(13,15,20,0.95)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}>
        <div>
          <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, letterSpacing: "0.12em", color: pal.accentBright }}>
            Campaign
          </div>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted }}>
            {party.length > 0 ? `${party.length} player${party.length !== 1 ? "s" : ""}` : "Loading…"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
          {/* Theme picker */}
          <select
            value={palKey}
            onChange={e => {
              const k = e.target.value;
              setPalKey(k);
              sessionStorage.setItem("dnd_dm_palette", k);
            }}
            style={{
              background: "rgba(18,32,48,0.6)",
              border: `1px solid rgba(100,130,160,0.32)`,
              borderRadius: 3,
              color: pal.textMuted,
              fontFamily: pal.fontUI,
              fontSize: 11,
              letterSpacing: "0.1em",
              padding: "5px 8px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {Object.keys(PALETTES).map(k => (
              <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
            ))}
          </select>

          {restNotice && (
            <span style={{ fontFamily: pal.fontUI, fontSize: 11, color: "#88c888", letterSpacing: "0.08em" }}>{restNotice}</span>
          )}

          <button
            style={{ ...btnSecondary, borderColor: "rgba(192,96,96,0.4)", color: "#c06060" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#c06060"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(192,96,96,0.4)"; }}
            onClick={handleEndSession}
          >End Session</button>
        </div>
      </div>

      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "12px 24px 0",
      }}>
        <Link
          to="/"
          style={{
            fontFamily: pal.fontUI,
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: pal.textMuted,
            textDecoration: "none",
            display: "inline-block",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = pal.accentBright; }}
          onMouseLeave={e => { e.currentTarget.style.color = pal.textMuted; }}
        >← Character Library</Link>
      </div>

      {/* Dashboard layout */}
      <div
        className="dm-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px 300px",
          gap: 0,
          maxWidth: 1400,
          margin: "0 auto",
          padding: 24,
          alignItems: "start",
        }}
      >
        {/* Left: party cards */}
        <div className="dm-party-col" style={{ paddingRight: 20 }}>
          <div style={{
            fontFamily: pal.fontUI,
            fontSize: 11,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: pal.textMuted,
            marginBottom: 14,
          }}>Party</div>

          {(() => {
            const sortedEntries = [...(initiative.entries || [])].sort((a, b) => b.initiative - a.initiative);
            const activeEntry = sortedEntries[initiative.activeTurnIndex ?? 0];
            const activeTurnSlug = activeEntry?.slug ?? null;
            return party.length === 0 ? (
              <div style={{ fontFamily: pal.fontUI, fontSize: 13, color: pal.textMuted, padding: "20px 0" }}>
                No characters found.
              </div>
            ) : (
              party.map(char => (
                <CharacterCard
                  key={char.slug}
                  char={char}
                  dmPassword={dmPassword}
                  onUpdate={handleCardUpdate}
                  onRegisterOpen={handleRegisterOpen}
                  isActiveTurn={activeTurnSlug === char.slug}
                />
              ))
            );
          })()}

          {/* Party-wide rest (also in toolbar above, duplicated here per design) */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontFamily: pal.fontUI,
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: pal.textMuted,
              marginBottom: 10,
            }}>Party-Wide Actions</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                {
                  label: "◑ Short Rest — Reset Pact Magic",
                  action: () => setConfirmDialog({
                    title: "Short Rest",
                    message: "Reset Pact Magic (Warlock) spell slots for all characters. Standard spell slots and HP are not affected.",
                    onConfirm: doShortRest,
                  }),
                },
                {
                  label: "⏾ Long Rest — Reset All Slots + HP",
                  action: () => setConfirmDialog({
                    title: "Long Rest",
                    message: "Reset all spell slots and restore all characters to max HP. This cannot be undone.",
                    onConfirm: doLongRest,
                  }),
                },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: `1px solid rgba(100,130,160,0.32)`,
                    borderRadius: 4,
                    color: pal.textMuted,
                    fontFamily: pal.fontUI,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    padding: "8px 0",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.color = pal.accentBright; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.color = pal.textMuted; }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Dice roller — collapsible, bottom of party column */}
          <DmDiceRoller
            pal={pal}
            party={party.map(c => ({ slug: c.slug, name: c.name, palette: c.palette }))}
            npcs={(npcCombat.npcs || []).map(n => ({ id: n.id, name: n.name }))}
            onApplyDamage={handleApplyDamage}
            onApplyNpcDamage={handleApplyNpcDamage}
          />
        </div>

        {/* Middle: NPC combat tracker */}
        <NpcCombatSection
          npcCombat={npcCombat}
          initiative={initiative}
          dmPassword={dmPassword}
          onUpdate={() => queueDashboardRefresh(0)}
        />

        {/* Right: initiative tracker */}
        <InitiativeTracker
          initiative={initiative}
          party={party}
          npcCombat={npcCombat}
          onCommitInitiative={commitInitiativeUpdate}
          onPromoteToNpc={handlePromoteToNpc}
        />
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
    </PalCtx.Provider>
  );
}
