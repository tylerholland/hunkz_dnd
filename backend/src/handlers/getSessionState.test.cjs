const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlerPath = path.resolve(__dirname, "getSessionState.js");
const dbPath = path.resolve(__dirname, "../lib/db.js");
const specialRecordsPath = path.resolve(__dirname, "../lib/specialRecords.js");
const authPath = path.resolve(__dirname, "../lib/auth.js");
const characterProjectionPath = path.resolve(__dirname, "../lib/characterProjection.js");
const originalLoad = Module._load;

const TABLE = "characters-table";

function loadHandlerWithMocks({ send, verifyPasswordImpl }) {
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "@aws-sdk/lib-dynamodb") {
      return {
        GetCommand: class GetCommand {
          constructor(input) { this.input = input; }
        },
        PutCommand: class PutCommand {
          constructor(input) { this.input = input; }
        },
        BatchGetCommand: class BatchGetCommand {
          constructor(input) { this.input = input; }
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
      return { db: { send }, TABLE };
    }

    if (
      parent
      && (
        (request === "../lib/auth" && parent.filename === handlerPath)
        || (request === "./auth" && parent.filename === characterProjectionPath)
      )
    ) {
      return { verifyPassword: verifyPasswordImpl };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[handlerPath];
  delete require.cache[dbPath];
  delete require.cache[specialRecordsPath];
  delete require.cache[authPath];
  delete require.cache[characterProjectionPath];
  return require(handlerPath);
}

test.afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[handlerPath];
  delete require.cache[dbPath];
  delete require.cache[specialRecordsPath];
  delete require.cache[authPath];
  delete require.cache[characterProjectionPath];
});

function isSentinelBatch(command) {
  const keys = command.input.RequestItems[TABLE].Keys;
  return keys.some((k) => k.slug === "initiative");
}

function baseSentinelResponses() {
  return {
    initiative: {
      slug: "initiative",
      entries: [
        { id: "e1", name: "Aragorn", type: "pc", slug: "aragorn", palette: "ocean", initiative: 25, hidden: false },
        { id: "e2", name: "Goblin", type: "npc", slug: null, palette: null, initiative: 10, hidden: false },
        { id: "e3", name: "Hidden Assassin", type: "npc", slug: null, palette: null, initiative: 22, hidden: true },
      ],
      activeTurnIndex: 0,
      round: 2,
    },
    "npc-combat": {
      slug: "npc-combat",
      npcs: [{ id: "n1", initiativeEntryId: "e2", hpCurrent: 3, hpMax: 12 }],
    },
    "roll-history": {
      slug: "roll-history",
      rolls: [{ id: "r1", characterName: "DM", total: 14 }],
    },
    "map-library": {
      slug: "map-library",
      activeMapId: null,
      maps: [],
    },
    "party-roster": {
      slug: "party-roster",
      members: ["aragorn"],
      partyVisibilityEnabled: true,
    },
    "counter-wheels": {
      slug: "counter-wheels",
      wheels: [{ id: "w1", name: "Doom", segments: 6, filledCount: 2 }],
    },
  };
}

function aragornItem() {
  return {
    slug: "aragorn",
    name: "Aragorn",
    palette: "ocean",
    portraitUrl: "https://example.com/aragorn.png",
    hpCurrent: 30,
    hpMax: 40,
    tempHP: 0,
    conditions: [],
    concentration: { active: false, spell: "" },
    inspiration: false,
    deathSaves: { successes: 0, failures: 0 },
    dmNotes: [{ id: "dn1", text: "Secret DM note", createdAt: "2026-01-01" }],
    playerNotes: [
      { id: "pn1", text: "Shared note", sharedWithDm: true, createdAt: "2026-01-01" },
      { id: "pn2", text: "Private note", sharedWithDm: false, createdAt: "2026-01-01" },
    ],
    xpCurrent: 100,
    coin: { gp: 5 },
    collections: [{ id: "c1", name: "Longsword" }],
    weapons: [{ id: "w1", name: "Longsword" }],
    equipment: [{ id: "e1", name: "Rope" }],
    stats: [{ name: "Strength", score: 16, mods: [] }],
    passwordHash: "$2b$10$ownerHashHere",
  };
}

