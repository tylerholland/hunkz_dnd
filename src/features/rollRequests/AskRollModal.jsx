import { useEffect, useState } from "react";
import { PALETTES } from "../characterSheet/theme";
import PortraitImg from "../../components/PortraitImg";
import {
  ABILITIES, OTHER_SKILLS, QUICK_SKILLS, abilityCheck, checkBonus, checkName, dcPresets, diceFor, formatBonus, savingThrow, skillCheck,
} from "./rollCheck";
import "../vote/vote.css";
import "./rollRequests.css";
import { shortName } from "../../lib/names";

const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// One party member to pick: round portrait, name under it, their bonus.
function WhoButton({ member, on, bonus, onToggle }) {
  const pal = PALETTES[member.palette] || PALETTES.ocean;
  return (
    <button type="button" className={`rq-who${on ? " on" : ""}`} aria-pressed={on} onClick={onToggle} title={member.name}>
      <i style={{ background: `radial-gradient(circle at 40% 35%, ${pal.accent}, ${pal.surfaceSolid || "#14202b"})` }}>
        {member.portraitUrl ? <PortraitImg src={member.portraitUrl} focus={member.portraitFocus} alt="" /> : (member.name || "?").charAt(0).toUpperCase()}
      </i>
      <span className="rq-who-name">{shortName(member.name)}</span>
      <span className="rq-who-bonus">{formatBonus(bonus)}</span>
    </button>
  );
}

/**
 * The DM's "Ask for a roll" (design/prototypes/dm-adventure-layout.html):
 * who rolls (nobody picked to start), the check, difficulty and advantage, an
 * optional label for the log, and saves / plain ability checks under More
 * options. onSend(fields) resolves to true, or an error message.
 */
