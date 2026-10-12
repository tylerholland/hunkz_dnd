import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createChronicleSession, getChronicle, getChronicleSession, getRollHistoryWithArchive, updateChronicleSession } from "../../api";
import {
  dayKey, endOfDay, eventMs, fmtDay, fmtTime, mergeLogSources, playersInEvents,
  sessionTakingMs, startOfDay, toLocalInput,
} from "./chronicleData";

const DAY = 86400000;

function eventText(e) {
  const { who, what } = eventTextParts(e);
  return { who, what: e.tag ? `${what} · ${e.tag}` : what };
}

function eventTextParts(e) {
  if (e.type === "effect") return { who: e.characterName || "?", what: `✦ ${e.attack?.name || e.effect} takes effect${e.target?.name ? ` ◎ ${e.target.name}` : ""}` };
  if (e.type === "wheel") return { who: "◷", what: `${e.name}${Number.isFinite(e.filledCount) ? ` ${e.filledCount}/${e.segments}` : ""}` };
  if (e.type === "hp") {
    const change = e.miss ? "missed" : e.delta < 0 ? `−${-e.delta}` : `+${e.delta}`;
    return { who: e.subject?.name || "?", what: `${change}${e.by?.name ? ` · ${e.by.name}` : ""}${e.action?.name ? `, ${e.action.name}` : ""}` };
  }
  if (e.type === "condition") return { who: e.subject?.name || "?", what: [...(e.added || []).map((c) => `+ ${c}`), ...(e.removed || []).map((c) => `− ${c}`)].join(" ") || "Exhaustion" };
  if (e.type === "turn") return { who: `Round ${e.round}`, what: `${e.subject?.name || "?"}'s turn` };
  return { who: e.characterName || "DM", what: `${e.label || "Roll"} ${e.exprLabel || ""}${e.target?.name ? ` ◎ ${e.target.name}` : ""}` };
}

