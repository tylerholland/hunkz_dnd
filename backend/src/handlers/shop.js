// Story 72 — the item shop. One function behind /shop and /shop/{proxy+}:
//   GET  /shop            the shop as players see it (anyone): status, keeper,
//                         sign, and — only while open — the carried shelves
//                         with marked prices and stock
//   GET  /shop/dm         everything, for the DM page (DM)
//   GET  /shop/preview    the shop as players would see it if it were open
//                         now, with the current setup — for the DM's preview (DM)
//   PUT  /shop            { setup } — keeper, sign, shelves, prices, stock,
//                         temper, remembered templates, saved shops (DM)
//   PUT  /shop/status     { action, ... } — open, close, cancel, schedule (DM)
//   PUT  /shop/catalog    { items } — the item catalog (DM)
//   POST /shop/purchase   { asSlug, lines: [{ itemId, qty }] } — pay and
//                         take it home (the character's owner, or the DM)
//   POST /shop/haggle     { asSlug, itemId } — the server rolls (owner or DM)
//   POST /shop/let-in     { slug } — back in after being thrown out (DM)
//   POST /shop/sell       { asSlug, entryId } — sell one pack item back for
//                         half its list price (owner or DM)
// Purchases and sales are logged to the roll history (type "shop").
// GET /shop?asSlug=… with that character's password also returns their own
// haggling: deals struck, items refused, their read of the keeper's mood.
const crypto = require("crypto");
const { BatchGetCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { putSpecialRecord, appendRollHistoryEvent } = require("../lib/specialRecords");
const { buildPartyCard } = require("../lib/partyCard");
const { normalizeVisit, haggle, dealMult, publicVisit } = require("../lib/shopHaggle");
const { notifySessionChanged } = require("../lib/broadcast");
const {
  VersionConflictError, isConditionalFailure, currentVersion, conditionalPutParams, withVersionRetry, characterVersionKey, withVersions,
} = require("../lib/versioning");
const { SHOP_SLUG, SHOP_CATALOG_SLUG, CHRONICLE_SLUG, MAP_LIBRARY_SLUG, isReservedCharacterSlug } = require("../lib/specialItems");
const {
  CATS, MAX_QTY, CATALOG_SEED_VERSION, sellOffers, sellOne, normalizeCatalog, normalizeCatalogItem, normalizeShop, shopStatus, markedPrice, playerShop, payFromPurse, addPurchase,
} = require("../lib/shop");

async function isDm(event) {
  const password = event.headers?.["x-character-password"];
  if (password === undefined || password === null) return false;
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  return auth.valid && auth.role === "dm";
}

// Everything the shop's state depends on, in one round trip.
async function readAll() {
  const result = await db.send(new BatchGetCommand({
    RequestItems: { [TABLE]: { Keys: [SHOP_SLUG, SHOP_CATALOG_SLUG, CHRONICLE_SLUG, MAP_LIBRARY_SLUG].map((slug) => ({ slug })) } },
  }));
  const bySlug = new Map((result.Responses?.[TABLE] || []).map((item) => [item.slug, item]));
  const shopItem = bySlug.get(SHOP_SLUG);
  const catalogItem = bySlug.get(SHOP_CATALOG_SLUG);
  const shop = normalizeShop(shopItem);
  return {
    shop,
    shopVersion: currentVersion(shopItem),
    catalog: normalizeCatalog(catalogItem),
    catalogVersion: currentVersion(catalogItem),
    statusInfo: shopStatus(shop, {
      nextSessionAt: bySlug.get(CHRONICLE_SLUG)?.nextSession?.at || null,
      combatMode: bySlug.get(MAP_LIBRARY_SLUG)?.combatMode === true,
    }),
  };
}

const saveShop = (shop, version) => putSpecialRecord(SHOP_SLUG, shop, { expectedVersion: version });

// Read, change, write under the shop's version lock; then nudge every client.
async function updateShop(change) {
  const saved = await withVersionRetry(async () => {
    const state = await readAll();
    const next = change(state);
    if (next?.error) return next;
    const version = await saveShop(next, state.shopVersion);
    return { shop: next, version };
  });
  if (saved.error) return saved;
  await notifySessionChanged();
  return saved;
}

// Haggling belongs to one opening: a new one starts everyone afresh.
function visitOf(shop, slug) {
  const current = shop.opening?.id || null;
  return normalizeVisit(shop.visitsFor === current ? shop.visits[slug] : null, shop.temper);
}
function withVisit(shop, slug, visit, logEntry) {
  const current = shop.opening?.id || null;
  const visits = shop.visitsFor === current ? { ...shop.visits } : {};
  visits[slug] = visit;
  const haggleLog = shop.visitsFor === current ? shop.haggleLog : [];
  return { ...shop, visits, visitsFor: current, haggleLog: logEntry ? [logEntry, ...haggleLog].slice(0, 80) : haggleLog };
}
const freshHaggling = (shop) => ({ ...shop, visits: {}, haggleLog: [], visitsFor: shop.opening?.id || null });

// The character behind a request, if the password is theirs (or the DM's).
async function shopper(event, slug) {
  if (typeof slug !== "string" || !slug.trim() || isReservedCharacterSlug(slug.trim())) return null;
  const got = await db.send(new GetCommand({ TableName: TABLE, Key: { slug: slug.trim() } }));
  if (!got.Item) return null;
  const auth = await verifyPassword(event.headers?.["x-character-password"] ?? "", got.Item);
  return auth.valid ? got.Item : null;
}

function logText(o) {
  if (o.kind === "thrownOut") return "thrown out";
  if (o.kind === "push") return o.say === "push1" ? "refused" : "last warning";
  if (o.kind === "refuse") return "refused (won't haggle)";
  if (o.kind === "refuse-item") return `${o.done ? "refused again, done haggling" : "refused to sell"}${o.lostDiscounts ? `; lost ${o.lostDiscounts} discount${o.lostDiscounts === 1 ? "" : "s"}` : ""}`;
  if (o.say === "miss") return "haggled badly";
  return o.better ? o.short : "no better";
}

// A line in the session log. Best effort: a sale stands even if the log write fails.
async function logShopEvent(character, action, items, total, shopName) {
  try {
    await appendRollHistoryEvent({
      id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "shop",
      action,
      characterSlug: character.slug,
      characterName: character.name || character.slug,
      shop: shopName,
      items,
      total,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // the purchase or sale itself already happened
  }
}

const SETUP_FIELDS = ["buysBack", "keeper", "pick", "sign", "display", "carries", "level", "markups", "temper", "fill", "out", "memo", "saved"];
const live = (status) => status === "open" || status === "lockup";

function dmView(state) {
  return { shop: state.shop, catalog: state.catalog, ...state.statusInfo, version: state.shopVersion, catalogVersion: state.catalogVersion };
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = (event.rawPath || event.path || "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean); // ["shop", ...]
  if (parts[0] !== "shop") return notFound();
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }

  // GET /shop
  if (parts.length === 1 && method === "GET") {
    const state = await readAll();
    const body = { ...playerShop(state.shop, state.catalog, state.statusInfo), version: state.shopVersion };
    const asSlug = event.queryStringParameters?.asSlug;
    const who = asSlug ? await shopper(event, asSlug) : null;
    if (who) {
      body.visit = publicVisit(visitOf(state.shop, who.slug));
      // What they could sell back, while the shop is buying.
      if (state.shop.buysBack && state.statusInfo.status === "open") body.sellOffers = sellOffers(who, state.catalog);
    }
    return ok(body);
  }

  // GET /shop/dm
  if (parts[1] === "dm" && parts.length === 2 && method === "GET") {
    if (!(await isDm(event))) return forbidden("DM password required");
    return ok(dmView(await readAll()));
  }

  // GET /shop/preview — opened for the DM's eyes only; nothing is changed.
  if (parts[1] === "preview" && parts.length === 2 && method === "GET") {
    if (!(await isDm(event))) return forbidden("DM password required");
    const state = await readAll();
    const view = playerShop(state.shop, state.catalog, { ...state.statusInfo, status: "open", lockupUntil: null });
    return ok({ ...view, realStatus: state.statusInfo.status, version: state.shopVersion });
  }

  // PUT /shop — the setup. Stock flipped back in while the shop is open is
  // marked "just in" for players.
  if (parts.length === 1 && method === "PUT") {
    if (!(await isDm(event))) return forbidden("DM password required");
    const setup = body.setup && typeof body.setup === "object" ? body.setup : null;
    if (!setup) return badRequest("setup is required");
    const saved = await updateShop(({ shop, statusInfo }) => {
      const next = { ...shop };
      for (const key of SETUP_FIELDS) if (setup[key] !== undefined) next[key] = setup[key];
      const merged = normalizeShop(next);
      if (live(statusInfo.status) || statusInfo.status === "combat") {
        const wasOut = new Set(shop.out);
        const nowOut = new Set(merged.out);
        const at = new Date().toISOString();
        const justIn = { ...merged.justIn };
        for (const id of wasOut) if (!nowOut.has(id)) justIn[id] = at;
        for (const id of nowOut) delete justIn[id];
        merged.justIn = justIn;
      }
      return merged;
    });
    const state = await readAll();
    return ok(dmView({ ...state, shopVersion: saved.version }));
  }

  // PUT /shop/status
  if (parts[1] === "status" && parts.length === 2 && method === "PUT") {
    if (!(await isDm(event))) return forbidden("DM password required");
    const now = Date.now();
    const at = new Date(now).toISOString();
    const action = body.action;
    const saved = await updateShop(({ shop, statusInfo }) => {
      const opening = shop.opening;
      if (action === "open") {
        // A fresh opening: new stock flags, everyone starts over.
        return freshHaggling({ ...shop, justIn: {}, opening: { id: crypto.randomUUID(), mode: "now", nowClose: body.nowClose || "manual", openedAt: at } });
      }
      if (action === "close") {
        if (!opening || !live(statusInfo.status) && statusInfo.status !== "combat") return { error: badRequest("The shop isn't open") };
        return { ...shop, opening: { ...opening, closedAt: at } };
      }
      if (action === "closeNow") {
        // Skip the two minutes to pay.
        if (!opening) return shop;
        return { ...shop, opening: { ...opening, closedAt: new Date(now - 2 * 60 * 1000 - 1000).toISOString() } };
      }
      if (action === "cancel") return freshHaggling({ ...shop, opening: null, justIn: {} });
      if (action === "closes") {
        // Already open: change only when it closes.
        if (!opening || !live(statusInfo.status)) return { error: badRequest("The shop isn't open") };
        return { ...shop, opening: { ...opening, mode: "now", openedAt: statusInfo.opensAt || at, nowClose: body.nowClose || "manual", closedAt: null } };
      }
      if (action === "schedule") {
        const mode = body.mode === "pick" ? "pick" : "next";
        if (mode === "pick" && !Number.isFinite(Date.parse(body.opens))) return { error: badRequest("opens must be a valid time") };
        return freshHaggling({
          ...shop,
          justIn: {},
          opening: {
            id: crypto.randomUUID(), mode, lead: body.lead, closeOn: body.closeOn,
            opens: mode === "pick" ? new Date(Date.parse(body.opens)).toISOString() : null,
            closes: mode === "pick" && Number.isFinite(Date.parse(body.closes)) ? new Date(Date.parse(body.closes)).toISOString() : null,
          },
        });
      }
      return { error: badRequest("Unknown action") };
    });
    if (saved.error) return saved.error;
    const state = await readAll();
    return ok(dmView({ ...state, shopVersion: saved.version }));
  }

  // PUT /shop/catalog
  if (parts[1] === "catalog" && parts.length === 2 && method === "PUT") {
    if (!(await isDm(event))) return forbidden("DM password required");
    if (!Array.isArray(body.items)) return badRequest("items must be an array");
    const items = body.items.map(normalizeCatalogItem).filter(Boolean);
    if (!items.length) return badRequest("The catalog needs at least one item");
    const catalog = normalizeCatalog({ items, seedVersion: CATALOG_SEED_VERSION });
    const version = await putSpecialRecord(SHOP_CATALOG_SLUG, { ...catalog, seedVersion: CATALOG_SEED_VERSION });
    await notifySessionChanged();
    return ok({ ...catalog, version });
  }

  // POST /shop/purchase
  if (parts[1] === "purchase" && parts.length === 2 && method === "POST") {
    const slug = typeof body.asSlug === "string" ? body.asSlug.trim() : "";
    if (!slug || isReservedCharacterSlug(slug)) return badRequest("asSlug is required");
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length || lines.length > 50) return badRequest("lines must hold 1–50 items");

    const { shop, catalog, statusInfo } = await readAll();
    if (statusInfo.status === "combat") return conflict("The shutters are down for the fighting");
    if (!live(statusInfo.status)) return conflict("The shop is closed");
    const visit = visitOf(shop, slug);
    if (visit.thrownOut) return conflict("You've been thrown out of this shop");
    const byId = new Map(catalog.items.map((it) => [it.id, it]));
    const out = new Set(shop.out);
    const wanted = [];
    for (const line of lines) {
      const item = byId.get(line?.itemId);
      const qty = parseInt(line?.qty, 10);
      if (!item || item.hidden || !shop.carries.includes(item.cat) || !CATS.includes(item.cat)) return badRequest(`${line?.itemId || "That"} isn't sold here`);
      if (out.has(item.id)) return conflict(`${item.name} is sold out`);
      if (visit.refused.includes(item.id)) return conflict(`${item.name} isn't for sale to you`);
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) return badRequest("qty must be 1–99");
      // Your haggled price, if you struck one.
      const mult = dealMult(visit, item.id);
      wanted.push({ item, qty, each: Math.max(1, Math.round(markedPrice(item, shop.markups) * mult)), short: mult !== 1 ? visit.deals[item.id]?.short || null : null });
    }
    const total = wanted.reduce((sum, w) => sum + w.each * w.qty, 0);

    let result;
    try {
      result = await withVersionRetry(async () => {
        const got = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
        const character = got.Item;
        if (!character) return { status: "notFound" };
        const password = event.headers?.["x-character-password"] ?? "";
        const auth = await verifyPassword(password, character);
        if (!auth.valid) return { status: "forbidden" };
        const coin = payFromPurse(character.coin || {}, total);
        if (!coin) return { status: "poor" };
        let next = { ...character, coin };
        for (const w of wanted) next = addPurchase(next, w.item, w.qty, { shopName: shop.display.name });
        const expected = currentVersion(character);
        try {
          await db.send(new PutCommand(conditionalPutParams(TABLE, { ...next, slug, updatedAt: new Date().toISOString() }, expected)));
        } catch (err) {
          if (isConditionalFailure(err)) throw new VersionConflictError(characterVersionKey(slug));
          throw err;
        }
        return { status: "ok", version: expected + 1, character: next };
      });
    } catch (err) {
      if (err instanceof VersionConflictError) return conflict("Busy — please try again");
      throw err;
    }
    if (result.status === "notFound") return notFound();
    if (result.status === "forbidden") return forbidden();
    if (result.status === "poor") return conflict("Not enough coin");
    await logShopEvent(result.character, "bought", wanted.map((w) => ({ name: w.item.name, qty: w.qty, each: w.each })), total, shop.display.name);
    await notifySessionChanged();
    const { coin, weapons, equipment } = result.character;
    return ok(withVersions({
      total,
      lines: wanted.map((w) => ({ itemId: w.item.id, name: w.item.name, qty: w.qty, each: w.each, short: w.short })),
      character: { coin, weapons, equipment, version: result.version },
    }, { [characterVersionKey(slug)]: result.version }));
  }

  // POST /shop/haggle
  if (parts[1] === "haggle" && parts.length === 2 && method === "POST") {
    const character = await shopper(event, body.asSlug);
    if (!character) return forbidden("Sign in as your character to haggle");
    const slug = character.slug;
    const { abilityMods } = buildPartyCard(character);
    let outcome = null;
    const saved = await updateShop(({ shop, catalog, statusInfo }) => {
      if (statusInfo.status !== "open") return { error: conflict(statusInfo.status === "lockup" ? "Locking up: no more haggling" : "The shop isn't open") };
      const item = catalog.items.find((it) => it.id === body.itemId);
      if (!item || item.hidden || !shop.carries.includes(item.cat)) return { error: badRequest("That isn't sold here") };
      if (shop.out.includes(item.id)) return { error: conflict(`${item.name} is sold out`) };
      const visit = visitOf(shop, slug);
      if (visit.thrownOut) return { error: conflict("You've been thrown out of this shop") };
      if (visit.refused.includes(item.id)) return { error: conflict(`${item.name} isn't for sale to you`) };
      const r = haggle(visit, { itemId: item.id, temperKey: shop.temper, cha: abilityMods.Charisma || 0, wis: abilityMods.Wisdom || 0 });
      outcome = { ...r.outcome, price: Math.max(1, Math.round(markedPrice(item, shop.markups) * dealMult(r.visit, item.id))) };
      const entry = { at: new Date().toISOString(), slug, who: character.name || slug, item: item.name, result: logText(r.outcome) };
      return withVisit(shop, slug, r.visit, outcome.kind === "out-of-tries" ? null : entry);
    });
    if (saved.error) return saved.error;
    return ok({ outcome, visit: publicVisit(visitOf(saved.shop, slug)), version: saved.version });
  }

  // POST /shop/sell
  if (parts[1] === "sell" && parts.length === 2 && method === "POST") {
    const slug = typeof body.asSlug === "string" ? body.asSlug.trim() : "";
    if (!slug || isReservedCharacterSlug(slug)) return badRequest("asSlug is required");
    const { shop, catalog, statusInfo } = await readAll();
    if (statusInfo.status !== "open") return conflict(statusInfo.status === "lockup" ? "Locking up: no more selling" : "The shop isn't open");
    if (!shop.buysBack) return conflict("This shop isn't buying");
    if (visitOf(shop, slug).thrownOut) return conflict("You've been thrown out of this shop");
    let result;
    try {
      result = await withVersionRetry(async () => {
        const got = await db.send(new GetCommand({ TableName: TABLE, Key: { slug } }));
        if (!got.Item) return { status: "notFound" };
        const auth = await verifyPassword(event.headers?.["x-character-password"] ?? "", got.Item);
        if (!auth.valid) return { status: "forbidden" };
        const sold = sellOne(got.Item, body.entryId, catalog);
        if (!sold) return { status: "wontBuy" };
        const expected = currentVersion(got.Item);
        try {
          await db.send(new PutCommand(conditionalPutParams(TABLE, { ...sold.character, slug, updatedAt: new Date().toISOString() }, expected)));
        } catch (err) {
          if (isConditionalFailure(err)) throw new VersionConflictError(characterVersionKey(slug));
          throw err;
        }
        return { status: "ok", version: expected + 1, ...sold };
      });
    } catch (err) {
      if (err instanceof VersionConflictError) return conflict("Busy — please try again");
      throw err;
    }
    if (result.status === "notFound") return notFound();
    if (result.status === "forbidden") return forbidden();
    if (result.status === "wontBuy") return conflict("The keeper won't buy that");
    await logShopEvent(result.character, "sold", [{ name: result.name, qty: 1, each: result.price }], result.price, shop.display.name);
    await updateShop(({ shop: current }) => withVisit(current, slug, visitOf(current, slug), { at: new Date().toISOString(), slug, who: result.character.name || slug, item: result.name, result: `sold for ${result.price}s` }));
    const { coin, weapons, equipment } = result.character;
    return ok(withVersions({
      price: result.price,
      name: result.name,
      character: { coin, weapons, equipment, version: result.version },
      sellOffers: sellOffers(result.character, catalog),
    }, { [characterVersionKey(slug)]: result.version }));
  }

  // POST /shop/let-in
  if (parts[1] === "let-in" && parts.length === 2 && method === "POST") {
    if (!(await isDm(event))) return forbidden("DM password required");
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!slug) return badRequest("slug is required");
    const saved = await updateShop(({ shop }) => {
      const visit = visitOf(shop, slug);
      // Back in, on thin ice: no more haggling with this keeper today.
      const entry = { at: new Date().toISOString(), slug, who: shop.haggleLog.find((h) => h.slug === slug)?.who || slug, item: "—", result: "let back in" };
      return withVisit(shop, slug, { ...visit, thrownOut: false, patience: 0, snaps: 2, pushes: 0 }, entry);
    });
    const state = await readAll();
    return ok(dmView({ ...state, shopVersion: saved.version }));
  }

  return notFound();
};
