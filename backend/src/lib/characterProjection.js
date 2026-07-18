// Shared single-character response shaping.
// Extracted from get.js (Story 35) so getSessionState.js's public `?slug=`
// variant applies the exact same stripping rules as GET /characters/{slug}.

const { verifyPassword } = require("./auth");

function stripPassword(item) {
  const { passwordHash, ...character } = item;
  return character;
}

// Privacy: filter playerNotes based on auth level.
// Unauthenticated: strip entirely. Owner: full array. DM: only sharedWithDm === true.
async function applyPlayerNotesVisibility(character, password, rawItem) {
  if (!password) {
    delete character.playerNotes;
    return character;
  }

  const auth = await verifyPassword(password, rawItem);
  if (!auth.valid) {
    delete character.playerNotes;
  } else if (auth.role === "dm") {
    const allNotes = character.playerNotes || [];
    character.playerNotes = allNotes.filter((note) => note.sharedWithDm === true);
  }
  // auth.role === "owner": return full playerNotes as-is
  return character;
}

// Normalize legacy `hp` field: if hpCurrent is absent, synthesize from hp.
// Does not modify DynamoDB — outgoing response normalization only.
function normalizeHpFields(character) {
  if (character.hpCurrent === undefined) {
    character.hpCurrent = character.hp ?? 0;
    character.hpMax = character.hpMax ?? character.hp ?? 0;
  }
  if (character.tempHP === undefined) {
    character.tempHP = 0;
  }
  return character;
}

function computeIsActiveTurn(initiative, slug) {
  const initiativeEntries = initiative?.entries ?? [];
  const sortedEntries = [...initiativeEntries].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
  const activeTurnIndex = initiative?.activeTurnIndex ?? 0;
  const activeEntry = sortedEntries[activeTurnIndex] || null;
  return activeEntry?.slug === slug;
}

module.exports = {
  stripPassword,
  applyPlayerNotesVisibility,
  normalizeHpFields,
  computeIsActiveTurn,
};
