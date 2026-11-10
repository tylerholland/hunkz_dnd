import { VoteToken } from "../vote/VoteBoard";
import "../vote/vote.css";
import "./silence.css";
import { shortName } from "../../lib/names";

/** While the DM is asking for quiet: who's said they're listening, and Lift it. */
export default function SilenceCard({ silence, members, onLift }) {
  const listening = new Set(silence.acks || []);
  const waiting = members.filter((m) => !listening.has(m.slug));
  return (
    <section className="vc-card sl-card" aria-label="Silence requested">
      <div className="vc-head">
        <span className="vb-label">✋ Silence requested</span>
        <span className="sl-count">{members.length - waiting.length} of {members.length} listening</span>
      </div>
      <div className="sl-who">
        {members.map((m) => (
          <span key={m.slug} className={`sl-person${listening.has(m.slug) ? " on" : ""}`}>
            <VoteToken member={m} small faded={!listening.has(m.slug)} />
            {shortName(m.name)}{listening.has(m.slug) ? " ✓" : ""}
          </span>
        ))}
      </div>
      {waiting.length > 0 && <p className="vb-hint">Still on screen for {waiting.map((m) => m.name).join(", ")}.</p>}
      <div className="vc-foot"><span style={{ flex: 1 }} /><button type="button" className="vc-btn vc-btn--primary" onClick={onLift}>Lift it</button></div>
    </section>
  );
}
