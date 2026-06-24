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
        — {entry.segments} segments
      </span>
    </div>
  );
}

export function RollHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  // Branch on type: "wheel" entries render differently from dice rows
  if (entry.type === "wheel") {
    return <WheelHistoryRow pal={pal} entry={entry} opacity={opacity} showDivider={showDivider} />;
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
