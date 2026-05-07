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

export function buildCharacterRollPayload({ label, result }) {
  return {
    exprLabel: buildDiceExprLabel(result.groups, result.flat, { spaced: true }),
    label: normalizeRollActionLabel(label),
    total: result.total,
    rollValues: extractRollValues(result),
    isCrit: !!result.isCrit,
    isFumble: !!result.isFumble,
  };
}

export function buildLocalRollHistoryEntry({ id, label, result, timestamp }) {
  return {
    id,
    exprLabel: result.exprLabel || buildDiceExprLabel(result.groups, result.flat),
    label: normalizeRollActionLabel(label),
    total: result.total,
    rollValues: extractRollValues(result),
    isCrit: !!result.isCrit,
    isFumble: !!result.isFumble,
    timestamp: timestamp || Date.now(),
  };
}
