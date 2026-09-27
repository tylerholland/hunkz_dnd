const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { MAP_LIBRARY_SLUG } = require("../lib/specialItems");
const { withVersions } = require("../lib/versioning");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const { id, name, s3Key, imageUrl, contentType } = body;

  if (!id || !s3Key || !imageUrl) return badRequest("id, s3Key, and imageUrl required");

  const newMap = {
    id,
    name: name || "",
    s3Key,
    imageUrl,
    contentType: contentType || "",
    uploadedAt: new Date().toISOString(),
  };

  const result = await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { slug: MAP_LIBRARY_SLUG },
    // list_append is atomic, so an atomic version bump (ADR-030) is enough.
    UpdateExpression: "SET #maps = list_append(if_not_exists(#maps, :empty), :newMap), activeMapId = if_not_exists(activeMapId, :null), updatedAt = :now, #ver = if_not_exists(#ver, :verZero) + :verOne",
    ExpressionAttributeNames: { "#maps": "maps", "#ver": "version" },
    ExpressionAttributeValues: {
      ":empty": [],
      ":newMap": [newMap],
      ":null": null,
      ":now": new Date().toISOString(),
      ":verZero": 0,
      ":verOne": 1,
    },
    ReturnValues: "ALL_NEW",
  }));

  return ok(withVersions({ maps: result.Attributes?.maps ?? [] }, { [MAP_LIBRARY_SLUG]: result.Attributes?.version }));
};
