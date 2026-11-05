const test = require("node:test");
const assert = require("node:assert/strict");
const { seenOf, shouldStamp, publicPresence } = require("./presence");

test("a poll stamps someone at most once a minute", () => {
  const now = Date.parse("2026-11-05T10:00:00Z");
  assert.equal(shouldStamp({}, "eoghan", now), true);
  assert.equal(shouldStamp({ eoghan: "2026-11-05T09:59:30Z" }, "eoghan", now), false);
  assert.equal(shouldStamp({ eoghan: "2026-11-05T09:58:59Z" }, "eoghan", now), true);
  assert.equal(shouldStamp({}, null, now), false);
});

test("polls only see the party's and the DM's times", () => {
  const seen = seenOf({ seen: { eoghan: "a", dm: "b", stranger: "c", bad: 3 } });
  assert.deepEqual(seen, { eoghan: "a", dm: "b", stranger: "c" });
  assert.deepEqual(publicPresence(seen, ["eoghan", "liu-sha"]), { eoghan: "a", dm: "b" });
  assert.deepEqual(seenOf(null), {});
});
