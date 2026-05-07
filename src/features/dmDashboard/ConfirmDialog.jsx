import { useContext } from "react";
import { PalCtx } from "./dashboardShared";

export default function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  const pal = useContext(PalCtx);
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: pal.surfaceSolid,
        border: `1px solid ${pal.accent}`,
        borderRadius: 8,
        padding: "28px 32px",
        maxWidth: 400,
        width: "90%",
      }}>
        <div style={{ fontFamily: pal.fontDisplay, fontSize: 17, color: pal.accentBright, marginBottom: 12 }}>{title}</div>
        <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.textBody, marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            background: "transparent",
            border: `1px solid ${pal.border}`,
            borderRadius: 4,
            color: pal.textMuted,
            fontFamily: pal.fontUI,
            fontSize: 12,
            letterSpacing: "0.14em",
            padding: "8px 18px",
            cursor: "pointer",
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            background: "rgba(18,32,48,0.6)",
            border: `1px solid ${pal.accent}`,
            borderRadius: 4,
            color: pal.accentBright,
            fontFamily: pal.fontUI,
            fontSize: 12,
            letterSpacing: "0.14em",
            padding: "8px 18px",
            cursor: "pointer",
          }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
