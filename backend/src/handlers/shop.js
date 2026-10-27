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
const crypto = require("crypto");
const { BatchGetCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { putSpecialRecord } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");
const {
  VersionConflictError, isConditionalFailure, currentVersion, conditionalPutParams, withVersionRetry, characterVersionKey, withVersions,
} = require("../lib/versioning");
const { SHOP_SLUG, SHOP_CATALOG_SLUG, CHRONICLE_SLUG, MAP_LIBRARY_SLUG, isReservedCharacterSlug } = require("../lib/specialItems");
const {
  CATS, MAX_QTY, normalizeCatalog, normalizeCatalogItem, normalizeShop, shopStatus, markedPrice, playerShop, payFromPurse, addPurchase,
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

const SETUP_FIELDS = ["keeper", "pick", "sign", "display", "carries", "level", "markups", "temper", "fill", "out", "memo", "saved"];
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
    return ok({ ...playerShop(state.shop, state.catalog, state.statusInfo), version: state.shopVersion });
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
        return { ...shop, justIn: {}, opening: { id: crypto.randomUUID(), mode: "now", nowClose: body.nowClose || "manual", openedAt: at } };
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
      if (action === "cancel") return { ...shop, opening: null, justIn: {} };
      if (action === "closes") {
        // Already open: change only when it closes.
        if (!opening || !live(statusInfo.status)) return { error: badRequest("The shop isn't open") };
        return { ...shop, opening: { ...opening, mode: "now", openedAt: statusInfo.opensAt || at, nowClose: body.nowClose || "manual", closedAt: null } };
      }
      if (action === "schedule") {
        const mode = body.mode === "pick" ? "pick" : "next";
        if (mode === "pick" && !Number.isFinite(Date.parse(body.opens))) return { error: badRequest("opens must be a valid time") };
        return {
          ...shop,
          justIn: {},
          opening: {
            id: crypto.randomUUID(), mode, lead: body.lead, closeOn: body.closeOn,
            opens: mode === "pick" ? new Date(Date.parse(body.opens)).toISOString() : null,
            closes: mode === "pick" && Number.isFinite(Date.parse(body.closes)) ? new Date(Date.parse(body.closes)).toISOString() : null,
          },
        };
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
    const catalog = normalizeCatalog({ items });
    const version = await putSpecialRecord(SHOP_CATALOG_SLUG, catalog);
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
    const byId = new Map(catalog.items.map((it) => [it.id, it]));
    const out = new Set(shop.out);
    const wanted = [];
    for (const line of lines) {
      const item = byId.get(line?.itemId);
      const qty = parseInt(line?.qty, 10);
      if (!item || item.hidden || !shop.carries.includes(item.cat) || !CATS.includes(item.cat)) return badRequest(`${line?.itemId || "That"} isn't sold here`);
      if (out.has(item.id)) return conflict(`${item.name} is sold out`);
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) return badRequest("qty must be 1–99");
      wanted.push({ item, qty, each: markedPrice(item, shop.markups) });
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
    await notifySessionChanged();
    const { coin, weapons, equipment } = result.character;
    return ok(withVersions({
      total,
      lines: wanted.map((w) => ({ itemId: w.item.id, name: w.item.name, qty: w.qty, each: w.each })),
      character: { coin, weapons, equipment, version: result.version },
    }, { [characterVersionKey(slug)]: result.version }));
  }

  return notFound();
};
