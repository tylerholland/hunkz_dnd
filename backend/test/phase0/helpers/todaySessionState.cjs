// Runs TODAY's getSessionState handler against an old-table fixture, with
// DynamoDB replaced by a map lookup. Used once to capture the golden
// responses in ../golden/ (node backend/test/phase0/helpers/captureGolden.cjs);
// after the switch, the rebuilt handler is held to them (0.1-session-state).
const Module = require("node:module");
const path = require("node:path");
const bcrypt = require(path.resolve(__dirname, "../../../node_modules/bcryptjs"));

const SRC = path.resolve(__dirname, "../../../src");
const DM_PASSWORD = "dm-pass";
const DM_HASH = bcrypt.hashSync(DM_PASSWORD, 4);

function withOldTable(items, fn) {
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const commands = Object.fromEntries(["BatchGetCommand", "UpdateCommand", "GetCommand", "PutCommand", "QueryCommand", "ScanCommand", "DeleteCommand", "TransactWriteCommand", "BatchWriteCommand"]
    .map((n) => [n, class { constructor(input) { this.input = input; this.name = n; } }]));
  const db = {
    send: async (cmd) => {
      if (cmd.name === "BatchGetCommand") {
        const [table, req] = Object.entries(cmd.input.RequestItems)[0];
        return { Responses: { [table]: req.Keys.map((k) => bySlug.get(k.slug)).filter(Boolean).map((i) => JSON.parse(JSON.stringify(i))) } };
      }
      if (cmd.name === "GetCommand") return { Item: bySlug.get(cmd.input.Key.slug) };
      if (cmd.name === "UpdateCommand") return {}; // presence stamp: not part of the response
      throw new Error(`today's harness: unexpected ${cmd.name}`);
    },
  };
  const original = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") return commands;
    if (parent?.filename?.startsWith(SRC) && /(^|\/)db$/.test(request)) return { db, TABLE: "t" };
    if (request === "@aws-sdk/client-apigatewaymanagementapi") return { ApiGatewayManagementApiClient: class {}, PostToConnectionCommand: class {} };
    return original.call(this, request, parent, isMain);
  };
  for (const key of Object.keys(require.cache)) if (key.startsWith(SRC)) delete require.cache[key];
  try {
    return fn();
  } finally {
    Module._load = original;
  }
}

// The viewers whose responses are pinned.
const VIEWERS = {
  dm: { headers: { "x-character-password": DM_PASSWORD }, queryStringParameters: {} },
  player: { headers: {}, queryStringParameters: { slug: "eoghan" } },
  anon: { headers: {}, queryStringParameters: {} },
};

// Fields that change on every call: the server's clock, and the viewer's
// own "last seen" stamp (written as they poll). Fixture times are all in
// October 2026, so anything later is "now".
const FIXTURE_END = Date.parse("2026-10-02T00:00:00.000Z");
function stable(body) {
  const copy = JSON.parse(JSON.stringify(body));
  delete copy.serverTime;
  if (copy.presence && typeof copy.presence === "object") {
    for (const [who, at] of Object.entries(copy.presence)) if (Date.parse(at) > FIXTURE_END) copy.presence[who] = "<now>";
  }
  return copy;
}

async function todaySessionState(items, viewer) {
  process.env.DM_PASSWORD_HASH = DM_HASH;
  process.env.TABLE_NAME = "t";
  return withOldTable(items, async () => {
    const { handler } = require(path.join(SRC, "handlers/getSessionState.js"));
    const res = await handler(VIEWERS[viewer]);
    return { statusCode: res.statusCode, body: stable(JSON.parse(res.body)) };
  });
}

module.exports = { todaySessionState, VIEWERS, DM_PASSWORD, DM_HASH, stable };
