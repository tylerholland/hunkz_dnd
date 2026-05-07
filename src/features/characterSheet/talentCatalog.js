export const CHARACTER_SKILLS = [
  "athletics",
  "awareness",
  "deception",
  "decipher",
  "heal",
  "leadership",
  "lore",
  "stealth",
  "survival",
];

export const SPECIAL_ABILITIES = [
  "bless", "cure",
  "turn", "vision",
  "hardy", "skirmish",
  "slay", "tough",
  "backstab", "lucky",
  "reflexes", "tinker",
  "cantrips", "command",
  "ritual", "summon",
  "pet", "scout",
  "volley", "wild",
];

export const TALENT_DETAILS = {
  athletics: { kind: "skill", label: "Athletics", description: "Represents strength, climbing, grappling, swimming, and other feats of physical exertion." },
  awareness: { kind: "skill", label: "Awareness", description: "Helps the character notice danger, hidden movement, and subtle details in the environment." },
  deception: { kind: "skill", label: "Deception", description: "Supports lying, disguises, feints, and misleading others convincingly." },
  decipher: { kind: "skill", label: "Decipher", description: "Covers reading codes, obscure scripts, and making sense of difficult texts or clues." },
  heal: { kind: "skill", label: "Heal", description: "Improves treating wounds, stabilizing allies, and using medical knowledge under pressure." },
  leadership: { kind: "skill", label: "Leadership", description: "Reflects rallying allies, giving commands, and projecting authority in tense moments." },
  lore: { kind: "skill", label: "Lore", description: "Represents scholarly knowledge, history, myths, and learned expertise." },
  stealth: { kind: "skill", label: "Stealth", description: "Covers moving quietly, hiding well, and avoiding detection." },
  survival: { kind: "skill", label: "Survival", description: "Helps with tracking, foraging, navigating the wild, and enduring harsh conditions." },

  bless: { kind: "special", label: "Bless", description: "Can bolster allies with a divine or supernatural boon that improves their odds." },
  cure: { kind: "special", label: "Cure", description: "Can restore health or relieve harm through magic, blessing, or restorative skill." },
  turn: { kind: "special", label: "Turn", description: "Can repel or disrupt hostile supernatural creatures such as undead or fiends." },
  vision: { kind: "special", label: "Vision", description: "Possesses heightened sight or insight beyond ordinary perception." },
  hardy: { kind: "special", label: "Hardy", description: "Endures punishment, fatigue, and adversity better than most." },
  skirmish: { kind: "special", label: "Skirmish", description: "Excels at mobility, hit-and-run attacks, and staying dangerous while moving." },
  slay: { kind: "special", label: "Slay", description: "Has an edge when bringing down a chosen foe or delivering finishing blows." },
  tough: { kind: "special", label: "Tough", description: "Can absorb more damage and keep fighting through punishment." },
  backstab: { kind: "special", label: "Backstab", description: "Deals extra harm or gains advantage when striking from surprise or weak positions." },
  lucky: { kind: "special", label: "Lucky", description: "Can twist fate at the last moment through uncanny fortune." },
  reflexes: { kind: "special", label: "Reflexes", description: "Responds quickly to danger, traps, and sudden opportunities." },
  tinker: { kind: "special", label: "Tinker", description: "Can build, repair, improvise, or manipulate tools and mechanisms." },
  cantrips: { kind: "special", label: "Cantrips", description: "Knows minor magical effects that can be used repeatedly." },
  command: { kind: "special", label: "Command", description: "Can exert forceful authority or magic that compels obedience." },
  ritual: { kind: "special", label: "Ritual", description: "Can perform longer-form magical workings without relying on direct combat casting." },
  summon: { kind: "special", label: "Summon", description: "Can call allies, spirits, or constructs into service." },
  pet: { kind: "special", label: "Pet", description: "Maintains a companion creature that can assist in travel, scouting, or battle." },
  scout: { kind: "special", label: "Scout", description: "Excels at ranging ahead, recon, and reading terrain or enemy movement." },
  volley: { kind: "special", label: "Volley", description: "Can unleash repeated or wide-area ranged attacks with strong battlefield presence." },
  wild: { kind: "special", label: "Wild", description: "Channels primal, feral, or nature-touched power in distinctive ways." },
};

export function getTalentDetail(key) {
  return TALENT_DETAILS[key] || {
    kind: "special",
    label: key,
    description: "",
  };
}

export function getTalentTooltip(key) {
  const detail = getTalentDetail(key);
  const kindLabel = detail.kind === "skill" ? "Skill" : "Special Ability";
  return `${kindLabel}: ${detail.label}`;
}

export function getOrderedTalentEntries(skills = [], specialAbilities = []) {
  const selectedSkills = new Set(skills || []);
  const selectedAbilities = new Set(specialAbilities || []);

  return [
    ...CHARACTER_SKILLS.filter((key) => selectedSkills.has(key)).map((key) => ({ key, ...getTalentDetail(key) })),
    ...SPECIAL_ABILITIES.filter((key) => selectedAbilities.has(key)).map((key) => ({ key, ...getTalentDetail(key) })),
  ];
}
