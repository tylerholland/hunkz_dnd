import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PALETTES } from "../characterSheet/theme";
import { conditionStyle } from "../dmDashboard/dashboardShared";

const conditionName = (c) => (typeof c === "string" ? c : c?.name);

function hpFill(pct, bright) {
  if (pct > 0.5) return bright;
  return pct >= 0.2 ? "#c8a840" : "#c06060";
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A party member as a collectible card in their own palette: portrait, name,
 * epithet, race · class and level, HP and conditions (when the party's status
 * is public), and Session / Profile links. Tilts toward the cursor.
 */
export default function PartyCard({ character, status, isMe }) {
  const ref = useRef(null);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const p = PALETTES[character.palette] || PALETTES.ember;
  const kind = [character.race, character.charClass].filter(Boolean).join(" · ");
  const hpMax = Number(status?.hpMax) || 0;
  const hpCurrent = Math.max(0, Number(status?.hpCurrent) || 0);
  const pct = hpMax > 0 ? Math.min(1, hpCurrent / hpMax) : 0;
  const conditions = (status?.conditions || []).map(conditionName).filter(Boolean);
  if (status?.exhaustionLevel > 0) conditions.push(`Exhaustion ${status.exhaustionLevel}`);

  function tilt(e) {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-3px)`;
  }
  function untilt() {
    if (ref.current) ref.current.style.transform = "";
  }

  return (
    <article
      ref={ref}
      className={`home-card${isMe ? " home-card--me" : ""}`}
      data-light={p.light ? "true" : undefined}
      style={{
        "--c-accent": p.accent,
        "--c-bright": p.accentBright,
        "--c-surface": p.surfaceSolid,
        "--c-text": p.text,
        "--c-muted": `color-mix(in srgb, ${p.textMuted} 55%, ${p.textBody})`,
      }}
      onMouseMove={tilt}
      onMouseLeave={untilt}
      aria-label={character.name}
    >
      <div className="home-card-portrait">
        {character.portraitUrl && !portraitFailed ? (
          <img src={character.portraitUrl} alt="" loading="lazy" onError={() => setPortraitFailed(true)} />
        ) : (
          <span className="home-card-initial">{character.name?.[0] || "?"}</span>
        )}
        {isMe && <span className="home-card-you">You</span>}
        <span className="home-card-sheen" />
      </div>
      <div className="home-card-body">
        <div className="home-card-name">{character.name}</div>
        {character.nameAlt && <div className="home-card-epithet">“{character.nameAlt}”</div>}
        <div className="home-card-kind">
          {kind}
          {character.level ? <span className="home-card-lvl">Lv {character.level}</span> : null}
        </div>
        {hpMax > 0 && (
          <div className="home-card-hp" aria-label={`${hpCurrent} of ${hpMax} hit points`}>
            <div className="home-card-hp-bar"><i style={{ width: `${Math.round(pct * 100)}%`, background: hpFill(pct, p.accentBright) }} /></div>
            <span className="home-card-hp-num">{hpCurrent}/{hpMax}</span>
          </div>
        )}
        {conditions.length > 0 && (
          <div className="home-card-pills">
            {conditions.map((name) => {
              const s = conditionStyle(name.startsWith("Exhaustion") ? "Exhaustion" : name);
              return <span key={name} className="home-card-pill" style={{ "--pill": s.color, "--pill-border": s.border }}>{name}</span>;
            })}
          </div>
        )}
      </div>
      <div className="home-card-actions">
        <Link to={`/characters/${character.slug}/session`}>⚔ Session</Link>
        <Link to={`/characters/${character.slug}/profile`}>❡ Profile</Link>
      </div>
    </article>
  );
}
