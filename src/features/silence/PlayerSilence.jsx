import { useEffect, useRef, useState } from "react";
import { postSilenceAck } from "../../api";
import "../vote/vote.css";
import "./silence.css";

/**
 * The DM asked for quiet: a big message over everything on this player's
 * screen until they tap "I'm listening" (or the DM lifts it).
 */
export default function PlayerSilence({ silence, slug, password, light = false }) {
  const [acked, setAcked] = useState(null); // the request id this player answered
  const buttonRef = useRef(null);
  const show = !!silence && !(silence.acks || []).includes(slug) && acked !== silence.id;
  useEffect(() => { if (show) buttonRef.current?.focus(); }, [show]);
  if (!show) return null;

  async function listen() {
    setAcked(silence.id);
    try { await postSilenceAck(slug, password, silence.id); } catch { /* it still goes away here; the DM just won't see the tick */ }
  }

  return (
    <div className={`sl-scrim${light ? " sl-scrim--light" : ""}`}>
      <div className="sl-box" role="alertdialog" aria-modal="true" aria-labelledby="sl-title" aria-describedby="sl-sub">
        <div className="sl-icon" aria-hidden="true">✋</div>
        <h2 id="sl-title">Your DM requests your attention!</h2>
        <p id="sl-sub">Silence, please.</p>
        <button ref={buttonRef} type="button" className="vc-btn vc-btn--primary sl-listen" onClick={listen}>I&apos;m listening</button>
      </div>
    </div>
  );
}
