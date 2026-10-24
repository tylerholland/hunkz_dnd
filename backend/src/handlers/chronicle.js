// Story 69 — Session Chronicle API. One function behind /chronicle and
// /chronicle/{proxy+}:
//   GET    /chronicle                                   index (anyone)
//   PUT    /chronicle/chapters                          { chapters } (DM)
//   PUT    /chronicle/next-session                      { at | null, asSlug? } (DM or a player)
//   POST   /chronicle/sessions                          record a session (DM)
//   GET    /chronicle/sessions/:id                      session (anyone; NPC HP totals hidden unless DM)
//   PUT    /chronicle/sessions/:id                      title / chapter / range (DM)
//   DELETE /chronicle/sessions/:id                      (DM) — the live log is untouched
//   PUT    /chronicle/sessions/:id/summary              { text, baseUpdatedAt, asSlug? } (DM or a player)
//   POST   /chronicle/sessions/:id/recollections        { text, asSlug } (a player)
//   PUT    /chronicle/sessions/:id/recollections/:rid   { text } (author) | { hidden } (DM)
const { GetCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, created, notFound, forbidden, badRequest, conflict } = require("../lib/response");
const { getSpecialRecord, putSpecialRecord, getRollHistoryState, getRollHistoryArchive, getNpcCombatState, getNpcLibraryState } = require("../lib/specialRecords");
const { withVersionRetry, currentVersion } = require("../lib/versioning");
const { CHRONICLE_SLUG, CHRONICLE_SESSION_PREFIX, isReservedCharacterSlug } = require("../lib/specialItems");
const {
  MAX_TITLE, MAX_CHAPTER, MAX_SUMMARY, MAX_RECOLLECTION,
  clip, newId, normalizeChronicle, normalizeSessionRecord, gatherSessionEvents, creatureKey, foesFromEvents,
  playersFromEvents, excerpt, rangesOverlap, publicSessionEvents, snapshotTooLarge,
} = require("../lib/chronicle");

const sessionSlug = (id) => `${CHRONICLE_SESSION_PREFIX}${id}`;

async function whoIs(event, asSlug) {
  const password = event.headers?.["x-character-password"];
  if (password === undefined || password === null) return { role: "anon" };
  const dm = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (dm.valid && dm.role === "dm") return { role: "dm" };
  if (typeof asSlug !== "string" || !asSlug || isReservedCharacterSlug(asSlug)) return { role: "anon" };
  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { slug: asSlug } }));
  const character = result.Item;
  if (!character || !character.passwordHash) return { role: "anon" };
  const auth = await verifyPassword(password, character);
  if (!auth.valid) return { role: "anon" };
  return { role: "player", slug: asSlug, name: character.name || character.nameAlt || asSlug, palette: character.palette || null };
}

async function readIndex() {
  const item = await getSpecialRecord(CHRONICLE_SLUG);
  return { ...normalizeChronicle(item), version: currentVersion(item) };
}

async function writeIndex(index, version) {
  return putSpecialRecord(CHRONICLE_SLUG, { chapters: index.chapters, sessions: index.sessions, nextSession: index.nextSession ?? null }, { expectedVersion: version });
}

// Portraits for the creatures a session damaged: the NPCs in play (by id),
// then the NPC library (by name). Best effort — a session saves without them.
async function creaturePortraits() {
  const [combat, library] = await Promise.all([getNpcCombatState().catch(() => ({ npcs: [] })), getNpcLibraryState().catch(() => ({ templates: [] }))]);
  const byId = new Map();
  const byName = new Map();
  for (const t of library.templates || []) if (t.portraitUrl && t.name) byName.set(creatureKey(t.name), t.portraitUrl);
  for (const npc of combat.npcs || []) {
    if (!npc?.portraitUrl) continue;
    if (npc.id) byId.set(npc.id, npc.portraitUrl);
    if (npc.name && !byName.has(creatureKey(npc.name))) byName.set(creatureKey(npc.name), npc.portraitUrl);
  }
  return { byId, byName };
}

// Sessions recorded before foes existed get them filled in once, from their
// saved events, the first time the index is read.
async function backfillFoes(index) {
  const missing = index.sessions.filter((s) => !Array.isArray(s.foes));
  if (!missing.length) return index;
  const [portraits, records] = await Promise.all([creaturePortraits(), Promise.all(missing.map((s) => readSession(s.id)))]);
  const foesById = new Map(missing.map((s, i) => [s.id, foesFromEvents(records[i]?.events || [], portraits)]));
  const sessions = index.sessions.map((s) => (foesById.has(s.id) ? { ...s, foes: foesById.get(s.id) } : s));
  try {
    await writeIndex({ ...index, sessions }, index.version);
  } catch {
    // Lost a race with another write — serve the filled-in copy; the next read retries.
  }
  return { ...index, sessions };
}

