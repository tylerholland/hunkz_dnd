const INITIATIVE_SLUG = "initiative";
const NPC_COMBAT_SLUG = "npc-combat";
const RESERVED_CHARACTER_SLUGS = new Set([INITIATIVE_SLUG, NPC_COMBAT_SLUG]);

function isReservedCharacterSlug(slug) {
  return RESERVED_CHARACTER_SLUGS.has(slug);
}

module.exports = { INITIATIVE_SLUG, NPC_COMBAT_SLUG, RESERVED_CHARACTER_SLUGS, isReservedCharacterSlug };
