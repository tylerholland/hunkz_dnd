// Story 60 — persistent map band open state. Defaults open in combat and
// collapsed otherwise; a player's own toggle (stored with the combat state it
// was made in) holds until the DM flips combat mode.
export function resolveMapBandOpen(pref, isBattleMode) {
  const combat = !!isBattleMode;
  return pref && pref.combat === combat ? !!pref.open : combat;
}
