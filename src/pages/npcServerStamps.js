// Server-only stamps (lastDamagedAt/-Amount/-From, lastHealedAt/-Amount/-From,
// lastFx, and any future last* stamp) never appear in our optimistic copy, so
// they're ignored when checking whether the server has caught up. Missing one
// meant the check could never pass: the DM kept its local NPCs forever and
// never saw the hit stamp (no strike animation) or later server changes.
export function stripNpcServerStamps(npcs) {
  return (npcs || []).map((npc) => Object.fromEntries(
    Object.entries(npc || {}).filter(([key]) => !/^last[A-Z]/.test(key))
  ));
}
