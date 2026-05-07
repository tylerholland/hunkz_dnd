import { useContext, useState } from "react";
import { getDmParty } from "../../api";
import { PalCtx } from "./dashboardShared";
import DmAuthLoader from "./DmAuthLoader";

export default function DmLoginPrompt({ onSuccess, checking = false }) {
  const pal = useContext(PalCtx);
  const checkingSurface = "rgb(4 50 71)";
  const checkingBorder = "rgba(79, 228, 194, 0.28)";
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await getDmParty(pw);
      sessionStorage.setItem("dnd_dm_password", pw);
      onSuccess(pw);
    } catch (err) {
      setError(err.status === 403 ? "Incorrect DM password." : "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: checking ? checkingSurface : pal.surfaceSolid,
        border: `1px solid ${checking ? checkingBorder : pal.border}`,
        borderRadius: 8,
        padding: "36px 40px",
        width: "100%",
        maxWidth: 360,
        textAlign: "center",
        boxShadow: checking ? "0 18px 50px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(127,244,218,0.04)" : "none",
      }}>
        {checking ? (
          <DmAuthLoader />
        ) : (
          <>
            <div style={{ fontFamily: pal.fontDisplay, fontSize: 20, letterSpacing: "0.1em", color: pal.accentBright, marginBottom: 6 }}>DM Campaign</div>
            <div style={{ fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 24 }}>Enter DM Password</div>
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Password"
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(18,32,48,0.7)",
                  border: `1px solid ${error ? "#c06060" : pal.accent}`,
                  borderRadius: 4,
                  color: pal.text,
                  fontFamily: pal.fontBody,
                  fontSize: 16,
                  padding: "10px 14px",
                  outline: "none",
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />
              {error && (
                <div style={{ color: "#c06060", fontFamily: pal.fontUI, fontSize: 12, marginBottom: 10 }}>{error}</div>
              )}
              <button type="submit" disabled={loading || !pw} style={{
                width: "100%",
                background: loading || !pw ? "rgba(18,32,48,0.3)" : "rgba(18,32,48,0.6)",
                border: `1px solid ${pal.accent}`,
                borderRadius: 4,
                color: pal.accentBright,
                fontFamily: pal.fontUI,
                fontSize: 13,
                letterSpacing: "0.16em",
                padding: "10px 0",
                cursor: loading || !pw ? "not-allowed" : "pointer",
              }}>
                {loading ? "Verifying…" : "Enter Campaign"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
