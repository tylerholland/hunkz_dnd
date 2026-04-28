const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok, notFound } = require("../lib/response");

exports.handler = async (event) => {
  const { slug } = event.pathParameters;

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  const { passwordHash, ...character } = result.Item;
  return ok(character);
};
