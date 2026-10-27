import { useSyncExternalStore } from "react";

// The table's money (DM Settings → Money, saved with the house rules): which
// coins are in use and what each is worth in the main coin, silver. Gold is
// worth 10 by default. Keep in sync with backend/src/lib/money.js.
//
// Every screen reads it from here; getSessionState() refreshes it, the same
// way it registers the DM's custom effects.

export const COIN_IDS = ["cp", "sp", "ep", "gp", "pp"];
export const MAIN_COIN = "sp";
export const COIN_NAMES = { cp: "Copper", sp: "Silver", ep: "Electrum", gp: "Gold", pp: "Platinum" };
export const DEFAULT_MONEY = {
  main: MAIN_COIN,
  coins: {
    cp: { on: false, rate: 0.1 },
    sp: { on: true, rate: 1 },
    ep: { on: false, rate: 5 },
    gp: { on: true, rate: 10 },
    pp: { on: false, rate: 100 },
  },
};

export function normalizeMoney(raw) {
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
  coins[MAIN_COIN] = { on: true, rate: 1 };
  return { main: MAIN_COIN, coins };
}

let current = DEFAULT_MONEY;
const listeners = new Set();
/** Register the table's money (from getSessionState().houseRules.money). */
export function setTableMoney(raw) {
  const next = normalizeMoney(raw);
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((fn) => fn(current));
}
export const tableMoney = () => current;
export function subscribeTableMoney(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** The table's money, re-rendering when the DM changes it. */
export const useTableMoney = () => useSyncExternalStore(subscribeTableMoney, tableMoney);

const count = (coin, id) => Math.max(0, parseInt(coin?.[id], 10) || 0);

/**
 * The coins to show for a purse: the main coin first, then the others in use
 * from most to least valuable — plus any coin that's switched off but that
 * the purse actually holds, so no money ever goes missing.
 */
export function shownCoins(coin, money = current) {
  const m = normalizeMoney(money);
  const others = COIN_IDS.filter((id) => id !== MAIN_COIN && (m.coins[id].on || count(coin, id) > 0))
    .sort((a, b) => m.coins[b].rate - m.coins[a].rate);
  return [MAIN_COIN, ...others];
}

/** The purse's value in silver. */
export function purseWorth(coin, money = current) {
  const m = normalizeMoney(money);
  return Math.round(COIN_IDS.reduce((s, id) => s + count(coin, id) * m.coins[id].rate, 0) * 100) / 100;
}

/** The "worth N silver" line shown beside a mixed purse. */
export const worthText = (coin, money = current) => `worth ${purseWorth(coin, money).toLocaleString()} silver`;

/** True when the purse holds more than one kind of coin (worth showing a total). */
export const mixedPurse = (coin) => COIN_IDS.filter((id) => count(coin, id) > 0).length > 1;
