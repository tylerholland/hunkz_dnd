import { useEffect, useRef } from "react";
import { formatMod, getSkillBonuses, getWeaponSummary, titleCase } from "../cardStats";
import "./cardStatsBand.css";

function Section({ title, count, children }) {
  return (
    <section className="cc-drawer-section">
      <h4 className="cc-drawer-title">{title}{count != null && <span className="cc-drawer-count">{count}</span>}</h4>
      {children}
    </section>
  );
}

// "Torch (4)" — same treatment as the Session Inventory row; (0) = used up.
function ItemQty({ qty }) {
  if (qty == null || qty === 1) return null;
  return (
    <span className={`cc-drawer-qty${qty === 0 ? " depleted" : ""}`}> (<span className="cc-drawer-qty-num">{qty}</span>)</span>
  );
}

function spellLevelLabel(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return "Cantrips";
  return `Level ${n}`;
}

// Read-only loadout drawer (Story 51). One open at a time — the parent owns
// which card is expanded.
export default function CardLoadoutDrawer({ char, onRoll }) {
  const ref = useRef(null);
  const weapons = (char.weapons || []).filter(Boolean);
  const equipment = (char.equipment || []).filter(Boolean);
  const spells = (char.spells || []).filter((spell) => spell && spell.name);
  const abilities = (char.specialAbilities || []).filter((a) => typeof a === "string" && a.trim());
  const skills = getSkillBonuses(char);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, []);

  const spellGroups = spells.reduce((groups, spell) => {
    const label = spellLevelLabel(spell.level);
    (groups[label] ||= []).push(spell);
    return groups;
  }, {});
  const spellGroupKeys = Object.keys(spellGroups).sort((a, b) => (a === "Cantrips" ? -1 : b === "Cantrips" ? 1 : a.localeCompare(b, undefined, { numeric: true })));

  return (
    <div className="cc-drawer" ref={ref}>
      <Section title="Weapons" count={weapons.length}>
        {weapons.length === 0 ? <div className="cc-drawer-empty">None</div> : (
          <ul className="cc-drawer-list">
            {weapons.map((weapon, idx) => {
              const { attack, damage } = getWeaponSummary(weapon);
              return (
                <li key={weapon.id || idx} className={`cc-drawer-item${weapon.equipped === false ? " muted" : ""}`}>
                  <span className="cc-drawer-name">{weapon.name || "Unnamed"}<ItemQty qty={weapon.qty} /></span>
                  {attack !== null && (
                    <button type="button" className="cc-drawer-roll" disabled={!onRoll}
                      onClick={() => onRoll?.(`1d20${attack >= 0 ? "+" : ""}${attack}`, `${weapon.name} attack`)}
                      title={onRoll ? "Roll attack" : undefined}
                    >{formatMod(attack)} hit</button>
                  )}
                  {damage && (
                    <button type="button" className="cc-drawer-roll" disabled={!onRoll}
                      onClick={() => onRoll?.(damage, `${weapon.name} damage`)}
                      title={onRoll ? "Roll damage" : undefined}
                    >{damage}</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {spells.length > 0 && (
        <Section title="Spells" count={spells.length}>
          {spellGroupKeys.map((key) => (
            <div key={key} className="cc-drawer-spell-group">
              <span className="cc-drawer-sublabel">{key}</span>
              <div className="cc-drawer-chips">
                {spellGroups[key].map((spell, idx) => (
                  <span key={spell.id || `${key}-${idx}`} className="cc-drawer-chip" title={spell.description || spell.name}>{spell.name}</span>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {abilities.length > 0 && (
        <Section title="Special Abilities" count={abilities.length}>
          <div className="cc-drawer-chips">
            {abilities.map((ability) => <span key={ability} className="cc-drawer-chip">{titleCase(ability)}</span>)}
          </div>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills" count={skills.length}>
          <div className="cc-drawer-chips">
            {skills.map(({ name, bonus }) => (
              <button key={name} type="button" className="cc-skill-chip" disabled={!onRoll || bonus === null}
                onClick={() => bonus !== null && onRoll?.(`1d20${bonus >= 0 ? "+" : ""}${bonus}`, name)}
              >{name}{bonus !== null && <span className="cc-skill-bonus">{formatMod(bonus)}</span>}</button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Inventory" count={equipment.length}>
        {equipment.length === 0 ? <div className="cc-drawer-empty">Empty</div> : (
          <ul className="cc-drawer-list">
            {equipment.map((item, idx) => (
              <li key={item.id || idx} className={`cc-drawer-item${item.equipped === false ? " muted" : ""}`}>
                <span className="cc-drawer-name">{item.name || "Unnamed"}<ItemQty qty={item.qty} /></span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
