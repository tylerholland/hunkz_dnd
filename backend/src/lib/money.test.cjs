const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_MONEY, normalizeMoney, purseWorth, payFromPurse } = require("./money");
const { normalizeHouseRulesRecord } = require("./houseRules");

test("silver is the main coin and gold is worth 10 by default", () => {
  const m = normalizeMoney(undefined);
  assert.deepEqual(m, DEFAULT_MONEY);
  assert.equal(normalizeHouseRulesRecord(undefined).money.coins.gp.rate, 10);
  // The main coin can't be switched off or re-rated; bad rates fall back.
  const odd = normalizeMoney({ coins: { sp: { on: false, rate: 3 }, gp: { on: true, rate: 50 }, cp: { on: true, rate: -1 } } });
  assert.deepEqual(odd.coins.sp, { on: true, rate: 1 });
  assert.equal(odd.coins.gp.rate, 50);
  assert.deepEqual(odd.coins.cp, { on: true, rate: 0.1 });
});

test("a purse's worth is in silver", () => {
  assert.equal(purseWorth({ sp: 9, gp: 2 }), 29);
  assert.equal(purseWorth({ sp: 9, gp: 2 }, { coins: { gp: { on: true, rate: 50 } } }), 109);
  assert.equal(purseWorth({ cp: 5, pp: 1 }), 100.5);
});

test("paying uses silver first, breaks gold when needed, change in silver", () => {
  assert.deepEqual(payFromPurse({ sp: 49, gp: 0 }, 2), { sp: 47, gp: 0, cp: 0, ep: 0, pp: 0 });
  assert.deepEqual(payFromPurse({ sp: 3, gp: 2 }, 15), { sp: 8, gp: 0, cp: 0, ep: 0, pp: 0 });
  assert.equal(payFromPurse({ sp: 3 }, 4), null);
  const before = { cp: 3, sp: 1, ep: 1, gp: 2, pp: 1 };
  assert.equal(purseWorth(payFromPurse(before, 47)), purseWorth(before) - 47);
  // At 50 silver to the gold, a gold piece breaks into 50.
  assert.deepEqual(payFromPurse({ sp: 0, gp: 1 }, 20, { coins: { gp: { on: true, rate: 50 } } }), { sp: 30, gp: 0, cp: 0, ep: 0, pp: 0 });
});
