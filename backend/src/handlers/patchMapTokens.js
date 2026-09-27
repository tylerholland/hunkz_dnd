const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound, conflict } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");
const { VersionConflictError, withVersionRetry, withVersions } = require("../lib/versioning");
const { MAP_LIBRARY_SLUG } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

const VALID_TYPES = new Set(["character", "npc"]);
const MAX_TOKENS = 200;

// Stories 44/65 — scale ceiling matches the per-token size ladder in
// src/features/dmDashboard/battleMode/tokenSizes.js (6.0 = Colossal),
// distinct from the global calibration ceiling (2.5).
const SCALE_MIN = 0.5;
const SCALE_MAX = 6.0;

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
  // Story 54 — `invisible` is a derived flag (computed server-side per
  // request from the subject's live conditions), never a stored one. Strip
  // any client-supplied value so a stale/forged flag can never persist.
  // eslint-disable-next-line no-unused-vars
  const { invisible, ...rest } = t;
  // Clamp scale when present; leave absent scale absent so legacy tokens are
  // unchanged (don't force-write 1.0 — the read-side normalizer handles that).
  if (rest.scale === undefined) return rest;
  return { ...rest, scale: Math.min(SCALE_MAX, Math.max(SCALE_MIN, rest.scale)) };
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

  // ADR-030 — read-modify-write under the map-library version lock: a
  // concurrent write (another token move, the DM's edit) makes this
  // attempt re-read and re-apply instead of erasing it.
  return withVersionRetry(async () => {
    const state = await getMapLibraryState();
    const idx = state.maps.findIndex((m) => m.id === mapId);
    if (idx === -1) return notFound();

    const updatedMaps = [...state.maps];
    updatedMaps[idx] = {
      ...updatedMaps[idx],
      tokens: body.tokens.map(normalizeTokenScale),
    };

    const savedVersion = await saveMapLibraryState({ activeMapId: state.activeMapId, adventureMapId: state.adventureMapId, battleMapId: state.battleMapId, combatMode: state.combatMode, activeMapView: state.activeMapView, maps: updatedMaps }, { expectedVersion: state.version });

    await notifySessionChanged();

    return ok(withVersions({ maps: updatedMaps }, { [MAP_LIBRARY_SLUG]: savedVersion }));
  }).catch((err) => {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  });
};
