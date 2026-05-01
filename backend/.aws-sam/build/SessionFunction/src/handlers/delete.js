const { GetCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();
  const password = event.headers?.["x-character-password"] || "";

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  const auth = await verifyPassword(password, result.Item);
  if (!auth.valid) return forbidden();

  await db.send(new DeleteCommand({ TableName: TABLE, Key: { slug } }));
  return ok({ success: true });
};
