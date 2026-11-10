export function buildDiceExprLabel(groups, flat = 0, { spaced = false } = {}) {
  const joiner = spaced ? " + " : "+";
  const parts = groups.map((group) => {
    const count = Number.isFinite(group.count)
      ? group.count
      : Array.isArray(group.rolls)
        ? group.rolls.length
        : 0;
    return `${count}d${group.sides}`;
  });
  // Unspaced, the flat bonus carries its own sign ("2d6+2", "1d20-1"), not a
  // joiner as well (which made "2d6++2").
  if (!spaced) return parts.join(joiner) + (flat > 0 ? `+${flat}` : flat < 0 ? `${flat}` : "");
  if (flat !== 0) parts.push(flat > 0 ? `+${flat}` : `${flat}`);

  return parts
    .join(joiner)
    .replace(/\+\s\+/g, "+ ")
    .replace(/\+\s-/g, "- ");
}

export function flattenRollValues(groups = []) {
  return groups.flatMap((group) => group.rolls || []);
}

export function extractRollValues(result) {
  // 2d6 keep-2 path: keptRolls + droppedRoll carry all three dice
  if (Array.isArray(result?.keptRolls) && result?.droppedRoll != null) {
    return [...result.keptRolls, result.droppedRoll];
  }
  // d20 adv/dis path
  if (result?.advKept !== null && result?.advKept !== undefined && result?.advDiscarded !== null && result?.advDiscarded !== undefined) {
    return [result.advKept, result.advDiscarded];
  }
  return flattenRollValues(result?.groups || []);
}

export function normalizeRollActionLabel(label) {
  if (!label) return "Free Roll";
  if (/^free roll$/i.test(label)) return "Free Roll";
  return label.replace(/\bcheck\b/gi, "Check");
}

export function formatRollValues(rollValues = []) {
  return Array.isArray(rollValues) && rollValues.length > 0
    ? `[${rollValues.join(", ")}]`
    : "";
}

function cleanRiders(riders) {
  return (Array.isArray(riders) ? riders : [])
    .filter((r) => r && typeof r.label === "string" && Number.isFinite(r.total))
    .slice(0, 3)
    .map((r) => ({ label: r.label.slice(0, 40), total: r.total, ...(typeof r.effect === "string" ? { effect: r.effect.slice(0, 40) } : {}) }));
}

export function buildRollHistoryPayload({ id, label, result, characterName, paletteKey, source, target, attack, tag, riders }) {
  const payload = {
    exprLabel: buildDiceExprLabel(result.groups, result.flat, { spaced: true }),
    label: normalizeRollActionLabel(label),
    total: result.total,
    rollValues: extractRollValues(result),
    isCrit: !!result.isCrit,
    isFumble: !!result.isFumble,
  };

  if (typeof id === "string" && id.trim()) payload.id = id.trim();
  if (typeof characterName === "string" && characterName.trim()) payload.characterName = characterName.trim();
  if (typeof paletteKey === "string" && paletteKey.trim()) payload.paletteKey = paletteKey.trim();
  if (typeof source === "string" && source.trim()) payload.source = source.trim();
  // Story 57 (ADR-026) — declared-attack provenance, structured and optional;
  // never baked into `label`. Absent when the roll didn't come from a
  // declaration — a roll fired from the ordinary roller panel is unaffected.
  if (target && typeof target === "object") payload.target = target;
  if (attack && typeof attack === "object") payload.attack = attack;
  // What the roll was for (free rolls); the DM can change it later.
  if (typeof tag === "string" && tag.trim()) payload.tag = tag.trim().slice(0, 60);
  // Story 70 — effect riders included in this damage roll (Hex +4).
  const riderList = cleanRiders(riders);
  if (riderList.length) payload.riders = riderList;

  return payload;
}

export function buildCharacterRollPayload(args) {
  return buildRollHistoryPayload(args);
}

export function buildLocalRollHistoryEntry({ id, label, result, timestamp, characterName, source, target, attack, tag, riders }) {
  const entry = {
    id,
    exprLabel: result.exprLabel || buildDiceExprLabel(result.groups, result.flat),
    label: normalizeRollActionLabel(label),
    total: result.total,
    rollValues: extractRollValues(result),
    isCrit: !!result.isCrit,
    isFumble: !!result.isFumble,
    timestamp: timestamp || Date.now(),
  };

  if (typeof characterName === "string" && characterName.trim()) entry.characterName = characterName.trim();
  if (typeof source === "string" && source.trim()) entry.source = source.trim();
  // Story 57 (ADR-026) — same optional declaration pass-through as the
  // broadcast payload, so the player's own local "Recent Rolls" list also
  // shows the declared target/attack.
  if (target && typeof target === "object") entry.target = target;
  if (attack && typeof attack === "object") entry.attack = attack;
  if (typeof tag === "string" && tag.trim()) entry.tag = tag.trim().slice(0, 60);
  const riderList = cleanRiders(riders);
  if (riderList.length) entry.riders = riderList;

  return entry;
}

/**
 * HP changes made from a roll (Deal Damage / Take Action carry its `rollId`)
 * are shown inside that roll's row instead of as rows of their own.
 * → { list: entries without the attached HP events, outcomes: Map(rollId → [hp events]) }
 */
export function groupHpUnderRolls(entries) {
  const ids = new Set(entries.map((entry) => entry?.id));
  const attached = (entry) => entry?.type === "hp" && entry.rollId && ids.has(entry.rollId);
  const outcomes = new Map();
  for (const entry of entries) {
    if (attached(entry)) outcomes.set(entry.rollId, [...(outcomes.get(entry.rollId) || []), entry]);
  }
  return { list: entries.filter((entry) => !attached(entry)), outcomes };
}
