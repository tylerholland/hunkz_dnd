const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const modulePath = path.resolve(__dirname, "broadcast.js");
const originalLoad = Module._load;
const originalEnv = { ...process.env };

function loadBroadcastWithMocks({
  scanResult,
  scanError,
  postToConnection,
  deleteCommandCalls,
  env = {},
}) {
  process.env.WS_CONNECTIONS_TABLE = env.WS_CONNECTIONS_TABLE ?? "dnd-ws-connections";
  process.env.WS_API_ENDPOINT = env.WS_API_ENDPOINT ?? "https://ws.example.test/prod";

  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "./db" && parent && parent.filename === modulePath) {
      return {
        db: {
          send: async (command) => {
            if (command.constructor.name === "ScanCommand") {
              if (scanError) throw scanError;
              return scanResult ?? { Items: [] };
            }
            if (command.constructor.name === "DeleteCommand") {
              deleteCommandCalls?.push(command.input);
              return {};
            }
            throw new Error(`Unexpected command in mock db: ${command.constructor.name}`);
          },
        },
      };
    }
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        ScanCommand: class ScanCommand { constructor(input) { this.input = input; } },
        DeleteCommand: class DeleteCommand { constructor(input) { this.input = input; } },
      };
    }
    if (request === "@aws-sdk/client-apigatewaymanagementapi") {
      return {
        ApiGatewayManagementApiClient: class ApiGatewayManagementApiClient {
          constructor(config) { this.config = config; }
          async send(command) {
            return postToConnection(command.input);
          }
        },
        PostToConnectionCommand: class PostToConnectionCommand { constructor(input) { this.input = input; } },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[modulePath];
  return require(modulePath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[modulePath];
  process.env = { ...originalEnv };
});

test("notifySessionChanged does nothing (and does not throw) when WS env vars are unset", async () => {
  const { notifySessionChanged } = loadBroadcastWithMocks({
    postToConnection: async () => { throw new Error("should not be called"); },
    env: { WS_CONNECTIONS_TABLE: "", WS_API_ENDPOINT: "" },
  });

  await assert.doesNotReject(() => notifySessionChanged());
});

test("notifySessionChanged posts to every connection and never throws on success", async () => {
  const posted = [];
  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanResult: { Items: [{ connectionId: "conn-1" }, { connectionId: "conn-2" }] },
    postToConnection: async (input) => { posted.push(input.ConnectionId); return {}; },
  });

  await notifySessionChanged();

  assert.deepEqual(posted.sort(), ["conn-1", "conn-2"]);
});

// Story 36b — notifySessionChanged() now accepts an optional payload.
test("notifySessionChanged defaults to { type: \"changed\" } when called with no payload", async () => {
  const posted = [];
  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanResult: { Items: [{ connectionId: "conn-1" }] },
    postToConnection: async (input) => { posted.push(JSON.parse(input.Data.toString())); return {}; },
  });

  await notifySessionChanged();

  assert.deepEqual(posted, [{ type: "changed" }]);
});

test("notifySessionChanged sends a custom payload (e.g. { type: \"reload\" }) when one is provided", async () => {
  const posted = [];
  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanResult: { Items: [{ connectionId: "conn-1" }, { connectionId: "conn-2" }] },
    postToConnection: async (input) => { posted.push(JSON.parse(input.Data.toString())); return {}; },
  });

  await notifySessionChanged({ type: "reload" });

  assert.equal(posted.length, 2);
  posted.forEach((p) => assert.deepEqual(p, { type: "reload" }));
});

test("notifySessionChanged prunes connections that return 410 Gone", async () => {
  const deleteCommandCalls = [];
  const goneError = Object.assign(new Error("Gone"), { $metadata: { httpStatusCode: 410 } });

  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanResult: { Items: [{ connectionId: "conn-stale" }, { connectionId: "conn-live" }] },
    postToConnection: async (input) => {
      if (input.ConnectionId === "conn-stale") throw goneError;
      return {};
    },
    deleteCommandCalls,
  });

  await notifySessionChanged();

  assert.equal(deleteCommandCalls.length, 1);
  assert.equal(deleteCommandCalls[0].Key.connectionId, "conn-stale");
});

test("notifySessionChanged prunes connections that raise a GoneException by name", async () => {
  const deleteCommandCalls = [];
  const goneError = Object.assign(new Error("Gone"), { name: "GoneException" });

  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanResult: { Items: [{ connectionId: "conn-stale" }] },
    postToConnection: async () => { throw goneError; },
    deleteCommandCalls,
  });

  await notifySessionChanged();

  assert.equal(deleteCommandCalls.length, 1);
  assert.equal(deleteCommandCalls[0].Key.connectionId, "conn-stale");
});

test("notifySessionChanged never throws when a non-410 error occurs on one connection", async () => {
  const deleteCommandCalls = [];
  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanResult: { Items: [{ connectionId: "conn-flaky" }, { connectionId: "conn-ok" }] },
    postToConnection: async (input) => {
      if (input.ConnectionId === "conn-flaky") throw new Error("network blip");
      return {};
    },
    deleteCommandCalls,
  });

  await assert.doesNotReject(() => notifySessionChanged());
  // Non-410 errors are swallowed, not pruned.
  assert.equal(deleteCommandCalls.length, 0);
});

test("notifySessionChanged never throws when the connections scan itself fails", async () => {
  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanError: new Error("DynamoDB unavailable"),
    postToConnection: async () => { throw new Error("should not be called"); },
  });

  await assert.doesNotReject(() => notifySessionChanged());
});

test("notifySessionChanged is a no-op when there are no connections", async () => {
  let called = false;
  const { notifySessionChanged } = loadBroadcastWithMocks({
    scanResult: { Items: [] },
    postToConnection: async () => { called = true; return {}; },
  });

  await notifySessionChanged();

  assert.equal(called, false);
});
