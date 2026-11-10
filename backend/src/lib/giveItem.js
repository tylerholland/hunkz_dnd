// Giving an item to another party member: it comes off the giver's list (or
// part of a stack does) and goes onto the receiver's, joining a stack of the
// same item if they have one. Pure, so the handler and tests share it.
const crypto = require("crypto");

const KINDS = ["weapons", "equipment"];
const newId = () => crypto.randomUUID();

/** The inventory entry with this id: { kind, item, index }, or null. */
function findItem(character, itemId) {
  for (const kind of KINDS) {
    const list = Array.isArray(character?.[kind]) ? character[kind] : [];
    const index = list.findIndex((entry) => entry?.id === itemId);
    if (index >= 0) return { kind, item: list[index], index };
  }
  return null;
}

/**
 * Take `qty` of an entry off the giver. A stack (numeric qty) gives part of
 * itself; anything else moves whole. → { giver, moved, kind } or { error }.
 */
function takeFrom(character, itemId, qty = 1) {
  const found = findItem(character, itemId);
  if (!found) return { error: "That item isn't in your inventory" };
  const { kind, item } = found;
  const list = character[kind];
  const stacked = Number.isFinite(item.qty);
  const want = stacked ? Math.floor(Number(qty) || 1) : 1;
  if (stacked && (want < 1 || want > item.qty)) return { error: `You have ${item.qty}` };
  // Attunement is personal: it doesn't travel with the item.
  const base = { ...item, attuned: false };
  if (stacked && want < item.qty) {
    return {
      kind,
      moved: { ...base, id: newId(), qty: want },
      giver: { ...character, [kind]: list.map((entry) => (entry.id === itemId ? { ...entry, qty: entry.qty - want } : entry)) },
    };
  }
  return { kind, moved: { ...base, id: newId(), ...(stacked ? { qty: want } : {}) }, giver: { ...character, [kind]: list.filter((entry) => entry.id !== itemId) } };
}

// Two entries are the same thing when they share an item type (shop itemId)
// and name, or — without an itemId — the same name.
const sameThing = (a, b) => (a.itemId || b.itemId ? a.itemId === b.itemId : true)
  && String(a.name || "").trim().toLowerCase() === String(b.name || "").trim().toLowerCase();

/** Put the moved item onto the receiver's list, joining a matching stack. */
function giveTo(character, moved, kind) {
  const list = Array.isArray(character?.[kind]) ? character[kind] : [];
  if (Number.isFinite(moved.qty)) {
    const stack = list.find((entry) => Number.isFinite(entry?.qty) && sameThing(entry, moved));
    if (stack) return { ...character, [kind]: list.map((entry) => (entry === stack ? { ...entry, qty: entry.qty + moved.qty } : entry)) };
  }
  return { ...character, [kind]: [...list, moved] };
}

/** The session-log event: "Eòghan gave Liu Sha a Potion of Healing". */
function giveLogEvent(giver, receiver, moved) {
  return {
    id: `give-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "give",
    from: { slug: giver.slug, name: giver.name || giver.slug },
    to: { slug: receiver.slug, name: receiver.name || receiver.slug },
    item: moved.name || "an item",
    qty: Number.isFinite(moved.qty) ? moved.qty : 1,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { findItem, takeFrom, giveTo, giveLogEvent };
