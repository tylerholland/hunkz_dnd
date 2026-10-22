import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getBadgeEligibleConditions } from "./tokenEffects";
import TokenCardConditions from "./TokenCardConditions";
import { clearLinkHover, setLinkHover, useLinkHover } from "./tokenLink";

const CARD_W = 150;

function hpTier(cur, max) {
  if (cur === null || max === null || max <= 0) return "healthy";
  const pct = cur / max;
  if (pct > 0.5) return "healthy";
  if (pct >= 0.2) return "wounded";
  return "critical";
}

/**
 * Story 33 — one unplaced token in the DM's tray, behaving like its map
 * token: portrait (NPC portraits too, falling back to initials), the same
 * hover card (opening upward, kept on screen), and the two-way card link.
 */
export default function TrayChip({
  type, sourceId, name, portraitUrl, initials, ringColor, fillColor, linkColor,
  conditions, exhaustionLevel = 0, hpCurrent = null, hpMax = null, effectNotes,
  selected = false, veiled = false, onSelect, pal,
}) {
  const chipRef = useRef(null);
  // Where the hover card goes (null = closed): above the chip (the tray sits
  // under the map), clamped to the viewport; measured on hover.
  const [pos, setPos] = useState(null);
  const [portraitError, setPortraitError] = useState(false);
  const linkHover = useLinkHover(type, sourceId);
  const showPortrait = !!portraitUrl && !portraitError;

  function handleEnter() {
    setLinkHover(type, sourceId, "token");
    const rect = chipRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - CARD_W / 2), window.innerWidth - CARD_W - 8);
    setPos({ left, bottom: window.innerHeight - rect.top + 6 });
  }
  function handleLeave() {
    clearLinkHover(type, sourceId);
    setPos(null);
  }

  const eligible = getBadgeEligibleConditions(conditions, exhaustionLevel);
  const tier = hpTier(hpCurrent, hpMax);
  const pct = hpMax > 0 ? Math.max(0, Math.min(1, (hpCurrent || 0) / hpMax)) : 0;

  return (
    <div
      ref={chipRef}
      className={`tray-chip${selected ? " tray-chip--selected" : ""}${veiled ? " tray-chip--veiled" : ""}`}
      style={{ "--token-ring-color": ringColor, "--token-fill-color": fillColor, "--pal-accent": pal.accent, "--tk-link-color": linkColor || ringColor }}
      onClick={() => onSelect(sourceId, type)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      aria-label={name}
    >
      {showPortrait ? (
        <img
          className="tray-chip__portrait"
          src={portraitUrl}
          alt={name}
          draggable={false}
          style={{ "--token-ring-color": ringColor }}
          onError={() => setPortraitError(true)}
        />
      ) : (
        <div className="tray-chip__initial" style={{ background: fillColor, boxShadow: `0 0 0 2px ${ringColor}` }}>
          {initials}
        </div>
      )}
      {veiled && (
        <svg className="tk-veil-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="18" />
        </svg>
      )}
      {/* Its card is hovered: pulse a ring round the portrait. */}
      {linkHover === "card" && <span className="tk-link-ring" aria-hidden="true" />}

      {pos && createPortal(
        <div
          className="token-hp-card tray-hp-card"
          style={{
            left: pos.left,
            bottom: pos.bottom,
            width: CARD_W,
            "--pal-surface-solid": pal.surfaceSolid || pal.surface,
            "--pal-border": pal.border,
            "--pal-text": pal.text,
            "--pal-text-muted": pal.textMuted,
          }}
          aria-hidden="true"
        >
          <div className="token-hp-card__name">{name}</div>
          {veiled && <div className="token-hp-card__invis-line">◇ INVISIBLE</div>}
          <TokenCardConditions eligibleConditions={eligible} effectNotes={effectNotes} />
          {hpCurrent !== null && hpMax !== null && (
            <>
              <div className="token-hp-card__numerals">{hpCurrent}/{hpMax}</div>
              <div className="token-hp-card__bar-wrap">
                <div className={`token-hp-card__bar-fill token-hp-card__bar-fill--${tier}`} style={{ width: `${Math.round(pct * 100)}%` }} />
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
