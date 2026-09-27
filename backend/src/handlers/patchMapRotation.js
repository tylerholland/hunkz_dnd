const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound, conflict } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
const { VersionConflictError, withVersionRetry, withVersions } = require("../lib/versioning");
const { MAP_LIBRARY_SLUG } = require("../lib/specialItems");
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

  // ADR-030 — read-modify-write under the map-library version lock: a
  // concurrent write (another token move, the DM's edit) makes this
  // attempt re-read and re-apply instead of erasing it.
  return withVersionRetry(async () => {
    const state = await getMapLibraryState();
    const idx = state.maps.findIndex((m) => m.id === mapId);
    if (idx === -1) return notFound();

    const updatedMaps = [...state.maps];
    updatedMaps[idx] = { ...updatedMaps[idx], rotation: body.rotation };

    const savedVersion = await saveMapLibraryState({ activeMapId: state.activeMapId, adventureMapId: state.adventureMapId, battleMapId: state.battleMapId, combatMode: state.combatMode, activeMapView: state.activeMapView, maps: updatedMaps }, { expectedVersion: state.version });

    await notifySessionChanged();

    return ok(withVersions({ maps: updatedMaps }, { [MAP_LIBRARY_SLUG]: savedVersion }));
  }).catch((err) => {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  });
};
