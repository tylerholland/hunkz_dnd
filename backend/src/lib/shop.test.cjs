const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SEED_ITEMS, LOCKUP_MS, normalizeCatalog, normalizeShop, shopStatus, markedPrice, playerShop,
  purseWorth, payFromPurse, addPurchase, normalizeCatalogItem,
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
  ], seedVersion: 3 });
  assert.deepEqual(items, [{ id: "silver-dagger", cat: "arms", name: "Silvered Dagger", price: 25, stat: "d6" }]);
});

test("a catalog saved before new built-in items gets them once", () => {
  const v3 = ["dagger", "short-sword", "club", "hand-axe", "mace", "longsword", "spear", "flail", "warhammer", "rapier", "greatsword", "battle-axe", "halberd", "maul",
    "sling", "hand-crossbow", "crossbow", "heavy-crossbow", "longbow", "potion-healing"];
  const old = { items: [{ id: "rope", name: "20ft Rope", cat: "gear", price: 2 }] };
  assert.deepEqual(normalizeCatalog(old).items.map((i) => i.id), ["rope", "clothes-boots", "clothes-cloak", "clothes-gloves", "clothes-hat", ...v3]);
  assert.deepEqual(normalizeCatalog({ ...old, seedVersion: 2 }).items.map((i) => i.id), ["rope", ...v3]);
  assert.deepEqual(normalizeCatalog({ ...old, seedVersion: 3 }).items.map((i) => i.id), ["rope"]);
});

test("saved built-in items pick up weapon classes and sets, keeping the DM's own text", () => {
  const saved = { seedVersion: 3, items: [
    { id: "torches", name: "Torches (4)", cat: "gear", price: 2 },
    { id: "bow", name: "Bow", cat: "arms", price: 30, stat: "d6+1", notes: "Also crossbows." },
    { id: "light-weapon", name: "Knives & Shivs", cat: "arms", price: 8, stat: "d6" },
  ] };
  const got = Object.fromEntries(normalizeCatalog(saved).items.map((i) => [i.id, i]));
  assert.equal(got.torches.name, "Torches");
  assert.equal(got.torches.units, 4);
  assert.equal(got.bow.tier, "ranged");
  assert.equal(got.bow.notes, undefined);
  assert.equal(got["light-weapon"].name, "Knives & Shivs");
  assert.equal(got["light-weapon"].dnd, "1d6");
});

test("an item keeps a picture the DM uploaded, from our bucket only", () => {
  const ok = "https://dnd-portraits.s3.us-west-1.amazonaws.com/shop-items/1f2e3d.jpg";
  assert.equal(normalizeCatalogItem({ id: "dagger", name: "Dagger", cat: "arms", price: 10, art: ok }).art, ok);
  assert.equal(normalizeCatalogItem({ id: "dagger", name: "Dagger", cat: "arms", price: 10, art: "https://evil.example/x.jpg" }).art, undefined);
  assert.equal(normalizeCatalogItem({ id: "dagger", name: "Dagger", cat: "arms", price: 10, art: "https://dnd-portraits.s3.us-west-1.amazonaws.com/npc-portraits/1.jpg" }).art, undefined);
});

