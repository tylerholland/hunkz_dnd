// Story 58 — Session-mode inventory capture and coin/XP ledger helpers.
import { uid, XP_THRESHOLDS } from "./constants";

export const COIN_DENOMS = ["cp", "sp", "ep", "gp", "pp"];
const QTY_SUFFIX = /^(.*?)\s*[x×]\s*(\d+)$/i;

// "Rope, Torch, Arrows x20" → three new items. Trailing "xN" becomes qty on
// equipment only; weapons keep the literal name.
export function parseQuickAdd(text, kind) {
  return String(text || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      let name = part;
      let qty;
      const match = kind === "equipment" ? part.match(QTY_SUFFIX) : null;
      if (match && match[1].trim()) {
        name = match[1].trim();
        qty = parseInt(match[2], 10);
      }
      const item = { id: uid(), name: name.slice(0, 60), description: "", mods: [], equipped: true };
      if (qty !== undefined) item.qty = qty;
      return item;
    });
}

// op: "spend" | "gain" | "set". Returns { value, clamped }.
export function applyDelta(current, op, amount) {
  const base = Math.max(0, parseInt(current, 10) || 0);
  const n = Math.max(0, parseInt(amount, 10) || 0);
  let next = base;
  if (op === "spend") next = base - n;
  else if (op === "gain") next = base + n;
  else if (op === "set") next = n;
  return { value: Math.max(0, next), clamped: next < 0 };
}

export function normalizeCoin(coin) {
  const result = {};
  for (const denom of COIN_DENOMS) result[denom] = Math.max(0, parseInt(coin?.[denom], 10) || 0);
  return result;
}

export function xpProgress(xpCurrent, level) {
  const xp = Math.max(0, parseInt(xpCurrent, 10) || 0);
  const lvl = Math.max(1, Math.min(20, parseInt(level, 10) || 1));
  if (lvl >= 20) return { xp, floor: XP_THRESHOLDS[20], next: null, pct: 1, ready: false };
  const floor = XP_THRESHOLDS[lvl];
  const next = XP_THRESHOLDS[lvl + 1];
  const pct = Math.max(0, Math.min(1, (xp - floor) / (next - floor)));
  return { xp, floor, next, pct, ready: xp >= next };
}
