const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok } = require("../lib/response");

exports.handler = async () => {
  const result = await db.send(new ScanCommand({
    TableName: TABLE,
    ProjectionExpression: "slug, #n, nameAlt, race, charClass, subclass, #l, palette, portraitUrl",
    ExpressionAttributeNames: { "#n": "name", "#l": "level" },
  }));

  const items = (result.Items || []).sort((a, b) => a.name?.localeCompare(b.name));
  return ok(items);
};
