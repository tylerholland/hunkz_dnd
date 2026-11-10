// The DM's prep deck and what's been sent from it
// (design/prototypes/dm-adventure-layout.html). Two records:
//   prep-deck (DM only):   { cards: [ { id, kind, title, text, picture, to, canReply, showPassed, usedAt, createdAt } ] }
//   table-messages:        { messages: [ { id, kind, title, text, picture, to, canReply, showPassed, sentAt, seen[], replies{} } ] }
// A card or message sent to everyone (`to: "all"`) is a MOMENT: read-aloud text
// (and a picture) that pops up for every player and goes in the log. Sent to
// players (`to: [slug…]`) it's a NOTE: only they see it; they can reply once or
// tap "Got it"; the others see that a note was passed (`showPassed`). A card
// can be `to: "choose"`: the DM picks who when sending.
const MAX_CARDS = 80;
const MAX_MESSAGES = 30;

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const slugs = (v) => [...new Set((Array.isArray(v) ? v : []).filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()))];
const pictureOf = (v) => (typeof v === "string" && /^https:\/\/\S+$/.test(v.trim()) ? v.trim().slice(0, 500) : "");

function normalizeTo(to) {
  if (to === "all" || to === "choose") return to;
  const list = slugs(to);
  return list.length ? list : "choose";
}

/** A card as stored, or null. Its kind follows who it's for. */
function normalizeCard(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  const to = normalizeTo(raw.to);
  const kind = to === "all" ? "moment" : "note";
  return {
    id: raw.id,
    kind,
    title: clip(raw.title, 80),
    text: clip(raw.text, 2000),
    picture: kind === "moment" ? pictureOf(raw.picture) : "",
    to,
    canReply: raw.canReply !== false,
    showPassed: raw.showPassed !== false,
    usedAt: raw.usedAt || null,
    createdAt: raw.createdAt || null,
  };
}

function normalizeDeck(record) {
  return { cards: (Array.isArray(record?.cards) ? record.cards : []).map(normalizeCard).filter(Boolean) };
}

/** The deck with a card added (no id yet) or updated, or { error }. */
function saveCard(deck, fields, { id, now = Date.now() } = {}) {
  const existing = fields?.id ? deck.cards.find((c) => c.id === fields.id) : null;
  if (fields?.id && !existing) return { error: "That card is gone" };
  const card = normalizeCard({ ...(existing || {}), ...fields, id: existing ? existing.id : id, createdAt: existing?.createdAt || new Date(now).toISOString(), usedAt: existing ? (fields.usedAt === null ? null : existing.usedAt) : null });
  if (!card.text) return { error: "Write something first" };
  if (!existing && deck.cards.length >= MAX_CARDS) return { error: "The deck is full. Delete some used cards." };
  const cards = existing ? deck.cards.map((c) => (c.id === card.id ? card : c)) : [card, ...deck.cards];
  return { deck: { cards }, card };
}

function deleteCard(deck, id) {
  return { cards: deck.cards.filter((c) => c.id !== id) };
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  const to = raw.to === "all" ? "all" : slugs(raw.to);
  if (to !== "all" && !to.length) return null;
  const replies = {};
  for (const [slug, r] of Object.entries(raw.replies || {})) {
    if (to !== "all" && to.includes(slug) && typeof r?.text === "string") replies[slug] = { text: clip(r.text, 280), at: r.at || null };
  }
  return {
    id: raw.id,
    kind: to === "all" ? "moment" : "note",
    title: clip(raw.title, 80),
    text: clip(raw.text, 2000),
    picture: to === "all" ? pictureOf(raw.picture) : "",
    to,
    canReply: to !== "all" && raw.canReply !== false,
    showPassed: raw.showPassed !== false,
    sentAt: raw.sentAt || null,
    seen: slugs(raw.seen),
    replies,
  };
}

function normalizeMessages(record) {
  return { messages: (Array.isArray(record?.messages) ? record.messages : []).map(normalizeMessage).filter(Boolean) };
}

/**
 * A new message from a card (or the DM's ad hoc fields), or { error }. `to`
 * overrides the card's recipients ("choose" cards need it). Only party
 * members can get a note.
 */
