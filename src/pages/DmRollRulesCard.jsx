import { useState } from "react";
import { putHouseRules } from "../api";
import { DEFAULT_HOUSE_RULES, normalizeHouseRules } from "../lib/houseRules";
import { proficiencyBonus } from "../features/rollRequests/rollCheck";

const SAVE_DICE = ["1d20", "2d6"];
const SKILL_RULES = [
  { id: "none", label: "Nothing extra", eg: "A skill check is the dice plus the ability modifier, like any check. The skill just says what they're good at." },
  { id: "proficiency", label: "Proficiency bonus (5e)", eg: `A skill the character lists adds their proficiency bonus: +${proficiencyBonus(1)} at levels 1–4, +${proficiencyBonus(5)} at 5–8, and so on.` },
];

// DM Settings — saving throw dice, and what a proficient skill adds. Used by
// Ask for a Roll and the players' roll prompts. The page remounts it (key)
// once the current rules arrive.
export default function DmRollRulesCard({ dmPassword, saved, onSaved }) {
  const [saveDice, setSaveDice] = useState(saved?.saveDice || DEFAULT_HOUSE_RULES.saveDice);
  const [skillBonus, setSkillBonus] = useState(saved?.skillBonus || "none");
  const [status, setStatus] = useState({ kind: "idle", message: "" });
  const dirty = !!saved && (saveDice !== saved.saveDice || skillBonus !== saved.skillBonus);

  async function save() {
    if (!dirty) return;
    setStatus({ kind: "saving", message: "Saving…" });
    try {
      const res = await putHouseRules(dmPassword, { ...saved, saveDice, skillBonus });
      onSaved(normalizeHouseRules(res.houseRules));
      setStatus({ kind: "saved", message: "Saved — the next roll you ask for uses it." });
    } catch (err) {
      setStatus({ kind: "error", message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page." : "Couldn't save. Try again." });
    }
  }
  const pick = (setter) => (value) => { setter(value); setStatus({ kind: "idle", message: "" }); };
  const skillRule = SKILL_RULES.find((r) => r.id === skillBonus) || SKILL_RULES[0];

  return (
    <section className="dm-settings-card" aria-labelledby="hr-roll-rules">
      <div className="dm-settings-row">
        <div className="dm-settings-label-col">
          <h2 id="hr-roll-rules" className="dm-settings-label">Saving throws and skills</h2>
          <p className="dm-settings-help">
            Used when you ask players for a roll (Ask for a Roll, or Check on a party card). Ability checks use the Ability check dice above.
          </p>
        </div>
        <div className="dm-settings-control-col">
          <span className="dm-settings-help" style={{ margin: 0 }}>Saving throws roll</span>
          <div className="dm-settings-presets" role="group" aria-label="Saving throw dice">
            {SAVE_DICE.map((d) => (
              <button key={d} type="button" className={`dm-settings-preset${saveDice === d ? " active" : ""}`} aria-pressed={saveDice === d} disabled={!saved}
                onClick={() => pick(setSaveDice)(d)}>{d}{d === DEFAULT_HOUSE_RULES.saveDice ? " (default)" : ""}</button>
            ))}
          </div>
          <span className="dm-settings-help" style={{ margin: "10px 0 0" }}>A proficient skill adds</span>
          <div className="dm-settings-presets" role="group" aria-label="What a proficient skill adds">
            {SKILL_RULES.map((r) => (
              <button key={r.id} type="button" className={`dm-settings-preset${skillBonus === r.id ? " active" : ""}`} aria-pressed={skillBonus === r.id} disabled={!saved}
                onClick={() => pick(setSkillBonus)(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="dm-settings-preview" aria-live="polite">
        {saved ? <>A save rolls <strong>{saveDice}</strong> plus the ability modifier. {skillRule.eg}</> : "Loading current setting…"}
      </div>

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
