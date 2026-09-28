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

function isAdjacent(a, b, imageW, imageH, mapTokenScale) {
  const U = TOKEN_UNIT_PX * (Number.isFinite(mapTokenScale) ? mapTokenScale : 1);
  const dx = (b.x - a.x) * imageW, dy = (b.y - a.y) * imageH;
  const rA = (U / 2) * (Number.isFinite(a.scale) ? a.scale : 1);
  const rB = (U / 2) * (Number.isFinite(b.scale) ? b.scale : 1);
  return Math.hypot(dx, dy) - rA - rB <= MELEE_GAP_UNITS * U;
}

/**
 * @param {object} p
 * @param {Array} p.hits    [{ kind: "damage"|"heal", token, stamp, fromRef: {type, sourceId}|null }]
 * @param {Array} p.tokens  all tokens on this map
 * @param {Array} p.party   party members ({ slug, palette })
 * @param {Array} p.rolls   shared roll history
 * @returns {Array} [{ id, style, crit, attackerId, targetId, hue }]
 */
export function buildStrikeEvents({ hits, tokens, party, rolls, imageW, imageH, mapTokenScale }) {
  const events = [];
  for (const hit of hits || []) {
    const target = hit.token;
    if (!target) continue;
    const ref = hit.fromRef;
    const attacker = ref?.type && ref?.sourceId
      ? (tokens || []).find((t) => t.type === ref.type && t.sourceId === ref.sourceId && t.id !== target.id)
      : null;
    const member = ref?.type === "character" ? (party || []).find((m) => m.slug === ref.sourceId) : null;
    const { attack, crit } = ref?.type === "character"
      ? matchDeclaredAttack(rolls, { attackerSlug: ref.sourceId, targetSourceId: target.sourceId, at: hit.stamp })
      : { attack: null, crit: false };
    const adjacent = attacker && imageW && imageH ? isAdjacent(attacker, target, imageW, imageH, mapTokenScale) : true;
    const style = classifyStrike({ attack, heal: hit.kind === "heal", adjacent });
    const palette = member ? PALETTES[member.palette] : null;
    events.push({
      id: `${hit.kind}|${target.id}|${hit.stamp}`,
      style,
      crit: hit.kind === "heal" ? false : crit,
      attackerId: attacker?.id ?? null,
      targetId: target.id,
      hue: palette ? hueFromHex(palette.accent) : NPC_SPELL_HUE,
    });
  }
  return events;
}
