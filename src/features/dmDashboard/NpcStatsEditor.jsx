// A creature's defense and abilities (design/prototypes/npc-abilities.html),
// used in the Enemies Gallery (library creatures) and the NPC card's modal.
// One list: each ability has a name and notes; switched to "Can be rolled" it
// gets a look, an attack roll and damage, and shows in Take Action. Edits raw
// values; the caller saves them through normalizeDefense/normalizeAbilities.
import { useState } from "react";
import LookIcon from "./LookIcon";
import { LOOK_GROUPS, chanceToReach, guessLook, isDice, lookLabel } from "./npcStats";
import "./npcStats.css";

let nextId = 0;
const newId = () => `ab-${Date.now().toString(36)}-${(nextId += 1)}`;
// Red only once something unreadable is typed; empty is just unfinished.
const badDice = (v) => !!(v && String(v).trim()) && !isDice(v);

export default function NpcStatsEditor({ defense, abilities, onChange }) {
  const [lookOpen, setLookOpen] = useState(null);
  // Looks the DM picked by hand stop following the name.
  const [pickedLooks, setPickedLooks] = useState(() => new Set((abilities || []).filter((a) => a.roll).map((a) => a.id)));
  const d = defense || { kind: "ac", ac: "" };
  const list = abilities || [];

  const setDefense = (next) => onChange({ defense: next, abilities: list });
  const setList = (next) => onChange({ defense, abilities: next });
  const edit = (i, patch) => setList(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const editName = (i, name) => {
    const a = list[i];
    const roll = a.roll && !pickedLooks.has(a.id) ? { ...a.roll, look: guessLook(name, a.roll.look) } : a.roll;
    edit(i, { name, ...(roll ? { roll } : {}) });
  };
  const editRoll = (i, patch) => edit(i, { roll: { ...list[i].roll, ...patch } });
  const toggleRoll = (i) => {
    const a = list[i];
    if (a.roll) { const { roll: _drop, ...rest } = a; setList(list.map((x, j) => (j === i ? rest : x))); setLookOpen(null); } // eslint-disable-line no-unused-vars
    else edit(i, { roll: { hit: "", damage: "", look: guessLook(a.name, "cut") } });
  };
  const move = (i, by) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setLookOpen(null);
    setList(next);
  };

  return (
    <div className="ns-editor">
      <div className="ns-field">
        <span className="ns-label">Defense</span>
        <div className="ns-row">
          <div className="ns-seg" role="group" aria-label="Defense kind">
            <button type="button" className={d.kind !== "roll" ? "on" : ""} aria-pressed={d.kind !== "roll"} onClick={() => setDefense({ kind: "ac", ac: d.ac ?? "" })}>Armour class</button>
            <button type="button" className={d.kind === "roll" ? "on" : ""} aria-pressed={d.kind === "roll"} onClick={() => setDefense({ kind: "roll", roll: d.roll || "", name: d.name || "" })}>Defense roll</button>
          </div>
          {d.kind === "roll" ? (
            <>
              <input className="ns-input ns-name" value={d.name ?? ""} onChange={(e) => setDefense({ ...d, name: e.target.value })} aria-label="Defense name" placeholder="Dodge" />
              <input className={`ns-input ns-dice${badDice(d.roll) ? " bad" : ""}`} value={d.roll ?? ""} onChange={(e) => setDefense({ ...d, roll: e.target.value })} aria-label="Defense roll" placeholder="1d20+3" />
            </>
          ) : (
            <label className="ns-ac">AC <input className="ns-input ns-dice ns-acin" inputMode="numeric" value={d.ac ?? ""} onChange={(e) => setDefense({ kind: "ac", ac: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })} aria-label="Armour class" placeholder="13" /></label>
          )}
        </div>
        <p className="ns-hint">{d.kind === "roll"
          ? "Rolled when it's attacked; the attack has to beat it (a tie goes to the defender, as in a D&D contest)."
          : "An attack total of this or more hits. Most creatures sit between 11 and 16; leave it empty if you'd rather judge each hit yourself."}</p>
      </div>

      <div className="ns-field">
        <span className="ns-label">Abilities</span>
        {list.map((a, i) => (
          <div key={a.id} className="ns-ability">
            <div className="ns-ability-top">
              <div className="ns-ability-text">
                <input className="ns-input" value={a.name} onChange={(e) => editName(i, e.target.value)} aria-label="Ability name" placeholder="Name, e.g. Keen Smell or Tentacles" />
                <textarea className="ns-input ns-notes" rows={(a.notes || "").length > 70 ? 2 : 1} value={a.notes || ""} onChange={(e) => edit(i, { notes: e.target.value })} aria-label={`Notes for ${a.name || "this ability"}`} placeholder="Notes (optional): what it does" />
              </div>
              <button type="button" className={`ns-roll-switch${a.roll ? " on" : ""}`} role="switch" aria-checked={!!a.roll} aria-label={`${a.name || "This ability"} can be rolled`} onClick={() => toggleRoll(i)}>
                <span className="ns-switch" aria-hidden="true"><i /></span>
                <LookIcon look="cut" size={14} /> Can be rolled
              </button>
              <div className="ns-ability-tools">
                <span className="ns-move">
                  <button type="button" aria-label={`Move ${a.name || "this ability"} up`} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                  <button type="button" aria-label={`Move ${a.name || "this ability"} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>▼</button>
                </span>
                <button type="button" className="ns-remove" aria-label={`Remove ${a.name || "this ability"}`} onClick={() => { setLookOpen(null); setList(list.filter((_, j) => j !== i)); }}>✕</button>
              </div>
            </div>
            {a.roll && (
              <div className="ns-roll">
                <button type="button" className="ns-look" aria-label={`Look: ${lookLabel(a.roll.look)}`} title={`Look: ${lookLabel(a.roll.look)}`} aria-expanded={lookOpen === i} onClick={() => setLookOpen(lookOpen === i ? null : i)}>
                  <LookIcon look={a.roll.look} />
                </button>
                <label className="ns-col">Attack roll<input className={`ns-input ns-dice${badDice(a.roll.hit) ? " bad" : ""}`} value={a.roll.hit} onChange={(e) => editRoll(i, { hit: e.target.value })} placeholder="1d20+4" /></label>
                <label className="ns-col">Damage<input className={`ns-input ns-dice${badDice(a.roll.damage) ? " bad" : ""}`} value={a.roll.damage} onChange={(e) => editRoll(i, { damage: e.target.value })} placeholder="1d6+2" /></label>
                {isDice(a.roll.hit) && (
                  <p className="ns-hint ns-chance">
                    Hits AC 12 about <b>{chanceToReach(a.roll.hit, 12)}%</b> of the time · AC 15 about <b>{chanceToReach(a.roll.hit, 15)}%</b> · AC 18 about <b>{chanceToReach(a.roll.hit, 18)}%</b>
                  </p>
                )}
                {lookOpen === i && (
                  <div className="ns-looks" role="group" aria-label="Look on the map">
                    {LOOK_GROUPS.map((g) => (
                      <div key={g.title} className="ns-look-group">
                        <span className="ns-look-title">{g.title}</span>
                        {g.looks.map((l) => (
                          <button key={l.id} type="button" className={l.id === a.roll.look ? "on" : ""} aria-pressed={l.id === a.roll.look}
                            onClick={() => { setPickedLooks((s) => new Set(s).add(a.id)); setLookOpen(null); editRoll(i, { look: l.id }); }}>
                            <LookIcon look={l.id} size={20} />{l.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="ns-row">
          <button type="button" className="ns-add" onClick={() => setList([...list, { id: newId(), name: "", notes: "" }])} disabled={list.length >= 30}>＋ Add an ability</button>
        </div>
        <p className="ns-hint">Switch on “Can be rolled” for anything the creature attacks with: it gets an attack roll (a d20 plus its bonus: +3 or +4 for most low-level monsters, +8 for a dangerous one) and damage, and shows in Take Action. Everything else is a note for you.</p>
      </div>
    </div>
  );
}
