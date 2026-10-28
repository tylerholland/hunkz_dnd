import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listCharacters, getPartyRoster, getChronicle, getSessionState, putChronicleNextSession } from "../api";
import ShopLine from "../features/shop/ShopLine";
import { PALETTES } from "../components/CharacterSheet";
import TopNav from "../components/TopNav";
import { useTextScale } from "../lib/useTextScale";
import { readChronicleViewer, viewerCredentials } from "../features/chronicle/chronicleViewer";
import Atmosphere from "../components/Atmosphere";
import { fogRgbFor } from "../lib/atmosphere";
import PartyCard from "../features/home/PartyCard";
import RoadSoFar from "../features/home/RoadSoFar";
import ScheduleDialog from "../components/ScheduleDialog";
import { daysBetween, sessionTitle, toRoman, upcomingSession, WEEKDAYS, shortDate } from "../features/home/roadLayout";
import "./pages.css";
import "../features/home/home.css";
import { isDmSignedIn, useDmPalette } from "../lib/dmSession";

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

export default function CharactersListPage() {
  const [characters,  setCharacters]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  // Signing in as the DM happens at /dm (the top bar's DM button).
  const dmActive = isDmSignedIn();
  const dmPalette = useDmPalette();
  const [partyMemberSlugs, setPartyMemberSlugs] = useState(() => new Set());
  const [chronicle, setChronicle] = useState(null); // { chapters, sessions, nextSession }
  const [statusBySlug, setStatusBySlug] = useState(() => new Map());
  const [shopSummary, setShopSummary] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleState, setScheduleState] = useState({ saving: false, error: null });
  const [viewer] = useState(readChronicleViewer);
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
        setShopSummary(state?.shop || null);
      })
      .catch(() => {});
  }, []);

  const visibleCharacters = characters.filter(isRenderableCharacterSummary);
  const party = visibleCharacters.filter((c) => partyMemberSlugs.has(c.slug));
  const others = visibleCharacters.filter((c) => !partyMemberSlugs.has(c.slug));

  // Who this tab is signed in as: the first unlocked character, party first.
  const signedInSlugs = new Set(viewer.characters.map((c) => c.slug));
  const me = party.find((c) => signedInSlugs.has(c.slug)) || visibleCharacters.find((c) => signedInSlugs.has(c.slug)) || null;
  const orderedParty = me && partyMemberSlugs.has(me.slug) ? [me, ...party.filter((c) => c.slug !== me.slug)] : party;

  const palKey = me?.palette || (dmActive ? dmPalette : null) || "ocean";
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
  };

  // The DM's places and Sign out come from the top bar itself.
  const menuItems = [
    ...(dmActive ? [] : [{ label: "Chronicle", href: "/chronicle" }, { divider: true }]),
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
      <Atmosphere variant="home" fogRgb={fogRgbFor(pal)} light={!!pal.light} />
      <TopNav
        title="Hunkz Adventures"
        menuItems={menuItems}
      />

      <main className="home-main">
        {/* Dims the page behind an open character card. */}
        <div className="home-dim" aria-hidden="true" />

        {/* Campaign header: where we left off, and what's next */}
        <section className="home-hero" aria-labelledby="home-hero-h">
          <div className="home-kicker">The Chronicle{chapter ? ` · Chapter ${toRoman(chapterIndex + 1)}` : ""}</div>
          {/* The campaign's name is in the top nav; the hero leads with the chapter. */}
          <h1 id="home-hero-h">{chapter?.name || "The Chronicle"}</h1>
          <div className="home-rule" />

          {/* Where we left off (left) and what's next (right). */}
          <div className="home-pair">
            <div>
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
            </div>

            {chronicle && (
              <aside className={`home-next${upcoming ? "" : " home-next--unset"}`} aria-labelledby="home-next-h">
                <div className="home-label" id="home-next-h">Next session</div>
                {upcoming ? (
                  <>
                    <div className="home-next-day">{upcoming.day}</div>
                    <div className="home-next-time">{upcoming.time}</div>
                    <div className="home-next-count">
                      {upcoming.countdown
                        ? <><b>{upcoming.countdown.n}</b><span>{upcoming.countdown.unit}</span></>
                        : <span>Under way</span>}
                    </div>
                    {canSchedule && (
                      <div className="home-next-row">
                        <button type="button" className="home-linkish" onClick={() => setScheduling(true)}>Change</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="home-next-day">Not set yet</div>
                    {canSchedule && (
                      <div className="home-next-row">
                        <button type="button" className="home-btn" onClick={() => setScheduling(true)}>Schedule the next session</button>
                      </div>
                    )}
                  </>
                )}
                <ShopLine summary={shopSummary} slug={me?.slug} nextSessionAt={upcoming?.at || null} className="on-home" />
              </aside>
            )}
          </div>
        </section>

        {/* The road so far: its own section, like the party below. */}
        {chronicle && sessions.length > 0 && (
          <section className="home-road" aria-labelledby="home-road-h">
            <div className="home-section-head home-road-head">
              <h2 id="home-road-h">The Road So Far</h2>
            </div>
            {latest && (
              <p className="home-road-since">
                <b>{sinceDays}</b> day{sinceDays === 1 ? "" : "s"} since the party last gathered
              </p>
            )}
            <RoadSoFar sessions={sessions} next={upcoming?.at || null} />
          </section>
        )}

        {scheduling && (
          <ScheduleDialog
            current={upcoming?.at || null}
            saving={scheduleState.saving}
            error={scheduleState.error}
            light={!!pal.light}
            onSave={saveNextSession}
            onClose={() => { setScheduling(false); setScheduleState({ saving: false, error: null }); }}
          />
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
                  {orderedParty.map((c, i) => (
                    <PartyCard key={c.slug} character={c} status={statusBySlug.get(c.slug)} isMe={me?.slug === c.slug} index={i} />
                  ))}
                </div>
              </section>
            )}

            <section className="home-others" aria-labelledby="home-others-h">
              <div className="home-section-head">
                <h2 id="home-others-h" className="home-others-h">{orderedParty.length ? "Other characters" : "Characters"}</h2>
              </div>
              <div className="home-party">
                {others.map((c) => (
                  <PartyCard key={c.slug} character={c} isMe={me?.slug === c.slug} other />
                ))}
                <Link className="home-slot-new" to="/characters/new">
                  <div className="home-slot-float">
                    <span className="home-new-orb" aria-hidden="true">+</span>
                    <div className="home-orb-plate"><b>New character</b></div>
                  </div>
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
