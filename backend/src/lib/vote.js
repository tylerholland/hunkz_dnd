// Party vote (design/prototypes/party-vote.html). The DM asks the party a
// question with a few options; players vote from their pages; the DM sees the
// board. One record, riding the session poll:
//   { id, question, options[], multi, limitSec, startedAt, endsAt|null,
//     showLive, showResult, status: "open"|"closed", closedAt|null,
//     ballots: { [slug]: [optionIndex…] } }
// It's closed when the DM closes it, when time runs out, or when everyone in
// the party has voted. Players only ever get what the DM's two settings allow.
const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;
const LIMITS = [0, 30, 60, 120, 300];

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** A new vote from the DM's form, or { error }. */
function startVote(fields, { now = Date.now(), id }) {
  const question = clip(fields?.question, 80);
  const options = (Array.isArray(fields?.options) ? fields.options : []).map((o) => clip(o, 60)).filter(Boolean).slice(0, MAX_OPTIONS);
  if (!question) return { error: "A vote needs a question" };
  if (options.length < MIN_OPTIONS) return { error: "A vote needs at least two options" };
  const limitSec = LIMITS.includes(Number(fields?.limitSec)) ? Number(fields.limitSec) : 0;
  return {
    id,
    question,
    options,
    multi: fields?.multi === true,
    limitSec,
    startedAt: new Date(now).toISOString(),
    endsAt: limitSec ? new Date(now + limitSec * 1000).toISOString() : null,
    showLive: fields?.showLive === true,
    showResult: fields?.showResult !== false,
    status: "open",
    closedAt: null,
    ballots: {},
  };
}

/** The stored record, tidied (null when there's no vote). */
function normalizeVote(record) {
  if (!record || typeof record !== "object" || typeof record.id !== "string" || !Array.isArray(record.options)) return null;
  const ballots = {};
  for (const [slug, picks] of Object.entries(record.ballots || {})) {
    if (Array.isArray(picks)) ballots[slug] = picks.filter((i) => Number.isInteger(i) && i >= 0 && i < record.options.length);
  }
  return {
    id: record.id,
    question: String(record.question || ""),
    options: record.options.map(String),
    multi: record.multi === true,
    limitSec: Number(record.limitSec) || 0,
    startedAt: record.startedAt || null,
    endsAt: record.endsAt || null,
    showLive: record.showLive === true,
    showResult: record.showResult !== false,
    status: record.status === "closed" ? "closed" : "open",
    closedAt: record.closedAt || null,
    ballots,
  };
}

/** "open" or "closed", counting time running out and everyone having voted. */
function voteStatus(vote, { now = Date.now(), partySlugs = [] } = {}) {
  if (!vote) return null;
  if (vote.status === "closed") return "closed";
  if (vote.endsAt && Date.parse(vote.endsAt) <= now) return "closed";
  if (partySlugs.length && partySlugs.every((slug) => vote.ballots[slug]?.length)) return "closed";
  return "open";
}

/** Counts per option, and the winning option(s) (more than one = a tie). */
function voteResult(vote) {
  const counts = vote.options.map(() => 0);
  for (const picks of Object.values(vote.ballots)) for (const i of picks) counts[i] += 1;
  const max = Math.max(0, ...counts);
  const winners = max > 0 ? counts.map((n, i) => (n === max ? i : -1)).filter((i) => i >= 0) : [];
  return { counts, winners };
}

/** The vote with `slug`'s ballot cast, or { error }. Picks are option indexes. */
function castBallot(vote, slug, picks, { now = Date.now(), partySlugs = [] } = {}) {
  if (!vote) return { error: "There's no vote" };
  if (voteStatus(vote, { now, partySlugs }) !== "open") return { error: "The vote has closed" };
  const list = [...new Set((Array.isArray(picks) ? picks : []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < vote.options.length).sort((a, b) => a - b);
  if (!list.length) return { error: "Pick an option" };
  if (!vote.multi && list.length > 1) return { error: "Pick one option" };
  return { vote: { ...vote, ballots: { ...vote.ballots, [slug]: list } } };
}

/** What a poll returns. The DM gets everything; a player gets their own
 * ballot, everyone's while open only if showLive, and the result once closed
 * only if showResult. */
function projectVote(vote, { isDm = false, slug = null, now = Date.now(), partySlugs = [] } = {}) {
  if (!vote) return null;
  const status = voteStatus(vote, { now, partySlugs });
  const base = {
    id: vote.id, question: vote.question, options: vote.options, multi: vote.multi,
    endsAt: vote.endsAt, showLive: vote.showLive, showResult: vote.showResult, status,
  };
  if (isDm) return { ...base, ballots: vote.ballots, ...voteResult(vote) };
  const out = { ...base, mine: (slug && vote.ballots[slug]) || [] };
  if ((status === "open" && vote.showLive) || (status === "closed" && vote.showResult)) out.ballots = vote.ballots;
  if (status === "closed" && vote.showResult) Object.assign(out, voteResult(vote));
  return out;
}

/** The session-log line for a finished vote (no outcome when it was kept from players). */
function voteLogEvent(vote) {
  const { counts, winners } = voteResult(vote);
  const voted = Object.keys(vote.ballots).length;
  const event = { id: `vote-${vote.id}`, type: "vote", question: vote.question, voted, createdAt: new Date().toISOString() };
  if (vote.showResult) {
    event.winners = winners.map((i) => vote.options[i]);
    event.top = winners.length ? counts[winners[0]] : 0;
  } else {
    event.hidden = true;
  }
  return event;
}

module.exports = { MAX_OPTIONS, LIMITS, startVote, normalizeVote, voteStatus, voteResult, castBallot, projectVote, voteLogEvent };
