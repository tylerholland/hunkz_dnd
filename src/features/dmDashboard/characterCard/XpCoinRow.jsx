import { XP_THRESHOLDS, COIN_COLORS } from "../../characterSheet/constants";
import "../characterCard.css";

const DENOM_SHORT = { cp: "CP", sp: "SP", ep: "EP", gp: "GP", pp: "PP" };

function formatGpEquivalent(coin) {
  const total = ((coin.pp || 0) * 10) + (coin.gp || 0) + ((coin.ep || 0) * 0.5) + ((coin.sp || 0) * 0.1) + ((coin.cp || 0) * 0.01);
  if (Math.abs(total - Math.round(total)) < 0.000001) return String(Math.round(total));
  return total.toFixed(2);
}

// XP progress + coin panels — Tier-2 collapsible section of the party card.
function XpCoinRow({
  char,
  cardPal,
  optimisticXp,
  optimisticCoin,
  coinExpanded,
  setCoinExpanded,
  setShowAwardXp,
  setShowDistributeCoin,
  showTier2,
}) {
  const coinMode = char.coinMode || "gp";
  const displayCoin = optimisticCoin || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const coinEquivalent = formatGpEquivalent(displayCoin);

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

        {(() => {
        const gpVal = displayCoin.gp ?? 0;
        return (
          <div className="cc-coin-row" style={{ gap: coinMode === "gp" ? 0 : 5 }}>
            <div className="cc-coin-header">
              <span className="cc-coin-label">GP</span>
              {coinMode === "gp" ? (
                <span className="cc-coin-pill">
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: COIN_COLORS.gp }}>{gpVal.toLocaleString()}</span>
                  <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: "rgba(200,160,64,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>gp</span>
                </span>
              ) : (
                <span className="cc-coin-pill">
                  <span style={{ fontFamily: cardPal.fontUI, fontSize: 10, color: "rgba(200,160,64,0.55)" }}>≈</span>
                  <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 12, color: COIN_COLORS.gp }}>{coinEquivalent}</span>
                  <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: "rgba(200,160,64,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>gp</span>
                </span>
              )}
              {coinMode === "gp" ? (
                <button
                  onClick={() => setShowDistributeCoin(true)}
                  className="cc-coin-give-btn"
                >Give</button>
              ) : (
                <button
                  onClick={() => setCoinExpanded((value) => !value)}
                  className="cc-coin-expand-btn"
                  title={coinExpanded ? "Hide purse breakdown" : "Show purse breakdown"}
                >
                  {coinExpanded ? "˄" : "˅"}
                </button>
              )}
            </div>

            {coinMode !== "gp" && coinExpanded && (
              <div className="cc-coin-breakdown">
                {["cp", "sp", "ep", "gp", "pp"].map((denom) => (
                  <span
                    key={denom}
                    className="cc-coin-denom"
                    style={{
                      background: `${COIN_COLORS[denom]}14`,
                      border: `1px solid ${COIN_COLORS[denom]}55`,
                    }}
                  >
                    <span style={{ fontFamily: cardPal.fontDisplay, fontSize: 11, color: COIN_COLORS[denom] }}>
                      {(displayCoin[denom] || 0).toLocaleString()}
                    </span>
                    <span style={{ fontFamily: cardPal.fontUI, fontSize: 9, color: COIN_COLORS[denom], letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      {DENOM_SHORT[denom].toLowerCase()}
                    </span>
                  </span>
                ))}
                <button
                  onClick={() => setShowDistributeCoin(true)}
                  className="cc-coin-give-btn"
                >Give</button>
              </div>
            )}
          </div>
        );
      })()}
      </div>
    </div>
  );
}

export default XpCoinRow;
