// Combat FX (ADR-031) — turn freshly detected damage/heal stamps into effect
// events for the engine. Shared by the DM map (MapPanel) and the player map
// (PlayerMapViewer) so both play the identical effect for the same hit.
import { PALETTES } from "../../characterSheet/theme";
import { classifyStrike, hueFromHex, matchDeclaredAttack, MELEE_GAP_UNITS } from "./strikeRules";

// Base token diameter in natural-image px before per-map / per-token scale
// (same unit the token chips are sized from).
export const TOKEN_UNIT_PX = 36;
// A stamp older than this when first seen is history, not an event to play.
export const FRESH_WINDOW_MS = 8000;
const NPC_SPELL_HUE = 275;

/**
 * Heal freshness gate — mirrors resolveDamageState's Phase A rule: never on
 * first paint, only when the stamp is new to this viewer and recent.
 * `seenRef` is a Map<key, stamp|null> owned by the caller.
 */
export function isFreshStamp(key, stamp, serverTime, seenRef) {
  const seen = seenRef.has(key) ? seenRef.get(key) : undefined;
  seenRef.set(key, stamp || null);
  if (!stamp || seen === undefined || stamp === seen) return false;
  const stampMs = Date.parse(stamp);
  const nowMs = Date.parse(serverTime || "") || Date.now();
  return Number.isFinite(stampMs) && nowMs - stampMs <= FRESH_WINDOW_MS;
}

/**
 * Every hit to play for one token this tick. The chosen action (`lastFx`,
 * ADR-032 — DM map action or Deal Damage) rides along when it belongs to the
 * same stamp; a miss has only a lastFx stamp. `healSeen`/`missSeen` are
 * caller-owned Maps (see isFreshStamp).
 */
export function collectTokenHits({ token, subject, damageFresh, serverTime, healSeen, missSeen }) {
  const hits = [];
  const fx = subject?.lastFx && typeof subject.lastFx === "object" ? subject.lastFx : null;
  const fxFor = (kind, stamp) => (fx && fx.kind === kind && fx.at === stamp ? fx : null);
  if (damageFresh) {
    const stamp = subject?.lastDamagedAt;
    hits.push({ kind: "damage", token, stamp, fromRef: subject?.lastDamageFrom ?? null, fx: fxFor("damage", stamp) });
  }
  if (isFreshStamp(token.id, subject?.lastHealedAt ?? null, serverTime, healSeen)) {
    const stamp = subject.lastHealedAt;
    hits.push({ kind: "heal", token, stamp, fromRef: subject?.lastHealFrom ?? null, fx: fxFor("heal", stamp) });
  }
  const missStamp = fx?.kind === "miss" ? fx.at : null;
  if (isFreshStamp(token.id, missStamp, serverTime, missSeen)) {
    hits.push({ kind: "miss", token, stamp: missStamp, fromRef: fx.attacker ?? null, fx });
  }
  return hits;
}

function isAdjacent(a, b, imageW, imageH, mapTokenScale) {
  const U = TOKEN_UNIT_PX * (Number.isFinite(mapTokenScale) ? mapTokenScale : 1);
  const dx = (b.x - a.x) * imageW, dy = (b.y - a.y) * imageH;
  const rA = (U / 2) * (Number.isFinite(a.scale) ? a.scale : 1);
  const rB = (U / 2) * (Number.isFinite(b.scale) ? b.scale : 1);
  return Math.hypot(dx, dy) - rA - rB <= MELEE_GAP_UNITS * U;
}

/**
 * @param {object} p
 * @param {Array} p.hits    [{ kind: "damage"|"heal"|"miss", token, stamp, fromRef: {type, sourceId}|null, fx? }]
 * @param {Array} p.tokens  all tokens on this map
 * @param {Array} p.party   party members ({ slug, palette })
 * @param {Array} p.rolls   shared roll history
 * @returns {Array} [{ id, style, crit, miss?, attackerId, targetId, hue }]
 */
export function buildStrikeEvents({ hits, tokens, party, rolls, imageW, imageH, mapTokenScale }) {
  const events = [];
  for (const hit of hits || []) {
    const target = hit.token;
    if (!target) continue;
    const fx = hit.fx || null;
    const ref = fx ? fx.attacker : hit.fromRef;
    const attacker = ref?.type && ref?.sourceId
      ? (tokens || []).find((t) => t.type === ref.type && t.sourceId === ref.sourceId && t.id !== target.id)
      : null;
    const member = ref?.type === "character" ? (party || []).find((m) => m.slug === ref.sourceId) : null;
    const palette = member ? PALETTES[member.palette] : null;
    const base = {
      id: `${hit.kind}|${target.id}|${hit.stamp}`,
      attackerId: attacker?.id ?? null,
      targetId: target.id,
      hue: palette ? hueFromHex(palette.accent) : NPC_SPELL_HUE,
    };
    if (fx) {
      // ADR-032 — the action was chosen explicitly: play exactly that.
      events.push({ ...base, style: fx.style, crit: hit.kind === "damage" && fx.crit === true, miss: hit.kind === "miss" });
      continue;
    }
    if (hit.kind === "miss") continue;
    const { attack, crit } = ref?.type === "character"
      ? matchDeclaredAttack(rolls, { attackerSlug: ref.sourceId, targetSourceId: target.sourceId, at: hit.stamp })
      : { attack: null, crit: false };
    const adjacent = attacker && imageW && imageH ? isAdjacent(attacker, target, imageW, imageH, mapTokenScale) : true;
    const style = classifyStrike({ attack, heal: hit.kind === "heal", adjacent });
    events.push({ ...base, style, crit: hit.kind === "heal" ? false : crit });
  }
  return events;
}
