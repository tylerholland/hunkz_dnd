import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { verifyPassword as apiVerify, updateCharacter, getPortraitUploadUrl, patchSession } from "../api";
import DiceRoller from "./DiceRoller";

// ── Utilities ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

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
const modOf      = s => Math.floor((s - 10) / 2);
const fmtMod     = m => m >= 0 ? `+${m}` : `${m}`;
const uid        = () => "id" + Date.now() + Math.random().toString(36).slice(2, 7);
// Only accept bare integers like "+2", "-1", "4" — rejects dice notation like "1d8"
const parseModInt = v => /^[+-]?\d+$/.test(String(v).trim()) ? parseInt(v, 10) : NaN;

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
  hpMax: 0,
  hpCurrent: 0,
  tempHP: 0,
  hitDice: "",
  armorType: "",
  armorTotal: 0,
  spells: [],
  spellSlots: [],
  conditions: [],
  exhaustionLevel: 0,
  concentration: { active: false, spell: "" },
  inspiration: false,
  inPlay: [],
  weapons: [],
  equipment: [],
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

const LIVE_SESSION_FIELDS = [
  "hpCurrent",
  "tempHP",
  "spellSlots",
  "conditions",
  "exhaustionLevel",
  "concentration",
  "inspiration",
  "weapons",
  "equipment",
];

function cloneLiveValue(value) {
  return value && typeof value === "object"
    ? JSON.parse(JSON.stringify(value))
    : value;
}

function liveValuesEqual(a, b) {
  if (a === undefined && b === undefined) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

const ARMOR_OPTIONS = [
  { value: "none",   label: "None",   speed: "Fast"   },
  { value: "light",  label: "Light",  speed: "Normal" },
  { value: "full",   label: "Full",   speed: "Slow"   },
  { value: "shield", label: "Shield", speed: null     },
];

const MOD_ATTRIBUTES = [
  "Strength", "Dexterity", "Constitution", "Wisdom", "Intelligence", "Charisma",
  "Armor", "HP", "Hit Dice", "Attack Bonus", "Damage", "Initiative", "Speed", "Save DC",
];

const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned",
  "Prone", "Restrained", "Stunned", "Unconscious",
];

const SPELL_LEVEL_LABELS = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th"];

