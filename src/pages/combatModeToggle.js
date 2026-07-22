/**
 * Pure helper for DmDashboardPage.toggleCombatMode.
 * Returns what API call to make (if any) when the DM flips between
 * Adventure and Combat mode.
 *
 * @param {boolean} combatMode   Current mode before the toggle.
 * @param {object}  mapLibrary   The latest polled mapLibrary from getSessionState.
 * @returns {{ action: "switch"|"record"|"none", incomingMap: object|null, modeOpts: object|null }}
 */
export function computeMapSwitch(combatMode, mapLibrary) {
  const enteringCombat = !combatMode;
  const currentActiveMapId = mapLibrary?.activeMapId ?? null;
  const maps = mapLibrary?.maps || [];

  const incomingId = enteringCombat ? mapLibrary?.battleMapId : mapLibrary?.adventureMapId;
  const incomingMap = incomingId ? maps.find((m) => m.id === incomingId) : null;

  if (incomingMap && incomingMap.id !== currentActiveMapId) {
    // We know which map belongs to the incoming mode — switch to it and record both assignments.
    return {
      action: "switch",
      incomingMap,
      modeOpts: {
        adventureMapId: enteringCombat ? currentActiveMapId : incomingMap.id,
        battleMapId:    enteringCombat ? incomingMap.id    : currentActiveMapId,
      },
    };
  }

  if (currentActiveMapId) {
    // No registered map for the incoming mode yet.
    // Record the current map as the OUTGOING mode's map so future toggles have something to switch back to.
    // (e.g. DM enters combat from adventure — current map is the adventure map; remember it.)
    return {
      action: "record",
      incomingMap: null,
      modeOpts: enteringCombat
        ? { adventureMapId: currentActiveMapId }
        : { battleMapId:   currentActiveMapId },
    };
  }

  return { action: "none", incomingMap: null, modeOpts: null };
}
