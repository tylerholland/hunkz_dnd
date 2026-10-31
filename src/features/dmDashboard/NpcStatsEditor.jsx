// A creature's defense and attacks (design/prototypes/npc-attacks.html), used
// in the Enemies Gallery (library creatures) and on an NPC's card (one NPC).
// Edits raw values; the caller saves them through normalizeDefense/Attacks.
import { useState } from "react";
import LookIcon from "./LookIcon";
import { LOOK_GROUPS, chanceToReach, guessLook, isDice, lookLabel } from "./npcStats";
import "./npcStats.css";

const BLANK_ATTACK = () => ({ id: `atk-${Date.now().toString(36)}`, name: "", hit: "1d20+3", damage: "1d6+1", look: "cut" });

export default function NpcStatsEditor({ defense, attacks, onChange }) {
  const [lookOpen, setLookOpen] = useState(null);
  // Looks the DM picked by hand stop following the name.
  const [pickedLooks, setPickedLooks] = useState(() => new Set((attacks || []).map((a) => a.id)));
  const d = defense || { kind: "ac", ac: "" };
  const list = attacks || [];

  const setDefense = (next) => onChange({ defense: next, attacks: list });
  const setAttacks = (next) => onChange({ defense, attacks: next });
  const editAttack = (i, patch) => {
    const a = { ...list[i], ...patch };
    if (patch.name !== undefined && !pickedLooks.has(a.id)) a.look = guessLook(patch.name, a.look);
    setAttacks(list.map((x, j) => (j === i ? a : x)));
  };

  return (
    <div className="ns-editor">
      <div className="ns-field">
        <span className="ns-label">Defense</span>
        <div className="ns-row">
          <div className="ns-seg" role="group" aria-label="Defense kind">
            <button type="button" className={d.kind !== "roll" ? "on" : ""} aria-pressed={d.kind !== "roll"} onClick={() => setDefense({ kind: "ac", ac: d.ac ?? "" })}>Armour class</button>
            <button type="button" className={d.kind === "roll" ? "on" : ""} aria-pressed={d.kind === "roll"} onClick={() => setDefense({ kind: "roll", roll: d.roll || "1d20+3", name: d.name || "Dodge" })}>Defense roll</button>
          </div>
          {d.kind === "roll" ? (
            <>
              <input className="ns-input ns-name" value={d.name ?? ""} onChange={(e) => setDefense({ ...d, name: e.target.value })} aria-label="Defense name" placeholder="Dodge" />
              <input className={`ns-input ns-dice${isDice(d.roll || "") ? "" : " bad"}`} value={d.roll ?? ""} onChange={(e) => setDefense({ ...d, roll: e.target.value })} aria-label="Defense roll" placeholder="1d20+3" />
            </>
          ) : (
            <label className="ns-ac">AC <input className="ns-input ns-dice ns-acin" inputMode="numeric" value={d.ac ?? ""} onChange={(e) => setDefense({ kind: "ac", ac: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })} aria-label="Armour class" placeholder="13" /></label>
          )}
        </div>
        <p className="ns-hint">{d.kind === "roll"
          ? `Rolled when it's attacked; the attack has to beat it (a tie goes to the defender, as in a D&D contest).`
          : "An attack total of this or more hits. Most creatures sit between 11 and 16; leave it empty if you'd rather judge each hit yourself."}</p>
      </div>

      <div className="ns-field">
        <span className="ns-label">Attacks</span>
        {list.map((a, i) => {
          const okHit = isDice(a.hit || ""), okDmg = isDice(a.damage || "");
          return (
            <div key={a.id} className="ns-attack">
              <div className="ns-attack-row">
                <button type="button" className="ns-look" aria-label={`Look: ${lookLabel(a.look)}`} title={`Look: ${lookLabel(a.look)}`} aria-expanded={lookOpen === i} onClick={() => setLookOpen(lookOpen === i ? null : i)}>
                  <LookIcon look={a.look} />
                </button>
                <label className="ns-col ns-grow">Name<input className="ns-input" value={a.name} onChange={(e) => editAttack(i, { name: e.target.value })} placeholder="Tentacles" /></label>
                <label className="ns-col">Attack roll<input className={`ns-input ns-dice${okHit ? "" : " bad"}`} value={a.hit} onChange={(e) => editAttack(i, { hit: e.target.value })} placeholder="1d20+4" /></label>
                <label className="ns-col">Damage<input className={`ns-input ns-dice${okDmg ? "" : " bad"}`} value={a.damage} onChange={(e) => editAttack(i, { damage: e.target.value })} placeholder="1d6+2" /></label>
                <button type="button" className="ns-remove" aria-label={`Remove ${a.name || "this attack"}`} onClick={() => { setLookOpen(null); setAttacks(list.filter((_, j) => j !== i)); }}>✕</button>
              </div>
              {okHit && (
                <p className="ns-hint ns-chance">
                  Hits AC 12 about <b>{chanceToReach(a.hit, 12)}%</b> of the time · AC 15 about <b>{chanceToReach(a.hit, 15)}%</b> · AC 18 about <b>{chanceToReach(a.hit, 18)}%</b>
                </p>
              )}
              {lookOpen === i && (
                <div className="ns-looks" role="group" aria-label="Look on the map">
                  {LOOK_GROUPS.map((g) => (
                    <div key={g.title} className="ns-look-group">
                      <span className="ns-look-title">{g.title}</span>
                      {g.looks.map((l) => (
                        <button key={l.id} type="button" className={l.id === a.look ? "on" : ""} aria-pressed={l.id === a.look}
                          onClick={() => { setPickedLooks((s) => new Set(s).add(a.id)); setLookOpen(null); setAttacks(list.map((x, j) => (j === i ? { ...x, look: l.id } : x))); }}>
                          <LookIcon look={l.id} size={20} />{l.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="ns-row">
          <button type="button" className="ns-add" onClick={() => setAttacks([...list, BLANK_ATTACK()])} disabled={list.length >= 8}>＋ Add an attack</button>
        </div>
        <p className="ns-hint">The attack roll is the whole roll: a d20 plus the creature&apos;s bonus (+3 or +4 for most low-level monsters, +8 for a dangerous one).</p>
      </div>
    </div>
  );
}
