import { PALETTES } from "./theme";
import {
  conditionStyle,
  getHpTone,
  getPartyCardActiveSurface,
  getPartyCardPalette,
  getSpellSlotGroups,
  mixHex,
  withAlpha,
} from "../dmDashboard/dashboardShared";
import PartyMemberDetails from "./PartyMemberDetails";
import "../dmDashboard/characterCard.css";

/**
 * Story 61 — a read-only, narrower cousin of the DM's party card for the
 * player's Party list: the member's palette, offset portrait, AC, the same
 * segmented HP bar and condition pills. Race/class, spell slots, ability
 * modifiers and skills/abilities/spells stay folded until expanded.
 *
 * member: { slug, name, palette, portraitUrl, hpCurrent, hpMax, tempHP,
 *           conditions, concentration, inspiration, deathSaves, partyCard }
 */
export default function PartyMemberCard({ member, pal, isYou = false, isActiveTurn = false, expanded, onToggle }) {
  const charPal = PALETTES[member.palette] || PALETTES.ocean;
  const cardPal = getPartyCardPalette(charPal, pal);
  const card = member.partyCard || null;

  const hpMax = member.hpMax ?? 0;
  const hpCurrent = member.hpCurrent ?? 0;
  const hasHp = hpMax > 0;
  const hpPct = hasHp ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
  const hpTone = getHpTone(cardPal, hpPct);
  const hpDanger = hasHp && hpPct < 0.25;
  const isDown = hasHp && hpCurrent <= 0;
  const isFallen = isDown && (member.deathSaves?.failures ?? 0) >= 3;
  const conditions = Array.isArray(member.conditions) ? member.conditions : [];
  const concentrating = member.concentration?.active ? member.concentration : null;
  const slotGroups = getSpellSlotGroups(card?.spellSlots || []);
  const detailsId = `party-details-${member.slug}`;
  // Muted text reads a touch dim on these small cards: nudge it a quarter of
  // the way toward the palette's main text colour (lighter on dark themes,
  // darker on light ones like vellum).
  const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  const mutedText = isHex(cardPal.textMuted) && isHex(cardPal.text)
    ? mixHex(cardPal.textMuted, cardPal.text, 0.25)
    : cardPal.textMuted;

  const cardPalVars = {
    "--pal-bg": cardPal.bg,
    "--pal-surface": cardPal.surface,
    "--pal-surface-solid": cardPal.surfaceSolid,
    "--pal-border": cardPal.border,
    "--pal-accent": cardPal.accent,
    "--pal-accent-bright": cardPal.accentBright,
    "--pal-accent-dim": cardPal.accentDim,
    "--pal-text": cardPal.text,
    "--pal-text-body": cardPal.textBody,
    "--pal-text-muted": mutedText,
    "--pal-gem": cardPal.gem,
    "--pal-gem-low": cardPal.gemLow,
    "--pal-ui-border": cardPal.uiBorder,
    "--font-display": cardPal.fontDisplay,
    "--font-body": cardPal.fontBody,
    "--font-ui": cardPal.fontUI,
    "--pal-portrait-glow": withAlpha(cardPal.accent, 0.25),
  };

  const classes = [
    "cc-card",
    "cc-card--compact",
    isActiveTurn ? "dm-active-turn" : "",
    isDown ? "hp-zero" : "",
    isFallen ? "fallen" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={{
        ...cardPalVars,
        background: isActiveTurn ? getPartyCardActiveSurface(charPal, pal, cardPal) : cardPal.surface,
        border: `1px solid ${hpDanger ? "rgba(192,96,96,0.45)" : cardPal.border}`,
      }}
    >
      <div className="cc-stripe" style={{ background: hpDanger ? "#c06060" : cardPal.accent }} />

      <div className="cc-header-grid">
        <div className="cc-portrait">
          {member.portraitUrl
            ? <img src={member.portraitUrl} alt="" />
            : <span className="cc-portrait-initial">{(member.name || "?").charAt(0).toUpperCase()}</span>}
        </div>
        <div className="cc-identity">
          <div className="cc-name-row">
            <div className="cc-name-text" title={member.name}>{member.name || "Unknown"}</div>
            {isYou && <span className="cc-you-tag">You</span>}
          </div>
        </div>
        <div className="cc-actions-col">
          {card?.armorClass ? <div className="cc-ac-badge">AC {card.armorClass}</div> : null}
          {card && (
            <button
              type="button"
              className={`cc-compact-toggle${expanded ? " open" : ""}`}
              aria-expanded={expanded}
              aria-controls={detailsId}
              aria-label={`${expanded ? "Hide" : "Show"} ${member.name}'s details`}
              onClick={onToggle}
            >
              ▸
            </button>
          )}
        </div>
      </div>

      <div className="cc-card-body">
        {hasHp && (
          <div className="cc-hp-row">
            <div className="cc-hp-nums">
              <span className="cc-hp-current" style={{ color: hpTone.text }}>{Math.max(0, hpCurrent)}</span>
              <span className="cc-hp-sep">/</span>
              <span className="cc-hp-max">{hpMax}</span>
            </div>
            <div className="cc-hp-bar">
              {Array.from({ length: 5 }).map((_, idx) => {
                const segFill = Math.max(0, Math.min(1, (hpPct - idx / 5) * 5));
                return (
                  <div key={idx} className="cc-hp-seg">
                    <div style={{ position: "absolute", inset: 0, width: `${segFill * 100}%`, background: hpTone.fill, transition: "width 0.25s ease" }} />
                  </div>
                );
              })}
            </div>
            {member.tempHP > 0 && <span className="cc-temp-hp-badge">+{member.tempHP}</span>}
          </div>
        )}

        {(isDown || conditions.length > 0 || concentrating || member.inspiration) && (
          <div className="cc-status-row">
            {isDown && <span className="cc-down-tag">{isFallen ? "Fallen" : "Down"}</span>}
            {conditions.map((cond) => {
              const cs = conditionStyle(cond);
              return (
                <span key={cond} className="cc-cond-pill" style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}>
                  {cond}
                </span>
              );
            })}
            {concentrating && (
              <span className="cc-concentration">
                <span className="dm-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: cardPal.accentBright, boxShadow: `0 0 5px ${cardPal.accentBright}`, flexShrink: 0, display: "inline-block" }} />
                {concentrating.spell || "Concentrating"}
              </span>
            )}
            {member.inspiration && (
              <span className="cc-inspiration">
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: cardPal.gem, boxShadow: `0 0 6px ${cardPal.gem}66`, display: "inline-block" }} />
                Inspired
              </span>
            )}
          </div>
        )}

        {expanded && card && (
          <div className="cc-compact-details">
            {slotGroups.length > 0 && (
              <div className="cc-slots-row" aria-label="Spell slots remaining">
                {slotGroups.map((slot) => (
                  <div key={slot.key} className="cc-slot-group">
                    <span className="cc-slot-label">{slot.isPactMagic ? "P" : "L"}{slot.label}</span>
                    {Array.from({ length: slot.max }).map((_, pip) => {
                      const filled = pip < slot.max - slot.used;
                      return (
                        <span
                          key={pip}
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: filled ? cardPal.gem : "transparent",
                            border: `1.5px solid ${filled ? cardPal.gem : cardPal.uiBorder}`,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            <PartyMemberDetails card={card} id={detailsId} />
          </div>
        )}
      </div>
    </div>
  );
}
