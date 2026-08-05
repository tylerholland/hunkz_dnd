const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { saveNpcCombatState, getNpcCombatState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  if (!Array.isArray(body.npcs)) return badRequest("npcs must be an array");

  // Story 52 — this handler is a blind full-array replace with no read today,
  // so (unlike session.js) the previous hpCurrent isn't already in hand. Diff
  // against the last-saved state to detect damage per NPC id and stamp it.
  // normalizeNpcCombatRecord() spreads `...npc` on read, so lastDamagedAt/
  // lastDamageAmount already round-trip through the client without any
  // further normalizer change — they just need to be written here once.
  const previous = await getNpcCombatState();
  const prevById = new Map((previous.npcs || []).map((n) => [n.id, n]));
  const stampedNpcs = body.npcs.map((npc) => {
    const prev = prevById.get(npc.id);
    const prevHp = prev?.hpCurrent;
    if (typeof npc.hpCurrent === "number" && typeof prevHp === "number" && npc.hpCurrent < prevHp) {
      return {
        ...npc,
        lastDamagedAt: new Date().toISOString(),
        lastDamageAmount: prevHp - npc.hpCurrent,
      };
    }
    return npc;
  });

  await saveNpcCombatState({ npcs: stampedNpcs });

  await notifySessionChanged();

  return ok({ success: true });
};
