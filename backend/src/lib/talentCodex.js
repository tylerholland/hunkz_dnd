// Story 39 — Talent Codex: pure helpers (no DB).
// Record (`talent-codex`): { entries: { <talentKey>: { description, atTable, updatedAt } } }
// Only overrides are stored; untouched skills/abilities keep the built-in text.

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,29}$/;
const MAX_DESCRIPTION = 2000;
const MAX_AT_TABLE = 1000;
const MAX_ENTRIES = 100;

const clip = (value, n) => (typeof value === "string" ? value.trim().slice(0, n) : "");

function normalizeTalentCodexEntries(raw) {
  const entries = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return entries;
  for (const [key, value] of Object.entries(raw)) {
    if (Object.keys(entries).length >= MAX_ENTRIES) break;
    if (!KEY_PATTERN.test(key) || !value || typeof value !== "object") continue;
    const description = clip(value.description, MAX_DESCRIPTION);
    const atTable = clip(value.atTable, MAX_AT_TABLE);
    if (!description && !atTable) continue; // nothing to override
    entries[key] = {
      ...(description ? { description } : {}),
      ...(atTable ? { atTable } : {}),
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    };
  }
  return entries;
}

module.exports = { normalizeTalentCodexEntries, KEY_PATTERN, MAX_DESCRIPTION, MAX_AT_TABLE };
