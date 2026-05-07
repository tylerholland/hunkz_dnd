const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "get.js");
const specialRecordsPath = path.resolve(__dirname, "../lib/specialRecords.js");
const originalLoad = Module._load;

function loadHandlerWithMocks({ send }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        GetCommand: class GetCommand {
          constructor(input) {
            this.input = input;
          }
        },
      };
    }

    if (
      parent
      && (
        (request === "../lib/db" && parent.filename === handlerPath)
        || (request === "./db" && parent.filename === specialRecordsPath)
      )
    ) {
      return { db: { send }, TABLE: "characters-table" };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
  return require(handlerPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
  delete require.cache[specialRecordsPath];
});

test("get handler returns 404 for reserved internal slugs", async () => {
  let sendCalls = 0;
  const { handler } = loadHandlerWithMocks({
    send: async () => {
      sendCalls += 1;
      return {};
    },
  });

  const result = await handler({ pathParameters: { slug: "initiative" } });

  assert.equal(result.statusCode, 404);
  assert.equal(sendCalls, 0);
});

test("get handler normalizes legacy hp fields and marks the active turn correctly", async () => {
  const { handler } = loadHandlerWithMocks({
    send: async (command) => {
      const keySlug = command.input.Key.slug;
      if (keySlug === "aragorn") {
        return {
          Item: {
            slug: "aragorn",
            name: "Aragorn",
            hp: 38,
            collections: [],
            passwordHash: "secret",
          },
        };
      }

      if (keySlug === "initiative") {
        return {
          Item: {
            entries: [
              { slug: "aragorn", initiative: 15 },
              { slug: "goblin", initiative: 12 },
            ],
            activeTurnIndex: 0,
          },
        };
      }

      return { Item: null };
    },
  });

  const result = await handler({ pathParameters: { slug: "aragorn" } });
  const body = JSON.parse(result.body);

  assert.equal(result.statusCode, 200);
  assert.equal(body.hpCurrent, 38);
  assert.equal(body.hpMax, 38);
  assert.equal(body.tempHP, 0);
  assert.equal(body.isActiveTurn, true);
  assert.equal(body.passwordHash, undefined);
});
