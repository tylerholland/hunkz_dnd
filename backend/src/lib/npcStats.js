// NPC attacks and defense (design/prototypes/npc-attacks.html), set by the DM
// on a library creature and copied to NPCs in play. DM-only: the public NPC
// projection in getSessionState never includes them. Keep in sync with
// src/features/dmDashboard/npcStats.js.
//
//   defense: { kind: "ac", ac: 13 } | { kind: "roll", roll: "1d20+3", name: "Dodge" }
//   attacks: [{ id, name, hit: "1d20+8", damage: "1d4+2", look: "lash" }]
// `hit` is the whole attack roll (a d20 plus the creature's bonus, in D&D).

const LOOKS = [
  "bite", "claw", "lash", "sting", "slam", "breath", "spit",
  "cut", "chop", "flurry", "arrow", "rock", "fire", "force", "bolt",
];
const MAX_ATTACKS = 8;

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// A dice expression like 1d20+8, 2d4+2 or 7 — kept as typed if it reads.
const DICE = /^\s*(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*\s*$/i;
const dice = (v) => {
  const s = str(v, 40);
  return DICE.test(s) ? s.replace(/\s+/g, "") : "";
};

function normalizeDefense(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.kind === "roll") {
    const roll = dice(raw.roll);
    return roll ? { kind: "roll", roll, name: str(raw.name, 30) || "Defense" } : null;
  }
  const ac = parseInt(raw.ac, 10);
  return Number.isFinite(ac) && ac >= 0 && ac <= 40 ? { kind: "ac", ac } : null;
}

function normalizeAttacks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a, i) => ({
      id: str(a?.id, 40) || `atk-${i + 1}`,
      name: str(a?.name, 40),
      hit: dice(a?.hit),
      damage: dice(a?.damage),
      look: LOOKS.includes(a?.look) ? a.look : "cut",
    }))
    .filter((a) => a.name && a.hit && a.damage)
    .slice(0, MAX_ATTACKS);
}

module.exports = { LOOKS, normalizeDefense, normalizeAttacks };
