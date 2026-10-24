import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listCharacters, verifyPassword, getPartyRoster, getChronicle, getSessionState, putChronicleNextSession } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import TopNav from "../components/TopNav";
import { useTextScale } from "../lib/useTextScale";
import { readChronicleViewer, viewerCredentials } from "../features/chronicle/chronicleViewer";
import HomeAtmosphere from "../features/home/HomeAtmosphere";
import PartyCard from "../features/home/PartyCard";
import RoadSoFar from "../features/home/RoadSoFar";
import ScheduleDialog from "../features/home/ScheduleDialog";
import { daysBetween, sessionTitle, toRoman, upcomingSession, WEEKDAYS, shortDate } from "../features/home/roadLayout";
import "./pages.css";
import "../features/home/home.css";

const RESERVED_CHARACTER_SLUGS = new Set(["initiative", "npc-combat", "party-roster"]);
const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function isRenderableCharacterSummary(entry) {
  if (!entry || typeof entry !== "object") return false;
  const slug = typeof entry.slug === "string" ? entry.slug.trim() : "";
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!slug || !name) return false;
  if (RESERVED_CHARACTER_SLUGS.has(slug)) return false;
  return true;
}

function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return [150, 185, 220];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// The fog takes the page palette's light: its bright accent on dark
// palettes; on a light palette, its accent softened toward the paper.
function fogRgb(pal) {
  if (!pal.light) return hexRgb(pal.accentBright).join(", ");
  const a = hexRgb(pal.accent);
  const b = hexRgb(pal.bg);
  return a.map((v, i) => Math.round(v * 0.6 + b[i] * 0.4)).join(", ");
}

function readDmPalette() {
  try {
    return sessionStorage.getItem("dnd_dm_palette");
  } catch {
    return null;
  }
}

