// Story 72 — the item shop. Pure helpers shared by the shop handler and
// getSessionState: the seed catalog, normalizing the two shop records,
// working out whether the shop is open from times (nothing runs on a timer),
// marked prices, paying from a purse, and adding purchases to a character.
const crypto = require("crypto");

const CATS = ["arms", "armor", "gear", "tools", "occult", "fancy", "travel", "hire"];
const LOCKUP_MS = 2 * 60 * 1000;
const MAX_ITEMS = 300;
const MAX_QTY = 99;

// World of Dungeons equipment, priced in silver.
const SEED_ITEMS = [
  { id: "light-weapon", cat: "arms", name: "Light Weapon", price: 10, icon: "blade", stat: "d6", notes: "Daggers, short swords, hand axes. Wield as a second weapon to re-roll damage once per attack." },
  { id: "martial-weapon", cat: "arms", name: "Martial Weapon", price: 30, icon: "sword", stat: "d6+1", notes: "Long swords, hammers, axes, spears. Main hand only." },
  { id: "great-weapon", cat: "arms", name: "Great Weapon", price: 40, icon: "great", stat: "d6+2", notes: "Two-handed swords, battle-axes, pole arms. Uses both hands." },
  { id: "shortbow", cat: "arms", name: "Shortbow", price: 10, icon: "bow", stat: "d6", notes: "Also slings." },
  { id: "bow", cat: "arms", name: "Bow", price: 30, icon: "bow", stat: "d6+1", notes: "Also crossbows." },
  { id: "heavy-bow", cat: "arms", name: "Heavy Bow", price: 50, icon: "bow", stat: "d6+2", notes: "A tall archer's longbow, carried across the back. Full power when you loose from a standing position." },
  { id: "light-armor", cat: "armor", name: "Light Armour", price: 30, icon: "armor", stat: "Armour 1", notes: "Leathers and padded coats." },
  { id: "full-armor", cat: "armor", name: "Full Armour", price: 60, icon: "heavy", stat: "Armour 2", notes: "Always has a helm. Very hard to run, sneak, swim or leap in." },
  { id: "shield", cat: "armor", name: "Shield", price: 10, icon: "shield", stat: "+1 Armour" },
  { id: "rope", cat: "gear", name: "20ft Rope", price: 2, icon: "rope" },
  { id: "spike", cat: "gear", name: "Iron Spike", price: 2, icon: "pick" },
  { id: "chalk", cat: "gear", name: "Chalk", price: 2, icon: "pack" },
  { id: "parchment", cat: "gear", name: "Parchment", price: 2, icon: "pack" },
  { id: "flint", cat: "gear", name: "Flint & Steel", price: 2, icon: "fire" },
  { id: "torches", cat: "gear", name: "Torches (4)", price: 2, icon: "torch" },
  { id: "tent", cat: "gear", name: "Tent", price: 2, icon: "house" },
  { id: "dice", cat: "gear", name: "Dice", price: 2, icon: "pack", notes: "Bone, slightly loaded. Allegedly." },
  { id: "caltrops", cat: "gear", name: "Caltrops", price: 2, icon: "pack", stat: "slows pursuers" },
  { id: "bandages", cat: "gear", name: "Bandages", price: 2, icon: "pack" },
  { id: "rations", cat: "gear", name: "Travel Rations", price: 2, icon: "pack", notes: "Consume one when you rest to re-roll your HP." },
  { id: "waterskin", cat: "gear", name: "Waterskin", price: 2, icon: "flask" },
  { id: "wineskin", cat: "gear", name: "Wineskin", price: 2, icon: "flask" },
  { id: "crowbar", cat: "tools", name: "Crowbar", price: 5, icon: "pick" },
  { id: "hatchet", cat: "tools", name: "Hatchet", price: 5, icon: "blade" },
  { id: "trap", cat: "tools", name: "Animal Trap", price: 5, icon: "pack" },
  { id: "lockpicks", cat: "tools", name: "Lockpicks", price: 5, icon: "key", notes: "Tinker, in the right hands." },
  { id: "ink", cat: "tools", name: "Pen & Pot of Ink", price: 5, icon: "flask" },
  { id: "fishing", cat: "tools", name: "Fishing Pole", price: 5, icon: "pick" },
  { id: "shovel", cat: "tools", name: "Shovel", price: 5, icon: "pick" },
  { id: "grapple", cat: "tools", name: "Grappling Hook", price: 5, icon: "key" },
  { id: "pickaxe", cat: "tools", name: "Pickaxe", price: 5, icon: "pick" },
  { id: "pole", cat: "tools", name: "Collapsible Pole", price: 5, icon: "pick" },
  { id: "quicksilver", cat: "occult", name: "Quicksilver (dose)", price: 10, icon: "flask", stat: "summons a spirit", notes: "A mild poison and addictive drug. More doses in a day than your level: resist with CON." },
  { id: "bone-dust", cat: "occult", name: "Pouch of Bone Dust", price: 10, icon: "skull" },
  { id: "holy-water", cat: "occult", name: "Vial of Holy Water", price: 10, icon: "flask", stat: "one use", notes: "Clerics may Bless or seek a Vision with it." },
  { id: "blood", cat: "occult", name: "Vial of Blood", price: 10, icon: "flask" },
  { id: "incense", cat: "occult", name: "Ritual Incense & Oils", price: 10, icon: "fire" },
  { id: "mirror", cat: "fancy", name: "Mirror", price: 20, icon: "mirror" },
  { id: "lantern", cat: "fancy", name: "Lantern", price: 20, icon: "lantern" },
  { id: "spyglass", cat: "fancy", name: "Spyglass", price: 20, icon: "pick" },
  { id: "timer", cat: "fancy", name: "Sand Timer", price: 20, icon: "mirror" },
  { id: "boardgame", cat: "fancy", name: "Board Game", price: 20, icon: "pack" },
  { id: "clothes", cat: "fancy", name: "Elaborate Clothes", price: 20, icon: "armor", notes: "Fine robes fit for a noble's table." },
  { id: "clothes-boots", cat: "fancy", name: "Riding Boots", price: 20, icon: "armor", notes: "Tall, polished, and very good for kicking doors." },
  { id: "clothes-cloak", cat: "fancy", name: "Hooded Trail Cloak", price: 20, icon: "armor", notes: "Heavy wool, fur collar. Keeps the rain off and the stares away." },
  { id: "clothes-gloves", cat: "fancy", name: "Fine Gloves", price: 20, icon: "armor" },
  { id: "clothes-hat", cat: "fancy", name: "Feathered Hat", price: 20, icon: "armor", notes: "Makes an entrance before you do." },
  { id: "holy-symbol", cat: "fancy", name: "Holy Symbol", price: 20, icon: "coin", notes: "And other charms." },
  { id: "fire-oil", cat: "fancy", name: "Fire Oil (flask)", price: 20, icon: "fire", stat: "d6+1 / round, 3 rounds", notes: "Sets an area alight unless put out. Fills a lantern ten times." },
  { id: "mule", cat: "travel", name: "Mule", price: 30, icon: "horse" },
  { id: "horse", cat: "travel", name: "Horse", price: 100, icon: "horse" },
  { id: "warhorse", cat: "travel", name: "Warhorse", price: 1000, icon: "horse" },
  { id: "cart", cat: "travel", name: "Cart", price: 30, icon: "cart" },
  { id: "wagon", cat: "travel", name: "Wagon", price: 100, icon: "cart" },
  { id: "rowboat", cat: "travel", name: "Rowboat", price: 50, icon: "boat" },
  { id: "torchbearer", cat: "hire", name: "Torch Bearer", price: 2, per: "day", icon: "torch", stat: "3 HP · knife" },
  { id: "guide", cat: "hire", name: "Guide", price: 5, per: "day", icon: "person", stat: "6 HP · knife, lantern, rope" },
  { id: "armsman", cat: "hire", name: "Armsman", price: 20, per: "day", icon: "shield", stat: "12 HP · spear, shield, light armour" },
  { id: "expert", cat: "hire", name: "Expert", price: 20, per: "day", icon: "person", stat: "6 HP · skill 4 · dagger, bow" },
  { id: "champion", cat: "hire", name: "Champion", price: 60, per: "day", icon: "great", stat: "18 HP · full armour, halberd, sword, shield, dagger" },
];