export default function RecordSession({ dmPassword, editId }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [chronicle, setChronicle] = useState({ chapters: [], sessions: [] });
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const stripRef = useRef(null);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getRollHistoryWithArchive(dmPassword),
      getChronicle(),
      editId ? getChronicleSession(editId, { password: dmPassword }) : Promise.resolve(null),
    ])
      .then(([log, index, existing]) => {
        if (cancelled) return;
        const all = mergeLogSources(log.rolls, log.archived, existing?.session?.events);
        setEvents(all);
        setChronicle(index);
        const latest = all.length ? eventMs(all[all.length - 1]) : Date.now();
        if (existing?.session) {
          const s = existing.session;
          setDraft({
            start: Date.parse(s.startAt),
            end: Date.parse(s.endAt),
            excluded: new Set(s.excludedEventIds || []),
            title: s.title,
            titleTouched: true,
            chapterId: s.chapterId,
            newChapter: "",
          });
        } else {
          const n = index.sessions.length + 1;
          setDraft({
            start: startOfDay(latest),
            end: endOfDay(latest),
            excluded: new Set(),
            title: `Session ${n} · ${fmtDay(latest)}`,
            titleTouched: false,
            chapterId: index.chapters[index.chapters.length - 1]?.id || "__new",
            newChapter: index.chapters.length ? "" : "Chapter 1",
          });
        }
      })
      .catch(() => { if (!cancelled) setError("Couldn't load the activity log. Check your connection and reload."); });
    return () => { cancelled = true; };
  }, [dmPassword, editId]);

  const days = useMemo(() => {
    if (!events?.length) return [];
    const list = [];
    const last = startOfDay(Math.max(openedAt, eventMs(events[events.length - 1])));
    for (let d = startOfDay(eventMs(events[0])); d <= last; d = startOfDay(d + 1.5 * DAY)) list.push(d);
    return list;
  }, [events, openedAt]);
  const countByDay = useMemo(() => {
    const map = new Map();
    (events || []).forEach((e) => { const k = dayKey(eventMs(e)); map.set(k, (map.get(k) || 0) + 1); });
    return map;
  }, [events]);

  // Keep the selected range in view when the page opens.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !draft || !stripRef.current) return;
    const selected = stripRef.current.querySelector(".chr-bar--in");
    if (selected) { selected.scrollIntoView?.({ block: "nearest", inline: "center" }); scrolledRef.current = true; }
  }, [draft, days]);

  if (error && !events) return <p className="chr-error" role="alert">{error}</p>;
  if (!events || !draft) return <p className="chr-muted">Loading the activity log…</p>;

  const others = chronicle.sessions;
  const takenBy = (ms) => sessionTakingMs(others, ms, editId);
  const inRange = events.filter((e) => eventMs(e) >= draft.start && eventMs(e) <= draft.end);
  const included = inRange.filter((e) => !draft.excluded.has(e.id));
  const conflict = inRange.map((e) => takenBy(eventMs(e))).find(Boolean) || null;
  const players = playersInEvents(included);
  const maxCount = Math.max(1, ...countByDay.values());
  const groups = [];
  inRange.forEach((e) => {
    const k = dayKey(eventMs(e));
    if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, events: [] });
    groups[groups.length - 1].events.push(e);
  });
  const lastSessionEnd = Math.max(0, ...others.filter((s) => s.id !== editId).map((s) => Date.parse(s.endAt)));

  const update = (patch) => setDraft((d) => {
    const next = { ...d, ...patch };
    if (!next.titleTouched && (patch.start !== undefined)) next.title = `Session ${chronicle.sessions.length + 1} · ${fmtDay(next.start)}`;
    return next;
  });
  const setRange = (a, b) => update({ start: Math.min(a, b), end: Math.max(a, b) });
  const toggle = (ids, on) => setDraft((d) => {
    const excluded = new Set(d.excluded);
    ids.forEach((id) => (on ? excluded.delete(id) : excluded.add(id)));
    return { ...d, excluded };
  });

  function pickDay(day, extend) {
    if (extend) { setRange(Math.min(day, draft.start), Math.max(endOfDay(day), draft.end)); return; }
    // Snap to the day's actual activity so the times read like a session.
    const dayEvents = events.filter((e) => dayKey(eventMs(e)) === dayKey(day) && !takenBy(eventMs(e)));
    if (dayEvents.length) setRange(eventMs(dayEvents[0]), eventMs(dayEvents[dayEvents.length - 1]));
    else setRange(startOfDay(day), endOfDay(day));
  }

  async function save() {
    if (!included.length || conflict || saving) return;
    setSaving(true);
    setError("");
    const chapterFields = draft.chapterId === "__new"
      ? { newChapterName: draft.newChapter.trim() || `Chapter ${chronicle.chapters.length + 1}` }
      : { chapterId: draft.chapterId };
    const payload = {
      title: draft.title.trim(),
      startAt: new Date(draft.start).toISOString(),
      endAt: new Date(draft.end).toISOString(),
      excludedEventIds: [...draft.excluded],
      ...chapterFields,
    };
    try {
      const res = editId
        ? await updateChronicleSession(dmPassword, editId, payload)
        : await createChronicleSession(dmPassword, payload);
      navigate(`/chronicle/${res.session.id}`);
    } catch (err) {
      setError(err.message || "Couldn't save the session. Try again.");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="chr-page-head">
        <div>
          <Link className="chr-link" to={editId ? `/chronicle/${editId}` : "/chronicle"}>← {editId ? "Back to the session" : "Chronicle"}</Link>
          <h1 className="chr-h1">{editId ? "Edit session range" : "Record a session"}</h1>
          <p className="chr-lede">Pick the stretch of the activity log this session covers. Nothing is removed from the live log; the session keeps its own copy.</p>
        </div>
      </div>

      <section className="chr-panel" aria-labelledby="chr-step1">
        <span className="chr-step" id="chr-step1">1 · When was it?</span>
        <div className="chr-strip-scroll" ref={stripRef}>
          <div className="chr-strip" role="group" aria-label="Log activity by day">
            {days.map((day) => {
              const k = dayKey(day);
              const n = countByDay.get(k) || 0;
              const dayEvents = n ? events.filter((e) => dayKey(eventMs(e)) === k) : [];
              const taken = n > 0 && dayEvents.every((e) => takenBy(eventMs(e)));
              const selected = day <= draft.end && endOfDay(day) >= draft.start;
              return (
                <button
                  key={day}
                  type="button"
                  className={`chr-bar${n ? "" : " chr-bar--empty"}${selected ? " chr-bar--in" : ""}${taken ? " chr-bar--taken" : ""}`}
                  title={`${fmtDay(day)} · ${n} event${n === 1 ? "" : "s"}${taken ? " · already in a session" : ""}`}
                  aria-label={`${fmtDay(day)}, ${n} events${taken ? ", already recorded" : ""}`}
                  disabled={taken}
                  onClick={(e) => pickDay(day, e.shiftKey)}
                >
                  <i style={{ height: `${n ? Math.max(4, (n / maxCount) * 100) : 2}%` }} />
                </button>
              );
            })}
          </div>
          <div className="chr-axis-row" aria-hidden="true">
            {days.map((day, i) => {
              const month = new Date(day).toLocaleDateString(undefined, { month: "short" });
              const prev = i ? new Date(days[i - 1]).toLocaleDateString(undefined, { month: "short" }) : "";
              return <span key={day}>{month !== prev ? <b>{month}</b> : null}</span>;
            })}
          </div>
        </div>
        <div className="chr-legend">
          <span><span className="chr-swatch chr-swatch--bar" />Events that day</span>
          <span><span className="chr-swatch chr-swatch--sel" />In this session</span>
          <span><span className="chr-swatch chr-swatch--taken" />Already recorded</span>
        </div>
        <p className="chr-meta">Click a day to pick it. Shift-click another day to stretch the range across both.</p>
        <div className="chr-presets">
          <button type="button" className="chr-chip" onClick={() => setRange(startOfDay(Date.now()), Date.now())}>Today</button>
          <button type="button" className="chr-chip" onClick={() => setRange(lastSessionEnd + 1, Date.now())}>Since last session</button>
          <button type="button" className="chr-chip" onClick={() => setRange(startOfDay(Date.now() - 6 * DAY), Date.now())}>Last 7 days</button>
        </div>
        <div className="chr-times">
          <label className="chr-field">
            <span className="chr-label">Starts</span>
            <input type="datetime-local" value={toLocalInput(draft.start)} onChange={(e) => { const ms = Date.parse(e.target.value); if (Number.isFinite(ms)) setRange(ms, draft.end); }} />
          </label>
          <label className="chr-field">
            <span className="chr-label">Ends</span>
            <input type="datetime-local" value={toLocalInput(draft.end)} onChange={(e) => { const ms = Date.parse(e.target.value); if (Number.isFinite(ms)) setRange(draft.start, ms); }} />
          </label>
          <button type="button" className="chr-chip" onClick={() => setRange(draft.start, Date.now())}>Ends now</button>
        </div>
      </section>

      <section className="chr-panel" aria-labelledby="chr-step2">
        <span className="chr-step" id="chr-step2">2 · What happened?</span>
        <div className="chr-tally">
          <b>{included.length}</b> events{inRange.length !== included.length ? ` (${inRange.length - included.length} left out)` : ""}
          {" · "}<b>{players.length}</b> player{players.length === 1 ? "" : "s"}{players.length ? ` · ${players.join(", ")}` : ""}
        </div>
        {conflict && (
          <p className="chr-warn" role="alert">
            Part of this range is already in “{conflict.title}”. Sessions can&apos;t overlap: narrow the range.
          </p>
        )}
        <div className="chr-preview">
          {groups.length === 0 && <p className="chr-empty-note chr-pad">No log events in this range.</p>}
          {groups.map((g) => {
            const allOff = g.events.every((e) => draft.excluded.has(e.id));
            return (
              <div className="chr-day-group" key={g.key}>
                <label className="chr-day-head">
                  <input type="checkbox" checked={!allOff} onChange={(e) => toggle(g.events.map((ev) => ev.id), e.target.checked)} />
                  <span>{fmtDay(eventMs(g.events[0]), { weekday: "long" })}</span>
                  <span className="chr-day-count">{g.events.filter((e) => !draft.excluded.has(e.id)).length} of {g.events.length}</span>
                </label>
                {g.events.map((e) => {
                  const off = draft.excluded.has(e.id);
                  const text = eventText(e);
                  const taken = takenBy(eventMs(e));
                  return (
                    <label key={e.id} className={`chr-ev${off ? " chr-ev--off" : ""}`}>
                      <input type="checkbox" checked={!off} onChange={(ev) => toggle([e.id], ev.target.checked)} />
                      <span className="chr-ev-time">{fmtTime(eventMs(e))}</span>
                      <span className="chr-ev-what"><b>{text.who}</b> {text.what}{taken ? <span className="chr-warn"> · in “{taken.title}”</span> : null}</span>
                      <span className="chr-ev-num">{Number.isFinite(e.total) && (!e.type || e.type === "roll") ? e.total : ""}</span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="chr-panel" aria-labelledby="chr-step3">
        <span className="chr-step" id="chr-step3">3 · Name it</span>
        <div className="chr-two">
          <label className="chr-field">
            <span className="chr-label">Session title</span>
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value, titleTouched: true }))} />
          </label>
          <label className="chr-field">
            <span className="chr-label">Chapter</span>
            <select value={draft.chapterId} onChange={(e) => setDraft((d) => ({ ...d, chapterId: e.target.value }))}>
              {chronicle.chapters.map((c, i) => <option key={c.id} value={c.id}>Chapter {i + 1}: {c.name}</option>)}
              <option value="__new">Start a new chapter…</option>
            </select>
          </label>
        </div>
        {draft.chapterId === "__new" && (
          <label className="chr-field">
            <span className="chr-label">New chapter name</span>
            <input value={draft.newChapter} placeholder="The Sunken Crossroads" onChange={(e) => setDraft((d) => ({ ...d, newChapter: e.target.value }))} />
          </label>
        )}
        {error && <p className="chr-error" role="alert">{error}</p>}
        <div className="chr-actions">
          <span className="chr-spacer" />
          <Link className="chr-btn chr-btn--quiet" to={editId ? `/chronicle/${editId}` : "/chronicle"}>Cancel</Link>
          <button type="button" className="chr-btn chr-btn--primary" disabled={!included.length || !!conflict || saving} onClick={save}>
            {saving ? "Saving…" : editId ? "Save range" : "Record session"}
          </button>
        </div>
      </section>
    </>
  );
}
