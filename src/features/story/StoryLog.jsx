import { useEffect, useMemo, useState } from "react";
import { buildStory } from "./storyLines";
import "./story.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const FEED_LIMIT = 80;
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase() : "");

function readPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function Parts({ parts }) {
  return parts.map((p, i) => {
    if (typeof p === "string") return <span key={i}>{p}</span>;
    const cls = { who: "st-who", you: "st-you", ok: "st-ok", no: "st-no", quiet: "st-quiet", num: "st-num" }[p.t] || "";
    return <span key={i} className={cls}>{p.s}</span>;
  });
}

/**
 * The session as a story (lib: storyLines.js). Player: viewerSlug set, with
 * "The table / Just me" and "My numbers". DM (viewerSlug null): "Numbers"
 * shows everyone's. Shows the last day; earlier is in the Chronicle.
 */
export default function StoryLog({ entries, viewerSlug = null, prefKey = "dnd_story" }) {
  const isDm = !viewerSlug;
  const [numbers, setNumbers] = useState(() => readPref(`${prefKey}_numbers`, isDm ? "none" : "mine"));
  const [filter, setFilter] = useState(() => readPref(`${prefKey}_filter`, "all"));
  const [showEarlier, setShowEarlier] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const story = useMemo(() => buildStory(entries, { viewerSlug, numbers }), [entries, viewerSlug, numbers]);
  const mineOnly = !isDm && filter === "me";
  const filtered = mineOnly ? story.filter((i) => i.me || i.kind === "moment") : story;
  const recent = filtered.filter((i) => !i.at || i.at >= now - DAY_MS);
  const shown = (showEarlier ? filtered : recent).slice(0, FEED_LIMIT);
  const earlier = filtered.length - recent.length;

  const numbersOn = numbers !== "none";
  const toggleNumbers = () => {
    const next = numbersOn ? "none" : isDm ? "all" : "mine";
    setNumbers(next);
    writePref(`${prefKey}_numbers`, next);
  };
  const pickFilter = (next) => { setFilter(next); writePref(`${prefKey}_filter`, next); };

  return (
    <div className="st-log">
      <div className="st-controls">
        {!isDm && (
          <span className="st-seg" role="group" aria-label="Whose story">
            <button type="button" className={filter !== "me" ? "on" : ""} aria-pressed={filter !== "me"} onClick={() => pickFilter("all")}>The table</button>
            <button type="button" className={filter === "me" ? "on" : ""} aria-pressed={filter === "me"} onClick={() => pickFilter("me")}>Just me</button>
          </span>
        )}
        <label className="st-check">
          <input type="checkbox" checked={numbersOn} onChange={toggleNumbers} />
          {isDm ? "Numbers" : "My numbers"}
        </label>
      </div>

      {shown.length === 0 && <p className="st-empty">{mineOnly ? "Nothing of yours in the last day." : "Nothing yet tonight. What happens at the table is told here."}</p>}
      <div className="st-list">
        {shown.map((item) => {
          if (item.kind === "moment") {
            return (
              <article key={item.id} className="st-moment">
                {item.picture && <img className="st-moment-pic" src={item.picture} alt="" />}
                <div className="st-moment-in">
                  <span className="st-kind">Moment</span>
                  {item.title && <h3>{item.title}</h3>}
                  <p>{item.text}</p>
                  <span className="st-when">{fmtTime(item.at)}</span>
                </div>
              </article>
            );
          }
          if (item.kind === "note") {
            return (
              <div key={item.id} className="st-note">
                <span className="st-kind">{item.heading} · {fmtTime(item.at)}</span>
                {item.title && <strong className="st-note-title">{item.title}</strong>}
                <p>{item.text}</p>
                {item.replies.map((r) => <div key={r.id} className="st-reply">{r.who}: {r.text}</div>)}
              </div>
            );
          }
          return (
            <div key={item.id} className={`st-line${item.me ? " me" : ""}`}>
              <span className="st-when">{fmtTime(item.at)}</span>
              <p><Parts parts={item.parts} /></p>
            </div>
          );
        })}
      </div>
      {earlier > 0 && (
        <button type="button" className="rh-earlier" onClick={() => setShowEarlier((v) => !v)}>
          {showEarlier ? "Hide what's older than a day" : `Show earlier (${earlier})`}
        </button>
      )}
    </div>
  );
}
