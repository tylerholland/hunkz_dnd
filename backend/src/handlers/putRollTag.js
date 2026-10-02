const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, notFound } = require("../lib/response");
const { setRollTag } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

const MAX_TAG_LEN = 60;

// DM-only: label any logged event, live or archived ("Persuade the goblin
// king"). Body { tag }; an empty tag removes it.
exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const rollId = decodeURIComponent(event.pathParameters?.id || "");
  const body = JSON.parse(event.body || "{}");
  const tag = typeof body.tag === "string" ? body.tag.trim().slice(0, MAX_TAG_LEN) : "";

  const found = await setRollTag(rollId, tag);
  if (!found) return notFound("No such event");
  await notifySessionChanged();
  return ok({ id: rollId, tag });
};
