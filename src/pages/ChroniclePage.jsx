import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { listCharacters } from "../api";
import { PALETTES } from "../features/characterSheet/theme";
import TopNav from "../components/TopNav";
import ChronicleList from "../features/chronicle/ChronicleList";
import RecordSession from "../features/chronicle/RecordSession";
import SessionView from "../features/chronicle/SessionView";
import { readChronicleViewer, viewerCredentials, viewerPaletteKey } from "../features/chronicle/chronicleViewer";
import "../features/chronicle/chronicle.css";

// Story 69 — the Session Chronicle: /chronicle (chapters → sessions),
// /chronicle/record (DM: tag a session from the log; ?edit=<id> to change a
// range) and /chronicle/:sessionId (summary, timeline, recollections).
export default function ChroniclePage() {
  const { sessionId } = useParams();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const viewer = useMemo(() => readChronicleViewer(), []);
  const [asSlug, setAsSlug] = useState(() => viewer.characters[0]?.slug || null);
  const [names, setNames] = useState({});
  const isRecord = pathname.replace(/\/+$/, "").endsWith("/chronicle/record");
  const isDm = viewer.role === "dm";
  const creds = viewerCredentials(viewer, asSlug);
  const pal = PALETTES[viewerPaletteKey(viewer, asSlug)] || PALETTES.ocean;

  useEffect(() => {
    if (viewer.role !== "player" || viewer.characters.length < 2) return undefined;
    let cancelled = false;
    listCharacters()
      .then((list) => { if (!cancelled) setNames(Object.fromEntries((list || []).map((c) => [c.slug, c.name]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [viewer]);

  const palVars = {
    "--pal-bg": pal.bg,
    "--pal-surface": pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border": pal.border,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-text": pal.text,
    "--pal-text-body": pal.textBody,
    "--pal-text-muted": pal.textMuted,
    "--font-display": pal.fontDisplay,
    "--font-body": pal.fontBody,
    "--font-ui": pal.fontUI,
  };
  const backTo = isDm ? "/dm" : asSlug ? `/characters/${asSlug}/session` : "/";
  const menuItems = isDm
    ? [{ label: "Campaign", href: "/dm" }, { label: "Map Library", href: "/maps" }, { label: "DM Settings", href: "/dm/settings" }]
    : [{ label: "Characters", href: "/" }];

  let body;
  if (isRecord) {
    body = isDm
      ? <RecordSession dmPassword={viewer.password} editId={searchParams.get("edit")} />
      : <p className="chr-muted">Only the DM can record sessions. <Link className="chr-link" to="/chronicle">Back to the Chronicle</Link></p>;
  } else if (sessionId) {
    body = <SessionView key={`${sessionId}|${asSlug}`} sessionId={sessionId} viewer={viewer} creds={creds} pal={pal} />;
  } else {
    body = <ChronicleList isDm={isDm} dmPassword={viewer.password} />;
  }

  return (
    <div className="chr-page" style={{ ...palVars, background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}` }}>
      <TopNav backTo={backTo} title="Chronicle" menuItems={menuItems} />
      <main className="chr-main">
        {viewer.role === "player" && viewer.characters.length > 1 && (
          <label className="chr-inline-field chr-as">
            <span className="chr-label">Posting as</span>
            <select value={asSlug || ""} onChange={(e) => setAsSlug(e.target.value)}>
              {viewer.characters.map((c) => <option key={c.slug} value={c.slug}>{names[c.slug] || c.slug}</option>)}
            </select>
          </label>
        )}
        {body}
      </main>
    </div>
  );
}
