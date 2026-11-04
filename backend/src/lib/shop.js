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
// World of Dungeons' weapon classes. Each weapon on the shelf belongs to one:
// it sets the price and the damage (`stat`, editable per item); `dnd` is the
// D&D 5e die, used when DM Settings → Weapon damage says so. Keep in sync
// with WEAPON_TIERS in src/features/shop/shopData.js.
const WEAPON_TIERS = {
  light: { label: "Light weapon", stat: "d6", price: 10, icon: "blade", notes: "Wield as a second weapon to re-roll damage once per attack." },
  martial: { label: "Martial weapon", stat: "d6+1", price: 30, icon: "sword", notes: "Main hand only." },
  great: { label: "Great weapon", stat: "d6+2", price: 40, icon: "great", notes: "Uses both hands." },
  "light-ranged": { label: "Light ranged", stat: "d6", price: 10, icon: "bow" },
  ranged: { label: "Ranged", stat: "d6+1", price: 30, icon: "bow" },
  "heavy-ranged": { label: "Heavy ranged", stat: "d6+2", price: 50, icon: "bow", notes: "Full damage only when firing from a stationary position." },
};
const weapon = (id, name, tier, dnd, extra = {}) => {
  const t = WEAPON_TIERS[tier];
  return { id, cat: "arms", name, price: t.price, icon: t.icon, stat: t.stat, tier, dnd, ...(t.notes ? { notes: t.notes } : {}), ...extra };
};

