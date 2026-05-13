import { createContext, useEffect } from "react";
import { PALETTES } from "../characterSheet/theme";
export { debounce } from "../../lib/liveSync";
export { useHoldToRepeat } from "../../lib/useHoldToRepeat";

export const PalCtx = createContext(PALETTES.ocean);

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

export const VELLUM_CARD_MODE = {
  ink: "#332517",
  paper: "#fbf7f0",
  paperAlt: "#f3ebde",
  line: "#d4c2a3",
};

export const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

export const DAMAGE_PRESETS = [3, 5, 8, 10, 15, 20];

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((ch) => ch + ch).join("")
    : clean;
  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export function mixHex(a, b, ratioB = 0.5) {
  const ratioA = 1 - ratioB;
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mixed = {
    r: Math.round(ca.r * ratioA + cb.r * ratioB),
    g: Math.round(ca.g * ratioA + cb.g * ratioB),
    b: Math.round(ca.b * ratioA + cb.b * ratioB),
  };
  return `#${[mixed.r, mixed.g, mixed.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getActiveTurnSurface(baseSurface, accent, topAlpha = 0.22, bottomAlpha = 0.08) {
  return `linear-gradient(180deg, ${withAlpha(accent, topAlpha)} 0%, ${withAlpha(accent, bottomAlpha)} 58%, ${baseSurface} 100%)`;
}

export function getPartyCardActiveSurface(basePal, dashboardPal, cardPal) {
  if (basePal === PALETTES.vellum && dashboardPal !== PALETTES.vellum) {
    const brightTop = mixHex(cardPal.accentBright, "#fff6df", 0.42);
    const warmMid = mixHex(cardPal.accent, "#f2dfb6", 0.34);
    return `linear-gradient(180deg, ${withAlpha(brightTop, 0.48)} 0%, ${withAlpha(warmMid, 0.28)} 46%, ${cardPal.surfaceSolid} 100%)`;
  }

  return getActiveTurnSurface(cardPal.surfaceSolid, cardPal.accent, 0.18, 0.07);
}

export function getPartyCardPalette(basePal, dashboardPal) {
  if (basePal === PALETTES.vellum && dashboardPal !== PALETTES.vellum) {
    const darkBase = dashboardPal.surfaceSolid || dashboardPal.bg || "#111111";
    const liftedInk = "#f2e4c6";
    const liftedInkSoft = "#d4c09a";
    const warmBorder = mixHex(basePal.accent, liftedInkSoft, 0.38);
    const translucentPaper = mixHex(basePal.surfaceSolid, darkBase, 0.26);

    return {
      ...basePal,
      surface: withAlpha(translucentPaper, 0.17),
      surfaceSolid: withAlpha(mixHex(basePal.surfaceSolid, darkBase, 0.18), 0.5),
      border: withAlpha(warmBorder, 0.44),
      accent: mixHex(basePal.accent, liftedInkSoft, 0.24),
      accentBright: mixHex(basePal.accentBright, liftedInk, 0.64),
      accentDim: withAlpha(mixHex(basePal.accent, liftedInkSoft, 0.46), 0.24),
      text: mixHex(basePal.text, liftedInk, 0.74),
      textBody: mixHex(basePal.textBody || basePal.text, liftedInk, 0.68),
      textMuted: mixHex(basePal.textMuted, liftedInkSoft, 0.54),
      gem: mixHex(basePal.gem || basePal.accentBright, liftedInk, 0.58),
      gemLow: withAlpha(mixHex(basePal.gemLow || basePal.accent, darkBase, 0.18), 0.56),
      uiBorder: withAlpha(warmBorder, 0.46),
    };
  }

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

export function useDashboardStyles() {
  useEffect(() => {
    const id = "dm-dashboard-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = DASHBOARD_CSS;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);
}

export function conditionStyle(cond) {
  const map = {
    Poisoned: { bg: "rgba(160,70,70,0.15)", border: "rgba(192,96,96,0.38)", color: "#d88c8c" },
    Blinded: { bg: "rgba(160,70,70,0.15)", border: "rgba(192,96,96,0.38)", color: "#d88c8c" },
    Stunned: { bg: "rgba(160,70,70,0.15)", border: "rgba(192,96,96,0.38)", color: "#d88c8c" },
    Paralyzed: { bg: "rgba(160,70,70,0.15)", border: "rgba(192,96,96,0.38)", color: "#d88c8c" },
    Petrified: { bg: "rgba(160,70,70,0.15)", border: "rgba(192,96,96,0.38)", color: "#d88c8c" },
    Prone: { bg: "rgba(200,144,64,0.14)", border: "rgba(200,144,64,0.38)", color: "#d0aa70" },
    Grappled: { bg: "rgba(200,144,64,0.14)", border: "rgba(200,144,64,0.38)", color: "#d0aa70" },
    Restrained: { bg: "rgba(200,144,64,0.14)", border: "rgba(200,144,64,0.38)", color: "#d0aa70" },
    Exhaustion: { bg: "rgba(200,144,64,0.14)", border: "rgba(200,144,64,0.38)", color: "#d0aa70" },
    Deafened: { bg: "rgba(88,120,180,0.14)", border: "rgba(110,146,210,0.35)", color: "#9db8ea" },
    Frightened: { bg: "rgba(130,92,186,0.15)", border: "rgba(158,118,214,0.36)", color: "#c2a0ec" },
    Charmed: { bg: "rgba(130,92,186,0.15)", border: "rgba(158,118,214,0.36)", color: "#c2a0ec" },
    Incapacitated: { bg: "rgba(130,92,186,0.15)", border: "rgba(158,118,214,0.36)", color: "#c2a0ec" },
    Unconscious: { bg: "rgba(160,70,70,0.15)", border: "rgba(192,96,96,0.38)", color: "#d88c8c" },
  };
  return map[cond] || { bg: "rgba(100,130,160,0.14)", border: "rgba(100,130,160,0.35)", color: "#a0c0d0" };
}

export function hpBarColor(pct) {
  if (pct > 0.5) return "linear-gradient(90deg, #3a7a40 0%, #58b860 100%)";
  if (pct > 0.2) return "linear-gradient(90deg, #a06020 0%, #d08030 100%)";
  return "linear-gradient(90deg, #8a2020 0%, #c06060 100%)";
}


export function initiativesEqual(a, b) {
  if (!a || !b) return false;
  if ((a.activeTurnIndex ?? 0) !== (b.activeTurnIndex ?? 0)) return false;
  const aEntries = a.entries || [];
  const bEntries = b.entries || [];
  if (aEntries.length !== bEntries.length) return false;
  return JSON.stringify(aEntries) === JSON.stringify(bEntries);
}
