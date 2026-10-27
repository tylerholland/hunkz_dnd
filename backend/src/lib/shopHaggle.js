// Story 72 phase 2 — haggling, worked out on the server so nobody can fake a
// roll. Per item, up to three tries: 2d6 + CHA + the keeper's hidden temper −
// earlier tries on the item. The keeper has hidden patience with each shopper;
// running it out first refuses that item, the second time ends haggling, and
// three more pushes get the shopper thrown out. What the shopper *thinks* the
// keeper's mood is comes from a hidden 2d6 + WIS each time.

const TEMPERS = {
  no: { refuses: true, mod: 0, patience: 3 },
  tough: { mod: -2, patience: 3 },
  fair: { mod: 0, patience: 5 },
  soft: { mod: 2, patience: 8 },
};
const MAX_TRIES = 3;
// Best price reached is kept; a great roll can go below list.
const TIERS = [
  { min: 14, mult: 0.7, short: "nearly a third off", say: "crit2" },
  { min: 12, mult: 0.8, short: "a fifth off", say: "crit" },
  { min: 10, mult: 0.9, short: "a tenth off", say: "full" },
  { min: 7, mult: 0.95, short: "a little off", say: "partial" },
];
const MOODS = ["easy", "wary", "testy", "done"];

const temperOf = (key) => TEMPERS[key] || TEMPERS.fair;
const d6 = () => 1 + Math.floor(Math.random() * 6);

function freshVisit(temperKey) {
  return { deals: {}, refused: [], patience: temperOf(temperKey).patience, snaps: 0, pushes: 0, thrownOut: false, read: null };
}

function normalizeVisit(raw, temperKey) {
  if (!raw || typeof raw !== "object") return freshVisit(temperKey);
  return {
    deals: raw.deals && typeof raw.deals === "object" ? raw.deals : {},
    refused: Array.isArray(raw.refused) ? raw.refused : [],
    patience: Number.isFinite(raw.patience) ? raw.patience : temperOf(temperKey).patience,
    snaps: Number(raw.snaps) || 0,
    pushes: Number(raw.pushes) || 0,
    thrownOut: raw.thrownOut === true,
    read: raw.read || null,
  };
}

/** The keeper's true mood: from patience left, and how often they've refused you. */
function trueMood(visit, temperKey) {
  if (visit.snaps >= 2) return 3;
  if (visit.snaps === 1) return 2;
  const p = visit.patience / temperOf(temperKey).patience;
  return p > 0.66 ? 0 : p > 0.33 ? 1 : 2;
}

/** What the shopper thinks: 10+ right and sure; 7–9 right but unsure; less, a step off (sure half the time). */
function readMood(truth, wis, roll = d6, random = Math.random) {
  const r = roll() + roll() + wis;
  if (r >= 10) return { mood: MOODS[truth], sure: true };
  if (r >= 7) return { mood: MOODS[truth], sure: false };
  const off = truth === 0 ? 1 : truth === 3 ? 2 : truth + (random() < 0.5 ? -1 : 1);
  return { mood: MOODS[off], sure: random() < 0.5 };
}

/**
 * One haggle over one item. Returns the new visit and what happened:
 * { kind: roll|refuse|push|thrownOut|out-of-tries, dice, mult, short, say,
 *   refusedItem, lostDiscounts, done }.
 */
