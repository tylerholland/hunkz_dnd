const test = require("node:test");
const assert = require("node:assert/strict");
const { freshVisit, haggle, dealMult, publicVisit, trueMood, readMood } = require("./shopHaggle");

// Dice that come up in a fixed order, then repeat the last.
const dice = (...faces) => { let i = 0; return () => faces[Math.min(i++, faces.length - 1)]; };
const sure = () => 0.9;

test("tiers: 7–9 a little, 10–11 a tenth, 12–13 a fifth, 14+ nearly a third", () => {
  const at = (a, b, cha = 0) => haggle(freshVisit("fair"), { itemId: "x", temperKey: "fair", cha, roll: dice(a, b, 6, 6), random: sure }).outcome.mult;
  assert.equal(at(4, 3), 0.95);
  assert.equal(at(5, 5), 0.9);
  assert.equal(at(6, 6), 0.8);
  assert.equal(at(6, 6, 2), 0.7);
  assert.equal(at(1, 2), 1.05);
});

test("each retry on the same item is one harder, and only three are allowed", () => {
  let v = freshVisit("soft");
  v = haggle(v, { itemId: "x", temperKey: "fair", roll: dice(5, 5, 6, 6), random: sure }).visit; // 10 → 0.9
  const second = haggle(v, { itemId: "x", temperKey: "fair", roll: dice(5, 5, 6, 6), random: sure }); // 10 − 1 = 9: no better
  assert.equal(second.outcome.better, false);
  assert.equal(dealMult(second.visit, "x"), 0.9);
  v = haggle(second.visit, { itemId: "x", temperKey: "fair", roll: dice(6, 6, 6, 6), random: sure }).visit;
  assert.equal(haggle(v, { itemId: "x", temperKey: "fair", roll: dice(6, 6), random: sure }).outcome.kind, "out-of-tries");
});

test("a very high roll wins back patience; a miss costs two", () => {
  const charm = haggle({ ...freshVisit("fair"), patience: 4 }, { itemId: "x", temperKey: "fair", cha: 3, roll: dice(6, 6, 6, 6), random: sure });
  assert.equal(charm.visit.patience, 5);
  const miss = haggle(freshVisit("fair"), { itemId: "x", temperKey: "fair", roll: dice(1, 1, 6, 6), random: sure });
  assert.equal(miss.visit.patience, 3);
});

test("running out of patience refuses that item but usually keeps your discounts", () => {
  let v = { ...freshVisit("fair"), patience: 1, deals: { rope: { mult: 0.9, tries: 1 } } };
  const r = haggle(v, { itemId: "lantern", temperKey: "fair", roll: dice(1, 1, 6, 6), random: sure }); // miss, then a 12 on the temper roll
  assert.equal(r.outcome.kind, "refuse-item");
  assert.deepEqual(r.visit.refused, ["lantern"]);
  assert.equal(dealMult(r.visit, "rope"), 0.9);
  assert.equal(r.visit.patience, 2);
  assert.equal(trueMood(r.visit, "fair"), 2);
});

test("a snake-eyes temper roll loses the unpaid discounts, rarely", () => {
  const v = { ...freshVisit("fair"), patience: 1, deals: { rope: { mult: 0.9, tries: 1 } } };
  const r = haggle(v, { itemId: "lantern", temperKey: "fair", roll: dice(1, 1, 1, 1), random: sure });
  assert.equal(r.outcome.lostDiscounts, 1);
  assert.equal(dealMult(r.visit, "rope"), 1);
  assert.equal(r.visit.deals.rope.tries, 1);
});

test("after the second refusal, three pushes and you're out", () => {
  let v = { ...freshVisit("fair"), snaps: 2 };
  const kinds = [];
  for (let i = 0; i < 3; i += 1) {
    const r = haggle(v, { itemId: "x", temperKey: "fair", roll: dice(6), random: sure });
    v = r.visit; kinds.push(r.outcome.kind);
  }
  assert.deepEqual(kinds, ["push", "push", "thrownOut"]);
  assert.equal(v.thrownOut, true);
});

test("a deal is always worth at least a whole silver, never below 1s", () => {
  const { dealPrice } = require("./shopHaggle");
  assert.equal(dealPrice(2, 0.9), 1);   // 1.8 rounds to 2: still a silver off
  assert.equal(dealPrice(1, 0.7), 1);   // can't go below 1s
  assert.equal(dealPrice(20, 0.8), 16);
  assert.equal(dealPrice(2, 1.05), 3);  // a bad haggle costs at least a silver
  assert.equal(dealPrice(40, 1.05), 42);
  assert.equal(dealPrice(5, 1), 5);
});

test("players see their deals and their read of the mood, never patience", () => {
  const v = haggle(freshVisit("fair"), { itemId: "x", temperKey: "fair", wis: 2, roll: dice(5, 5, 6, 6), random: sure }).visit;
  const pub = publicVisit(v);
  assert.equal("patience" in pub, false);
  assert.equal(pub.deals.x.mult, 0.9);
  assert.deepEqual(readMood(1, 0, dice(5, 5)), { mood: "wary", sure: true });
  assert.deepEqual(readMood(1, 0, dice(4, 3)), { mood: "wary", sure: false });
});

test("the DM's log says what a haggle did to the price, and lists purchases", () => {
  const { haggleLogText, purchaseLogText } = require("./shopHaggle");
  assert.equal(haggleLogText({ kind: "roll", better: true, short: "a tenth off" }, 9, 10), "haggled: a tenth off — now 9s (marked 10s)");
  assert.equal(haggleLogText({ kind: "roll", say: "miss" }, 11, 10), "haggled badly — now 11s (marked 10s)");
  assert.equal(haggleLogText({ kind: "roll", say: "holds", better: false }, 10, 10), "haggled, no better — still 10s");
  assert.equal(haggleLogText({ kind: "refuse-item", done: false, lostDiscounts: 1 }), "refused to sell; lost 1 discount");
  assert.deepEqual(purchaseLogText([{ name: "Rope", qty: 2 }, { name: "Torch", qty: 1, haggled: true }], 5), { item: "Rope ×2, Torch", result: "bought for 5s (haggled)" });
  assert.deepEqual(purchaseLogText([{ name: "Ration", qty: 1 }], 2), { item: "Ration", result: "bought for 2s" });
});