function composeMessage(source, { to, id, now = Date.now(), partySlugs = [] } = {}) {
  const card = normalizeCard({ ...source, id: source?.id || "draft" });
  if (!card?.text) return { error: "Write something first" };
  const recipients = to !== undefined ? normalizeTo(to) : card.to;
  if (recipients === "choose") return { error: "Pick who gets it" };
  if (recipients !== "all" && partySlugs.length && recipients.some((s) => !partySlugs.includes(s))) return { error: "Only party members can get a note" };
  return {
    message: normalizeMessage({ ...card, id, to: recipients, sentAt: new Date(now).toISOString(), seen: [], replies: {} }),
  };
}

/** The messages with one added at the front (oldest dropped past the cap). */
function addMessage(state, message) {
  return { messages: [message, ...state.messages].slice(0, MAX_MESSAGES) };
}

const isFor = (message, slug) => message.to === "all" || message.to.includes(slug);

/** `slug` has seen the moment / tapped "Got it" on the note. */
function markSeen(message, slug) {
  if (!message) return { error: "That's gone" };
  if (!isFor(message, slug)) return { error: "That wasn't for you" };
  if (message.seen.includes(slug)) return { message };
  return { message: { ...message, seen: [...message.seen, slug] } };
}

/** `slug`'s one reply to a note (it also counts as seen). */
function replyTo(message, slug, text, { now = Date.now() } = {}) {
  if (!message || message.kind !== "note") return { error: "That's gone" };
  if (!message.to.includes(slug)) return { error: "That wasn't for you" };
  if (!message.canReply) return { error: "No reply needed" };
  if (message.replies[slug]) return { error: "You've already replied" };
  const reply = clip(text, 280);
  if (!reply) return { error: "Write a reply" };
  return {
    message: {
      ...message,
      seen: message.seen.includes(slug) ? message.seen : [...message.seen, slug],
      replies: { ...message.replies, [slug]: { text: reply, at: new Date(now).toISOString() } },
    },
  };
}

/** What a poll returns. The DM gets everything. A player gets every moment,
 * the notes sent to them (with only their own reply), and — when the DM
 * allowed it — that a note went to someone else, without what it says. */
function projectMessages(state, { isDm = false, slug = null } = {}) {
  if (isDm) return state.messages;
  return state.messages.flatMap((m) => {
    if (m.kind === "moment") return [{ id: m.id, kind: m.kind, title: m.title, text: m.text, picture: m.picture, sentAt: m.sentAt, seenByMe: !!slug && m.seen.includes(slug) }];
    if (slug && m.to.includes(slug)) {
      return [{ id: m.id, kind: m.kind, title: m.title, text: m.text, to: m.to, canReply: m.canReply, sentAt: m.sentAt, seenByMe: m.seen.includes(slug), myReply: m.replies[slug]?.text || null }];
    }
    return m.showPassed ? [{ id: m.id, kind: m.kind, passed: true, to: m.to, sentAt: m.sentAt }] : [];
  });
}

/** Session-log events: a moment read, a note passed, a reply. `names` maps
 * slug → display name, so the log can say who a note went to. */
function messageLogEvent(message, names = {}) {
  const base = { id: `msg-${message.id}`, createdAt: message.sentAt || new Date().toISOString() };
  if (message.kind === "moment") return { ...base, type: "moment", title: message.title, text: message.text, picture: message.picture };
  return { ...base, type: "note", title: message.title, text: message.text, to: message.to, toNames: message.to.map((s) => clip(names?.[s], 40) || s), showPassed: message.showPassed };
}

function replyLogEvent(message, slug, name) {
  return { id: `reply-${message.id}-${slug}`, type: "note-reply", noteId: message.id, slug, name: clip(name, 40) || slug, title: message.title, text: message.replies[slug]?.text || "", createdAt: new Date().toISOString() };
}

/** A log event as a player (`slug`, or nobody for the Chronicle) may see it:
 * a note's words only for its recipients; otherwise "the DM passed X a note"
 * if allowed. Replies stay with the DM (and the player who wrote one). */
function publicMessageEvent(event, slug = null) {
  if (event?.type === "note") {
    if (slug && Array.isArray(event.to) && event.to.includes(slug)) return event;
    return event.showPassed ? { id: event.id, type: "note", to: event.to, toNames: event.toNames, passed: true, createdAt: event.createdAt } : null;
  }
  if (event?.type === "note-reply") return slug && event.slug === slug ? event : null;
  return event;
}

module.exports = {
  MAX_CARDS, MAX_MESSAGES,
  normalizeDeck, saveCard, deleteCard,
  normalizeMessages, composeMessage, addMessage, markSeen, replyTo, projectMessages,
  messageLogEvent, replyLogEvent, publicMessageEvent,
};
