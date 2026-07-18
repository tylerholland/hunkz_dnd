const { ok } = require("../lib/response");
const { getInitiativeState, getNpcCombatState } = require("../lib/specialRecords");
const { buildPublicInitiativePayload } = require("../lib/initiativeProjection");

exports.handler = async () => {
  const initiative = await getInitiativeState();

  // NPC data is best-effort — healthTier is simply omitted if unavailable
  let npcCombat = { npcs: [] };
  try {
    npcCombat = await getNpcCombatState();
  } catch {
    // NPC data unavailable — healthTier will be omitted for all NPC entries
  }

  return ok(buildPublicInitiativePayload(initiative, npcCombat));
};
