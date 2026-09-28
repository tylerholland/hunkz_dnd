// Session history (Story 69) — HP and condition changes are written into the
// shared roll-history feed as `type: "hp"` / `type: "condition"` events, so
// the log (and later the Chronicle) shows damage, healing, misses and
// condition changes alongside the dice. Built by the handlers that already
// hold the before/after values (session.js, putNpcCombat.js).

const MAX_NAME_LEN = 60;
const bounded = (value) => (typeof value === "string" ? value.trim().slice(0, MAX_NAME_LEN) : "");

function eventId(kind) {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function subjectRef(type, sourceId, name) {
  return { type, sourceId, name: bounded(name) || sourceId };
}

/**
 * @param {object} p
 * @param {{type, sourceId, name}} p.subject
 * @param {number} p.from  HP before
 * @param {number} p.to    HP after (equal to `from` for a miss)
 * @param {number|null} p.max
 * @param {object|null} p.fx  sanitized Take Action fx (tags the event with the attack)
 * @param {"dm"|"player"} p.editor
 */
function buildHpEvent({ subject, from, to, max = null, fx = null, editor = "dm", at }) {
  const event = {
    id: eventId("hp"),
    type: "hp",
    createdAt: at || new Date().toISOString(),
    subject,
    from,
    to,
    delta: to - from,
    editor,
  };
  if (Number.isFinite(max)) event.max = max;
  if (fx) {
    if (fx.attacker) event.by = fx.attacker;
    event.action = { style: fx.style, crit: !!fx.crit && !fx.miss };
    if (fx.name) event.action.name = fx.name;
    if (fx.miss) event.miss = true;
    if (fx.rollId) event.rollId = fx.rollId;
  }
  return event;
}

const conditionNames = (list) => (Array.isArray(list) ? list : [])
  .map((c) => (typeof c === "string" ? c : c?.name))
  .filter((c) => typeof c === "string" && c);

/** Returns null when nothing changed. */
function buildConditionEvent({ subject, before, after, exhaustionBefore, exhaustionAfter, editor = "dm", at }) {
  const prev = new Set(conditionNames(before));
  const next = new Set(conditionNames(after));
  const added = [...next].filter((c) => !prev.has(c));
  const removed = [...prev].filter((c) => !next.has(c));
  const exhaustionChanged = Number.isFinite(exhaustionAfter) && (exhaustionBefore ?? 0) !== exhaustionAfter;
  if (!added.length && !removed.length && !exhaustionChanged) return null;
  const event = {
    id: eventId("cond"),
    type: "condition",
    createdAt: at || new Date().toISOString(),
    subject,
    added,
    removed,
    editor,
  };
  if (exhaustionChanged) event.exhaustion = { from: exhaustionBefore ?? 0, to: exhaustionAfter };
  return event;
}

module.exports = { subjectRef, buildHpEvent, buildConditionEvent, conditionNames };