test("weapons roll their class's dice, or their own 5e die by the table's rules", () => {
  const { weaponDice, shelfStat, weaponDiceMap } = require("./shop");
  const seed = Object.fromEntries(SEED_ITEMS.map((i) => [i.id, normalizeCatalogItem(i)]));
  assert.equal(weaponDice(seed.dagger), "d6");
  assert.equal(weaponDice(seed.dagger, "dnd"), "1d4");
  assert.equal(weaponDice(seed["battle-axe"], "dnd"), "1d12");
  assert.equal(weaponDice(seed.rope), null);
  assert.equal(shelfStat(seed.spear, "wod"), "Martial weapon · d6+1");
  assert.equal(shelfStat(seed.longbow, "dnd"), "Heavy ranged · 1d8");
  assert.equal(shelfStat(seed.lantern, "wod"), "");
  const map = weaponDiceMap(normalizeCatalog(null), "dnd");
  assert.equal(map.greatsword, "2d6");
  assert.equal(map["short-sword"], "1d6");
  assert.equal(map.rope, undefined);
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

test("opened by hand stays open until closed, even through combat", () => {
  const shop = normalizeShop({ opening: { id: "o2", mode: "now", nowClose: "manual", openedAt: new Date(T).toISOString() } });
  assert.equal(shopStatus(shop, { now: T + 999 * min }).status, "open");
  assert.equal(shopStatus(shop, { now: T + min, combatMode: true }).status, "open");
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

test("the shop pays from the purse at the table's rates", () => {
  assert.deepEqual(payFromPurse({ sp: 64 }, 20), { sp: 44, cp: 0, ep: 0, gp: 0, pp: 0 });
  assert.deepEqual(payFromPurse({ sp: 5, gp: 1 }, 7), { sp: 8, gp: 0, cp: 0, ep: 0, pp: 0 });
  assert.equal(payFromPurse({ sp: 1 }, 2), null);
  assert.equal(purseWorth({ sp: 9, gp: 2 }), 29);
});

test("selling back: half the list price, one at a time, never hirelings", () => {
  const { sellOffers, sellOne } = require("./shop");
  const catalog = normalizeCatalog(null);
  const char = { coin: { sp: 1 }, weapons: [{ id: "w", name: "Bow", bought: { itemId: "bow" } }], equipment: [{ id: "r", name: "20ft Rope", qty: 2 }, { id: "h", name: "Torch Bearer (hired)", bought: { itemId: "torchbearer" } }, { id: "x", name: "Lucky pebble" }] };
  assert.deepEqual(sellOffers(char, catalog).map((o) => [o.entryId, o.price, o.qty]), [["w", 15, 1], ["r", 1, 2]]);
  const sold = sellOne(char, "r", catalog);
  assert.equal(sold.character.equipment.find((e) => e.id === "r").qty, 1);
  assert.equal(sold.character.coin.sp, 2);
  assert.equal(sellOne(char, "h", catalog), null);
  assert.equal(sellOne(char, "x", catalog), null);
  assert.equal(sellOne(char, "w", catalog).character.weapons.length, 0);
});

test("an item's type stays with it: renamed things still sell, stack and stay theirs", () => {
  const { sellOffers } = require("./shop");
  const catalog = normalizeCatalog(null);
  const items = Object.fromEntries(SEED_ITEMS.map((i) => [i.id, i]));
  let char = { coin: {}, weapons: [{ id: "d", name: "Dagger of Bone", itemId: "light-weapon" }], equipment: [
    { id: "r", name: "20ft Rope", itemId: "rope" }, { id: "g", name: "Grandpa's Rope", itemId: "rope" },
  ] };
  const offers = sellOffers(char, catalog);
  assert.deepEqual(offers.map((o) => [o.name, o.itemName]), [["Dagger of Bone", "Light Weapon"], ["20ft Rope", "20ft Rope"], ["Grandpa's Rope", "20ft Rope"]]);
  // Buying more stacks onto the line with the shop's name, not the renamed one.
  char = addPurchase(char, items.rope, 2);
  assert.equal(char.equipment.find((e) => e.id === "r").qty, 3);
  assert.equal(char.equipment.find((e) => e.id === "g").qty, undefined);
  // New things carry their type.
  char = addPurchase(char, items.lantern, 1);
  assert.equal(char.equipment.at(-1).itemId, "lantern");
  char = addPurchase(char, items["light-weapon"], 1);
  assert.equal(char.weapons.at(-1).itemId, "light-weapon");
});

test("the catalog says what World of Dungeons says, and fixes untouched saved text", () => {
  const seed = Object.fromEntries(normalizeCatalog(null).items.map((i) => [i.id, i]));
  assert.equal(seed.quicksilver.stat, undefined);
  assert.match(seed.quicksilver.notes, /summon a spirit/);
  assert.match(seed.quicksilver.notes, /CON roll/);
  assert.equal(seed["light-armor"].notes, undefined);
  const saved = { seedVersion: 2, items: [
    { id: "quicksilver", name: "Quicksilver (dose)", cat: "occult", price: 10, stat: "summons a spirit", notes: "A mild poison and addictive drug. More doses in a day than your level: resist with CON." },
    { id: "dice", name: "Dice", cat: "gear", price: 2, notes: "My own note" },
  ] };
  const fixed = Object.fromEntries(normalizeCatalog(saved).items.map((i) => [i.id, i]));
  assert.equal(fixed.quicksilver.stat, undefined);
  assert.equal(fixed.quicksilver.notes, seed.quicksilver.notes);
  assert.equal(fixed.dice.notes, "My own note");
});

test("purchases land in the pack, stowed", () => {
  const items = Object.fromEntries(SEED_ITEMS.map((i) => [i.id, i]));
  let char = { weapons: [], equipment: [{ id: "e1", name: "Travel Rations", qty: 1 }] };
  char = addPurchase(char, items.spear, 2, { shopName: "Ironwhistle's" });
  assert.equal(char.weapons.length, 2);
  // A weapon with a class rolls its type's dice until its owner sets their own.
  assert.deepEqual(char.weapons[0].mods, []);
  assert.equal(char.weapons[0].itemId, "spear");
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
  char = addPurchase(char, items["potion-healing"], 1);
  assert.deepEqual([char.equipment.at(-1).type, char.equipment.at(-1).qty], ["potion", 1]);
});

test("a bought item keeps the picture its buyer saw", () => {
  const items = Object.fromEntries(SEED_ITEMS.map((i) => [i.id, i]));
  let char = addPurchase({ weapons: [], equipment: [] }, items["battle-axe"], 1, { shopName: "Ironwhistle's", variant: 2 });
  assert.equal(char.weapons[0].bought.variant, 2);
  char = addPurchase(char, items["battle-axe"], 1, { variant: "nonsense" });
  assert.equal(char.weapons[1].bought.variant, undefined);
});

test("torches come in fours and go back a whole set at a time", () => {
  const { sellOffers, sellOne } = require("./shop");
  const catalog = normalizeCatalog(null);
  const items = Object.fromEntries(catalog.items.map((i) => [i.id, i]));
  let char = addPurchase({ weapons: [], equipment: [] }, items.torches, 1);
  assert.deepEqual([char.equipment[0].name, char.equipment[0].qty], ["Torches", 4]);
  char = addPurchase(char, items.torches, 1);
  assert.equal(char.equipment[0].qty, 8);
  const offer = sellOffers(char, catalog)[0];
  assert.deepEqual([offer.qty, offer.per, offer.price], [2, 4, 1]);
  char = sellOne(char, char.equipment[0].id, catalog).character;
  assert.equal(char.equipment[0].qty, 4);
  const three = { ...char, equipment: [{ ...char.equipment[0], qty: 3 }] };
  assert.deepEqual(sellOffers(three, catalog), []);
  assert.equal(sellOne(three, three.equipment[0].id, catalog), null);
});
