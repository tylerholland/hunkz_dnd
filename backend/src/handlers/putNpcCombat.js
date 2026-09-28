const { BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { saveNpcCombatState, normalizeNpcCombatRecord, normalizeInitiativeRecord, markRollApplied } = require("../lib/specialRecords");
const { NPC_COMBAT_SLUG, INITIATIVE_SLUG } = require("../lib/specialItems");
const { resolveAttackerRef } = require("../lib/initiativeProjection");
const { notifySessionChanged } = require("../lib/broadcast");
const { withVersions } = require("../lib/versioning");
const { sanitizeFx, buildLastFx } = require("../lib/combatFx");

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
  // ADR-032 — an NPC entry may carry `fx` (the action chosen on the DM map
  // or applied from the roll log). It's consumed here, never saved as-is.
  const appliedRolls = [];
  const stampedNpcs = body.npcs.map((incoming) => {
    const { fx: rawFx, ...npc } = incoming || {};
    const fx = sanitizeFx(rawFx);
    const prev = prevById.get(npc.id);
    const prevHp = prev?.hpCurrent;
    const at = new Date().toISOString();
    if (typeof npc.hpCurrent === "number" && typeof prevHp === "number" && npc.hpCurrent < prevHp) {
      const attackerRef = resolveAttackerRef(initiative, { type: "npc", sourceId: npc.id });
      const stamped = {
        ...npc,
        lastDamagedAt: at,
        lastDamageAmount: prevHp - npc.hpCurrent,
        lastDamageFrom: fx?.attacker || attackerRef,
      };
      if (fx && !fx.miss) {
        stamped.lastFx = buildLastFx(fx, "damage", at);
        if (fx.rollId) appliedRolls.push([fx.rollId, { kind: "damage", amount: prevHp - npc.hpCurrent, at }]);
      }
      return stamped;
    }
    if (typeof npc.hpCurrent === "number" && typeof prevHp === "number" && npc.hpCurrent > prevHp) {
      // Combat FX (ADR-031) — heal stamp, mirror of the damage stamp.
      const stamped = {
        ...npc,
        lastHealedAt: at,
        lastHealAmount: npc.hpCurrent - prevHp,
        lastHealFrom: fx?.attacker || resolveAttackerRef(initiative, { type: "npc", sourceId: npc.id }),
      };
      if (fx && !fx.miss) {
        stamped.lastFx = buildLastFx(fx, "heal", at);
        if (fx.rollId) appliedRolls.push([fx.rollId, { kind: "heal", amount: npc.hpCurrent - prevHp, at }]);
      }
      return stamped;
    }
    if (fx?.miss) {
      if (fx.rollId) appliedRolls.push([fx.rollId, { kind: "miss", amount: 0, at }]);
      return { ...npc, lastFx: buildLastFx(fx, "miss", at) };
    }
    return npc;
  });

  const savedVersion = await saveNpcCombatState({ npcs: stampedNpcs });

  for (const [rollId, applied] of appliedRolls) await markRollApplied(rollId, applied);

  await notifySessionChanged();

  return ok(withVersions({ success: true }, { [NPC_COMBAT_SLUG]: savedVersion }));
};
