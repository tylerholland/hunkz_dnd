// Features & Traits — race/class/other features a player enters from their
// own books (Hidden Step, Second Wind, Bardic Inspiration…), with optional
// uses that recharge on a short or long rest. Pure helpers, no React.
//
// feature = {
//   id, name, kind: "race" | "class" | "other", description,
//   uses: null | { mode: "fixed" | "prof", max?: number, recharge: "short" | "long", used: number }
// }

export const FEATURE_KINDS = [
  { value: "race", label: "Race" },
  { value: "class", label: "Class" },
  { value: "other", label: "Other" },
];

export function proficiencyBonus(level) {
  const lvl = Math.max(1, Math.min(20, parseInt(level, 10) || 1));
  return 2 + Math.floor((lvl - 1) / 4);
}

export function featureMaxUses(feature, level) {
  const uses = feature?.uses;
  if (!uses) return 0;
  if (uses.mode === "prof") return proficiencyBonus(level);
  return Math.max(0, Math.min(99, parseInt(uses.max, 10) || 0));
}

export function featureUsesLeft(feature, level) {
  const max = featureMaxUses(feature, level);
  return Math.max(0, max - Math.max(0, Math.min(max, feature?.uses?.used || 0)));
}

export function normalizeFeatures(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((f) => f && typeof f.name === "string" && f.name.trim())
    .map((f, i) => ({
      id: f.id || `feature:${i}:${f.name}`,
      name: f.name,
      kind: FEATURE_KINDS.some((k) => k.value === f.kind) ? f.kind : "other",
      description: typeof f.description === "string" ? f.description : "",
      uses: f.uses && (f.uses.mode === "prof" || f.uses.mode === "fixed")
        ? { mode: f.uses.mode, max: f.uses.max, recharge: f.uses.recharge === "short" ? "short" : "long", used: Math.max(0, parseInt(f.uses.used, 10) || 0) }
        : null,
    }));
}

/** Spend (delta 1) or restore (delta -1) one use. Returns the new list. */
export function spendFeatureUse(features, id, delta, level) {
  return normalizeFeatures(features).map((f) => {
    if (f.id !== id || !f.uses) return f;
    const max = featureMaxUses(f, level);
    return { ...f, uses: { ...f.uses, used: Math.max(0, Math.min(max, f.uses.used + delta)) } };
  });
}

/** Refill uses on a rest: a long rest refills everything, a short rest only short-rest features. */
export function restFeatures(features, restType) {
  return normalizeFeatures(features).map((f) => {
    if (!f.uses) return f;
    if (restType === "short" && f.uses.recharge !== "short") return f;
    return { ...f, uses: { ...f.uses, used: 0 } };
  });
}

export function rechargeLabel(uses) {
  return uses?.recharge === "short" ? "short rest" : "long rest";
}
