import { useState } from "react";
import { normalizeCoin, xpProgress } from "./sessionLoadout";
import "./sessionLoadout.css";

const MINOR_DENOMS = ["cp", "sp", "ep", "pp"];
const COIN_CHIPS = [1, 5, 10, 25, 50, 100];
const XP_CHIPS = [10, 25, 50, 100, 250, 500];
const OPS = [
  { op: "spend", label: "− Spend" },
  { op: "gain", label: "+ Gain" },
  { op: "set", label: "= Set" },
];

// Inline delta pad shared by coin and XP. The parent applies the delta to
// the freshest polled value at commit time, so a change made elsewhere while
// the pad is open is never overwritten.
function DeltaPad({ unit, current, openedAt, chips, onApply, onClose }) {
  const [op, setOp] = useState("gain");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const drift = current - openedAt;

  async function apply() {
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n < 0 || busy) return;
    setBusy(true);
    const ok = await onApply(op, n);
    setBusy(false);
    if (ok !== false) onClose();
  }

  return (
    <div className="cs-sm-pad" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="cs-sm-pad-seg" role="radiogroup" aria-label="Change type">
        {OPS.map((item) => (
          <button
            key={item.op}
            type="button"
            role="radio"
            aria-checked={op === item.op}
            className={`cs-sm-pad-op${op === item.op ? " active" : ""}`}
            onClick={() => setOp(item.op)}
          >{item.label}</button>
        ))}
      </div>
      <div className="cs-sm-pad-entry">
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min="0"
          className="input-base cs-sm-pad-input"
          value={amount}
          aria-label={`Amount (${unit})`}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
        />
        <span className="cs-sm-pad-unit">{unit}</span>
        <button type="button" className="btn-primary cs-sm-pad-commit" onClick={apply} disabled={amount === "" || busy}>Apply</button>
      </div>
      <div className="cs-sm-pad-chips">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            className="cs-sm-pad-chip"
            onClick={() => setAmount((value) => String((parseInt(value, 10) || 0) + chip))}
          >{chip}</button>
        ))}
        <button type="button" className="cs-sm-pad-chip cs-sm-pad-chip--clear" onClick={() => setAmount("")} aria-label="Clear amount">⌫</button>
        <button type="button" className="btn-ghost cs-sm-pad-cancel" onClick={onClose}>Cancel</button>
      </div>
      {drift !== 0 && (
        <div className="cs-sm-pad-drift">
          {drift > 0 ? "+" : "−"}{Math.abs(drift).toLocaleString()} {unit} changed elsewhere — applied to the new total
        </div>
      )}
    </div>
  );
}

export default function SessionLedger({ char, onCommitCoin, onCommitXp }) {
  const [pad, setPad] = useState(null); // { target: "gp"|"cp"|…|"xp", openedAt }
  const [flash, setFlash] = useState(null);
  const coinMode = char?.coinMode || "gp";
  const coin = normalizeCoin(char?.coin);
  const showXp = char?.levelingMode === "xp";
  const progress = showXp ? xpProgress(char?.xpCurrent, char?.level) : null;

  const valueOf = (target) => (target === "xp" ? progress?.xp ?? 0 : coin[target]);
  const togglePad = (target) => setPad((current) => (current?.target === target ? null : { target, openedAt: valueOf(target) }));

  async function applyPad(op, amount) {
    const target = pad.target;
    const result = target === "xp" ? await onCommitXp(op, amount) : await onCommitCoin(target, op, amount);
    if (result?.clamped) {
      setFlash(target);
      setTimeout(() => setFlash(null), 400);
    }
    return result?.ok;
  }

  const padFor = (target) => pad?.target === target && (
    <DeltaPad
      key={target}
      unit={target === "xp" ? "XP" : target}
      current={valueOf(target)}
      openedAt={pad.openedAt}
      chips={target === "xp" ? XP_CHIPS : COIN_CHIPS}
      onApply={applyPad}
      onClose={() => setPad(null)}
    />
  );
  const coinPadOpen = pad && pad.target !== "xp";

  return (
    <div className="cs-sm-ledger">
      <div className="cs-sm-purse" data-mode={coinMode}>
        <div className="cs-sm-ledger-label">Coin</div>
        <div className="cs-sm-purse-row">
          <button
            type="button"
            className={`cs-sm-purse-gp${flash === "gp" ? " flash" : ""}${pad?.target === "gp" ? " active" : ""}`}
            onClick={() => togglePad("gp")}
            aria-label={`Gold: ${coin.gp}. Adjust`}
          >
            <span className="cs-sm-purse-glyph" aria-hidden="true">⧫</span>
            <span className="cs-sm-purse-total">{coin.gp.toLocaleString()}</span>
            <span className="cs-sm-purse-unit">gp</span>
          </button>
          {coinMode === "full" && (
            <div className="cs-sm-purse-denoms">
              {MINOR_DENOMS.map((denom) => (
                <button
                  key={denom}
                  type="button"
                  className={`cs-sm-purse-denom${coin[denom] === 0 ? " zero" : ""}${flash === denom ? " flash" : ""}${pad?.target === denom ? " active" : ""}`}
                  onClick={() => togglePad(denom)}
                  aria-label={`${denom}: ${coin[denom]}. Adjust`}
                >
                  <span className="cs-sm-purse-denom-val">{coin[denom].toLocaleString()}</span>
                  <span className="cs-sm-purse-unit">{denom}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {coinPadOpen && padFor(pad.target)}
      </div>

      {showXp && progress && (
        <div className="cs-sm-xp" data-state={progress.ready ? "ready" : "normal"}>
          <div className="cs-sm-xp-head">
            <div className="cs-sm-ledger-label">Experience</div>
            <span className={`cs-sm-xp-nums${flash === "xp" ? " flash" : ""}`}>
              {progress.ready
                ? `LEVEL ${(char.level || 1) + 1} READY`
                : progress.next === null
                  ? `${progress.xp.toLocaleString()} XP · LVL 20`
                  : `${progress.xp.toLocaleString()} / ${progress.next.toLocaleString()} · LVL ${char.level || 1}`}
            </span>
            <button type="button" className={`cs-sm-xp-add${pad?.target === "xp" ? " active" : ""}`} onClick={() => togglePad("xp")}>+ XP</button>
          </div>
          <div className="cs-sm-xp-bar">
            <div className="cs-sm-xp-fill" style={{ width: `${Math.round(progress.pct * 100)}%` }} />
          </div>
          {padFor("xp")}
        </div>
      )}
    </div>
  );
}
