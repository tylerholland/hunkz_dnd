// An NPC's defense and abilities on its card (design/prototypes/npc-abilities.html):
// copied from its library creature when added, changeable for this NPC only.
// The card shows a compact summary (rollable abilities with their dice, then
// the rest); editing happens in a modal.
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LookIcon from "./LookIcon";
import NpcStatsEditor from "./NpcStatsEditor";
import { PalCtx } from "./dashboardShared";
import { abilitiesOf, changedFromTemplate, defenseLabel, normalizeAbilities, normalizeDefense, statsFromTemplate } from "./npcStats";
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
  const [draft, setDraft] = useState({ defense: npc.defense || null, abilities: abilitiesOf(npc) });
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
    const ok = await onSave({ defense: normalizeDefense(draft.defense), abilities: normalizeAbilities(draft.abilities) });
    setSaving(false);
    if (ok === false) setError("Couldn't save. Try again.");
    else onClose();
  }

  return createPortal(
    <div className="ns-overlay" style={palVars(pal)} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ns-modal" role="dialog" aria-modal="true" aria-labelledby="ns-modal-title" data-light={pal.light ? "true" : undefined}>
        <div className="ns-modal-head">
          <h2 id="ns-modal-title">{npc.name}</h2>
          <span className="ns-label">Abilities &amp; defense{template ? ` · from ${template.name}` : ""}</span>
        </div>
        <NpcStatsEditor defense={draft.defense} abilities={draft.abilities} onChange={setDraft} />
        {template && <p className="ns-hint">Only {npc.name} changes; the library&apos;s {template.name} stays as it is.</p>}
        {error && <p className="ns-hint" role="alert" style={{ color: "#c06060" }}>{error}</p>}
        <div className="ns-modal-foot">
          {differs && <button type="button" className="ns-add" onClick={() => setDraft({ defense: null, abilities: [], ...statsFromTemplate(template) })}>Reset to library</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="ns-add" onClick={onClose}>Cancel</button>
          <button type="button" className="ns-add ns-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : template ? "Save for this one" : "Save"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const PLAIN_SHOWN = 3;
const short = (t, n = 60) => (t.length > n ? `${t.slice(0, n - 2)}…` : t);

export default function NpcAbilitiesRef({ npc, template, onSave }) {
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const defense = normalizeDefense(npc.defense);
  const abilities = abilitiesOf(npc);
  const rollable = abilities.filter((a) => a.roll);
  const plain = abilities.filter((a) => !a.roll);
  const shownPlain = showAll ? plain : plain.slice(0, PLAIN_SHOWN);
  const changed = changedFromTemplate(npc, template);
  const modal = editing && <StatsModal npc={npc} template={template} onSave={onSave} onClose={() => setEditing(false)} />;

  if (!defense && !abilities.length) {
    return (
      <div className="npc-ability-ref">
        <button type="button" className="npc-ability-ref-toggle" onClick={() => setEditing(true)}>+ Abilities &amp; defense</button>
        {modal}
      </div>
    );
  }

  return (
    <div className="npc-ability-ref ns-summary">
      <div className="ns-summary-head">
        <span className="ns-label">Abilities{defense ? ` · ${defenseLabel(defense)}` : ""}</span>
        {changed && <span className="ns-changed" title="Changed from the library">✎ Changed</span>}
        <button type="button" className="ns-edit" aria-label={`Edit ${npc.name}'s abilities and defense`} title="Edit abilities & defense" onClick={() => setEditing(true)}>✎</button>
      </div>
      {rollable.map((a) => (
        <div key={a.id} className="ns-summary-row" title={a.notes || undefined}>
          <span className="ns-summary-icon"><LookIcon look={a.roll.look} size={15} /></span>
          <b>{a.name}</b>
          <span className="ns-summary-dice">{a.roll.hit} · {a.roll.damage}</span>
        </div>
      ))}
      {shownPlain.map((a) => (
        <div key={a.id} className="ns-summary-row ns-summary-plain" title={a.notes || undefined}>
          <span aria-hidden="true" className="ns-summary-diamond">◆</span>
          <span className="ns-summary-name">{a.name}</span>
          {a.notes && <small>{short(a.notes)}</small>}
        </div>
      ))}
      {plain.length > PLAIN_SHOWN && (
        <button type="button" className="npc-ability-ref-toggle ns-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : `+${plain.length - PLAIN_SHOWN} more`}
        </button>
      )}
      {modal}
    </div>
  );
}
