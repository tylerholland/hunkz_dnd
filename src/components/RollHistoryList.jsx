import { formatRollValues, normalizeRollActionLabel } from "../lib/rollHistory";

function badgeStyle(kind) {
  if (kind === "crit") {
    return {
      color: "#ffd060",
      border: "1px solid rgba(255,200,40,0.4)",
      background: "rgba(255,200,40,0.08)",
      label: "crit",
    };
  }
  return {
    color: "#c06060",
    border: "1px solid rgba(192,60,60,0.4)",
    background: "rgba(192,60,60,0.08)",
    label: "fumble",
  };
}

export function WheelHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  const isFillChange = Number.isFinite(entry.filledCount);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 0",
        borderBottom: showDivider ? `1px solid ${pal.border}` : "none",
        opacity,
        transition: "opacity 0.4s",
      }}
    >
      <span style={{ color: pal.accent, fontSize: 13, flexShrink: 0 }}>◷</span>
      {entry.characterName && (
        <span
          style={{
            fontFamily: pal.fontBody,
            fontSize: 13,
            color: pal.accentBright,
            flexShrink: 0,
          }}
        >
          {entry.characterName}
        </span>
      )}
      <span
        style={{
          fontFamily: pal.fontBody,
          fontStyle: "italic",
          fontSize: 14,
          color: pal.text,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.name}
      </span>
      <span
        style={{
          fontFamily: pal.fontUI,
          fontSize: 11,
          color: pal.textMuted,
          letterSpacing: "0.06em",
          flexShrink: 0,
        }}
      >
        {entry.note ? `— ${entry.note}` : isFillChange ? `— ${entry.filledCount}/${entry.segments} filled` : `— ${entry.segments} segments`}
      </span>
    </div>
  );
}

// Story 69 — session history rows: HP changes (damage / healing / a miss,
// tagged with the attack when one was declared) and condition changes.
function historyRowStyle(pal, opacity, showDivider) {
  return {
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: "2px 8px",
    padding: "7px 0",
    borderBottom: showDivider ? `1px solid ${pal.border}` : "none",
    opacity,
    transition: "opacity 0.4s",
    fontFamily: pal.fontBody,
    fontSize: 14,
    color: pal.text,
  };
}

const HP_DAMAGE = "#c06060";
const HP_HEAL = "#6aa86a";

