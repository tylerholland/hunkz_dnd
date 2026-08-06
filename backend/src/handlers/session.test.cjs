const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "session.js");
const specialRecordsPath = path.resolve(__dirname, "../lib/specialRecords.js");
const dbPath = path.resolve(__dirname, "../lib/db.js");
const originalLoad = Module._load;

function loadHandlerWithMocks({ send, verifyPasswordImpl, notifySessionChanged }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        BatchGetCommand: class BatchGetCommand {
          constructor(input) { this.input = input; }
        },
        UpdateCommand: class UpdateCommand {
          constructor(input) { this.input = input; }
        },
      };
    }

    // Story 55 — session.js now also pulls in ../lib/specialRecords (for
    // normalizeInitiativeRecord), which itself requires ./db — intercept
    // both call sites so the real db.js (and its @aws-sdk/client-dynamodb
    // dependency) never loads under test.
    if (
      parent
      && (
        (request === "../lib/db" && parent.filename === handlerPath)
        || (request === "./db" && parent.filename === specialRecordsPath)
      )
    ) {
      return {
        db: { send },
        TABLE: "characters-table",
      };
    }

    if (request === "../lib/auth" && parent && parent.filename === handlerPath) {
      return {
        verifyPassword: verifyPasswordImpl || (async () => ({ valid: false })),
      };
    }

    if (request === "../lib/broadcast" && parent && parent.filename === handlerPath) {
      return {
        notifySessionChanged: notifySessionChanged || (async () => {}),
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
  delete require.cache[dbPath];
  return require(handlerPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
  delete require.cache[dbPath];
});

test("session patch rejects requests with no character password header", async () => {
  let updateAttempted = false;
  const { handler } = loadHandlerWithMocks({
    send: async (command) => {
      if (command.input?.RequestItems) {
        return { Responses: { "characters-table": [{ slug: "aragorn", passwordHash: "hash" }] } };
      }
      updateAttempted = true;
      throw new Error("update should not run");
    },
  });

  const result = await handler({
    pathParameters: { slug: "aragorn" },
    headers: {},
    body: JSON.stringify({ hpCurrent: 22 }),
  });

  assert.equal(result.statusCode, 403);
  assert.equal(updateAttempted, false);
});

test("session patch accepts an explicit empty-string password when verifyPassword allows it", async () => {
  const seenPasswords = [];
  let broadcastCalls = 0;
  const updates = [];
  const { handler } = loadHandlerWithMocks({
    send: async (command) => {
      if (command.input?.RequestItems) {
        return { Responses: { "characters-table": [{ slug: "aragorn", passwordHash: "hash" }] } };
      }
      updates.push(command.input);
      return {};
    },
    verifyPasswordImpl: async (password) => {
      seenPasswords.push(password);
      return { valid: password === "", role: "owner" };
    },
    notifySessionChanged: async () => { broadcastCalls += 1; },
  });

  const result = await handler({
    pathParameters: { slug: "aragorn" },
    headers: { "x-character-password": "" },
    body: JSON.stringify({ hpCurrent: 22 }),
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(seenPasswords, [""]);
  assert.equal(updates.length, 1);
  assert.match(updates[0].UpdateExpression, /#hpCurrent = :hpCurrent/);
  assert.equal(updates[0].ExpressionAttributeValues[":hpCurrent"], 22);
  assert.equal(broadcastCalls, 1);
});

test("session patch stamps lastDamageFrom from the active initiative entry on a strict HP decrease (Story 55)", async () => {
  const updates = [];
  const { handler } = loadHandlerWithMocks({
    send: async (command) => {
      if (command.input?.RequestItems) {
        return {
          Responses: {
            "characters-table": [
              { slug: "aragorn", passwordHash: "hash", hpCurrent: 20 },
              {
                slug: "initiative",
                entries: [
                  { id: "e1", slug: "eoghan", name: "Eoghan", isPC: true, npcId: null },
                  { id: "e2", slug: "aragorn", name: "Aragorn", isPC: true, npcId: null },
                ],
                activeTurnIndex: 0,
              },
            ],
          },
        };
      }
      updates.push(command.input);
      return {};
    },
    verifyPasswordImpl: async () => ({ valid: true, role: "dm" }),
  });

  const result = await handler({
    pathParameters: { slug: "aragorn" },
    headers: { "x-character-password": "dm-pass" },
    body: JSON.stringify({ hpCurrent: 12 }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(updates.length, 1);
  assert.match(updates[0].UpdateExpression, /#lastDamageFrom = :lastDamageFrom/);
  assert.deepEqual(updates[0].ExpressionAttributeValues[":lastDamageFrom"], { type: "character", sourceId: "eoghan" });
  assert.equal(updates[0].ExpressionAttributeValues[":lastDamageAmount"], 8);
});

test("session patch does not stamp lastDamageFrom on self-damage (attacker === target)", async () => {
  const updates = [];
  const { handler } = loadHandlerWithMocks({
    send: async (command) => {
      if (command.input?.RequestItems) {
        return {
          Responses: {
            "characters-table": [
              { slug: "aragorn", passwordHash: "hash", hpCurrent: 20 },
              {
                slug: "initiative",
                entries: [{ id: "e1", slug: "aragorn", name: "Aragorn", isPC: true, npcId: null }],
                activeTurnIndex: 0,
              },
            ],
          },
        };
      }
      updates.push(command.input);
      return {};
    },
    verifyPasswordImpl: async () => ({ valid: true, role: "dm" }),
  });

  const result = await handler({
    pathParameters: { slug: "aragorn" },
    headers: { "x-character-password": "dm-pass" },
    body: JSON.stringify({ hpCurrent: 15 }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].ExpressionAttributeValues[":lastDamageFrom"], null);
});
