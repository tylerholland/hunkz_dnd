const INITIATIVE_SLUG = "initiative";
const NPC_COMBAT_SLUG = "npc-combat";
const ROLL_HISTORY_SLUG = "roll-history";
const MAP_LIBRARY_SLUG = "map-library";
const PARTY_ROSTER_SLUG = "party-roster";
const NPC_LIBRARY_SLUG = "npc-library";
const COUNTER_WHEELS_SLUG = "counter-wheels";
// DM-configurable table rules (e.g. the ability-check dice). Read by every
// client via getSessionState.js; written by putHouseRules.js (DM only).
const HOUSE_RULES_SLUG = "house-rules";
// Story 36b — stale-client auto-refresh. Written directly by deploy.sh via
// `aws dynamodb put-item` (no Lambda write path); read by getSessionState.js.
const APP_META_SLUG = "app-meta";
// Roll-history archive pages ("roll-history-archive:0".."5" + ":index"):
// events that age out of the live feed move here instead of being dropped.
const ROLL_HISTORY_ARCHIVE_PREFIX = "roll-history-archive:";
// Story 69 — the Chronicle: an index of chapters + session metadata, and one
// record per session ("chronicle-session:<id>") holding its event snapshot,
// summary and recollections.
const CHRONICLE_SLUG = "chronicle";
const CHRONICLE_SESSION_PREFIX = "chronicle-session:";
const RESERVED_CHARACTER_SLUGS = new Set([INITIATIVE_SLUG, NPC_COMBAT_SLUG, ROLL_HISTORY_SLUG, MAP_LIBRARY_SLUG, PARTY_ROSTER_SLUG, NPC_LIBRARY_SLUG, COUNTER_WHEELS_SLUG, APP_META_SLUG, HOUSE_RULES_SLUG, CHRONICLE_SLUG]);

function isReservedCharacterSlug(slug) {
  return RESERVED_CHARACTER_SLUGS.has(slug)
    || (typeof slug === "string" && (slug.startsWith(ROLL_HISTORY_ARCHIVE_PREFIX) || slug.startsWith(CHRONICLE_SESSION_PREFIX)));
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
  APP_META_SLUG,
  HOUSE_RULES_SLUG,
  ROLL_HISTORY_ARCHIVE_PREFIX,
  CHRONICLE_SLUG,
  CHRONICLE_SESSION_PREFIX,
  RESERVED_CHARACTER_SLUGS,
  isReservedCharacterSlug,
  filterPublicCharacterItems,
};
