import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getChronicle, putChronicleChapters } from "../../api";
import { fmtDay, fmtTime, dayKey, playerColor } from "./chronicleData";

function SessionCard({ session }) {
  const start = Date.parse(session.startAt);
  const end = Date.parse(session.endAt);
  const d = new Date(start);
  const multiDay = dayKey(start) !== dayKey(end);
  return (
    <Link className="chr-card" to={`/chronicle/${session.id}`}>
      <span className="chr-date">
        <span className="chr-date-dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span className="chr-date-day">{d.getDate()}</span>
        <span className="chr-date-mon">{d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
      </span>
      <span className="chr-card-body">
        <span className="chr-card-title">{session.title}</span>
        <span className="chr-meta">
          {multiDay ? `${fmtDay(start)} – ${fmtDay(end)}` : `${fmtTime(start)} – ${fmtTime(end)}`}
          {" · "}{session.eventCount} events · {session.recollectionCount || 0} recollection{session.recollectionCount === 1 ? "" : "s"}
        </span>
        <span className={`chr-excerpt${session.summaryExcerpt ? "" : " chr-excerpt--empty"}`}>
          {session.summaryExcerpt || "No summary yet."}
        </span>
        {session.players?.length > 0 && (
          <span className="chr-who-row">
            {session.players.map((p) => (
              <span key={p.slug} className="chr-who"><span className="chr-dot" style={{ background: playerColor(p.palette) }} />{p.name}</span>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}

function ChapterName({ chapter, editable, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(chapter.name);
  if (!editing) {
    return (
      <>
        <h2 className="chr-chapter-name">{chapter.name}</h2>
        {editable && <button type="button" className="chr-link" onClick={() => { setValue(chapter.name); setEditing(true); }}>Rename</button>}
      </>
    );
  }
  const done = (save) => {
    setEditing(false);
    if (save && value.trim() && value.trim() !== chapter.name) onRename(value.trim());
  };
  return (
    <input
      className="chr-inline-input chr-chapter-input"
      aria-label="Chapter name"
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); }}
      onBlur={() => done(true)}
    />
  );
}

export default function ChronicleList({ isDm, dmPassword }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getChronicle()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError("Couldn't load the Chronicle. Check your connection and reload."); });
    return () => { cancelled = true; };
  }, []);

  async function renameChapter(id, name) {
    const previous = data;
    const chapters = data.chapters.map((c) => (c.id === id ? { ...c, name } : c));
    setData({ ...data, chapters });
    try {
      const res = await putChronicleChapters(dmPassword, chapters);
      setData((d) => ({ ...d, chapters: res.chapters }));
    } catch {
      setData(previous);
      setError("Couldn't rename the chapter. Try again.");
    }
  }

  const chapters = (data?.chapters || []).map((c, i) => ({
    ...c,
    number: i + 1,
    sessions: (data?.sessions || []).filter((s) => s.chapterId === c.id).sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt)),
  })).reverse();

  return (
    <>
      <div className="chr-page-head">
        <div>
          <h1 className="chr-h1">Chronicle</h1>
          <p className="chr-lede">The adventure so far, session by session. Anyone at the table can add to a session&apos;s story.</p>
        </div>
        {isDm && <Link className="chr-btn chr-btn--primary" to="/chronicle/record">+ Record a session</Link>}
      </div>
      {error && <p className="chr-error" role="alert">{error}</p>}
      {!data && !error && <p className="chr-muted">Loading…</p>}
      {data && chapters.length === 0 && (
        <p className="chr-empty-note">
          No sessions recorded yet.{isDm ? " Use Record a session to tag a night from the activity log." : " The DM records each session after it's played."}
        </p>
      )}
      {chapters.map((chapter) => (
        <section key={chapter.id} className="chr-chapter" aria-label={`Chapter ${chapter.number}`}>
          <div className="chr-chapter-head">
            <span className="chr-chapter-num">Chapter {chapter.number}</span>
            <ChapterName chapter={chapter} editable={isDm} onRename={(name) => renameChapter(chapter.id, name)} />
          </div>
          <div className="chr-sessions">
            {chapter.sessions.length
              ? chapter.sessions.map((s) => <SessionCard key={s.id} session={s} />)
              : <p className="chr-empty-note">No sessions in this chapter yet.</p>}
          </div>
        </section>
      ))}
    </>
  );
}
