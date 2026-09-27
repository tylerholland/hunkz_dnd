const { ok, forbidden, badRequest, notFound, conflict } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
const { VersionConflictError, withVersionRetry, withVersions } = require("../lib/versioning");
const { MAP_LIBRARY_SLUG } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

// Story 34 — players may drag their own PC token to a new position.
// Intentionally no-auth (ADR-005 trust model, same as session.js): any request
// can PATCH this endpoint, but the server enforces that only the token whose
// sourceId matches the supplied slug — and only character tokens — can move.

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

exports.handler = async (event) => {
  const { mapId, tokenId } = event.pathParameters || {};
  if (!mapId || !tokenId) return badRequest("mapId and tokenId required");

  const body = JSON.parse(event.body || "{}");
  const { x, y, slug } = body;

  if (typeof slug !== "string" || !slug.trim()) return badRequest("slug is required");
  if (typeof x !== "number" || !Number.isFinite(x)) return badRequest("x must be a number");
  if (typeof y !== "number" || !Number.isFinite(y)) return badRequest("y must be a number");

  // ADR-030 — read-modify-write under the map-library version lock: a
  // concurrent write (another token move, the DM's edit) makes this
  // attempt re-read and re-apply instead of erasing it.
  return withVersionRetry(async () => {
    const state = await getMapLibraryState();
    const mapIdx = state.maps.findIndex((m) => m.id === mapId);
    if (mapIdx === -1) return notFound();

    const map = state.maps[mapIdx];
    const tokens = Array.isArray(map.tokens) ? map.tokens : [];
    const tokenIdx = tokens.findIndex((t) => t.id === tokenId);
    if (tokenIdx === -1) return notFound();

    const token = tokens[tokenIdx];
    if (token.type !== "character") return forbidden("Only character tokens can be moved by players");
    if (token.sourceId !== slug) return forbidden("You can only move your own token");

    const updatedTokens = [...tokens];
    updatedTokens[tokenIdx] = { ...token, x: clamp01(x), y: clamp01(y) };

    const updatedMaps = [...state.maps];
    updatedMaps[mapIdx] = { ...map, tokens: updatedTokens };

    const savedVersion = await saveMapLibraryState({ activeMapId: state.activeMapId, adventureMapId: state.adventureMapId, battleMapId: state.battleMapId, combatMode: state.combatMode, activeMapView: state.activeMapView, maps: updatedMaps }, { expectedVersion: state.version });

    await notifySessionChanged();

    return ok(withVersions({ maps: updatedMaps }, { [MAP_LIBRARY_SLUG]: savedVersion }));
  }).catch((err) => {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  });
};
