const { BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { saveNpcCombatState, normalizeNpcCombatRecord, normalizeInitiativeRecord } = require("../lib/specialRecords");
const { NPC_COMBAT_SLUG, INITIATIVE_SLUG } = require("../lib/specialItems");
const { resolveAttackerRef } = require("../lib/initiativeProjection");
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
  // Story 55 — widened to a single BatchGetCommand for {"npc-combat",
  // "initiative"} (still one round trip) so the attacker can be resolved
  // and `lastDamageFrom` stamped in the SAME write as the damage stamp,
  // per ADR-022.
  const batch = await db.send(new BatchGetCommand({
    RequestItems: { [TABLE]: { Keys: [{ slug: NPC_COMBAT_SLUG }, { slug: INITIATIVE_SLUG }] } },
  }));
  const bySlug = new Map((batch.Responses?.[TABLE] || []).map((item) => [item.slug, item]));
  const previous = normalizeNpcCombatRecord(bySlug.get(NPC_COMBAT_SLUG));
  const initiative = normalizeInitiativeRecord(bySlug.get(INITIATIVE_SLUG));

  const prevById = new Map((previous.npcs || []).map((n) => [n.id, n]));
  const stampedNpcs = body.npcs.map((npc) => {
    const prev = prevById.get(npc.id);
    const prevHp = prev?.hpCurrent;
    if (typeof npc.hpCurrent === "number" && typeof prevHp === "number" && npc.hpCurrent < prevHp) {
      const attackerRef = resolveAttackerRef(initiative, { type: "npc", sourceId: npc.id });
      return {
        ...npc,
        lastDamagedAt: new Date().toISOString(),
        lastDamageAmount: prevHp - npc.hpCurrent,
        lastDamageFrom: attackerRef,
      };
    }
    return npc;
  });

  await saveNpcCombatState({ npcs: stampedNpcs });

  await notifySessionChanged();

  return ok({ success: true });
};
