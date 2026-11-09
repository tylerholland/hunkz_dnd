import { useState } from "react";
import { postRollResult } from "../../api";
import { checkBonus, checkName, formatBonus, rollFor } from "./rollCheck";
import "../vote/vote.css";
import "./rollRequests.css";

const DONE_KEY = (id) => `dnd_roll_done_${id}`;
const isDone = (id) => { try { return localStorage.getItem(DONE_KEY(id)) === "1"; } catch { return false; } };
const markDone = (id) => { try { localStorage.setItem(DONE_KEY(id), "1"); } catch { /* storage off: it just stays until the DM closes it */ } };

/**
 * The DM asked this player for a roll: a card near the top of their page with
 * the roll loaded (their bonus worked out under the house rules), or a box for
 * a total from real dice. After rolling it shows their result, and everyone's
 * once the DM reveals them. `requests` are this player's (getSessionState).
 */
export default function PlayerRollPrompt({ requests = [], char, rules, slug, password, members = [], light = false }) {
  const [sent, setSent] = useState({}); // id → result just sent (before the poll catches up)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [, setTick] = useState(0);

  const request = requests.find((r) => !isDone(r.id));
  if (!request || !char) return null;
  const mine = request.mine || sent[request.id] || null;
  const bonus = checkBonus(char, request.check, rules);
  const names = new Map(members.map((m) => [m.slug, m.name]));

  async function send(result) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await postRollResult(slug, password, request.id, result);
      setSent((m) => ({ ...m, [request.id]: result }));
    } catch (err) {
      setError(err?.status === 409 ? "That roll has closed." : "Couldn't send it. Try again.");
    }
    setBusy(false);
  }
  const roll = () => {
    const { total, rolls } = rollFor(request.dice, bonus, request.adv);
    send({ total, rolls, manual: false, shown: `${rolls.join(" + ")} ${formatBonus(bonus)}` });
  };
  const sendManual = () => {
    const n = parseInt(manual, 10);
    if (Number.isFinite(n)) send({ total: n, rolls: [], manual: true });
  };
  const dismiss = () => { markDone(request.id); setTick((t) => t + 1); };

  return (
    <div className={`pv-card rq-prompt${light ? " vb-light" : ""}`} role="dialog" aria-label="The DM asks for a roll">
      <span className="vb-label">The DM asks for a roll</span>
      <b className="rq-card-title">{checkName(request.check)}</b>
      {(request.adv !== "normal" || request.dc) && (
        <p className="vb-hint">
          {request.adv === "adv" ? "With advantage: one extra die, keep the best. " : request.adv === "dis" ? "With disadvantage: one extra die, keep the worst. " : ""}
          {request.dc ? `DC ${request.dc}.` : ""}
        </p>
      )}
      {mine ? (
        <>
          <div className="rq-rolled"><span>{mine.total}</span><small>{mine.manual ? "your dice" : mine.shown ? `(${mine.shown})` : ""} · sent to the DM</small></div>
          {request.revealed && Array.isArray(request.results) && (
            <div className="rq-rows">
              <span className="vb-label">The DM revealed the rolls</span>
              {request.results.map((r) => (
                <div key={r.slug} className="rq-row rq-row--plain">
                  <span className="rq-row-name">{names.get(r.slug) || r.slug}</span>
                  <span className={`rq-row-total${r.total == null ? " waiting" : ""}`}>{r.total ?? "rolling…"}</span>
                </div>
              ))}
            </div>
          )}
          <div className="vc-foot"><span style={{ flex: 1 }} /><button type="button" className="vc-btn" onClick={dismiss}>OK</button></div>
        </>
      ) : (
        <>
          <button type="button" className="vc-btn vc-btn--primary rq-roll-btn" onClick={roll} disabled={busy}>
            Roll {request.dice} {formatBonus(bonus)}{request.adv === "adv" ? " · adv" : request.adv === "dis" ? " · dis" : ""}
          </button>
          <div className="vc-row">
            <span className="vb-hint">Rolled real dice?</span>
            <input className="vc-in rq-dc-in" inputMode="numeric" placeholder="Total" aria-label="Your total" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendManual(); }} />
            <button type="button" className="vc-btn" onClick={sendManual} disabled={busy || !manual.trim()}>Send</button>
          </div>
        </>
      )}
      {error && <p className="vc-error" role="alert">{error}</p>}
    </div>
  );
}