function makeSend(sentinelOverrides) {
  const sentinels = { ...baseSentinelResponses(), ...sentinelOverrides };
  return async (command) => {
    if (isSentinelBatch(command)) {
      const items = command.input.RequestItems[TABLE].Keys
        .map((k) => sentinels[k.slug])
        .filter(Boolean);
      return { Responses: { [TABLE]: items } };
    }
    // Party-member batch
    const requestedSlugs = command.input.RequestItems[TABLE].Keys.map((k) => k.slug);
    const items = requestedSlugs
      .filter((slug) => slug === "aragorn")
      .map(() => aragornItem());
    return { Responses: { [TABLE]: items } };
  };
}

test("getSessionState never fetches the npc-library sentinel", async () => {
  let sentinelKeysSeen = null;
  const send = async (command) => {
    if (isSentinelBatch(command)) {
      sentinelKeysSeen = command.input.RequestItems[TABLE].Keys.map((k) => k.slug);
      return { Responses: { [TABLE]: [] } };
    }
    return { Responses: { [TABLE]: [] } };
  };
  const { handler } = loadHandlerWithMocks({
    send,
    verifyPasswordImpl: async () => ({ valid: false }),
  });

  await handler({ headers: {} });

  assert.ok(sentinelKeysSeen);
  assert.ok(!sentinelKeysSeen.includes("npc-library"));
});

test("getSessionState issues at most two DynamoDB round trips", async () => {
  let sendCalls = 0;
  const innerSend = makeSend({});
  const send = async (command) => {
    sendCalls += 1;
    return innerSend(command);
  };
  const { handler } = loadHandlerWithMocks({
    send,
    verifyPasswordImpl: async (password, item) => (
      item.passwordHash === "$2b$10$invalid"
        ? { valid: password === "dm-secret", role: password === "dm-secret" ? "dm" : undefined }
        : { valid: false }
    ),
  });

  await handler({ headers: { "x-character-password": "dm-secret" } });

  assert.equal(sendCalls, 2);
});

test("getSessionState DM variant returns full consolidated payload", async () => {
  const send = makeSend({});
  const { handler } = loadHandlerWithMocks({
    send,
    verifyPasswordImpl: async (password, item) => (
      item.passwordHash === "$2b$10$invalid"
        ? (password === "dm-secret" ? { valid: true, role: "dm" } : { valid: false })
        : { valid: false }
    ),
  });

  const result = await handler({ headers: { "x-character-password": "dm-secret" } });
  const body = JSON.parse(result.body);

  assert.equal(result.statusCode, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    "counterWheels", "initiative", "mapLibrary", "npcCombat", "party", "rollHistory", "serverTime",
  ].sort());

  assert.equal(body.party.length, 1);
  const partyMember = body.party[0];
  assert.equal(partyMember.slug, "aragorn");
  assert.equal(partyMember.passwordHash, undefined);
  // DM sees dmNotes and a sharedWithDm-filtered playerNotes projection
  assert.deepEqual(partyMember.dmNotes, [{ id: "dn1", text: "Secret DM note", createdAt: "2026-01-01" }]);
  assert.deepEqual(partyMember.sharedPlayerNotes, [
    { id: "pn1", text: "Shared note", sharedWithDm: true, createdAt: "2026-01-01" },
  ]);
  // Fields outside the DM party whitelist (e.g. collections/weapons/stats) are dropped
  assert.equal(partyMember.collections, undefined);
  assert.equal(partyMember.weapons, undefined);
  assert.equal(partyMember.stats, undefined);

  assert.equal(body.initiative.round, 2);
  assert.equal(body.npcCombat.npcs.length, 1);
  assert.equal(body.rollHistory.rolls.length, 1);
  assert.deepEqual(body.mapLibrary.maps, []);
  assert.equal(body.counterWheels.wheels.length, 1);
  assert.match(body.serverTime, /^\d{4}-\d{2}-\d{2}T/);
});

