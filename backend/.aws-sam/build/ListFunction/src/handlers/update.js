const bcrypt = require("bcryptjs");
const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden } = require("../lib/response");

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  const password = event.headers?.["x-character-password"] || "";
  const body = JSON.parse(event.body || "{}");

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  const auth = await verifyPassword(password, result.Item);
  if (!auth.valid) return forbidden();

  // If newPassword is present, rehash it (empty string = no password required)
  const { newPassword, ...charData } = body;
  const passwordHash = newPassword !== undefined
    ? await bcrypt.hash(newPassword, 10)
    : result.Item.passwordHash;

  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...result.Item,
      ...charData,
      slug,
      passwordHash,
      createdAt: result.Item.createdAt,
      updatedAt: new Date().toISOString(),
    },
  }));

  return ok({ success: true });
};
