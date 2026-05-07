import { useState } from "react";
import { updateCharacter } from "../../api";

export default function ChangePasswordForm({ pal, inputStyle, lbl, slug, currentPassword, onSuccess }) {
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setStatus("saving");
    try {
      await updateCharacter(slug, { newPassword: newPwd }, currentPassword);
      setStatus("saved");
      onSuccess(newPwd);
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      setError(err.message);
      setStatus("error");
      setTimeout(() => setStatus(null), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Leave blank to remove the password (sheet becomes publicly editable).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={lbl}>New Password</label>
          <input type="password" style={inputStyle} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Leave blank for no password" />
        </div>
        <div>
          <label style={lbl}>Confirm Password</label>
          <input type="password" style={inputStyle} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repeat new password" />
        </div>
      </div>
      {error && (
        <div style={{ color: "#c06060", fontFamily: pal.fontBody, fontSize: 14, marginBottom: 10 }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={status === "saving"} style={{
        ...inputStyle,
        width: "auto",
        padding: "8px 22px",
        background: status === "saved" ? pal.accentDim : pal.surface,
        borderColor: status === "saved" ? pal.accent : pal.border,
        color: status === "saved" ? pal.accentBright : pal.textMuted,
        cursor: "pointer",
        opacity: status === "saving" ? 0.6 : 1,
      }}>
        {status === "saving" ? "Updating…" : status === "saved" ? "✓ Password Updated" : "Update Password"}
      </button>
    </form>
  );
}
