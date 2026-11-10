// An in-memory stand-in for the DynamoDB Document client, for the phase 0
// store tests. It understands the small subset of DynamoDB the store is
// expected to use, and throws on anything else so the implementation stays
// inside it:
//
//   Commands: Get, Put, Delete, BatchGet (≤100 keys), BatchWrite (≤25 puts/
//   deletes), Query (table or index, Limit, ScanIndexForward,
//   ExclusiveStartKey → LastEvaluatedKey), TransactWrite (Put/Delete/
//   ConditionCheck, ≤100), Scan (allowed, but recorded so tests can forbid it).
//   No UpdateCommand: write whole items with a version condition instead.
//
//   KeyConditionExpression: `<pk> = :v` optionally `AND` one of
//   `begins_with(<sk>, :v)`, `<sk> BETWEEN :a AND :b`, `<sk> <|<=|>|>= :v`.
//   ConditionExpression: clauses joined by AND / OR (no parentheses):
//   `attribute_not_exists(x)`, `attribute_exists(x)`, `x = :v`.
//   #names in ExpressionAttributeNames are substituted everywhere.
//
//   Items are capped at 400 KB (JSON length), like DynamoDB.
const MAX_ITEM_BYTES = 400 * 1024;

class ConditionalCheckFailedException extends Error {
  constructor() { super("The conditional request failed"); this.name = "ConditionalCheckFailedException"; }
}
class TransactionCanceledException extends Error {
  constructor(reasons) { super("Transaction cancelled"); this.name = "TransactionCanceledException"; this.CancellationReasons = reasons; }
}
class ValidationException extends Error {
  constructor(message) { super(message); this.name = "ValidationException"; }
}

