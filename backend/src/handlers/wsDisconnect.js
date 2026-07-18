const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { db } = require("../lib/db");

// Story 36 — WebSocket nudge channel. $disconnect route: best-effort cleanup
// of the connection row. Not the only cleanup path — the connections table's
// TTL attribute (12h) prunes rows even when this route never fires.
const CONNECTIONS_TABLE = process.env.WS_CONNECTIONS_TABLE;

exports.handler = async (event) => {
  const connectionId = event.requestContext?.connectionId;
  if (connectionId) {
    await db.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  }
  return { statusCode: 200, body: "Disconnected" };
};
