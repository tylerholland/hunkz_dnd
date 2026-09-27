const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound, conflict } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
const { VersionConflictError, withVersionRetry, withVersions } = require("../lib/versioning");
const { MAP_LIBRARY_SLUG } = require("../lib/specialItems");
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

  // ADR-030 — read-modify-write under the map-library version lock: a
  // concurrent write (another token move, the DM's edit) makes this
  // attempt re-read and re-apply instead of erasing it.
  return withVersionRetry(async () => {
    const state = await getMapLibraryState();
    const idx = state.maps.findIndex((m) => m.id === mapId);
    if (idx === -1) return notFound();

    const updatedMaps = [...state.maps];
    updatedMaps[idx] = { ...updatedMaps[idx], tokenScale: clampedScale };

    const savedVersion = await saveMapLibraryState({ activeMapId: state.activeMapId, adventureMapId: state.adventureMapId, battleMapId: state.battleMapId, combatMode: state.combatMode, activeMapView: state.activeMapView, maps: updatedMaps }, { expectedVersion: state.version });

    await notifySessionChanged();

    return ok(withVersions({ maps: updatedMaps }, { [MAP_LIBRARY_SLUG]: savedVersion }));
  }).catch((err) => {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  });
};