// ── Item Editor Modal ─────────────────────────────────────────────────────────
function ItemEditorModal({ item, pal, onSave, onClose, showType }) {
  const [name,  setName]  = useState(item?.name  || "");
  const [desc,  setDesc]  = useState(item?.description || "");
  const [mods,  setMods]  = useState(item?.mods  || []);
  const [type,  setType]  = useState(item?.type  || "");

  const inputStyle = {
    background: pal.surface, border: `1px solid ${pal.border}`,
    borderRadius: 3, color: pal.text, fontFamily: pal.fontBody,
    fontSize: 15, padding: "8px 12px", width: "100%", outline: "none",
  };
  const lbl = {
    fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em",
    textTransform: "uppercase", color: pal.textMuted, display: "block", marginBottom: 5,
  };

  const addMod    = () => setMods(m => [...m, { attribute: MOD_ATTRIBUTES[0], value: "" }]);
  const removeMod = (i) => setMods(m => m.filter((_, idx) => idx !== i));
  const updateMod = (i, field, val) => setMods(m => m.map((mod, idx) => idx !== i ? mod : { ...mod, [field]: val }));

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ id: item?.id || uid(), name: name.trim(), description: desc.trim(), mods, ...(showType ? { type: type.trim() } : {}) });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.8)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: pal.surfaceSolid, border: `1px solid ${pal.border}`,
        borderRadius: 6, padding: "28px 24px", width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 20 }}>
          {item ? "Edit Item" : "New Item"}
        </div>

        <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: showType ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div>
            <label style={lbl}>Name</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Cloak of Protection…" />
          </div>
          {showType && (
            <div>
              <label style={lbl}>Type <span style={{ opacity: 0.5, textTransform: "none", fontSize: 11, letterSpacing: 0 }}>(optional)</span></label>
              <input style={inputStyle} value={type} onChange={e => setType(e.target.value)} placeholder="e.g. Armour, Potion…" />
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Description <span style={{ opacity: 0.5, textTransform: "none", fontSize: 11, letterSpacing: 0 }}>(shown on tap)</span></label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80, lineHeight: 1.6 }}
            value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the item…" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <label style={{ ...lbl, marginBottom: 0 }}>Modifiers</label>
            <button onClick={addMod} style={{
              background: "transparent", border: `1px dashed ${pal.border}`,
              borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontBody,
              fontSize: 13, padding: "4px 12px", cursor: "pointer",
            }}>+ Add Mod</button>
          </div>
          {mods.length === 0 && (
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>No modifiers — click Add Mod to add one.</div>
          )}
          {mods.map((mod, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <select
                value={mod.attribute}
                onChange={e => updateMod(i, "attribute", e.target.value)}
                style={{ ...inputStyle, width: "auto", flex: 2, appearance: "none", WebkitAppearance: "none" }}
              >
                {MOD_ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <input
                style={{ ...inputStyle, flex: 1, textAlign: "center" }}
                value={mod.value}
                onChange={e => updateMod(i, "value", e.target.value)}
                placeholder={mod.attribute === "Attack Bonus" ? "total (mod+prof+magic)" : mod.attribute === "Damage" ? "e.g. 1d8+3" : "+2"}
                title={mod.attribute === "Attack Bonus" ? "Enter the total attack bonus: ability modifier + proficiency bonus + any magic item bonus (e.g. STR +3, proficiency +2, magic +1 = enter +6)" : undefined}
              />
              <button onClick={() => removeMod(i)} style={{
                background: "transparent", border: `1px solid ${pal.border}`,
                borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontBody,
                fontSize: 18, width: 34, height: 34, cursor: "pointer", flexShrink: 0,
              }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            ...inputStyle, width: "auto", flex: 1, padding: "9px 16px",
            cursor: "pointer", textAlign: "center",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            ...inputStyle, flex: 2, padding: "10px 16px", textAlign: "center",
            background: pal.accentDim, borderColor: pal.accent,
            color: pal.accentBright, fontFamily: pal.fontUI,
            letterSpacing: "0.08em", cursor: "pointer",
            opacity: !name.trim() ? 0.5 : 1,
          }}>
            {item ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change Password form ──────────────────────────────────────────────────────
function ChangePasswordForm({ pal, inputStyle, lbl, slug, currentPassword, onSuccess }) {
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [status,     setStatus]     = useState(null); // null | "saving" | "saved" | "error"
  const [error,      setError]      = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setError("Passwords don't match."); return; }
    setError(null);
    setStatus("saving");
    try {
      await updateCharacter(slug, { newPassword: newPwd }, currentPassword);
      setStatus("saved");
      onSuccess(newPwd);
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      setError(err.message);
      setStatus("error");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Leave blank to remove the password (sheet becomes publicly editable).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={lbl}>New Password</label>
          <input type="password" style={inputStyle} value={newPwd}
            onChange={e => setNewPwd(e.target.value)} placeholder="Leave blank for no password" />
        </div>
        <div>
          <label style={lbl}>Confirm Password</label>
          <input type="password" style={inputStyle} value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)} placeholder="Repeat new password" />
        </div>
      </div>
      {error && (
        <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 14, marginBottom: 10 }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={status === "saving"} style={{
        ...inputStyle, width: "auto", padding: "8px 22px",
        background: status === "saved" ? pal.accentDim : pal.surface,
        borderColor: status === "saved" ? pal.accent : pal.border,
        color: status === "saved" ? pal.accentBright : pal.textMuted,
        cursor: "pointer", opacity: status === "saving" ? 0.6 : 1,
      }}>
        {status === "saving" ? "Updating…" : status === "saved" ? "✓ Password Updated" : "Update Password"}
      </button>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// Props:
//   initialData  — character object (from API or blank)
//   slug         — character slug (present for existing characters)
//   onSave       — async (charData, password) => void  (existing character save)
//   onCreate     — (charData) => void  (new character flow, triggers password modal upstream)
//   onDelete     — async (password) => void  (existing character delete)
//   onSessionSync — () => void  (request authoritative background refresh after live writes)
export default function CharacterSheet({ initialData, slug, onSave, onCreate, onDelete, onSessionSync }) {
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

  // Password unlock state (existing characters)
  const [unlockState,   setUnlockState]   = useState("locked"); // "locked" | "prompting" | "unlocked"
  const [unlockIntent,  setUnlockIntent]  = useState("view");   // "view" | "edit"
  const [unlockChecking, setUnlockChecking] = useState(!!slug);  // true while auto-unlock runs on mount
  const [unlockLoading, setUnlockLoading] = useState(false);    // true while button-triggered check runs
  const [unlockInput,   setUnlockInput]   = useState("");
  const [unlockError,   setUnlockError]   = useState(null);
  const [unlockedPassword, setUnlockedPassword] = useState(null);
  const [unlockedRole,     setUnlockedRole]      = useState(null);

  // Save state
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null); // null | "deleting" | "error"
  const [menuOpen, setMenuOpen] = useState(false);

  // Loadout editing
  const [editingItem,   setEditingItem]   = useState(null);       // { listType: "weapons"|"equipment", item }
  const [combatTab,     setCombatTab]     = useState(() => {
    if (slug) {
      const stored = sessionStorage.getItem(`dnd_tab_${slug}`);
      if (stored === "loadout" || stored === "persona" || stored === "combat") return stored;
    }
    return "combat";
  });
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [hoveredStat,   setHoveredStat]   = useState(null); // stat name while flyout is open

  const [hpEditMode, setHpEditMode] = useState(false);
  const [concSpellInput, setConcSpellInput] = useState("");

  const fileRef       = useRef();
  const importRef     = useRef();
  const charRef       = useRef(initialData || BLANK_CHARACTER);
  const currentSlugRef = useRef(initialData?.slug || slug || null);
  const sessionExpectedRef = useRef(new Map());

  // ── Optimistic session refs (HP delta debounce) ────────────────────────────
  const hpPendingDelta   = useRef(0);
  const hpFlushRef       = useRef(null);
  const hpServerRef      = useRef(initialData?.hpCurrent ?? initialData?.hp ?? 0);
  const hpMaxRef         = useRef(initialData?.hpMax ?? initialData?.hp ?? 0);
  const hpFlushInFlightRef = useRef(false);

  // ── Optimistic session refs (exhaustion delta debounce) ───────────────────
  const exhPendingDelta  = useRef(0);
  const exhFlushRef      = useRef(null);
  const exhServerRef     = useRef(initialData?.exhaustionLevel ?? 0);
  const exhFlushInFlightRef = useRef(false);

  // ── Optimistic session refs (tempHP debounce) ─────────────────────────────
  const tempHpFlushRef   = useRef(null);
  const tempHpServerRef  = useRef(initialData?.tempHP ?? 0);
  const tempHpFlushInFlightRef = useRef(false);

  const pal = PALETTES[char.palette] || PALETTES.ember;
  const isVellum = pal.name === "Vellum";

  useEffect(() => {
    charRef.current = char;
  }, [char]);

  const markSessionExpected = useCallback((fields) => {
    Object.entries(fields).forEach(([field, value]) => {
      sessionExpectedRef.current.set(field, cloneLiveValue(value));
    });
  }, []);

  const clearSessionExpected = useCallback((fields) => {
    fields.forEach((field) => sessionExpectedRef.current.delete(field));
  }, []);

  const requestSessionSync = useCallback(() => {
    onSessionSync?.();
  }, [onSessionSync]);

  const applySessionPatch = useCallback((fields, revertFields = null) => {
    if (!slug) return Promise.resolve();

    const fieldNames = Object.keys(fields);
    markSessionExpected(fields);

    return patchSession(slug, fields, null)
      .then(() => {
        if (Object.prototype.hasOwnProperty.call(fields, "hpCurrent")) hpServerRef.current = fields.hpCurrent;
        if (Object.prototype.hasOwnProperty.call(fields, "exhaustionLevel")) exhServerRef.current = fields.exhaustionLevel;
        if (Object.prototype.hasOwnProperty.call(fields, "tempHP")) tempHpServerRef.current = fields.tempHP;
        requestSessionSync();
      })
      .catch((err) => {
        clearSessionExpected(fieldNames);
        if (revertFields) {
          setChar((current) => ({ ...current, ...revertFields }));
        }
        throw err;
      });
  }, [clearSessionExpected, markSessionExpected, requestSessionSync, slug]);

  // Auto-unlock on mount: try DM session or stored character password
  useEffect(() => {
    if (!slug) { setUnlockChecking(false); return; }

    const applyUnlock = (password, role) => {
      setUnlockedPassword(password);
      setUnlockedRole(role);
      setUnlockState("unlocked");
    };

    const tryVerify = async (password, onFail) => {
      try {
        const result = await apiVerify(slug, password);
        if (result.valid) {
          applyUnlock(password, result.role);
          if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", password);
          else sessionStorage.setItem(`dnd_char_${slug}`, password);
          return true;
        }
      } catch {}
      if (onFail) onFail();
      return false;
    };

    const dmPwd   = sessionStorage.getItem("dnd_dm_password");
    const charPwd = sessionStorage.getItem(`dnd_char_${slug}`);

    const run = dmPwd
      ? tryVerify(dmPwd, () => sessionStorage.removeItem("dnd_dm_password"))
      : charPwd !== null
        ? tryVerify(charPwd, () => sessionStorage.removeItem(`dnd_char_${slug}`))
        : Promise.resolve(false);

    run.finally(() => setUnlockChecking(false));
  }, [slug]);

  // Sync incoming prop changes.
  // In view mode, merge server updates while preserving optimistic live-session fields
  // until polling confirms the expected value.
  useEffect(() => {
    if (!initialData) return;

    const incomingSlug = initialData.slug || slug || null;
    if (currentSlugRef.current !== incomingSlug) {
      currentSlugRef.current = incomingSlug;
      sessionExpectedRef.current.clear();
      setChar(initialData);
      charRef.current = initialData;
      hpServerRef.current = initialData.hpCurrent ?? initialData.hp ?? 0;
      hpMaxRef.current = initialData.hpMax ?? initialData.hp ?? 0;
      tempHpServerRef.current = initialData.tempHP ?? 0;
      exhServerRef.current = initialData.exhaustionLevel ?? 0;
      const first = initialData.collections?.[0]?.sections?.[0];
      setActive(first ? { collectionId: initialData.collections[0].id, sectionId: first.id } : null);
      return;
    }

    if (mode === "edit") return;

    setChar((prev) => {
      const next = { ...prev, ...initialData };
      for (const field of LIVE_SESSION_FIELDS) {
        const expected = sessionExpectedRef.current.get(field);
        const incoming = initialData[field];
        if (expected !== undefined) {
          if (liveValuesEqual(incoming, expected)) {
            sessionExpectedRef.current.delete(field);
            next[field] = incoming;
          } else {
            next[field] = prev[field];
          }
        } else {
          next[field] = incoming;
        }
      }
      return next;
    });

    if (!sessionExpectedRef.current.has("hpCurrent")) {
      hpServerRef.current = initialData.hpCurrent ?? initialData.hp ?? 0;
    }
    if (!sessionExpectedRef.current.has("tempHP")) {
      tempHpServerRef.current = initialData.tempHP ?? 0;
    }
    if (!sessionExpectedRef.current.has("exhaustionLevel")) {
      exhServerRef.current = initialData.exhaustionLevel ?? 0;
    }
  }, [initialData, mode, slug]);

  // Ensure active tab stays valid when collections change
  useEffect(() => {
    if (!active) return;
    const col = char.collections.find(c => c.id === active.collectionId);
    if (!col || !col.sections.find(s => s.id === active.sectionId)) {
      const first = char.collections[0]?.sections[0];
      setActive(first ? { collectionId: char.collections[0].id, sectionId: first.id } : null);
    }
  }, [char.collections]);

  // ── Tab persistence ─────────────────────────────────────────────────────────
  const setTab = (tab) => {
    setCombatTab(tab);
    if (slug) sessionStorage.setItem(`dnd_tab_${slug}`, tab);
  };

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

  // Weapons
  const addWeapon    = (item) => setChar(c => ({ ...c, weapons: [...(c.weapons||[]), item] }));
  const updateWeapon = (id, item) => setChar(c => ({ ...c, weapons: (c.weapons||[]).map(w => w.id === id ? item : w) }));
  const removeWeapon = (id)  => setChar(c => ({ ...c, weapons: (c.weapons||[]).filter(w => w.id !== id) }));

  // Equipment
  const addEquipment    = (item) => setChar(c => ({ ...c, equipment: [...(c.equipment||[]), item] }));
  const updateEquipment = (id, item) => setChar(c => ({ ...c, equipment: (c.equipment||[]).map(e => e.id === id ? item : e) }));
  const removeEquipment = (id)  => setChar(c => ({ ...c, equipment: (c.equipment||[]).filter(e => e.id !== id) }));

  const toggleExpanded = (id) => setExpandedItems(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

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
  const handlePortrait = async e => {
    const file = e.target.files[0]; if (!file) return;

    // If we have a slug + password, upload to S3 via presigned URL
    if (slug && unlockedPassword) {
      try {
        const { uploadUrl, portraitUrl } = await getPortraitUploadUrl(slug, unlockedPassword, file.type);
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        update("portraitUrl", portraitUrl);
        update("portrait", ""); // clear any old base64
        // Persist portraitUrl immediately — don't wait for the Save button
        updateCharacter(slug, { portraitUrl, portrait: "" }, unlockedPassword).catch(() => {});
      } catch {
        alert("Portrait upload failed. Please try again.");
      }
      return;
    }

    // Fallback: store as base64 (new character, not yet in DB)
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

  // ── Password unlock (existing characters) ───────────────────────────────────
  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setUnlockError(null);
    try {
      const result = await apiVerify(slug, unlockInput);
      if (result.valid) {
        setUnlockedPassword(unlockInput);
        setUnlockedRole(result.role);
        setUnlockState("unlocked");
        if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", unlockInput);
        else sessionStorage.setItem(`dnd_char_${slug}`, unlockInput);
        if (unlockIntent === "edit") setMode("edit");
        if (unlockIntent === "delete") setDeleteConfirm(true);
        setUnlockInput("");
      } else {
        setUnlockError("Incorrect password.");
      }
    } catch {
      setUnlockError("Could not verify password. Please try again.");
    }
  };

  const handleEditClick = async () => {
    if (!slug) { setMode("edit"); return; }
    if (unlockState === "unlocked") { setMode("edit"); return; }
    setUnlockIntent("edit");
    setUnlockLoading(true);
    const result = await apiVerify(slug, "").catch(() => ({ valid: false }));
    setUnlockLoading(false);
    if (result.valid) {
      setUnlockedPassword("");
      setUnlockedRole(result.role);
      setUnlockState("unlocked");
      if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", "");
      else sessionStorage.setItem(`dnd_char_${slug}`, "");
      setMode("edit");
    } else {
      setUnlockState("prompting");
    }
  };

  const handleViewUnlock = async () => {
    setUnlockIntent("view");
    setUnlockLoading(true);
    const result = await apiVerify(slug, "").catch(() => ({ valid: false }));
    setUnlockLoading(false);
    if (result.valid) {
      setUnlockedPassword("");
      setUnlockedRole(result.role);
      setUnlockState("unlocked");
      if (result.role === "dm") sessionStorage.setItem("dnd_dm_password", "");
      else sessionStorage.setItem(`dnd_char_${slug}`, "");
    } else {
      setUnlockState("prompting");
    }
  };

  const handleCancelUnlock = () => {
    setUnlockState("locked");
    setUnlockInput("");
    setUnlockError(null);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!onSave) return;
    setSaveStatus("saving");
    try {
      await onSave(char, unlockedPassword);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      setSaveStatus("error");
      alert(`Save failed: ${err.message}`);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const deletePhrase = char.name ? `DELETE ${char.name}${char.charClass ? ` ${char.charClass}` : ""}` : "";
  const handleDeleteRequest = () => {
    if (!onDelete) return;
    if (unlockState !== "unlocked") {
      setUnlockIntent("delete");
      setUnlockState("prompting");
      return;
    }
    setDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!onDelete || deleteInput !== deletePhrase) return;
    setDeleteStatus("deleting");
    try {
      await onDelete(unlockedPassword);
    } catch (err) {
      setDeleteStatus("error");
      alert(`Delete failed: ${err.message}`);
      setTimeout(() => setDeleteStatus(null), 3000);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(false);
    setDeleteInput("");
    setDeleteStatus(null);
  };

  // ── HP derived values (used in both stats block and Combat tab) ─────────────
  const _itemBonuses = {};
  [...(char.weapons||[]), ...(char.equipment||[])].forEach(item => {
    (item.mods||[]).forEach(({ attribute, value }) => {
      const v = parseModInt(value);
      if (!isNaN(v)) _itemBonuses[attribute] = (_itemBonuses[attribute] || 0) + v;
    });
  });
  const hpBonus    = _itemBonuses["HP"] || 0;
  const hpMax      = (char.hpMax ?? char.hp ?? 0) + hpBonus;
  const hpCurrent  = char.hpCurrent ?? char.hp ?? 0;
  const tempHP     = char.tempHP ?? 0;
  const hpPct      = hpMax > 0 ? hpCurrent / hpMax : 0;
  const hpBarColor = hpPct > 0.5 ? pal.gem : hpPct > 0.2 ? "#c8a030" : "#c06060";
  const isActiveTurn = !!char.isActiveTurn;

  useEffect(() => {
    hpMaxRef.current = hpMax;
  }, [hpMax]);

  // ── Debounced flush functions (stable across renders) ─────────────────────
  useEffect(() => {
    hpFlushRef.current?.cancel?.();
    hpFlushRef.current = debounce(async () => {
      if (!slug || hpFlushInFlightRef.current) return;

      const targetHp = Math.max(0, Math.min(hpMaxRef.current, charRef.current.hpCurrent ?? charRef.current.hp ?? 0));
      const previousServerHp = hpServerRef.current ?? 0;

      if (targetHp === previousServerHp) {
        hpPendingDelta.current = 0;
        return;
      }

      hpPendingDelta.current = 0;
      hpFlushInFlightRef.current = true;
      markSessionExpected({ hpCurrent: targetHp });

      try {
        await patchSession(slug, { hpCurrent: targetHp }, null);
        hpServerRef.current = targetHp;
        requestSessionSync();
      } catch {
        clearSessionExpected(["hpCurrent"]);
        hpServerRef.current = previousServerHp;
        setChar((current) => ({ ...current, hpCurrent: previousServerHp }));
      } finally {
        hpFlushInFlightRef.current = false;
        const currentHp = Math.max(0, Math.min(hpMaxRef.current, charRef.current.hpCurrent ?? charRef.current.hp ?? 0));
        if (hpPendingDelta.current !== 0 || currentHp !== hpServerRef.current) {
          hpFlushRef.current?.();
        }
      }
    }, 300);

    return () => hpFlushRef.current?.cancel?.();
  }, [clearSessionExpected, markSessionExpected, requestSessionSync, slug]);

  useEffect(() => {
    exhFlushRef.current?.cancel?.();
    exhFlushRef.current = debounce(async () => {
      if (!slug || exhFlushInFlightRef.current) return;

      const targetExhaustion = Math.max(0, Math.min(6, charRef.current.exhaustionLevel || 0));
      const previousServerExhaustion = exhServerRef.current ?? 0;

      if (targetExhaustion === previousServerExhaustion) {
        exhPendingDelta.current = 0;
        return;
      }

      exhPendingDelta.current = 0;
      exhFlushInFlightRef.current = true;
      markSessionExpected({ exhaustionLevel: targetExhaustion });

      try {
        await patchSession(slug, { exhaustionLevel: targetExhaustion }, null);
        exhServerRef.current = targetExhaustion;
        requestSessionSync();
      } catch {
        clearSessionExpected(["exhaustionLevel"]);
        exhServerRef.current = previousServerExhaustion;
        setChar((current) => ({ ...current, exhaustionLevel: previousServerExhaustion }));
      } finally {
        exhFlushInFlightRef.current = false;
        const currentExhaustion = Math.max(0, Math.min(6, charRef.current.exhaustionLevel || 0));
        if (exhPendingDelta.current !== 0 || currentExhaustion !== exhServerRef.current) {
          exhFlushRef.current?.();
        }
      }
    }, 300);

    return () => exhFlushRef.current?.cancel?.();
  }, [clearSessionExpected, markSessionExpected, requestSessionSync, slug]);

  useEffect(() => {
    tempHpFlushRef.current?.cancel?.();
    tempHpFlushRef.current = debounce(async () => {
      if (!slug || tempHpFlushInFlightRef.current) return;

      const targetTempHp = Math.max(0, charRef.current.tempHP ?? 0);
      const previousServerTempHp = tempHpServerRef.current ?? 0;

      if (targetTempHp === previousServerTempHp) return;

      tempHpFlushInFlightRef.current = true;
      markSessionExpected({ tempHP: targetTempHp });

      try {
        await patchSession(slug, { tempHP: targetTempHp }, null);
        tempHpServerRef.current = targetTempHp;
        requestSessionSync();
      } catch {
        clearSessionExpected(["tempHP"]);
        tempHpServerRef.current = previousServerTempHp;
        setChar((current) => ({ ...current, tempHP: previousServerTempHp }));
      } finally {
        tempHpFlushInFlightRef.current = false;
        const currentTempHp = Math.max(0, charRef.current.tempHP ?? 0);
        if (currentTempHp !== tempHpServerRef.current) {
          tempHpFlushRef.current?.();
        }
      }
    }, 300);

    return () => tempHpFlushRef.current?.cancel?.();
  }, [clearSessionExpected, markSessionExpected, requestSessionSync, slug]);

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
      <>
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
              {slug && onSave && (
                <button
                  onClick={handleSave}
                  disabled={saveStatus === "saving"}
                  style={{
                    ...inputStyle, width: "auto", padding: "9px 22px",
                    background: saveStatus === "saved" ? pal.accentDim : pal.surface,
                    borderColor: saveStatus === "saved" ? pal.accent : pal.border,
                    color: saveStatus === "saved" ? pal.accentBright : pal.textMuted,
                    fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.08em",
                    opacity: saveStatus === "saving" ? 0.6 : 1,
                  }}
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "Error" : "Save"}
                </button>
              )}
              {!slug && onCreate && (
                <button onClick={() => onCreate(char)} style={{
                  ...inputStyle, width: "auto", padding: "9px 22px",
                  background: pal.accentDim, borderColor: pal.accent,
                  color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 14, letterSpacing: "0.08em",
                }}>
                  Create Character →
                </button>
              )}
              <div style={{ position: "relative", display: "inline-block" }}>
                <button onClick={() => setMenuOpen(!menuOpen)} style={{
                  ...inputStyle, width: "auto", padding: "9px 12px", fontSize: 16,
                  background: menuOpen ? pal.surfaceDim : "transparent",
                }}>
                  ⋯
                </button>
                {menuOpen && (
                  <div style={{
                    position: "absolute", top: "100%", right: 0, background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: 8, zIndex: 10, minWidth: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                  }}>
                    <button onClick={() => { exportJSON(); setMenuOpen(false); }} style={{
                      width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 14, cursor: "pointer", borderRadius: 2
                    }}>
                      Export JSON
                    </button>
                    {!slug && (
                      <button onClick={() => { importRef.current.click(); setMenuOpen(false); }} style={{
                        width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 14, cursor: "pointer", borderRadius: 2
                      }}>
                        Import JSON
                      </button>
                    )}
                    {slug && onDelete && (
                      <button onClick={() => { handleDeleteRequest(); setMenuOpen(false); }} style={{
                        width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: "none", color: "#f2b7b7", fontFamily: pal.fontUI, fontSize: 14, cursor: "pointer", borderRadius: 2
                      }}>
                        Delete Character
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setMode("view")} style={{
                ...inputStyle, width: "auto", padding: "9px 22px",
                background: pal.accentDim, borderColor: pal.accent,
                color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 15, letterSpacing: "0.08em",
              }}>
                View Sheet →
              </button>
            </div>
          </div>

          {deleteConfirm && (
            <div style={{
              background: "rgba(192,80,80,0.14)",
              border: `1px solid rgba(192,80,80,0.55)`, borderRadius: 6,
              padding: "22px 24px", marginBottom: 24,
            }}>
              <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 10 }}>
                PERMANENT DELETE
              </div>
              <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: "#f2c6c6", marginBottom: 12 }}>
                Danger zone
              </div>
              <p style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.text, lineHeight: 1.7, marginBottom: 16 }}>
                This action cannot be undone. To delete this character, type the exact phrase shown below and then confirm.
              </p>
              <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f5d7d7", marginBottom: 8 }}>
                Confirmation phrase
              </div>
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: "#ffe8e8", background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 4, padding: "10px 14px", marginBottom: 16 }}>
                {deletePhrase || "DELETE this character"}
              </div>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder={deletePhrase}
                style={{ ...inputStyle, width: "100%", marginBottom: 16, background: pal.surfaceSolid }}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={cancelDelete} type="button" style={{
                  ...inputStyle, width: "auto", padding: "9px 18px", background: pal.surface,
                  borderColor: pal.border, color: pal.textMuted,
                }}>
                  Cancel
                </button>
                <button onClick={handleDelete} type="button" disabled={deleteInput !== deletePhrase || deleteStatus === "deleting"} style={{
                  ...inputStyle, flex: 1, padding: "9px 18px", background: deleteInput === deletePhrase ? "#b04a4a" : pal.surface,
                  borderColor: deleteInput === deletePhrase ? "#c06060" : pal.border,
                  color: deleteInput === deletePhrase ? "#fff" : pal.textMuted,
                  cursor: deleteInput === deletePhrase ? "pointer" : "not-allowed",
                }}>
                  {deleteStatus === "deleting" ? "Deleting…" : "Delete Character"}
                </button>
              </div>
            </div>
          )}

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
              {(char.portraitUrl || char.portrait) && (
                <img src={char.portraitUrl || char.portrait} alt="portrait" style={{
                  width: 90, height: 90, objectFit: "cover",
                  borderRadius: 4, border: `1px solid ${pal.border}`, flexShrink: 0,
                }} />
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePortrait} style={{ display: "none" }} />
                <button onClick={() => fileRef.current.click()} style={{ ...inputStyle, width: "auto", padding: "8px 18px" }}>
                  {(char.portraitUrl || char.portrait) ? "Change Image" : "Upload Image"}
                </button>
                {(char.portraitUrl || char.portrait) && (
                  <button onClick={() => { update("portrait", ""); update("portraitUrl", ""); }} style={{ ...inputStyle, width: "auto", padding: "8px 16px", color: pal.textMuted }}>
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

          {/* Hit Points, Hit Dice & Armor */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Hit Points <span style={{ opacity: 0.5, textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(max)</span></label>
                <input style={inputStyle} type="number" min={0}
                  value={char.hpMax ?? char.hp ?? ""}
                  onChange={e => update("hpMax", parseInt(e.target.value) || 0)}
                  placeholder="e.g. 38"
                />
              </div>
              <div>
                <label style={lbl}>Hit Dice</label>
                <input style={inputStyle}
                  value={char.hitDice || ""}
                  onChange={e => update("hitDice", e.target.value)}
                  placeholder="e.g. 4d10"
                />
              </div>
            </div>

            {/* Armor */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
              <div>
                <label style={{ ...lbl, marginBottom: 10 }}>Armor & Speed</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ARMOR_OPTIONS.map(opt => {
                    const selected = char.armorType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update("armorType", selected ? "" : opt.value)}
                        style={{
                          background: selected ? pal.accentDim : "transparent",
                          border: `1px solid ${selected ? pal.accent : pal.border}`,
                          borderRadius: 3, padding: "8px 16px", cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        }}
                      >
                        <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", color: selected ? pal.accentBright : pal.text }}>{opt.label}</span>
                        {opt.speed && <span style={{ fontFamily: pal.fontBody, fontSize: 11, color: selected ? pal.accent : pal.textMuted, fontStyle: "italic" }}>{opt.speed}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ minWidth: 110 }}>
                <label style={lbl}>Total Armor</label>
                <input style={inputStyle} type="number" min={0}
                  value={char.armorTotal ?? ""}
                  onChange={e => update("armorTotal", parseInt(e.target.value) || 0)}
                  placeholder="e.g. 16"
                />
              </div>
            </div>
          </div>

          {/* Spell Slots */}
          <div style={{ marginBottom: 32 }}>
            <div style={secHead}>Spell Slots</div>
            <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, marginBottom: 14, fontStyle: "italic" }}>
              Configure max slots per level. Leave at 0 to hide.
            </div>
            {SPELL_LEVEL_LABELS.map((label, i) => {
              const level = i + 1;
              const slot = (char.spellSlots || []).find(s => s.level === level) || { level, max: 0, used: 0, isPactMagic: false };
              const updateSlot = (field, val) => {
                const slots = [...(char.spellSlots || [])];
                const idx = slots.findIndex(s => s.level === level);
                if (idx >= 0) {
                  slots[idx] = { ...slots[idx], [field]: val };
                } else {
                  slots.push({ level, max: 0, used: 0, isPactMagic: false, [field]: val });
                }
                // Remove levels that are 0 max to keep the array clean (unless we're editing it)
                update("spellSlots", slots.filter(s => s.max > 0 || s.level === level));
              };
              // Only show levels where max > 0, plus the next empty row
              const hasSlot = slot.max > 0;
              const prevSlot = i === 0 ? null : (char.spellSlots || []).find(s => s.level === i);
              const showRow = hasSlot || (i === 0) || (prevSlot && prevSlot.max > 0);
              if (!showRow) return null;
              return (
                <div key={level} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                  <div style={{ fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.12em", color: pal.textMuted, minWidth: 34, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ ...lbl, marginBottom: 0, fontSize: 11 }}>Max</label>
                    <input
                      type="number" min={0} max={9}
                      style={{ ...inputStyle, width: 70, textAlign: "center" }}
                      value={slot.max}
                      onChange={e => updateSlot("max", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted }}>
                    <input
                      type="checkbox"
                      checked={slot.isPactMagic || false}
                      onChange={e => updateSlot("isPactMagic", e.target.checked)}
                      style={{ accentColor: pal.accent }}
                    />
                    Pact Magic
                  </label>
                </div>
              );
            })}
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

          {/* Persona Traits */}
          <div style={{ marginBottom: 40 }}>
            <div style={secHead}>Persona Traits</div>
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

          {/* Weapons */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secHead}>Weapons</div>
              <button onClick={() => setEditingItem({ listType: "weapons", item: null })} style={{
                ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed",
              }}>+ Add Weapon</button>
            </div>
            {(char.weapons || []).length === 0 && (
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No weapons added.</div>
            )}
            {(char.weapons || []).map(item => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, marginBottom: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text }}>{item.name}</div>
                  {item.mods?.length > 0 && (
                    <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.textMuted, marginTop: 2 }}>
                      {item.mods.map(m => `${m.attribute} ${m.value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditingItem({ listType: "weapons", item })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12, color: pal.accentBright }}>Edit</button>
                <button onClick={() => removeWeapon(item.id)} style={{ ...inputStyle, width: 34, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
          </div>

          {/* Equipment */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secHead}>Equipment</div>
              <button onClick={() => setEditingItem({ listType: "equipment", item: null, showType: true })} style={{
                ...inputStyle, width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed",
              }}>+ Add Item</button>
            </div>
            {(char.equipment || []).length === 0 && (
              <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No equipment added.</div>
            )}
            {(char.equipment || []).map(item => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, marginBottom: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text }}>{item.name}</span>
                    {item.type && (
                      <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.accent, opacity: 0.7 }}>{item.type}</span>
                    )}
                  </div>
                  {item.mods?.length > 0 && (
                    <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.textMuted, marginTop: 2 }}>
                      {item.mods.map(m => `${m.attribute} ${m.value}`).join(" · ")}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditingItem({ listType: "equipment", item, showType: true })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12, color: pal.accentBright }}>Edit</button>
                <button onClick={() => removeEquipment(item.id)} style={{ ...inputStyle, width: 34, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}>×</button>
              </div>
            ))}
          </div>

          {/* Change Password */}
          {slug && (
            <div style={{ marginBottom: 40, borderTop: `1px solid ${pal.border}`, paddingTop: 32 }}>
              <div style={secHead}>Change Password</div>
              <ChangePasswordForm pal={pal} inputStyle={inputStyle} lbl={lbl}
                slug={slug} currentPassword={unlockedPassword}
                onSuccess={(newPwd) => {
                  setUnlockedPassword(newPwd);
                }}
              />
            </div>
          )}

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
      </>
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

        {/* Top bar: back link + edit/export buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 40 }}>
          <Link to="/" style={{
            fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em",
            textTransform: "uppercase", color: pal.textMuted, textDecoration: "none",
          }}>
            ← All Characters
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={exportJSON} style={{
              background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted,
              fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em",
              textTransform: "uppercase", padding: "5px 14px", borderRadius: 2, cursor: "pointer",
            }}>
              Export JSON
            </button>
            <button onClick={handleEditClick} disabled={unlockLoading || unlockChecking} style={{
              background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted,
              fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.18em",
              textTransform: "uppercase", padding: "5px 14px", borderRadius: 2, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, opacity: unlockLoading ? 0.6 : 1,
            }}>
              {unlockLoading
                ? <><div className="dnd-spinner" style={{ width: 12, height: 12, borderTopColor: pal.textMuted }} /> Checking…</>
                : unlockState === "unlocked" ? "Edit Character" : "🔒 Edit Character"
              }
            </button>
          </div>
        </div>

        {/* Password unlock prompt */}
        {unlockState === "prompting" && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.75)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 24,
          }}>
            <div style={{
              background: pal.surfaceSolid, border: `1px solid ${pal.border}`,
              borderRadius: 6, padding: "32px 28px", width: "100%", maxWidth: 360,
            }}>
              <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>
                {unlockIntent === "delete" ? "Unlock to Delete" : "Unlock to Edit"}
              </div>
              <div style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: pal.text, marginBottom: 20 }}>
                {char.name}
              </div>
              <form onSubmit={handleUnlockSubmit}>
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter character password…"
                  value={unlockInput}
                  onChange={e => setUnlockInput(e.target.value)}
                  style={{
                    background: pal.surface, border: `1px solid ${pal.border}`,
                    borderRadius: 3, color: pal.text, fontFamily: pal.fontBody,
                    fontSize: 16, padding: "9px 13px", width: "100%", outline: "none",
                    marginBottom: 8,
                  }}
                />
                {unlockError && (
                  <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 14, marginBottom: 12 }}>
                    {unlockError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={handleCancelUnlock} style={{
                    background: "transparent", border: `1px solid ${pal.border}`,
                    borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontBody,
                    fontSize: 14, padding: "8px 16px", cursor: "pointer", flex: 1,
                  }}>
                    Cancel
                  </button>
                  <button type="submit" style={{
                    background: pal.accentDim, border: `1px solid ${pal.accent}`,
                    borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI,
                    fontSize: 14, letterSpacing: "0.08em", padding: "9px 18px",
                    cursor: "pointer", flex: 2,
                  }}>
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

          {/* Active conditions compact chips */}
          {(char.conditions || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 16 }}>
              {char.conditions.map(cond => (
                <span key={cond} style={{
                  fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em",
                  padding: "3px 10px", borderRadius: 12,
                  border: `1px solid ${pal.accent}`, color: pal.accentBright,
                }}>
                  {cond}
                </span>
              ))}
            </div>
          )}

          {/* Concentration indicator */}
          {char.concentration?.active && (
            <div style={{
              marginTop: 14, fontFamily: pal.fontUI, fontSize: 13,
              color: pal.accentBright, letterSpacing: "0.06em",
            }}>
              ◈ Concentrating: {char.concentration.spell}
            </div>
          )}
        </header>

        {/* ── Portrait ────────────────────────────────────────────────────── */}
        {(char.portraitUrl || char.portrait) && (
          <div style={{ width: "calc(100% + 56px)", marginLeft: -28, marginRight: -28, marginBottom: 44, overflow: "hidden", borderRadius: 4 }}>
            <img src={char.portraitUrl || char.portrait} alt={char.name} style={{ width: "100%", display: "block" }} />
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

        {/* ── Private content (requires unlock) ───────────────────────────── */}
        {unlockState === "unlocked" ? (
          <>
            {/* ── Stats block ───────────────────────────────────────────────── */}
            <div style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 4, padding: "28px 30px", marginBottom: 44, isolation: "isolate" }}>
              {/* HP, Hit Dice & Armor */}
              {((char.hpMax ?? char.hp ?? 0) > 0 || char.hitDice || char.armorType || char.armorTotal > 0) && (() => {
                const acBonus      = _itemBonuses["Armor"] || 0;
                const effectiveAc  = (char.armorTotal || 0) + acBonus;
                const diceParts    = char.hitDice ? (char.hitDice.match(/(\d+|[a-zA-Z]+|[+\-])/g) || []) : [];
                const armorOpt     = ARMOR_OPTIONS.find(o => o.value === char.armorType);
                const topPad = armorOpt ? 24 : 0;

                return (
                  <div style={{ display: "flex", justifyContent: "center", gap: 52, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {(char.hpMax ?? char.hp ?? 0) > 0 && (
                      <div style={{ textAlign: "center", paddingTop: topPad }}>
                        {/* current / max display — read-only reference; controls live in Combat tab */}
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 44, color: pal.gem, lineHeight: 1 }}>
                            {hpCurrent}
                          </span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.textMuted, lineHeight: 1 }}>/</span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 30, color: pal.accent, lineHeight: 1 }}>{hpMax}</span>
                        </div>
                        {/* temp HP badge */}
                        {tempHP > 0 && (
                          <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.accentBright, letterSpacing: "0.08em", marginTop: 2 }}>
                            +{tempHP} temp
                          </div>
                        )}
                        {/* HP bar */}
                        {hpMax > 0 && (
                          <div style={{ width: "100%", height: 4, borderRadius: 2, background: pal.border, marginTop: 6, overflow: "hidden", minWidth: 80 }}>
                            <div style={{
                              width: `${Math.max(0, Math.min(100, hpPct * 100))}%`,
                              height: "100%", borderRadius: 2,
                              background: hpBarColor, transition: "width 0.25s, background-color 0.25s",
                            }} />
                          </div>
                        )}
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 5 }}>Hit Points</div>
                        {hpBonus !== 0 && (
                          <div style={{ fontFamily: pal.fontBody, fontSize: 11, color: pal.accent, fontStyle: "italic", opacity: 0.8, marginTop: 2 }}>
                            {char.hpMax ?? char.hp} base {hpBonus > 0 ? "+" : ""}{hpBonus} item
                          </div>
                        )}
                      </div>
                    )}
                    {char.hitDice && (
                      <div style={{ textAlign: "center", paddingTop: topPad }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
                          {diceParts.map((part, i) => (
                            <span key={i} style={{
                              fontFamily: pal.fontDisplay,
                              fontSize: /^\d+$/.test(part) ? 44 : 22,
                              color: pal.accent, lineHeight: 1,
                            }}>{part}</span>
                          ))}
                        </div>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 5 }}>Hit Dice</div>
                      </div>
                    )}
                    {(armorOpt || char.armorTotal > 0) && (
                      <div style={{ textAlign: "center" }}>
                        {armorOpt && (
                          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent, marginBottom: 5 }}>
                            {armorOpt.label}{armorOpt.speed ? ` · ${armorOpt.speed}` : ""}
                          </div>
                        )}
                        {char.armorTotal > 0 && (
                          <>
                            <div style={{ fontFamily: pal.fontDisplay, fontSize: 44, color: pal.accentBright, lineHeight: 1 }}>{effectiveAc}</div>
                            {acBonus !== 0 && (
                              <div style={{ fontFamily: pal.fontBody, fontSize: 11, color: pal.accent, fontStyle: "italic", opacity: 0.8, marginTop: 2 }}>
                                {char.armorTotal} base {acBonus > 0 ? "+" : ""}{acBonus} item
                              </div>
                            )}
                          </>
                        )}
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginTop: 5 }}>
                          Armor
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <HR color={pal.border} />

              <div style={secHead}>Ability Scores · Level {char.level}</div>

              {(() => {
                // Collect individual item mod sources per attribute (keyed by attribute name)
                const modSources = {}; // { "Strength": [{ source: "Longsword", value: 2 }, …] }
                [...(char.weapons||[]), ...(char.equipment||[])].forEach(item => {
                  (item.mods||[]).forEach(({ attribute, value }) => {
                    const v = parseModInt(value);
                    if (!isNaN(v)) {
                      (modSources[attribute] = modSources[attribute] || []).push({ source: item.name, value: v });
                    }
                  });
                });

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px 8px", marginBottom: 8, justifyContent: "center" }}>
                    {char.stats.map(({ stat, score, note }) => {
                      const baseMod    = modOf(score);
                      const itemMods   = modSources[stat] || [];
                      const itemBonus  = itemMods.reduce((s, m) => s + m.value, 0);
                      const totalMod   = baseMod + itemBonus;
                      const col        = score >= 14 ? pal.gem : score <= 8 ? pal.gemLow : pal.accent;
                      // Flyout sources: only item contributions (score + baseMod shown separately at top)
                      const sources   = itemMods;
                      const showBadge  = totalMod !== 0;
                      const flyoutOpen = hoveredStat === stat;
                      const circleHandlers = {
                        onMouseEnter: () => setHoveredStat(stat),
                        onMouseLeave: () => setHoveredStat(null),
                        onClick: e => { e.stopPropagation(); setHoveredStat(hoveredStat === stat ? null : stat); },
                      };
                      return (
                        <div key={stat} style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0, marginLeft: 8, marginBottom: 6 }}>
                            {/* Main score circle */}
                            <div
                              {...circleHandlers}
                              style={{
                                width: 44, height: 44, borderRadius: "50%",
                                border: `1px solid ${col}55`, background: `${col}14`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: col, lineHeight: 1 }}>{score}</div>
                            </div>
                            {/* Modifier badge — hidden when +0 */}
                            {showBadge && (
                              <div
                                {...circleHandlers}
                                style={{
                                  position: "absolute", bottom: -6, left: -8,
                                  width: 26, height: 26, borderRadius: "50%",
                                  background: col, border: `2px solid ${pal.surfaceSolid}`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer", zIndex: 2,
                                }}
                              >
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: pal.bg, lineHeight: 1, letterSpacing: "-0.02em" }}>
                                  {fmtMod(totalMod)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div>
                            <div style={{ fontFamily: pal.fontUI, fontSize: 14, color: pal.accentBright, letterSpacing: "0.06em" }}>{stat}</div>
                            <div style={{ fontFamily: pal.fontBody, fontSize: 12, color: pal.textMuted, marginTop: 2 }}>{note}</div>
                          </div>

                          {/* Flyout */}
                          {flyoutOpen && (
                            <div style={{
                              position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                              zIndex: 20, pointerEvents: "none",
                              background: pal.surfaceSolid, border: `1px solid ${pal.border}`,
                              borderRadius: 4, padding: "12px 16px", minWidth: 180,
                              boxShadow: `0 4px 20px rgba(0,0,0,0.45)`,
                              whiteSpace: "nowrap",
                            }}>
                              {/* Stat name + raw score */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20, marginBottom: 10 }}>
                                <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted }}>
                                  {stat}
                                </div>
                                <div style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: col, lineHeight: 1 }}>
                                  {score}
                                </div>
                              </div>
                              <div style={{ borderTop: `1px solid ${pal.border}`, marginBottom: 8 }} />
                              {/* Base modifier row (calculated, not stored data) */}
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: sources.length > 0 ? 4 : 0 }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>Score modifier</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: baseMod >= 0 ? pal.gem : pal.gemLow }}>{fmtMod(baseMod)}</span>
                              </div>
                              {/* Item mod rows */}
                              {sources.map((s, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: i < sources.length - 1 ? 4 : 0 }}>
                                  <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textBody }}>{s.source}</span>
                                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: s.value >= 0 ? pal.gem : pal.gemLow }}>{fmtMod(s.value)}</span>
                                </div>
                              ))}
                              {/* Total: score + all contributions */}
                              <div style={{ borderTop: `1px solid ${pal.border}`, margin: "6px 0" }} />
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, fontStyle: "italic" }}>Total</span>
                                <span style={{ fontFamily: pal.fontDisplay, fontSize: 13, color: col }}>{score + totalMod}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

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

              {/* ── Three-tab strip: Inventory | Persona | Combat ─────────── */}
              <HR color={pal.border} />
              <div style={{
                display: "flex", margin: "0 -30px 24px",
              }}>
                {[
                  {
                    key: "loadout",
                    label: "Inventory",
                    icon: (active) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="3" y1="3" x2="17" y2="17" stroke={active ? pal.accentBright : pal.textMuted} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="17" y1="3" x2="3" y2="17" stroke={active ? pal.accentBright : pal.textMuted} strokeWidth="2" strokeLinecap="round"/>
                        <rect x="2" y="1" width="3" height="5" rx="1" fill={active ? pal.accentBright : pal.textMuted} transform="rotate(45 3 3)"/>
                        <rect x="15" y="1" width="3" height="5" rx="1" fill={active ? pal.accentBright : pal.textMuted} transform="rotate(-45 17 3)"/>
                      </svg>
                    ),
                  },
                  {
                    key: "persona",
                    label: "Persona",
                    icon: (active) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 5 Q4 2 10 2 Q16 2 16 5 L16 11 Q16 16 10 17 Q7 17 5.5 15" stroke={active ? pal.accentBright : pal.textMuted} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                        <path d="M4 5 L4 11 Q4 14 5.5 15" stroke={active ? pal.accentBright : pal.textMuted} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                        <circle cx="7.5" cy="8" r="1.2" fill={active ? pal.accentBright : pal.textMuted}/>
                        <circle cx="12.5" cy="8" r="1.2" fill={active ? pal.accentBright : pal.textMuted}/>
                        <path d="M7.5 12 Q10 13.5 12.5 12" stroke={active ? pal.accentBright : pal.textMuted} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    key: "combat",
                    label: "Combat",
                    icon: (active) => (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2 L17 5 L17 10 Q17 15 10 18 Q3 15 3 10 L3 5 Z" stroke={active ? pal.accentBright : pal.textMuted} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
                        <path d="M10 6 L10 13 M7 9.5 L13 9.5" stroke={active ? pal.accentBright : pal.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                ].map((tab, idx, arr) => {
                  const isActive = combatTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setTab(tab.key)}
                      style={{
                        flex: 1,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: 6, height: 64,
                        fontFamily: pal.fontUI, fontSize: 13,
                        letterSpacing: "0.2em", textTransform: "uppercase",
                        cursor: "pointer",
                        background: isActive ? pal.accentDim : "transparent",
                        border: `1px solid ${isActive ? pal.accent : pal.border}`,
                        borderRight: idx < arr.length - 1 ? "none" : `1px solid ${isActive ? pal.accent : pal.border}`,
                        color: isActive ? pal.accentBright : pal.textMuted,
                        transition: "border-color 0.15s, background 0.15s, color 0.15s",
                      }}
                    >
                      {tab.icon(isActive)}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Inventory tab ──────────────────────────────────────────── */}
              {combatTab === "loadout" && (
                <>
                  <div className="loadout-grid">
                    {/* Weapons column */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim }}>Weapons</div>
                        {onSave && <button onClick={() => setEditingItem({ listType: "weapons", item: null })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12 }}>+ Add Weapon</button>}
                      </div>
                      {(char.weapons||[]).length > 0 ? (
                        char.weapons.map(item => {
                          const expanded = expandedItems.has(item.id);
                          return (
                            <div key={item.id} onClick={() => item.description && toggleExpanded(item.id)} style={{
                              padding: "9px 0", borderBottom: `1px solid ${pal.border}`,
                              cursor: item.description ? "pointer" : "default",
                            }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.text }}>{item.name}</span>
                                {item.mods?.length > 0 && (
                                  <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted }}>
                                    {item.mods.map(m => `${m.attribute} ${m.value}`).join(" · ")}
                                  </span>
                                )}
                                {item.description && (
                                  <span style={{ marginLeft: "auto", color: pal.accentDim, fontSize: 11, fontFamily: pal.fontUI }}>{expanded ? "▲" : "▼"}</span>
                                )}
                              </div>
                              {expanded && item.description && (
                                <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, marginTop: 6, lineHeight: 1.6, fontStyle: "italic" }}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No weapons.</div>
                      )}
                    </div>
                    {/* Equipment column */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim }}>Equipment</div>
                        {onSave && <button onClick={() => setEditingItem({ listType: "equipment", item: null, showType: true })} style={{ ...inputStyle, width: "auto", padding: "5px 12px", fontSize: 12 }}>+ Add Item</button>}
                      </div>
                      {(char.equipment||[]).length > 0 ? (
                        char.equipment.map(item => {
                          const expanded = expandedItems.has(item.id);
                          return (
                            <div key={item.id} onClick={() => item.description && toggleExpanded(item.id)} style={{
                              padding: "9px 0", borderBottom: `1px solid ${pal.border}`,
                              cursor: item.description ? "pointer" : "default",
                            }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.text }}>{item.name}</span>
                                {item.type && (
                                  <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", color: pal.accent, opacity: 0.75 }}>{item.type}</span>
                                )}
                                {item.mods?.length > 0 && (
                                  <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em", color: pal.textMuted }}>
                                    {item.mods.map(m => `${m.attribute} ${m.value}`).join(" · ")}
                                  </span>
                                )}
                                {item.description && (
                                  <span style={{ marginLeft: "auto", color: pal.accentDim, fontSize: 11, fontFamily: pal.fontUI }}>{expanded ? "▲" : "▼"}</span>
                                )}
                              </div>
                              {expanded && item.description && (
                                <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody, marginTop: 6, lineHeight: 1.6, fontStyle: "italic" }}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic" }}>No equipment.</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── Persona tab ────────────────────────────────────────────── */}
              {combatTab === "persona" && (
                <>
                  {(char.inPlay||[]).length > 0 ? (
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
                  ) : (
                    <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.textMuted, fontStyle: "italic" }}>
                      No persona traits yet. Add them in edit mode under Persona Traits.
                    </div>
                  )}
                </>
              )}

              {/* ── Combat tab ─────────────────────────────────────────────── */}
              {combatTab === "combat" && (
                <div style={{
                  border: isActiveTurn ? `1px solid ${pal.accent}` : "1px solid transparent",
                  borderRadius: 8,
                  padding: isActiveTurn ? "14px 14px 10px" : 0,
                  background: isActiveTurn ? `${pal.accent}10` : "transparent",
                  boxShadow: isActiveTurn ? `0 0 0 1px ${pal.accent}22, 0 0 18px ${pal.accent}22` : "none",
                  transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
                }}>
                  {isActiveTurn && (
                    <div style={{
                      marginBottom: 16,
                      padding: "10px 14px",
                      borderRadius: 5,
                      background: pal.accentDim,
                      border: `1px solid ${pal.accent}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}>
                      <div>
                        <div style={{
                          fontFamily: pal.fontUI,
                          fontSize: 11,
                          letterSpacing: "0.26em",
                          textTransform: "uppercase",
                          color: pal.accentBright,
                          marginBottom: 2,
                        }}>Your Turn</div>
                        <div style={{
                          fontFamily: pal.fontBody,
                          fontSize: 14,
                          color: pal.textBody,
                        }}>You are the active combatant in initiative.</div>
                      </div>
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: pal.accentBright,
                        boxShadow: `0 0 10px ${pal.accentBright}`,
                        flexShrink: 0,
                      }} />
                    </div>
                  )}
                  {/* Concentration banner */}
                  {char.concentration?.active && (
                    <div style={{
                      background: `rgba(${pal.name === "Vellum" ? "140,110,70" : "160,104,64"},0.10)`,
                      border: `1px solid ${pal.accent}`,
                      borderRadius: 4, padding: "11px 16px", marginBottom: 18,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 9, height: 9, borderRadius: "50%",
                          background: pal.accentBright,
                          boxShadow: `0 0 6px ${pal.accentBright}`,
                          flexShrink: 0,
                        }} />
                        <div>
                          <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: pal.textMuted, display: "block", marginBottom: 1 }}>Concentrating on</span>
                          <span style={{ fontFamily: pal.fontDisplay, fontSize: 15, color: pal.accentBright }}>{char.concentration.spell}</span>
                        </div>
                      </div>
                      {slug && (
                        <button
                          onClick={() => {
                            const prev = char.concentration;
                            const conc = { active: false, spell: "" };
                            setChar(c => ({ ...c, concentration: conc }));
                            applySessionPatch({ concentration: conc }, { concentration: prev }).catch(() => {});
                          }}
                          style={{
                            background: "transparent", border: `1px solid ${pal.border}`,
                            borderRadius: 3, color: pal.textMuted,
                            fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em",
                            textTransform: "uppercase", padding: "5px 12px", cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >Drop Concentration</button>
                      )}
                    </div>
                  )}

                  {/* Concentration set input (when not active) */}
                  {slug && !char.concentration?.active && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Spell name…"
                        value={concSpellInput}
                        onChange={e => setConcSpellInput(e.target.value)}
                        style={{
                          background: pal.surface, border: `1px solid ${pal.border}`,
                          borderRadius: 3, color: pal.text, fontFamily: pal.fontBody,
                          fontSize: 14, padding: "6px 10px", outline: "none", flex: 1,
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter" && concSpellInput.trim()) {
                            const prev = char.concentration;
                            const conc = { active: true, spell: concSpellInput.trim() };
                            setChar(c => ({ ...c, concentration: conc }));
                            applySessionPatch({ concentration: conc }, { concentration: prev }).catch(() => {});
                            setConcSpellInput("");
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (!concSpellInput.trim()) return;
                          const prev = char.concentration;
                          const conc = { active: true, spell: concSpellInput.trim() };
                          setChar(c => ({ ...c, concentration: conc }));
                          applySessionPatch({ concentration: conc }, { concentration: prev }).catch(() => {});
                          setConcSpellInput("");
                        }}
                        style={{
                          background: pal.accentDim, border: `1px solid ${pal.accent}`,
                          borderRadius: 3, color: pal.accentBright,
                          fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em",
                          textTransform: "uppercase", padding: "6px 12px", cursor: "pointer",
                          opacity: concSpellInput.trim() ? 1 : 0.5,
                        }}
                      >Set Concentration</button>
                    </div>
                  )}

                  {/* HP tracker */}
                  {(hpMax > 0) && (
                    <div style={{
                      background: pal.surface, border: `1px solid ${pal.border}`,
                      borderRadius: 4, padding: "16px 18px", marginBottom: 18,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        {/* − button */}
                        {slug && (
                          <button
                            onClick={() => {
                              const delta = -1;
                              const newVal = Math.max(0, hpCurrent + delta);
                              if (newVal === hpCurrent) return;
                              hpPendingDelta.current += delta;
                              markSessionExpected({ hpCurrent: newVal });
                              setChar(c => ({ ...c, hpCurrent: newVal }));
                              hpFlushRef.current?.();
                            }}
                            style={{
                              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                              background: pal.accentDim, border: `1px solid ${pal.accent}`,
                              color: pal.accentBright, fontFamily: pal.fontDisplay,
                              fontSize: 24, lineHeight: 1, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >−</button>
                        )}
                        {/* current / max with tap-to-edit */}
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                            {hpEditMode ? (
                              <input
                                type="number"
                                autoFocus
                                defaultValue={hpCurrent}
                                style={{
                                  fontFamily: pal.fontDisplay, fontSize: 40, color: pal.gem, lineHeight: 1,
                                  background: pal.surface, border: `1px solid ${pal.accent}`, borderRadius: 3,
                                  width: 80, textAlign: "center", outline: "none", padding: "0 4px",
                                }}
                                onBlur={e => {
                                  const val = Math.max(0, Math.min(hpMax, parseInt(e.target.value) || 0));
                                  const prev = hpCurrent;
                                  setChar(c => ({ ...c, hpCurrent: val }));
                                  applySessionPatch({ hpCurrent: val }, { hpCurrent: prev }).catch(() => {});
                                  setHpEditMode(false);
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter") e.target.blur();
                                  if (e.key === "Escape") setHpEditMode(false);
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => slug && setHpEditMode(true)}
                                title={slug ? "Tap to set HP directly" : undefined}
                                style={{ fontFamily: pal.fontDisplay, fontSize: 48, color: pal.gem, lineHeight: 1, cursor: slug ? "pointer" : "default" }}
                              >{hpCurrent}</span>
                            )}
                            <span style={{ fontFamily: pal.fontDisplay, fontSize: 24, color: pal.textMuted, lineHeight: 1 }}>/</span>
                            <span style={{ fontFamily: pal.fontDisplay, fontSize: 32, color: pal.accent, lineHeight: 1 }}>{hpMax}</span>
                          </div>
                          <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.textMuted, marginTop: 3 }}>Hit Points</div>
                          {tempHP > 0 && (
                            <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.accentBright, letterSpacing: "0.08em", marginTop: 2 }}>+{tempHP} temp</div>
                          )}
                        </div>
                        {/* + button */}
                        {slug && (
                          <button
                            onClick={() => {
                              const delta = 1;
                              const newVal = Math.min(hpMax, hpCurrent + delta);
                              if (newVal === hpCurrent) return;
                              hpPendingDelta.current += delta;
                              markSessionExpected({ hpCurrent: newVal });
                              setChar(c => ({ ...c, hpCurrent: newVal }));
                              hpFlushRef.current?.();
                            }}
                            style={{
                              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                              background: pal.accentDim, border: `1px solid ${pal.accent}`,
                              color: pal.accentBright, fontFamily: pal.fontDisplay,
                              fontSize: 24, lineHeight: 1, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >+</button>
                        )}
                      </div>
                      {/* HP bar */}
                      <div style={{ width: "100%", height: 5, borderRadius: 3, background: pal.border, marginTop: 12, overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.max(0, Math.min(100, hpPct * 100))}%`,
                          height: "100%", borderRadius: 3,
                          background: hpBarColor, transition: "width 0.25s, background-color 0.25s",
                        }} />
                      </div>
                      {/* Temp HP row */}
                      {slug && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                          <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, flexShrink: 0 }}>Temp HP</span>
                          <input
                            type="number"
                            min={0}
                            value={tempHP}
                            onChange={e => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setChar(c => ({ ...c, tempHP: val }));
                              markSessionExpected({ tempHP: val });
                              tempHpFlushRef.current?.();
                            }}
                            style={{
                              background: pal.surface, border: `1px solid ${pal.border}`,
                              borderRadius: 3, color: pal.text, fontFamily: pal.fontBody,
                              fontSize: 14, padding: "4px 8px", outline: "none", width: 72,
                              textAlign: "center",
                            }}
                          />
                        </div>
                      )}
                      {/* Death saves at 0 HP */}
                      {hpCurrent === 0 && hpMax > 0 && (
                        <div style={{ marginTop: 14, borderTop: `1px solid ${pal.border}`, paddingTop: 12 }}>
                          <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8, textAlign: "center" }}>Death Saves</div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 6 }}>
                            <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: pal.gem, textTransform: "uppercase", minWidth: 54, textAlign: "right" }}>Success</span>
                            {[0,1,2].map(n => <div key={n} style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${pal.gem}`, background: "transparent" }} />)}
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: "#c06060", textTransform: "uppercase", minWidth: 54, textAlign: "right" }}>Failure</span>
                            {[0,1,2].map(n => <div key={n} style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid #c06060", background: "transparent" }} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inspiration toggle */}
                  <button
                    onClick={() => {
                      if (!slug) return;
                      const newVal = !char.inspiration;
                      setChar(c => ({ ...c, inspiration: newVal }));
                      applySessionPatch({ inspiration: newVal }, { inspiration: !newVal }).catch(() => {});
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 16px", width: "100%", textAlign: "left",
                      background: char.inspiration ? `${pal.gem}18` : "transparent",
                      border: `1px solid ${char.inspiration ? pal.gem : pal.border}`,
                      borderRadius: 4, marginBottom: 18, cursor: slug ? "pointer" : "default",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: char.inspiration ? pal.gem : "transparent",
                      border: `2px solid ${char.inspiration ? pal.gem : pal.border}`,
                      boxShadow: char.inspiration ? `0 0 8px ${pal.gem}88, 0 0 18px ${pal.gem}33` : "none",
                      flexShrink: 0, transition: "all 0.18s",
                    }} />
                    <span style={{
                      fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: char.inspiration ? pal.accentBright : pal.textMuted,
                    }}>Inspiration</span>
                    {char.inspiration && (
                      <span style={{
                        marginLeft: "auto", fontFamily: pal.fontUI, fontSize: 11,
                        letterSpacing: "0.14em", textTransform: "uppercase", color: pal.gem,
                        background: `${pal.gem}1a`, border: `1px solid ${pal.gem}55`,
                        borderRadius: 10, padding: "2px 10px",
                      }}>Active</span>
                    )}
                  </button>

                  <div style={{ borderTop: `1px solid ${pal.border}`, margin: "4px 0 20px" }} />

                  {/* Condition grid */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 10 }}>Conditions</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {CONDITIONS.map(cond => {
                        const isActive = (char.conditions || []).includes(cond);
                        return (
                          <button
                            key={cond}
                            onClick={() => {
                              if (!slug) return;
                              const prevConds = char.conditions || [];
                              const newConds = isActive
                                ? prevConds.filter(c => c !== cond)
                                : [...prevConds, cond];
                              setChar(c => ({ ...c, conditions: newConds }));
                              applySessionPatch({ conditions: newConds }, { conditions: prevConds }).catch(() => {});
                            }}
                            style={{
                              fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em",
                              padding: "4px 12px", borderRadius: 12,
                              background: isActive ? pal.gem : "transparent",
                              border: `1px solid ${isActive ? pal.accent : pal.border}`,
                              color: isActive ? pal.bg : pal.textMuted,
                              cursor: slug ? "pointer" : "default",
                              transition: "all 0.15s",
                            }}
                          >{cond}</button>
                        );
                      })}
                    </div>

                    {/* Exhaustion counter */}
                    {slug && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: pal.textMuted }}>Exhaustion</span>
                        <button
                          onClick={() => {
                            const delta = -1;
                            const newVal = Math.max(0, (char.exhaustionLevel || 0) + delta);
                            if (newVal === (char.exhaustionLevel || 0)) return;
                            exhPendingDelta.current += delta;
                            markSessionExpected({ exhaustionLevel: newVal });
                            setChar(c => ({ ...c, exhaustionLevel: newVal }));
                            exhFlushRef.current?.();
                          }}
                          style={{
                            width: 26, height: 26, borderRadius: "50%",
                            background: "transparent", border: `1px solid ${pal.border}`,
                            color: pal.textMuted, cursor: "pointer", fontSize: 16,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >−</button>
                        <span style={{ fontFamily: pal.fontDisplay, fontSize: 20, color: (char.exhaustionLevel || 0) > 0 ? pal.gem : pal.textMuted, minWidth: 20, textAlign: "center" }}>
                          {char.exhaustionLevel || 0}
                        </span>
                        <button
                          onClick={() => {
                            const delta = 1;
                            const newVal = Math.min(6, (char.exhaustionLevel || 0) + delta);
                            if (newVal === (char.exhaustionLevel || 0)) return;
                            exhPendingDelta.current += delta;
                            markSessionExpected({ exhaustionLevel: newVal });
                            setChar(c => ({ ...c, exhaustionLevel: newVal }));
                            exhFlushRef.current?.();
                          }}
                          style={{
                            width: 26, height: 26, borderRadius: "50%",
                            background: "transparent", border: `1px solid ${pal.border}`,
                            color: pal.textMuted, cursor: "pointer", fontSize: 16,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >+</button>
                      </div>
                    )}

                    {/* Clear all conditions */}
                    {slug && ((char.conditions || []).length > 0 || (char.exhaustionLevel || 0) > 0) && (
                      <button
                        onClick={() => {
                          const prevConds = char.conditions || [];
                          const prevExh = char.exhaustionLevel || 0;
                          setChar(c => ({ ...c, conditions: [], exhaustionLevel: 0 }));
                          applySessionPatch(
                            { conditions: [], exhaustionLevel: 0 },
                            { conditions: prevConds, exhaustionLevel: prevExh }
                          ).catch(() => {});
                        }}
                        style={{
                          background: "transparent", border: `1px solid ${pal.border}`,
                          borderRadius: 3, color: pal.textMuted,
                          fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em",
                          textTransform: "uppercase", padding: "5px 14px", cursor: "pointer",
                        }}
                      >Clear All Conditions</button>
                    )}
                  </div>

                  {/* Spell Slots */}
                  {(() => {
                    const activeSlots = (char.spellSlots || []).filter(s => s.max > 0);
                    if (activeSlots.length === 0) return null;
                    return (
                      <>
                        <div style={{ borderTop: `1px solid ${pal.border}`, margin: "4px 0 20px" }} />
                        <div>
                          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 12 }}>Spell Slots</div>
                          {activeSlots.map(slot => (
                            <div key={slot.level} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted, minWidth: 32 }}>
                                {SPELL_LEVEL_LABELS[slot.level - 1]}
                              </div>
                              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                {Array.from({ length: slot.max }, (_, i) => {
                                  const isUsed = i < (slot.used || 0);
                                  return (
                                    <div
                                      key={i}
                                      onClick={() => {
                                        if (!slug) return;
                                        const prevSlots = char.spellSlots || [];
                                        const newUsed = isUsed ? Math.max(0, slot.used - 1) : Math.min(slot.max, (slot.used || 0) + 1);
                                        const newSlots = prevSlots.map(s =>
                                          s.level === slot.level ? { ...s, used: newUsed } : s
                                        );
                                        setChar(c => ({ ...c, spellSlots: newSlots }));
                                        applySessionPatch({ spellSlots: newSlots }, { spellSlots: prevSlots }).catch(() => {});
                                      }}
                                      style={{
                                        width: 20, height: 20, borderRadius: "50%",
                                        background: isUsed ? pal.accentDim : pal.gem,
                                        border: `1px solid ${isUsed ? pal.border : pal.accent}`,
                                        cursor: slug ? "pointer" : "default",
                                        padding: 6, boxSizing: "content-box",
                                        transition: "background 0.15s",
                                        flexShrink: 0,
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              {slot.isPactMagic && (
                                <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: pal.accent, textTransform: "uppercase" }}>Pact</span>
                              )}
                            </div>
                          ))}
                          {slug && (
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button
                                onClick={() => {
                                  if (window.confirm("Long rest — reset all spell slots?")) {
                                    const prevSlots = char.spellSlots || [];
                                    const newSlots = prevSlots.map(s => ({ ...s, used: 0 }));
                                    setChar(c => ({ ...c, spellSlots: newSlots }));
                                    applySessionPatch({ spellSlots: newSlots }, { spellSlots: prevSlots }).catch(() => {});
                                  }
                                }}
                                style={{
                                  background: pal.accentDim, border: `1px solid ${pal.accent}`,
                                  borderRadius: 3, color: pal.accentBright,
                                  fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em",
                                  textTransform: "uppercase", padding: "5px 12px", cursor: "pointer",
                                }}
                              >Long Rest</button>
                              <button
                                onClick={() => {
                                  if (window.confirm("Short rest — reset Pact Magic slots?")) {
                                    const prevSlots = char.spellSlots || [];
                                    const newSlots = prevSlots.map(s => s.isPactMagic ? { ...s, used: 0 } : s);
                                    setChar(c => ({ ...c, spellSlots: newSlots }));
                                    applySessionPatch({ spellSlots: newSlots }, { spellSlots: prevSlots }).catch(() => {});
                                  }
                                }}
                                style={{
                                  background: "transparent", border: `1px solid ${pal.border}`,
                                  borderRadius: 3, color: pal.textMuted,
                                  fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.1em",
                                  textTransform: "uppercase", padding: "5px 12px", cursor: "pointer",
                                }}
                              >Short Rest</button>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Weapons quick-reference */}
                  {(char.weapons||[]).length > 0 && (
                    <>
                      <div style={{ borderTop: `1px solid ${pal.border}`, margin: "20px 0" }} />
                      <div>
                        <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.accentDim, marginBottom: 12 }}>Weapons</div>
                        {char.weapons.map(item => {
                          const expanded = expandedItems.has(item.id + "-combat");
                          const attackMod = item.mods?.find(m => m.attribute === "Attack Bonus");
                          const damageMod = item.mods?.find(m => m.attribute === "Damage");
                          return (
                            <div key={item.id} style={{
                              background: pal.surface, border: `1px solid ${pal.border}`,
                              borderRadius: 4, marginBottom: 6, overflow: "hidden",
                              transition: "border-color 0.15s",
                            }}>
                              <div
                                onClick={() => {
                                  const next = new Set(expandedItems);
                                  const key = item.id + "-combat";
                                  if (next.has(key)) next.delete(key); else next.add(key);
                                  setExpandedItems(next);
                                }}
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                              >
                                <span style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text, flex: 1 }}>{item.name}</span>
                                {attackMod && (
                                  <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", color: pal.textMuted, whiteSpace: "nowrap" }}>
                                    To-hit <span style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.accentBright }}>{attackMod.value}</span>
                                  </span>
                                )}
                                {damageMod && (
                                  <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.08em", color: pal.textMuted, whiteSpace: "nowrap", marginLeft: 4 }}>
                                    Dmg <span style={{ fontFamily: pal.fontDisplay, fontSize: 14, color: pal.accentBright }}>{damageMod.value}</span>
                                  </span>
                                )}
                                <span style={{ color: pal.textMuted, fontSize: 11, flexShrink: 0 }}>{expanded ? "▼" : "▶"}</span>
                              </div>
                              {expanded && item.description && (
                                <div style={{
                                  padding: "10px 14px 12px", fontFamily: pal.fontBody,
                                  fontSize: 14, fontStyle: "italic", color: pal.textBody,
                                  borderTop: `1px solid ${pal.border}`, lineHeight: 1.55,
                                }}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Empty state if no session data configured */}
                  {!(char.hpMax ?? char.hp ?? 0) && !(char.spellSlots||[]).length && !(char.weapons||[]).length && (
                    <div style={{
                      fontFamily: pal.fontBody, fontSize: 15, color: pal.textMuted,
                      fontStyle: "italic", textAlign: "center", padding: "20px 0",
                    }}>
                      Set up your character stats in edit mode to use in-session tracking.
                    </div>
                  )}

                  {/* Dice roller */}
                  <DiceRoller
                    weapons={char.weapons || []}
                    stats={char.stats || []}
                    pal={pal}
                    slug={slug}
                  />
                </div>
              )}
            </div>

            {/* ── Navigation ────────────────────────────────────────────────── */}
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

            {/* ── Active section content ─────────────────────────────────────── */}
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
          </>
        ) : (
          /* ── Locked state: spinner while checking, then prompt ───────────── */
          slug && (
            <div style={{
              textAlign: "center", padding: "40px 0 20px",
              borderTop: `1px solid ${pal.border}`,
            }}>
              {unlockChecking || unlockLoading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, color: pal.textMuted }}>
                  <div className="dnd-spinner" style={{ borderTopColor: pal.textMuted }} />
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 16 }}>
                    Full sheet is private
                  </div>
                  <button onClick={handleViewUnlock} style={{
                    background: "transparent", border: `1px solid ${pal.border}`,
                    borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI,
                    fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
                    padding: "8px 20px", cursor: "pointer",
                  }}>
                    🔒 Unlock with password
                  </button>
                </>
              )}
            </div>
          )
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

        {/* Item editor modal (weapons / equipment) */}
        {editingItem && (
          <ItemEditorModal
            item={editingItem.item}
            pal={pal}
            showType={editingItem.showType}
            onSave={(saved) => {
              let updatedChar = char;
              if (editingItem.item) {
                if (editingItem.listType === "weapons") {
                  updateWeapon(saved.id, saved);
                  updatedChar = { ...char, weapons: (char.weapons||[]).map(w => w.id === saved.id ? saved : w) };
                } else {
                  updateEquipment(saved.id, saved);
                  updatedChar = { ...char, equipment: (char.equipment||[]).map(e => e.id === saved.id ? saved : e) };
                }
              } else {
                if (editingItem.listType === "weapons") {
                  addWeapon(saved);
                  updatedChar = { ...char, weapons: [...(char.weapons||[]), saved] };
                } else {
                  addEquipment(saved);
                  updatedChar = { ...char, equipment: [...(char.equipment||[]), saved] };
                }
              }
              if (mode === "view" && slug) {
                applySessionPatch(
                  { [editingItem.listType]: updatedChar[editingItem.listType] },
                  { [editingItem.listType]: char[editingItem.listType] }
                ).catch(() => {});
              } else if (mode === "view") {
                onSave(updatedChar);
              }
              setEditingItem(null);
            }}
            onClose={() => setEditingItem(null)}
          />
        )}

      </div>
    </div>
  );
}
