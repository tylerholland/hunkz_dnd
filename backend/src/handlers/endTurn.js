const { ok, forbidden, badRequest, conflict } = require("../lib/response");
const { getInitiativeState, saveInitiativeState, appendRollHistoryEvents, getSpecialRecord } = require("../lib/specialRecords");
const { normalizeHouseRulesRecord } = require("../lib/houseRules");
const { buildTurnEvent } = require("../lib/sessionEvents");
const { notifySessionChanged } = require("../lib/broadcast");
const { withVersions, withVersionRetry } = require("../lib/versioning");
const { INITIATIVE_SLUG, HOUSE_RULES_SLUG } = require("../lib/specialItems");

// Story 49 — a player ends their own turn. No password, the same trust model
// as moving your own token (ADR-005): the request names the character and the
// initiative entry it believes is active, and the server only advances when
// that entry IS the active one and belongs to that character. Naming the
// entry means a double-tap (or a stale screen) can't skip someone's turn.
// Advances exactly like the DM's Next Turn: next entry, round +1 on the wrap.
exports.handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const entryId = typeof body.entryId === "string" ? body.entryId.trim() : "";
  if (!slug || !entryId) return badRequest("slug and entryId are required");

  const rules = normalizeHouseRulesRecord(await getSpecialRecord(HOUSE_RULES_SLUG));
  if (!rules.playersEndTurn) return forbidden("The DM advances turns at this table");

  const result = await withVersionRetry(async () => {
    const current = await getInitiativeState();
    const entries = current.entries || [];
    const active = entries[current.activeTurnIndex ?? 0];
    if (!active || active.id !== entryId) return { status: "stale" };
    if (!active.isPC || active.slug !== slug) return { status: "notYours" };
    const next = (current.activeTurnIndex + 1) % entries.length;
    const round = next === 0 ? current.round + 1 : current.round;
    const version = await saveInitiativeState(
      { entries, activeTurnIndex: next, round, turnStartedAt: new Date().toISOString() },
      { expectedVersion: current.version },
    );
    return { status: "ok", version, round, entry: entries[next] };
  });

  if (result.status === "stale") return conflict("It's no longer that turn");
  if (result.status === "notYours") return forbidden("You can only end your own turn");

  if (result.entry) {
    try {
      await appendRollHistoryEvents([buildTurnEvent({ round: result.round, entry: result.entry })]);
    } catch (err) {
      console.error("[endTurn] could not log turn", err);
    }
  }
  await notifySessionChanged();
  return ok(withVersions({ success: true }, { [INITIATIVE_SLUG]: result.version }));
};
