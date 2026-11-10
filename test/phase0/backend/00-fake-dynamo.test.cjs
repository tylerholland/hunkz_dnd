// The test double itself. These pass today; they keep the fake honest.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeDynamo, GAME_TABLE, GAME_TABLE_DEF } = require("./helpers/fakeDynamo.cjs");

function fake() {
  const f = createFakeDynamo({ tables: { [GAME_TABLE]: GAME_TABLE_DEF } });
  const { PutCommand, QueryCommand, BatchWriteCommand, UpdateCommand } = f.commands;
  const put = (Item, extra = {}) => f.db.send(new PutCommand({ TableName: GAME_TABLE, Item, ...extra }));
  return { f, put, QueryCommand, BatchWriteCommand, UpdateCommand };
}

test("fake: conditional put on version", async () => {
  const { f, put } = fake();
  await put({ PK: "A", SK: "1", version: 1 }, { ConditionExpression: "attribute_not_exists(PK)" });
  await assert.rejects(put({ PK: "A", SK: "1", version: 1 }, { ConditionExpression: "attribute_not_exists(PK)" }), { name: "ConditionalCheckFailedException" });
  await put({ PK: "A", SK: "1", version: 2 }, { ConditionExpression: "#v = :expected", ExpressionAttributeNames: { "#v": "version" }, ExpressionAttributeValues: { ":expected": 1 } });
  assert.equal(f.items(GAME_TABLE)[0].version, 2);
});

test("fake: query by prefix, newest first, with paging", async () => {
  const { f, put, QueryCommand } = fake();
  for (let i = 0; i < 5; i += 1) await put({ PK: "C", SK: `LOG#${i}` });
  await put({ PK: "C", SK: "STATE#x" });
  const q = (extra) => f.db.send(new QueryCommand({ TableName: GAME_TABLE, KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)", ExpressionAttributeValues: { ":pk": "C", ":p": "LOG#" }, ScanIndexForward: false, Limit: 2, ...extra }));
  const page1 = await q();
  assert.deepEqual(page1.Items.map((i) => i.SK), ["LOG#4", "LOG#3"]);
  const page2 = await q({ ExclusiveStartKey: page1.LastEvaluatedKey });
  assert.deepEqual(page2.Items.map((i) => i.SK), ["LOG#2", "LOG#1"]);
});

test("fake: enforces DynamoDB limits and refuses what the store shouldn't use", async () => {
  const { f, put, BatchWriteCommand, UpdateCommand } = fake();
  const many = Array.from({ length: 26 }, (_, i) => ({ PutRequest: { Item: { PK: "B", SK: String(i) } } }));
  await assert.rejects(f.db.send(new BatchWriteCommand({ RequestItems: { [GAME_TABLE]: many } })), /max 25/);
  await assert.rejects(put({ PK: "B", SK: "big", blob: "x".repeat(410 * 1024) }), /maximum allowed size/);
  await assert.rejects(f.db.send(new UpdateCommand({ TableName: GAME_TABLE })), /not supported/);
});
