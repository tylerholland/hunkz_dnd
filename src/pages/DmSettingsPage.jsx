import { useEffect, useState } from "react";
import { getSessionState, putHouseRules } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import { PalCtx } from "../features/dmDashboard/dashboardShared";
import DmLoginPrompt from "../features/dmDashboard/DmLoginPrompt";
import TopNav from "../components/TopNav";
import { abilityCheckExpr, DEFAULT_HOUSE_RULES, isValidCheckDice, normalizeHouseRules, parseCheckDice } from "../lib/houseRules";
import "./dmSettings.css";

const CHECK_PRESETS = ["2d6", "1d20", "3d6", "1d12"];

// DM-only table settings. House rules are stored server-side and applied on
// every screen that rolls — the DM cards (both dashboard layouts), the DM
// dice roller, and each player's Session mode.
export default function DmSettingsPage() {
  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem("dnd_dm_password"));
  const [saved, setSaved] = useState(null); // last house rules the server confirmed
  const [dice, setDice] = useState("");
  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const palKey = sessionStorage.getItem("dnd_dm_palette") || "ocean";
  const pal = PALETTES[palKey] || PALETTES.ocean;

  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    getSessionState({ dmPassword })
      .then((data) => {
        if (cancelled) return;
        const rules = normalizeHouseRules(data.houseRules);
        setSaved(rules);
        setDice(rules.abilityCheckDice);
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "error", message: "Couldn't load settings — check your connection and reload." });
      });
    return () => { cancelled = true; };
  }, [authed, dmPassword]);

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt onSuccess={(pw) => { setDmPassword(pw); setAuthed(true); }} />
      </PalCtx.Provider>
    );
  }

  const trimmed = dice.trim().toLowerCase();
  const valid = isValidCheckDice(trimmed);
  const dirty = saved && trimmed !== saved.abilityCheckDice;
  const preview = valid ? parseCheckDice(trimmed) : null;

  async function save() {
    if (!valid || !dirty) return;
    setStatus({ kind: "saving", message: "Saving…" });
    try {
      const res = await putHouseRules(dmPassword, { ...saved, abilityCheckDice: trimmed });
      const rules = normalizeHouseRules(res.houseRules);
      setSaved(rules);
      setDice(rules.abilityCheckDice);
      setStatus({ kind: "saved", message: "Saved — every screen picks this up within a few seconds." });
    } catch (err) {
      setStatus({ kind: "error", message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page." : "Couldn't save. Try again." });
    }
  }

  const palVars = {
    "--pal-bg": pal.bg,
    "--pal-surface": pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border": pal.border,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim": pal.accentDim,
    "--pal-text": pal.text,
    "--pal-text-body": pal.textBody,
    "--pal-text-muted": pal.textMuted,
    "--pal-gem": pal.gem,
    "--font-display": pal.fontDisplay,
    "--font-body": pal.fontBody,
    "--font-ui": pal.fontUI,
  };

  return (
    <PalCtx.Provider value={pal}>
      <div
        className="dm-settings-page"
        style={{ ...palVars, background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}` }}
      >
        <TopNav backTo="/dm" title="DM Settings" menuItems={[{ label: "Campaign", href: "/dm" }, { label: "Map Library", href: "/maps" }]} />

        <main className="dm-settings-main">
          <h1 className="dm-settings-heading">House Rules</h1>
          <p className="dm-settings-intro">
            Table rules that differ from the book. They apply everywhere dice are rolled — your party cards (Adventure and Combat), your dice roller, and every player&apos;s Session mode.
          </p>

          <section className="dm-settings-card" aria-labelledby="hr-ability-check">
            <div className="dm-settings-row">
              <div className="dm-settings-label-col">
                <h2 id="hr-ability-check" className="dm-settings-label">Ability check dice</h2>
                <p className="dm-settings-help">
                  Dice rolled for an ability check, before adding the ability modifier. Format <code>NdS</code> — 1–10 dice of 2–100 sides.
                </p>
              </div>
              <div className="dm-settings-control-col">
                <input
                  className="dm-settings-input"
                  value={dice}
                  onChange={(e) => { setDice(e.target.value); setStatus({ kind: "idle", message: "" }); }}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  aria-label="Ability check dice"
                  aria-invalid={!valid}
                  placeholder={DEFAULT_HOUSE_RULES.abilityCheckDice}
                  disabled={!saved}
                  spellCheck={false}
                />
                <div className="dm-settings-presets" role="group" aria-label="Common choices">
                  {CHECK_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`dm-settings-preset${trimmed === preset ? " active" : ""}`}
                      onClick={() => { setDice(preset); setStatus({ kind: "idle", message: "" }); }}
                      disabled={!saved}
                    >{preset}{preset === DEFAULT_HOUSE_RULES.abilityCheckDice ? " (default)" : ""}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="dm-settings-preview" aria-live="polite">
              {!saved ? "Loading current setting…" : !valid ? (
                <span className="dm-settings-invalid">Use a format like 2d6 or 1d20.</span>
              ) : (
                <>
                  A Wisdom +2 check rolls <strong>{abilityCheckExpr(2, trimmed)}</strong>.{" "}
                  With advantage: roll {preview.count + 1}d{preview.sides}, keep the best {preview.count}; disadvantage keeps the worst {preview.count}.
                </>
              )}
            </div>

            <div className="dm-settings-actions">
              <button type="button" className="dm-settings-save" onClick={save} disabled={!valid || !dirty || status.kind === "saving"}>
                {status.kind === "saving" ? "Saving…" : "Save"}
              </button>
              {dirty && valid && status.kind !== "saving" && (
                <button type="button" className="dm-settings-revert" onClick={() => { setDice(saved.abilityCheckDice); setStatus({ kind: "idle", message: "" }); }}>
                  Revert
                </button>
              )}
              {status.message && (
                <span className={`dm-settings-status dm-settings-status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</span>
              )}
            </div>
          </section>

          <p className="dm-settings-footnote">
            Coming later: how skills affect a check (waiting on the rule).
          </p>
        </main>
      </div>
    </PalCtx.Provider>
  );
}
