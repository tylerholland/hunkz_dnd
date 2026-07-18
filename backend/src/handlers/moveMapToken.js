const { ok, forbidden, badRequest, notFound } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
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

  await saveMapLibraryState({ activeMapId: state.activeMapId, activeMapView: state.activeMapView, maps: updatedMaps });

  await notifySessionChanged();

  return ok({ maps: updatedMaps });
};
