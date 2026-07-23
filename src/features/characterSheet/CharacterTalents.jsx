import { useState } from "react";
import { getOrderedTalentEntries, getTalentTooltip } from "./talentCatalog";

export function InfoBadge({
  pal,
  label,
  tooltip,
  compact = false,
  color,
  background,
  border,
  // Optional toggle mode (Edit Character's skill/ability pickers): when
  // onSelect is provided, clicking selects/deselects instead of pinning the
  // tooltip open, and `selected` drives the active visual state. Hovering or
  // focusing always shows the tooltip either way.
  selected,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const isToggle = typeof onSelect === "function";

  return (
    <button
      type="button"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={isToggle ? onSelect : () => setOpen((value) => !value)}
      aria-pressed={isToggle ? !!selected : undefined}
      style={{
        position: "relative",
        fontFamily: pal.fontUI,
        fontSize: compact ? 9 : 11,
        letterSpacing: compact ? "0.08em" : "0.1em",
        textTransform: "uppercase",
        color,
        background,
        border: `1px solid ${border}`,
        borderRadius: compact ? 10 : 12,
        padding: compact ? "2px 7px" : "3px 10px",
        whiteSpace: "nowrap",
        cursor: isToggle ? "pointer" : "help",
      }}
    >
      {label}
      {open && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 8px)",
            transform: "translateX(-50%)",
            zIndex: 80,
            minWidth: compact ? 120 : 150,
            maxWidth: 220,
            padding: compact ? "6px 8px" : "8px 10px",
            borderRadius: 6,
            border: `1px solid ${pal.border}`,
            background: pal.surfaceSolid,
            color: pal.text,
            fontFamily: pal.fontBody,
            fontSize: compact ? 12 : 13,
            letterSpacing: "0.02em",
            lineHeight: 1.35,
            textTransform: "none",
            whiteSpace: "normal",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        >
          {tooltip}
        </span>
      )}
    </button>
  );
}

export default function CharacterTalents({
  pal,
  skills = [],
  specialAbilities = [],
  title = null,
  compact = false,
  maxVisible = null,
}) {
  const entries = getOrderedTalentEntries(skills, specialAbilities);
  if (!entries.length) return null;

  const visibleEntries = maxVisible ? entries.slice(0, maxVisible) : entries;
  const overflowCount = entries.length - visibleEntries.length;

  return (
    <div>
      {title ? (
        <div style={{ fontFamily: pal.fontUI, fontSize: compact ? 10 : 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>
          {title}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 5 : 6, alignItems: "center" }}>
        {visibleEntries.map((entry) => {
          const isSkill = entry.kind === "skill";
          const bg = isSkill ? `${pal.accent}16` : `${pal.gem}14`;
          const border = isSkill ? `${pal.accent}66` : `${pal.gem}55`;
          const color = isSkill ? pal.accentBright : pal.gem;
          return (
            <InfoBadge
              key={entry.key}
              pal={pal}
              label={entry.label}
              tooltip={getTalentTooltip(entry.key)}
              compact={compact}
              color={color}
              background={bg}
              border={border}
            />
          );
        })}
        {overflowCount > 0 ? (
          <span style={{ fontFamily: pal.fontUI, fontSize: compact ? 9 : 11, letterSpacing: "0.08em", color: pal.textMuted }}>
            +{overflowCount} more
          </span>
        ) : null}
      </div>
    </div>
  );
}