export function HpHistoryRow({ pal, entry, opacity = 1, showDivider = false, children = null }) {
  const delta = Number.isFinite(entry.delta) ? entry.delta : 0;
  const kind = entry.miss ? "miss" : delta < 0 ? "damage" : "heal";
  const glyph = kind === "miss" ? "○" : kind === "damage" ? "⚔" : "✚";
  const color = kind === "miss" ? pal.textMuted : kind === "damage" ? HP_DAMAGE : HP_HEAL;
  const byName = entry.by?.name;
  const actionName = entry.action?.name;
  return (
    <div style={historyRowStyle(pal, opacity, showDivider)}>
      <span style={{ color, fontSize: 13, flexShrink: 0 }} aria-hidden="true">{glyph}</span>
      <span style={{ color: pal.accentBright }}>{entry.subject?.name || "Someone"}</span>
      {kind === "miss" ? (
        <span style={{ fontStyle: "italic", color: pal.textMuted }}>missed</span>
      ) : (
        <span style={{ fontFamily: pal.fontDisplay, fontSize: 17, color }}>
          {delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`}
        </span>
      )}
      {Number.isFinite(entry.from) && Number.isFinite(entry.to) && kind !== "miss" ? (
        <span style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted }}>
          {entry.from} → {entry.to}{Number.isFinite(entry.max) ? ` / ${entry.max}` : ""} HP
        </span>
      ) : null}
      {byName || actionName ? (
        <span style={{ fontStyle: "italic", color: pal.textBody, fontSize: 13 }}>
          · {[byName, actionName].filter(Boolean).join(", ")}
        </span>
      ) : null}
      {entry.action?.crit ? (
        <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 2, ...badgeStyle("crit") }}>
          {badgeStyle("crit").label}
        </span>
      ) : null}
      {children ? <div style={{ flexBasis: "100%" }}>{children}</div> : null}
    </div>
  );
}

export function ConditionHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  const added = Array.isArray(entry.added) ? entry.added : [];
  const removed = Array.isArray(entry.removed) ? entry.removed : [];
  return (
    <div style={historyRowStyle(pal, opacity, showDivider)}>
      <span style={{ color: pal.accent, fontSize: 13, flexShrink: 0 }} aria-hidden="true">◈</span>
      <span style={{ color: pal.accentBright }}>{entry.subject?.name || "Someone"}</span>
      {added.map((c) => (
        <span key={`+${c}`} style={{ fontStyle: "italic" }}>+ {c}</span>
      ))}
      {removed.map((c) => (
        <span key={`-${c}`} style={{ fontStyle: "italic", color: pal.textMuted, textDecoration: "line-through" }}>{c}</span>
      ))}
      {entry.exhaustion ? (
        <span style={{ fontStyle: "italic" }}>Exhaustion {entry.exhaustion.from} → {entry.exhaustion.to}</span>
      ) : null}
    </div>
  );
}

export function TurnHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  return (
    <div style={{ ...historyRowStyle(pal, opacity, showDivider), color: pal.textMuted }}>
      <span style={{ color: pal.accent, fontSize: 12, flexShrink: 0 }} aria-hidden="true">⏵</span>
      <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Round {entry.round}</span>
      <span style={{ fontStyle: "italic" }}>{entry.subject?.name || "Someone"}&apos;s turn</span>
    </div>
  );
}

export function RollHistoryRow({ pal, entry, opacity = 1, showDivider = false, children = null }) {
  // Branch on type: "wheel" entries render differently from dice rows
  if (entry.type === "wheel") {
    return <WheelHistoryRow pal={pal} entry={entry} opacity={opacity} showDivider={showDivider} />;
  }
  if (entry.type === "hp") {
    return <HpHistoryRow pal={pal} entry={entry} opacity={opacity} showDivider={showDivider}>{children}</HpHistoryRow>;
  }
  if (entry.type === "condition") {
    return <ConditionHistoryRow pal={pal} entry={entry} opacity={opacity} showDivider={showDivider} />;
  }
  if (entry.type === "turn") {
    return <TurnHistoryRow pal={pal} entry={entry} opacity={opacity} showDivider={showDivider} />;
  }
  const actionLabel = normalizeRollActionLabel(entry.label);
  const nameColor = entry.nameColor || pal.accentBright;
  const totalAccentColor = entry.totalAccentColor || pal.gem;
  const rollValuesText = formatRollValues(entry.rollValues);
  const totalColor = entry.isCrit
    ? "#ffd060"
    : entry.isFumble
      ? "#c06060"
      : totalAccentColor;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "7px 0",
        borderBottom: showDivider ? `1px solid ${pal.border}` : "none",
        opacity,
        transition: "opacity 0.4s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
              fontFamily: pal.fontBody,
              fontSize: 11,
              color: pal.textBody,
              fontStyle: "italic",
              textTransform: "uppercase",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
          }
          }
        >
         {actionLabel}
         {/* Story 57 — declared-attack provenance (ADR-026). Rendered from the
             structured entry.target field, never parsed out of the label.
             ◎ (U+25CE) is the target glyph, used in exactly two places
             app-wide: this row and the Attack Bar's own target label. */}
         {entry.target ? (
           <span style={{ fontStyle: "italic", textTransform: "none" }}>
             {" → "}
             <span style={{ color: pal.accentBright }}>◎</span>
             {" "}{entry.target.name}
           </span>
         ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 4,
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          {entry.characterName ? (
            <span
              style={{
                fontFamily: pal.fontBody,
                fontSize: 16,
                color: nameColor,
                minWidth: 0,
              }}
            >
              {entry.characterName}
            </span>
          ) : null}
          <span
            style={{
              fontFamily: pal.fontUI,
              fontSize: 14,
              letterSpacing: "0.12em",
              // textTransform: "uppercase",
              color: pal.textMuted,
              marginBottom: 2,
            }}
          >
            {entry.exprLabel}
            
          </span>
        </div>
        {children}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
        {rollValuesText ? (
          <span
            style={{
              fontFamily: pal.fontUI,
              fontSize: 11,
              color: pal.textMuted,
              letterSpacing: "0.04em",
            }}
          >
            {rollValuesText}
          </span>
        ) : null}
        <span
          style={{
            fontFamily: pal.fontDisplay,
            fontSize: 24,
            minWidth: 28,
            textAlign: "right",
            color: totalColor,
            textShadow: entry.isCrit ? "0 0 6px rgba(255,200,40,0.4)" : "none",
          }}
        >
          {entry.total}
        </span>
        {entry.isCrit ? (
          <span
            style={{
              fontFamily: pal.fontUI,
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: 2,
              ...badgeStyle("crit"),
            }}
          >
            {badgeStyle("crit").label}
          </span>
        ) : null}
        {entry.isFumble ? (
          <span
            style={{
              fontFamily: pal.fontUI,
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: 2,
              ...badgeStyle("fumble"),
            }}
          >
            {badgeStyle("fumble").label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function RollHistoryList({ pal, title, entries, opacities }) {
  if (!entries.length) return null;

  return (
    <>
      <div
        style={{
          fontFamily: pal.fontUI,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: pal.textMuted,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {entries.map((entry, index) => {
          const opacity = opacities[index] ?? 0;
          if (opacity === 0) return null;
          return (
            <RollHistoryRow
              key={entry.id}
              pal={pal}
              entry={entry}
              opacity={opacity}
              showDivider={index < entries.length - 1}
            />
          );
        })}
      </div>
    </>
  );
}
