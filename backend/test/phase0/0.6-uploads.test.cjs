// Phase 0, step 0.6 — new uploads go in folders by owner; old files stay put.
// backend/src/lib/uploads.js:
//   uploadKey({ kind, campaignId, libraryId, characterId, filename, id }) → S3 key
//     map          → lib/<libraryId>/maps/<id>.<ext>
//     npc-portrait → lib/<libraryId>/npc/<id>.<ext>
//     shop-item    → lib/<libraryId>/shop-items/<id>.<ext>
//     moment       → camp/<campaignId>/moments/<id>.<ext>
//     portrait     → char/<characterId>/portraits/<id>.<ext>
//   `id` is generated when not given (tests pass one). Images only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { need, ROOT } = require("./helpers/need.cjs");

const uploads = () => need("backend/src/lib/uploads.js", "0.6");
const key = (args) => uploads().uploadKey({ id: "abc", ...args });

test("each kind of upload has its owner's folder", () => {
  assert.equal(key({ kind: "map", libraryId: "hunkz", filename: "Sewers.PNG" }), "lib/hunkz/maps/abc.png");
  assert.equal(key({ kind: "npc-portrait", libraryId: "hunkz", filename: "goblin.webp" }), "lib/hunkz/npc/abc.webp");
  assert.equal(key({ kind: "shop-item", libraryId: "hunkz", filename: "potion.jpeg" }), "lib/hunkz/shop-items/abc.jpeg");
  assert.equal(key({ kind: "moment", campaignId: "hunkz", filename: "gate.jpg" }), "camp/hunkz/moments/abc.jpg");
  assert.equal(key({ kind: "portrait", characterId: "eoghan", filename: "me.gif" }), "char/eoghan/portraits/abc.gif");
});

test("bad owners, kinds and file types are refused", () => {
  uploads(); // fail here (not inside assert.throws) while the module is missing
  assert.throws(() => key({ kind: "map", libraryId: "../etc", filename: "a.png" }));
  assert.throws(() => key({ kind: "moment", campaignId: "Hunkz", filename: "a.png" }));
  assert.throws(() => key({ kind: "spell", libraryId: "hunkz", filename: "a.png" }));
  assert.throws(() => key({ kind: "map", libraryId: "hunkz", filename: "a.svg" }), "no SVG (scripts)");
  assert.throws(() => key({ kind: "map", libraryId: "hunkz", filename: "noextension" }));
});

test("generated ids don't collide", () => {
  const { uploadKey } = need("backend/src/lib/uploads.js", "0.6");
  const keys = new Set(Array.from({ length: 200 }, () => uploadKey({ kind: "map", libraryId: "hunkz", filename: "a.png" })));
  assert.equal(keys.size, 200);
});

test("the bucket serves the new folders and still the old ones", () => {
  const yaml = fs.readFileSync(path.join(ROOT, "backend/template.yaml"), "utf8");
  for (const prefix of ["lib/*", "camp/*", "char/*", "portraits/*", "maps/*", "npc-portraits/*", "shop-items/*", "moments/*"]) {
    assert.ok(yaml.includes(`\${PortraitsBucket.Arn}/${prefix}`), `bucket policy is missing ${prefix}`);
  }
});

test("the upload handlers use uploadKey", () => {
  for (const h of ["mapPresign.js", "npcPortraitPresign.js", "portrait.js"]) {
    const src = fs.readFileSync(path.join(ROOT, "backend/src/handlers", h), "utf8");
    assert.match(src, /uploadKey\(/, `${h} builds its own key`);
  }
});
