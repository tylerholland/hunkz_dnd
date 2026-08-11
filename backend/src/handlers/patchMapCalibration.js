const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const { mapId } = event.pathParameters || {};
  if (!mapId) return badRequest("mapId required");

  const body = JSON.parse(event.body || "{}");
  if (typeof body.tokenScale !== "number" || !Number.isFinite(body.tokenScale)) {
    return badRequest("tokenScale must be a number");
  }

  const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, body.tokenScale));

  const state = await getMapLibraryState();
  const idx = state.maps.findIndex((m) => m.id === mapId);
  if (idx === -1) return notFound();

  const updatedMaps = [...state.maps];
  updatedMaps[idx] = { ...updatedMaps[idx], tokenScale: clampedScale };

  await saveMapLibraryState({ activeMapId: state.activeMapId, adventureMapId: state.adventureMapId, battleMapId: state.battleMapId, combatMode: state.combatMode, activeMapView: state.activeMapView, maps: updatedMaps });

  await notifySessionChanged();

  return ok({ maps: updatedMaps });
};