function haggle(visitIn, { itemId, temperKey, cha = 0, wis = 0, roll = d6, random = Math.random }) {
  const visit = { ...visitIn, deals: { ...visitIn.deals }, refused: [...visitIn.refused] };
  const temper = temperOf(temperKey);
  const outcome = { itemId };

  // Done haggling with you: every try is a push towards the door.
  if (visit.snaps >= 2) {
    visit.pushes += 1;
    if (visit.pushes >= 3) { visit.thrownOut = true; outcome.kind = "thrownOut"; outcome.say = "thrownOut"; }
    else { outcome.kind = "push"; outcome.say = visit.pushes === 1 ? "push1" : "push2"; }
    visit.read = readMood(3, wis, roll, random);
    return { visit, outcome };
  }

  const prev = visit.deals[itemId] || { mult: 1, tries: 0 };
  if (prev.tries >= MAX_TRIES) return { visit, outcome: { ...outcome, kind: "out-of-tries", say: "holds" } };
  const tries = prev.tries + 1;
  const a = roll(), b = roll();
  outcome.dice = [a, b];
  outcome.cha = cha;
  outcome.tries = tries;

  if (temper.refuses) {
    // A keeper who won't haggle just says no; it still wears on them.
    visit.patience -= 1;
    visit.deals[itemId] = { ...prev, tries };
    Object.assign(outcome, { kind: "refuse", say: "refuse", mult: prev.mult });
  } else {
    const total = a + b + cha + (temper.mod || 0) - prev.tries;
    const tier = TIERS.find((t) => total >= t.min);
    if (tier) {
      const mult = Math.min(prev.mult, tier.mult);
      const better = mult < prev.mult;
      visit.deals[itemId] = { mult, tries, short: better ? tier.short : prev.short || tier.short };
      // You charmer: a very high roll wins back a little patience.
      visit.patience = tier.min >= 14 ? Math.min(temper.patience, visit.patience + 1) : visit.patience - 1;
      Object.assign(outcome, { kind: "roll", mult, short: better ? tier.short : null, say: better ? tier.say : "holds", better });
    } else {
      // A miss nudges the price up a little, never past +15%.
      const mult = Math.min(1.15, Math.round(prev.mult * 1.05 * 100) / 100);
      const short = mult > 1 ? "haggled badly" : mult < 1 ? "a little off, still" : "back to the marked price";
      visit.deals[itemId] = { mult, tries, short };
      visit.patience -= 2;
      Object.assign(outcome, { kind: "roll", mult, short, say: "miss", better: false });
    }
  }

  if (visit.patience <= 0) {
    // Patience gone: not that item, not to you. How badly they take it is a
    // hidden 2d6: the first time only a 2–3 loses your unpaid discounts (1 in
    // 12); the second, a 2–4 (1 in 6). After the second, no more haggling.
    visit.snaps += 1;
    delete visit.deals[itemId];
    visit.refused.push(itemId);
    const lose = roll() + roll() <= (visit.snaps === 1 ? 3 : 4);
    const lost = lose ? Object.keys(visit.deals).filter((id) => visit.deals[id].mult < 1) : [];
    for (const id of lost) visit.deals[id] = { tries: visit.deals[id].tries, mult: 1, short: "back to the marked price" };
    if (visit.snaps === 1) visit.patience = 2;
    Object.assign(outcome, { kind: "refuse-item", say: visit.snaps === 1 ? "soldOut" : "doneHaggling", refusedItem: itemId, lostDiscounts: lost.length, mult: 1, short: null });
  }
  outcome.done = visit.snaps >= 2;
  visit.read = readMood(trueMood(visit, temperKey), wis, roll, random);
  return { visit, outcome };
}

/**
 * A haggled price: the marked price times the deal, but always at least a
 * whole silver better (or worse) than the marked price, so a deal on a 2s
 * ration still counts. Never below 1s.
 */
function dealPrice(marked, mult) {
  if (!mult || mult === 1) return marked;
  const raw = Math.round(marked * mult);
  if (mult < 1) return Math.max(1, Math.min(raw, marked - 1));
  return Math.max(raw, marked + 1);
}

/** The price multiplier a shopper has struck for an item (1 = marked price). */
const dealMult = (visit, itemId) => Number(visit?.deals?.[itemId]?.mult) || 1;

/** What the shopper may see of their own visit: never patience or the true mood. */
function publicVisit(visit) {
  if (!visit) return null;
  const deals = Object.fromEntries(Object.entries(visit.deals).map(([id, d]) => [id, { mult: d.mult, tries: d.tries, short: d.short || null }]));
  return { deals, refused: visit.refused, thrownOut: visit.thrownOut, read: visit.read, done: visit.snaps >= 2, maxTries: MAX_TRIES };
}

/**
 * The DM's log line for a haggle, with the price it left the item at, e.g.
 * "haggled: a tenth off — now 9s (marked 10s)".
 */
function haggleLogText(o, price, marked) {
  if (o.kind === "thrownOut") return "thrown out";
  if (o.kind === "push") return o.say === "push1" ? "refused" : "last warning";
  if (o.kind === "refuse") return "refused (won't haggle)";
  if (o.kind === "refuse-item") return `${o.done ? "refused again, done haggling" : "refused to sell"}${o.lostDiscounts ? `; lost ${o.lostDiscounts} discount${o.lostDiscounts === 1 ? "" : "s"}` : ""}`;
  const now = price === marked ? `still ${marked}s` : `now ${price}s (marked ${marked}s)`;
  if (o.say === "miss") return `haggled badly — ${now}`;
  return o.better ? `haggled: ${o.short} — ${now}` : `haggled, no better — ${now}`;
}

/** The DM's log line for a purchase: { item: "Rope ×2, Torch", result: "bought for 5s" }. */
function purchaseLogText(lines, total) {
  const item = lines.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(", ");
  return { item, result: `bought for ${total}s${lines.some((l) => l.haggled) ? " (haggled)" : ""}` };
}

module.exports = { haggleLogText, purchaseLogText, TEMPERS, MAX_TRIES, TIERS, MOODS, freshVisit, normalizeVisit, trueMood, readMood, haggle, dealMult, dealPrice, publicVisit };