const SEED_ITEMS = [
  // The class-only weapons World of Dungeons lists; hidden now that the shelf
  // names real weapons, but kept so things linked to them still resolve.
  { id: "light-weapon", cat: "arms", name: "Light Weapon", price: 10, icon: "blade", stat: "d6", tier: "light", dnd: "1d6", hidden: true, notes: "Daggers, short swords, hand axes. Wield as a second weapon to re-roll damage once per attack." },
  { id: "martial-weapon", cat: "arms", name: "Martial Weapon", price: 30, icon: "sword", stat: "d6+1", tier: "martial", dnd: "1d8", hidden: true, notes: "Long swords, hammers, axes, spears. Main hand only." },
  { id: "great-weapon", cat: "arms", name: "Great Weapon", price: 40, icon: "great", stat: "d6+2", tier: "great", dnd: "2d6", hidden: true, notes: "Two-handed swords, battle-axes, pole arms. Uses both hands." },
  weapon("dagger", "Dagger", "light", "1d4", { notes: "Easy to hide; can be thrown. Wield as a second weapon to re-roll damage once per attack." }),
  weapon("short-sword", "Short Sword", "light", "1d6"),
  weapon("club", "Club", "light", "1d4"),
  weapon("hand-axe", "Hand Axe", "light", "1d6", { hidden: true }),
  weapon("mace", "Mace", "light", "1d6", { hidden: true }),
  weapon("longsword", "Longsword", "martial", "1d8"),
  weapon("spear", "Spear", "martial", "1d6", { notes: "Can be thrown. Main hand only." }),
  weapon("flail", "Flail", "martial", "1d8"),
  weapon("warhammer", "Warhammer", "martial", "1d8", { hidden: true }),
  weapon("rapier", "Rapier", "martial", "1d8", { hidden: true }),
  weapon("greatsword", "Greatsword", "great", "2d6"),
  weapon("battle-axe", "Battle-Axe", "great", "1d12"),
  weapon("halberd", "Halberd", "great", "1d10", { hidden: true }),
  weapon("maul", "Maul", "great", "2d6", { hidden: true }),
  weapon("shortbow", "Shortbow", "light-ranged", "1d6"),
  weapon("sling", "Sling", "light-ranged", "1d4"),
  weapon("hand-crossbow", "Hand Crossbow", "light-ranged", "1d6"),
  weapon("bow", "Bow", "ranged", "1d8"),
  weapon("crossbow", "Crossbow", "ranged", "1d8"),
  { id: "heavy-bow", cat: "arms", name: "Heavy Bow", price: 50, icon: "bow", stat: "d6+2", tier: "heavy-ranged", dnd: "1d10", hidden: true, notes: "d6+2 damage if firing from a stationary position. Includes arbalests." },
  weapon("heavy-crossbow", "Heavy Crossbow", "heavy-ranged", "1d10", { hidden: true }),
  weapon("longbow", "Longbow", "heavy-ranged", "1d8"),
  { id: "light-armor", cat: "armor", name: "Light Armour", price: 30, icon: "armor", stat: "Armour 1" },
  { id: "full-armor", cat: "armor", name: "Full Armour", price: 60, icon: "heavy", stat: "Armour 2", notes: "Always has a helm. Makes it very hard to run, move quietly, swim, leap etc." },
  { id: "shield", cat: "armor", name: "Shield", price: 10, icon: "shield", stat: "+1 Armour" },
  { id: "rope", cat: "gear", name: "20ft Rope", price: 2, icon: "rope" },
  { id: "spike", cat: "gear", name: "Iron Spike", price: 2, icon: "pick" },
  { id: "chalk", cat: "gear", name: "Chalk", price: 2, icon: "pack" },
  { id: "parchment", cat: "gear", name: "Parchment", price: 2, icon: "pack" },
  { id: "flint", cat: "gear", name: "Flint & Steel", price: 2, icon: "fire" },
  { id: "torches", cat: "gear", name: "Torches", price: 2, icon: "torch", units: 4, stat: "Sold in fours" },
  { id: "tent", cat: "gear", name: "Tent", price: 2, icon: "house" },
  { id: "dice", cat: "gear", name: "Dice", price: 2, icon: "pack" },
  { id: "caltrops", cat: "gear", name: "Caltrops", price: 2, icon: "pack", stat: "slows pursuers" },
  { id: "bandages", cat: "gear", name: "Bandages", price: 2, icon: "pack" },
  { id: "rations", cat: "gear", name: "Travel Rations", price: 2, icon: "pack", notes: "Consume one when you rest to re-roll your HP." },
  { id: "waterskin", cat: "gear", name: "Waterskin", price: 2, icon: "flask", notes: "Consume one when you rest to re-roll your HP." },
  { id: "wineskin", cat: "gear", name: "Wineskin", price: 2, icon: "flask", notes: "Consume one when you rest to re-roll your HP." },
  { id: "crowbar", cat: "tools", name: "Crowbar", price: 5, icon: "pick" },
  { id: "hatchet", cat: "tools", name: "Hatchet", price: 5, icon: "blade" },
  { id: "trap", cat: "tools", name: "Animal Trap", price: 5, icon: "pack" },
  { id: "lockpicks", cat: "tools", name: "Lockpicks", price: 5, icon: "key" },
  { id: "ink", cat: "tools", name: "Pen & Pot of Ink", price: 5, icon: "flask" },
  { id: "fishing", cat: "tools", name: "Fishing Pole", price: 5, icon: "pick" },
  { id: "shovel", cat: "tools", name: "Shovel", price: 5, icon: "pick" },
  { id: "grapple", cat: "tools", name: "Grappling Hook", price: 5, icon: "key" },
  { id: "pickaxe", cat: "tools", name: "Pickaxe", price: 5, icon: "pick" },
  { id: "pole", cat: "tools", name: "Collapsible Pole", price: 5, icon: "pick" },
  { id: "quicksilver", cat: "occult", name: "Quicksilver (dose)", price: 10, icon: "flask", notes: "A Wizard can use a dose to summon a spirit they know. A mild poison and addictive drug: if you drink more doses in a day than your Level, resist its negative effects with a CON roll." },
  { id: "bone-dust", cat: "occult", name: "Pouch of Bone Dust", price: 10, icon: "skull" },
  { id: "holy-water", cat: "occult", name: "Vial of Holy Water", price: 10, icon: "flask", stat: "one use", notes: "A Cleric with Bless can anoint items with it (holy and magical, +3 damage vs. evil, for a short time); with Vision, drink it to commune with their deity." },
  { id: "blood", cat: "occult", name: "Vial of Blood", price: 10, icon: "flask" },
  { id: "incense", cat: "occult", name: "Ritual Incense & Oils", price: 10, icon: "fire" },
  { id: "potion-healing", cat: "occult", name: "Potion of Healing", price: 12, icon: "flask", stat: "Heals 2d4+2", notes: "Drink it (or pour it down a friend) to heal 2d4+2 HP." },
  { id: "mirror", cat: "fancy", name: "Mirror", price: 20, icon: "mirror" },
  { id: "lantern", cat: "fancy", name: "Lantern", price: 20, icon: "lantern" },
  { id: "spyglass", cat: "fancy", name: "Spyglass", price: 20, icon: "pick" },
  { id: "timer", cat: "fancy", name: "Sand Timer", price: 20, icon: "mirror" },
  { id: "boardgame", cat: "fancy", name: "Board Game", price: 20, icon: "pack" },
  { id: "clothes", cat: "fancy", name: "Elaborate Clothes", price: 20, icon: "armor" },
  { id: "clothes-boots", cat: "fancy", name: "Riding Boots", price: 20, icon: "armor" },
  { id: "clothes-cloak", cat: "fancy", name: "Hooded Trail Cloak", price: 20, icon: "armor" },
  { id: "clothes-gloves", cat: "fancy", name: "Fine Gloves", price: 20, icon: "armor" },
  { id: "clothes-hat", cat: "fancy", name: "Feathered Hat", price: 20, icon: "armor" },
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
const CATALOG_SEED_VERSION = 3;
const SEED_ADDITIONS = {
  2: ["clothes-boots", "clothes-cloak", "clothes-gloves", "clothes-hat"],
  3: ["dagger", "short-sword", "club", "hand-axe", "mace", "longsword", "spear", "flail", "warhammer", "rapier", "greatsword", "battle-axe", "halberd", "maul",
    "sling", "hand-crossbow", "crossbow", "heavy-crossbow", "longbow", "potion-healing"],
};
// Structure a saved catalog's built-in items pick up from the seed when they
// don't have it yet: weapon classes, 5e dice, and torches sold in fours.
const SEED_STRUCTURE = ["tier", "dnd", "units"];

// Text the seed used to carry that wasn't in World of Dungeons (or split one
// rule in two). A saved catalog still holding that exact text gets the
// corrected seed text; anything the DM wrote themselves is left alone.
const SEED_CORRECTIONS = {
  "torches": { "name": "Torches (4)" },
  "shortbow": { "notes": "Also slings." },
  "bow": { "notes": "Also crossbows." },
  "heavy-bow": {
    "notes": "A tall archer's longbow, carried across the back. Full power when you loose from a standing position."
  },
  "light-armor": {
    "notes": "Leathers and padded coats."
  },
  "full-armor": {
    "notes": "Always has a helm. Very hard to run, sneak, swim or leap in."
  },
  "dice": {
    "notes": "Bone, slightly loaded. Allegedly."
  },
  "waterskin": {
    "notes": null
  },
  "wineskin": {
    "notes": null
  },
  "lockpicks": {
    "notes": "Tinker, in the right hands."
  },
  "quicksilver": {
    "stat": "summons a spirit",
    "notes": "A mild poison and addictive drug. More doses in a day than your level: resist with CON."
  },
  "holy-water": {
    "notes": "Clerics may Bless or seek a Vision with it."
  },
  "clothes": {
    "notes": "Fine robes fit for a noble's table."
  },
  "clothes-boots": {
    "notes": "Tall, polished, and very good for kicking doors."
  },
  "clothes-cloak": {
    "notes": "Heavy wool, fur collar. Keeps the rain off and the stares away."
  },
  "clothes-hat": {
    "notes": "Makes an entrance before you do."
  }
};

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
  if (WEAPON_TIERS[raw.tier]) item.tier = raw.tier;
  // A picture the DM uploaded (Item catalog), from our own bucket only.
  if (typeof raw.art === "string" && ITEM_ART_URL.test(raw.art)) item.art = raw.art;
  const dnd = clip(raw.dnd, 20).replace(/\s+/g, ""); if (DICE.test(dnd)) item.dnd = dnd;
  const units = toInt(raw.units); if (units >= 2 && units <= 100) item.units = units;
  return item;
}

