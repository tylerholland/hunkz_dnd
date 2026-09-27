const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, conflict } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState, normalizeMapView } = require("../lib/specialRecords");
const { VersionConflictError, withVersionRetry, withVersions } = require("../lib/versioning");
const { MAP_LIBRARY_SLUG } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const { mapId } = body;
  if (!mapId || typeof mapId !== "string") return badRequest("mapId required");

  // ADR-030 — read-modify-write under the map-library version lock: a
  // concurrent write (another token move, the DM's edit) makes this
  // attempt re-read and re-apply instead of erasing it.
  return withVersionRetry(async () => {
    const state = await getMapLibraryState();
    if (state.activeMapId !== mapId) return badRequest("Can only publish the active map view");

    const activeMapView = normalizeMapView({
      ...body,
      updatedAt: new Date().toISOString(),
    });
    if (!activeMapView) return badRequest("Invalid map view");

    const savedVersion = await saveMapLibraryState({
      activeMapId: state.activeMapId,
      adventureMapId: state.adventureMapId,
      battleMapId: state.battleMapId,
      combatMode: state.combatMode,
      activeMapView,
      maps: state.maps,
    }, { expectedVersion: state.version });

    await notifySessionChanged();

    return ok(withVersions({ activeMapId: state.activeMapId, activeMapView }, { [MAP_LIBRARY_SLUG]: savedVersion }));
  }).catch((err) => {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  });
};
