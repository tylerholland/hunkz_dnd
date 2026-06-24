const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { saveCounterWheelsState, appendRollHistoryEvent } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  if (!Array.isArray(body.wheels)) return badRequest("wheels must be an array");

  await saveCounterWheelsState({ wheels: body.wheels });

  // If a wheel creation event was included, append it to roll history.
  if (body.wheelEvent && typeof body.wheelEvent.name === "string") {
    const ev = body.wheelEvent;
    await appendRollHistoryEvent({
      id: `wheel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "wheel",
      name: ev.name,
      segments: Number.isFinite(ev.segments) ? ev.segments : 6,
      createdAt: new Date().toISOString(),
    });
  }

  return ok({ success: true });
};
