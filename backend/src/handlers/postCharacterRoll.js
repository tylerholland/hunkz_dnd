const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { ok, notFound, badRequest } = require("../lib/response");
const { isReservedCharacterSlug } = require("../lib/specialItems");
const { appendRollHistoryEvent } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

function sanitizeRollValues(values) {
  if (!Array.isArray(values)) return null;
  const cleaned = values
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  return cleaned.length ? cleaned : null;
}

const MAX_NAME_LEN = 60;

function boundedString(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME_LEN) : "";
}

// Story 57 (ADR-026) — declaration provenance rides two optional structured
// fields, never baked into `label`. Both are client-supplied and bounded to
// MAX_NAME_LEN so a crafted request can't bloat the roll-history sentinel;
// this is the same trust exposure the pre-existing `label`/`total` already
// carry (ADR-005), not a new one.
function sanitizeTarget(target) {
  if (!target || typeof target !== "object") return null;
  const sourceId = boundedString(target.sourceId);
  const name = boundedString(target.name);
  if (!sourceId || !name) return null;
  return { type: "npc", sourceId, name };
}

function sanitizeAttack(attack) {
  if (!attack || typeof attack !== "object") return null;
  const kind = attack.kind === "spell" ? "spell" : attack.kind === "weapon" ? "weapon" : null;
  const id = boundedString(attack.id);
  const name = boundedString(attack.name);
  if (!kind || !id || !name) return null;
  return { kind, id, name };
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

  // Story 57 (ADR-026) — optional declared-attack provenance. Absent when not
  // supplied, never written as null (mirrors the isCrit/isFumble style).
  const target = sanitizeTarget(body.target);
  const attack = sanitizeAttack(body.attack);
  if (target) eventRecord.target = target;
  if (attack) eventRecord.attack = attack;

  await appendRollHistoryEvent(eventRecord);
  await notifySessionChanged();
  return ok({ success: true });
};