// Items added to the built-in list after a catalog may already have been
// saved, by seed version. A saved catalog older than a version gets that
// version's items appended once (unless it already has them); anything the DM
// removed before then stays removed.
const CATALOG_SEED_VERSION = 2;
const SEED_ADDITIONS = { 2: ["clothes-boots", "clothes-cloak", "clothes-gloves", "clothes-hat"] };

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const parse = (v) => (typeof v === "string" && v ? Date.parse(v) : NaN);

function normalizeCatalogItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = clip(raw.id, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const name = clip(raw.name, 80);
  if (!id || !name || !CATS.includes(raw.cat)) return null;
  const price = Number(raw.price);
  if (!Number.isFinite(price) || price < 0) return null;
  const item = { id, cat: raw.cat, name, price: Math.round(price * 10) / 10 };
  const per = clip(raw.per, 20); if (per) item.per = per;
  const stat = clip(raw.stat, 120); if (stat) item.stat = stat;
  const notes = clip(raw.notes, 400); if (notes) item.notes = notes;
  const icon = clip(raw.icon, 20); if (icon) item.icon = icon;
  if (raw.hidden === true) item.hidden = true;
  return item;
}

/** The catalog record: seeded from World of Dungeons until the DM saves one. */
function normalizeCatalog(record) {
  let source = Array.isArray(record?.items) ? record.items : SEED_ITEMS;
  if (Array.isArray(record?.items)) {
    const savedAt = Number(record.seedVersion) || 1;
    const have = new Set(source.map((it) => it?.id));
    const added = [];
    for (let v = savedAt + 1; v <= CATALOG_SEED_VERSION; v += 1) {
      for (const id of SEED_ADDITIONS[v] || []) if (!have.has(id)) added.push(SEED_ITEMS.find((it) => it.id === id));
    }
    if (added.length) source = [...source, ...added.filter(Boolean)];
  }
  const seen = new Set();
  const items = [];
  for (const raw of source.slice(0, MAX_ITEMS)) {
    const item = normalizeCatalogItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return { items };
}

function normalizeOpening(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  const mode = ["next", "pick", "now"].includes(raw.mode) ? raw.mode : "now";
  return {
    id: raw.id,
    mode,
    lead: Math.max(0, Math.min(24 * 60, toInt(raw.lead) || 45)),
    closeOn: raw.closeOn === "manual" ? "manual" : "start",
    opens: typeof raw.opens === "string" ? raw.opens : null,
    closes: typeof raw.closes === "string" ? raw.closes : null,
    nowClose: ["manual", "hour", "start"].includes(raw.nowClose) ? raw.nowClose : "manual",
    openedAt: typeof raw.openedAt === "string" ? raw.openedAt : null,
    closedAt: typeof raw.closedAt === "string" ? raw.closedAt : null,
  };
}

const markupsOf = (raw) => Object.fromEntries(CATS.map((c) => [c, Math.max(-50, Math.min(200, toInt(raw?.[c])))]));

/** The shop record: its current setup, the opening, and the DM's memory. */
function normalizeShop(record) {
  const r = record || {};
  const carries = Array.isArray(r.carries) ? r.carries.filter((c) => CATS.includes(c)) : CATS.slice();
  const display = r.display && typeof r.display === "object" ? r.display : {};
  return {
    keeper: clip(r.keeper, 40) || "mags",
    pick: clip(r.pick, 60) || clip(r.keeper, 40) || "mags",
    sign: r.sign && typeof r.sign === "object" ? r.sign : { nameIdx: 0 },
    display: {
      keeperName: clip(display.keeperName, 60) || "Mags",
      name: clip(display.name, 80) || "Ironwhistle's Emporium",
      where: clip(display.where, 80) || "Greyhawk · Low Market",
      sub: clip(display.sub, 200) || "",
    },
    carries: carries.length ? carries : CATS.slice(),
    level: ["cheap", "low", "high"].includes(r.level) ? r.level : "low",
    markups: markupsOf(r.markups),
    temper: ["no", "tough", "fair", "soft"].includes(r.temper) ? r.temper : "fair",
    fill: ["all", "full", "half", "empty"].includes(r.fill) ? r.fill : "full",
    out: Array.isArray(r.out) ? r.out.filter((id) => typeof id === "string").slice(0, MAX_ITEMS) : [],
    justIn: r.justIn && typeof r.justIn === "object" ? r.justIn : {},
    memo: r.memo && typeof r.memo === "object" ? r.memo : {},
    saved: Array.isArray(r.saved) ? r.saved.slice(0, 50) : [],
    opening: normalizeOpening(r.opening),
    // Haggling, per shopper, for the opening named by visitsFor (phase 2).
    visits: r.visits && typeof r.visits === "object" ? r.visits : {},
    visitsFor: typeof r.visitsFor === "string" ? r.visitsFor : null,
    haggleLog: Array.isArray(r.haggleLog) ? r.haggleLog.slice(0, 80) : [],
  };
}

/** When an opening starts and ends, in ms (closes null = until the DM closes it). */
function openingWindow(opening, nextSessionAt) {
  if (!opening) return null;
  const next = parse(nextSessionAt);
  if (opening.mode === "next") {
    if (!Number.isFinite(next)) return null;
    return { opens: next - opening.lead * 60000, closes: opening.closeOn === "start" ? next : null };
  }
  if (opening.mode === "pick") {
    const opens = parse(opening.opens);
    if (!Number.isFinite(opens)) return null;
    const closes = parse(opening.closes);
    return { opens, closes: Number.isFinite(closes) ? closes : null };
  }
  const opens = parse(opening.openedAt);
  if (!Number.isFinite(opens)) return null;
  const closes = opening.nowClose === "hour" ? opens + 3600000
    : opening.nowClose === "start" && Number.isFinite(next) && next > opens ? next
    : null;
  return { opens, closes };
}

/**
 * Whether the shop is open, worked out from times on every read.
 * closed · scheduled · open · lockup (two minutes to pay after a close) · combat.
 */
function shopStatus(shop, { now = Date.now(), nextSessionAt = null, combatMode = false } = {}) {
  const opening = shop?.opening || null;
  const w = openingWindow(opening, nextSessionAt);
  let status = "closed";
  let lockupUntil = null;
  if (w) {
    const closedAt = opening.closedAt ? parse(opening.closedAt) : w.closes;
    if (Number.isFinite(closedAt) && closedAt !== null && now >= closedAt) {
      if (now < closedAt + LOCKUP_MS) { status = "lockup"; lockupUntil = closedAt + LOCKUP_MS; }
    } else if (now < w.opens) {
      status = "scheduled";
    } else {
      status = "open";
    }
  }
  if (combatMode && (status === "open" || status === "lockup")) status = "combat";
  return {
    status,
    opensAt: iso(w?.opens),
    closesAt: iso(w?.closes),
    lockupUntil: iso(lockupUntil),
    openingId: opening?.id || null,
  };
}

/** The price players see: list price with this shop's markup for the shelf. */
function markedPrice(item, markups) {
  const m = toInt(markups?.[item.cat]);
  return Math.max(1, Math.round(item.price * (1 + m / 100)));
}

/** What players get: never markups, temper, or anything while it's shut. */
function playerShop(shop, catalog, statusInfo) {
  const browsing = statusInfo.status === "open" || statusInfo.status === "lockup";
  const out = new Set(shop.out);
  const items = browsing
    ? catalog.items
      .filter((it) => !it.hidden && shop.carries.includes(it.cat))
      .map((it) => {
        const view = { id: it.id, cat: it.cat, name: it.name, price: markedPrice(it, shop.markups) };
        for (const k of ["per", "stat", "notes", "icon"]) if (it[k]) view[k] = it[k];
        if (out.has(it.id)) view.out = true;
        if (!out.has(it.id) && shop.justIn[it.id]) view.justIn = true;
        return view;
      })
    : [];
  return {
    ...statusInfo,
    keeper: shop.keeper,
    display: shop.display,
    carries: browsing ? shop.carries.slice() : [],
    items,
  };
}

/** The little summary that rides on every session-state poll. */
function shopSummary(shop, statusInfo, version) {
  return {
    status: statusInfo.status,
    opensAt: statusInfo.opensAt,
    closesAt: statusInfo.closesAt,
    lockupUntil: statusInfo.lockupUntil,
    keeper: shop.keeper,
    keeperName: shop.display.keeperName,
    name: shop.display.name,
    version,
  };
}

// ── Coin ────────────────────────────────────────────────────────────────────
// Prices are in silver; sheets hold cp/sp/ep/gp/pp. Pay from the whole purse:
// smallest coins first, breaking a bigger coin when needed and taking the
// change back in silver and copper.
const DENOMS = [["cp", 1], ["sp", 10], ["ep", 50], ["gp", 100], ["pp", 1000]];

function purseValueCp(coin) {
  return DENOMS.reduce((sum, [k, v]) => sum + Math.max(0, toInt(coin?.[k])) * v, 0);
}

/** New purse after paying `costSp` silver, or null if it can't be covered. */
function payFromPurse(coin, costSp) {
  const cost = Math.round(costSp * 10);
  const purse = Object.fromEntries(DENOMS.map(([k]) => [k, Math.max(0, toInt(coin?.[k]))]));
  if (purseValueCp(purse) < cost) return null;
  let remaining = cost;
  for (const [k, v] of DENOMS) {
    const use = Math.min(purse[k], Math.floor(remaining / v));
    purse[k] -= use;
    remaining -= use * v;
  }
  if (remaining > 0) {
    // Break the smallest coin that covers what's left. One always does: any
    // coin the pass above left behind is worth more than what's still owed.
    const [k, v] = DENOMS.find(([d, value]) => purse[d] > 0 && value >= remaining);
    purse[k] -= 1;
    remaining -= v;
    const change = -remaining;
    purse.sp += Math.floor(change / 10);
    purse.cp += change % 10;
  }
  return { ...(coin || {}), ...purse };
}

// ── Into the pack ───────────────────────────────────────────────────────────
const CONSUMABLE = new Set(["rations", "torches", "bandages", "quicksilver", "holy-water", "blood", "bone-dust", "incense", "fire-oil", "chalk", "parchment", "spike", "caltrops"]);
const POTIONS = new Set(["quicksilver", "holy-water", "blood", "fire-oil"]);
const newItemId = () => crypto.randomUUID();

function describe(item) {
  const parts = [item.stat, item.notes].filter(Boolean);
  if (item.per) parts.unshift(`Hired, ${item.price}s per ${item.per}`);
  return parts.join(" — ");
}

/**
 * The character with `qty` of a catalog item added: weapons for arms (one
 * entry each), armour and shields as armour items, everything else as
 * equipment, merged into a matching stack. New things arrive stowed, so
 * nothing changes the character's AC until they put it on.
 */
function addPurchase(character, item, qty, { shopName } = {}) {
  const char = { ...character, weapons: [...(character.weapons || [])], equipment: [...(character.equipment || [])] };
  const bought = shopName ? { from: shopName, itemId: item.id, at: new Date().toISOString() } : { itemId: item.id };
  const name = item.per ? `${item.name} (hired)` : item.name;
  if (item.cat === "arms") {
    for (let i = 0; i < qty; i += 1) {
      char.weapons.push({ id: newItemId(), name, description: describe(item), mods: item.stat ? [{ attribute: "Damage", value: item.stat }] : [], equipped: false, bought });
    }
    return char;
  }
  const type = item.cat === "armor" ? (item.id === "shield" ? "shield" : "armor") : POTIONS.has(item.id) ? "potion" : item.cat === "tools" ? "tool" : "";
  const match = item.cat !== "armor" && item.cat !== "hire" && item.cat !== "travel"
    ? char.equipment.findIndex((e) => String(e?.name || "").trim().toLowerCase() === name.toLowerCase())
    : -1;
  if (match >= 0) {
    const existing = char.equipment[match];
    char.equipment[match] = { ...existing, qty: Math.max(0, toInt(existing.qty ?? 1)) + qty };
    return char;
  }
  const entry = { id: newItemId(), name, description: describe(item), mods: [], equipped: false, bought };
  if (type) entry.type = type;
  if (qty !== 1 || CONSUMABLE.has(item.id)) entry.qty = qty;
  char.equipment.push(entry);
  return char;
}

module.exports = {
  CATS, SEED_ITEMS, CATALOG_SEED_VERSION, LOCKUP_MS, MAX_ITEMS, MAX_QTY,
  normalizeCatalog, normalizeCatalogItem, normalizeShop, normalizeOpening,
  openingWindow, shopStatus, markedPrice, playerShop, shopSummary,
  purseValueCp, payFromPurse, addPurchase,
};
