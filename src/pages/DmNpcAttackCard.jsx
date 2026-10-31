import { useState } from "react";
import { putHouseRules } from "../api";
import { DEFAULT_HOUSE_RULES, isValidAttackDice, normalizeHouseRules } from "../lib/houseRules";
import { chanceToReach } from "../features/dmDashboard/npcStats";

const STANDARD = DEFAULT_HOUSE_RULES.npcAttackDice;

// DM Settings — the attack roll for an NPC's quick attacks (Unarmed Strike,
// Swing Sword, Throw Rock, Magic) when the creature has no attacks of its own.
// Standard is a d20 plus a typical low-level monster's +3; the DM can set his
// own. The page remounts it (key) once the current rules arrive.
export default function DmNpcAttackCard({ dmPassword, saved, onSaved }) {
  const savedDice = saved?.npcAttackDice || STANDARD;
  const [custom, setCustom] = useState(savedDice !== STANDARD);
  const [dice, setDice] = useState(savedDice !== STANDARD ? savedDice : "1d20+4");
  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const value = custom ? dice.replace(/\s+/g, "").toLowerCase() : STANDARD;
  const valid = isValidAttackDice(value);
  const dirty = !!saved && value !== savedDice;
  const reset = () => setStatus({ kind: "idle", message: "" });

  async function save() {
    if (!valid || !dirty) return;
    setStatus({ kind: "saving", message: "Saving…" });
    try {
      const res = await putHouseRules(dmPassword, { ...saved, npcAttackDice: value });
      onSaved(normalizeHouseRules(res.houseRules));
      setStatus({ kind: "saved", message: "Saved — the next quick attack uses it." });
    } catch (err) {
      setStatus({ kind: "error", message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page." : "Couldn't save. Try again." });
    }
  }

  return (
    <section className="dm-settings-card" aria-labelledby="hr-npc-attack">
      <div className="dm-settings-row">
        <div className="dm-settings-label-col">
          <h2 id="hr-npc-attack" className="dm-settings-label">NPC attack roll</h2>
          <p className="dm-settings-help">
            The attack roll for an NPC&apos;s quick attacks (Unarmed Strike, Swing Sword, Throw Rock, Magic) on the map. Creatures with their own attacks, set in the Enemies Gallery, use those instead.
          </p>
        </div>
        <div className="dm-settings-control-col">
          <div className="dm-settings-presets" role="group" aria-label="NPC attack roll">
            <button type="button" className={`dm-settings-preset${custom ? "" : " active"}`} aria-pressed={!custom} disabled={!saved} onClick={() => { setCustom(false); reset(); }}>Standard · {STANDARD}</button>
            <button type="button" className={`dm-settings-preset${custom ? " active" : ""}`} aria-pressed={custom} disabled={!saved} onClick={() => { setCustom(true); reset(); }}>Your own</button>
          </div>
          {custom && (
            <input
              className="dm-settings-input"
              value={dice}
              onChange={(e) => { setDice(e.target.value); reset(); }}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              aria-label="Your NPC attack roll"
              aria-invalid={!valid}
              placeholder="1d20+4"
              disabled={!saved}
              spellCheck={false}
              style={{ marginTop: 8 }}
            />
          )}
        </div>
      </div>

      <div className="dm-settings-preview" aria-live="polite">
        {!saved ? "Loading current setting…" : !valid ? (
          <span className="dm-settings-invalid">Use a format like 1d20+4.</span>
        ) : (
          <>Hits AC 12 about <strong>{chanceToReach(value, 12)}%</strong> of the time, AC 15 about <strong>{chanceToReach(value, 15)}%</strong>.</>
        )}
      </div>

      <div className="dm-settings-actions">
        <button type="button" className="dm-settings-save" onClick={save} disabled={!valid || !dirty || status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
        {status.message && (
          <span className={`dm-settings-status dm-settings-status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</span>
        )}
      </div>
    </section>
  );
}
