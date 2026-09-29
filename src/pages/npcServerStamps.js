import { liveValuesEqual } from "../lib/liveSync";

// Server-only stamps (lastDamagedAt/-Amount/-From, lastHealedAt/-Amount/-From,
// lastFx, and any future last* stamp) never appear in our optimistic copy, so
// they're ignored when checking whether the server has caught up.
export function stripNpcServerStamps(npcs) {
  return (npcs || []).map((npc) => Object.fromEntries(
    Object.entries(npc || {}).filter(([key]) => !/^last[A-Z]/.test(key))
  ));
}

/**
 * Has the server caught up with the NPC list the DM just wrote? Compares only
 * what the DM wrote (every non-stamp field on each expected NPC), ignoring
 * key order and any fields the server adds. A stale or never-matching check
 * would keep the DM on its local copy: no hit stamp (no strike animation) and
 * no later server changes to NPCs.
 */
export function npcCombatCaughtUp(serverNpcs, expectedNpcs) {
  const server = stripNpcServerStamps(serverNpcs);
  const expected = stripNpcServerStamps(expectedNpcs);
  if (server.length !== expected.length) return false;
  const byId = new Map(server.map((npc) => [npc.id, npc]));
  return expected.every((npc) => {
    const match = byId.get(npc.id);
    return !!match && Object.keys(npc).every((key) => liveValuesEqual(npc[key], match[key]));
  });
}

// A pending local NPC write stops holding back server data after this long,
// even if the server never "matches" (someone else changed the NPC too).
export const NPC_EXPECTED_TTL_MS = 8000;
