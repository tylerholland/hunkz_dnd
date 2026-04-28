import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CharacterSheet, { PALETTES } from "../components/CharacterSheet";
import { createCharacter } from "../api";

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
    try {
      const { slug } = await createCharacter(pending, password);
      navigate(`/characters/${slug}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (step === "create") {
    const pal = PALETTES[pending?.palette] || PALETTES.ember;
    const inputStyle = {
      background: pal.surface, border: `1px solid ${pal.border}`,
      borderRadius: 3, color: pal.text,
      fontFamily: pal.fontBody, fontSize: 16,
      padding: "9px 13px", width: "100%", outline: "none",
    };
    return (
      <div style={{
        minHeight: "100vh", background: pal.bg, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        <div style={{
          width: "100%", maxWidth: 400,
          background: pal.surface, border: `1px solid ${pal.border}`,
          borderRadius: 6, padding: "36px 32px",
        }}>
          <div style={{
            fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em",
            textTransform: "uppercase", color: pal.textMuted, marginBottom: 8,
          }}>
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
              <label style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, display: "block", marginBottom: 6 }}>
                Password
              </label>
              <input type="password" style={inputStyle} value={password}
                onChange={e => setPassword(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, display: "block", marginBottom: 6 }}>
                Confirm Password
              </label>
              <input type="password" style={inputStyle} value={confirm}
                onChange={e => setConfirm(e.target.value)} />
            </div>

            {error && (
              <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setStep("build")} style={{ ...inputStyle, width: "auto", padding: "9px 18px", cursor: "pointer" }}>
                ← Back
              </button>
              <button type="submit" disabled={saving} style={{
                ...inputStyle, flex: 1, padding: "10px 18px",
                background: pal.accentDim, borderColor: pal.accent,
                color: pal.accentBright, cursor: "pointer",
                fontFamily: pal.fontUI, letterSpacing: "0.08em",
                opacity: saving ? 0.6 : 1,
              }}>
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
