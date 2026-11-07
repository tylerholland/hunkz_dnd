import PortraitImg from "../../components/PortraitImg";
import { PALETTES } from "../characterSheet/theme";
import { presenceState } from "../../lib/presence";
import { LETTERS, tally } from "./voteUtil";
import "./vote.css";

// A player's token on the board: their portrait, or their initial in their colour.
export function VoteToken({ member, small = false, faded = false, dot = null }) {
  const pal = PALETTES[member.palette] || PALETTES.ocean;
  return (
    <span className={`vb-tok${small ? " vb-tok--small" : ""}${faded ? " vb-tok--faded" : ""}`} title={member.name}>
      <i style={{ background: `radial-gradient(circle at 40% 35%, ${pal.accent}, ${pal.surfaceSolid || "#14202b"})` }}>
        {member.portraitUrl ? <PortraitImg src={member.portraitUrl} focus={member.portraitFocus} alt="" /> : (member.name || "?").charAt(0).toUpperCase()}
        {dot && <span className={`vb-dot vb-dot--${dot}`} aria-hidden="true" />}
      </i>
      {!small && <small>{member.name}</small>}
    </span>
  );
}

/**
 * The vote board: a box per option with each voter's token in it. A sole
 * leader glows; once closed, the chosen (or tied) boxes are marked and the
 * rest fade. `tray` adds "Still deciding" (who hasn't voted, with their
 * who's-here dot) while it's open.
 */
export default function VoteBoard({ vote, members, closed = false, tray = false, presence = {}, serverTime }) {
  const { counts, max } = tally(vote);
  const tie = counts.filter((n) => n === max).length > 1;
  const lead = (i) => max > 0 && counts[i] === max && (!tie || closed);
  const bySlug = new Map(members.map((m) => [m.slug, m]));
  const waiting = members.filter((m) => !vote.ballots?.[m.slug]?.length);
  return (
    <>
      <div className={`vb-board${closed ? " vb-board--closed" : ""}`}>
        {vote.options.map((option, i) => (
          <div key={i} className={`vb-box${lead(i) ? " vb-box--lead" : ""}`}>
            <div className="vb-box-h">
              <span className="vb-letter">{LETTERS[i]}</span>
              <span className="vb-name">{option}</span>
              <span className="vb-count">{counts[i]}</span>
            </div>
            <span className="vb-tag">{closed ? (tie ? "Tied" : "Chosen") : "Leading"}</span>
            <div className="vb-toks">
              {Object.entries(vote.ballots || {}).filter(([, picks]) => picks.includes(i)).map(([slug]) => bySlug.get(slug) && <VoteToken key={slug} member={bySlug.get(slug)} />)}
            </div>
          </div>
        ))}
      </div>
      {tray && !closed && (
        <div className="vb-tray">
          <span className="vb-label">Still deciding</span>
          {waiting.length
            ? waiting.map((m) => <VoteToken key={m.slug} member={m} faded dot={serverTime ? presenceState(presence[m.slug], serverTime) : null} />)
            : <span className="vb-hint">Everyone's voted.</span>}
        </div>
      )}
    </>
  );
}
