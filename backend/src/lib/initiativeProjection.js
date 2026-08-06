// Shared player-safe initiative projection.
// Extracted from getInitiativePublic.js (Story 35) so getSessionState.js can
// reuse the exact same entry-stripping / health-tier-derivation logic.

function buildPublicInitiativePayload(initiative, npcCombat) {
  const npcHpMap = {};
  for (const npc of npcCombat?.npcs || []) {
    if (npc?.initiativeEntryId) {
      npcHpMap[npc.initiativeEntryId] = {
        hpCurrent: npc.hpCurrent ?? 0,
        hpMax: npc.hpMax ?? 0,
      };
    }
  }

  const entries = (initiative?.entries || [])
    .filter((entry) => !entry.hidden)
    .map((entry) => {
      const publicEntry = {
        id: entry.id,
        name: entry.name,
        type: entry.type, // "pc" | "npc" | "manual"
        slug: entry.slug ?? null,
        palette: entry.palette ?? null,
      };

      // For NPC entries, derive a health tier from NPC combat data
      if (entry.type !== "pc" && entry.id && npcHpMap[entry.id]) {
        const { hpCurrent, hpMax } = npcHpMap[entry.id];
        if (typeof hpCurrent === "number" && typeof hpMax === "number" && hpMax > 0) {
          const pct = hpCurrent / hpMax;
          if (pct <= 0) {
            publicEntry.healthTier = "down";
          } else if (pct <= 0.25) {
            publicEntry.healthTier = "critical";
          } else if (pct <= 0.5) {
            publicEntry.healthTier = "wounded";
          } else {
            publicEntry.healthTier = "healthy";
          }
        }
      }

      // Never expose initiative roll value to players
      return publicEntry;
    });

  return {
    round: initiative?.round,
    activeTurnIndex: initiative?.activeTurnIndex,
    entries,
    // Story 52 — clients derive Phase B (wound halo) liveness from this; not
    // secret data (it's just "when did the current turn start").
    turnStartedAt: initiative?.turnStartedAt ?? null,
  };
}

// Story 53 — NPC conditions were never carried on the public payload before
// (initiativePublic strips entries down to healthTier). Gated on the same
// hidden-entry lever the DM already uses to keep an NPC out of the public
// initiative list — an NPC with a hidden initiative entry carries no public
// conditions either, so hiding the entry stays the single secrecy lever.
function publicNpcConditionsByNpcId(initiative, npcCombat) {
  const hiddenEntryIds = new Set(
    (initiative?.entries || []).filter((entry) => entry.hidden).map((entry) => entry.id)
  );
  const result = {};
  for (const npc of npcCombat?.npcs || []) {
    if (!npc?.id) continue;
    if (npc.initiativeEntryId && hiddenEntryIds.has(npc.initiativeEntryId)) continue;
    result[npc.id] = Array.isArray(npc.conditions) ? npc.conditions : [];
  }
  return result;
}

// Story 55 — resolve the attacker for a damage-apply write, from
// initiative.entries[activeTurnIndex]. Server-side only (ADR-022) — the
// public initiative feed strips hidden entries (buildPublicInitiativePayload
// above), so a player's `entries` array does not index-align with the DM's,
// and client-side inference would draw the tracer from the wrong creature.
// It is also racy on the DM's own map (apply damage + tap Next Turn can
// coalesce into one poll payload).
//
// Real entry shape (InitiativeTracker.jsx): { id, slug?, name, initiative,
// isPC: boolean, npcId: string|null } — there is no `entry.type` field on
// stored entries (only the public *projection* above synthesises one that
// is never actually populated); this resolver uses the real fields.
function resolveAttackerRef(initiative, target) {
  const entries = initiative?.entries || [];
  if (entries.length === 0) return null; // no active combat

  const idx = Number.isFinite(initiative?.activeTurnIndex) ? initiative.activeTurnIndex : 0;
  const entry = entries[idx];
  if (!entry) return null;

  let attacker = null;
  if (entry.isPC && typeof entry.slug === "string" && entry.slug) {
    attacker = { type: "character", sourceId: entry.slug };
  } else if (!entry.isPC && typeof entry.npcId === "string" && entry.npcId) {
    attacker = { type: "npc", sourceId: entry.npcId };
  } else {
    return null; // "manual" entry — no linked character/NPC record
  }

  if (target && attacker.type === target.type && attacker.sourceId === target.sourceId) {
    return null; // self-damage (e.g. ongoing poison/start-of-turn) auto-suppresses
  }
  return attacker;
}

// Story 55 (ADR-023 point 4) — the set of subjects ("type:sourceId" keys,
// PC slug or NPC id) linked to a hidden initiative entry. Used to strip
// `lastDamageFrom` from the public payload when the attacker is one of the
// DM's hidden entries — reused alongside Story 54's invisible-conditions
// resolver so a bolt from an empty square can't leak an attacker's presence
// either way.
function getHiddenInitiativeSubjects(initiative) {
  const keys = new Set();
  for (const entry of initiative?.entries || []) {
    if (!entry?.hidden) continue;
    if (entry.isPC && entry.slug) keys.add(`character:${entry.slug}`);
    else if (!entry.isPC && entry.npcId) keys.add(`npc:${entry.npcId}`);
  }
  return keys;
}

module.exports = {
  buildPublicInitiativePayload,
  publicNpcConditionsByNpcId,
  resolveAttackerRef,
  getHiddenInitiativeSubjects,
};
