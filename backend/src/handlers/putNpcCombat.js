const { BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { saveNpcCombatState, normalizeNpcCombatRecord, normalizeInitiativeRecord, markRollApplied, appendRollHistoryEvents } = require("../lib/specialRecords");
const { subjectRef, buildHpEvent, buildConditionEvent } = require("../lib/sessionEvents");
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
  const logEvents = [];
  const stampedNpcs = body.npcs.map((incoming) => {
    const { fx: rawFx, ...npc } = incoming || {};
    const fx = sanitizeFx(rawFx);
    const prev = prevById.get(npc.id);
    const prevHp = prev?.hpCurrent;
    const at = new Date().toISOString();
    // Story 69 — session history: HP (tagged with the action when there is
    // one) and condition changes for NPCs that already existed.
    if (prev) {
      const subject = subjectRef("npc", npc.id, npc.name || prev.name);
      const max = Number.isFinite(npc.hpMax) ? npc.hpMax : null;
      if (typeof npc.hpCurrent === "number" && typeof prevHp === "number" && npc.hpCurrent !== prevHp) {
        logEvents.push(buildHpEvent({ subject, from: prevHp, to: npc.hpCurrent, max, fx: fx && !fx.miss ? fx : null, at }));
      } else if (fx?.miss && typeof prevHp === "number") {
        logEvents.push(buildHpEvent({ subject, from: prevHp, to: prevHp, max, fx, at }));
      }
      const conditionEvent = buildConditionEvent({ subject, before: prev.conditions, after: npc.conditions, at });
      if (conditionEvent) logEvents.push(conditionEvent);
    }
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
    // A spell effect applied from the log: the client has already added the
    // condition; stamp the FX, keep the DM's note for the token's hover card,
    // and mark the effect row applied.
    if (fx?.effect) {
      if (fx.rollId) appliedRolls.push([fx.rollId, { kind: "effect", effect: fx.effect, ...(fx.note ? { note: fx.note } : {}), at }]);
      const effectNotes = { ...(prev?.effectNotes || npc.effectNotes || {}) };
      if (fx.note) effectNotes[fx.effect] = fx.note;
      else delete effectNotes[fx.effect];
      return { ...npc, effectNotes, lastFx: buildLastFx(fx, "effect", at) };
    }
    return npc;
  });

  const savedVersion = await saveNpcCombatState({ npcs: stampedNpcs });

  if (logEvents.length) {
    try {
      await appendRollHistoryEvents(logEvents);
    } catch (err) {
      console.error("[putNpcCombat] could not log session history", err);
    }
  }
  for (const [rollId, applied] of appliedRolls) await markRollApplied(rollId, applied);

  await notifySessionChanged();

  return ok(withVersions({ success: true }, { [NPC_COMBAT_SLUG]: savedVersion }));
};
