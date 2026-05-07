const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "list.js");
const originalLoad = Module._load;

function loadHandlerWithMocks({ send }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        ScanCommand: class ScanCommand {
          constructor(input) {
            this.input = input;
          }
        },
      };
    }

    if (request === "../lib/db" && parent && parent.filename === handlerPath) {
      return { db: { send }, TABLE: "characters-table" };
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

test("list handler filters reserved records and sorts remaining characters by name", async () => {
  const { handler } = loadHandlerWithMocks({
    send: async () => ({
      Items: [
        { slug: "initiative", name: "Initiative" },
        { slug: "liu-sha", name: "Liu Sha" },
        { slug: "npc-combat", name: "NPC Combat" },
        { slug: "roll-history", name: "Roll History" },
        { slug: "aragorn", name: "Aragorn" },
      ],
    }),
  });

  const result = await handler();
  const items = JSON.parse(result.body);

  assert.equal(result.statusCode, 200);
  assert.deepEqual(items.map((item) => item.slug), ["aragorn", "liu-sha"]);
});
