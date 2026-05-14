import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CharacterSheet, { PALETTES } from "../components/CharacterSheet";
import { createCharacter, getPortraitUploadUrl, updateCharacter } from "../api";
import "./pages.css";

export default function NewCharacterPage() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState("build"); // "build" | "create"
  const [pending, setPending] = useState(null);    // character data awaiting password
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  const handleCreate = (charData) => {
    if (!charData.name) { alert("Please set a character name before creating."); return; }
    setPending(charData);
    setStep("create");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setError(null);
    setSaving(true);

    const portraitDataUrl = pending?.portrait;
    const createPayload = { ...pending };
    delete createPayload.portrait;

    try {
      const { slug } = await createCharacter(createPayload, password);

      if (portraitDataUrl && portraitDataUrl.startsWith("data:image/")) {
        try {
          const match = portraitDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            const [, contentType, base64] = match;
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: contentType });

            const { uploadUrl, portraitUrl } = await getPortraitUploadUrl(slug, password, contentType);
            await fetch(uploadUrl, {
              method: "PUT",
              body: blob,
              headers: { "Content-Type": contentType },
            });
            await updateCharacter(slug, { portraitUrl }, password);
          }
        } catch (uploadError) {
          alert("Character created, but portrait upload failed. You can add the image again from the edit screen.");
          console.error("Portrait upload failed:", uploadError);
        }
      }

      navigate(`/characters/${slug}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (step === "create") {
    const pal = PALETTES[pending?.palette] || PALETTES.ember;

    // Set palette CSS variables at root; inputs and buttons reference var(--pal-*)
    const palVars = {
      "--pal-bg":            pal.bg,
      "--pal-surface":       pal.surface,
      "--pal-surface-solid": pal.surfaceSolid,
      "--pal-border":        pal.border,
      "--pal-accent":        pal.accent,
      "--pal-accent-bright": pal.accentBright,
      "--pal-accent-dim":    pal.accentDim,
      "--pal-text":          pal.text,
      "--pal-text-body":     pal.textBody,
      "--pal-text-muted":    pal.textMuted,
    };

    return (
      <div className="page-centered" style={{ ...palVars, background: pal.bg, padding: 24 }}>
        <div className="modal-panel" style={{ maxWidth: 400, padding: "36px 32px" }}>
          <div className="label-ui" style={{ marginBottom: 8, letterSpacing: "0.3em" }}>
            Create Character
          </div>
          <div style={{ fontFamily: pal.fontDisplay, fontSize: 22, color: pal.text, marginBottom: 24 }}>
            {pending.name}
          </div>
          <p style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
            Set a password to protect this character. You'll need it to edit the sheet.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label className="label-ui" style={{ marginBottom: 6 }}>
                Password
              </label>
              <input type="password" className="input-base" value={password}
                onChange={e => setPassword(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label-ui" style={{ marginBottom: 6 }}>
                Confirm Password
              </label>
              <input type="password" className="input-base" value={confirm}
                onChange={e => setConfirm(e.target.value)} />
            </div>

            {error && (
              <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div className="flex-row" style={{ gap: 10 }}>
              <button type="button" onClick={() => setStep("build")} className="btn-ghost">
                ← Back
              </button>
              <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Creating…" : "Create Character"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return <CharacterSheet onCreate={handleCreate} />;
}
