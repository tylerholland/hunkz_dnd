import { useState } from "react";
import { putHouseRules } from "../api";
import { normalizeHouseRules } from "../lib/houseRules";

const RULES = [
  { id: "wod", label: "World of Dungeons", eg: "By class: light weapons d6 (dagger, short sword), martial d6+1 (longsword, spear), great d6+2 (greatsword)." },
  { id: "dnd", label: "D&D 5e", eg: "Each weapon its own die: dagger d4, short sword d6, longsword d8, greatsword 2d6." },
];

// DM Settings — what weapons from the shop roll for damage, on the character
// sheet and in combat. A player's own Damage on a weapon always wins. The page
// remounts it (key) once the current rules arrive.
export default function DmWeaponDamageCard({ dmPassword, saved, onSaved }) {
  const savedRule = saved?.weaponDamage || "wod";
  const [rule, setRule] = useState(savedRule);
  const [status, setStatus] = useState({ kind: "idle", message: "" });
  const dirty = !!saved && rule !== savedRule;

  async function save() {
    if (!dirty) return;
    setStatus({ kind: "saving", message: "Saving…" });
    try {
      const res = await putHouseRules(dmPassword, { ...saved, weaponDamage: rule });
      onSaved(normalizeHouseRules(res.houseRules));
      setStatus({ kind: "saved", message: "Saved — weapons roll it from the next refresh." });
    } catch (err) {
      setStatus({ kind: "error", message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page." : "Couldn't save. Try again." });
    }
  }

  const current = RULES.find((r) => r.id === rule) || RULES[0];
  return (
    <section className="dm-settings-card" aria-labelledby="hr-weapon-damage">
      <div className="dm-settings-row">
        <div className="dm-settings-label-col">
          <h2 id="hr-weapon-damage" className="dm-settings-label">Weapon damage</h2>
          <p className="dm-settings-help">
            What weapons from the shop roll, on character sheets and in combat. A weapon whose owner set their own Damage keeps it.
          </p>
        </div>
        <div className="dm-settings-control-col">
          <div className="dm-settings-presets" role="group" aria-label="Weapon damage">
            {RULES.map((r) => (
              <button key={r.id} type="button" className={`dm-settings-preset${rule === r.id ? " active" : ""}`} aria-pressed={rule === r.id} disabled={!saved}
                onClick={() => { setRule(r.id); setStatus({ kind: "idle", message: "" }); }}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="dm-settings-preview" aria-live="polite">{saved ? current.eg : "Loading current setting…"}</div>

      <div className="dm-settings-actions">
        <button type="button" className="dm-settings-save" onClick={save} disabled={!dirty || status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
        {status.message && (
          <span className={`dm-settings-status dm-settings-status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</span>
        )}
      </div>
    </section>
  );
}
