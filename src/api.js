import { setWeaponDice } from "./lib/weaponDice";
import { noteVersions } from "./lib/versionFloors";
import { setCustomEffects } from "./lib/spellEffects";
import { setTableMoney } from "./lib/money";
import { setCombatActive } from "./lib/dmSession";
import { needsTalentCodex, setTalentCodex, talentCodexFetchFailed } from "./features/characterSheet/talentCodexStore";

const BASE = import.meta.env.VITE_API_URL;
const OPTIONAL_ENDPOINT_SUPPORT = {
  rollHistory: null,
  characterRolls: null,
  dmRollHistoryPost: null,
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status, data });
  // ADR-030 — writes report the record versions they produced; screens then
  // ignore any older data for those records (see lib/versionFloors.js).
  if (data && data.versions) noteVersions(data.versions);
  return data;
}

async function requestOptional(path, options, supportKey, fallbackValue) {
  if (OPTIONAL_ENDPOINT_SUPPORT[supportKey] === false) {
    return typeof fallbackValue === "function" ? fallbackValue() : fallbackValue;
  }

  try {
    const data = await request(path, options);
    OPTIONAL_ENDPOINT_SUPPORT[supportKey] = true;
    return data;
  } catch (err) {
    if (err?.status === 404 || err instanceof TypeError) {
      OPTIONAL_ENDPOINT_SUPPORT[supportKey] = false;
      return typeof fallbackValue === "function" ? fallbackValue() : fallbackValue;
    }
    throw err;
  }
}

export const listCharacters = () =>
  request("/characters");

export const getCharacter = (slug) =>
  request(`/characters/${slug}`);

export const createCharacter = (charData, password) =>
  request("/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...charData, password }),
  });

export const updateCharacter = (slug, charData, password) =>
  request(`/characters/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify(charData),
  });

export const deleteCharacter = (slug, password) =>
  request(`/characters/${slug}`, {
    method: "DELETE",
    headers: { "x-character-password": password },
  });

export const verifyPassword = (slug, password) =>
  request(`/characters/${slug}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

export const postCharacterRoll = (slug, payload) =>
  requestOptional(`/characters/${slug}/rolls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "characterRolls", { success: false, unsupported: true });

export const getPortraitUploadUrl = (slug, password, contentType) =>
  request(`/characters/${slug}/portrait-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, contentType }),
  });

export const getDmParty = (dmPassword) =>
  request("/dm/party", {
    headers: { "x-character-password": dmPassword },
  });

export const getPartyRoster = () =>
  request("/party-roster");

export const putPartyRoster = (members, dmPassword, partyVisibilityEnabled) =>
  request("/party-roster", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify({
      members,
      ...(typeof partyVisibilityEnabled === "boolean" ? { partyVisibilityEnabled } : {}),
    }),
  });

export const patchSession = (slug, fields, password) =>
  request(`/characters/${slug}/session`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(password !== undefined && password !== null ? { "x-character-password": password } : {}),
    },
    body: JSON.stringify(fields),
  });

export const patchDmNote = (slug, action, dmPassword) =>
  request(`/characters/${slug}/dm-notes`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(action),
  });

export const getInitiative = (dmPassword) =>
  request("/initiative", {
    headers: { "x-character-password": dmPassword },
  });

export const putInitiative = (dmPassword, data) =>
  request("/initiative", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(data),
  });

export const getNpcCombat = (dmPassword) =>
  request("/npc-combat", {
    headers: { "x-character-password": dmPassword },
  });

export const putNpcCombat = (dmPassword, data) =>
  request("/npc-combat", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(data),
  });

export const getNpcLibrary = (dmPassword) =>
  request("/npc-library", {
    headers: { "x-character-password": dmPassword },
  });

export const putNpcLibrary = (dmPassword, templates) =>
  request("/npc-library", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ templates }),
  });

export const getRollHistory = (dmPassword) =>
  requestOptional("/roll-history", {
    headers: { "x-character-password": dmPassword },
  }, "rollHistory", { rolls: [], unsupported: true });

export const postDmRoll = (dmPassword, payload) =>
  requestOptional("/roll-history", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(payload),
  }, "dmRollHistoryPost", { success: false, unsupported: true });

export const getPartyStatus = () =>
  request("/party/status");

export const getInitiativePublic = () =>
  request("/initiative/public");

export const getMapLibrary = () =>
  request("/maps");

