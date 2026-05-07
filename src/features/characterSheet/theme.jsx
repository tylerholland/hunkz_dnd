import { useEffect } from "react";

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Cinzel:wght@400;500&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 16px; }

  html, body, #root {
    min-height: 100vh;
    width: 100%;
  }

  body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }

  button { font-family: inherit; cursor: pointer; }
  textarea, input, select { font-family: inherit; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 3px; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .dnd-spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: currentColor;
    animation: spin 0.7s linear infinite;
  }

  select {
    background: var(--input-bg, rgba(255,255,255,0.05));
    color: var(--input-color, #fff);
    border: 1px solid var(--input-border, rgba(255,255,255,0.18));
    border-radius: 3px;
  }

  select option {
    background: var(--input-bg, rgba(255,255,255,0.05));
    color: var(--input-color, #fff);
  }

  select option:hover,
  select option:focus {
    background: var(--input-highlight, rgba(255,255,255,0.12));
  }

.character-details-grid {
  display: grid;
  gap: 10px 28px;
  justify-items: center;
  grid-template-columns: repeat(3, 1fr);
}

.loadout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 32px;
}

@media (max-width: 560px) {
  .loadout-grid {
    grid-template-columns: 1fr;
  }
}

.phoenetic {
  color: var(--phoenetic-color, currentColor);
  font-style: italic;
  opacity: 0.85;
}

@media (max-width: 600px) {
  .character-details-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;

export function useCharacterSheetGlobalStyles() {
  useEffect(() => {
    const id = "char-sheet-global";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = GLOBAL_CSS;
    document.head.prepend(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);
}

export function renderInline(text) {
  return text.split(/(\*[^*]+\*)/g).map((part, index) =>
    part.startsWith("*") && part.endsWith("*")
      ? <em className="phoenetic" key={index}>{part.slice(1, -1)}</em>
      : part
  );
}

export const PALETTES = {
  ember: {
    name: "Ember",
    bg: "#120d0a", surface: "rgba(50,28,14,0.55)", surfaceSolid: "#2a160a",
    border: "rgba(160,100,55,0.22)", accent: "#a06840", accentBright: "#c89060",
    accentDim: "#4a2e12", text: "#d4c4b0", textBody: "#b8a888", textMuted: "#6a4830",
    glow1: "rgba(100,45,10,0.35)", glow2: "rgba(70,30,5,0.25)", gem: "#c8904c", gemLow: "#4a3020",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  ocean: {
    name: "Ocean",
    bg: "#0d0f14", surface: "rgba(18,32,48,0.55)", surfaceSolid: "#111e2c",
    border: "rgba(100,130,160,0.18)", accent: "#6a8fa8", accentBright: "#a0c0d0",
    accentDim: "#1e3a4e", text: "#c8bfaf", textBody: "#b0a898", textMuted: "#3a5a6a",
    glow1: "rgba(20,45,80,0.4)", glow2: "rgba(15,35,60,0.3)", gem: "#8ab4c8", gemLow: "#2a3a4a",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  forest: {
    name: "Forest",
    bg: "#090e0b", surface: "rgba(12,30,16,0.55)", surfaceSolid: "#0d1e10",
    border: "rgba(75,125,75,0.2)", accent: "#5a8a60", accentBright: "#88b888",
    accentDim: "#1a3a1c", text: "#c0cdb8", textBody: "#a8b898", textMuted: "#3a5a3c",
    glow1: "rgba(15,55,20,0.4)", glow2: "rgba(10,40,15,0.28)", gem: "#78b878", gemLow: "#1e3a20",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  ash: {
    name: "Ash",
    bg: "#0e0e0e", surface: "rgba(28,28,28,0.55)", surfaceSolid: "#1c1c1c",
    border: "rgba(120,120,120,0.2)", accent: "#888888", accentBright: "#b8b8b8",
    accentDim: "#2a2a2a", text: "#d0ccc8", textBody: "#a8a4a0", textMuted: "#505050",
    glow1: "rgba(50,50,50,0.28)", glow2: "rgba(35,35,35,0.2)", gem: "#a0a0a0", gemLow: "#303030",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  hearthstone: {
    name: "Hearthstone",
    bg: "#110a08", surface: "rgba(48,22,14,0.58)", surfaceSolid: "#261008",
    border: "rgba(160,80,50,0.2)", accent: "#a05040", accentBright: "#cc8060",
    accentDim: "#3a1608", text: "#d8c8b8", textBody: "#b8a090", textMuted: "#6a3828",
    glow1: "rgba(110,35,10,0.38)", glow2: "rgba(70,20,5,0.22)", gem: "#cc8060", gemLow: "#3a1e12",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  ironwood: {
    name: "Ironwood",
    bg: "#0c0608", surface: "rgba(38,14,18,0.58)", surfaceSolid: "#1c0a0e",
    border: "rgba(130,55,65,0.22)", accent: "#8a4450", accentBright: "#b87080",
    accentDim: "#2e0e14", text: "#cec0bc", textBody: "#a89090", textMuted: "#5a2e34",
    glow1: "rgba(90,20,28,0.38)", glow2: "rgba(55,10,16,0.24)", gem: "#b87080", gemLow: "#2e1418",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  hoarfrost: {
    name: "Hoarfrost",
    bg: "#090c12", surface: "rgba(18,26,44,0.55)", surfaceSolid: "#101828",
    border: "rgba(160,185,215,0.18)", accent: "#8aaac8", accentBright: "#c8dcea",
    accentDim: "#182234", text: "#dce8f0", textBody: "#b0c4d8", textMuted: "#3a5068",
    glow1: "rgba(40,70,120,0.28)", glow2: "rgba(20,45,90,0.18)", gem: "#c8dcea", gemLow: "#1e2e42",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  nightwood: {
    name: "Nightwood",
    bg: "#050d09", surface: "rgba(8,28,16,0.58)", surfaceSolid: "#081a0e",
    border: "rgba(40,140,90,0.18)", accent: "#2e8a58", accentBright: "#58c890",
    accentDim: "#081e10", text: "#b8d4c0", textBody: "#90b89a", textMuted: "#1e5034",
    glow1: "rgba(10,80,38,0.32)", glow2: "rgba(5,55,24,0.2)", gem: "#58c890", gemLow: "#0e2818",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  pitch: {
    name: "Pitch",
    bg: "#060606", surface: "rgba(14,14,16,0.7)", surfaceSolid: "#0e0e10",
    border: "rgba(60,75,70,0.22)", accent: "#3a5048", accentBright: "#607868",
    accentDim: "#121816", text: "#c0c8c0", textBody: "#8a9890", textMuted: "#303c36",
    glow1: "rgba(14,30,22,0.3)", glow2: "rgba(8,20,14,0.18)", gem: "#607868", gemLow: "#161e1a",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
  vellum: {
    name: "Vellum",
    bg: "#f5f0e8", surface: "rgba(220,208,185,0.5)", surfaceSolid: "#e8e0cc",
    border: "rgba(140,110,70,0.22)", accent: "#7a5c30", accentBright: "#4a3418",
    accentDim: "rgba(140,110,70,0.15)", text: "#2a2018", textBody: "#3c2e1c", textMuted: "#9a8060",
    glow1: "rgba(180,155,100,0.25)", glow2: "rgba(160,135,85,0.15)", gem: "#4a3418", gemLow: "rgba(140,110,70,0.18)",
    fontDisplay: "'Cinzel', 'Palatino Linotype', Georgia, serif",
    fontBody: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    fontUI: "'IM Fell English', Georgia, serif",
  },
};
