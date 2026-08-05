// Shared party-member projection helpers.
// Used by dmParty.js, getPartyStatus.js, and getSessionState.js (Story 35) so
// all three endpoints project the exact same field sets from a raw character
// DynamoDB item, whether that item came from a Scan (old endpoints) or a
// BatchGetItem (getSessionState.js).

function pickFields(item, fields) {
  const result = {};
  for (const field of fields) {
    if (item && field in item) {
      result[field] = item[field];
    }
  }
  return result;
}

// Matches the ProjectionExpression used by dmParty.js's ScanCommand.
const DM_PARTY_FIELDS = [
  "slug", "name", "nameAlt", "palette", "portraitUrl", "hpCurrent", "hpMax", "hp", "tempHP",
  "armorTotal", "conditions", "exhaustionLevel", "concentration", "inspiration", "spellSlots",
  "spells", "level", "race", "charClass", "skills", "specialAbilities", "dmNotes", "playerNotes",
  "hitDiceCurrent", "xpCurrent", "levelingMode", "coin", "coinMode", "deathSaves",
  // Story 52 — damage flash sync fields. Not secret data.
  "lastDamagedAt", "lastDamageAmount",
];

const DM_PARTY_PROJECTION_EXPRESSION =
  "slug, #n, nameAlt, palette, portraitUrl, hpCurrent, hpMax, #hp, tempHP, armorTotal, #c, exhaustionLevel, concentration, inspiration, spellSlots, spells, #l, race, charClass, skills, specialAbilities, #dmNotes, playerNotes, hitDiceCurrent, xpCurrent, levelingMode, coin, coinMode, deathSaves, lastDamagedAt, lastDamageAmount";

const DM_PARTY_EXPRESSION_ATTRIBUTE_NAMES = {
  "#n": "name",
  "#c": "conditions",
  "#l": "level",
  "#hp": "hp",
  "#dmNotes": "dmNotes",
};

// DM projection: whitelisted fields, dmNotes defaulted, playerNotes replaced
// with a DM-visible sharedPlayerNotes subset (mirrors dmParty.js exactly).
function projectDmPartyItem(item) {
  const picked = pickFields(item, DM_PARTY_FIELDS);
  const { playerNotes, ...rest } = picked;
  const sharedPlayerNotes = (playerNotes || []).filter((note) => note.sharedWithDm === true);
  return {
    ...rest,
    dmNotes: rest.dmNotes || [],
    sharedPlayerNotes,
  };
}

// Fields visible to players in the party status strip (mirrors getPartyStatus.js).
const PLAYER_VISIBLE_FIELDS = [
  "slug", "name", "palette", "portraitUrl", "hpCurrent", "hpMax", "hp", "tempHP",
  "conditions", "concentration", "inspiration", "deathSaves",
  // Story 53 — exhaustion badge on the map token. Story 52 — damage flash sync.
  "exhaustionLevel", "lastDamagedAt", "lastDamageAmount",
];

function projectPlayerCharacter(item) {
  const projected = pickFields(item, PLAYER_VISIBLE_FIELDS);
  projected.hpCurrent = item.hpCurrent ?? item.hp ?? 0;
  projected.hpMax = item.hpMax ?? item.hp ?? 0;
  projected.tempHP = item.tempHP ?? 0;
  projected.conditions = Array.isArray(item.conditions) ? item.conditions : [];
  projected.concentration = item.concentration ?? { active: false, spell: "" };
  projected.inspiration = item.inspiration ?? false;
  projected.deathSaves = item.deathSaves ?? { successes: 0, failures: 0 };
  projected.exhaustionLevel = item.exhaustionLevel ?? 0;
  return projected;
}

module.exports = {
  DM_PARTY_FIELDS,
  DM_PARTY_PROJECTION_EXPRESSION,
  DM_PARTY_EXPRESSION_ATTRIBUTE_NAMES,
  PLAYER_VISIBLE_FIELDS,
  projectDmPartyItem,
  projectPlayerCharacter,
};
