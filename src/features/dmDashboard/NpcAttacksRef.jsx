// An NPC's defense and attacks on its card (design/prototypes/npc-attacks.html):
// copied from its library creature when added, changeable for this NPC only.
import { useState } from "react";
import LookIcon from "./LookIcon";
import NpcStatsEditor from "./NpcStatsEditor";
import { changedFromTemplate, defenseLabel, normalizeAttacks, normalizeDefense, statsFromTemplate } from "./npcStats";
import "./npcStats.css";

export default function NpcAttacksRef({ npc, template, onSave }) {
  const [draft, setDraft] = useState(null); // { defense, attacks } while editing
  const [saving, setSaving] = useState(false);
  const defense = normalizeDefense(npc.defense);
  const attacks = normalizeAttacks(npc.attacks);
  const changed = changedFromTemplate(npc, template);

  async function save(stats) {
    setSaving(true);
    const ok = await onSave({ defense: normalizeDefense(stats.defense), attacks: normalizeAttacks(stats.attacks) });
    setSaving(false);
    if (ok !== false) setDraft(null);
  }

  if (draft) {
    return (
      <div className="ns-card-edit">
        <NpcStatsEditor defense={draft.defense} attacks={draft.attacks} onChange={setDraft} />
        <div className="ns-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <button type="button" className="ns-add" onClick={() => setDraft(null)}>Cancel</button>
          <button type="button" className="ns-add ns-primary" disabled={saving} onClick={() => save(draft)}>{saving ? "Saving…" : "Save for this one"}</button>
        </div>
        {template && <p className="ns-hint" style={{ marginTop: 6 }}>Only {npc.name} changes; the library&apos;s {template.name} stays as it is.</p>}
      </div>
    );
  }

  if (!defense && !attacks.length) {
    return (
      <div className="ns-summary">
        <div className="ns-summary-row">
          <button type="button" className="ns-add" onClick={() => setDraft({ defense: null, attacks: [] })}>＋ Attacks &amp; defense</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ns-summary">
      {(defense || changed) && (
        <div className="ns-summary-row">
          {defense && <span><span className="ns-label">Defense</span> <b>{defenseLabel(defense)}</b></span>}
          {changed && <span className="ns-changed">✎ Changed from the library</span>}
        </div>
      )}
      {attacks.map((a) => (
        <div key={a.id} className="ns-summary-row">
          <span style={{ color: "var(--pal-accent-bright)", display: "inline-flex" }}><LookIcon look={a.look} size={16} /></span>
          <b>{a.name}</b>
          <span className="ns-summary-dice">{a.hit} · {a.damage}</span>
        </div>
      ))}
      <div className="ns-summary-row">
        <button type="button" className="ns-add" onClick={() => setDraft({ defense: npc.defense || null, attacks: npc.attacks || [] })}>✎ Edit</button>
        {changed && <button type="button" className="ns-add" disabled={saving} onClick={() => save(statsFromTemplate(template))}>Reset to library</button>}
      </div>
    </div>
  );
}
