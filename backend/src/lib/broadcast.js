const { ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { db } = require("./db");

// Story 36 — WebSocket nudge channel.
//
// notifySessionChanged() is called at the end of every session-write handler
// (see CLAUDE.md for the full list). It is intentionally a tiny, payload-free
// ping — connected clients hear "changed" and refetch GET /session-state
// (Story 35) themselves. See ADR-016 for why the socket carries no state.
//
// This helper must NEVER throw and must NEVER meaningfully slow the write
// path it's called from: every failure mode (missing config, a dead
// connection, a management-API error) is swallowed internally.

const CONNECTIONS_TABLE = process.env.WS_CONNECTIONS_TABLE;
const WS_API_ENDPOINT = process.env.WS_API_ENDPOINT;

let managementClient = null;
function getManagementClient() {
  if (!managementClient && WS_API_ENDPOINT) {
    managementClient = new ApiGatewayManagementApiClient({ endpoint: WS_API_ENDPOINT });
  }
  return managementClient;
}

function isGoneError(err) {
  return err?.$metadata?.httpStatusCode === 410 || err?.name === "GoneException";
}

async function pruneConnection(connectionId) {
  try {
    await db.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  } catch {
    // Best-effort prune; a stale row will still expire via TTL.
  }
}

async function notifySessionChanged() {
  if (!CONNECTIONS_TABLE || !WS_API_ENDPOINT) return;

  try {
    const client = getManagementClient();
    if (!client) return;

    const result = await db.send(new ScanCommand({ TableName: CONNECTIONS_TABLE }));
    const connections = result.Items || [];
    if (connections.length === 0) return;

    const payload = Buffer.from(JSON.stringify({ type: "changed" }));

    await Promise.all(connections.map(async (item) => {
      const connectionId = item?.connectionId;
      if (!connectionId) return;
      try {
        await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: payload }));
      } catch (err) {
        if (isGoneError(err)) {
          await pruneConnection(connectionId);
        }
        // Any other per-connection error is swallowed — one bad connection
        // must never block delivery to the rest or affect the write path.
      }
    }));
  } catch {
    // Never let a broadcast failure affect the write path.
  }
}

module.exports = { notifySessionChanged };