export const presignMap = (filename, contentType, size, dmPassword) =>
  request("/maps/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ filename, contentType, size }),
  });

export const postMap = (mapData, dmPassword) =>
  request("/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify(mapData),
  });

export const putMapActive = (mapId, dmPassword, modeOpts = {}) =>
  request("/maps/active", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ mapId, ...modeOpts }),
  });

export const putMapView = (mapView, dmPassword) =>
  request("/maps/view", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify(mapView),
  });

export const patchMap = (mapId, name, dmPassword) =>
  request(`/maps/${mapId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ name }),
  });

export const deleteMap = (mapId, dmPassword) =>
  request(`/maps/${mapId}`, {
    method: "DELETE",
    headers: { "x-character-password": dmPassword },
  });

export const patchMapTokens = (mapId, payload, dmPassword) =>
  request(`/maps/${mapId}/tokens`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify(payload),
  });

export const putMapCalibration = (mapId, tokenScale, dmPassword) =>
  request(`/maps/${mapId}/calibration`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ tokenScale }),
  });

export const putMapRotation = (mapId, rotation, dmPassword) =>
  request(`/maps/${mapId}/rotation`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ rotation }),
  });

// Story 34 — a player drags their own PC token; no auth (server enforces
// sourceId === slug and token.type === "character").
export const moveMapToken = (mapId, tokenId, x, y, slug) =>
  request(`/maps/${mapId}/tokens/${tokenId}/position`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y, slug }),
  });

export const getCounterWheels = (dmPassword) =>
  request("/counter-wheels", {
    headers: { "x-character-password": dmPassword },
  });

export const putCounterWheels = (dmPassword, wheels, wheelEvent) =>
  request("/counter-wheels", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ wheels, ...(wheelEvent ? { wheelEvent } : {}) }),
  });

// House rules (DM Settings) — read via getSessionState().houseRules.
// Label any logged event, live or archived — and, with `sessionId`, in that
// Chronicle session's saved copy too. An empty tag removes it. The DM signs
// with their password; a player with theirs plus `asSlug`.
export const putRollTag = (password, rollId, tag, sessionId, asSlug) =>
  request(`/roll-history/${encodeURIComponent(rollId)}/tag`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify({ tag, ...(sessionId ? { sessionId } : {}), ...(asSlug ? { asSlug } : {}) }),
  });

// Story 49 — a player ends their own turn. `entryId` is the initiative entry
// the player sees as active; the server refuses if that's no longer so.
export const endTurn = (slug, entryId) =>
  request("/initiative/end-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, entryId }),
  });

export const putHouseRules = (dmPassword, rules) =>
  request("/house-rules", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify(rules),
  });

// A shop item's picture (Item catalog) uses the same upload, in its own folder.
export const presignShopItemArt = (filename, contentType, size, dmPassword) =>
  request("/npc-library/portraits/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ filename, contentType, size, kind: "shop-item" }),
  });

export const presignNpcPortrait = (filename, contentType, size, dmPassword) =>
  request("/npc-library/portraits/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ filename, contentType, size }),
  });

// Story 35 — single consolidated polling endpoint.
// DM variant (valid dmPassword): { party, initiative, npcCombat, rollHistory, mapLibrary, counterWheels, serverTime }
// Public variant (no/invalid dmPassword): { partyStatus, initiativePublic, mapLibrary, rollHistory, serverTime, character? }
export const getSessionState = ({ dmPassword, slug } = {}) => {
  const params = new URLSearchParams();
  if (slug) params.set("slug", slug);
  const qs = params.toString();
  return request(`/session-state${qs ? `?${qs}` : ""}`, {
    headers: dmPassword !== undefined && dmPassword !== null ? { "x-character-password": dmPassword } : {},
  }).then((data) => {
    // Story 70 — the DM's custom effects ride house rules; register them so
    // every picker, pill and ring on this page knows their kind.
    setCustomEffects(data?.houseRules?.customEffects);
    // The table's coins and rates (DM Settings → Money).
    setTableMoney(data?.houseRules?.money);
    // What un-customised weapons roll, by the table's Weapon damage rule.
    setWeaponDice(data?.houseRules?.weaponDice);
    // Whether combat is on, for the top bar's mark beside Campaign.
    if (data?.mapLibrary && "combatMode" in data.mapLibrary) setCombatActive(data.mapLibrary.combatMode === true);
    // Story 39 — fetch the Talent Codex only when its version changes.
    if (needsTalentCodex(data?.talentCodexVersion)) {
      getTalentCodex()
        .then((codex) => setTalentCodex(codex.entries, codex.version))
        .catch(() => talentCodexFetchFailed());
    }
    return data;
  });
};

// Story 39 — the Talent Codex (anyone reads; the DM writes).
export const getTalentCodex = () => request("/talent-codex");

export const putTalentCodex = (dmPassword, entries) =>
  request("/talent-codex", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ entries }),
  });

// ── Story 69 — Session Chronicle ────────────────────────────────────────────
// `viewer` is { password, asSlug? } (DM: password only; a player: their
// character password + slug). Reads work without it.
const chronicleHeaders = (viewer, json = false) => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  ...(viewer?.password !== undefined && viewer?.password !== null ? { "x-character-password": viewer.password } : {}),
});

export const getChronicle = () => request("/chronicle");

export const getChronicleSession = (id, viewer) =>
  request(`/chronicle/sessions/${encodeURIComponent(id)}${viewer?.asSlug ? `?asSlug=${encodeURIComponent(viewer.asSlug)}` : ""}`, {
    headers: chronicleHeaders(viewer),
  });

// Live feed + everything archived (DM only) — the Record-a-session picker.
export const getRollHistoryWithArchive = (dmPassword) =>
  request("/roll-history?archive=1", { headers: { "x-character-password": dmPassword } });

export const createChronicleSession = (dmPassword, payload) =>
  request("/chronicle/sessions", { method: "POST", headers: chronicleHeaders({ password: dmPassword }, true), body: JSON.stringify(payload) });

export const updateChronicleSession = (dmPassword, id, payload) =>
  request(`/chronicle/sessions/${encodeURIComponent(id)}`, { method: "PUT", headers: chronicleHeaders({ password: dmPassword }, true), body: JSON.stringify(payload) });

export const deleteChronicleSession = (dmPassword, id) =>
  request(`/chronicle/sessions/${encodeURIComponent(id)}`, { method: "DELETE", headers: chronicleHeaders({ password: dmPassword }) });

export const putChronicleChapters = (dmPassword, chapters) =>
  request("/chronicle/chapters", { method: "PUT", headers: chronicleHeaders({ password: dmPassword }, true), body: JSON.stringify({ chapters }) });

// Homepage — the date of the next session (null clears it). DM or any player.
export const putChronicleNextSession = (viewer, at) =>
  request("/chronicle/next-session", {
    method: "PUT",
    headers: chronicleHeaders(viewer, true),
    body: JSON.stringify({ at, asSlug: viewer?.asSlug }),
  });

export const putChronicleSummary = (viewer, id, { text, baseUpdatedAt }) =>
  request(`/chronicle/sessions/${encodeURIComponent(id)}/summary`, {
    method: "PUT",
    headers: chronicleHeaders(viewer, true),
    body: JSON.stringify({ text, baseUpdatedAt: baseUpdatedAt ?? null, asSlug: viewer?.asSlug }),
  });

export const addChronicleRecollection = (viewer, id, text) =>
  request(`/chronicle/sessions/${encodeURIComponent(id)}/recollections`, {
    method: "POST",
    headers: chronicleHeaders(viewer, true),
    body: JSON.stringify({ text, asSlug: viewer?.asSlug }),
  });

export const updateChronicleRecollection = (viewer, id, recollectionId, changes) =>
  request(`/chronicle/sessions/${encodeURIComponent(id)}/recollections/${encodeURIComponent(recollectionId)}`, {
    method: "PUT",
    headers: chronicleHeaders(viewer, true),
    body: JSON.stringify({ ...changes, asSlug: viewer?.asSlug }),
  });

// ── Story 72 — the item shop ────────────────────────────────────────────────
// Players read GET /shop (only fetched when getSessionState().shop.version
// changes on live pages); the DM page reads /shop/dm and writes the rest.
const shopHeaders = (password, json = false) => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  ...(password !== undefined && password !== null ? { "x-character-password": password } : {}),
});

/** The shop as players see it; with a shopper's slug and password, also their own haggling. */
export const getShop = (shopper) => (shopper?.slug
  ? request(`/shop?asSlug=${encodeURIComponent(shopper.slug)}`, { headers: shopHeaders(shopper.password) })
  : request("/shop"));

/** Haggle over one item: the server rolls. */
export const postShopHaggle = (slug, password, itemId) =>
  request("/shop/haggle", { method: "POST", headers: shopHeaders(password, true), body: JSON.stringify({ asSlug: slug, itemId }) });

/** Sell one pack item back to the keeper for half its list price. */
export const postShopSell = (slug, password, entryId) =>
  request("/shop/sell", { method: "POST", headers: shopHeaders(password, true), body: JSON.stringify({ asSlug: slug, entryId }) });

/** Let a thrown-out shopper back in (DM). */
export const postShopLetIn = (dmPassword, slug) =>
  request("/shop/let-in", { method: "POST", headers: shopHeaders(dmPassword, true), body: JSON.stringify({ slug }) });

export const getShopDm = (dmPassword) => request("/shop/dm", { headers: shopHeaders(dmPassword) });

/** The shop as players would see it if it were open now (DM preview; changes nothing). */
export const getShopPreview = (dmPassword) => request("/shop/preview", { headers: shopHeaders(dmPassword) });

export const putShopSetup = (dmPassword, setup) =>
  request("/shop", { method: "PUT", headers: shopHeaders(dmPassword, true), body: JSON.stringify({ setup }) });

/** action: open · close · closeNow · cancel · closes · schedule (+ its fields). */
export const putShopStatus = (dmPassword, action, fields = {}) =>
  request("/shop/status", { method: "PUT", headers: shopHeaders(dmPassword, true), body: JSON.stringify({ action, ...fields }) });

export const putShopCatalog = (dmPassword, items) =>
  request("/shop/catalog", { method: "PUT", headers: shopHeaders(dmPassword, true), body: JSON.stringify({ items }) });

/** Pay for the satchel: lines [{ itemId, qty }]. Password is the character's (or the DM's). */
export const postShopPurchase = (slug, password, lines) =>
  request("/shop/purchase", { method: "POST", headers: shopHeaders(password, true), body: JSON.stringify({ asSlug: slug, lines }) });

// Party vote (lib/vote.js on the server). The DM runs it: "start" (question,
// options, multi, limitSec, showLive, showResult), "close", "cancel", "dismiss".
export const putVote = (dmPassword, action, fields = {}) =>
  request("/vote", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ ...fields, action }),
  });

/** A player's ballot (their password); picks are option indexes. */
export const postVoteBallot = (slug, password, voteId, picks) =>
  request("/vote/ballot", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify({ asSlug: slug, voteId, picks }),
  });

// Roll requests — the DM asks players for a check or save
// (backend/src/handlers/rollRequests.js). Actions: start, reveal, close, cancel.
export const putRollRequest = (dmPassword, action, fields = {}) =>
  request("/roll-requests", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ ...fields, action }),
  });

/** A player's roll for a request (their password): { total, rolls, manual }. */
export const postRollResult = (slug, password, id, result) =>
  request("/roll-requests/result", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify({ asSlug: slug, id, ...result }),
  });

// "Request silence" (backend/src/handlers/silence.js): the DM starts or lifts it;
// a player says they're listening.
export const putSilence = (dmPassword, action) =>
  request("/silence", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ action }),
  });

export const postSilenceAck = (slug, password, id) =>
  request("/silence/ack", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify({ asSlug: slug, id }),
  });

// The DM's prep deck, and the moments / notes sent from it
// (backend/src/handlers/tableMessages.js).
export const putPrepDeck = (dmPassword, action, payload = {}) =>
  request("/prep-deck", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ ...payload, action }),
  });

/** Send a card ({ cardId, to? }) or an unsaved one ({ card }); names = slug → name for the log. */
export const postTableMessage = (dmPassword, payload) =>
  request("/table-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify(payload),
  });

export const postMessageSeen = (slug, password, id) =>
  request("/table-messages/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify({ asSlug: slug, id }),
  });

export const postMessageReply = (slug, password, id, text) =>
  request("/table-messages/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": password },
    body: JSON.stringify({ asSlug: slug, id, text }),
  });

// A prepared moment's picture: the same upload as NPC portraits, in its own folder.
export const presignMomentArt = (filename, contentType, size, dmPassword) =>
  request("/npc-library/portraits/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-character-password": dmPassword },
    body: JSON.stringify({ filename, contentType, size, kind: "moment" }),
  });