export default function CharactersListPage() {
  const [characters,  setCharacters]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dmPrompt,    setDmPrompt]    = useState(false);
  const [dmInput,     setDmInput]     = useState("");
  const [dmError,     setDmError]     = useState(null);
  const [dmActive,    setDmActive]    = useState(() => !!sessionStorage.getItem("dnd_dm_password"));
  const [partyMemberSlugs, setPartyMemberSlugs] = useState(() => new Set());
  const [chronicle, setChronicle] = useState(null); // { chapters, sessions, nextSession }
  const [statusBySlug, setStatusBySlug] = useState(() => new Map());
  const [scheduling, setScheduling] = useState(false);
  const [scheduleState, setScheduleState] = useState({ saving: false, error: null });
  const [viewer, setViewer] = useState(readChronicleViewer);
  const { textScale, textScaleMenuItem } = useTextScale();

  useEffect(() => {
    Promise.all([
      listCharacters(),
      getPartyRoster().catch(() => ({ members: [] })),
    ])
      .then(([characterData, rosterData]) => {
        const nextCharacters = Array.isArray(characterData) ? characterData : [];
        setCharacters(nextCharacters);

        const validCharacters = nextCharacters.filter(isRenderableCharacterSummary);
        const validSlugs = new Set(validCharacters.map((character) => character.slug));
        const rosterMembers = Array.isArray(rosterData?.members) ? rosterData.members.filter((slug) => validSlugs.has(slug)) : [];
        setPartyMemberSlugs(new Set(rosterData?.exists ? rosterMembers : validCharacters.map((character) => character.slug)));
      })
      .catch(() => {
        setCharacters([]);
        setPartyMemberSlugs(new Set());
      })
      .finally(() => setLoading(false));

    // The Chronicle (hero + road) and the party's public HP/conditions are
    // extras: the library still works if either fails.
    getChronicle().then(setChronicle).catch(() => setChronicle({ chapters: [], sessions: [], nextSession: null }));
    getSessionState()
      .then((state) => {
        const members = state?.partyStatus?.visible ? state.partyStatus.members || [] : [];
        setStatusBySlug(new Map(members.map((m) => [m.slug, m])));
      })
      .catch(() => {});
  }, []);

  const handleDmLogin = async (e) => {
    e.preventDefault();
    setDmError(null);
    // Verify against the first available character
    const first = characters[0];
    if (!first) { setDmError("No characters available to verify against."); return; }
    try {
      const result = await verifyPassword(first.slug, dmInput);
      if (result.valid && result.role === "dm") {
        sessionStorage.setItem("dnd_dm_password", dmInput);
        setDmActive(true);
        setViewer(readChronicleViewer());
        setDmPrompt(false);
        setDmInput("");
      } else {
        setDmError("Incorrect DM password.");
      }
    } catch {
      setDmError("Could not verify password.");
    }
  };

  const handleDmLogout = () => {
    sessionStorage.removeItem("dnd_dm_password");
    setDmActive(false);
    setViewer(readChronicleViewer());
  };

  const visibleCharacters = characters.filter(isRenderableCharacterSummary);
  const party = visibleCharacters.filter((c) => partyMemberSlugs.has(c.slug));
  const others = visibleCharacters.filter((c) => !partyMemberSlugs.has(c.slug));

  // Who this tab is signed in as: the first unlocked character, party first.
  const signedInSlugs = new Set(viewer.characters.map((c) => c.slug));
  const me = party.find((c) => signedInSlugs.has(c.slug)) || visibleCharacters.find((c) => signedInSlugs.has(c.slug)) || null;
  const orderedParty = me && partyMemberSlugs.has(me.slug) ? [me, ...party.filter((c) => c.slug !== me.slug)] : party;

  const palKey = me?.palette || (dmActive ? readDmPalette() : null) || "ocean";
  const pal = PALETTES[palKey] || PALETTES.ocean;

  // Palette CSS variables set once at root; children reference var(--pal-*)
  const palVars = {
    "--pal-bg":            pal.bg,
    "--pal-surface":       pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border":        pal.border,
    "--pal-accent":        pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim":    pal.accentDim,
    "--pal-text":          pal.text,
    "--pal-text-body":     pal.textBody,
    "--pal-text-muted":    pal.textMuted,
    "--pal-glow-1":        pal.glow1,
    "--pal-glow-2":        pal.glow2,
    "--pal-gem":           pal.gem,
    "--pal-gem-low":       pal.gemLow,
    "--fog-rgb":           fogRgb(pal),
  };

  const menuItems = dmActive
    ? [
        { label: "Campaign", href: "/dm" },
        { label: "Maps", href: "/maps" },
        { label: "Chronicle", href: "/chronicle" },
        { divider: true },
        textScaleMenuItem,
        { divider: true },
        { label: "End Session", onClick: handleDmLogout, destructive: true },
      ]
    : [
        { label: "Chronicle", href: "/chronicle" },
        { label: "DM Login", onClick: () => setDmPrompt(true) },
        { divider: true },
        textScaleMenuItem,
      ];

  // ── The Chronicle: last time, the road so far, the next session ──
  const sessions = [...(chronicle?.sessions || [])].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const latest = sessions[sessions.length - 1] || null;
  const chapterIndex = latest ? (chronicle.chapters || []).findIndex((c) => c.id === latest.chapterId) : -1;
  const chapter = chapterIndex >= 0 ? chronicle.chapters[chapterIndex] : null;
  const latestDay = latest ? new Date(latest.startAt) : null;
  const sinceDays = latestDay ? daysBetween(latestDay, new Date()) : null;
  const upcoming = upcomingSession(chronicle?.nextSession);
  const canSchedule = viewer.role === "dm" || !!me;

  async function saveNextSession(at) {
    const credentials = viewer.role === "dm" ? viewerCredentials(viewer) : viewerCredentials(viewer, me?.slug);
    if (!credentials) return;
    setScheduleState({ saving: true, error: null });
    try {
      const res = await putChronicleNextSession(credentials, at);
      setChronicle((prev) => ({ ...(prev || { chapters: [], sessions: [] }), nextSession: res.nextSession ?? null }));
      setScheduleState({ saving: false, error: null });
      setScheduling(false);
    } catch (err) {
      setScheduleState({ saving: false, error: err?.status === 403 ? "Sign in again to schedule the session." : "Couldn't save. Try again." });
    }
  }

  return (
    <div
      className="home-page"
      data-light={pal.light ? "true" : undefined}
      style={{ ...palVars, zoom: textScale }}
    >
      <HomeAtmosphere fogRgb={palVars["--fog-rgb"]} />
      <TopNav
        title="Hunkz Adventures"
        menuItems={menuItems}
      />

      <main className="home-main">

        {/* DM password modal */}
        {dmPrompt && (
          <div className="modal-overlay" style={{ zIndex: 100 }}>
            <div className="modal-panel" style={{ maxWidth: 340 }}>
              <div className="label-ui" style={{ marginBottom: 8, letterSpacing: "0.3em" }}>
                DM Login
              </div>
              <div style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: 18, color: "#c8bfaf", marginBottom: 20 }}>
                Dungeon Master Access
              </div>
              <form onSubmit={handleDmLogin}>
                <input
                  type="password"
                  autoFocus
                  placeholder="DM password…"
                  value={dmInput}
                  onChange={e => setDmInput(e.target.value)}
                  className="input-base"
                  style={{ marginBottom: 8, fontSize: 16 }}
                />
                {dmError && (
                  <div style={{ color: "#c06060", fontSize: 14, fontFamily: "'Crimson Text', Georgia, serif", marginBottom: 10 }}>
                    {dmError}
                  </div>
                )}
                <div className="flex-row" style={{ gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => { setDmPrompt(false); setDmInput(""); setDmError(null); }}
                    className="btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" style={{ flex: 2 }}>
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Campaign header: where we left off, and the road so far */}
        <section className="home-hero" aria-labelledby="home-hero-h">
          <div className="home-kicker">The Chronicle{chapter ? ` · Chapter ${toRoman(chapterIndex + 1)}` : ""}</div>
          {/* The campaign's name is in the top nav; the hero leads with the chapter. */}
          <h1 id="home-hero-h">{chapter?.name || "The Chronicle"}</h1>
          <div className="home-rule" />

          {latest ? (
            <>
              <div className="home-label">Last time</div>
              <div className="home-last-title">
                {sessionTitle(latest.title)}{" "}
                <span className="home-last-date">· {WEEKDAYS[latestDay.getDay()]}, {shortDate(latestDay)}</span>
              </div>
              {latest.summaryExcerpt
                ? <p className="home-excerpt">{latest.summaryExcerpt}</p>
                : <p className="home-excerpt home-excerpt--empty">No one has written up this session yet.</p>}
              <div className="home-hero-actions">
                <Link className="home-btn" to={`/chronicle/${encodeURIComponent(latest.id)}`}>Read the Chronicle →</Link>
                <span className="home-meta">
                  {sessions.length} session{sessions.length === 1 ? "" : "s"} so far · add your recollections
                </span>
              </div>
            </>
          ) : chronicle ? (
            <p className="home-excerpt home-excerpt--empty">
              The Chronicle begins with the first recorded session. <Link to="/chronicle">Open the Chronicle →</Link>
            </p>
          ) : null}

          {chronicle && (
            <div className="home-road">
              {latest && (
                <div className="home-road-head">
                  <span className="home-label">The road so far</span>
                  <span className="home-road-since">
                    <b>{sinceDays}</b> day{sinceDays === 1 ? "" : "s"} since the party last gathered · {sessions.length} session{sessions.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
              <div className="home-next">
                {upcoming ? (
                  <>
                    Next session: <b>{upcoming.label}</b> · {upcoming.when}
                    {canSchedule && <button type="button" className="home-linkish" onClick={() => setScheduling(true)}>Change</button>}
                  </>
                ) : (
                  <>
                    No next session set yet.
                    {canSchedule && <button type="button" className="home-linkish" onClick={() => setScheduling(true)}>Schedule the next session</button>}
                  </>
                )}
              </div>
              {sessions.length > 0 && <RoadSoFar sessions={sessions} next={upcoming?.at || null} />}
            </div>
          )}
        </section>

        {scheduling && (
          <ScheduleDialog
            current={upcoming?.at || null}
            saving={scheduleState.saving}
            error={scheduleState.error}
            onSave={saveNextSession}
            onClose={() => { setScheduling(false); setScheduleState({ saving: false, error: null }); }}
          />
        )}

        {/* Continue as… (only when this tab is signed in) */}
        {me && (
          <div className="home-continue" style={{ "--me-accent": (PALETTES[me.palette] || pal).light ? "#a07840" : (PALETTES[me.palette] || pal).accentBright }}>
            {me.portraitUrl && <img src={me.portraitUrl} alt="" />}
            <div className="home-continue-who">
              <b>Continue as {me.name.replace(/^"[^"]*"\s*/, "").split(" ")[0]}</b>
              <span>You're signed in on this device.</span>
            </div>
            <Link className="home-btn" to={`/characters/${me.slug}/session`}>⚔ To the session</Link>
          </div>
        )}

        {loading ? (
          <div className="home-loading">Gathering the party…</div>
        ) : (
          <>
            {orderedParty.length > 0 && (
              <section aria-labelledby="home-party-h">
                <div className="home-section-head">
                  <h2 id="home-party-h">The Party</h2>
                  <span className="home-count">{NUMBER_WORDS[orderedParty.length] || orderedParty.length} adventurer{orderedParty.length === 1 ? "" : "s"}</span>
                </div>
                <div className="home-party">
                  {orderedParty.map((c) => (
                    <PartyCard key={c.slug} character={c} status={statusBySlug.get(c.slug)} isMe={me?.slug === c.slug} />
                  ))}
                </div>
              </section>
            )}

            <section className="home-others" aria-labelledby="home-others-h">
              <div className="home-section-head">
                <h2 id="home-others-h" className="home-others-h">{orderedParty.length ? "Other characters" : "Characters"}</h2>
              </div>
              <div className="home-others-row">
                {others.map((c) => (
                  <Link key={c.slug} className="home-mini" to={`/characters/${c.slug}`}>
                    {c.portraitUrl
                      ? <img src={c.portraitUrl} alt="" />
                      : <span className="home-mini-initial">{c.name?.[0] || "?"}</span>}
                    <span>
                      {c.name}
                      <em>{[c.race, c.charClass].filter(Boolean).join(" ")}{c.level ? ` · Lv ${c.level}` : ""}</em>
                    </span>
                  </Link>
                ))}
                <Link className="home-mini home-mini--new" to="/characters/new">+ New character</Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
