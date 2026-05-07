import { useContext } from "react";
import loadingMonsterGif from "../../assets/loading_monster.gif";
import { PalCtx } from "./dashboardShared";

export default function DmAuthLoader({ title = "Checking DM Access", detail = "Verifying stored session..." }) {
  const pal = useContext(PalCtx);

  return (
    <div style={{ textAlign: "center" }}>
      <img
        data-testid="dm-auth-loader"
        src={loadingMonsterGif}
        alt="Checking DM access"
        width="220"
        height="220"
        style={{
          width: "min(220px, 100%)",
          height: "auto",
          imageRendering: "auto",          
          display: "block",
          margin: "0 auto 10px",
          borderRadius: 8,
        }}
      />

      <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, letterSpacing: "0.08em", color: pal.accentBright, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted }}>
        {detail}
      </div>
    </div>
  );
}
