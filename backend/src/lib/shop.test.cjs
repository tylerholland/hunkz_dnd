const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SEED_ITEMS, LOCKUP_MS, normalizeCatalog, normalizeShop, shopStatus, markedPrice, playerShop,
  purseValueCp, payFromPurse, addPurchase,
} = require("./shop");
const { isReservedCharacterSlug, SHOP_SLUG, SHOP_CATALOG_SLUG } = require("./specialItems");

const T = Date.parse("2026-10-31T19:00:00.000Z"); // the next session
const min = 60000;

test("shop records are reserved slugs", () => {
  assert.equal(isReservedCharacterSlug(SHOP_SLUG), true);
  assert.equal(isReservedCharacterSlug(SHOP_CATALOG_SLUG), true);
});

test("the catalog is seeded from World of Dungeons and cleaned on save", () => {
  assert.equal(normalizeCatalog(null).items.length, SEED_ITEMS.length);
  const { items } = normalizeCatalog({ items: [
    { id: "Silver Dagger!", name: " Silvered Dagger ", cat: "arms", price: "25", stat: "d6" },
    { id: "silver-dagger", name: "Duplicate", cat: "arms", price: 1 },
    { id: "x", name: "Bad shelf", cat: "nope", price: 1 },
    { id: "y", name: "Bad price", cat: "gear", price: -1 },
  ], seedVersion: 2 });
  assert.deepEqual(items, [{ id: "silver-dagger", cat: "arms", name: "Silvered Dagger", price: 25, stat: "d6" }]);
});

test("a catalog saved before new built-in items gets them once", () => {
  const old = { items: [{ id: "rope", name: "20ft Rope", cat: "gear", price: 2 }] };
  assert.deepEqual(normalizeCatalog(old).items.map((i) => i.id), ["rope", "clothes-boots", "clothes-cloak", "clothes-gloves", "clothes-hat"]);
  const current = { items: old.items, seedVersion: 2 };
  assert.deepEqual(normalizeCatalog(current).items.map((i) => i.id), ["rope"]);
});

test("before the next session: scheduled, open, two minutes to pay, closed", () => {
  const shop = normalizeShop({ opening: { id: "o1", mode: "next", lead: 45, closeOn: "start" } });
  const at = (ms) => shopStatus(shop, { now: ms, nextSessionAt: new Date(T).toISOString() });
  assert.equal(at(T - 60 * min).status, "scheduled");
  assert.equal(at(T - 60 * min).opensAt, new Date(T - 45 * min).toISOString());
  assert.equal(at(T - 45 * min).status, "open");
  assert.equal(at(T).status, "lockup");
  assert.equal(at(T).lockupUntil, new Date(T + LOCKUP_MS).toISOString());
  assert.equal(at(T + LOCKUP_MS).status, "closed");
  // No session date: nothing to open before.
  assert.equal(shopStatus(shop, { now: T }).status, "closed");
});

test("opened by hand stays open until closed; combat shuts it", () => {
  const shop = normalizeShop({ opening: { id: "o2", mode: "now", nowClose: "manual", openedAt: new Date(T).toISOString() } });
  assert.equal(shopStatus(shop, { now: T + 999 * min }).status, "open");
  assert.equal(shopStatus(shop, { now: T + min, combatMode: true }).status, "combat");
  const closed = normalizeShop({ ...shop, opening: { ...shop.opening, closedAt: new Date(T + 10 * min).toISOString() } });
  assert.equal(shopStatus(closed, { now: T + 11 * min }).status, "lockup");
  assert.equal(shopStatus(closed, { now: T + 13 * min }).status, "closed");
  const hour = normalizeShop({ opening: { id: "o3", mode: "now", nowClose: "hour", openedAt: new Date(T).toISOString() } });
  assert.equal(shopStatus(hour, { now: T + 61 * min }).status, "lockup");
});

test("picked times can span days for downtime", () => {
  const shop = normalizeShop({ opening: { id: "o4", mode: "pick", opens: new Date(T).toISOString(), closes: new Date(T + 3 * 24 * 60 * min).toISOString() } });
  assert.equal(shopStatus(shop, { now: T - 1 }).status, "scheduled");
  assert.equal(shopStatus(shop, { now: T + 2 * 24 * 60 * min }).status, "open");
});

test("players see marked prices, never markups, and nothing while it's shut", () => {
  const shop = normalizeShop({ carries: ["gear", "fancy"], markups: { fancy: 25 }, out: ["lantern"], justIn: { rope: "x" } });
  const catalog = normalizeCatalog(null);
  const open = playerShop(shop, catalog, { status: "open" });
  assert.ok(open.items.every((it) => ["gear", "fancy"].includes(it.cat)));
  assert.equal(open.items.find((it) => it.id === "mirror").price, 25);
  assert.equal(open.items.find((it) => it.id === "lantern").out, true);
  assert.equal(open.items.find((it) => it.id === "rope").justIn, true);
  assert.equal("markups" in open, false);
  assert.equal("temper" in open, false);
  assert.deepEqual(playerShop(shop, catalog, { status: "scheduled" }).items, []);
  assert.equal(markedPrice({ cat: "gear", price: 2 }, { gear: -20 }), 2);
  assert.equal(markedPrice({ cat: "gear", price: 2 }, { gear: -50 }), 1);
});

test("paying spends small coins first and gives change in silver and copper", () => {
  assert.equal(purseValueCp({ cp: 5, sp: 2, gp: 1 }), 125);
  assert.deepEqual(payFromPurse({ cp: 0, sp: 64, ep: 0, gp: 0, pp: 0 }, 20), { cp: 0, sp: 44, ep: 0, gp: 0, pp: 0 });
  assert.deepEqual(payFromPurse({ cp: 5, sp: 0, ep: 0, gp: 1, pp: 0 }, 3), { cp: 5, sp: 7, ep: 0, gp: 0, pp: 0 });
  assert.equal(payFromPurse({ sp: 1 }, 2), null);
  const after = payFromPurse({ cp: 3, sp: 1, ep: 1, gp: 2, pp: 1 }, 47);
  assert.equal(purseValueCp(after), purseValueCp({ cp: 3, sp: 1, ep: 1, gp: 2, pp: 1 }) - 470);
});

test("purchases land in the pack, stowed", () => {
  const items = Object.fromEntries(SEED_ITEMS.map((i) => [i.id, i]));
  let char = { weapons: [], equipment: [{ id: "e1", name: "Travel Rations", qty: 1 }] };
  char = addPurchase(char, items["martial-weapon"], 2, { shopName: "Ironwhistle's" });
  assert.equal(char.weapons.length, 2);
  assert.deepEqual(char.weapons[0].mods, [{ attribute: "Damage", value: "d6+1" }]);
  assert.equal(char.weapons[0].equipped, false);
  char = addPurchase(char, items.rations, 3);
  assert.equal(char.equipment.find((e) => e.id === "e1").qty, 4);
  char = addPurchase(char, items.shield, 1);
  assert.equal(char.equipment.at(-1).type, "shield");
  assert.equal(char.equipment.at(-1).acBonus, undefined);
  char = addPurchase(char, items.torchbearer, 1);
  assert.equal(char.equipment.at(-1).name, "Torch Bearer (hired)");
  char = addPurchase(char, items.lantern, 1);
  assert.equal(char.equipment.at(-1).qty, undefined);
});
