import { useState } from "react";
import { formatRollValues, normalizeRollActionLabel } from "../lib/rollHistory";
import "./rollHistory.css";

// A label on any logged event ("Climbing the grate"), set by the player when
// rolling or by the DM at any time. With `onSaveTag` (DM only) a faint ✎
// edits it inline: Enter saves, Esc cancels. `onSaveTag(entry, tag)` returns a
// promise; the new label shows at once and reverts if the save fails.
export function RowTag({ pal, entry, onSaveTag }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [localTag, setLocalTag] = useState(null); // shown until the log catches up
  const [failed, setFailed] = useState(false);
  const tag = localTag ?? entry.tag ?? "";

  function start(e) {
    e.stopPropagation();
    setDraft(tag);
    setFailed(false);
    setEditing(true);
  }
  async function save() {
    const next = draft.trim().slice(0, 60);
    setEditing(false);
    if (next === tag) return;
    setLocalTag(next);
    try {
      await onSaveTag(entry, next);
    } catch {
      setLocalTag(null);
      setFailed(true);
    }
  }

  if (editing) {
    return (
      <span className="rh-tag-edit" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={draft}
          maxLength={60}
          aria-label="Label this roll"
          placeholder="e.g. Persuade the goblin king"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
          }}
          onBlur={save}
          style={{ fontFamily: pal.fontBody, color: pal.text, borderColor: pal.accent }}
        />
      </span>
    );
  }
  return (
    <>
      {tag ? <span className="rh-tag" style={{ fontFamily: pal.fontUI, color: pal.textMuted }}> · {tag}</span> : null}
      {onSaveTag ? (
        <button
          type="button"
          className={`rh-tag-pencil${failed ? " failed" : ""}`}
          onClick={start}
          aria-label={tag ? "Change this label" : "Label this roll"}
          title={failed ? "Couldn't save the label — try again" : tag ? "Change the label" : "Label this roll"}
          style={{ color: failed ? "#d08080" : pal.textMuted }}
        >✎</button>
      ) : null}
    </>
  );
}

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

export function WheelHistoryRow({ pal, entry, opacity = 1, showDivider = false, onSaveTag }) {
  const isFillChange = Number.isFinite(entry.filledCount);
  return (
    <div
      className="rh-row"
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
      <RowTag pal={pal} entry={entry} onSaveTag={onSaveTag} />
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

export function HpHistoryRow({ pal, entry, opacity = 1, showDivider = false, children = null, onSaveTag }) {
  const delta = Number.isFinite(entry.delta) ? entry.delta : 0;
  const kind = entry.miss ? "miss" : delta < 0 ? "damage" : "heal";
  const glyph = kind === "miss" ? "○" : kind === "damage" ? "⚔" : "✚";
  const color = kind === "miss" ? pal.textMuted : kind === "damage" ? HP_DAMAGE : HP_HEAL;
  const byName = entry.by?.name;
  const actionName = entry.action?.name;
  return (
    <div className="rh-row" style={historyRowStyle(pal, opacity, showDivider)}>
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
      <RowTag pal={pal} entry={entry} onSaveTag={onSaveTag} />
      {children ? <div style={{ flexBasis: "100%" }}>{children}</div> : null}
    </div>
  );
}

export function ConditionHistoryRow({ pal, entry, opacity = 1, showDivider = false, onSaveTag }) {
  const added = Array.isArray(entry.added) ? entry.added : [];
  const removed = Array.isArray(entry.removed) ? entry.removed : [];
  return (
    <div className="rh-row" style={historyRowStyle(pal, opacity, showDivider)}>
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
      <RowTag pal={pal} entry={entry} onSaveTag={onSaveTag} />
    </div>
  );
}

export function TurnHistoryRow({ pal, entry, opacity = 1, showDivider = false, onSaveTag }) {
  return (
    <div className="rh-row" style={{ ...historyRowStyle(pal, opacity, showDivider), color: pal.textMuted }}>
      <span style={{ color: pal.accent, fontSize: 12, flexShrink: 0 }} aria-hidden="true">⏵</span>
      <span style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Round {entry.round}</span>
      <span style={{ fontStyle: "italic" }}>{entry.subject?.name || "Someone"}&apos;s turn</span>
      <RowTag pal={pal} entry={entry} onSaveTag={onSaveTag} />
    </div>
  );
}

// Spell effects — "✦ Hex takes effect → ◎ Carrion Crawler", posted by the
// caster for the DM to apply. Once applied, the DM's note on what it does
// shows underneath. `children` holds the DM's Apply Effect action.
export function EffectHistoryRow({ pal, entry, opacity = 1, showDivider = false, children = null, below = null, onSaveTag }) {
  const note = entry.applied?.note;
  return (
    <div
      className="rh-row rh-effect-row"
      style={{ padding: "7px 0", borderBottom: showDivider ? `1px solid ${pal.border}` : "none", opacity, transition: "opacity 0.4s" }}
    >
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 12px" }}>
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          {entry.characterName ? (
            <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.06em", color: entry.nameColor || pal.accentBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.characterName}
            </div>
          ) : null}
          <div style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.text, lineHeight: 1.3 }}>
            <span className="rh-effect-name">✦ {entry.attack?.name || entry.effect} takes effect</span>
            {entry.target ? (
              <span>{" → "}<span style={{ color: pal.accentBright }}>◎</span>{" "}{entry.target.name}</span>
            ) : null}
            <RowTag pal={pal} entry={entry} onSaveTag={onSaveTag} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: "auto" }}>{children}</div>
      </div>
      {note ? <div className="rh-effect-note" style={{ fontFamily: pal.fontBody, color: pal.textBody }}>{note}</div> : null}
      {below}
    </div>
  );
}