const ITEM_ART_URL = /^https:\/\/[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com\/shop-items\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/;

// ── Weapon damage ───────────────────────────────────────────────────────────
// `rules`: DM Settings → Weapon damage — "wod" (World of Dungeons: the item's
// `stat`, by class) or "dnd" (the item's D&D 5e die, falling back to `stat`).
const DICE = /^(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/i;
/** The damage dice a catalog weapon rolls under the table's rules, or null. */
function weaponDice(item, rules = "wod") {
  if (item?.cat !== "arms") return null;
  if (rules === "dnd" && item.dnd) return item.dnd;
  const stat = String(item.stat || "").replace(/\s+/g, "");
  return DICE.test(stat) ? stat : null;
}
/** The shelf line under a weapon's name: "Martial weapon · d6+1". */
function shelfStat(item, rules) {
  const tier = WEAPON_TIERS[item.tier];
  if (!tier) return item.stat || "";
  return [tier.label, weaponDice(item, rules)].filter(Boolean).join(" · ");
}
/** { itemId: dice } for every catalog weapon — what un-customised weapons roll. */
function weaponDiceMap(catalog, rules) {
  const out = {};
  for (const it of catalog?.items || []) { const d = weaponDice(it, rules); if (d) out[it.id] = d; }
  return out;
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
  if (Array.isArray(record?.items)) {
    source = source.map((raw) => {
      const seed = raw && SEED_ITEMS.find((it) => it.id === raw.id);
      if (!seed) return raw;
      const next = { ...raw };
      for (const field of SEED_STRUCTURE) if (seed[field] !== undefined && raw[field] === undefined) next[field] = seed[field];
      const fix = SEED_CORRECTIONS[raw.id];
      if (!fix) return next;
      for (const [field, oldText] of Object.entries(fix)) {
        if (oldText && raw[field] === oldText) {
          if (seed[field]) next[field] = seed[field]; else delete next[field];
        }
      }
      return next;
    });
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
    // The DM's own town and street for the sign (blank: the sign's suggestion).
    place: { town: clip(r.place?.town, 60), street: clip(r.place?.street, 60) },
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
    buysBack: r.buysBack !== false,
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
 * closed · scheduled · open · lockup (two minutes to pay after a close).
 * Combat doesn't shut it: the DM's Combat view offers to close it instead, so
 * setting up a fight doesn't throw shoppers out.
 */
function shopStatus(shop, { now = Date.now(), nextSessionAt = null } = {}) {
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
function playerShop(shop, catalog, statusInfo, rules = "wod") {
  const browsing = statusInfo.status === "open" || statusInfo.status === "lockup";
  const out = new Set(shop.out);
  const items = browsing
    ? catalog.items
      .filter((it) => !it.hidden && shop.carries.includes(it.cat))
      .map((it) => {
        const view = { id: it.id, cat: it.cat, name: it.name, price: markedPrice(it, shop.markups) };
        for (const k of ["per", "notes", "icon", "tier", "units", "art"]) if (it[k]) view[k] = it[k];
        const stat = shelfStat(it, rules); if (stat) view.stat = stat;
        if (out.has(it.id)) view.out = true;
        if (!out.has(it.id) && shop.justIn[it.id]) view.justIn = true;
        return view;
      })
    : [];
  return {
    ...statusInfo,
    keeper: shop.keeper,
    display: shop.display,
    buysBack: shop.buysBack,
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
    // Which opening this is — the DM's Combat view asks once per opening.
    openingId: shop.opening?.id || null,
    version,
  };
}

// ── Coin ── paying and purse value live in lib/money.js (the table's rates).
const { purseWorth, payFromPurse } = require("./money");

// ── Into the pack ───────────────────────────────────────────────────────────
const CONSUMABLE = new Set(["potion-healing", "rations", "torches", "bandages", "quicksilver", "holy-water", "blood", "bone-dust", "incense", "fire-oil", "chalk", "parchment", "spike", "caltrops"]);
const POTIONS = new Set(["potion-healing", "quicksilver", "holy-water", "blood", "fire-oil"]);
const newItemId = () => crypto.randomUUID();

function describe(item) {
  const parts = [item.stat, item.notes].filter(Boolean);
  if (item.per) parts.unshift(`Hired, ${item.price}s per ${item.per}`);
  return parts.join(" — ");
}

// An inventory entry's item type: the catalog item it is (`itemId`), set on
// purchase or linked by the DM. Its name and description are the player's to
// change. Older purchases carry it only as `bought.itemId`.
const linkedId = (entry) => entry?.itemId || entry?.bought?.itemId || null;

/**
 * The character with `qty` of a catalog item added: weapons for arms (one
 * entry each), armour and shields as armour items, everything else as
 * equipment, merged into a matching stack. New things arrive stowed, so
 * nothing changes the character's AC until they put it on.
 */
function addPurchase(character, item, sets, { shopName } = {}) {
  // Things sold in sets (torches, in fours) land as single pieces.
  const qty = item.cat === "arms" ? sets : sets * (item.units || 1);
  const char = { ...character, weapons: [...(character.weapons || [])], equipment: [...(character.equipment || [])] };
  const bought = shopName ? { from: shopName, itemId: item.id, at: new Date().toISOString() } : { itemId: item.id };
  const name = item.per ? `${item.name} (hired)` : item.name;
  if (item.cat === "arms") {
    // A weapon with a class rolls its type's dice (by the table's rules) until
    // its owner sets their own Damage; older class-less ones carry it.
    const mods = !item.tier && item.stat ? [{ attribute: "Damage", value: item.stat }] : [];
    for (let i = 0; i < qty; i += 1) {
      char.weapons.push({ id: newItemId(), itemId: item.id, name, description: describe(item), mods: mods.map((m) => ({ ...m })), equipped: false, bought });
    }
    return char;
  }
  const type = item.cat === "armor" ? (item.id === "shield" ? "shield" : "armor") : POTIONS.has(item.id) ? "potion" : item.cat === "tools" ? "tool" : "";
  // Stack onto the same thing under the same name; a stack the player renamed
  // ("Grandpa's Rope") stays theirs, and new rope starts its own line.
  const match = item.cat !== "armor" && item.cat !== "hire" && item.cat !== "travel"
    ? char.equipment.findIndex((e) => String(e?.name || "").trim().toLowerCase() === name.toLowerCase() && (!linkedId(e) || linkedId(e) === item.id))
    : -1;
  if (match >= 0) {
    const existing = char.equipment[match];
    char.equipment[match] = { ...existing, itemId: item.id, qty: Math.max(0, toInt(existing.qty ?? 1)) + qty };
    return char;
  }
  const entry = { id: newItemId(), itemId: item.id, name, description: describe(item), mods: [], equipped: false, bought };
  if (type) entry.type = type;
  if (qty !== 1 || CONSUMABLE.has(item.id) || item.units) entry.qty = qty;
  char.equipment.push(entry);
  return char;
}

// ── Selling back ────────────────────────────────────────────────────────────
// Anything in the pack that matches a catalog item (by its item type, or by
// name) can be sold back for half its list price. Hirelings can't.
function catalogMatch(entry, catalog) {
  if (!entry) return null;
  const byId = linkedId(entry) && catalog.items.find((it) => it.id === linkedId(entry));
  if (byId) return byId;
  const name = String(entry.name || "").trim().toLowerCase().replace(/ \(hired\)$/, "");
  return catalog.items.find((it) => it.name.toLowerCase() === name) || null;
}
const sellPrice = (item) => Math.max(1, Math.floor(item.price / 2));

/** What the shopper could sell from their pack, one at a time. */
function sellOffers(character, catalog) {
  const offers = [];
  for (const [list, kind] of [[character?.weapons, "weapon"], [character?.equipment, "gear"]]) {
    for (const entry of list || []) {
      const item = catalogMatch(entry, catalog);
      if (!item || item.cat === "hire" || !entry.id) continue;
      // Things sold in sets go back a whole set at a time (four torches).
      const have = kind === "weapon" ? 1 : Math.max(1, toInt(entry.qty ?? 1));
      const per = kind === "weapon" ? 1 : item.units || 1;
      if (have < per) continue;
      offers.push({ entryId: entry.id, kind, name: entry.name, itemId: item.id, itemName: item.name, cat: item.cat, icon: item.icon, ...(item.tier ? { tier: item.tier } : {}), ...(item.art ? { art: item.art } : {}), qty: Math.floor(have / per), ...(per > 1 ? { per } : {}), price: sellPrice(item), worn: entry.equipped !== false && (kind === "weapon" || ["armor", "shield"].includes(String(entry.type || "").toLowerCase())) });
    }
  }
  return offers;
}

/** The character after selling one of a pack entry: { character, item, price } or null. */
function sellOne(character, entryId, catalog) {
  for (const key of ["weapons", "equipment"]) {
    const list = character[key] || [];
    const idx = list.findIndex((e) => e?.id === entryId);
    if (idx < 0) continue;
    const entry = list[idx];
    const item = catalogMatch(entry, catalog);
    if (!item || item.cat === "hire") return null;
    const price = sellPrice(item);
    const qty = key === "weapons" ? 1 : Math.max(1, toInt(entry.qty ?? 1));
    const per = key === "weapons" ? 1 : item.units || 1;
    if (qty < per) return null;
    const next = qty > per ? list.map((e, i) => (i === idx ? { ...e, qty: qty - per } : e)) : list.filter((_, i) => i !== idx);
    const coin = { ...(character.coin || {}) };
    coin.sp = Math.max(0, toInt(coin.sp)) + price;
    return { character: { ...character, [key]: next, coin }, item, name: entry.name, price };
  }
  return null;
}

module.exports = {
  catalogMatch, sellPrice, sellOffers, sellOne,
  CATS, SEED_ITEMS, CATALOG_SEED_VERSION, LOCKUP_MS, MAX_ITEMS, MAX_QTY,
  normalizeCatalog, normalizeCatalogItem, normalizeShop, normalizeOpening,
  openingWindow, shopStatus, markedPrice, playerShop, shopSummary,
  purseWorth, payFromPurse, addPurchase,
  WEAPON_TIERS, weaponDice, weaponDiceMap, shelfStat,
};
