// Party vote (design/prototypes/party-vote.html). One function behind /vote:
//   PUT  /vote          { action, ... } — the DM: "start" (question, options,
//                       multi, limitSec, showLive, showResult), "close",
//                       "cancel" (gone, unlogged), "dismiss" (done with it)
//   POST /vote/ballot   { asSlug, voteId, picks: [optionIndex…] } — a player
//                       votes or changes their vote (their password, or the DM's)
// Polls carry the vote (getSessionState → lib/vote.js projectVote). A finished
// vote goes into the session log (type "vote") when the DM dismisses it or
// starts the next one.
const crypto = require("crypto");
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { getSpecialRecord, putSpecialRecord, appendRollHistoryEvent, getPartyRosterState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");
const { currentVersion, withVersionRetry, VersionConflictError } = require("../lib/versioning");
const { VOTE_SLUG, isReservedCharacterSlug } = require("../lib/specialItems");
const { startVote, normalizeVote, voteStatus, castBallot, projectVote, voteLogEvent } = require("../lib/vote");

async function isDm(event) {
  const password = event.headers?.["x-character-password"];
  if (password === undefined || password === null) return false;
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  return auth.valid && auth.role === "dm";
}

// The character behind a ballot, if the password is theirs (or the DM's).
async function voter(event, slug) {
  if (typeof slug !== "string" || !slug.trim() || isReservedCharacterSlug(slug.trim())) return null;
  const got = await db.send(new GetCommand({ TableName: TABLE, Key: { slug: slug.trim() } }));
  if (!got.Item) return null;
  const auth = await verifyPassword(event.headers?.["x-character-password"] ?? "", got.Item);
  return auth.valid ? got.Item : null;
}

async function readVote() {
  const item = await getSpecialRecord(VOTE_SLUG);
  return { vote: normalizeVote(item), version: currentVersion(item) };
}

// The log line for a finished vote. Best effort: the vote stands even if the log write fails.
async function logIfFinished(vote, partySlugs) {
  if (!vote || !Object.keys(vote.ballots).length) return;
  if (voteStatus(vote, { partySlugs }) !== "closed") return;
  try { await appendRollHistoryEvent(voteLogEvent(vote)); } catch { /* the vote itself already happened */ }
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = (event.rawPath || event.path || "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean); // ["vote", ...]
  if (parts[0] !== "vote") return notFound();
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }
  const roster = await getPartyRosterState();
  const partySlugs = roster.members;

  // PUT /vote — the DM runs the vote
  if (parts.length === 1 && method === "PUT") {
    if (!(await isDm(event))) return forbidden("DM password required");
    const action = body.action;
    try {
      const saved = await withVersionRetry(async () => {
        const { vote, version } = await readVote();
        if (action === "start") {
          const next = startVote(body, { id: crypto.randomUUID() });
          if (next.error) return { error: badRequest(next.error) };
          if (vote && voteStatus(vote, { partySlugs }) === "open") return { error: conflict("A vote is already open") };
          await putSpecialRecord(VOTE_SLUG, next, { expectedVersion: version });
          return { vote: next, finished: vote };
        }
        if (!vote) return { error: notFound("There's no vote") };
        if (action === "close") {
          const next = { ...vote, status: "closed", closedAt: vote.closedAt || new Date().toISOString() };
          await putSpecialRecord(VOTE_SLUG, next, { expectedVersion: version });
          return { vote: next };
        }
        if (action === "cancel" || action === "dismiss") {
          await putSpecialRecord(VOTE_SLUG, { cleared: new Date().toISOString() }, { expectedVersion: version });
          return { vote: null, finished: action === "dismiss" ? vote : null };
        }
        return { error: badRequest("Unknown action") };
      });
      if (saved.error) return saved.error;
      // The vote that just ended goes in the log, once the write has stuck.
      await logIfFinished(saved.finished, partySlugs);
      await notifySessionChanged();
      return ok({ vote: projectVote(saved.vote, { isDm: true, partySlugs }) });
    } catch (err) {
      if (err instanceof VersionConflictError) return conflict("Busy — please try again");
      throw err;
    }
  }

  // POST /vote/ballot — a player votes (or changes their vote)
  if (parts[1] === "ballot" && parts.length === 2 && method === "POST") {
    const slug = typeof body.asSlug === "string" ? body.asSlug.trim() : "";
    if (!slug) return badRequest("asSlug is required");
    if (roster.exists && !partySlugs.includes(slug)) return forbidden("Only the party votes");
    if (!(await voter(event, slug))) return forbidden("That character's password is required");
    try {
      const saved = await withVersionRetry(async () => {
        const { vote, version } = await readVote();
        if (!vote || vote.id !== body.voteId) return { error: conflict("That vote has ended") };
        const cast = castBallot(vote, slug, body.picks, { partySlugs });
        if (cast.error) return { error: conflict(cast.error) };
        // Everyone's voted: it closes now.
        const next = voteStatus(cast.vote, { partySlugs }) === "closed" ? { ...cast.vote, status: "closed", closedAt: new Date().toISOString() } : cast.vote;
        await putSpecialRecord(VOTE_SLUG, next, { expectedVersion: version });
        return { vote: next };
      });
      if (saved.error) return saved.error;
      await notifySessionChanged();
      return ok({ vote: projectVote(saved.vote, { slug, partySlugs }) });
    } catch (err) {
      if (err instanceof VersionConflictError) return conflict("Busy — please try again");
      throw err;
    }
  }

  return notFound();
};
