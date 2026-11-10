// Load a phase 0 module, or fail with a message saying which step builds it.
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "../../../..");

function need(relPath, step) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) throw new Error(`Not built yet (phase 0 step ${step}): ${relPath}`);
  return require(full);
}

module.exports = { need, ROOT };
