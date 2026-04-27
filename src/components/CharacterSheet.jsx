import { useState, useEffect, useRef } from "react";

// ── Global styles ─────────────────────────────────────────────────────────────
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

function useGlobalStyles() {
  useEffect(() => {
    const id = "char-sheet-global";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = GLOBAL_CSS;
    document.head.prepend(style);
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, []);
}

function renderInline(text) {
  return text.split(/(\*[^*]+\*)/g).map((part, index) =>
    part.startsWith("*") && part.endsWith("*")
      ? <em className="phoenetic" key={index}>{part.slice(1, -1)}</em>
      : part
  );
}

// ── Palettes ──────────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const modOf  = s => Math.floor((s - 10) / 2);
const fmtMod = m => m >= 0 ? `+${m}` : `${m}`; // Used to add the modifier to Ability Scores. Not implemented yet
const uid    = () => "id" + Date.now() + Math.random().toString(36).slice(2, 7);

const RACE_OPTIONS = [
  "Human", "Elf", "Night Elf", "Wood Elf", "High Elf", "Drow", "Eladrin",
  "Dwarf", "Halfling", "Half-Elf", "Half-Orc", "Gnome", "Tiefling", "Dragonborn",
  "Aasimar", "Genasi", "Goliath", "Firbolg", "Kenku", "Tabaxi", "Tortle",
  "Triton", "Yuan-ti Pureblood", "Bugbear", "Goblin", "Hobgoblin", "Lizardfolk", "Orc",
];

const CLASS_OPTIONS = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin",
  "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard", "Artificer",
];

const ALIGNMENT_OPTIONS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
];

const BACKGROUND_OPTIONS = [
  "Acolyte", "Charlatan", "Criminal", "Entertainer", "Folk Hero", "Guild Artisan",
  "Hermit", "Noble", "Outlander", "Sage", "Sailor", "Soldier", "Urchin",
  "Investigator", "Pirate", "Urban Bounty Hunter",
];

const SUBCLASS_OPTIONS = {
  Barbarian: ["Berserker", "Totem Warrior", "Ancestral Guardian", "Storm Herald", "Zealot", "Wild Magic", "Beast"],
  Bard: ["College of Lore", "College of Valor", "College of Glamour", "College of Swords", "College of Whispers", "College of Eloquence", "College of Creation", "College of Spirits"],
  Cleric: ["Life", "Light", "Nature", "Tempest", "Trickery", "War", "Knowledge", "Grave", "Order", "Peace", "Forge", "Twilight"],
  Druid: ["Circle of the Land", "Circle of the Moon", "Circle of Dreams", "Circle of the Shepherd", "Circle of Spores", "Circle of Stars", "Circle of Wildfire"],
  Fighter: ["Champion", "Battle Master", "Eldritch Knight", "Purple Dragon Knight", "Samurai", "Cavalier", "Echo Knight", "Arcane Archer", "Psi Warrior"],
  Monk: ["Way of the Open Hand", "Way of Shadow", "Way of the Four Elements", "Way of the Kensei", "Way of the Drunken Master", "Way of the Sun Soul", "Way of the Astral Self"],
  Paladin: ["Oath of Devotion", "Oath of the Ancients", "Oath of Vengeance", "Oathbreaker", "Oath of Conquest", "Oath of Redemption", "Oath of the Crown", "Oath of the Watchers"],
  Ranger: ["Hunter", "Beast Master", "Gloom Stalker", "Horizon Walker", "Monster Slayer", "Swarmkeeper", "Fey Wanderer", "Drakewarden"],
  Rogue: ["Thief", "Assassin", "Arcane Trickster", "Swashbuckler", "Mastermind", "Scout", "Soulknife", "Phantom"],
  Sorcerer: ["Draconic Bloodline", "Wild Magic", "Divine Soul", "Storm Sorcery", "Shadow Sorcerer", "Aberrant Mind", "Clockwork Soul"],
  Warlock: ["Archfey", "Fiend", "Great Old One", "Celestial", "Hexblade", "Fathomless", "Genie", "Undead", "Seeker"],
  Wizard: ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation", "War Magic", "Bladesinging", "Chronurgy", "Graviturgy"],
  Artificer: ["Alchemist", "Artillerist", "Battle Smith", "Armorer"],
};

