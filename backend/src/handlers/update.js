const bcrypt = require("bcryptjs");
const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, conflict } = require("../lib/response");
const { VersionConflictError, isConditionalFailure, currentVersion, conditionalPutParams, withVersionRetry, characterVersionKey, withVersions } = require("../lib/versioning");
const { isReservedCharacterSlug } = require("../lib/specialItems");

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();
  const password = event.headers?.["x-character-password"] || "";
  const body = JSON.parse(event.body || "{}");

  const { newPassword, ...charData } = body;
  delete charData.version; // server-owned (ADR-030)

  // Whole-record replace under the version lock: re-read and re-merge if a
  // live session write (HP, conditions…) lands between our read and write.
  let saved;
  try {
    saved = await withVersionRetry(async () => {
      const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
      if (!result.Item) return { status: "notFound" };

      const auth = await verifyPassword(password, result.Item);
      if (!auth.valid) return { status: "forbidden" };

      // If newPassword is present, rehash it (empty string = no password required)
      const passwordHash = newPassword !== undefined
        ? await bcrypt.hash(newPassword, 10)
        : result.Item.passwordHash;

      // Build the saved item: start from existing, apply new data.
      // If portrait is explicitly set to "" in charData, it clears the old base64.
      const item = { ...result.Item, ...charData };
      if (charData.portrait === "") delete item.portrait; // clear base64 when portrait is emptied

      const expected = currentVersion(result.Item);
      try {
        await db.send(new PutCommand(conditionalPutParams(TABLE, {
          ...item,
          slug,
          passwordHash,
          createdAt: result.Item.createdAt,
          updatedAt: new Date().toISOString(),
        }, expected)));
      } catch (err) {
        if (isConditionalFailure(err)) throw new VersionConflictError(characterVersionKey(slug));
        throw err;
      }
      return { status: "ok", version: expected + 1 };
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  }
  if (saved.status === "notFound") return notFound();
  if (saved.status === "forbidden") return forbidden();

  return ok(withVersions({ success: true }, { [characterVersionKey(slug)]: saved.version }));
};
