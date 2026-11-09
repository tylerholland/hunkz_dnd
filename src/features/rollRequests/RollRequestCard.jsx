import { VoteToken } from "../vote/VoteBoard";
import { checkBonus, checkName, formatBonus } from "./rollCheck";
import "../vote/vote.css";
import "./rollRequests.css";

/**
 * A roll request while it's out, for the DM: who's rolled what (pass / fail
 * against a DC), Reveal rolls (everyone asked sees everyone's), Cancel (not
 * logged) and Close / Done (into the session log). onAction(action, id).
 */
export default function RollRequestCard({ request, members, rules, onAction }) {
  const bySlug = new Map(members.map((m) => [m.slug, m]));
  const results = request.results || {};
  const inCount = request.targets.filter((s) => results[s]).length;
  const allIn = inCount === request.targets.length;
  return (
    <section className="vc-card rq-card" aria-label="Roll request">
      <div className="vc-head">
        <span className="vb-label">Asked for a roll · {request.dice}</span>
        <span className="rq-count">{inCount} of {request.targets.length} in</span>
      </div>
      <b className="rq-card-title">{checkName(request.check)}</b>
      {request.label && <p className="rq-card-label">“{request.label}”</p>}
      <p className="vb-hint">
        {request.dc ? `DC ${request.dc}${request.showDc ? " (players see it)" : " (hidden from players)"}` : "No DC: you judge the result"}
        {request.adv === "adv" ? " · with advantage" : request.adv === "dis" ? " · with disadvantage" : ""}
      </p>
      <div className="rq-rows">
        {request.targets.map((slug) => {
          const member = bySlug.get(slug) || { slug, name: slug };
          const res = results[slug];
          const pass = res && request.dc ? res.total >= request.dc : null;
          return (
            <div key={slug} className={`rq-row${pass === true ? " pass" : pass === false ? " fail" : ""}`}>
              <VoteToken member={member} small />
              <span className="rq-row-name">{member.name} <span className="rq-row-bonus">{formatBonus(checkBonus(member, request.check, rules))}</span></span>
              <span className="rq-row-mark">{pass === true ? "pass" : pass === false ? "fail" : res?.manual ? "own dice" : ""}</span>
              <span className={`rq-row-total${res ? "" : " waiting"}`}>{res ? res.total : "rolling…"}</span>
            </div>
          );
        })}
      </div>
      <div className="vc-foot">
        <button type="button" className="vc-btn vc-btn--danger" onClick={() => onAction("cancel", request.id)}>Cancel</button>
        <span style={{ flex: 1 }} />
        {request.targets.length > 1 && (request.revealed
          ? <span className="vb-hint">Revealed to the party</span>
          : <button type="button" className={`vc-btn${allIn ? "" : " vc-btn--quiet"}`} title="Everyone asked sees everyone's results" onClick={() => onAction("reveal", request.id)}>Reveal rolls</button>)}
        <button type="button" className="vc-btn vc-btn--primary" onClick={() => onAction("close", request.id)}>{allIn ? "Done" : "Close it now"}</button>
      </div>
    </section>
  );
}
