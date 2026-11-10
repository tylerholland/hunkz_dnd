// Captures today's GET /session-state responses for the fixture, per viewer.
// Run once, before phase 0 starts changing handlers:
//   node test/phase0/backend/helpers/captureGolden.cjs
const fs = require("node:fs");
const path = require("node:path");
const { oldTable } = require("./fixtures.cjs");
const { todaySessionState, VIEWERS } = require("./todaySessionState.cjs");

(async () => {
  for (const viewer of Object.keys(VIEWERS)) {
    const res = await todaySessionState(oldTable().items, viewer);
    if (res.statusCode !== 200) throw new Error(`${viewer}: ${res.statusCode}`);
    const file = path.join(__dirname, "../golden", `session-state.${viewer}.json`);
    fs.writeFileSync(file, `${JSON.stringify(res.body, null, 2)}\n`);
    console.log(`wrote ${path.relative(process.cwd(), file)} (${Object.keys(res.body).length} keys)`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
