import { XP_THRESHOLDS, COIN_COLORS } from "../../characterSheet/constants";
import { COIN_NAMES, mixedPurse, shownCoins, useTableMoney, worthText } from "../../../lib/money";
import "../characterCard.css";

// XP progress + coin panels — Tier-2 collapsible section of the party card.
function XpCoinRow({
  char,
  cardPal,
  optimisticXp,
  optimisticCoin,
  setShowAwardXp,
  setShowDistributeCoin,
  showTier2,
}) {
  const money = useTableMoney();
  const displayCoin = optimisticCoin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  return (
    <div
      className="cc-tier2"
      style={{
        maxHeight: showTier2 ? 220 : 0,
        opacity: showTier2 ? 1 : 0,
        pointerEvents: showTier2 ? "auto" : "none",
      }}
    >
      <hr className="divider" style={{ marginTop: 4, marginBottom: 8, opacity: 0.7 }} />

      <div className="cc-tier2-inner">
        {(char.levelingMode || "milestone") === "xp" && (() => {
        const level = char.level || 1;
        const xp = optimisticXp;
        const nextThreshold = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[20];
        const currentThreshold = XP_THRESHOLDS[level] ?? 0;
        const isMaxLevel = level >= 20;
        const isReady = !isMaxLevel && xp >= nextThreshold;
        const progress = isMaxLevel ? 1 : Math.min(1, Math.max(0, (xp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)));
        return (
          <div className="cc-xp-row">
            <span className="cc-xp-label">XP</span>
            <div className="cc-xp-bar" style={{ background: `${cardPal.accent}18` }}>
              {/* Width is dynamic */}
              <div style={{ height: "100%", width: `${progress * 100}%`, background: isReady ? cardPal.gem : cardPal.accent, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: isReady ? cardPal.accentBright : cardPal.text }}>
              {xp.toLocaleString()}
            </span>
            {!isMaxLevel && (
              <span className="cc-xp-next">
                / {nextThreshold >= 1000 ? `${Math.round(nextThreshold / 1000)}k` : nextThreshold}
              </span>
            )}
            <button
              onClick={() => setShowAwardXp(true)}
              className="cc-xp-add-btn"
              title="Award XP"
            >+</button>
          </div>
        );
      })()}

        <div className="cc-coin-row" title={mixedPurse(displayCoin) ? worthText(displayCoin, money) : undefined}>
          <div className="cc-coin-header">
            <span className="cc-coin-label">Coin</span>
            {shownCoins(displayCoin, money).map((denom) => (
              <span
                key={denom}
                className="cc-coin-denom"
                aria-label={`${(displayCoin[denom] || 0).toLocaleString()} ${COIN_NAMES[denom].toLowerCase()}`}
                style={{ background: `${COIN_COLORS[denom]}14`, border: `1px solid ${COIN_COLORS[denom]}55` }}
              >
                <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: cardPal.text }}>
                  {(displayCoin[denom] || 0).toLocaleString()}
                </span>
                <span className="cc-coin-unit" style={{ color: COIN_COLORS[denom] }}>{denom}</span>
              </span>
            ))}
            <button
              onClick={() => setShowDistributeCoin(true)}
              className="cc-coin-give-btn"
            >Give</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default XpCoinRow;
