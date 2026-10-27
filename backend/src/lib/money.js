// The table's money (DM Settings → Money, stored with the house rules): which
// coins are in use and what each is worth in the main coin. Silver is the
// main coin; gold is worth 10 by default. Keep in sync with src/lib/money.js.

const COIN_IDS = ["cp", "sp", "ep", "gp", "pp"];
const MAIN = "sp";
const DEFAULT_MONEY = {
  main: MAIN,
  coins: {
    cp: { on: false, rate: 0.1 },
    sp: { on: true, rate: 1 },
    ep: { on: false, rate: 5 },
    gp: { on: true, rate: 10 },
    pp: { on: false, rate: 100 },
  },
};

function normalizeMoney(raw) {
  const coins = {};
  for (const id of COIN_IDS) {
    const d = DEFAULT_MONEY.coins[id];
    const r = raw?.coins?.[id];
    const rate = Number(r?.rate);
    coins[id] = {
      on: typeof r?.on === "boolean" ? r.on : d.on,
      rate: Number.isFinite(rate) && rate > 0 && rate <= 100000 ? Math.round(rate * 100) / 100 : d.rate,
    };
  }
  // The main coin is always in use and always worth 1.
  coins[MAIN] = { on: true, rate: 1 };
  return { main: MAIN, coins };
}

const toInt = (v) => Math.max(0, parseInt(v, 10) || 0);

/** The purse's value in the main coin (silver). */
function purseWorth(coin, money = DEFAULT_MONEY) {
  const m = normalizeMoney(money);
  const total = COIN_IDS.reduce((s, id) => s + toInt(coin?.[id]) * m.coins[id].rate, 0);
  return Math.round(total * 100) / 100;
}

/**
 * The purse after paying `cost` in the main coin, or null if it can't be
 * covered. Spends the least valuable coins first, breaks the smallest coin
 * that covers what's left, and gives change in the main coin (and in the
 * smallest coin for any fraction).
 */
function payFromPurse(coin, cost, money = DEFAULT_MONEY) {
  const m = normalizeMoney(money);
  const cents = (n) => Math.round(n * 100);
  const byValue = COIN_IDS.slice().sort((a, b) => m.coins[a].rate - m.coins[b].rate);
  const purse = Object.fromEntries(COIN_IDS.map((id) => [id, toInt(coin?.[id])]));
  let remaining = cents(cost);
  if (byValue.reduce((s, id) => s + purse[id] * cents(m.coins[id].rate), 0) < remaining) return null;
  for (const id of byValue) {
    const v = cents(m.coins[id].rate);
    const use = Math.min(purse[id], Math.floor(remaining / v));
    purse[id] -= use;
    remaining -= use * v;
  }
  if (remaining > 0) {
    // Any coin left behind is worth more than what's still owed: break the smallest.
    const id = byValue.find((c) => purse[c] > 0 && cents(m.coins[c].rate) >= remaining);
    purse[id] -= 1;
    let change = cents(m.coins[id].rate) - remaining;
    purse[MAIN] += Math.floor(change / 100);
    change %= 100;
    // Any fraction comes back in the smallest coin, in use or not, so nothing is lost.
    const small = byValue.find((c) => m.coins[c].rate < 1);
    if (change && small) purse[small] += Math.round(change / cents(m.coins[small].rate));
  }
  return { ...(coin || {}), ...purse };
}

module.exports = { COIN_IDS, MAIN, DEFAULT_MONEY, normalizeMoney, purseWorth, payFromPurse };
