const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok, notFound, badRequest } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");
const { appendRollHistoryEvent } = require("../lib/specialRecords");

function sanitizeRollValues(values) {
  if (!Array.isArray(values)) return null;
  const cleaned = values
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  return cleaned.length ? cleaned : null;
}

exports.handler = async (event) => {
  const { slug } = event.pathParameters;
  if (isReservedCharacterSlug(slug)) return notFound();

  const body = JSON.parse(event.body || "{}");
  const exprLabel = typeof body.exprLabel === "string" ? body.exprLabel.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const total = parseInt(body.total, 10);
  const rollValues = sanitizeRollValues(body.rollValues);

  if (!exprLabel) return badRequest("exprLabel is required");
  if (!Number.isFinite(total)) return badRequest("total must be a number");
  if (!rollValues) return badRequest("rollValues must be a non-empty numeric array");

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  const eventRecord = {
    id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    slug,
    characterName: result.Item.name || result.Item.nameAlt || slug,
    paletteKey: result.Item.palette || "ember",
    exprLabel,
    label,
    total,
    rollValues,
    isCrit: !!body.isCrit,
    isFumble: !!body.isFumble,
    createdAt: new Date().toISOString(),
  };

  await appendRollHistoryEvent(eventRecord);
  return ok({ success: true });
};
