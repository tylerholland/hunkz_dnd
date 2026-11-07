const test = require("node:test");
const assert = require("node:assert/strict");
const { startVote, normalizeVote, voteStatus, voteResult, castBallot, projectVote, voteLogEvent } = require("./vote");

const NOW = Date.parse("2026-11-06T20:00:00Z");
const party = ["eoghan", "liu", "aesop"];
const fresh = (over = {}) => startVote({ question: " Where next? ", options: ["Inn", "Temple", " ", "Beggar"], limitSec: 60, ...over }, { now: NOW, id: "v1" });

test("a vote starts from the DM's form, tidied", () => {
  const v = fresh();
  assert.deepEqual([v.question, v.options, v.endsAt, v.showLive, v.showResult, v.status], ["Where next?", ["Inn", "Temple", "Beggar"], "2026-11-06T20:01:00.000Z", false, true, "open"]);
  assert.equal(startVote({ question: "Q", options: ["Only one"] }, { id: "x" }).error, "A vote needs at least two options");
  assert.equal(startVote({ question: "", options: ["A", "B"] }, { id: "x" }).error, "A vote needs a question");
  assert.equal(startVote({ question: "Q", options: ["A", "B"], limitSec: 999 }, { id: "x" }).endsAt, null);
});

test("it closes when the DM closes it, time runs out, or everyone has voted", () => {
  let v = fresh();
  assert.equal(voteStatus(v, { now: NOW + 59000, partySlugs: party }), "open");
  assert.equal(voteStatus(v, { now: NOW + 60000, partySlugs: party }), "closed");
  for (const slug of party) v = castBallot(v, slug, [0], { now: NOW, partySlugs: party }).vote;
  assert.equal(voteStatus(v, { now: NOW, partySlugs: party }), "closed");
  assert.equal(voteStatus({ ...fresh(), status: "closed" }, { now: NOW }), "closed");
});

test("ballots: one pick unless multi, changeable until it closes", () => {
  let v = fresh();
  assert.equal(castBallot(v, "eoghan", [0, 1], { now: NOW }).error, "Pick one option");
  assert.equal(castBallot(v, "eoghan", [9], { now: NOW }).error, "Pick an option");
  v = castBallot(v, "eoghan", [0], { now: NOW }).vote;
  v = castBallot(v, "eoghan", [2], { now: NOW }).vote;
  assert.deepEqual(v.ballots.eoghan, [2]);
  assert.equal(castBallot(v, "liu", [0], { now: NOW + 61000 }).error, "The vote has closed");
  const multi = fresh({ multi: true });
  assert.deepEqual(castBallot(multi, "liu", [2, 0, 2], { now: NOW }).vote.ballots.liu, [0, 2]);
});

test("players see only what the DM allows", () => {
  let v = fresh();
  v = castBallot(v, "eoghan", [0], { now: NOW }).vote;
  v = castBallot(v, "liu", [1], { now: NOW }).vote;
  const open = projectVote(v, { slug: "eoghan", now: NOW, partySlugs: party });
  assert.deepEqual(open.mine, [0]);
  assert.equal(open.ballots, undefined);
  assert.ok(projectVote({ ...v, showLive: true }, { slug: "eoghan", now: NOW, partySlugs: party }).ballots);
  const dm = projectVote(v, { isDm: true, now: NOW, partySlugs: party });
  assert.deepEqual(dm.counts, [1, 1, 0]);
  const closed = { ...v, status: "closed" };
  assert.deepEqual(projectVote(closed, { slug: "liu", now: NOW }).winners, [0, 1]);
  const kept = projectVote({ ...closed, showResult: false }, { slug: "liu", now: NOW });
  assert.equal(kept.ballots, undefined);
  assert.equal(kept.winners, undefined);
  assert.deepEqual(kept.mine, [1]);
});

test("the log says the outcome, unless it was kept from players", () => {
  let v = fresh();
  v = castBallot(v, "eoghan", [0], { now: NOW }).vote;
  v = castBallot(v, "liu", [0], { now: NOW }).vote;
  assert.deepEqual(voteResult(v).winners, [0]);
  const shown = voteLogEvent(v);
  assert.deepEqual([shown.type, shown.question, shown.winners, shown.top, shown.voted], ["vote", "Where next?", ["Inn"], 2, 2]);
  const hidden = voteLogEvent({ ...v, showResult: false });
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.winners, undefined);
  assert.equal(normalizeVote({ id: "v", options: ["a", "b"], ballots: { x: [0, 7] } }).ballots.x.length, 1);
});
