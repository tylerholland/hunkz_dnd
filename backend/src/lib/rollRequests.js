// Roll requests (design/prototypes/dm-adventure-layout.html): the DM asks one
// or more players for a check or save; each gets a prompt with the roll loaded
// and sends back their total. One record, riding the session poll:
//   { requests: [ { id, label, check: { ability, skill|null, save }, dice, adv,
//       dc|null, showDc, targets[], results: { [slug]: { total, rolls[], manual } },
//       revealed, createdAt } ] }
// Players only see requests aimed at them: their own result, and everyone's
// once the DM reveals them. The label is the DM's (for the log / Chronicle).
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const SKILLS = {
  athletics: "str", acrobatics: "dex", "sleight of hand": "dex", stealth: "dex",
  arcana: "int", history: "int", investigation: "int", nature: "int", religion: "int",
  "animal handling": "wis", insight: "wis", medicine: "wis", perception: "wis", survival: "wis",
  deception: "cha", intimidation: "cha", performance: "cha", persuasion: "cha",
};
const ADV = ["normal", "adv", "dis"];
const MAX_OPEN = 8;

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const intIn = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** { ability, skill, save } from loose input, or null. A skill decides its
 * ability. Initiative is its own kind: { ability: "dex", initiative: true }. */
function normalizeCheck(raw) {
  if (raw?.initiative === true) return { ability: "dex", skill: null, save: false, initiative: true };
  const skill = typeof raw?.skill === "string" ? raw.skill.trim().toLowerCase() : "";
  if (skill) return SKILLS[skill] ? { ability: SKILLS[skill], skill, save: false } : null;
  const ability = typeof raw?.ability === "string" ? raw.ability.trim().toLowerCase() : "";
  if (!ABILITIES.includes(ability)) return null;
  return { ability, skill: null, save: raw?.save === true };
}

/** A new request from the DM, or { error }. `rules` are the house rules (dice). */
function startRequest(fields, { id, now = Date.now(), rules = {}, partySlugs = [] } = {}) {
  const check = normalizeCheck(fields?.check);
  if (!check) return { error: "Pick a check or save" };
  const targets = [...new Set((Array.isArray(fields?.targets) ? fields.targets : []).filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()))];
  if (!targets.length) return { error: "Pick who rolls" };
  if (partySlugs.length && targets.some((s) => !partySlugs.includes(s))) return { error: "Only party members can be asked" };
  const dc = fields?.dc == null || fields.dc === "" ? null : intIn(Number(fields.dc), 1, 40);
  if (fields?.dc != null && fields.dc !== "" && dc == null) return { error: "DC must be 1–40" };
  return {
    id,
    label: clip(fields?.label, 60),
    check,
    dice: check.initiative ? (rules.initiativeDice || "1d20") : check.save ? (rules.saveDice || "1d20") : (rules.abilityCheckDice || "2d6"),
    adv: ADV.includes(fields?.adv) ? fields.adv : "normal",
    dc,
    showDc: !!dc && fields?.showDc === true,
    targets,
    results: {},
    revealed: false,
    createdAt: new Date(now).toISOString(),
  };
}

function normalizeRequest(r) {
  if (!r || typeof r !== "object" || typeof r.id !== "string") return null;
  const check = normalizeCheck(r.check);
  if (!check) return null;
  const targets = (Array.isArray(r.targets) ? r.targets : []).filter((s) => typeof s === "string");
  const results = {};
  for (const [slug, res] of Object.entries(r.results || {})) {
    if (!targets.includes(slug) || !Number.isInteger(res?.total)) continue;
    results[slug] = { total: res.total, rolls: (Array.isArray(res.rolls) ? res.rolls : []).filter(Number.isInteger).slice(0, 12), manual: res.manual === true };
  }
  return {
    id: r.id,
    label: clip(r.label, 60),
    check,
    dice: typeof r.dice === "string" ? r.dice : "2d6",
    adv: ADV.includes(r.adv) ? r.adv : "normal",
    dc: intIn(r.dc, 1, 40),
    showDc: r.showDc === true,
    targets,
    results,
    revealed: r.revealed === true,
    createdAt: r.createdAt || null,
  };
}

/** The stored record, tidied: { requests: [...] } (oldest first). */
function normalizeRollRequests(record) {
  const list = Array.isArray(record?.requests) ? record.requests : [];
  return { requests: list.map(normalizeRequest).filter(Boolean) };
}

/** The record with a request added, or { error } when too many are open. */
function addRequest(state, request) {
  if (state.requests.length >= MAX_OPEN) return { error: "Too many open requests. Close one first." };
  return { state: { requests: [...state.requests, request] } };
}

/** The request with `slug`'s result recorded, or { error }. One result each. */
function recordResult(request, slug, raw) {
  if (!request) return { error: "That roll request has ended" };
  if (!request.targets.includes(slug)) return { error: "That roll wasn't asked of you" };
  if (request.results[slug]) return { error: "Already rolled" };
  const total = intIn(Number(raw?.total), -50, 300);
  if (total == null) return { error: "A total is required" };
  const rolls = (Array.isArray(raw?.rolls) ? raw.rolls : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 100).slice(0, 12);
  return { request: { ...request, results: { ...request.results, [slug]: { total, rolls, manual: raw?.manual === true } } } };
}

const passOf = (request, total) => (request.dc && Number.isInteger(total) ? total >= request.dc : null);

/** What a poll returns. The DM gets everything; a player only the requests
 * aimed at them, their own result, and everyone's once revealed. */
function projectRollRequests(state, { isDm = false, slug = null } = {}) {
  if (isDm) return state.requests;
  return state.requests
    .filter((r) => slug && r.targets.includes(slug))
    .map((r) => ({
      id: r.id,
      check: r.check,
      dice: r.dice,
      adv: r.adv,
      dc: r.showDc ? r.dc : null,
      mine: r.results[slug] || null,
      revealed: r.revealed,
      ...(r.revealed ? { results: r.targets.map((s) => ({ slug: s, total: r.results[s]?.total ?? null })) } : {}),
    }));
}

/** The session-log event for a finished request. `names` maps slug → display name. */
function rollRequestLogEvent(request, names = {}) {
  return {
    id: `check-${request.id}`,
    type: "check",
    label: request.label,
    check: request.check,
    dice: request.dice,
    adv: request.adv,
    dc: request.dc,
    showDc: request.showDc,
    revealed: request.revealed,
    rows: request.targets.map((s) => ({ slug: s, name: clip(names?.[s], 40) || s, total: request.results[s]?.total ?? null, pass: passOf(request, request.results[s]?.total) })),
    createdAt: new Date().toISOString(),
  };
}

/**
 * A log event as a player (`slug`; null for the Chronicle) may see it. Until
 * the DM reveals it: no label, and others' rows say only who rolled. A DC the
 * DM kept hidden never shows.
 */
function publicCheckEvent(event, slug = null) {
  const out = { ...event };
  if (!out.showDc) { delete out.dc; out.rows = (out.rows || []).map(({ pass, ...row }) => row); }
  if (!out.revealed) {
    delete out.label;
    out.rows = (out.rows || []).map((row) => (slug && row.slug === slug ? row : { slug: row.slug, name: row.name }));
  }
  return out;
}

module.exports = { ABILITIES, SKILLS, MAX_OPEN, normalizeCheck, startRequest, normalizeRollRequests, addRequest, recordResult, projectRollRequests, rollRequestLogEvent, publicCheckEvent };
