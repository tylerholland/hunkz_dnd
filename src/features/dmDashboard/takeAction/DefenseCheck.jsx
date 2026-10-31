// In the DM's History: a player's to-hit roll at an NPC, against that NPC's
// defense (design/prototypes/npc-attacks.html). An AC gives the verdict at
// once; a defense roll waits for the DM to roll it. DM-only, a suggestion.
import { useState } from "react";
import { rollDiceExpr } from "./actionOptions";
import { attackHits, defenseLabel } from "../npcStats";

export default function DefenseCheck({ total, isCrit = false, isFumble = false, defense }) {
  const [defenseTotal, setDefenseTotal] = useState(null);
  if (!defense || !Number.isFinite(total)) return null;
  const verdict = isCrit ? true : isFumble ? false : attackHits(total, defense, defenseTotal);
  return (
    <span className="ta-defense-check">
      <span className="ta-attack-vs">vs {defense.kind === "ac" ? defenseLabel(defense) : `${defense.name} ${defenseTotal ?? defense.roll}`}</span>
      {defense.kind === "roll" && (
        <button type="button" className="ta-deal" onClick={() => setDefenseTotal(rollDiceExpr(defense.roll)?.total ?? null)}>
          {defenseTotal == null ? `Roll ${defense.name}` : "↺"}
        </button>
      )}
      {verdict != null && <span className={`ta-verdict ta-verdict--${verdict ? "hit" : "miss"}`}>{verdict ? "Hits" : "Misses"}</span>}
    </span>
  );
}