async function readSession(id) {
  const item = await getSpecialRecord(sessionSlug(id));
  return item ? { ...normalizeSessionRecord(item), version: currentVersion(item) } : null;
}

// Read-modify-write a session record, then refresh its row in the index.
async function updateSession(id, mutate) {
  const saved = await withVersionRetry(async () => {
    const current = await readSession(id);
    if (!current) return null;
    const next = mutate(current);
    if (next?.error) return next;
    const { version, ...record } = next;
    await putSpecialRecord(sessionSlug(id), record, { expectedVersion: current.version });
    return next;
  });
  if (!saved || saved.error) return saved;
  await withVersionRetry(async () => {
    const index = await readIndex();
    const sessions = index.sessions.map((meta) => (meta.id === id
      ? { ...meta, summaryExcerpt: excerpt(saved.summary?.text), recollectionCount: saved.recollections.filter((r) => !r.hidden).length }
      : meta));
    await writeIndex({ ...index, sessions }, index.version);
  });
  return saved;
}

async function allLogSources() {
  const [live, archived] = await Promise.all([getRollHistoryState(), getRollHistoryArchive()]);
  return [live.rolls || [], archived];
}

function parseRange(body) {
  const startMs = Date.parse(body.startAt || "");
  const endMs = Date.parse(body.endAt || "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return { startMs, endMs };
}

// Chapter from { chapterId } or { newChapterName }; returns [chapters, chapterId].
function resolveChapter(index, body, fallbackId) {
  const name = clip(body.newChapterName, MAX_CHAPTER);
  if (name) {
    const chapter = { id: newId("ch-"), name };
    return [[...index.chapters, chapter], chapter.id];
  }
  const wanted = body.chapterId ?? fallbackId;
  if (wanted && index.chapters.some((c) => c.id === wanted)) return [index.chapters, wanted];
  if (index.chapters.length) return [index.chapters, index.chapters[index.chapters.length - 1].id];
  const first = { id: newId("ch-"), name: "Chapter 1" };
  return [[first], first.id];
}

function buildSnapshot({ sources, range, excluded, otherSessions }) {
  const { inRange, included } = gatherSessionEvents(sources, { ...range, excluded });
  if (!included.length) return { error: badRequest("There are no log events in that range.") };
  const startAt = included[0].createdAt;
  const endAt = included[included.length - 1].createdAt;
  const clash = otherSessions.find((meta) => rangesOverlap({ startAt, endAt }, meta));
  if (clash) return { error: conflict(`Part of that range is already in "${clash.title}". Sessions can't overlap.`) };
  const inRangeIds = new Set(inRange.map((e) => e.id));
  return {
    events: included,
    excludedEventIds: [...new Set(excluded)].filter((id) => inRangeIds.has(id)),
    startAt,
    endAt,
  };
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = (event.rawPath || event.path || "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean); // ["chronicle", ...]
  if (parts[0] !== "chronicle") return notFound();
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }

  // GET /chronicle
  if (parts.length === 1 && method === "GET") {
    const { chapters, sessions, nextSession } = await backfillFoes(await readIndex());
    return ok({ chapters, sessions, nextSession });
  }

  // PUT /chronicle/next-session — anyone at the table can set the date
  if (parts[1] === "next-session" && parts.length === 2 && method === "PUT") {
    const viewer = await whoIs(event, body.asSlug);
    if (viewer.role !== "dm" && viewer.role !== "player") return forbidden("Sign in as your character (or the DM) to schedule the next session");
    let nextSession = null;
    if (body.at !== null && body.at !== undefined && body.at !== "") {
      const ms = Date.parse(body.at);
      if (!Number.isFinite(ms)) return badRequest("at must be a valid time");
      const now = new Date().toISOString();
      nextSession = {
        at: new Date(ms).toISOString(),
        setBy: viewer.role === "dm" ? { role: "dm", name: "DM" } : { role: "player", slug: viewer.slug, name: viewer.name },
        updatedAt: now,
      };
    }
    await withVersionRetry(async () => {
      const index = await readIndex();
      await writeIndex({ ...index, nextSession }, index.version);
    });
    return ok({ nextSession });
  }

  // PUT /chronicle/chapters
  if (parts[1] === "chapters" && parts.length === 2 && method === "PUT") {
    if ((await whoIs(event)).role !== "dm") return forbidden("DM password required");
    if (!Array.isArray(body.chapters)) return badRequest("chapters must be an array");
    const result = await withVersionRetry(async () => {
      const index = await readIndex();
      const byId = new Map(index.chapters.map((c) => [c.id, c]));
      const chapters = body.chapters
        .filter((c) => c && (byId.has(c.id) || !c.id))
        .map((c) => ({ id: c.id || newId("ch-"), name: clip(c.name, MAX_CHAPTER) || byId.get(c.id)?.name || "Untitled chapter" }));
      // A chapter that still holds sessions can't be dropped.
      for (const kept of index.chapters) {
        if (!chapters.some((c) => c.id === kept.id) && index.sessions.some((s) => s.chapterId === kept.id)) chapters.push(kept);
      }
      await writeIndex({ ...index, chapters }, index.version);
      return chapters;
    });
    return ok({ chapters: result });
  }

  if (parts[1] !== "sessions") return notFound();
  const sessionId = parts[2];

  // POST /chronicle/sessions
  if (!sessionId && method === "POST") {
    if ((await whoIs(event)).role !== "dm") return forbidden("DM password required");
    const range = parseRange(body);
    if (!range) return badRequest("startAt and endAt must be valid times, start first");
    const [sources, portraits] = await Promise.all([allLogSources(), creaturePortraits()]);
    const id = newId("s-");
    const outcome = await withVersionRetry(async () => {
      const index = await readIndex();
      const snap = buildSnapshot({ sources, range, excluded: Array.isArray(body.excludedEventIds) ? body.excludedEventIds : [], otherSessions: index.sessions });
      if (snap.error) return snap;
      const record = { id, events: snap.events, excludedEventIds: snap.excludedEventIds, summary: null, recollections: [] };
      if (snapshotTooLarge(record)) return { error: badRequest(`That range holds ${snap.events.length} events — too many for one session. Narrow it or record it as two sessions.`) };
      const [chapters, chapterId] = resolveChapter(index, body);
      const meta = {
        id,
        chapterId,
        title: clip(body.title, MAX_TITLE) || `Session ${index.sessions.length + 1}`,
        startAt: snap.startAt,
        endAt: snap.endAt,
        eventCount: snap.events.length,
        players: playersFromEvents(snap.events),
        foes: foesFromEvents(snap.events, portraits),
        summaryExcerpt: "",
        recollectionCount: 0,
        createdAt: new Date().toISOString(),
      };
      // Session record first: if the index write then loses a race and
      // retries, re-putting the same record is harmless.
      await putSpecialRecord(sessionSlug(id), record);
      await writeIndex({ ...index, chapters, sessions: [...index.sessions, meta] }, index.version);
      return { meta };
    });
    if (outcome.error) return outcome.error;
    return created({ session: outcome.meta });
  }

  if (!sessionId) return notFound();

  // GET /chronicle/sessions/:id
  if (parts.length === 3 && method === "GET") {
    const [index, record] = await Promise.all([readIndex(), readSession(sessionId)]);
    const meta = index.sessions.find((s) => s.id === sessionId);
    if (!meta || !record) return notFound("Session not found");
    const viewer = await whoIs(event, event.queryStringParameters?.asSlug);
    const isDm = viewer.role === "dm";
    return ok({
      session: {
        ...meta,
        events: isDm ? record.events : publicSessionEvents(record.events),
        excludedEventIds: isDm ? record.excludedEventIds : [],
        summary: record.summary,
        recollections: record.recollections.filter((r) => !r.hidden || isDm || (viewer.role === "player" && r.authorSlug === viewer.slug)),
      },
      chapters: index.chapters,
    });
  }

  // PUT /chronicle/sessions/:id — title / chapter / range (DM)
  if (parts.length === 3 && method === "PUT") {
    if ((await whoIs(event)).role !== "dm") return forbidden("DM password required");
    const rangeChange = body.startAt !== undefined || body.endAt !== undefined || body.excludedEventIds !== undefined;
    const [sources, portraits] = rangeChange ? await Promise.all([allLogSources(), creaturePortraits()]) : [null, null];
    const outcome = await withVersionRetry(async () => {
      const index = await readIndex();
      const meta = index.sessions.find((s) => s.id === sessionId);
      const record = await readSession(sessionId);
      if (!meta || !record) return { error: notFound("Session not found") };
      let nextMeta = { ...meta };
      let chapters = index.chapters;
      if (body.title !== undefined) nextMeta.title = clip(body.title, MAX_TITLE) || meta.title;
      if (body.chapterId !== undefined || body.newChapterName !== undefined) {
        [chapters, nextMeta.chapterId] = resolveChapter(index, body, meta.chapterId);
      }
      if (rangeChange) {
        const range = parseRange({ startAt: body.startAt ?? meta.startAt, endAt: body.endAt ?? meta.endAt });
        if (!range) return { error: badRequest("startAt and endAt must be valid times, start first") };
        // The session's own snapshot counts as a source: events it holds may
        // have aged out of the log's archive since it was recorded.
        const snap = buildSnapshot({
          sources: [record.events, ...sources],
          range,
          excluded: Array.isArray(body.excludedEventIds) ? body.excludedEventIds : record.excludedEventIds,
          otherSessions: index.sessions.filter((s) => s.id !== sessionId),
        });
        if (snap.error) return snap;
        const nextRecord = { ...record, events: snap.events, excludedEventIds: snap.excludedEventIds };
        const { version, ...toSave } = nextRecord;
        if (snapshotTooLarge(toSave)) return { error: badRequest(`That range holds ${snap.events.length} events — too many for one session. Narrow it.`) };
        await putSpecialRecord(sessionSlug(sessionId), toSave, { expectedVersion: version });
        nextMeta = { ...nextMeta, startAt: snap.startAt, endAt: snap.endAt, eventCount: snap.events.length, players: playersFromEvents(snap.events), foes: foesFromEvents(snap.events, portraits) };
      }
      await writeIndex({ ...index, chapters, sessions: index.sessions.map((s) => (s.id === sessionId ? nextMeta : s)) }, index.version);
      return { meta: nextMeta, chapters };
    });
    if (outcome.error) return outcome.error;
    return ok({ session: outcome.meta, chapters: outcome.chapters });
  }

  // DELETE /chronicle/sessions/:id
  if (parts.length === 3 && method === "DELETE") {
    if ((await whoIs(event)).role !== "dm") return forbidden("DM password required");
    await withVersionRetry(async () => {
      const index = await readIndex();
      await writeIndex({ ...index, sessions: index.sessions.filter((s) => s.id !== sessionId) }, index.version);
    });
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { slug: sessionSlug(sessionId) } }));
    return ok({ success: true });
  }

  // PUT /chronicle/sessions/:id/summary — anyone at the table can edit
  if (parts[3] === "summary" && parts.length === 4 && method === "PUT") {
    const viewer = await whoIs(event, body.asSlug);
    if (viewer.role !== "dm" && viewer.role !== "player") return forbidden("Sign in as your character (or the DM) to edit the summary");
    const text = typeof body.text === "string" ? body.text.slice(0, MAX_SUMMARY).trim() : null;
    if (text === null) return badRequest("text is required");
    const saved = await updateSession(sessionId, (current) => {
      const base = body.baseUpdatedAt ?? null;
      if ((current.summary?.updatedAt ?? null) !== base) {
        return { error: { statusCode: 409, body: JSON.stringify({ error: "Someone else edited this summary while you were writing. Their version is shown; copy your text before saving again.", summary: current.summary }) } };
      }
      return {
        ...current,
        summary: text ? { text, updatedAt: new Date().toISOString(), updatedBy: viewer.role === "dm" ? { role: "dm", name: "DM" } : { role: "player", slug: viewer.slug, name: viewer.name } } : null,
      };
    });
    if (!saved) return notFound("Session not found");
    if (saved.error) return saved.error;
    return ok({ summary: saved.summary });
  }

  // POST /chronicle/sessions/:id/recollections
  if (parts[3] === "recollections" && parts.length === 4 && method === "POST") {
    const viewer = await whoIs(event, body.asSlug);
    if (viewer.role !== "player") return forbidden("Sign in as your character to add a recollection");
    const text = clip(body.text, MAX_RECOLLECTION);
    if (!text) return badRequest("text is required");
    const now = new Date().toISOString();
    const recollection = { id: newId("r-"), authorSlug: viewer.slug, authorName: viewer.name, palette: viewer.palette, text, createdAt: now, updatedAt: now, hidden: false };
    const saved = await updateSession(sessionId, (current) => ({ ...current, recollections: [...current.recollections, recollection] }));
    if (!saved) return notFound("Session not found");
    return created({ recollection });
  }

  // PUT /chronicle/sessions/:id/recollections/:rid
  if (parts[3] === "recollections" && parts.length === 5 && method === "PUT") {
    const viewer = await whoIs(event, body.asSlug);
    if (viewer.role !== "dm" && viewer.role !== "player") return forbidden();
    const rid = parts[4];
    const saved = await updateSession(sessionId, (current) => {
      const target = current.recollections.find((r) => r.id === rid);
      if (!target) return { error: notFound("Recollection not found") };
      const isAuthor = viewer.role === "player" && target.authorSlug === viewer.slug;
      const next = { ...target };
      if (body.text !== undefined) {
        if (!isAuthor) return { error: forbidden("Only the author can edit a recollection") };
        const text = clip(body.text, MAX_RECOLLECTION);
        if (!text) return { error: badRequest("text is required") };
        next.text = text;
        next.updatedAt = new Date().toISOString();
      }
      if (body.hidden !== undefined) {
        if (viewer.role !== "dm") return { error: forbidden("Only the DM can hide a recollection") };
        next.hidden = !!body.hidden;
      }
      return { ...current, recollections: current.recollections.map((r) => (r.id === rid ? next : r)) };
    });
    if (!saved) return notFound("Session not found");
    if (saved.error) return saved.error;
    return ok({ recollection: saved.recollections.find((r) => r.id === rid) });
  }

  return notFound();
};
