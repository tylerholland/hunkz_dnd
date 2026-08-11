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
  if (flat !== 0) parts.push(flat > 0 ? `+${flat}` : `${flat}`);
  if (!spaced) return parts.join(joiner);

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

export function buildRollHistoryPayload({ id, label, result, characterName, paletteKey, source, target, attack }) {
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

  return payload;
}

export function buildCharacterRollPayload(args) {
  return buildRollHistoryPayload(args);
}

export function buildLocalRollHistoryEntry({ id, label, result, timestamp, characterName, source, target, attack }) {
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

  return entry;
}
