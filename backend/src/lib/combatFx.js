// Combat FX (ADR-031, ADR-032) — the action the DM chose on the map (or the
// player's declared roll applied from the log) rides the HP write as `fx`,
// and is stamped as `lastFx` in the same write so every screen plays exactly
// that animation instead of guessing from initiative + roll history.

const FX_STYLES = ["cut", "chop", "flurry", "arrow", "rock", "fire", "force", "bolt", "heal"];
const MAX_ID_LEN = 80;

function boundedId(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_ID_LEN) : "";
}

// Client-supplied (same trust exposure as the HP value itself, ADR-005):
// bounded and whitelisted so it can't bloat a record.
function sanitizeFx(raw) {
  if (!raw || typeof raw !== "object") return null;
  const style = FX_STYLES.includes(raw.style) ? raw.style : null;
  if (!style) return null;
  const type = raw.attacker?.type === "character" || raw.attacker?.type === "npc" ? raw.attacker.type : null;
  const sourceId = boundedId(raw.attacker?.sourceId);
  const rollId = boundedId(raw.rollId);
  return {
    attacker: type && sourceId ? { type, sourceId } : null,
    style,
    crit: raw.crit === true,
    miss: raw.miss === true,
    rollId: rollId || null,
  };
}

// kind: "damage" | "heal" | "miss"
function buildLastFx(fx, kind, at) {
  const out = { at, kind, attacker: fx.attacker, style: fx.style, crit: kind === "damage" && fx.crit };
  if (fx.rollId) out.rollId = fx.rollId;
  return out;
}

module.exports = { FX_STYLES, sanitizeFx, buildLastFx };
