import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addChronicleRecollection, deleteChronicleSession, getChronicleSession,
  putChronicleSummary, updateChronicleRecollection, updateChronicleSession,
} from "../../api";
import { RollHistoryRow } from "../../components/RollHistoryList";
import { buildHighlights, buildTimeline, dayKey, eventMs, fmtDay, fmtTime, peopleIndex, playerColor, timeAgo } from "./chronicleData";
import NightAtAGlance from "./NightAtAGlance";

function Summary({ session, creds, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [base, setBase] = useState(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const summary = session.summary;
  const paragraphs = (summary?.text || "").split(/\n\s*\n/).filter(Boolean);

  function start() {
    setDraft(summary?.text || "");
    setBase(summary?.updatedAt ?? null);
    setStatus("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await putChronicleSummary(creds, session.id, { text: draft, baseUpdatedAt: base });
      onSaved(res.summary);
      setEditing(false);
    } catch (err) {
      if (err.status === 409) {
        // Someone else saved first: show theirs, keep this draft to merge by hand.
        onSaved(err.data?.summary ?? null);
        setBase(err.data?.summary?.updatedAt ?? null);
        setStatus(err.message);
      } else {
        setStatus(err.message || "Couldn't save the summary. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="chr-section" aria-labelledby="chr-sum-h">
      <div className="chr-section-head">
        <h2 id="chr-sum-h">Summary</h2>
        <span className="chr-spacer" />
        {creds && !editing && <button type="button" className="chr-link" onClick={start}>{summary?.text ? "Edit" : "Add summary"}</button>}
      </div>
      {editing ? (
        <div className="chr-editor">
          {status && <p className="chr-warn" role="alert">{status}</p>}
          {status && summary?.text && (
            <div className="chr-theirs">
              <span className="chr-label">Their version</span>
              {summary.text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
          <label className="chr-field">
            <span className="chr-label">Summary · everyone at the table can edit</span>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} />
          </label>
          <div className="chr-actions">
            <span className="chr-meta">Paste a transcript summary or write your own. A blank line starts a new paragraph.</span>
            <span className="chr-spacer" />
            <button type="button" className="chr-btn chr-btn--quiet" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="chr-btn chr-btn--primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      ) : (
        <div className="chr-summary">
          {paragraphs.length
            ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
            : <p className="chr-empty-note">No summary yet.{creds ? " Paste one in: a transcript summary, the DM's notes, anyone's account of the night." : ""}</p>}
          {summary?.updatedAt && <span className="chr-meta">Last edited by {summary.updatedBy?.name || "someone"} · {timeAgo(summary.updatedAt)}</span>}
        </div>
      )}
    </section>
  );
}

function Recollection({ rec, canEdit, isDm, onEdit, onToggleHidden }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rec.text);
  const color = playerColor(rec.palette);
  if (editing) {
    return (
      <div className="chr-rec" style={{ "--chr-rec-color": color }}>
        <label className="chr-field">
          <span className="chr-label">Edit your recollection</span>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
        </label>
        <div className="chr-actions">
          <span className="chr-spacer" />
          <button type="button" className="chr-btn chr-btn--quiet" onClick={() => setEditing(false)}>Cancel</button>
          <button type="button" className="chr-btn chr-btn--primary" onClick={async () => { if (await onEdit(draft)) setEditing(false); }}>Save</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`chr-rec${rec.hidden ? " chr-rec--hidden" : ""}`} style={{ "--chr-rec-color": color }}>
      <p>{rec.text}</p>
      <span className="chr-rec-by">
        <b>{rec.authorName}</b>
        <span>{timeAgo(rec.updatedAt || rec.createdAt)}{rec.hidden ? " · hidden by the DM" : ""}</span>
        {canEdit && <button type="button" className="chr-link" onClick={() => { setDraft(rec.text); setEditing(true); }}>Edit</button>}
        {isDm && <button type="button" className="chr-link" onClick={onToggleHidden}>{rec.hidden ? "Show" : "Hide"}</button>}
      </span>
    </div>
  );
}

export default function SessionView({ sessionId, viewer, creds, pal }) {
  const navigate = useNavigate();
  const isDm = viewer.role === "dm";
  const [session, setSession] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [error, setError] = useState("");
  const [newRec, setNewRec] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newChapter, setNewChapter] = useState(null);
  const [armDelete, setArmDelete] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [recError, setRecError] = useState("");
  const credsKey = creds ? `${creds.asSlug || "dm"}` : "anon";

  useEffect(() => {
    let cancelled = false;
    getChronicleSession(sessionId, creds)
      .then((d) => { if (!cancelled) { setSession(d.session); setChapters(d.chapters || []); } })
      .catch((err) => { if (!cancelled) setError(err.status === 404 ? "That session doesn't exist (it may have been deleted)." : "Couldn't load this session. Check your connection and reload."); });
    return () => { cancelled = true; };
    // creds is derived from credsKey; re-fetch only when the identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, credsKey]);

  useEffect(() => {
    if (!armDelete) return undefined;
    const t = setTimeout(() => setArmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [armDelete]);

  const events = useMemo(() => [...(session?.events || [])].sort((a, b) => eventMs(a) - eventMs(b)), [session?.events]);
  const people = useMemo(() => peopleIndex(session?.players, events), [session?.players, events]);
  const timeline = useMemo(() => buildTimeline(events, people), [events, people]);
  const highlights = useMemo(() => buildHighlights(events, people), [events, people]);

  if (error) return <p className="chr-error" role="alert">{error} <Link className="chr-link" to="/chronicle">Back to the Chronicle</Link></p>;
  if (!session) return <p className="chr-muted">Loading…</p>;

  const startMs = Date.parse(session.startAt);
  const endMs = Date.parse(session.endAt);
  const multiDay = dayKey(startMs) !== dayKey(endMs);
  const chapterIndex = chapters.findIndex((c) => c.id === session.chapterId);
  const chapter = chapters[chapterIndex];
  const canPost = viewer.role === "player" && creds?.asSlug;

  async function saveMeta(payload) {
    setMetaError("");
    try {
      const res = await updateChronicleSession(creds.password, session.id, payload);
      setSession((s) => ({ ...s, ...res.session }));
      if (res.chapters) setChapters(res.chapters);
      return true;
    } catch (err) {
      setMetaError(err.message || "Couldn't save that change.");
      return false;
    }
  }

  async function addRecollection(e) {
    e.preventDefault();
    const text = newRec.trim();
    if (!text) return;
    setRecError("");
    try {
      const res = await addChronicleRecollection(creds, session.id, text);
      setSession((s) => ({ ...s, recollections: [...s.recollections, res.recollection] }));
      setNewRec("");
    } catch (err) {
      setRecError(err.message || "Couldn't add that. Try again.");
    }
  }

  async function editRecollection(rec, changes) {
    try {
      const res = await updateChronicleRecollection(creds, session.id, rec.id, changes);
      setSession((s) => ({ ...s, recollections: s.recollections.map((r) => (r.id === rec.id ? res.recollection : r)) }));
      return true;
    } catch (err) {
      setRecError(err.message || "Couldn't save that. Try again.");
      return false;
    }
  }

  async function remove() {
    if (!armDelete) { setArmDelete(true); return; }
    try {
      await deleteChronicleSession(creds.password, session.id);
      navigate("/chronicle");
    } catch (err) {
      setMetaError(err.message || "Couldn't delete the session.");
    }
  }

  return (
    <>
      <div className="chr-session-head">
        <Link className="chr-link" to="/chronicle">← Chronicle</Link>
        {chapter && <span className="chr-chapter-num">Chapter {chapterIndex + 1} · {chapter.name}</span>}
        {renaming ? (
          <input
            className="chr-inline-input chr-title-input"
            aria-label="Session title"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setRenaming(false); if (titleDraft.trim()) saveMeta({ title: titleDraft.trim() }); }
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={() => { setRenaming(false); if (titleDraft.trim() && titleDraft.trim() !== session.title) saveMeta({ title: titleDraft.trim() }); }}
          />
        ) : (
          <h1 className="chr-h1">{session.title}</h1>
        )}
        <span className="chr-meta">
          {multiDay
            ? `${fmtDay(startMs, { weekday: "long" })} – ${fmtDay(endMs, { weekday: "long" })}`
            : `${fmtDay(startMs, { weekday: "long", year: "numeric" })} · ${fmtTime(startMs)} – ${fmtTime(endMs)}`}
          {" · "}{session.eventCount} events
        </span>
        {session.players?.length > 0 && (
          <span className="chr-who-row">
            {session.players.map((p) => (
              <span key={p.slug} className="chr-who"><span className="chr-dot" style={{ background: playerColor(p.palette) }} />{p.name}</span>
            ))}
          </span>
        )}
        {isDm && (
          <div className="chr-actions chr-dm-actions">
            <button type="button" className="chr-btn chr-btn--quiet" onClick={() => { setTitleDraft(session.title); setRenaming(true); }}>Rename</button>
            <Link className="chr-btn chr-btn--quiet" to={`/chronicle/record?edit=${encodeURIComponent(session.id)}`}>Edit range</Link>
            <label className="chr-inline-field">
              <span className="chr-label">Chapter</span>
              <select
                value={newChapter !== null ? "__new" : session.chapterId}
                onChange={(e) => {
                  if (e.target.value === "__new") setNewChapter("");
                  else { setNewChapter(null); saveMeta({ chapterId: e.target.value }); }
                }}
              >
                {chapters.map((c, i) => <option key={c.id} value={c.id}>Chapter {i + 1}: {c.name}</option>)}
                <option value="__new">New chapter…</option>
              </select>
            </label>
            {newChapter !== null && (
              <form
                className="chr-inline-field"
                onSubmit={async (e) => { e.preventDefault(); if (newChapter.trim() && await saveMeta({ newChapterName: newChapter.trim() })) setNewChapter(null); }}
              >
                <input className="chr-inline-input" aria-label="New chapter name" placeholder="New chapter name" value={newChapter} autoFocus onChange={(e) => setNewChapter(e.target.value)} />
                <button type="submit" className="chr-btn chr-btn--quiet">Move</button>
              </form>
            )}
            <span className="chr-spacer" />
            <button type="button" className="chr-btn chr-btn--quiet chr-btn--danger" onClick={remove}>{armDelete ? "Tap again to delete" : "Delete session"}</button>
          </div>
        )}
        {metaError && <p className="chr-error" role="alert">{metaError}</p>}
      </div>

      <NightAtAGlance timeline={timeline} startMs={startMs} endMs={endMs} people={people} />

      <div className="chr-grid">
        <div>
          <Summary session={session} creds={isDm || canPost ? creds : null} onSaved={(summary) => setSession((s) => ({ ...s, summary }))} />

          <section className="chr-section" aria-labelledby="chr-rec-h">
            <div className="chr-section-head">
              <h2 id="chr-rec-h">Recollections</h2>
              <span className="chr-meta">{isDm ? "Players' own notes. You can hide any." : "Your notes on the night, in your own words."}</span>
            </div>
            <div className="chr-recs">
              {session.recollections.length === 0 && <p className="chr-empty-note">No recollections yet.</p>}
              {session.recollections.map((rec) => (
                <Recollection
                  key={rec.id}
                  rec={rec}
                  isDm={isDm}
                  canEdit={viewer.role === "player" && rec.authorSlug === creds?.asSlug}
                  onEdit={(text) => editRecollection(rec, { text })}
                  onToggleHidden={() => editRecollection(rec, { hidden: !rec.hidden })}
                />
              ))}
              {recError && <p className="chr-error" role="alert">{recError}</p>}
              {canPost && (
                <form className="chr-rec-form" onSubmit={addRecollection}>
                  <label className="chr-field">
                    <span className="chr-label">Add a recollection</span>
                    <textarea rows={3} value={newRec} placeholder="What do you remember about this session?" onChange={(e) => setNewRec(e.target.value)} />
                  </label>
                  <div className="chr-actions"><span className="chr-spacer" /><button type="submit" className="chr-btn chr-btn--primary" disabled={!newRec.trim()}>Add</button></div>
                </form>
              )}
              {viewer.role === "anon" && <p className="chr-meta">Open your character sheet first to add recollections or edit the summary.</p>}
            </div>
          </section>
        </div>

        <div>
          <section className="chr-section" aria-labelledby="chr-hl-h">
            <div className="chr-section-head"><h2 id="chr-hl-h">Highlights</h2><span className="chr-meta">From the log</span></div>
            <div className="chr-highlights">
              {highlights.map((h) => (
                <div key={h.key} className={`chr-hl${h.tone ? ` chr-hl--${h.tone}` : ""}`}>
                  <span className="chr-hl-label">{h.label}</span>
                  <span className="chr-hl-value">{h.value}</span>
                  <span className="chr-hl-detail">{h.detail}</span>
                </div>
              ))}
            </div>
          </section>
          <details className="chr-log">
            <summary>Activity log · {events.length} events</summary>
            <div className="chr-log-list">
              {[...events].reverse().map((entry, i, list) => (
                <div key={entry.id} className="chr-log-row">
                  <span className="chr-ev-time">{fmtTime(eventMs(entry))}</span>
                  <RollHistoryRow pal={pal} entry={entry} showDivider={i < list.length - 1} />
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
