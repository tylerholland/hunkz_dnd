const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { getInitiativeState, saveInitiativeState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const password = event.headers?.["x-character-password"] || "";

  // Both GET and PUT require DM auth
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  if (method === "GET") {
    return ok(await getInitiativeState());
  }

  if (method === "PUT") {
    const body = JSON.parse(event.body || "{}");

    if (!Array.isArray(body.entries)) {
      return badRequest("entries must be an array");
    }

    // Story 52 — stamp turnStartedAt whenever the active turn/round advances.
    // Clients derive Phase B (wound halo) liveness from this rather than a
    // server-side clear of lastDamagedAt on every character/NPC record (see
    // Story 52 Architect Notes: a cross-item write on every "Next Turn" tap
    // would be non-atomic; this single-record stamp is not).
    const previous = await getInitiativeState();
    const nextActiveTurnIndex = body.activeTurnIndex ?? 0;
    const nextRound = Math.max(1, body.round ?? 1);
    const turnAdvanced = previous.activeTurnIndex !== nextActiveTurnIndex || previous.round !== nextRound;

    await saveInitiativeState({
      entries: body.entries,
      activeTurnIndex: nextActiveTurnIndex,
      round: nextRound,
      turnStartedAt: turnAdvanced ? new Date().toISOString() : previous.turnStartedAt,
    });

    await notifySessionChanged();

    return ok({ success: true });
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
