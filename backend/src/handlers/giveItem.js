// POST /characters/{slug}/give  { toSlug, itemId, qty }
// A player (their password, or the DM's) gives an inventory item — or part
// of a stack — to another party member. Both characters are written in one
// transaction, each only if unchanged since read, so the item can't be lost
// or doubled. Logged as a "give" event; the receiver's page shows a notice.
const { BatchGetCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { appendRollHistoryEvent, getPartyRosterState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");
const {
  VersionConflictError, characterVersionKey, conditionalPutParams, currentVersion, isConditionalFailure, withVersionRetry, withVersions,
} = require("../lib/versioning");
const { isReservedCharacterSlug } = require("../lib/specialItems");
const { takeFrom, giveTo, giveLogEvent } = require("../lib/giveItem");

exports.handler = async (event) => {
  const slug = event.pathParameters?.slug;
  if (!slug || isReservedCharacterSlug(slug)) return notFound();
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }
  const toSlug = typeof body.toSlug === "string" ? body.toSlug.trim() : "";
  if (!toSlug || toSlug === slug || isReservedCharacterSlug(toSlug)) return badRequest("Pick someone else in the party");
  if (typeof body.itemId !== "string" || !body.itemId) return badRequest("Pick an item");

  const roster = await getPartyRosterState();
  if (roster.exists && (!roster.members.includes(slug) || !roster.members.includes(toSlug))) return forbidden("Only party members can trade items");

  let result;
  try {
    result = await withVersionRetry(async () => {
      const got = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: [{ slug }, { slug: toSlug }] } } }));
      const items = got.Responses?.[TABLE] || [];
      const giver = items.find((item) => item.slug === slug);
      const receiver = items.find((item) => item.slug === toSlug);
      if (!giver || !receiver) return { status: "notFound" };
      const auth = await verifyPassword(event.headers?.["x-character-password"] ?? "", giver);
      if (!auth.valid) return { status: "forbidden" };

      const taken = takeFrom(giver, body.itemId, body.qty);
      if (taken.error) return { status: "bad", error: taken.error };
      const nextReceiver = giveTo(receiver, taken.moved, taken.kind);
      const at = new Date().toISOString();
      const giverVersion = currentVersion(giver);
      const receiverVersion = currentVersion(receiver);
      try {
        await db.send(new TransactWriteCommand({
          TransactItems: [
            { Put: conditionalPutParams(TABLE, { ...taken.giver, slug, updatedAt: at }, giverVersion) },
            { Put: conditionalPutParams(TABLE, { ...nextReceiver, slug: toSlug, updatedAt: at }, receiverVersion) },
          ],
        }));
      } catch (err) {
        if (isConditionalFailure(err)) throw new VersionConflictError(characterVersionKey(slug));
        throw err;
      }
      return { status: "ok", giver: taken.giver, receiver: nextReceiver, moved: taken.moved, giverVersion: giverVersion + 1, receiverVersion: receiverVersion + 1 };
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflict("Busy — please try again");
    throw err;
  }
  if (result.status === "notFound") return notFound();
  if (result.status === "forbidden") return forbidden("That character's password is required");
  if (result.status === "bad") return badRequest(result.error);

  try { await appendRollHistoryEvent(giveLogEvent(result.giver, result.receiver, result.moved)); } catch { /* the item still moved */ }
  await notifySessionChanged();
  const { weapons, equipment } = result.giver;
  return ok(withVersions(
    { character: { weapons, equipment, version: result.giverVersion }, given: { to: toSlug, name: result.moved.name, qty: result.moved.qty ?? 1 } },
    { [characterVersionKey(slug)]: result.giverVersion, [characterVersionKey(toSlug)]: result.receiverVersion },
  ));
};
