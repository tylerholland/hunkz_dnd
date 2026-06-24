const INITIATIVE_SLUG = "initiative";
const NPC_COMBAT_SLUG = "npc-combat";
const ROLL_HISTORY_SLUG = "roll-history";
const MAP_LIBRARY_SLUG = "map-library";
const PARTY_ROSTER_SLUG = "party-roster";
const NPC_LIBRARY_SLUG = "npc-library";
const COUNTER_WHEELS_SLUG = "counter-wheels";
const RESERVED_CHARACTER_SLUGS = new Set([INITIATIVE_SLUG, NPC_COMBAT_SLUG, ROLL_HISTORY_SLUG, MAP_LIBRARY_SLUG, PARTY_ROSTER_SLUG, NPC_LIBRARY_SLUG, COUNTER_WHEELS_SLUG]);

function isReservedCharacterSlug(slug) {
  return RESERVED_CHARACTER_SLUGS.has(slug);
}

function filterPublicCharacterItems(items = []) {
  return items.filter((item) => !isReservedCharacterSlug(item?.slug));
}

module.exports = {
  INITIATIVE_SLUG,
  NPC_COMBAT_SLUG,
  ROLL_HISTORY_SLUG,
  MAP_LIBRARY_SLUG,
  PARTY_ROSTER_SLUG,
  NPC_LIBRARY_SLUG,
  COUNTER_WHEELS_SLUG,
  RESERVED_CHARACTER_SLUGS,
  isReservedCharacterSlug,
  filterPublicCharacterItems,
};
