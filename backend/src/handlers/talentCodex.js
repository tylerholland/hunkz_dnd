const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { getSpecialRecord, putSpecialRecord } = require("../lib/specialRecords");
const { normalizeTalentCodexEntries } = require("../lib/talentCodex");
const { currentVersion, withVersions } = require("../lib/versioning");
const { TALENT_CODEX_SLUG } = require("../lib/specialItems");
const { notifySessionChanged } = require("../lib/broadcast");

// Story 39 — Talent Codex.
//   GET /talent-codex — anyone (players need it for info boxes; nothing secret)
//   PUT /talent-codex — DM only; { entries } replaces the whole set of overrides
exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;

  if (method === "GET") {
    const item = await getSpecialRecord(TALENT_CODEX_SLUG);
    return ok({ entries: normalizeTalentCodexEntries(item?.entries), version: currentVersion(item) });
  }

  if (method === "PUT") {
    const password = event.headers?.["x-character-password"] || "";
    const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
    if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");
    const body = JSON.parse(event.body || "{}");
    if (!body.entries || typeof body.entries !== "object" || Array.isArray(body.entries)) {
      return badRequest("entries must be an object keyed by skill/ability");
    }
    const now = new Date().toISOString();
    const entries = normalizeTalentCodexEntries(
      Object.fromEntries(Object.entries(body.entries).map(([key, value]) => [key, { ...value, updatedAt: value?.updatedAt || now }]))
    );
    const version = await putSpecialRecord(TALENT_CODEX_SLUG, { entries });
    await notifySessionChanged(); // screens refetch when the version changes
    return ok(withVersions({ entries, version }, { [TALENT_CODEX_SLUG]: version }));
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