test("getSessionState public variant leaks nothing beyond the old public projections", async () => {
  const send = makeSend({});
  const { handler } = loadHandlerWithMocks({
    send,
    verifyPasswordImpl: async () => ({ valid: false }),
  });

  const result = await handler({ headers: {} });
  const body = JSON.parse(result.body);

  assert.equal(result.statusCode, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    "initiativePublic", "mapLibrary", "partyStatus", "rollHistory", "serverTime",
  ].sort());

  // partyStatus — same shape as GET /party/status
  assert.equal(body.partyStatus.visible, true);
  assert.equal(body.partyStatus.members.length, 1);
  const member = body.partyStatus.members[0];
  assert.deepEqual(Object.keys(member).sort(), [
    "concentration", "conditions", "deathSaves", "hpCurrent", "hpMax", "inspiration",
    "name", "palette", "portraitUrl", "slug", "tempHP",
  ].sort());
  assert.equal(member.dmNotes, undefined);
  assert.equal(member.playerNotes, undefined);
  assert.equal(member.xpCurrent, undefined);
  assert.equal(member.coin, undefined);

  // initiativePublic — hidden entry stripped, no raw initiative roll values exposed
  assert.equal(body.initiativePublic.entries.length, 2);
  assert.ok(!body.initiativePublic.entries.some((e) => e.name === "Hidden Assassin"));
  assert.ok(body.initiativePublic.entries.every((e) => e.initiative === undefined));
  const goblinEntry = body.initiativePublic.entries.find((e) => e.id === "e2");
  assert.equal(goblinEntry.healthTier, "critical");

  // no ?slug supplied — no character field
  assert.equal(body.character, undefined);
});

test("getSessionState public variant with ?slug strips playerNotes and passwordHash for an unauthenticated caller", async () => {
  const send = makeSend({});
  const { handler } = loadHandlerWithMocks({
    send,
    verifyPasswordImpl: async () => ({ valid: false }),
  });

  const result = await handler({
    headers: {},
    queryStringParameters: { slug: "aragorn" },
  });
  const body = JSON.parse(result.body);

  assert.equal(result.statusCode, 200);
  assert.ok(body.character);
  assert.equal(body.character.slug, "aragorn");
  assert.equal(body.character.passwordHash, undefined);
  assert.equal(body.character.playerNotes, undefined);
  assert.equal(body.character.isActiveTurn, true);
  // Full character shape (not the restricted party-list projection)
  assert.deepEqual(body.character.collections, [{ id: "c1", name: "Longsword" }]);
});

test("getSessionState public variant with ?slug returns full playerNotes for the verified owner", async () => {
  const send = makeSend({});
  const { handler } = loadHandlerWithMocks({
    send,
    verifyPasswordImpl: async (password, item) => (
      item.passwordHash === "$2b$10$ownerHashHere" && password === "owner-secret"
        ? { valid: true, role: "owner" }
        : { valid: false }
    ),
  });

  const result = await handler({
    headers: { "x-character-password": "owner-secret" },
    queryStringParameters: { slug: "aragorn" },
  });
  const body = JSON.parse(result.body);

  assert.equal(body.character.playerNotes.length, 2);
});

test("getSessionState public variant respects partyVisibilityEnabled = false", async () => {
  const send = makeSend({ "party-roster": { slug: "party-roster", members: ["aragorn"], partyVisibilityEnabled: false } });
  const { handler } = loadHandlerWithMocks({
    send,
    verifyPasswordImpl: async () => ({ valid: false }),
  });

  const result = await handler({ headers: {} });
  const body = JSON.parse(result.body);

  assert.deepEqual(body.partyStatus, { visible: false, members: [] });
});
