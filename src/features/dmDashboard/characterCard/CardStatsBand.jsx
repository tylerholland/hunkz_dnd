import { formatMod, getAbilityMods, getPassivePerception, getSkillNames, getSpeed, titleCase } from "../cardStats";
import { abilityCheckExpr } from "../../../lib/houseRules";
import { getTalentDetail } from "../../characterSheet/talentCatalog";
import { useTalentCodexVersion } from "../../characterSheet/talentCodexStore";
import "./cardStatsBand.css";

const KEY_ABILITIES = new Set(["Wis", "Con", "Dex"]);
// Skills, then special abilities (Ritual, Vision…), as name chips.
const MAX_GLANCE_CHIPS = 6;

// At-a-glance band (Stories 50/64): six ability modifiers, passive
// perception, speed, and skill and special-ability names (hover an ability for
// what it does). Clicking an ability score rolls a check with
// the table's house-rule dice (DM Settings; default 2d6) when onRoll is
// provided; skills are names only for now.
export default function CardStatsBand({ char, onRoll, expanded, onToggleExpand, checkDice }) {
  const abilities = getAbilityMods(char);
  useTalentCodexVersion(); // re-render when ability descriptions load
  const skills = getSkillNames(char).map((name) => ({ key: `s:${name}`, label: name, description: "" }));
  const specials = (char?.specialAbilities || [])
    .filter((a) => typeof a === "string" && a.trim())
    .map((a) => {
      const info = getTalentDetail(a);
      return { key: `a:${a}`, label: info.label && info.label !== a ? info.label : titleCase(a), description: info.description || "" };
    });
  const chips = [...skills, ...specials];
  const perception = getPassivePerception(char);
  const { speed, zeroed, notable } = getSpeed(char);
  const glanceChips = chips.slice(0, MAX_GLANCE_CHIPS);
  const hiddenChips = chips.length - glanceChips.length;

  return (
    <div className="cc-stats-band">
      <div className="cc-abil-row">
        {abilities.map(({ stat, abbr, mod }) => (
          <button
            key={stat}
            type="button"
            className={`cc-abil-cell${KEY_ABILITIES.has(abbr) ? " cc-abil-cell--key" : ""}`}
            onClick={() => onRoll?.(abilityCheckExpr(mod, checkDice), `${stat} check`, { isCheck: true })}
            disabled={!onRoll}
            title={onRoll ? `Roll ${stat} (${abilityCheckExpr(mod, checkDice)})` : stat}
          >
            <span className="cc-abil-abbr">{abbr}</span>
            <span className="cc-abil-mod">{formatMod(mod)}</span>
          </button>
        ))}
      </div>

      <div className="cc-skill-row">
        <span className="cc-glance-stat" title="Passive Perception">
          <span className="cc-glance-label">Perc</span>
          <span className="cc-glance-value">{perception}</span>
        </span>
        {notable && (
          <span className={`cc-glance-stat${zeroed ? " cc-glance-stat--zero" : ""}`} title="Speed">
            <span className="cc-glance-value">{speed}ft</span>
          </span>
        )}
        {glanceChips.map(({ key, label, description }) => (
          <span key={key} className="cc-skill-chip cc-skill-chip--static" title={description || undefined}>{label}</span>
        ))}
        {hiddenChips > 0 && (
          <button type="button" className="cc-skill-chip cc-skill-chip--more" onClick={() => !expanded && onToggleExpand()}>
            +{hiddenChips}
          </button>
        )}
      </div>

      <button
        type="button"
        className={`cc-loadout-toggle${expanded ? " open" : ""}`}
        onClick={onToggleExpand}
        aria-expanded={expanded}
      >
        <span className="cc-loadout-caret" aria-hidden="true">▸</span>
        Weapons · Spells · Abilities · Inventory
      </button>
    </div>
  );
}
