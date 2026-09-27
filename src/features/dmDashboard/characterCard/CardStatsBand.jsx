import { abilityCheckExpr, formatMod, getAbilityMods, getPassivePerception, getSkillNames, getSpeed } from "../cardStats";
import "./cardStatsBand.css";

const KEY_ABILITIES = new Set(["Wis", "Con", "Dex"]);
const MAX_GLANCE_SKILLS = 4;

// At-a-glance band (Stories 50/64): six ability modifiers, passive
// perception, speed, and skill names. Clicking an ability rolls a 2d6 check
// (Story 32) when onRoll is provided; skills are names only for now.
export default function CardStatsBand({ char, onRoll, expanded, onToggleExpand }) {
  const abilities = getAbilityMods(char);
  const skills = getSkillNames(char);
  const perception = getPassivePerception(char);
  const { speed, zeroed, notable } = getSpeed(char);
  const glanceSkills = skills.slice(0, MAX_GLANCE_SKILLS);
  const hiddenSkills = skills.length - glanceSkills.length;

  return (
    <div className="cc-stats-band">
      <div className="cc-abil-row">
        {abilities.map(({ stat, abbr, mod }) => (
          <button
            key={stat}
            type="button"
            className={`cc-abil-cell${KEY_ABILITIES.has(abbr) ? " cc-abil-cell--key" : ""}`}
            onClick={() => onRoll?.(abilityCheckExpr(mod), `${stat} check`)}
            disabled={!onRoll}
            title={onRoll ? `Roll ${stat} (${abilityCheckExpr(mod)})` : stat}
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
        {glanceSkills.map((name) => (
          <span key={name} className="cc-skill-chip cc-skill-chip--static">{name}</span>
        ))}
        {hiddenSkills > 0 && (
          <button type="button" className="cc-skill-chip cc-skill-chip--more" onClick={() => !expanded && onToggleExpand()}>
            +{hiddenSkills}
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
