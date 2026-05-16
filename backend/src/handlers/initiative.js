const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");
const { getInitiativeState, saveInitiativeState } = require("../lib/specialRecords");

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const password = event.headers?.["x-character-password"] || "";

  // Both GET and PUT require DM auth
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  if (method === "GET") {
    return ok(await getInitiativeState());
  }

  if (method === "PUT") {
    const body = JSON.parse(event.body || "{}");

    if (!Array.isArray(body.entries)) {
      return badRequest("entries must be an array");
    }

    await saveInitiativeState({
      entries: body.entries,
      activeTurnIndex: body.activeTurnIndex ?? 0,
      round: body.round ?? 1,
    });

    return ok({ success: true });
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
