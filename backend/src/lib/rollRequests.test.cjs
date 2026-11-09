const test = require("node:test");
const assert = require("node:assert/strict");
const { startRequest, normalizeRollRequests, addRequest, recordResult, projectRollRequests, rollRequestLogEvent, publicCheckEvent, MAX_OPEN } = require("./rollRequests");

const rules = { abilityCheckDice: "2d6", saveDice: "1d20" };
const party = ["eoghan", "liu", "aesop"];
const ask = (over = {}) => startRequest({ check: { skill: "Perception" }, targets: ["eoghan", "liu"], label: " The study ", ...over }, { id: "r1", rules, partySlugs: party });

test("a request takes its dice from the house rules: checks vs saves", () => {
  const r = ask();
  assert.deepEqual([r.check, r.dice, r.label, r.dc, r.adv], [{ ability: "wis", skill: "perception", save: false }, "2d6", "The study", null, "normal"]);
  assert.equal(ask({ check: { ability: "dex", save: true } }).dice, "1d20");
  assert.equal(ask({ targets: [] }).error, "Pick who rolls");
  assert.equal(ask({ targets: ["stranger"] }).error, "Only party members can be asked");
  assert.equal(ask({ check: { skill: "juggling" } }).error, "Pick a check or save");
  assert.equal(ask({ dc: 99 }).error, "DC must be 1–40");
  assert.equal(ask({ dc: 12, showDc: true }).showDc, true);
});

test("one result per player, only from those asked", () => {
  let r = ask();
  assert.equal(recordResult(r, "aesop", { total: 9 }).error, "That roll wasn't asked of you");
  r = recordResult(r, "eoghan", { total: 11, rolls: [5, 4] }).request;
  assert.deepEqual(r.results.eoghan, { total: 11, rolls: [5, 4], manual: false });
  assert.equal(recordResult(r, "eoghan", { total: 3 }).error, "Already rolled");
  assert.equal(recordResult(r, "liu", {}).error, "A total is required");
});

test("players see their own result until the DM reveals; never the label", () => {
  let state = addRequest({ requests: [] }, ask({ dc: 10 })).state;
  state = { requests: [recordResult(recordResult(state.requests[0], "eoghan", { total: 11 }).request, "liu", { total: 6 }).request] };
  const mine = projectRollRequests(state, { slug: "liu" });
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].mine.total, mine[0].results, mine[0].dc, mine[0].label], [6, undefined, null, undefined]);
  assert.deepEqual(projectRollRequests(state, { slug: "aesop" }), []);
  const revealed = projectRollRequests({ requests: [{ ...state.requests[0], revealed: true }] }, { slug: "liu" })[0];
  assert.deepEqual(revealed.results, [{ slug: "eoghan", total: 11 }, { slug: "liu", total: 6 }]);
  assert.equal(projectRollRequests(state, { isDm: true })[0].label, "The study");
});

test("the log line: pass/fail for the DM; players get theirs only, no label or hidden DC", () => {
  let r = ask({ dc: 10 });
  r = recordResult(r, "eoghan", { total: 11 }).request;
  const event = rollRequestLogEvent(r, { eoghan: "Eòghan" });
  assert.deepEqual(event.rows, [{ slug: "eoghan", name: "Eòghan", total: 11, pass: true }, { slug: "liu", name: "liu", total: null, pass: null }]);
  const pub = publicCheckEvent(event, "eoghan");
  assert.deepEqual([pub.label, pub.dc, pub.rows], [undefined, undefined, [{ slug: "eoghan", name: "Eòghan", total: 11 }]]);
  assert.equal(publicCheckEvent({ ...event, revealed: true }, "eoghan").rows.length, 2);
});

test("there's a cap on open requests; junk in the record is dropped", () => {
  let state = { requests: [] };
  for (let i = 0; i < MAX_OPEN; i++) state = addRequest(state, { ...ask(), id: `r${i}` }).state;
  assert.ok(addRequest(state, ask()).error);
  assert.equal(normalizeRollRequests({ requests: [{ id: "x", check: { skill: "nope" } }, null] }).requests.length, 0);
});

test("initiative is its own kind, on its own dice", () => {
  const r = startRequest({ check: { initiative: true }, targets: ["eoghan"] }, { id: "i1", rules: { ...rules, initiativeDice: "1d20" }, partySlugs: party });
  assert.deepEqual([r.check, r.dice], [{ ability: "dex", skill: null, save: false, initiative: true }, "1d20"]);
});
