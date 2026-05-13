const test = require("node:test");
const assert = require("node:assert/strict");
const {
  INITIATIVE_SLUG,
  NPC_COMBAT_SLUG,
  ROLL_HISTORY_SLUG,
  PARTY_ROSTER_SLUG,
  isReservedCharacterSlug,
  filterPublicCharacterItems,
} = require("./specialItems");

test("reserved character slugs cover internal initiative and npc combat records", () => {
  assert.equal(INITIATIVE_SLUG, "initiative");
  assert.equal(NPC_COMBAT_SLUG, "npc-combat");
  assert.equal(ROLL_HISTORY_SLUG, "roll-history");
  assert.equal(PARTY_ROSTER_SLUG, "party-roster");
  assert.equal(isReservedCharacterSlug("initiative"), true);
  assert.equal(isReservedCharacterSlug("npc-combat"), true);
  assert.equal(isReservedCharacterSlug("roll-history"), true);
  assert.equal(isReservedCharacterSlug("party-roster"), true);
  assert.equal(isReservedCharacterSlug("aragorn"), false);
});

test("filterPublicCharacterItems removes reserved sentinel rows", () => {
  const items = filterPublicCharacterItems([
    { slug: "initiative", name: "Initiative" },
    { slug: "aragorn", name: "Aragorn" },
    { slug: "npc-combat", name: "NPC Combat" },
    { slug: "roll-history", name: "Roll History" },
    { slug: "party-roster", name: "Party Roster" },
    { slug: "liu-sha", name: "Liu Sha" },
  ]);

  assert.deepEqual(items.map((item) => item.slug), ["aragorn", "liu-sha"]);
});
