const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState, normalizeMapView } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const { mapId } = body;
  if (!mapId || typeof mapId !== "string") return badRequest("mapId required");

  const state = await getMapLibraryState();
  if (state.activeMapId !== mapId) return badRequest("Can only publish the active map view");

  const activeMapView = normalizeMapView({
    ...body,
    updatedAt: new Date().toISOString(),
  });
  if (!activeMapView) return badRequest("Invalid map view");

  await saveMapLibraryState({
    activeMapId: state.activeMapId,
    adventureMapId: state.adventureMapId,
    battleMapId: state.battleMapId,
    combatMode: state.combatMode,
    activeMapView,
    maps: state.maps,
  });

  await notifySessionChanged();

  return ok({ activeMapId: state.activeMapId, activeMapView });
};
