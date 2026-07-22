const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const { mapId } = event.pathParameters || {};
  if (!mapId) return badRequest("mapId required");

  const body = JSON.parse(event.body || "{}");
  if (typeof body.name !== "string") return badRequest("name must be a string");

  const state = await getMapLibraryState();
  const idx = state.maps.findIndex((m) => m.id === mapId);
  if (idx === -1) return notFound();

  const updatedMaps = [...state.maps];
  updatedMaps[idx] = { ...updatedMaps[idx], name: body.name };

  await saveMapLibraryState({ activeMapId: state.activeMapId, adventureMapId: state.adventureMapId, battleMapId: state.battleMapId, activeMapView: state.activeMapView, maps: updatedMaps });

  return ok({ maps: updatedMaps });
};
