import { useState } from "react";
import VoteBoard from "./VoteBoard";
import { fmtClock, tally, useCountdown } from "./voteUtil";
import "./vote.css";

const seesText = (v) => `${v.showLive ? "Players see the votes as they come in." : "Players can't see each other's votes while it's open."} ${v.showResult ? "They see the result when it closes." : "When it closes they only see that it closed."}`;

/** The outcome in words, for the DM (with counts) or players (without). */
export function Verdict({ vote, forDm = false }) {
  const { counts, winners } = tally(vote);
  const voted = Object.keys(vote.ballots || {}).length;
  if (!winners.length) return <div className="vb-verdict">Nobody voted.</div>;
  if (winners.length > 1) return <div className="vb-verdict"><b>Tie</b> between {winners.map((i) => vote.options[i]).join(" and ")}{forDm ? ` · ${counts[winners[0]]} each. Your call.` : ". The DM will decide."}</div>;
  return <div className="vb-verdict">The party chose <b>{vote.options[winners[0]]}</b>{forDm ? ` · ${counts[winners[0]]} of ${voted}` : ""}</div>;
}

/** The DM's live / closed vote card: the board, who's still deciding, and the controls. */
export default function DmVoteCard({ vote, members, presence, serverTime, onAction }) {
  const left = useCountdown(vote.status === "open" ? vote.endsAt : null, serverTime);
  const [busy, setBusy] = useState(false);
  const closed = vote.status === "closed";
  const act = async (action) => { setBusy(true); await onAction(action); setBusy(false); };
  return (
    <section className={`vc-card${closed ? " vc-card--closed" : ""}`} aria-label="Party vote">
      <div className="vc-head">
        <span className="vb-label">{closed ? "Vote closed" : "Vote open"}</span>
        <b>{vote.question}</b>
        {!closed && left != null && <span className={`vc-clock${left <= 10 ? " vc-clock--low" : ""}`}>{fmtClock(left)}</span>}
      </div>
      {closed ? <Verdict vote={vote} forDm /> : <p className="vb-hint">{vote.multi ? "Players can pick more than one." : "One choice each."} {seesText(vote)}</p>}
      <VoteBoard vote={vote} members={members} closed={closed} tray presence={presence} serverTime={serverTime} />
      <div className="vc-foot">
        {closed
          ? <><span className="vb-hint">{vote.showResult ? "Players see this result." : "Only you see the result."} It goes in the session log when you're done.</span><span style={{ flex: 1 }} />
              <button type="button" className="vc-btn vc-btn--primary" disabled={busy} onClick={() => act("dismiss")}>Done</button></>
          : <><button type="button" className="vc-btn vc-btn--danger" disabled={busy} onClick={() => act("cancel")}>Cancel vote</button><span style={{ flex: 1 }} />
              <button type="button" className="vc-btn vc-btn--primary" disabled={busy} onClick={() => act("close")}>Close now</button></>}
      </div>
    </section>
  );
}
