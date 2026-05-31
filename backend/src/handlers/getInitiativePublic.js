const { ok } = require("../lib/response");
const { getInitiativeState, getNpcCombatState } = require("../lib/specialRecords");

exports.handler = async () => {
  const initiative = await getInitiativeState();

  // Build NPC HP map for health tier derivation (best-effort)
  let npcHpMap = {};
  try {
    const npcCombat = await getNpcCombatState();
    for (const npc of npcCombat.npcs || []) {
      if (npc?.initiativeEntryId) {
        npcHpMap[npc.initiativeEntryId] = {
          hpCurrent: npc.hpCurrent ?? 0,
          hpMax: npc.hpMax ?? 0,
        };
      }
    }
  } catch {
    // NPC data unavailable — healthTier will be omitted for all NPC entries
  }

  // Filter hidden entries; strip sensitive data from each entry
  const entries = (initiative.entries || [])
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

  return ok({
    round: initiative.round,
    activeTurnIndex: initiative.activeTurnIndex,
    entries,
  });
};
