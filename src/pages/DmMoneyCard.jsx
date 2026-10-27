import { useState } from "react";
import { putHouseRules } from "../api";
import { normalizeHouseRules } from "../lib/houseRules";
import { COIN_NAMES, MAIN_COIN, normalizeMoney, setTableMoney } from "../lib/money";

// Shown main coin first, then the usual extra (gold), then the rest by worth.
const ORDER = ["sp", "gp", "cp", "ep", "pp"];

// DM Settings — the table's money: silver is the main coin; the DM picks which
// other coins are in use and what each is worth in silver. Remounted (key)
// once the current rules arrive, like the spell dice card.
export default function DmMoneyCard({ dmPassword, saved, onSaved }) {
  const savedMoney = normalizeMoney(saved?.money);
  const [money, setMoney] = useState(savedMoney);
  // Rate fields as typed; a coin worth less than a silver is entered as "N to 1 silver".
  const [rates, setRates] = useState(() => Object.fromEntries(ORDER.map((id) => [id, rateText(savedMoney.coins[id].rate)])));
  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const parsed = Object.fromEntries(ORDER.map((id) => [id, parseRate(id, rates[id], savedMoney.coins[id].rate)]));
  const valid = ORDER.every((id) => parsed[id] != null);
  const next = normalizeMoney({ coins: Object.fromEntries(ORDER.map((id) => [id, { on: money.coins[id].on, rate: parsed[id] ?? money.coins[id].rate }])) });
  const dirty = !!saved && JSON.stringify(next) !== JSON.stringify(savedMoney);
  const reset = () => setStatus({ kind: "idle", message: "" });

  function toggle(id) {
    setMoney((m) => ({ ...m, coins: { ...m.coins, [id]: { ...m.coins[id], on: !m.coins[id].on } } }));
    reset();
  }

  async function save() {
    if (!valid || !dirty) return;
    setStatus({ kind: "saving", message: "Saving…" });
    try {
      const res = await putHouseRules(dmPassword, { ...saved, money: next });
      const rules = normalizeHouseRules(res.houseRules);
      onSaved(rules);
      setMoney(rules.money);
      setRates(Object.fromEntries(ORDER.map((id) => [id, rateText(rules.money.coins[id].rate)])));
      setTableMoney(rules.money);
      setStatus({ kind: "saved", message: "Saved — sheets, cards and the shop pick it up within a few seconds." });
    } catch (err) {
      setStatus({ kind: "error", message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page." : "Couldn't save. Try again." });
    }
  }

  function revert() {
    setMoney(savedMoney);
    setRates(Object.fromEntries(ORDER.map((id) => [id, rateText(savedMoney.coins[id].rate)])));
    reset();
  }

  return (
    <section className="dm-settings-card" aria-labelledby="hr-money">
      <div className="dm-settings-label-col">
        <h2 id="hr-money" className="dm-settings-label">Money</h2>
        <p className="dm-settings-help">
          The coins your table uses. Prices, purses and the shop count in the main coin, silver; the others convert at these rates. A coin that&apos;s switched off disappears from sheets and cards — unless someone actually holds some, so no money ever goes missing.
        </p>
      </div>

      <div className="dm-money-coins">
        {ORDER.map((id) => {
          const main = id === MAIN_COIN;
          const on = money.coins[id].on;
          const name = COIN_NAMES[id].toLowerCase();
          const small = savedMoney.coins[id].rate < 1;
          return (
            <div key={id} className={`dm-money-coin dm-money-coin--${id}${on ? "" : " off"}`}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={COIN_NAMES[id]}
                className={`dm-settings-switch${on ? " on" : ""}`}
                disabled={!saved || main}
                onClick={() => toggle(id)}
              >
                <span className="dm-settings-switch-knob" aria-hidden="true" />
                {on ? "On" : "Off"}
              </button>
              <b className="dm-money-name">{COIN_NAMES[id]}</b>
              {main ? (
                <span className="dm-money-main">Main coin</span>
              ) : (
                <label className="dm-money-rate">
                  {small ? (
                    <>
                      <input className="dm-settings-input" inputMode="decimal" value={rates[id]} disabled={!saved}
                        aria-invalid={parsed[id] == null} aria-label={`${COIN_NAMES[id]} per silver`}
                        onChange={(e) => { setRates((r) => ({ ...r, [id]: e.target.value })); reset(); }} />
                      {name} = 1 silver
                    </>
                  ) : (
                    <>
                      1 {name} =
                      <input className="dm-settings-input" inputMode="decimal" value={rates[id]} disabled={!saved}
                        aria-invalid={parsed[id] == null} aria-label={`${COIN_NAMES[id]} worth in silver`}
                        onChange={(e) => { setRates((r) => ({ ...r, [id]: e.target.value })); reset(); }} />
                      silver
                    </>
                  )}
                </label>
              )}
            </div>
          );
        })}
      </div>

      {!valid && <div className="dm-settings-preview"><span className="dm-settings-invalid">Rates must be numbers above zero.</span></div>}

      <div className="dm-settings-actions">
        <button type="button" className="dm-settings-save" onClick={save} disabled={!valid || !dirty || status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
        {dirty && status.kind !== "saving" && (
          <button type="button" className="dm-settings-revert" onClick={revert}>Revert</button>
        )}
        {status.message && (
          <span className={`dm-settings-status dm-settings-status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</span>
        )}
      </div>
    </section>
  );
}

function rateText(rate) {
  return String(rate < 1 ? Math.round((1 / rate) * 100) / 100 : rate);
}

// The worth in silver from the field; null when it isn't a usable number.
function parseRate(id, text, savedRate) {
  if (id === MAIN_COIN) return 1;
  const n = Number(String(text).trim());
  if (!String(text).trim() || !Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return savedRate < 1 ? 1 / n : n;
}