function makeCommands() {
  const make = (name) => class { constructor(input) { this.input = input; this.name = name; } };
  return Object.fromEntries(["GetCommand", "PutCommand", "DeleteCommand", "BatchGetCommand", "BatchWriteCommand", "QueryCommand", "TransactWriteCommand", "ScanCommand", "UpdateCommand"]
    .map((n) => [n, make(n)]));
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function createFakeDynamo({ tables = {} } = {}) {
  // tables: { [name]: { pk: "PK", sk: "SK" | null, indexes: { [name]: { pk, sk } } } }
  const data = new Map(); // table → Map(keyString → item)
  const calls = [];
  const def = (t) => {
    const d = tables[t];
    if (!d) throw new ValidationException(`Unknown table ${t}`);
    if (!data.has(t)) data.set(t, new Map());
    return d;
  };
  const keyOf = (t, item) => {
    const d = def(t);
    if (item[d.pk] === undefined || (d.sk && item[d.sk] === undefined)) throw new ValidationException(`Missing key on ${t}`);
    return JSON.stringify([item[d.pk], d.sk ? item[d.sk] : null]);
  };
  const sub = (expr, names = {}) => String(expr || "").replace(/#\w+/g, (m) => {
    if (!(m in names)) throw new ValidationException(`Unknown attribute name ${m}`);
    return names[m];
  });

  function check(cond, item, names, values) {
    if (!cond) return true;
    const expr = sub(cond, names);
    if (/[()]/.test(expr.replace(/attribute_(not_)?exists\(\s*[\w.]+\s*\)/g, ""))) throw new ValidationException(`Unsupported condition: ${cond}`);
    return expr.split(/\s+OR\s+/).some((orPart) => orPart.split(/\s+AND\s+/).every((clause) => {
      const c = clause.trim();
      let m;
      if ((m = /^attribute_not_exists\(\s*([\w.]+)\s*\)$/.exec(c))) return !item || item[m[1]] === undefined;
      if ((m = /^attribute_exists\(\s*([\w.]+)\s*\)$/.exec(c))) return !!item && item[m[1]] !== undefined;
      if ((m = /^([\w.]+)\s*=\s*(:\w+)$/.exec(c))) {
        if (!(m[2] in values)) throw new ValidationException(`Unknown value ${m[2]}`);
        return !!item && item[m[1]] === values[m[2]];
      }
      throw new ValidationException(`Unsupported condition clause: ${c}`);
    }));
  }

  function put(t, item, cond, names, values) {
    const k = keyOf(t, item);
    if (JSON.stringify(item).length > MAX_ITEM_BYTES) throw new ValidationException("Item size has exceeded the maximum allowed size");
    if (!check(cond, data.get(t).get(k), names, values)) throw new ConditionalCheckFailedException();
    data.get(t).set(k, clone(item));
  }
  function del(t, key, cond, names, values) {
    const k = keyOf(t, key);
    if (!check(cond, data.get(t).get(k), names, values)) throw new ConditionalCheckFailedException();
    data.get(t).delete(k);
  }

  function query(input) {
    const d = def(input.TableName);
    const idx = input.IndexName ? d.indexes?.[input.IndexName] : d;
    if (!idx) throw new ValidationException(`Unknown index ${input.IndexName}`);
    const names = input.ExpressionAttributeNames || {};
    const values = input.ExpressionAttributeValues || {};
    const expr = sub(input.KeyConditionExpression, names);
    const m = /^(\w+)\s*=\s*(:\w+)(?:\s+AND\s+(.+))?$/.exec(expr.trim());
    if (!m || m[1] !== idx.pk) throw new ValidationException(`Unsupported key condition: ${input.KeyConditionExpression}`);
    const pkValue = values[m[2]];
    let skTest = () => true;
    if (m[3]) {
      const s = m[3].trim();
      let x;
      if ((x = /^begins_with\(\s*(\w+)\s*,\s*(:\w+)\s*\)$/.exec(s)) && x[1] === idx.sk) skTest = (v) => typeof v === "string" && v.startsWith(values[x[2]]);
      else if ((x = /^(\w+)\s+BETWEEN\s+(:\w+)\s+AND\s+(:\w+)$/.exec(s)) && x[1] === idx.sk) skTest = (v) => v >= values[x[2]] && v <= values[x[3]];
      else if ((x = /^(\w+)\s*(<=|>=|<|>)\s*(:\w+)$/.exec(s)) && x[1] === idx.sk) {
        const b = values[x[3]];
        skTest = { "<": (v) => v < b, "<=": (v) => v <= b, ">": (v) => v > b, ">=": (v) => v >= b }[x[2]];
      } else throw new ValidationException(`Unsupported sort key condition: ${s}`);
    }
    if (input.FilterExpression) throw new ValidationException("FilterExpression is not supported by the fake (filter in code, or design a better key)");
    let rows = [...data.get(input.TableName).values()].filter((it) => it[idx.pk] === pkValue && (idx.sk ? it[idx.sk] !== undefined && skTest(it[idx.sk]) : true));
    rows.sort((a, b) => (idx.sk ? (a[idx.sk] < b[idx.sk] ? -1 : a[idx.sk] > b[idx.sk] ? 1 : 0) : 0));
    if (input.ScanIndexForward === false) rows.reverse();
    if (input.ExclusiveStartKey) {
      const at = rows.findIndex((r) => r[idx.pk] === input.ExclusiveStartKey[idx.pk] && (!idx.sk || r[idx.sk] === input.ExclusiveStartKey[idx.sk]) && (idx === d || r[d.pk] === input.ExclusiveStartKey[d.pk]));
      rows = at >= 0 ? rows.slice(at + 1) : rows;
    }
    let last;
    if (input.Limit && rows.length > input.Limit) {
      rows = rows.slice(0, input.Limit);
      const r = rows[rows.length - 1];
      last = { [d.pk]: r[d.pk], ...(d.sk ? { [d.sk]: r[d.sk] } : {}), [idx.pk]: r[idx.pk], ...(idx.sk ? { [idx.sk]: r[idx.sk] } : {}) };
    }
    return { Items: clone(rows), Count: rows.length, ...(last ? { LastEvaluatedKey: last } : {}) };
  }

  async function send(cmd) {
    const { name, input } = cmd;
    calls.push({ name, input: clone(input) });
    switch (name) {
      case "GetCommand": {
        def(input.TableName);
        const it = data.get(input.TableName).get(keyOf(input.TableName, input.Key));
        return { Item: clone(it) };
      }
      case "PutCommand":
        def(input.TableName);
        put(input.TableName, input.Item, input.ConditionExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues || {});
        return {};
      case "DeleteCommand":
        def(input.TableName);
        del(input.TableName, input.Key, input.ConditionExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues || {});
        return {};
      case "BatchGetCommand": {
        const Responses = {};
        let total = 0;
        for (const [t, req] of Object.entries(input.RequestItems)) {
          def(t);
          total += req.Keys.length;
          Responses[t] = req.Keys.map((k) => data.get(t).get(keyOf(t, k))).filter(Boolean).map(clone);
        }
        if (total > 100) throw new ValidationException("Too many items requested for the BatchGetItem call");
        return { Responses, UnprocessedKeys: {} };
      }
      case "BatchWriteCommand": {
        let total = 0;
        for (const [t, reqs] of Object.entries(input.RequestItems)) {
          def(t);
          total += reqs.length;
          if (total > 25) throw new ValidationException("Too many items in the BatchWriteItem call (max 25)");
          for (const r of reqs) {
            if (r.PutRequest) put(t, r.PutRequest.Item);
            else if (r.DeleteRequest) del(t, r.DeleteRequest.Key);
          }
        }
        return { UnprocessedItems: {} };
      }
      case "QueryCommand":
        return query(input);
      case "ScanCommand": {
        def(input.TableName);
        return { Items: clone([...data.get(input.TableName).values()]) };
      }
      case "TransactWriteCommand": {
        const items = input.TransactItems || [];
        if (items.length > 100) throw new ValidationException("Too many transact items");
        const snapshot = new Map([...data].map(([t, m]) => [t, new Map(m)]));
        try {
          for (const op of items) {
            if (op.Put) { def(op.Put.TableName); put(op.Put.TableName, op.Put.Item, op.Put.ConditionExpression, op.Put.ExpressionAttributeNames, op.Put.ExpressionAttributeValues || {}); }
            else if (op.Delete) { def(op.Delete.TableName); del(op.Delete.TableName, op.Delete.Key, op.Delete.ConditionExpression, op.Delete.ExpressionAttributeNames, op.Delete.ExpressionAttributeValues || {}); }
            else if (op.ConditionCheck) {
              const c = op.ConditionCheck;
              def(c.TableName);
              if (!check(c.ConditionExpression, data.get(c.TableName).get(keyOf(c.TableName, c.Key)), c.ExpressionAttributeNames, c.ExpressionAttributeValues || {})) throw new ConditionalCheckFailedException();
            } else throw new ValidationException("Unsupported transact item");
          }
        } catch (err) {
          for (const [t, m] of snapshot) data.set(t, m);
          if (err instanceof ConditionalCheckFailedException) throw new TransactionCanceledException([{ Code: "ConditionalCheckFailed" }]);
          throw err;
        }
        return {};
      }
      default:
        throw new ValidationException(`${name} is not supported by the fake (see the header)`);
    }
  }

  return {
    db: { send },
    commands: makeCommands(),
    calls,
    items: (t) => [...(data.get(t) || new Map()).values()].map(clone),
    load: (t, items) => { def(t); for (const it of items) data.get(t).set(keyOf(t, it), clone(it)); },
  };
}

// The game table as phase 0 defines it (design/architecture/multi-campaign-plan.md).
const GAME_TABLE = "dnd-game";
const GAME_TABLE_DEF = { pk: "PK", sk: "SK", indexes: { GSI1: { pk: "GSI1PK", sk: "GSI1SK" } } };
const CONNECTIONS_TABLE = "dnd-ws-connections";
const CONNECTIONS_TABLE_DEF = { pk: "connectionId", sk: null, indexes: { campaign: { pk: "campaignId", sk: null } } };

module.exports = { createFakeDynamo, makeCommands, GAME_TABLE, GAME_TABLE_DEF, CONNECTIONS_TABLE, CONNECTIONS_TABLE_DEF, ConditionalCheckFailedException, TransactionCanceledException, ValidationException };
