const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

const VALID_ROTATIONS = [0, 90, 180, 270];

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const { mapId } = event.pathParameters || {};
  if (!mapId) return badRequest("mapId required");

  const body = JSON.parse(event.body || "{}");
  if (!VALID_ROTATIONS.includes(body.rotation)) {
    return badRequest("rotation must be 0, 90, 180, or 270");
  }

  const state = await getMapLibraryState();
  const idx = state.maps.findIndex((m) => m.id === mapId);
  if (idx === -1) return notFound();

  const updatedMaps = [...state.maps];
  updatedMaps[idx] = { ...updatedMaps[idx], rotation: body.rotation };

  await saveMapLibraryState({ activeMapId: state.activeMapId, activeMapView: state.activeMapView, maps: updatedMaps });

  await notifySessionChanged();

  return ok({ maps: updatedMaps });
};
