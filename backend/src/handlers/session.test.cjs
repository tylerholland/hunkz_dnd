const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "session.js");
const originalLoad = Module._load;

function loadHandlerWithMocks({ send, verifyPasswordImpl, notifySessionChanged }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        GetCommand: class GetCommand {
          constructor(input) { this.input = input; }
        },
        UpdateCommand: class UpdateCommand {
          constructor(input) { this.input = input; }
        },
      };
    }

    if (request === "../lib/db" && parent && parent.filename === handlerPath) {
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
  return require(handlerPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
});

test("session patch rejects requests with no character password header", async () => {
  let updateAttempted = false;
  const { handler } = loadHandlerWithMocks({
    send: async (command) => {
      if (command.input?.Key?.slug === "aragorn") {
        return { Item: { slug: "aragorn", passwordHash: "hash" } };
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
      if (command.input?.Key?.slug === "aragorn" && !command.input.UpdateExpression) {
        return { Item: { slug: "aragorn", passwordHash: "hash" } };
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
