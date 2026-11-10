import { useState } from "react";
import { PALETTES } from "./theme";
import PortraitImg from "../../components/PortraitImg";
import { shortName } from "../../lib/names";

/**
 * Give an item to someone else in the party (Session view inventory): pick
 * who, how many (for a stack), then confirm. onGive(toSlug, qty) resolves to
 * true or an error message.
 */
export default function GiveItemPanel({ item, party, onGive, onClose }) {
  const [to, setTo] = useState(null);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState({ busy: false, error: "" });
  const stack = Number.isFinite(item.qty) ? item.qty : null;
  const who = party.find((m) => m.slug === to);

  async function give() {
    if (!to || state.busy) return;
    setState({ busy: true, error: "" });
    const result = await onGive(to, qty);
    if (result === true) onClose();
    else setState({ busy: false, error: typeof result === "string" ? result : "Couldn't give it. Try again." });
  }

  if (!party.length) {
    return (
      <div className="cs-give">
        <span className="cs-give-hint">There's no one else in the party to give it to.</span>
        <div className="cs-give-foot"><span style={{ flex: 1 }} /><button type="button" className="cs-give-btn quiet" onClick={onClose}>Close</button></div>
      </div>
    );
  }
  return (
    <div className="cs-give" role="group" aria-label={`Give ${item.name}`}>
      <span className="cs-give-hint">Give it to…</span>
      <div className="cs-give-who">
        {party.map((m) => {
          const pal = PALETTES[m.palette] || PALETTES.ocean;
          return (
            <button key={m.slug} type="button" title={m.name} className={`cs-give-person${to === m.slug ? " on" : ""}`} aria-pressed={to === m.slug} onClick={() => setTo(m.slug)}>
              <i style={{ background: `radial-gradient(circle at 40% 35%, ${pal.accent}, ${pal.surfaceSolid || "#14202b"})` }}>
                {m.portraitUrl ? <PortraitImg src={m.portraitUrl} focus={m.portraitFocus} alt="" /> : (m.name || "?").charAt(0).toUpperCase()}
              </i>
              <span>{shortName(m.name)}</span>
            </button>
          );
        })}
      </div>
      {stack > 1 && (
        <div className="cs-give-qty">
          <span className="cs-give-hint">How many</span>
          <button type="button" className="cs-sm-ld-qtybtn" onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty <= 1} aria-label="One fewer">−</button>
          <span aria-live="polite">{qty}</span>
          <button type="button" className="cs-sm-ld-qtybtn" onClick={() => setQty((n) => Math.min(stack, n + 1))} disabled={qty >= stack} aria-label="One more">+</button>
          <span className="cs-give-hint">of {stack}</span>
        </div>
      )}
      {state.error && <span className="cs-give-error" role="alert">{state.error}</span>}
      <div className="cs-give-foot">
        <button type="button" className="cs-give-btn quiet" onClick={onClose}>Cancel</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="cs-give-btn" onClick={give} disabled={!to || state.busy}>
          {state.busy ? "Giving…" : who ? `Give ${stack != null && stack > 1 ? `${qty} ` : ""}${item.name} to ${shortName(who.name)}` : "Pick who"}
        </button>
      </div>
    </div>
  );
}
