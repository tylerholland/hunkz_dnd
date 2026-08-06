// Story 54 — Invisible Token Veil.
// The server computes one boolean per map token, `invisible`, so the DM's `◇`
// marker and the player-side omission can never drift (they're driven by the
// exact same value). See Story 54 Architect Notes: "the DM client must not
// re-derive invisibility independently."

function isInvisibleConditions(conditions) {
  if (!Array.isArray(conditions)) return false;
  return conditions.some(
    (c) => typeof c === "string" && c.trim().toLowerCase() === "invisible"
  );
}

// Resolvers return `null` for an unresolvable subject (fail open — render,
// don't hide) or a `conditions[]` array (possibly empty) for a resolved one.
function annotateTokensWithInvisibility(tokens, { getCharacterConditions, getNpcConditions }) {
  return (tokens || []).map((t) => {
    let conditions = null;
    if (t.type === "character" && getCharacterConditions) {
      conditions = getCharacterConditions(t.sourceId);
    } else if (t.type === "npc" && getNpcConditions) {
      conditions = getNpcConditions(t.sourceId);
    }
    const invisible = conditions !== null && isInvisibleConditions(conditions);
    return { ...t, invisible };
  });
}

// Public/player-facing variant: an invisible NPC token is a true absence, not
// a hinted/diminished one — dropped from the array entirely, not flagged.
// PC tokens are never omitted (a player always sees their veiled ally).
function omitInvisibleNpcTokensForPlayers(tokens) {
  return (tokens || []).filter((t) => !(t.type === "npc" && t.invisible === true));
}

function makeCharacterConditionsResolver(rawItemsBySlug) {
  return (slug) => {
    const item = rawItemsBySlug?.get ? rawItemsBySlug.get(slug) : undefined;
    if (!item) return null;
    return Array.isArray(item.conditions) ? item.conditions : [];
  };
}

function makeNpcConditionsResolver(npcCombat) {
  const byId = new Map((npcCombat?.npcs || []).map((n) => [n.id, n]));
  return (id) => {
    const npc = byId.get(id);
    if (!npc) return null;
    return Array.isArray(npc.conditions) ? npc.conditions : [];
  };
}

// Story 55 (ADR-023 point 4) — should `lastDamageFrom` be stripped from the
// public payload? True when the referenced attacker is itself invisible
// (Story 54's resolver, reused) or linked to a hidden initiative entry (the
// DM's existing secrecy lever) — a bolt from an empty square leaks the
// attacker's position as effectively as rendering its token. Fails open
// (false) for an unresolvable ref, matching this module's existing
// fail-open convention — an orphaned `sourceId` renders elsewhere too.
function shouldStripAttackerRef(attackerRef, { getCharacterConditions, getNpcConditions, hiddenSubjectKeys }) {
  if (!attackerRef || !attackerRef.type || !attackerRef.sourceId) return false;
  const key = `${attackerRef.type}:${attackerRef.sourceId}`;
  if (hiddenSubjectKeys?.has(key)) return true;

  let conditions = null;
  if (attackerRef.type === "character" && getCharacterConditions) {
    conditions = getCharacterConditions(attackerRef.sourceId);
  } else if (attackerRef.type === "npc" && getNpcConditions) {
    conditions = getNpcConditions(attackerRef.sourceId);
  }
  return conditions !== null && isInvisibleConditions(conditions);
}

module.exports = {
  isInvisibleConditions,
  annotateTokensWithInvisibility,
  omitInvisibleNpcTokensForPlayers,
  makeCharacterConditionsResolver,
  makeNpcConditionsResolver,
  shouldStripAttackerRef,
};
