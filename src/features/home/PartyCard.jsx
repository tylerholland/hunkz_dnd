import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PALETTES } from "../characterSheet/theme";
import { conditionStyle } from "../dmDashboard/dashboardShared";
import { cardName, plateName } from "./roadLayout";
import { focusObjectPosition } from "./portraitFocus";

const conditionName = (c) => (typeof c === "string" ? c : c?.name);

function hpFill(pct, bright) {
  if (pct > 0.5) return bright;
  return pct >= 0.2 ? "#c8a840" : "#c06060";
}

const canHover = () => window.matchMedia?.("(hover: hover)").matches ?? true;

/**
 * A character as a glass orb that opens into their card. At rest: the
 * portrait in a floating orb, with their name and race · class beneath. On
 * hover (or a tap, on touch screens) the orb's circular mask morphs into the
 * card — portrait, name, epithet, race · class and level, HP and conditions
 * (when the party's status is public), and Session / Profile links — in the
 * character's own palette. `other` (not in the party) shows the orb in
 * monochrome until it opens.
 */
export default function PartyCard({ character, status, isMe = false, other = false, index = 0 }) {
  const [open, setOpen] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [imageAspect, setImageAspect] = useState(0); // naturalWidth / naturalHeight, once loaded
  const slotRef = useRef(null);
  const p = PALETTES[character.palette] || PALETTES.ember;
  const kind = [character.race, character.charClass].filter(Boolean).join(" · ");
  const hpMax = Number(status?.hpMax) || 0;
  const hpCurrent = Math.max(0, Number(status?.hpCurrent) || 0);
  const pct = hpMax > 0 ? Math.min(1, hpCurrent / hpMax) : 0;
  const conditions = (status?.conditions || []).map(conditionName).filter(Boolean);
  if (status?.exhaustionLevel > 0) conditions.push(`Exhaustion ${status.exhaustionLevel}`);

  // On a touch screen an open card closes when you tap anywhere else.
  useEffect(() => {
    if (!open || canHover()) return undefined;
    const close = (e) => { if (!slotRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // The orb's rim grows to the card's full height, which depends on its content.
  function openCard() {
    const card = slotRef.current?.querySelector(".home-card");
    if (card) slotRef.current.style.setProperty("--card-h", `${card.offsetHeight}px`);
    setOpen(true);
  }

  function handleClick(e) {
    if (canHover()) return;
    // First tap opens; once open, the links inside work.
    if (!open) { e.preventDefault(); openCard(); }
  }

  return (
    <div
      ref={slotRef}
      className={`home-slot${open ? " home-slot--open" : ""}${isMe ? " home-slot--me" : ""}${other ? " home-slot--other" : ""}`}
      data-light={p.light ? "true" : undefined}
      style={{
        "--c-accent": p.accent,
        "--c-bright": p.accentBright,
        "--c-surface": p.surfaceSolid,
        "--c-text": p.text,
        "--c-muted": `color-mix(in srgb, ${p.textMuted} 55%, ${p.textBody})`,
        // The orb's glow: on a light palette the "bright" accent is its darkest ink.
        "--c-glow": p.light ? "#c8a46a" : p.accentBright,
        // Each orb floats on its own rhythm, so neighbours drift in and out of step.
        "--bob-dur": `${(3.3 + (index % 3) * 0.45).toFixed(2)}s`,
        "--bob-delay": `${(-index * 1.3).toFixed(2)}s`,
      }}
      tabIndex={0}
      aria-label={`${character.name}${kind ? `, ${kind}` : ""}`}
      onMouseEnter={() => { if (canHover()) openCard(); }}
      onMouseLeave={() => { if (canHover()) setOpen(false); }}
      onFocus={openCard}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
      onClickCapture={handleClick}
    >
      <div className="home-slot-float">
        <article className="home-card">
          <div className="home-card-portrait">
            {character.portraitUrl && !portraitFailed ? (
              <img
                src={character.portraitUrl}
                alt=""
                loading="lazy"
                style={{ objectPosition: focusObjectPosition(character.portraitFocus, imageAspect) }}
                onLoad={(e) => setImageAspect(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))}
                onError={() => setPortraitFailed(true)}
              />
            ) : (
              <span className="home-card-initial">{character.name?.[0] || "?"}</span>
            )}
          </div>
          <div className="home-card-body">
            {/* Conditions and effects (rare) sit above the name. */}
            {conditions.length > 0 && (
              <div className="home-card-pills">
                {conditions.map((name) => {
                  const s = conditionStyle(name.startsWith("Exhaustion") ? "Exhaustion" : name);
                  return <span key={name} className="home-card-pill" style={{ "--pill": s.color, "--pill-border": s.border }}>{name}</span>;
                })}
              </div>
            )}
            <div className="home-card-name" title={character.name}>{cardName(character.name)}</div>
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
          </div>
          <div className="home-card-actions">
            <Link to={`/characters/${character.slug}/session`} tabIndex={open ? 0 : -1}>⚔ Session</Link>
            <Link to={`/characters/${character.slug}/profile`} tabIndex={open ? 0 : -1}>❡ Profile</Link>
          </div>
        </article>
        <div className="home-orb-glass" aria-hidden="true" />
        <div className="home-orb-frame" aria-hidden="true" />
        <div className="home-orb-plate" aria-hidden="true">
          <b>{plateName(character.name)}</b>
          {kind && <em>{kind}</em>}
        </div>
      </div>
    </div>
  );
}
