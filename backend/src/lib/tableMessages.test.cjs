const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeDeck, saveCard, deleteCard, normalizeMessages, composeMessage, addMessage, markSeen, replyTo, projectMessages, messageLogEvent, replyLogEvent, publicMessageEvent,
} = require("./tableMessages");

const party = ["eoghan", "liu", "aesop"];

test("cards: to everyone = a moment, to players or 'choose' = a note; edits keep the id", () => {
  let { deck, card } = saveCard({ cards: [] }, { title: "The signal", text: "The Guildmaster signals…", to: "all", picture: "https://x/y.jpg" }, { id: "c1" });
  assert.deepEqual([card.kind, card.picture, card.usedAt], ["moment", "https://x/y.jpg", null]);
  ({ deck } = saveCard(deck, { title: "Not the whole truth", text: "She's hiding something.", to: "choose" }, { id: "c2" }));
  assert.equal(deck.cards[0].kind, "note");
  ({ deck } = saveCard(deck, { id: "c1", text: "Edited" }, { id: "ignored" }));
  assert.deepEqual([deck.cards.find((c) => c.id === "c1").text, deck.cards.length], ["Edited", 2]);
  assert.equal(saveCard(deck, { text: "  " }, { id: "c3" }).error, "Write something first");
  assert.equal(deleteCard(deck, "c1").cards.length, 1);
  assert.equal(normalizeDeck({ cards: [{ id: "x", text: "hi", to: "all", picture: "javascript:alert(1)" }] }).cards[0].picture, "");
});

test("any card can have a picture; a 'choose' card can go to everyone", () => {
  const card = { title: "The crest", text: "You know this crest.", to: "choose", picture: "https://x/crest.jpg" };
  const note = composeMessage(card, { to: ["liu"], id: "m1" }).message;
  assert.deepEqual([note.kind, note.picture], ["note", "https://x/crest.jpg"]);
  assert.equal(projectMessages({ messages: [note] }, { slug: "liu" })[0].picture, "https://x/crest.jpg");
  assert.equal(composeMessage(card, { to: "all", id: "m2" }).message.kind, "moment");
});

test("sending: a 'choose' card needs recipients, and only party members", () => {
  const card = { title: "Not the whole truth", text: "She's hiding something.", to: "choose" };
  assert.equal(composeMessage(card, { id: "m1", partySlugs: party }).error, "Pick who gets it");
  assert.equal(composeMessage(card, { to: ["stranger"], id: "m1", partySlugs: party }).error, "Only party members can get a note");
  const { message } = composeMessage(card, { to: ["liu"], id: "m1", partySlugs: party });
  assert.deepEqual([message.kind, message.to, message.canReply], ["note", ["liu"], true]);
});

test("players see moments, their own notes, and that others got one", () => {
  const moment = composeMessage({ title: "Dusk", text: "The inn is loud.", to: "all" }, { id: "m1" }).message;
  const note = composeMessage({ title: "The boy", text: "A boy watches you.", to: ["liu"], showPassed: true }, { id: "m2" }).message;
  const secret = composeMessage({ text: "Psst.", to: ["aesop"], showPassed: false }, { id: "m3" }).message;
  let state = addMessage(addMessage(addMessage({ messages: [] }, moment), note), secret);
  state = { messages: state.messages.map((m) => (m.id === "m2" ? replyTo(m, "liu", "I follow him").message : m)) };
  const liu = projectMessages(state, { slug: "liu" });
  assert.deepEqual(liu.map((m) => [m.id, m.text ?? null]), [["m2", "A boy watches you."], ["m1", "The inn is loud."]]);
  assert.equal(liu[0].myReply, "I follow him");
  const eoghan = projectMessages(state, { slug: "eoghan" });
  assert.deepEqual(eoghan.map((m) => [m.id, m.passed ?? false, m.text ?? null]), [["m2", true, null], ["m1", false, "The inn is loud."]]);
  assert.equal(projectMessages(state, { isDm: true }).length, 3);
});

test("seen and replies: once each, only for the recipient", () => {
  const note = composeMessage({ text: "Psst.", to: ["liu"] }, { id: "m1" }).message;
  assert.equal(markSeen(note, "eoghan").error, "That wasn't for you");
  assert.deepEqual(markSeen(note, "liu").message.seen, ["liu"]);
  const replied = replyTo(note, "liu", "  Got it, thanks  ").message;
  assert.deepEqual([replied.replies.liu.text, replied.seen], ["Got it, thanks", ["liu"]]);
  assert.equal(replyTo(replied, "liu", "again").error, "You've already replied");
  assert.equal(replyTo(composeMessage({ text: "x", to: ["liu"], canReply: false }, { id: "m2" }).message, "liu", "hi").error, "No reply needed");
});

test("the log: note words only for recipients; replies only for the DM and their writer", () => {
  const note = composeMessage({ title: "The boy", text: "A boy watches you.", to: ["liu"] }, { id: "m1" }).message;
  const event = messageLogEvent(note, { liu: "Liu Sha" });
  assert.deepEqual(event.toNames, ["Liu Sha"]);
  assert.equal(publicMessageEvent(event, "liu").text, "A boy watches you.");
  assert.deepEqual(publicMessageEvent(event, "eoghan"), { id: event.id, type: "note", to: ["liu"], toNames: ["Liu Sha"], passed: true, createdAt: event.createdAt });
  assert.equal(publicMessageEvent({ ...event, showPassed: false }, "eoghan"), null);
  const reply = replyLogEvent(replyTo(note, "liu", "On it").message, "liu", "Liu Sha");
  assert.equal(publicMessageEvent(reply, "liu").text, "On it");
  assert.equal(publicMessageEvent(reply, "eoghan"), null);
  assert.equal(publicMessageEvent(reply), null); // the Chronicle
  assert.equal(normalizeMessages({ messages: [{ id: "x", to: [], text: "hi" }] }).messages.length, 0);
});
