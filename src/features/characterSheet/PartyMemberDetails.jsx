import { useState } from "react";
import { getTalentDetail } from "./talentCatalog";
import { useTalentCodexVersion } from "./talentCodexStore";
import MarkdownLite from "../../components/MarkdownLite";

const ABILITY_ABBR = [
  ["Strength", "STR"], ["Dexterity", "DEX"], ["Constitution", "CON"],
  ["Intelligence", "INT"], ["Wisdom", "WIS"], ["Charisma", "CHA"],
];

const titleCase = (text) => String(text || "").replace(/\b\w/g, (ch) => ch.toUpperCase());
const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * Story 61 — a teammate's expandable detail on the player's Party list:
 * race/class/level, ability modifiers, and skills/abilities/spells by name
 * (tap one for its description). Never inventory — the server doesn't send it.
 */
export default function PartyMemberDetails({ card, id }) {
  useTalentCodexVersion(); // re-render when the DM's codex arrives
  const [selected, setSelected] = useState(null); // { key, label, description }
  if (!card) return null;

  const identity = [card.race, card.charClass, card.subclass].filter(Boolean).join(" · ");
  const talents = [
    ...(card.skills || []).map((key) => ({ key: `skill:${key}`, raw: key })),
    ...(card.specialAbilities || []).map((key) => ({ key: `ability:${key}`, raw: key })),
  ].map(({ key, raw }) => {
    const info = getTalentDetail(raw);
    return { key, label: info.label && info.label !== raw ? info.label : titleCase(raw), description: info.description || "", atTable: info.atTable || "" };
  });
  const spells = (card.spells || []).map((spell) => ({
    key: `spell:${spell.name}`,
    label: spell.name,
    description: spell.description || "",
    role: spell.role,
  }));

  const chip = (item, glyph) => (
    <button
      key={item.key}
      type="button"
      className={`cs-sm-party-chip${selected?.key === item.key ? " selected" : ""}${item.description ? "" : " no-detail"}`}
      aria-pressed={selected?.key === item.key}
      disabled={!item.description}
      title={item.description ? "Show description" : undefined}
      onClick={() => setSelected((cur) => (cur?.key === item.key ? null : item))}
    >
      {glyph ? <span aria-hidden="true">{glyph} </span> : null}
      {item.label}
    </button>
  );

  return (
    <div className="cs-sm-party-details" id={id}>
      {(identity || card.level) && (
        <div className="cs-sm-party-identity">
          {identity}
          {card.level ? `${identity ? " · " : ""}Level ${card.level}` : ""}
        </div>
      )}
      <div className="cs-sm-party-mods" role="list" aria-label="Ability modifiers">
        {ABILITY_ABBR.map(([stat, abbr]) => (
          <span key={stat} className="cs-sm-party-mod" role="listitem">
            <small>{abbr}</small>
            <b>{fmtMod(card.abilityMods?.[stat] ?? 0)}</b>
          </span>
        ))}
      </div>
      {(talents.length > 0 || spells.length > 0) && (
        <div className="cs-sm-party-chips">
          {talents.map((t) => chip(t))}
          {spells.map((s) => chip(s, s.role === "heal" ? "✚" : "✶"))}
        </div>
      )}
      {selected?.description && (
        <div className="cs-sm-party-chip-desc" aria-live="polite">
          <b>{selected.label}.</b>
          <MarkdownLite text={selected.description} className="cs-tip-desc" />
          {selected.atTable ? (
            <span className="cs-tip-table" style={{ borderTopColor: "var(--pal-border)" }}>
              <span className="cs-tip-table-label" style={{ color: "var(--pal-accent-bright)" }}>At the table</span>
              <MarkdownLite text={selected.atTable} className="cs-tip-desc" />
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
