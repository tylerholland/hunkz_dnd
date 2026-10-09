import { useState } from "react";
import { putHouseRules } from "../api";
import { DEFAULT_HOUSE_RULES, isValidCheckDice, normalizeHouseRules } from "../lib/houseRules";

const PRESETS = ["1d20", "2d6", "1d12", "3d6"];

// DM Settings — the dice a spell's cast roll uses (✶ CAST in the attack bar),
// before adding the spell's to-hit. Separate from ability checks. The page
// remounts it (key) once the current rules arrive, so the field starts filled.
export default function DmSpellDiceCard({ dmPassword, saved, onSaved }) {
  const [dice, setDice] = useState(saved?.spellCastDice || "");
  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const trimmed = dice.trim().toLowerCase();
  const valid = isValidCheckDice(trimmed);
  const dirty = !!saved && trimmed !== saved.spellCastDice;
  const reset = () => setStatus({ kind: "idle", message: "" });

  async function save() {
    if (!valid || !dirty) return;
    setStatus({ kind: "saving", message: "Saving…" });
    try {
      const res = await putHouseRules(dmPassword, { ...saved, spellCastDice: trimmed });
      const rules = normalizeHouseRules(res.houseRules);
      onSaved(rules);
      setDice(rules.spellCastDice);
      setStatus({ kind: "saved", message: "Saved — players' next casts use it." });
    } catch (err) {
      setStatus({ kind: "error", message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page." : "Couldn't save. Try again." });
    }
  }

  return (
    <section className="dm-settings-card" aria-labelledby="hr-spell-dice">
      <div className="dm-settings-row">
        <div className="dm-settings-label-col">
          <h2 id="hr-spell-dice" className="dm-settings-label">Spell casting dice</h2>
          <p className="dm-settings-help">
            Dice rolled when a player casts a spell from the attack bar (✶ Cast), before adding the spell&apos;s to-hit. Separate from ability checks. Format <code>NdS</code>.
          </p>
        </div>
        <div className="dm-settings-control-col">
          <input
            className="dm-settings-input"
            value={dice}
            onChange={(e) => { setDice(e.target.value); reset(); }}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            aria-label="Spell casting dice"
            aria-invalid={!valid}
            placeholder={DEFAULT_HOUSE_RULES.spellCastDice}
            disabled={!saved}
            spellCheck={false}
          />
          <div className="dm-settings-presets" role="group" aria-label="Common spell dice">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`dm-settings-preset${trimmed === preset ? " active" : ""}`}
                onClick={() => { setDice(preset); reset(); }}
                disabled={!saved}
              >{preset}{preset === DEFAULT_HOUSE_RULES.spellCastDice ? " (default)" : ""}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="dm-settings-preview" aria-live="polite">
        {!saved ? "Loading current setting…" : !valid ? (
          <span className="dm-settings-invalid">Use a format like 1d20 or 2d6.</span>
        ) : (
          <>A spell with +5 to-hit casts with <strong>{trimmed}+5</strong>.</>
        )}
      </div>

      <div className="dm-settings-actions">
        <button type="button" className="dm-settings-save" onClick={save} disabled={!valid || !dirty || status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
        {dirty && valid && status.kind !== "saving" && (
          <button type="button" className="dm-settings-revert" onClick={() => { setDice(saved.spellCastDice); reset(); }}>Revert</button>
        )}
        {status.message && (
          <span className={`dm-settings-status dm-settings-status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</span>
        )}
      </div>
    </section>
  );
}
