import { useState } from "react";
import { postVoteBallot } from "../../api";
import VoteBoard, { VoteToken } from "./VoteBoard";
import { Verdict } from "./DmVoteCard";
import { LETTERS, fmtClock, tally, useCountdown } from "./voteUtil";
import "./vote.css";

const doneKey = (id) => `dnd_vote_done_${id}`;
const isDone = (id) => { try { return localStorage.getItem(doneKey(id)) === "1"; } catch { return false; } };

/**
 * A player's view of the party vote: a card near the top of their page (not
 * blocking it); "Later" tucks it into a pill with the countdown. They pick and
 * vote, and can change their vote until it closes. Afterwards: the result (or
 * just that it closed, if the DM kept it), until they press OK.
 */
export default function PlayerVote({ vote, slug, password, members, serverTime, light = false }) {
  const [tucked, setTucked] = useState(false);
  const [picks, setPicks] = useState({ id: null, list: [] });
  const [sent, setSent] = useState({ id: null, list: null });
  const [state, setState] = useState({ busy: false, error: "" });
  const [, setDoneTick] = useState(0);
  const left = useCountdown(vote?.status === "open" ? vote.endsAt : null, serverTime);
  if (!vote || isDone(vote.id)) return null;

  // Picks and the vote cast belong to this vote only.
  const mine = vote.mine?.length ? vote.mine : sent.id === vote.id ? sent.list || [] : [];
  const chosen = picks.id === vote.id ? picks.list : mine;
  const closed = vote.status === "closed" || left === 0;
  const done = () => { try { localStorage.setItem(doneKey(vote.id), "1"); } catch { /* hidden for this visit */ } setDoneTick((n) => n + 1); };
  const yours = mine.length ? <span className="vb-hint">You voted {mine.map((i) => vote.options[i]).join(" and ")}.</span> : null;
  const shell = (children, label) => <div className={`pv-card${light ? " vb-light" : ""}`} role="dialog" aria-label={label}>{children}</div>;

  if (closed) {
    if (vote.status !== "closed") return null; // time's up: the result arrives with the next poll
    if (!vote.showResult) return shell(<>
      <span className="vb-label">Vote closed</span><h4>{vote.question}</h4>
      <div className="vb-verdict">The vote has closed. The DM has the result.</div>{yours}
      <div className="vc-foot" style={{ borderTop: 0, paddingTop: 0 }}><span style={{ flex: 1 }} /><button type="button" className="vc-btn vc-btn--primary" onClick={done}>OK</button></div>
    </>, "Vote closed");
    return shell(<>
      <span className="vb-label">The party has spoken</span><h4>{vote.question}</h4>
      <Verdict vote={vote} /><VoteBoard vote={vote} members={members} closed />{yours}
      <div className="vc-foot" style={{ borderTop: 0, paddingTop: 0 }}><span style={{ flex: 1 }} /><button type="button" className="vc-btn vc-btn--primary" onClick={done}>OK</button></div>
    </>, "Vote result");
  }

  if (tucked) {
    return <button type="button" className="pv-pill" onClick={() => setTucked(false)}>⚑ Vote open{left != null ? ` · ${fmtClock(left)}` : ""}</button>;
  }

  const toggle = (i) => setPicks({ id: vote.id, list: vote.multi ? (chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i].sort()) : [i] });
  const unchanged = mine.length && String(mine) === String(chosen);
  async function cast() {
    if (!chosen.length || state.busy) return;
    setState({ busy: true, error: "" });
    try {
      await postVoteBallot(slug, password, vote.id, chosen);
      setSent({ id: vote.id, list: chosen });
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: err?.status === 409 ? "The vote has closed." : "Couldn't send your vote. Try again." });
    }
  }
  const { counts, max } = tally(vote);
  const soleLead = vote.ballots && max > 0 && counts.filter((n) => n === max).length === 1;
  const bySlug = new Map(members.map((m) => [m.slug, m]));
  return shell(<>
    <div className="vc-row"><span className="vb-label">The DM asks</span>{left != null && <span className={`vc-clock${left <= 10 ? " vc-clock--low" : ""}`}>{fmtClock(left)}</span>}</div>
    <h4>{vote.question}</h4>
    <span className="vb-hint">{vote.multi ? "Pick any that you'd go for." : "Pick one."}{mine.length ? " You can change your vote until it closes." : ""}</span>
    <div className="pv-choices">
      {vote.options.map((option, i) => (
        <button key={i} type="button" className={`pv-choice${chosen.includes(i) ? " on" : ""}${soleLead && counts[i] === max ? " lead" : ""}`} aria-pressed={chosen.includes(i)} onClick={() => toggle(i)}>
          <span className="vb-letter">{LETTERS[i]}</span><span>{option}</span>
          {vote.ballots
            ? <span className="pv-mini">{Object.entries(vote.ballots).filter(([s, p]) => s !== slug && p.includes(i)).map(([s]) => bySlug.get(s) && <VoteToken key={s} member={bySlug.get(s)} small />)}</span>
            : chosen.includes(i) && <span className="pv-tick" aria-hidden="true">✓</span>}
        </button>
      ))}
    </div>
    {state.error && <p className="vc-error" role="alert">{state.error}</p>}
    <div className="vc-foot" style={{ borderTop: 0, paddingTop: 0 }}>
      <button type="button" className="vc-btn vc-btn--quiet" onClick={() => setTucked(true)}>Later</button><span style={{ flex: 1 }} />
      <button type="button" className="vc-btn vc-btn--primary" disabled={!chosen.length || state.busy || unchanged} onClick={cast}>
        {state.busy ? "Sending…" : unchanged ? "Voted ✓" : mine.length ? "Change vote" : "Vote"}
      </button>
    </div>
  </>, "Vote");
}
