// Keeps the golden files honest until phase 0 starts: if someone changes
// getSessionState's output before then, recapture
// (node backend/test/phase0/helpers/captureGolden.cjs). Skips itself once the
// store exists, because today's handler is then gone.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./helpers/need.cjs");
const { oldTable } = require("./helpers/fixtures.cjs");
const { todaySessionState, VIEWERS } = require("./helpers/todaySessionState.cjs");

const started = fs.existsSync(path.join(ROOT, "backend/src/lib/store.js"));

for (const viewer of Object.keys(VIEWERS)) {
  test(`golden: today's GET /session-state as ${viewer}`, { skip: started && "phase 0 has started" }, async () => {
    const res = await todaySessionState(oldTable().items, viewer);
    assert.deepEqual(res.body, require(`./golden/session-state.${viewer}.json`));
  });
}