export default function AskRollModal({ members, rules, initial = {}, onSend, onClose }) {
  const [who, setWho] = useState(initial.who || []);
  const [check, setCheck] = useState(initial.check || skillCheck("perception"));
  const [dc, setDc] = useState(null);
  const [showDc, setShowDc] = useState(false);
  const [adv, setAdv] = useState("normal");
  const [label, setLabel] = useState("");
  const [more, setMore] = useState(!!initial.more);
  const [state, setState] = useState({ busy: false, error: "" });

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const everyone = members.length > 0 && who.length === members.length;
  const dice = diceFor(check, rules);
  const presets = dcPresets(dice);
  const unusual = check.save || !check.skill;
  const toggle = (slug) => setWho((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
  const askLabel = !who.length ? "Pick who rolls" : everyone ? "Ask everyone" : who.length === 1 ? `Ask ${members.find((m) => m.slug === who[0])?.name || "them"}` : `Ask ${who.length} players`;

  async function send() {
    if (!who.length || state.busy) return;
    setState({ busy: true, error: "" });
    const result = await onSend({ targets: who, check, dc, showDc: !!dc && showDc, adv, label: label.trim() });
    if (result === true) onClose();
    else setState({ busy: false, error: typeof result === "string" ? result : "Couldn't send it. Try again." });
  }

  return (
    <div className="vc-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vc-modal rq-modal" role="dialog" aria-modal="true" aria-labelledby="rq-title">
        <h3 id="rq-title">Ask for a Roll</h3>

        <div className="vc-field">
          <div className="vc-row"><span className="vb-label">Who rolls</span><span style={{ flex: 1 }} />
            <button type="button" className="vc-btn vc-btn--quiet" onClick={() => setWho(everyone ? [] : members.map((m) => m.slug))}>{everyone ? "Clear" : "Everyone"}</button>
          </div>
          <div className="rq-who-row">
            {members.map((m) => <WhoButton key={m.slug} member={m} on={who.includes(m.slug)} bonus={checkBonus(m, check, rules)} onToggle={() => toggle(m.slug)} />)}
          </div>
        </div>

        <div className="vc-field">
          <span className="vb-label">Check</span>
          <div className="rq-chips">
            {QUICK_SKILLS.map((s) => (
              <button key={s} type="button" className={`rq-chip${check.skill === s ? " on" : ""}`} aria-pressed={check.skill === s} onClick={() => setCheck(skillCheck(s))}>{title(s)}</button>
            ))}
            <select
              className={`rq-chip rq-chip-select${check.skill && !QUICK_SKILLS.includes(check.skill) ? " on" : ""}`}
              value={check.skill && !QUICK_SKILLS.includes(check.skill) ? check.skill : ""}
              onChange={(e) => { if (e.target.value) setCheck(skillCheck(e.target.value)); }}
              aria-label="Another skill"
            >
              <option value="">Other skill…</option>
              {OTHER_SKILLS.map((s) => <option key={s} value={s}>{title(s)}</option>)}
            </select>
          </div>
        </div>

        <div className="vc-field">
          <span className="vb-label">Difficulty</span>
          <div className="rq-chips">
            {presets.map((n) => (
              <button key={n} type="button" className={`rq-chip${dc === n ? " on" : ""}`} aria-pressed={dc === n} onClick={() => setDc(dc === n ? null : n)}>DC {n}</button>
            ))}
            <input
              className="vc-in rq-dc-in"
              inputMode="numeric"
              placeholder="DC"
              aria-label="Another DC"
              value={dc && !presets.includes(dc) ? dc : ""}
              onChange={(e) => { const n = parseInt(e.target.value, 10); setDc(n >= 1 && n <= 40 ? n : null); }}
            />
            <span style={{ flex: 1 }} />
            <span className="vc-seg" role="group" aria-label="Advantage">
              {[["normal", "Normal"], ["adv", "Adv."], ["dis", "Dis."]].map(([k, l]) => (
                <button key={k} type="button" className={adv === k ? "on" : ""} aria-pressed={adv === k} title={k === "adv" ? "Advantage" : k === "dis" ? "Disadvantage" : "Normal"} onClick={() => setAdv(k)}>{l}</button>
              ))}
            </span>
          </div>
          <p className="vb-hint">{dc ? `Each result shows pass or fail for you. Players ${showDc ? "see" : "don't see"} the DC.` : "No DC: you judge the results."}</p>
        </div>

        <label className="vc-field">
          <span className="vb-label">Label <span className="rq-aside">optional, for the session log and Chronicle</span></span>
          <input className="vc-in" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Searching the Guildmaster's study" maxLength={60} />
        </label>

        <button type="button" className="rq-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? "▴" : "▾"} More options{unusual && !more ? ` · ${checkName(check)}` : ""}
        </button>
        {more && (
          <div className="rq-more-body">
            <div className="rq-more-cols">
              <div className="vc-field">
                <span className="rq-sub">Saving throw</span>
                <div className="rq-abil-grid">
                  {ABILITIES.map((a) => (
                    <button key={a.key} type="button" className={`rq-chip${check.save && check.ability === a.key ? " on" : ""}`} onClick={() => setCheck(savingThrow(a.key))}>{a.abbr}</button>
                  ))}
                </div>
              </div>
              <div className="vc-field">
                <span className="rq-sub">Plain ability check</span>
                <div className="rq-abil-grid">
                  {ABILITIES.map((a) => (
                    <button key={a.key} type="button" className={`rq-chip${!check.save && !check.skill && check.ability === a.key ? " on" : ""}`} onClick={() => setCheck(abilityCheck(a.key))}>{a.abbr}</button>
                  ))}
                </div>
              </div>
            </div>
            {dc && (
              <button type="button" className="vc-switch" role="switch" aria-checked={showDc} onClick={() => setShowDc((v) => !v)}>
                <span className="vc-sw"><i /></span>Players see the DC
              </button>
            )}
          </div>
        )}

        {state.error && <p className="vc-error" role="alert">{state.error}</p>}
        <div className="vc-foot">
          <span className="vb-hint">{checkName(check)} · {dice}{adv !== "normal" ? (adv === "adv" ? " · advantage" : " · disadvantage") : ""}{dc ? ` · DC ${dc}` : ""}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="vc-btn vc-btn--quiet" onClick={onClose}>Cancel</button>
          <button type="button" className="vc-btn vc-btn--primary" onClick={send} disabled={!who.length || state.busy}>{state.busy ? "Sending…" : askLabel}</button>
        </div>
      </div>
    </div>
  );
}
