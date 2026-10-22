import { FAMILY_COLORS } from "./tokenEffects";

// The condition block of a token's hover card — every active condition by
// name in badge priority order (Story 53), with the DM's effect notes under
// spell effects (Story 70). Shared by the map token and the tray chip card
// (Story 33) so both read the same.
export default function TokenCardConditions({ eligibleConditions, effectNotes }) {
  if (!eligibleConditions?.length) return null;
  return (
    <div className="token-hp-card__cond-block">
      {eligibleConditions.map((item, i) => {
        const effectNote = effectNotes?.[item.name];
        return (
          <div key={item.name + i}>
            <div className="token-hp-card__cond-line" style={{ color: FAMILY_COLORS[item.meta.family] }}>
              {item.name === "Exhaustion" ? `EXHAUSTION ${item.meta.exhaustionLevel}` : String(item.name).toUpperCase()}
            </div>
            {effectNote ? <div className="token-hp-card__cond-note">{effectNote}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
