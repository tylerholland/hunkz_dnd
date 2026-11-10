import { useState } from "react";
import { formatRollValues, normalizeRollActionLabel } from "../lib/rollHistory";
import "./rollHistory.css";
import { checkName } from "../features/rollRequests/rollCheck";
import { voteLogText } from "../features/vote/voteUtil";

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
          style={{ color: failed ? "#d08080" : pal.accentBright }}
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

// An HP change shown inside the roll that caused it (the DM's log groups them):
// "→ Varn −3  10 → 7 / 10 HP", or "→ Varn: missed".
export function HpOutcomeLine({ pal, entry }) {
  const delta = Number.isFinite(entry.delta) ? entry.delta : 0;
  const color = entry.miss ? pal.textMuted : delta < 0 ? HP_DAMAGE : HP_HEAL;
  return (
    <div className="rh-outcome" style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0 8px", marginTop: 2, paddingLeft: 10, borderLeft: `2px solid ${color}`, fontFamily: pal.fontBody, fontSize: 14 }}>
      <span style={{ color: pal.textMuted }} aria-hidden="true">→</span>
      <span style={{ color: pal.accentBright }}>{entry.subject?.name || "Someone"}</span>
      {entry.miss ? (
        <span style={{ fontStyle: "italic", color: pal.textMuted }}>missed</span>
      ) : (
        <>
          <span style={{ fontFamily: pal.fontDisplay, fontSize: 16, color }}>{delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`}</span>
          {Number.isFinite(entry.from) && Number.isFinite(entry.to) && (
            <span style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted }}>{entry.from} → {entry.to}{Number.isFinite(entry.max) ? ` / ${entry.max}` : ""} HP</span>
          )}
          {entry.action?.crit && <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 2, ...badgeStyle("crit") }}>{badgeStyle("crit").label}</span>}
        </>
      )}
    </div>
  );
}

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

// Story 72 — a purchase or sale at the shop.
export function ShopHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  const things = (entry.items || []).map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ");
  return (
    <div className="rh-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: showDivider ? `1px solid ${pal.border}` : "none", opacity, transition: "opacity 0.4s" }}>
      {/* Money in the log: a plain $, single-colour like the other glyphs (⚔ ✚ ○ ✦). */}
      <span style={{ color: pal.accent, fontFamily: pal.fontUI, fontSize: 14, lineHeight: 1, flexShrink: 0, width: 13, textAlign: "center" }} aria-hidden="true">$</span>
      <span style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.accentBright, flexShrink: 0 }}>{entry.characterName}</span>
      <span style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 14, color: pal.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {entry.action === "sold" ? "sold" : "bought"} {things}{entry.shop ? ` at ${entry.shop}` : ""}
      </span>
      <span style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textBody, marginLeft: "auto", flexShrink: 0 }}>{entry.action === "sold" ? "+" : "−"}{entry.total}s</span>
    </div>
  );
}

// The party vote's outcome (or just that one was held, if the DM kept the result).
export function VoteHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  return (
    <div className="rh-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: showDivider ? `1px solid ${pal.border}` : "none", opacity, transition: "opacity 0.4s" }}>
      <span style={{ color: pal.accent, fontFamily: pal.fontUI, fontSize: 13, lineHeight: 1, flexShrink: 0, width: 13, textAlign: "center" }} aria-hidden="true">⚑</span>
      <span style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 14, color: pal.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{voteLogText(entry)}</span>
      {!entry.hidden && Number.isFinite(entry.top) && entry.top > 0 && (
        <span style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textBody, marginLeft: "auto", flexShrink: 0 }}>{entry.top} of {entry.voted}</span>
      )}
    </div>
  );
}

// A roll the DM asked for, once it's closed: the check, then each result
// (✓ / ✗ against a DC the viewer may see). Players get their own row unless
// the DM revealed everyone's; the label is the DM's.
export function CheckHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  const rows = Array.isArray(entry.rows) ? entry.rows : [];
  return (
    <div className="rh-row" style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2px 8px", padding: "7px 0", borderBottom: showDivider ? `1px solid ${pal.border}` : "none", opacity, transition: "opacity 0.4s" }}>
      <span style={{ color: pal.accent, fontFamily: pal.fontUI, fontSize: 13, lineHeight: 1, flexShrink: 0, width: 13, textAlign: "center" }} aria-hidden="true">◎</span>
      <span style={{ fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 14, color: pal.text }}>
        {entry.label ? `${entry.label} · ` : ""}{checkName(entry.check)}{entry.dc ? ` · DC ${entry.dc}` : ""}
      </span>
      <span style={{ flexBasis: "100%", height: 0 }} />
      <span style={{ paddingLeft: 21, fontFamily: pal.fontBody, fontSize: 14, color: pal.textBody }}>
        {rows.map((r, i) => (
          <span key={r.slug || i}>
            {i > 0 && " · "}{r.name || r.slug} <b style={{ fontFamily: pal.fontDisplay, fontWeight: 400, color: r.pass === true ? "#5fbf7f" : r.pass === false ? "#d07a6a" : pal.text }}>{r.total ?? "—"}</b>{r.pass === true ? " ✓" : r.pass === false ? " ✗" : ""}
          </span>
        ))}
      </span>
    </div>
  );
}

// The DM's prep deck: a moment read to everyone, a note passed (its words for
// the DM and its recipients; for others just that it was passed), a reply.
const rowBase = (pal, opacity, showDivider) => ({ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2px 8px", padding: "7px 0", borderBottom: showDivider ? `1px solid ${pal.border}` : "none", opacity, transition: "opacity 0.4s" });
const glyph = (pal) => ({ color: pal.accent, fontFamily: pal.fontUI, fontSize: 13, lineHeight: 1, flexShrink: 0, width: 13, textAlign: "center" });
const quote = (pal) => ({ flexBasis: "100%", margin: "2px 0 0 21px", paddingLeft: 10, borderLeft: `2px solid ${pal.border}`, fontFamily: pal.fontBody, fontStyle: "italic", fontSize: 14, color: pal.textBody, whiteSpace: "pre-line" });

export function MomentHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  return (
    <div className="rh-row" style={rowBase(pal, opacity, showDivider)}>
      <span style={glyph(pal)} aria-hidden="true">❧</span>
      <span style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.text }}>Read to everyone{entry.title ? ` · ${entry.title}` : ""}</span>
      <p style={{ ...quote(pal), display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{entry.text}</p>
    </div>
  );
}

export function NoteHistoryRow({ pal, entry, opacity = 1, showDivider = false }) {
  const to = (entry.toNames || entry.to || []).join(", ");
  return (
    <div className="rh-row" style={rowBase(pal, opacity, showDivider)}>
      <span style={glyph(pal)} aria-hidden="true">✉</span>
      <span style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.text }}>
        {entry.passed ? `The DM passed ${to} a note` : `Note to ${to}${entry.title ? ` · ${entry.title}` : ""}`}
      </span>
      {!entry.passed && entry.text && <p style={quote(pal)}>{entry.text}</p>}
    </div>
  );
}

export function NoteReplyRow({ pal, entry, opacity = 1, showDivider = false }) {
  return (
    <div className="rh-row" style={rowBase(pal, opacity, showDivider)}>
      <span style={glyph(pal)} aria-hidden="true">↩</span>
      <span style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.text }}>{entry.name} replied{entry.title ? ` to “${entry.title}”` : ""}</span>
      <p style={quote(pal)}>{entry.text}</p>
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
  if (entry.type === "shop") return <ShopHistoryRow {...rowProps} />;
  if (entry.type === "vote") return <VoteHistoryRow {...rowProps} />;
  if (entry.type === "check") return <CheckHistoryRow {...rowProps} />;
  if (entry.type === "moment") return <MomentHistoryRow {...rowProps} />;
  if (entry.type === "note") return <NoteHistoryRow {...rowProps} />;
  if (entry.type === "note-reply") return <NoteReplyRow {...rowProps} />;
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
          {/* Story 70 — effect riders rolled into this damage (Hex +4). */}
          {Array.isArray(entry.riders) && entry.riders.length ? (
            <span className="rh-rider"> · incl. ✦ {entry.riders.map((r) => `${r.label} +${r.total}`).join(", ")}</span>
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
      {/* A line under the whole row (e.g. the HP change this roll caused). */}
      {below ? <div style={{ flexBasis: "100%" }}>{below}</div> : null}
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
