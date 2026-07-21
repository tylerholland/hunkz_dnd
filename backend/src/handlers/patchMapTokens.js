const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

const VALID_TYPES = new Set(["character", "npc"]);
const MAX_TOKENS = 200;

// Story 44 — scale ceiling matches the per-token size ladder (3.0 = Gargantuan),
// distinct from the global calibration ceiling (2.5).
const SCALE_MIN = 0.5;
const SCALE_MAX = 3.0;

function validateToken(t) {
  if (!t || typeof t !== "object") return false;
  if (typeof t.id !== "string" || !t.id) return false;
  if (!VALID_TYPES.has(t.type)) return false;
  if (typeof t.sourceId !== "string" || !t.sourceId) return false;
  if (typeof t.x !== "number" || !Number.isFinite(t.x)) return false;
  if (typeof t.y !== "number" || !Number.isFinite(t.y)) return false;
  // Story 44 — optional per-token scale: if present must be a finite number.
  if (t.scale !== undefined && (typeof t.scale !== "number" || !Number.isFinite(t.scale))) return false;
  return true;
}

function normalizeTokenScale(t) {
  // Clamp scale when present; leave absent scale absent so legacy tokens are
  // unchanged (don't force-write 1.0 — the read-side normalizer handles that).
  if (t.scale === undefined) return t;
  return { ...t, scale: Math.min(SCALE_MAX, Math.max(SCALE_MIN, t.scale)) };
}

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const { mapId } = event.pathParameters || {};
  if (!mapId) return badRequest("mapId required");

  const body = JSON.parse(event.body || "{}");

  if (!Array.isArray(body.tokens)) return badRequest("tokens must be an array");
  if (body.tokens.length > MAX_TOKENS) return badRequest(`tokens array exceeds maximum of ${MAX_TOKENS}`);

  for (const t of body.tokens) {
    if (!validateToken(t)) return badRequest("each token must have id (string), type (character|npc), sourceId (string), x (number), y (number)");
    if (t.x < 0 || t.x > 1 || t.y < 0 || t.y > 1) return badRequest("token x and y must be in [0, 1]");
  }

  if (body.mapMode !== undefined && body.mapMode !== "adventure" && body.mapMode !== "battle") {
    return badRequest("mapMode must be adventure or battle");
  }

  const state = await getMapLibraryState();
  const idx = state.maps.findIndex((m) => m.id === mapId);
  if (idx === -1) return notFound();

  const updatedMaps = [...state.maps];
  updatedMaps[idx] = {
    ...updatedMaps[idx],
    tokens: body.tokens.map(normalizeTokenScale),
    ...(body.mapMode !== undefined ? { mapMode: body.mapMode } : {}),
  };

  await saveMapLibraryState({ activeMapId: state.activeMapId, activeMapView: state.activeMapView, maps: updatedMaps });

  await notifySessionChanged();

  return ok({ maps: updatedMaps });
};
