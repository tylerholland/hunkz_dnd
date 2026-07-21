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

  // Optional: caller may record which mode this map belongs to at the same time
  const setParts = ["activeMapId = :mapId", "activeMapView = :view", "updatedAt = :now"];
  const exprValues = { ":mapId": mapId, ":view": null, ":now": new Date().toISOString() };
  if (body.adventureMapId !== undefined) { setParts.push("adventureMapId = :advId"); exprValues[":advId"] = body.adventureMapId ?? null; }
  if (body.battleMapId    !== undefined) { setParts.push("battleMapId = :batId");    exprValues[":batId"] = body.battleMapId    ?? null; }

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { slug: MAP_LIBRARY_SLUG },
    UpdateExpression: `SET ${setParts.join(", ")}`,
    ExpressionAttributeValues: exprValues,
  }));

  await notifySessionChanged();

  return ok({ activeMapId: mapId, activeMapView: null });
};
