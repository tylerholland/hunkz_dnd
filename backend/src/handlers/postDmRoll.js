const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { appendRollHistoryEvent } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

function sanitizeRollValues(values) {
  if (!Array.isArray(values)) return null;
  const cleaned = values
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  return cleaned.length ? cleaned : null;
}

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  const exprLabel = typeof body.exprLabel === "string" ? body.exprLabel.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const total = parseInt(body.total, 10);
  const rollValues = sanitizeRollValues(body.rollValues);

  if (!exprLabel) return badRequest("exprLabel is required");
  if (!Number.isFinite(total)) return badRequest("total must be a number");
  if (!rollValues) return badRequest("rollValues must be a non-empty numeric array");

  const eventRecord = {
    id: typeof body.id === "string" && body.id.trim()
      ? body.id.trim()
      : `dm-roll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    characterName: "DM",
    source: "dm",
    exprLabel,
    label,
    total,
    rollValues,
    isCrit: !!body.isCrit,
    isFumble: !!body.isFumble,
    createdAt: new Date().toISOString(),
  };

  await appendRollHistoryEvent(eventRecord);
  await notifySessionChanged();
  return ok({ success: true });
};
