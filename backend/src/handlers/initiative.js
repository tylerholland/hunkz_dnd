const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { getInitiativeState, saveInitiativeState, appendRollHistoryEvents } = require("../lib/specialRecords");
const { buildTurnEvent } = require("../lib/sessionEvents");
const { notifySessionChanged } = require("../lib/broadcast");
const { withVersions } = require("../lib/versioning");
const { INITIATIVE_SLUG } = require("../lib/specialItems");

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

    const savedVersion = await saveInitiativeState({
      entries: body.entries,
      activeTurnIndex: nextActiveTurnIndex,
      round: nextRound,
      turnStartedAt: turnAdvanced ? new Date().toISOString() : previous.turnStartedAt,
    });

    // Story 69 — each turn joins the log, so a session's timeline has real
    // rounds. Only while combatants exist (clearing the tracker isn't a turn).
    const activeEntry = body.entries[nextActiveTurnIndex];
    if (turnAdvanced && activeEntry) {
      try {
        await appendRollHistoryEvents([buildTurnEvent({ round: nextRound, entry: activeEntry })]);
      } catch (err) {
        console.error("[initiative] could not log turn", err);
      }
    }

    await notifySessionChanged();

    return ok(withVersions({ success: true }, { [INITIATIVE_SLUG]: savedVersion }));
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
