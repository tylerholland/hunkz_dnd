// Story 36b — deploy-time reload broadcast.
//
// No HTTP route: invoked directly via `aws lambda invoke` from deploy.sh,
// after the frontend S3 sync and the app-meta version-stamp write both
// complete. Pushes { type: "reload" } to every connected client over the
// Story 36 WebSocket so open tabs reload themselves immediately instead of
// waiting for the next poll's buildVersion mismatch (see
// src/lib/staleClient.js on the frontend for the receiving end).
const { notifySessionChanged } = require("../lib/broadcast");

exports.handler = async () => {
  await notifySessionChanged({ type: "reload" });
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
