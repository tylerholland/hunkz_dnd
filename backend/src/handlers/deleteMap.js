const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest, notFound } = require("../lib/response");
const { getMapLibraryState, saveMapLibraryState } = require("../lib/specialRecords");

const s3 = new S3Client();
const BUCKET = process.env.PORTRAITS_BUCKET;

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const { mapId } = event.pathParameters || {};
  if (!mapId) return badRequest("mapId required");

  const state = await getMapLibraryState();
  const entry = state.maps.find((m) => m.id === mapId);
  if (!entry) return notFound();

  const updatedMaps = state.maps.filter((m) => m.id !== mapId);
  const updatedActiveMapId = state.activeMapId === mapId ? null : state.activeMapId;
  const updatedActiveMapView =
    state.activeMapId === mapId || state.activeMapView?.mapId === mapId
      ? null
      : state.activeMapView;

  // Delete DynamoDB record first, then attempt S3 deletion (best-effort)
  const updatedAdventureMapId = state.adventureMapId === mapId ? null : state.adventureMapId;
  const updatedBattleMapId = state.battleMapId === mapId ? null : state.battleMapId;
  await saveMapLibraryState({ activeMapId: updatedActiveMapId, adventureMapId: updatedAdventureMapId, battleMapId: updatedBattleMapId, activeMapView: updatedActiveMapView, maps: updatedMaps });

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: entry.s3Key }));
  } catch (err) {
    console.error(`Failed to delete S3 object ${entry.s3Key}:`, err);
  }

  return ok({ activeMapId: updatedActiveMapId, activeMapView: updatedActiveMapView, maps: updatedMaps });
};