const ALL_SUBCLASS_OPTIONS = [...new Set(Object.values(SUBCLASS_OPTIONS).flat())];

const HR = ({ color }) => <div style={{ borderTop: `1px solid ${color}`, margin: "22px 0" }} />;

const DragHandle = ({ color }) => (
  <svg width="12" height="18" viewBox="0 0 12 18" fill={color} style={{ opacity: 0.45, flexShrink: 0 }}>
    <circle cx="4" cy="3"  r="1.4" /><circle cx="8" cy="3"  r="1.4" />
    <circle cx="4" cy="9"  r="1.4" /><circle cx="8" cy="9"  r="1.4" />
    <circle cx="4" cy="15" r="1.4" /><circle cx="8" cy="15" r="1.4" />
  </svg>
);

// ── Default blank character ───────────────────────────────────────────────────
const BLANK_CHARACTER = {
  name: "", nameAlt: "", pronunciation: "",
  race: "", charClass: "", subclass: "",
  alignment: "", background: "", origin: "",
  level: 1, portrait: "", tagline: "", palette: "ember",
  stats: [
    { stat: "Strength",     score: 10, note: "" },
    { stat: "Dexterity",    score: 10, note: "" },
    { stat: "Constitution", score: 10, note: "" },
    { stat: "Wisdom",       score: 10, note: "" },
    { stat: "Intelligence", score: 10, note: "" },
    { stat: "Charisma",     score: 10, note: "" },
  ],
  spells: [],
  inPlay: [],
  collections: [
    {
      id: uid(),
      label: "Character",
      sections: [
        { id: uid(), title: "About", type: "prose", content: "" },
        { id: uid(), title: "Appearance", type: "prose", content: "" },
      ],
    },
    {
      id: uid(),
      label: "History",
      sections: [],
    },
  ],
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CharacterSheet({ initialData }) {
  useGlobalStyles();

  const [mode, setMode]     = useState("view");
  const [char, setChar]     = useState(() => initialData || BLANK_CHARACTER);
  const [active, setActive] = useState(() => {
    const first = (initialData || BLANK_CHARACTER).collections?.[0]?.sections?.[0];
    return first ? { collectionId: (initialData || BLANK_CHARACTER).collections[0].id, sectionId: first.id } : null;
  });

  // drag state for history reorder within edit
  const [dragInfo, setDragInfo] = useState(null); // { collectionId, fromIdx }
  const [dragOver, setDragOver] = useState(null); // { collectionId, toIdx }

  const fileRef       = useRef();
  const importRef     = useRef();

  const pal = PALETTES[char.palette] || PALETTES.ember;
  const isVellum = pal.name === "Vellum";

  // Sync incoming prop changes (when route changes)
  useEffect(() => {
    if (initialData) {
      setChar(initialData);
      const first = initialData.collections?.[0]?.sections?.[0];
      setActive(first ? { collectionId: initialData.collections[0].id, sectionId: first.id } : null);
    }
  }, [initialData]);

  // Ensure active tab stays valid when collections change
  useEffect(() => {
    if (!active) return;
    const col = char.collections.find(c => c.id === active.collectionId);
    if (!col || !col.sections.find(s => s.id === active.sectionId)) {
      const first = char.collections[0]?.sections[0];
      setActive(first ? { collectionId: char.collections[0].id, sectionId: first.id } : null);
    }
  }, [char.collections]);

  // ── Updaters ────────────────────────────────────────────────────────────────
  const update     = (field, val) => setChar(c => ({ ...c, [field]: val }));
  const updateStat = (i, field, val) => setChar(c => {
    const stats = [...c.stats];
    stats[i] = { ...stats[i], [field]: field === "score" ? (parseInt(val) || 0) : val };
    return { ...c, stats };
  });

  // Collections
  const updateCollection = (cid, field, val) => setChar(c => ({
    ...c, collections: c.collections.map(col => col.id === cid ? { ...col, [field]: val } : col),
  }));
  const addCollection = () => {
    const id = uid();
    setChar(c => ({ ...c, collections: [...c.collections, { id, label: "New Collection", sections: [] }] }));
  };
  const removeCollection = (cid) => {
    setChar(c => ({ ...c, collections: c.collections.filter(col => col.id !== cid) }));
  };

  // Sections
  const updateSection = (cid, sid, field, val) => setChar(c => ({
    ...c,
    collections: c.collections.map(col =>
      col.id !== cid ? col : {
        ...col,
        sections: col.sections.map(s => s.id !== sid ? s : { ...s, [field]: val }),
      }
    ),
  }));

  const addSection = (cid, type = "prose") => {
    const id = uid();
    const newSection = type === "list"
      ? { id, title: "New Section", type: "list", items: [] }
      : { id, title: "New Section", type: "prose", content: "" };
    setChar(c => ({
      ...c,
      collections: c.collections.map(col =>
        col.id !== cid ? col : { ...col, sections: [...col.sections, newSection] }
      ),
    }));
    setTimeout(() => setActive({ collectionId: cid, sectionId: id }), 50);
  };

  const removeSection = (cid, sid) => {
    setChar(c => ({
      ...c,
      collections: c.collections.map(col =>
        col.id !== cid ? col : { ...col, sections: col.sections.filter(s => s.id !== sid) }
      ),
    }));
    setActive(null);
  };

  // List item updaters (for list-type sections)
  const updateListItem = (cid, sid, i, val) => setChar(c => ({
    ...c,
    collections: c.collections.map(col =>
      col.id !== cid ? col : {
        ...col,
        sections: col.sections.map(s => {
          if (s.id !== sid) return s;
          const items = [...s.items]; items[i] = val; return { ...s, items };
        }),
      }
    ),
  }));
  const addListItem    = (cid, sid) => setChar(c => ({
    ...c,
    collections: c.collections.map(col =>
      col.id !== cid ? col : {
        ...col,
        sections: col.sections.map(s => s.id !== sid ? s : { ...s, items: [...s.items, ""] }),
      }
    ),
  }));
  const removeListItem = (cid, sid, i) => setChar(c => ({
    ...c,
    collections: c.collections.map(col =>
      col.id !== cid ? col : {
        ...col,
        sections: col.sections.map(s => s.id !== sid ? s : { ...s, items: s.items.filter((_, idx) => idx !== i) }),
      }
    ),
  }));

  // In Play
  const updateInPlay = (i, val) => setChar(c => { const a = [...c.inPlay]; a[i] = val; return { ...c, inPlay: a }; });
  const addInPlay    = ()       => setChar(c => ({ ...c, inPlay: [...c.inPlay, ""] }));
  const removeInPlay = (i)      => setChar(c => ({ ...c, inPlay: c.inPlay.filter((_, idx) => idx !== i) }));

  // Drag & drop sections within a collection
  const onDragStart = (cid, i)    => setDragInfo({ collectionId: cid, fromIdx: i });
  const onDragOver  = (e, cid, i) => { e.preventDefault(); setDragOver({ collectionId: cid, toIdx: i }); };
  const onDrop      = (cid, i)    => {
    if (!dragInfo || dragInfo.collectionId !== cid || dragInfo.fromIdx === i) {
      setDragInfo(null); setDragOver(null); return;
    }
    setChar(c => ({
      ...c,
      collections: c.collections.map(col => {
        if (col.id !== cid) return col;
        const secs = [...col.sections];
        const [moved] = secs.splice(dragInfo.fromIdx, 1);
        secs.splice(i, 0, moved);
        return { ...col, sections: secs };
      }),
    }));
    setDragInfo(null); setDragOver(null);
  };

  // Portrait
  const handlePortrait = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => update("portrait", ev.target.result);
    reader.readAsDataURL(file);
  };

  // ── Import / Export ─────────────────────────────────────────────────────────
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(char, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${(char.name || "character").toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        setChar(data);
        const first = data.collections?.[0]?.sections?.[0];
        setActive(first ? { collectionId: data.collections[0].id, sectionId: first.id } : null);
        setMode("view");
      } catch {
        alert("Could not parse JSON file. Please check the file and try again.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Style helpers ────────────────────────────────────────────────────────────
  const inputBg = pal.surface;
  const inputStyle = {
    background: inputBg, border: `1px solid ${pal.border}`, borderRadius: 3,
    color: pal.text, fontFamily: pal.fontBody, fontSize: 16,
    padding: "7px 11px", width: "100%", outline: "none", transition: "border-color 0.15s",
  };
  const taStyle  = { ...inputStyle, resize: "vertical", minHeight: 130, lineHeight: 1.75 };
  const lbl      = {
    fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.22em",
    color: pal.textMuted, textTransform: "uppercase", display: "block", marginBottom: 6,
  };
  const secHead  = {
    fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.25em",
    color: pal.textMuted, textTransform: "uppercase", marginBottom: 16,
  };
  const rootWrap = {
    position: "relative", minHeight: "100vh", width: "100%",
    backgroundColor: pal.bg, color: pal.text, fontFamily: pal.fontBody,
    fontSize: 16, lineHeight: 1.7, overflowX: "hidden",
    "--phoenetic-color": pal.accent,
    "--input-bg": inputBg,
    "--input-border": pal.border,
    "--input-color": pal.text,
    "--input-highlight": pal.surface,
  };
  const navBtn = (isActive) => ({
    padding: "6px 16px", fontFamily: pal.fontUI, fontSize: 14,
    letterSpacing: "0.12em", textTransform: "uppercase",
    background: isActive ? pal.accentDim : "transparent",
    border: `1px solid ${isActive ? pal.accent : pal.border}`,
    borderRadius: 2, color: isActive ? pal.accentBright : pal.textMuted,
    cursor: "pointer", transition: "all 0.18s",
  });

  // ══════════════════════════════════════════════════════════════════════════
  // EDIT MODE
  // ══════════════════════════════════════════════════════════════════════════
  if (mode === "edit") {
    return (
      <div style={rootWrap}>
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse at 30% 20%, ${pal.glow1} 0%, transparent 55%),
                       radial-gradient(ellipse at 75% 80%, ${pal.glow2} 0%, transparent 50%)`,
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "36px 28px 100px" }}>

          {/* Header bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 36, paddingBottom: 22, borderBottom: `1px solid ${pal.border}`,
            flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ ...secHead, marginBottom: 4 }}>Character Sheet Editor</div>
              <div style={{ fontFamily: pal.fontDisplay, fontSize: 24, color: pal.Text, letterSpacing: "0.04em" }}>
                {char.name || "Unnamed Character"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
              <button onClick={() => importRef.current.click()} style={{ ...inputStyle, width: "auto", padding: "8px 16px", fontSize: 14 }}>
                Import JSON
              </button>
              <button onClick={exportJSON} style={{ ...inputStyle, width: "auto", padding: "8px 16px", fontSize: 14 }}>
                Export JSON
              </button>
              <button onClick={() => setMode("view")} style={{
                ...inputStyle, width: "auto", padding: "9px 22px",
                background: pal.accentDim, borderColor: pal.accent,
                color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 15, letterSpacing: "0.08em",
              }}>
                View Sheet →
              </button>
            </div>
          </div>

          {/* Palette */}
          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Color Theme</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {Object.entries(PALETTES).map(([key, p]) => (
                <button key={key} onClick={() => update("palette", key)} style={{
                  padding: "7px 20px", borderRadius: 3, fontSize: 13,
                  fontFamily: p.fontUI, letterSpacing: "0.05em",
                  background: char.palette === key ? p.accentDim : (isVellum ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"),
                  border: `1px solid ${char.palette === key ? p.accent : pal.border}`,
                  color: char.palette === key ? p.accentBright : pal.textMuted,
                  transition: "all 0.15s",
                }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Portrait */}
          <div style={{ marginBottom: 20 }}>
            <div style={secHead}>Portrait Image</div>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              {char.portrait && (
                <img src={char.portrait} alt="portrait" style={{
                  width: 90, height: 90, objectFit: "cover",
                  borderRadius: 4, border: `1px solid ${pal.border}`, flexShrink: 0,
                }} />
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePortrait} style={{ display: "none" }} />
                <button onClick={() => fileRef.current.click()} style={{ ...inputStyle, width: "auto", padding: "8px 18px" }}>
                  {char.portrait ? "Change Image" : "Upload Image"}
                </button>
                {char.portrait && (
                  <button onClick={() => update("portrait", "")} style={{ ...inputStyle, width: "auto", padding: "8px 16px", color: pal.textMuted }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div style={{ marginBottom: 32 }}>
            <label style={lbl}>Portrait Tagline <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(shown beneath portrait image)</span></label>
            <input style={inputStyle} value={char.tagline || ""} onChange={e => update("tagline", e.target.value)} placeholder="A short italicised line shown beneath the portrait…" />
          </div>

          {/* Identity */}
          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Identity</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { field: "name", label: "Character Name", type: "text" },
                { field: "nameAlt", label: "Alias / Epithet", type: "text" },
                { field: "pronunciation", label: "Pronunciation", type: "text" },
                { field: "race", label: "Race", type: "select", options: RACE_OPTIONS },
                { field: "charClass", label: "Class", type: "select", options: CLASS_OPTIONS },
                { field: "subclass", label: "Subclass / Patron", type: "select", options: () => (SUBCLASS_OPTIONS[char.charClass] || ALL_SUBCLASS_OPTIONS) },
                { field: "alignment", label: "Alignment", type: "select", options: ALIGNMENT_OPTIONS },
                { field: "background", label: "Background", type: "select", options: BACKGROUND_OPTIONS },
                { field: "origin", label: "Origin / Homeland", type: "text" },
              ].map(({ field, label, type, options }) => (
                <div key={field}>
                  <label style={lbl}>{label}</label>
                  {type === "select" ? (
                    <select
                      style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", MozAppearance: "none" }}
                      value={char[field] || ""}
                      onChange={e => update(field, e.target.value)}
                    >
                      <option value="">{label}</option>
                      {(typeof options === "function" ? options() : options).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={inputStyle}
                      value={char[field] || ""}
                      onChange={e => update(field, e.target.value)}
                      placeholder={label}
                    />
                  )}
                </div>
              ))}
              <div>
                <label style={lbl}>Level</label>
                <input style={inputStyle} type="number" min={1} max={20}
                  value={char.level || ""} onChange={e => update("level", parseInt(e.target.value) || 1)} />
              </div>
            </div>
          </div>

          {/* Ability Scores */}
          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Ability Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {char.stats.map((s, i) => (
                <div key={i} style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "12px 14px" }}>
                  <input style={{ ...inputStyle, marginBottom: 8, fontSize: 14 }}
                    value={s.stat} onChange={e => updateStat(i, "stat", e.target.value)} placeholder="Stat name" />
                  <input style={{ ...inputStyle, marginBottom: 8, fontSize: 24, textAlign: "center", fontFamily: pal.fontDisplay }}
                    type="number" min={1} max={20} value={s.score} onChange={e => updateStat(i, "score", e.target.value)} />
                  <input style={{ ...inputStyle, fontSize: 14, color: pal.textMuted }}
                    value={s.note} onChange={e => updateStat(i, "note", e.target.value)} placeholder="Short note…" />
                </div>
              ))}
            </div>
          </div>

          {/* Spells */}
          <div style={{ marginBottom: 32 }}>
            <label style={lbl}>Key Spells & Abilities <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(comma-separated)</span></label>
            <input style={inputStyle}
              value={(char.spells || []).join(", ")}
              onChange={e => update("spells", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="Hunter's Mark, Misty Step, Pass Without Trace…"
            />
          </div>

          {/* In Play */}
          <div style={{ marginBottom: 40 }}>
            <div style={secHead}>In Play Traits</div>
            {(char.inPlay || []).map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={inputStyle} value={item} onChange={e => updateInPlay(i, e.target.value)} placeholder="A trait, ability, or behavioural note…" />
                <button onClick={() => removeInPlay(i)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
            <button onClick={addInPlay} style={{ ...inputStyle, width: "auto", padding: "7px 16px", marginTop: 4, color: pal.accentBright, borderStyle: "dashed" }}>
              + Add Trait
            </button>
          </div>

          {/* Collections */}
          <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={secHead}>Collections & Sections</div>
              <button onClick={addCollection} style={{ ...inputStyle, width: "auto", padding: "7px 18px", color: pal.accentBright, borderStyle: "dashed" }}>
                + Add Collection
              </button>
            </div>

            {char.collections.map((col) => (
              <div key={col.id} style={{ marginBottom: 40 }}>
                {/* Collection header */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                  <input
                    style={{ ...inputStyle, fontFamily: pal.fontDisplay, fontSize: 15, letterSpacing: "0.06em", flex: 1 }}
                    value={col.label}
                    onChange={e => updateCollection(col.id, "label", e.target.value)}
                    placeholder="Collection name…"
                  />
                  <button onClick={() => removeCollection(col.id)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                </div>

                {/* Sections */}
                {col.sections.map((s, i) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => onDragStart(col.id, i)}
                    onDragOver={e => onDragOver(e, col.id, i)}
                    onDrop={() => onDrop(col.id, i)}
                    onDragEnd={() => { setDragInfo(null); setDragOver(null); }}
                    style={{
                      background: pal.surface,
                      border: `1px solid ${dragOver?.collectionId === col.id && dragOver?.toIdx === i ? pal.accent : pal.border}`,
                      borderRadius: 4, padding: 14, marginBottom: 10,
                      opacity: dragInfo?.collectionId === col.id && dragInfo?.fromIdx === i ? 0.45 : 1,
                      transition: "border-color 0.15s, opacity 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                      <span style={{ cursor: "grab", paddingTop: 3 }}><DragHandle color={pal.accent} /></span>
                      <input
                        style={{ ...inputStyle, fontFamily: pal.fontDisplay, letterSpacing: "0.04em", flex: 1 }}
                        value={s.title}
                        onChange={e => updateSection(col.id, s.id, "title", e.target.value)}
                        placeholder="Section title…"
                      />
                      {/* Type toggle */}
                      <button
                        onClick={() => updateSection(col.id, s.id, "type", s.type === "prose" ? "list" : "prose")}
                        title="Toggle between prose and list"
                        style={{ ...inputStyle, width: "auto", padding: "6px 12px", fontSize: 11, flexShrink: 0, color: pal.textMuted, letterSpacing: "0.05em" }}
                      >
                        {s.type === "prose" ? "¶ Prose" : "≡ List"}
                      </button>
                      <button onClick={() => removeSection(col.id, s.id)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                    </div>

                    {s.type === "prose" ? (
                      <textarea
                        style={{ ...taStyle, minHeight: 110 }}
                        value={s.content || ""}
                        onChange={e => updateSection(col.id, s.id, "content", e.target.value)}
                        placeholder="Write this section…"
                      />
                    ) : (
                      <div>
                        {(s.items || []).map((item, j) => (
                          <div key={j} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <input style={inputStyle} value={item} onChange={e => updateListItem(col.id, s.id, j, e.target.value)} placeholder="List item…" />
                            <button onClick={() => removeListItem(col.id, s.id, j)} style={{ ...inputStyle, width: 36, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
                          </div>
                        ))}
                        <button onClick={() => addListItem(col.id, s.id)} style={{ ...inputStyle, width: "auto", padding: "6px 14px", marginTop: 4, color: pal.accentBright, borderStyle: "dashed" }}>
                          + Add Item
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add section buttons */}
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button onClick={() => addSection(col.id, "prose")} style={{ ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>
                    + Add Prose Section
                  </button>
                  <button onClick={() => addSection(col.id, "list")} style={{ ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}>
                    + Add List Section
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW MODE
  // ══════════════════════════════════════════════════════════════════════════

  // Find active section data
  const activeCol  = char.collections.find(c => c.id === active?.collectionId);
  const activeSec  = activeCol?.sections.find(s => s.id === active?.sectionId);

  return (
    <div style={rootWrap}>

      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse at 18% 45%, ${pal.glow1} 0%, transparent 55%),
          radial-gradient(ellipse at 82% 18%, ${pal.glow2} 0%, transparent 48%),
          radial-gradient(ellipse at 50% 90%, ${pal.glow2} 0%, transparent 45%)
        `,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 840, margin: "0 auto", padding: "30px 28px 100px" }}>

        {/* Edit + Export buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 40 }}>
          <button onClick={exportJSON} style={{
            background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted,
            fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "5px 14px", borderRadius: 2, cursor: "pointer",
          }}>
            Export JSON
          </button>
          <button onClick={() => setMode("edit")} style={{
            background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted,
            fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "5px 14px", borderRadius: 2, cursor: "pointer",
          }}>
            Edit Character
          </button>
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{ textAlign: "center", marginBottom: 52, paddingBottom: 40, borderBottom: `1px solid ${pal.border}` }}>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", color: pal.textMuted, textTransform: "uppercase", marginBottom: 18 }}>
            {char.charClass}{char.subclass ? ` · ${char.subclass}` : ""}
          </div>

          <h1 style={{
            fontFamily: pal.fontDisplay, fontWeight: 400,
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            color: pal.text, margin: "0 0 8px",
            letterSpacing: "0.04em", lineHeight: 1.1,
          }}>
            {char.name || "Unnamed"}
          </h1>

          {char.nameAlt && (
            <div style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 18, color: pal.text, letterSpacing: "0.06em", marginBottom: 6 }}>
              "{char.nameAlt}"
            </div>
          )}

          {char.pronunciation && (
            <div style={{ fontFamily: pal.fontUI, fontSize: 14, color: pal.accent, letterSpacing: "0.15em", marginBottom: 24 }}>
              {char.pronunciation}
            </div>
          )}

          <div className="character-details-grid">
            {[
              ["Race",       char.race],
              ["Class",      char.charClass],
              char.subclass ? ["Subclass", char.subclass] : null,              
              ["Alignment",  char.alignment],
              ["Background", char.background],
              ["Origin",     char.origin],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.22em", color: pal.accentDim, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.accent }}>{value}</div>
              </div>
            ))}
          </div>
        </header>

        {/* ── Portrait ────────────────────────────────────────────────────── */}
        {char.portrait && (
          <div style={{ width: "calc(100% + 56px)", marginLeft: -28, marginRight: -28, marginBottom: 44, overflow: "hidden", borderRadius: 4 }}>
            <img src={char.portrait} alt={char.name} style={{ width: "100%", display: "block" }} />
            {char.tagline && (
              <p style={{
                margin: 0, padding: "14px 28px 10px",
                fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 22,
                color: pal.accent, textAlign: "center", lineHeight: 1.7                
              }}>
                {char.tagline}
              </p>
            )}
          </div>
        )}

        {/* ── Stats block ─────────────────────────────────────────────────── */}
        <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "28px 30px", marginBottom: 44, isolation: "isolate" }}>
          <div style={secHead}>Ability Scores · Level {char.level}</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px 8px", marginBottom: 8 }}>
            {char.stats.map(({ stat, score, note }) => {
              const mod = modOf(score); //used to calculate the modifier for ability scores. Not yet implemented
              const col = score >= 14 ? pal.gem : score <= 8 ? pal.gemLow : pal.accent;
              return (
                <div key={stat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    position: "relative",
                    width: 44, height: 44, borderRadius: "50%",
                    border: `1px solid ${col}55`, background: `${col}14`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: col, lineHeight: 1 }}>{score}</div>
                   {/* Style for use with Ability mod scores. Not Yet Implemented
                    <div style={{
                      position: "absolute",
                      right: -8, bottom: -8,
                      width: 26, height: 26, borderRadius: "50%",
                      border: `1px solid ${col}55`, background: pal.surfaceSolid,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: pal.fontUI, fontSize: 16, color: col, lineHeight: 1,
                    }}>
                      {fmtMod(mod)}
                    </div>
                    */}
                  </div>
                  <div>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 14, color: pal.accentBright, letterSpacing: "0.06em" }}>{stat}</div>
                    <div style={{ fontFamily: pal.fontBody, fontSize: 12, color: pal.textMuted, marginTop: 2 }}>{note}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <HR color={pal.border} />

          {/* Spells */}
          <div style={{ marginBottom: 4 }}>
            <div style={secHead}>Key Spells & Abilities</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(char.spells || []).map(spell => (
                <span key={spell} style={{ fontFamily: pal.fontUI, fontSize: 16, letterSpacing: "0.08em", padding: "4px 13px", border: `1px solid ${pal.border}`, borderRadius: 2, color: pal.accent }}>
                  {spell}
                </span>
              ))}
            </div>
          </div>

          {/* In Play */}
          {(char.inPlay || []).length > 0 && (
            <>
              <HR color={pal.border} />
              <div style={secHead}>In Play</div>
              <ul style={{ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0 28px" }}>
                {char.inPlay.map((item, i) => (
                  <li key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "7px 0", borderBottom: `1px solid ${pal.border}`,
                    fontFamily: pal.fontBody, fontSize: 16, lineHeight: 1.5, color: pal.textBody,
                  }}>
                    <span style={{ color: pal.accentDim, fontSize: 7, marginTop: 5, flexShrink: 0 }}>◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          {char.collections.map(col => {
            if (!col.sections.length) return null;
            return (
              <div key={col.id} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.22em", color: pal.accentDim, textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>
                  {col.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {col.sections.map(s => {
                    const isActive = active?.collectionId === col.id && active?.sectionId === s.id;
                    return (
                      <button key={s.id} onClick={() => setActive({ collectionId: col.id, sectionId: s.id })} style={navBtn(isActive)}>
                        {s.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Active section content ───────────────────────────────────────── */}
        {activeSec && (
          <div>
            <h2 style={{
              fontFamily: pal.fontDisplay, fontWeight: 400, fontSize: 14,
              letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accent, marginBottom: 28,
            }}>
              {activeSec.title}
            </h2>

            {activeSec.type === "list" ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {(activeSec.items || []).map((item, i) => (
                  <li key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "10px 0", borderBottom: `1px solid ${pal.border}`,
                    fontFamily: pal.fontBody, fontSize: 16, lineHeight: 1.6, color: pal.textBody,
                  }}>
                    <span style={{ color: pal.accent, marginTop: 5, fontSize: 10, flexShrink: 0 }}>◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                {(activeSec.content || "").split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i} style={{ fontFamily: pal.fontBody, fontSize: 18, lineHeight: 1.9, color: pal.textBody, marginBottom: 22, textAlign: "justify" }}>
                    {renderInline(para.trim())}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{
          marginTop: 64, paddingTop: 26, borderTop: `1px solid ${pal.border}`,
          textAlign: "center", fontFamily: pal.fontUI, fontStyle: "italic",
          fontSize: 14, color: pal.textMuted, letterSpacing: "0.1em", lineHeight: 1.8,
        }}>
          {char.name && (
            <>{char.name}{char.nameAlt ? ` · ${char.nameAlt}` : ""}{" · "}{char.race} {char.charClass}{char.level ? ` · Level ${char.level}` : ""}</>
          )}
        </footer>

      </div>
    </div>
  );
}
