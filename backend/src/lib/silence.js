// "Request silence" (design/prototypes/dm-adventure-layout.html): the DM puts a
// big "Your DM requests your attention!" over every player's screen until they
// tap "I'm listening" or the DM lifts it. One record, riding the session poll:
//   { id, startedAt, acks: [slug…] }   (a lifted request is stored as { cleared })

/** The stored record, tidied (null when there's no request). */
function normalizeSilence(record) {
  if (!record || typeof record !== "object" || typeof record.id !== "string") return null;
  return {
    id: record.id,
    startedAt: record.startedAt || null,
    acks: [...new Set((Array.isArray(record.acks) ? record.acks : []).filter((s) => typeof s === "string" && s.trim()))],
  };
}

function startSilence({ id, now = Date.now() }) {
  return { id, startedAt: new Date(now).toISOString(), acks: [] };
}

/** The request with `slug` listening (unchanged if they already were). */
function acknowledge(silence, slug) {
  if (!silence) return { error: "Nothing to acknowledge" };
  if (silence.acks.includes(slug)) return { silence };
  return { silence: { ...silence, acks: [...silence.acks, slug] } };
}

module.exports = { normalizeSilence, startSilence, acknowledge };
