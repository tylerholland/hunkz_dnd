// An NPC's defense and attacks on its card (design/prototypes/npc-attacks.html):
// copied from its library creature when added, changeable for this NPC only.
// The card shows a compact summary; editing happens in a modal.
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LookIcon from "./LookIcon";
import NpcStatsEditor from "./NpcStatsEditor";
import { PalCtx } from "./dashboardShared";
import { changedFromTemplate, defenseLabel, normalizeAttacks, normalizeDefense, statsFromTemplate } from "./npcStats";
import "./npcStats.css";

const palVars = (pal) => ({
  "--pal-bg": pal.bg,
  "--pal-surface-solid": pal.surfaceSolid,
  "--pal-border": pal.border,
  "--pal-accent": pal.accent,
  "--pal-accent-bright": pal.accentBright,
  "--pal-accent-dim": pal.accentDim,
  "--pal-text": pal.text,
  "--pal-text-body": pal.textBody,
  "--pal-text-muted": pal.textMuted,
  "--font-display": pal.fontDisplay,
  "--font-body": pal.fontBody,
  "--font-ui": pal.fontUI,
});

function StatsModal({ npc, template, onSave, onClose }) {
  const pal = useContext(PalCtx);
  const [draft, setDraft] = useState({ defense: npc.defense || null, attacks: npc.attacks || [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const differs = template && changedFromTemplate(draft, template);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    const ok = await onSave({ defense: normalizeDefense(draft.defense), attacks: normalizeAttacks(draft.attacks) });
    setSaving(false);
    if (ok === false) setError("Couldn't save. Try again.");
    else onClose();
  }

  return createPortal(
    <div className="ns-overlay" style={palVars(pal)} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ns-modal" role="dialog" aria-modal="true" aria-labelledby="ns-modal-title" data-light={pal.light ? "true" : undefined}>
        <div className="ns-modal-head">
          <h2 id="ns-modal-title">{npc.name}</h2>
          <span className="ns-label">Attacks &amp; defense{template ? ` · from ${template.name}` : ""}</span>
        </div>
        <NpcStatsEditor defense={draft.defense} attacks={draft.attacks} onChange={setDraft} />
        {template && <p className="ns-hint">Only {npc.name} changes; the library&apos;s {template.name} stays as it is.</p>}
        {error && <p className="ns-hint" role="alert" style={{ color: "#c06060" }}>{error}</p>}
        <div className="ns-modal-foot">
          {differs && <button type="button" className="ns-add" onClick={() => setDraft({ defense: null, attacks: [], ...statsFromTemplate(template) })}>Reset to library</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="ns-add" onClick={onClose}>Cancel</button>
          <button type="button" className="ns-add ns-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : template ? "Save for this one" : "Save"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function NpcAttacksRef({ npc, template, onSave }) {
  const [editing, setEditing] = useState(false);
  const defense = normalizeDefense(npc.defense);
  const attacks = normalizeAttacks(npc.attacks);
  const changed = changedFromTemplate(npc, template);
  const modal = editing && <StatsModal npc={npc} template={template} onSave={onSave} onClose={() => setEditing(false)} />;

  if (!defense && !attacks.length) {
    return (
      <div className="npc-ability-ref">
        <button type="button" className="npc-ability-ref-toggle" onClick={() => setEditing(true)}>+ Attacks &amp; defense</button>
        {modal}
      </div>
    );
  }

  return (
    <div className="npc-ability-ref ns-summary">
      <div className="ns-summary-head">
        <span className="ns-label">Attacks{defense ? ` · ${defenseLabel(defense)}` : ""}</span>
        {changed && <span className="ns-changed" title="Changed from the library">✎ Changed</span>}
        <button type="button" className="ns-edit" aria-label={`Edit ${npc.name}'s attacks and defense`} title="Edit attacks & defense" onClick={() => setEditing(true)}>✎</button>
      </div>
      {attacks.map((a) => (
        <div key={a.id} className="ns-summary-row">
          <span className="ns-summary-icon"><LookIcon look={a.look} size={15} /></span>
          <b>{a.name}</b>
          <span className="ns-summary-dice">{a.hit} · {a.damage}</span>
        </div>
      ))}
      {modal}
    </div>
  );
}
