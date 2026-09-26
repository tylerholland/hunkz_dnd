import { useEffect, useRef } from "react";
import { formatMod, getSkillBonuses, groupDrawerContent, titleCase } from "../cardStats";
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

const rollExpr = (bonus) => `1d20${bonus >= 0 ? "+" : ""}${bonus}`;

function ItemList({ items, renderExtra }) {
  return (
    <ul className="cc-drawer-list">
      {items.map((item, idx) => (
        <li key={item.id || idx} className={`cc-drawer-item${item.stowed ? " muted" : ""}`}>
          <span className="cc-drawer-name">
            {item.name}<ItemQty qty={item.qty} />
            {item.mods && <span className="cc-drawer-mods">{item.mods}</span>}
          </span>
          {item.requiresAttunement && (
            <span className={`cc-drawer-attune${item.attuned ? " on" : ""}`} title={item.attuned ? "Attuned" : "Not attuned"} />
          )}
          {renderExtra?.(item)}
        </li>
      ))}
    </ul>
  );
}

// Read-only loadout drawer (Stories 51/58). One open at a time — the parent
// owns which card is expanded. Sections follow the DM's mid-scene questions
// (see groupDrawerContent); empty sections don't render.
export default function CardLoadoutDrawer({ char, onRoll }) {
  const ref = useRef(null);
  const { attacks, gear, consumables, spells, pack } = groupDrawerContent(char);
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
  const nothing = !attacks.length && !gear.length && !consumables.length && !spells.length && !abilities.length && !skills.length && !pack.length;

  return (
    <div className="cc-drawer" ref={ref}>
      {nothing && <div className="cc-drawer-empty cc-drawer-section">Nothing on this character yet.</div>}

      {attacks.length > 0 && (
        <Section title="Attacks" count={attacks.length}>
          <ItemList
            items={attacks}
            renderExtra={(entry) => (
              <>
                {entry.kind === "spell" && <span className="cc-drawer-tag">spell</span>}
                {entry.attack !== null && (
                  <button type="button" className="cc-drawer-roll" disabled={!onRoll}
                    onClick={() => onRoll?.(rollExpr(entry.attack), `${entry.name} attack`)}
                    title={onRoll ? "Roll attack" : undefined}
                  >{formatMod(entry.attack)} hit</button>
                )}
                {entry.damage && (
                  <button type="button" className="cc-drawer-roll" disabled={!onRoll}
                    onClick={() => onRoll?.(entry.damage, `${entry.name} damage`)}
                    title={onRoll ? "Roll damage" : undefined}
                  >{entry.damage}</button>
                )}
              </>
            )}
          />
        </Section>
      )}

      {gear.length > 0 && (
        <Section title="Gear" count={gear.length}>
          <ItemList items={gear} />
        </Section>
      )}

      {consumables.length > 0 && (
        <Section title="Consumables" count={consumables.length}>
          <ItemList items={consumables} />
        </Section>
      )}

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

      {(abilities.length > 0 || skills.length > 0) && (
        <Section title="Abilities & Skills">
          {abilities.length > 0 && (
            <div className="cc-drawer-chips">
              {abilities.map((ability) => <span key={ability} className="cc-drawer-chip">{titleCase(ability)}</span>)}
            </div>
          )}
          {skills.length > 0 && (
            <div className={`cc-drawer-chips${abilities.length > 0 ? " cc-drawer-chips--spaced" : ""}`}>
              {skills.map(({ name, bonus }) => (
                <button key={name} type="button" className="cc-skill-chip" disabled={!onRoll || bonus === null}
                  onClick={() => bonus !== null && onRoll?.(rollExpr(bonus), name)}
                >{name}{bonus !== null && <span className="cc-skill-bonus">{formatMod(bonus)}</span>}</button>
              ))}
            </div>
          )}
        </Section>
      )}

      {pack.length > 0 && (
        <Section title="Pack" count={pack.length}>
          <ItemList items={pack} />
        </Section>
      )}
    </div>
  );
}
