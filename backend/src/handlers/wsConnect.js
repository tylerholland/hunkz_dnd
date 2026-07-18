const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db } = require("../lib/db");

// Story 36 — WebSocket nudge channel. $connect route: records the new
// connectionId in the dedicated connections table with a 12h TTL so stale
// rows self-clean even if $disconnect never fires (e.g. abrupt network loss).
const CONNECTIONS_TABLE = process.env.WS_CONNECTIONS_TABLE;
const TTL_SECONDS = 12 * 60 * 60;

exports.handler = async (event) => {
  const connectionId = event.requestContext?.connectionId;
  if (!connectionId) return { statusCode: 400, body: "Missing connectionId" };

  await db.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      connectedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    },
  }));

  return { statusCode: 200, body: "Connected" };
};
