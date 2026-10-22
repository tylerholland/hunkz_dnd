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

  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
  if (!result.Item) return notFound();

  // Story 63 — a no-auth, non-dice activity note (e.g. "Long Rest — slots
  // restored"), reusing this same character-write endpoint rather than
  // minting a new one. Shares the shared roll-history sentinel and the
  // WheelHistoryRow renderer with the DM's counter-wheel events, but is
  // reachable without a DM password since it's the player's own character
  // acting on their own resources (ADR-005 no-auth session writes).
  if (body.type === "wheel") {
    const name = boundedString(body.name);
    if (!name) return badRequest("name is required");
    const note = boundedString(body.note);
    const eventRecord = {
      id: `wheel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "wheel",
      name,
      characterName: result.Item.name || result.Item.nameAlt || slug,
      segments: 1,
      filledCount: 1,
      ...(note ? { note } : {}),
      createdAt: new Date().toISOString(),
    };
    await appendRollHistoryEvent(eventRecord);
    await notifySessionChanged();
    return ok({ success: true });
  }

  // A spell's effect, sent from the attack bar after the cast roll ("✦ Hex
  // takes effect → Carrion Crawler"). Nothing changes yet: the DM applies it
  // from the log (Apply Effect), which sets the condition and plays the FX.
  if (body.type === "effect") {
    const target = sanitizeTarget(body.target);
    const attack = sanitizeAttack(body.attack);
    const effect = boundedString(body.effect);
    if (!target || !attack || !effect) return badRequest("effect, attack and target are required");
    const castRollId = boundedString(body.castRollId);
    const eventRecord = {
      id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "effect",
      slug,
      characterName: result.Item.name || result.Item.nameAlt || slug,
      paletteKey: result.Item.palette || "ember",
      effect,
      attack,
      target,
      ...(castRollId ? { castRollId } : {}),
      createdAt: new Date().toISOString(),
    };
    await appendRollHistoryEvent(eventRecord);
    await notifySessionChanged();
    return ok({ success: true, id: eventRecord.id });
  }

  const exprLabel = typeof body.exprLabel === "string" ? body.exprLabel.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const total = parseInt(body.total, 10);
  const rollValues = sanitizeRollValues(body.rollValues);

  if (!exprLabel) return badRequest("exprLabel is required");
  if (!Number.isFinite(total)) return badRequest("total must be a number");
  if (!rollValues) return badRequest("rollValues must be a non-empty numeric array");

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
  // What the roll was for, typed by the player (free rolls); the DM can
  // change it later (putRollTag).
  const tag = boundedString(body.tag);
  if (tag) eventRecord.tag = tag;
  // Story 70 — effect riders in a damage roll ([{ label: "Hex", total: 4 }]).
  const riders = (Array.isArray(body.riders) ? body.riders : [])
    .map((r) => ({ label: boundedString(r?.label), total: parseInt(r?.total, 10), effect: boundedString(r?.effect) }))
    .filter((r) => r.label && Number.isFinite(r.total))
    .slice(0, 3)
    .map(({ effect, ...r }) => (effect ? { ...r, effect } : r));
  if (riders.length) eventRecord.riders = riders;

  await appendRollHistoryEvent(eventRecord);
  await notifySessionChanged();
  return ok({ success: true, id: eventRecord.id });
};
