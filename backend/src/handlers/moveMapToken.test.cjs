const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "moveMapToken.js");
const originalLoad = Module._load;

function loadHandlerWithMocks({ getMapLibraryState, saveMapLibraryState, notifySessionChanged }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "../lib/specialRecords" && parent && parent.filename === handlerPath) {
      return { getMapLibraryState, saveMapLibraryState };
    }
    if (request === "../lib/broadcast" && parent && parent.filename === handlerPath) {
      return { notifySessionChanged: notifySessionChanged || (async () => {}) };
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

function baseMap(overrides = {}) {
  return {
    id: "map-1",
    name: "Test Map",
    tokens: [
      { id: "tok-pc", type: "character", sourceId: "aragorn", x: 0.2, y: 0.3 },
      { id: "tok-npc", type: "npc", sourceId: "npc-1", x: 0.4, y: 0.4 },
    ],
    ...overrides,
  };
}

test("moveMapToken rejects a request moving another character's token", async () => {
  const saved = [];
  const { handler } = loadHandlerWithMocks({
    getMapLibraryState: async () => ({ activeMapId: "map-1", activeMapView: null, maps: [baseMap()] }),
    saveMapLibraryState: async (payload) => { saved.push(payload); },
  });

  const result = await handler({
    pathParameters: { mapId: "map-1", tokenId: "tok-pc" },
    body: JSON.stringify({ x: 0.5, y: 0.5, slug: "someone-else" }),
  });

  assert.equal(result.statusCode, 403);
  assert.equal(saved.length, 0);
});

test("moveMapToken rejects moving an NPC token", async () => {
  const saved = [];
  const { handler } = loadHandlerWithMocks({
    getMapLibraryState: async () => ({ activeMapId: "map-1", activeMapView: null, maps: [baseMap()] }),
    saveMapLibraryState: async (payload) => { saved.push(payload); },
  });

  const result = await handler({
    pathParameters: { mapId: "map-1", tokenId: "tok-npc" },
    body: JSON.stringify({ x: 0.5, y: 0.5, slug: "npc-1" }),
  });

  assert.equal(result.statusCode, 403);
  assert.equal(saved.length, 0);
});

test("moveMapToken clamps x/y to [0, 1], persists the new position, and broadcasts a nudge", async () => {
  const saved = [];
  let broadcastCalls = 0;
  const { handler } = loadHandlerWithMocks({
    getMapLibraryState: async () => ({ activeMapId: "map-1", activeMapView: null, maps: [baseMap()] }),
    saveMapLibraryState: async (payload) => { saved.push(payload); },
    notifySessionChanged: async () => { broadcastCalls += 1; },
  });

  const result = await handler({
    pathParameters: { mapId: "map-1", tokenId: "tok-pc" },
    body: JSON.stringify({ x: 1.5, y: -0.5, slug: "aragorn" }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(saved.length, 1);
  const updatedToken = saved[0].maps[0].tokens.find((t) => t.id === "tok-pc");
  assert.equal(updatedToken.x, 1);
  assert.equal(updatedToken.y, 0);
  assert.equal(broadcastCalls, 1);
});

test("moveMapToken succeeds for the owning player and preserves other map fields", async () => {
  const saved = [];
  const { handler } = loadHandlerWithMocks({
    getMapLibraryState: async () => ({
      activeMapId: "map-1",
      activeMapView: { mapId: "map-1", translate: { x: 0, y: 0 }, scale: 1, pageNumber: 1, updatedAt: null },
      maps: [baseMap()],
    }),
    saveMapLibraryState: async (payload) => { saved.push(payload); },
  });

  const result = await handler({
    pathParameters: { mapId: "map-1", tokenId: "tok-pc" },
    body: JSON.stringify({ x: 0.6, y: 0.7, slug: "aragorn" }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].activeMapId, "map-1");
  assert.ok(saved[0].activeMapView);
  const updatedToken = saved[0].maps[0].tokens.find((t) => t.id === "tok-pc");
  assert.equal(updatedToken.x, 0.6);
  assert.equal(updatedToken.y, 0.7);
  const untouchedToken = saved[0].maps[0].tokens.find((t) => t.id === "tok-npc");
  assert.equal(untouchedToken.x, 0.4);
  assert.equal(untouchedToken.y, 0.4);
});

test("moveMapToken returns 404 when the map does not exist", async () => {
  const { handler } = loadHandlerWithMocks({
    getMapLibraryState: async () => ({ activeMapId: null, activeMapView: null, maps: [] }),
    saveMapLibraryState: async () => { throw new Error("should not save"); },
  });

  const result = await handler({
    pathParameters: { mapId: "missing-map", tokenId: "tok-pc" },
    body: JSON.stringify({ x: 0.5, y: 0.5, slug: "aragorn" }),
  });

  assert.equal(result.statusCode, 404);
});

test("moveMapToken returns 404 when the token does not exist", async () => {
  const { handler } = loadHandlerWithMocks({
    getMapLibraryState: async () => ({ activeMapId: "map-1", activeMapView: null, maps: [baseMap()] }),
    saveMapLibraryState: async () => { throw new Error("should not save"); },
  });

  const result = await handler({
    pathParameters: { mapId: "map-1", tokenId: "missing-token" },
    body: JSON.stringify({ x: 0.5, y: 0.5, slug: "aragorn" }),
  });

  assert.equal(result.statusCode, 404);
});

test("moveMapToken rejects a non-numeric x/y", async () => {
  const { handler } = loadHandlerWithMocks({
    getMapLibraryState: async () => ({ activeMapId: "map-1", activeMapView: null, maps: [baseMap()] }),
    saveMapLibraryState: async () => { throw new Error("should not save"); },
  });

  const result = await handler({
    pathParameters: { mapId: "map-1", tokenId: "tok-pc" },
    body: JSON.stringify({ x: "1d8", y: 0.5, slug: "aragorn" }),
  });

  assert.equal(result.statusCode, 400);
});
