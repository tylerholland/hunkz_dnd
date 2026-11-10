// The prep deck and the moments / notes sent from it. One function:
//   PUT  /prep-deck                 { action: "save", card } | { action: "delete", id } — the DM
//   POST /table-messages            { cardId? | card fields, to?, names? } — the DM sends one
//                                   (a card is marked used; names = slug → name for the log)
//   POST /table-messages/seen       { asSlug, id } — a player read the moment / tapped "Got it"
//   POST /table-messages/reply      { asSlug, id, text } — a player's one reply to a note
// Polls carry them (getSessionState: the deck to the DM; messages projected per viewer).
const crypto = require("crypto");
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { getSpecialRecord, putSpecialRecord, appendRollHistoryEvent, getPartyRosterState } = require("../lib/specialRecords");
const { notifySessionChanged } = require("../lib/broadcast");
const { currentVersion, withVersionRetry, VersionConflictError } = require("../lib/versioning");
const { PREP_DECK_SLUG, TABLE_MESSAGES_SLUG, isReservedCharacterSlug } = require("../lib/specialItems");
const {
  normalizeDeck, saveCard, deleteCard, normalizeMessages, composeMessage, addMessage, markSeen, replyTo, projectMessages, messageLogEvent, replyLogEvent,
} = require("../lib/tableMessages");

async function isDm(event) {
  const password = event.headers?.["x-character-password"];
  if (password === undefined || password === null) return false;
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  return auth.valid && auth.role === "dm";
}

// The character (slug + name) if the password is theirs (or the DM's).
async function playerFor(event, slug) {
  if (typeof slug !== "string" || !slug.trim() || isReservedCharacterSlug(slug.trim())) return null;
  const got = await db.send(new GetCommand({ TableName: TABLE, Key: { slug: slug.trim() }, ProjectionExpression: "slug, passwordHash, #n", ExpressionAttributeNames: { "#n": "name" } }));
  if (!got.Item) return null;
  return (await verifyPassword(event.headers?.["x-character-password"] ?? "", got.Item)).valid ? got.Item : null;
}

async function readDeck() {
  const item = await getSpecialRecord(PREP_DECK_SLUG);
  return { deck: normalizeDeck(item), version: currentVersion(item) };
}
async function readMessages() {
  const item = await getSpecialRecord(TABLE_MESSAGES_SLUG);
  return { state: normalizeMessages(item), version: currentVersion(item) };
}

const busy = (err) => {
  if (err instanceof VersionConflictError) return conflict("Busy — please try again");
  throw err;
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = (event.rawPath || event.path || "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }

  // PUT /prep-deck — the DM writes, edits or deletes a card
  if (parts[0] === "prep-deck" && parts.length === 1 && method === "PUT") {
    if (!(await isDm(event))) return forbidden("DM password required");
    try {
      const saved = await withVersionRetry(async () => {
        const { deck, version } = await readDeck();
        let next;
        if (body.action === "save") {
          const result = saveCard(deck, body.card, { id: crypto.randomUUID() });
          if (result.error) return { error: badRequest(result.error) };
          next = result.deck;
        } else if (body.action === "delete") {
          next = deleteCard(deck, body.id);
        } else {
          return { error: badRequest("Unknown action") };
        }
        await putSpecialRecord(PREP_DECK_SLUG, next, { expectedVersion: version });
        return { deck: next };
      });
      if (saved.error) return saved.error;
      return ok({ prepDeck: saved.deck.cards });
    } catch (err) { return busy(err); }
  }

  if (parts[0] !== "table-messages") return notFound();

  // POST /table-messages — the DM reads a moment / passes a note
  if (parts.length === 1 && method === "POST") {
    if (!(await isDm(event))) return forbidden("DM password required");
    try {
      const roster = await getPartyRosterState();
      let source = body.card || {};
      let deckAfter = null;
      if (body.cardId) {
        const { deck } = await readDeck();
        const card = deck.cards.find((c) => c.id === body.cardId);
        if (!card) return notFound("That card is gone");
        source = card;
      }
      const composed = composeMessage(source, { to: body.to, id: crypto.randomUUID(), partySlugs: roster.exists ? roster.members : [] });
      if (composed.error) return badRequest(composed.error);
      const sent = await withVersionRetry(async () => {
        const { state, version } = await readMessages();
        const next = addMessage(state, composed.message);
        await putSpecialRecord(TABLE_MESSAGES_SLUG, next, { expectedVersion: version });
        return next;
      });
      // A card from the deck moves to "used tonight".
      if (body.cardId) {
        deckAfter = await withVersionRetry(async () => {
          const { deck, version } = await readDeck();
          const next = { cards: deck.cards.map((c) => (c.id === body.cardId ? { ...c, usedAt: composed.message.sentAt } : c)) };
          await putSpecialRecord(PREP_DECK_SLUG, next, { expectedVersion: version });
          return next;
        });
      }
      try { await appendRollHistoryEvent(messageLogEvent(composed.message, body.names)); } catch { /* it was still sent */ }
      await notifySessionChanged();
      return ok({ tableMessages: projectMessages(sent, { isDm: true }), ...(deckAfter ? { prepDeck: deckAfter.cards } : {}) });
    } catch (err) { return busy(err); }
  }

  // POST /table-messages/seen | /reply — a player
  if ((parts[1] === "seen" || parts[1] === "reply") && parts.length === 2 && method === "POST") {
    const slug = typeof body.asSlug === "string" ? body.asSlug.trim() : "";
    if (!slug) return badRequest("asSlug is required");
    const player = await playerFor(event, slug);
    if (!player) return forbidden("That character's password is required");
    try {
      const saved = await withVersionRetry(async () => {
        const { state, version } = await readMessages();
        const message = state.messages.find((m) => m.id === body.id);
        const result = parts[1] === "seen" ? markSeen(message, slug) : replyTo(message, slug, body.text);
        if (result.error) return { error: conflict(result.error) };
        if (result.message === message) return { state };
        const next = { messages: state.messages.map((m) => (m.id === message.id ? result.message : m)) };
        await putSpecialRecord(TABLE_MESSAGES_SLUG, next, { expectedVersion: version });
        return { state: next, message: result.message };
      });
      if (saved.error) return saved.error;
      if (parts[1] === "reply" && saved.message) {
        try { await appendRollHistoryEvent(replyLogEvent(saved.message, slug, player.name)); } catch { /* the reply is still saved */ }
      }
      if (saved.message) await notifySessionChanged();
      return ok({ tableMessages: projectMessages(saved.state, { slug }) });
    } catch (err) { return busy(err); }
  }

  return notFound();
};
