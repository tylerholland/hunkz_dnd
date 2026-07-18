const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");
const { MAP_LIBRARY_SLUG } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const mapId = body.mapId ?? null;

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { slug: MAP_LIBRARY_SLUG },
    UpdateExpression: "SET activeMapId = :mapId, activeMapView = :view, updatedAt = :now",
    ExpressionAttributeValues: {
      ":mapId": mapId,
      ":view": null,
      ":now": new Date().toISOString(),
    },
  }));

  await notifySessionChanged();

  return ok({ activeMapId: mapId, activeMapView: null });
};