export function RollHistoryRow({ pal, entry, opacity = 1, showDivider = false, children = null, below = null, onSaveTag }) {
  // Branch on type: "wheel" entries render differently from dice rows
  const rowProps = { pal, entry, opacity, showDivider, onSaveTag };
  if (entry.type === "wheel") return <WheelHistoryRow {...rowProps} />;
  if (entry.type === "hp") return <HpHistoryRow {...rowProps}>{children}</HpHistoryRow>;
  if (entry.type === "condition") return <ConditionHistoryRow {...rowProps} />;
  if (entry.type === "turn") return <TurnHistoryRow {...rowProps} />;
  if (entry.type === "effect") return <EffectHistoryRow {...rowProps} below={below}>{children}</EffectHistoryRow>;
  // A spell's cast roll reads "casts Hex" rather than "Hex CAST".
  const isCast = entry.attack?.kind === "spell" && /\bCAST\b/.test(String(entry.label || ""));
  const actionLabel = isCast ? null : normalizeRollActionLabel(entry.label);
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
      className="rh-row"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "4px 12px",
        padding: "7px 0",
        borderBottom: showDivider ? `1px solid ${pal.border}` : "none",
        opacity,
        transition: "opacity 0.4s",
      }}
    >
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        {/* Who rolled — small; the action itself carries the emphasis. */}
        {entry.characterName ? (
          <div
            style={{
              fontFamily: pal.fontUI,
              fontSize: 12,
              letterSpacing: "0.06em",
              color: nameColor,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.characterName}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: pal.fontBody,
            fontSize: 16,
            color: pal.text,
            minWidth: 0,
            lineHeight: 1.3,
          }}
        >
          {isCast ? (
            <><span style={{ fontStyle: "italic" }}>casts</span> {entry.attack.name}</>
          ) : actionLabel}
          {/* Story 57 — declared-attack provenance (ADR-026). Rendered from the
              structured entry.target field, never parsed out of the label.
              ◎ (U+25CE) is the target glyph, used in exactly two places
              app-wide: this row and the Attack Bar's own target label. */}
          {entry.target ? (
            <span>
              {" → "}
              <span style={{ color: pal.accentBright }}>◎</span>
              {" "}{entry.target.name}
            </span>
          ) : null}
          {entry.exprLabel ? (
            <span style={{ fontFamily: pal.fontUI, fontSize: 13, letterSpacing: "0.08em", color: pal.textMuted }}>
              {" "}({entry.exprLabel})
            </span>
          ) : null}
          <RowTag pal={pal} entry={entry} onSaveTag={onSaveTag} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: "auto" }}>
        {/* Row actions (e.g. Deal Damage / Applied) sit beside the result. */}
        {children}
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
