import { useEffect, useState } from "react";
import { listCharacters, updateCharacter } from "../api";

// DM Settings — give a player a temporary password when they've forgotten
// theirs. Uses the ordinary character update with the DM password (which the
// backend accepts for any character) and `newPassword`; nothing else on the
// sheet changes. The player can pick their own afterwards under Edit
// Character → Change Password.
export default function DmPasswordReset({ dmPassword }) {
  const [characters, setCharacters] = useState(null);
  const [slug, setSlug] = useState("");
  const [temp, setTemp] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState({ kind: "idle", message: "" });

  useEffect(() => {
    let cancelled = false;
    listCharacters()
      .then((list) => {
        if (cancelled) return;
        setCharacters((list || [])
          .filter((c) => c?.slug)
          .sort((a, b) => String(a.name || a.slug).localeCompare(String(b.name || b.slug))));
      })
      .catch(() => { if (!cancelled) setStatus({ kind: "error", message: "Couldn't load the character list." }); });
    return () => { cancelled = true; };
  }, []);

  const chosen = characters?.find((c) => c.slug === slug) || null;
  const name = chosen?.name || slug;
  const ready = !!chosen && temp.length > 0 && status.kind !== "saving";

  function clearStatus() {
    setConfirming(false);
    if (status.kind !== "saving") setStatus({ kind: "idle", message: "" });
  }

  async function reset() {
    if (!ready) return;
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    setStatus({ kind: "saving", message: "Resetting…" });
    try {
      await updateCharacter(slug, { newPassword: temp }, dmPassword);
      setStatus({ kind: "saved", message: `Done. ${name} can now sign in with the temporary password, then change it under Edit Character → Change Password.` });
      setTemp("");
    } catch (err) {
      setStatus({
        kind: "error",
        message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page."
          : err?.status === 409 ? "That sheet was being saved at the same moment. Try again."
          : "Couldn't reset the password. Try again.",
      });
    }
  }

  return (
    <section className="dm-settings-card" aria-labelledby="dm-pw-reset">
      <div className="dm-settings-row">
        <div className="dm-settings-label-col">
          <h2 id="dm-pw-reset" className="dm-settings-label">Reset a player&apos;s password</h2>
          <p className="dm-settings-help">
            For a player who&apos;s forgotten theirs. Pick the character, type a temporary password to give them, and reset. Their old password stops working; nothing else on the sheet changes.
          </p>
        </div>
        <div className="dm-settings-control-col">
          <select
            className="dm-settings-input"
            aria-label="Character"
            value={slug}
            disabled={!characters}
            onChange={(e) => { setSlug(e.target.value); clearStatus(); }}
          >
            <option value="" disabled>{characters ? "Choose a character…" : "Loading…"}</option>
            {(characters || []).map((c) => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}
          </select>
          <input
            className="dm-settings-input"
            aria-label="Temporary password"
            placeholder="Temporary password"
            value={temp}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => { setTemp(e.target.value); clearStatus(); }}
            onKeyDown={(e) => { if (e.key === "Enter") reset(); }}
          />
        </div>
      </div>

      <div className="dm-settings-actions">
        <button
          type="button"
          className={`dm-settings-save${confirming ? " dm-settings-save--confirm" : ""}`}
          onClick={reset}
          onBlur={() => setConfirming(false)}
          disabled={!ready}
        >
          {status.kind === "saving" ? "Resetting…" : confirming ? `Confirm: reset ${name}` : "Reset password"}
        </button>
        {status.message && status.kind !== "saving" && (
          <span className={`dm-settings-status dm-settings-status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</span>
        )}
      </div>
    </section>
  );
}
