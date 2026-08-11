export const modOf = (s) => Math.floor((s - 10) / 2);
export const fmtMod = (m) => m >= 0 ? `+${m}` : `${m}`;
export const uid = () => "id" + Date.now() + Math.random().toString(36).slice(2, 7);
export const parseModInt = (v) => /^[+-]?\d+$/.test(String(v).trim()) ? parseInt(v, 10) : NaN;

// Story 56 — structured spell list.
export const SPELL_ROLES = [
  { value: "attack", label: "Attack", glyph: "✶" },
  { value: "heal", label: "Heal", glyph: "✚" },
];

export const spellRoleGlyph = (role) => SPELL_ROLES.find((r) => r.value === role)?.glyph;

// Tolerant reader for the `spells` field (ADR-024): accepts the legacy
// `string[]` shape and the structured `{ id, name, role?, description?,
// level?, toHit?, damage? }[]` shape, and anything in between (a mixed
// array from a character that has been partially migrated). Legacy string
// entries get a *deterministic* id (`legacy:<index>:<name>`) so React keys
// — and any id derived from them — stay stable across polls; never mints a
// random id here (that would remount the whole list every poll tick).
// Structured entries missing an id (shouldn't happen post-editor, but a
// hand-edited DynamoDB record could) fall back to the same deterministic
// scheme. Never mutates the input array.
export function normalizeSpells(spells) {
  if (!Array.isArray(spells)) return [];
  return spells
    .map((entry, index) => {
      if (typeof entry === "string") {
        const name = entry.trim();
        if (!name) return null;
        return { id: `legacy:${index}:${name}`, name };
      }
      if (entry && typeof entry === "object" && entry.name) {
        return { id: `legacy:${index}:${entry.name}`, ...entry };
      }
      return null;
    })
    .filter(Boolean);
}

// One shared derivation for the merged "Weapons & Attack Spells" quick-
// reference (Combat tab + session-mode combat sub-tab): weapons first, then
// role:"attack" spells, no interleaving, plus the three-way header string.
// `spells` must already be normalized (see normalizeSpells above).
export function buildAttackEntries({ weapons = [], spells = [] } = {}) {
  const weaponEntries = weapons.map((w) => ({
    id: w.id,
    kind: "weapon",
    name: w.name,
    toHit: w.mods?.find((m) => m.attribute === "Attack Bonus")?.value,
    damage: w.mods?.find((m) => m.attribute === "Damage")?.value,
    description: w.description,
  }));
  const spellEntries = spells
    .filter((s) => s.role === "attack")
    .map((s) => ({
      id: s.id,
      kind: "spell",
      name: s.name,
      toHit: s.toHit,
      damage: s.damage,
      description: s.description,
      // Story 57 — the Attack Bar's only consumer of `level` (0 = cantrip,
      // absent = unspecified/unknown, never coerced via `|| 0`, ADR-025).
      level: s.level,
    }));
  const header = weaponEntries.length > 0 && spellEntries.length > 0
    ? "Weapons & Spells"
    : spellEntries.length > 0
      ? "Spells"
      : "Weapons";
  return { entries: [...weaponEntries, ...spellEntries], weaponEntries, spellEntries, header };
}

export const RACE_OPTIONS = [
  "Human", "Elf", "Night Elf", "Wood Elf", "High Elf", "Drow", "Eladrin",
  "Dwarf", "Halfling", "Half-Elf", "Half-Orc", "Gnome", "Tiefling", "Dragonborn",
  "Aasimar", "Genasi", "Goliath", "Firbolg", "Kenku", "Tabaxi", "Tortle",
  "Triton", "Yuan-ti Pureblood", "Bugbear", "Goblin", "Hobgoblin", "Lizardfolk", "Orc",
];

export const CLASS_OPTIONS = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin",
  "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard", "Artificer",
];

export const ALIGNMENT_OPTIONS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
];

export const BACKGROUND_OPTIONS = [
  "Acolyte", "Charlatan", "Criminal", "Entertainer", "Folk Hero", "Guild Artisan",
  "Hermit", "Noble", "Outlander", "Sage", "Sailor", "Soldier", "Urchin",
  "Investigator", "Pirate", "Urban Bounty Hunter",
];

export const SUBCLASS_OPTIONS = {
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

export const ALL_SUBCLASS_OPTIONS = [...new Set(Object.values(SUBCLASS_OPTIONS).flat())];

export const BLANK_CHARACTER = {
  name: "", nameAlt: "", pronunciation: "",
  race: "", charClass: "", subclass: "",
  alignment: "", background: "", origin: "",
  level: 1, portrait: "", tagline: "", palette: "ember",
  stats: [
    { stat: "Strength", score: 10, note: "" },
    { stat: "Dexterity", score: 10, note: "" },
    { stat: "Constitution", score: 10, note: "" },
    { stat: "Wisdom", score: 10, note: "" },
    { stat: "Intelligence", score: 10, note: "" },
    { stat: "Charisma", score: 10, note: "" },
  ],
  hpMax: 0,
  hpCurrent: 0,
  tempHP: 0,
  hitDiceCurrent: null,
  armorType: "",
  armorTotal: 0,
  spells: [],
  skills: [],
  specialAbilities: [],
  spellSlots: [],
  conditions: [],
  exhaustionLevel: 0,
  concentration: { active: false, spell: "" },
  inspiration: false,
  inPlay: [],
  playerNotes: [],
  weapons: [],
  equipment: [],
  levelingMode: "milestone",
  xpCurrent: 0,
  coin: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  coinMode: "gp",
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

export const LIVE_SESSION_FIELDS = [
  "hpCurrent",
  "tempHP",
  "spellSlots",
  "conditions",
  "exhaustionLevel",
  "concentration",
  "inspiration",
  "weapons",
  "equipment",
  "playerNotes",
  "hitDiceCurrent",
  "xpCurrent",
  "coin",
];

export const ARMOR_OPTIONS = [
  { value: "none", label: "None", speed: "Fast" },
  { value: "light", label: "Light", speed: "Normal" },
  { value: "full", label: "Full", speed: "Slow" },
  { value: "shield", label: "Shield", speed: null },
];

export const MOD_ATTRIBUTES = [
  "Strength", "Dexterity", "Constitution", "Wisdom", "Intelligence", "Charisma",
  "Armor", "HP", "Attack Bonus", "Damage", "Initiative", "Speed", "Save DC",
];

export const HIT_DIE_BY_CLASS = {
  Barbarian: 12,
  Fighter: 10, Paladin: 10, Ranger: 10,
  Artificer: 8, Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};

// PHB XP thresholds by level (index 0 = unused, index 1 = XP needed to reach level 2, etc.)
// XP_THRESHOLDS[n] = total XP required to be at level n
export const XP_THRESHOLDS = [
  0,       // level 0 (unused)
  0,       // level 1 — starts here
  300,     // level 2
  900,     // level 3
  2700,    // level 4
  6500,    // level 5
  14000,   // level 6
  23000,   // level 7
  34000,   // level 8
  48000,   // level 9
  64000,   // level 10
  85000,   // level 11
  100000,  // level 12
  120000,  // level 13
  140000,  // level 14
  165000,  // level 15
  195000,  // level 16
  225000,  // level 17
  265000,  // level 18
  305000,  // level 19
  355000,  // level 20
];

export const COIN_COLORS = {
  cp: "#a07050",
  sp: "#9aabb8",
  ep: "#8f8b80",
  gp: "#c8a040",
  pp: "#c8d0e0",
};

export const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned",
  "Prone", "Restrained", "Stunned", "Unconscious",
];

export const SPELL_LEVEL_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
