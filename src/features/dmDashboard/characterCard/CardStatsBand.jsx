import { formatMod, getAbilityMods, getPassivePerception, getSkillBonuses, getSpeed } from "../cardStats";
import "./cardStatsBand.css";

const KEY_ABILITIES = new Set(["Wis", "Con", "Dex"]);
const MAX_GLANCE_SKILLS = 4;

// At-a-glance band (Stories 50/64): six ability modifiers, passive
// perception, speed, and proficient skills. Clicking a value rolls it when
// onRoll is provided.
export default function CardStatsBand({ char, onRoll, expanded, onToggleExpand }) {
  const abilities = getAbilityMods(char);
  const skills = getSkillBonuses(char);
  const perception = getPassivePerception(char);
  const { speed, zeroed, notable } = getSpeed(char);
  const glanceSkills = skills.slice(0, MAX_GLANCE_SKILLS);
  const hiddenSkills = skills.length - glanceSkills.length;

  const roll = (bonus, label) => onRoll?.(`1d20${bonus >= 0 ? "+" : ""}${bonus}`, label);

  return (
    <div className="cc-stats-band">
      <div className="cc-abil-row">
        {abilities.map(({ stat, abbr, mod }) => (
          <button
            key={stat}
            type="button"
            className={`cc-abil-cell${KEY_ABILITIES.has(abbr) ? " cc-abil-cell--key" : ""}`}
            onClick={() => roll(mod, `${stat} check`)}
            disabled={!onRoll}
            title={onRoll ? `Roll ${stat} (1d20${formatMod(mod)})` : stat}
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
        {glanceSkills.map(({ name, bonus }) => (
          <button
            key={name}
            type="button"
            className="cc-skill-chip"
            onClick={() => bonus !== null && roll(bonus, name)}
            disabled={!onRoll || bonus === null}
            title={bonus !== null && onRoll ? `Roll ${name} (1d20${formatMod(bonus)})` : name}
          >
            {name}{bonus !== null && <span className="cc-skill-bonus">{formatMod(bonus)}</span>}
          </button>
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
