import { useState } from "react";
import { focusObjectPosition, normalizeFocus } from "../home/portraitFocus";
import "./portraitFocusPicker.css";

/**
 * Click the portrait where the face is: the homepage orb (and its card)
 * centre on that point. Shows a marker on the picture and an orb preview.
 * onChange({ x, y } fractions | null to reset).
 */
export default function PortraitFocusPicker({ src, focus, onChange }) {
  const [aspect, setAspect] = useState(0);
  const f = normalizeFocus(focus);

  function pick(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    onChange({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
  }

  return (
    <div className="pfp">
      <button type="button" className="pfp-image" onClick={pick} aria-label="Click where the face is">
        <img src={src} alt="" draggable={false} onLoad={(e) => setAspect(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))} />
        {f && <span className="pfp-marker" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }} aria-hidden="true" />}
      </button>
      <div className="pfp-side">
        <div className="pfp-orb" aria-hidden="true">
          <img src={src} alt="" style={{ objectPosition: focusObjectPosition(f, aspect, { boxAspect: 1, targetY: 0.5 }) }} />
        </div>
        <p className="pfp-hint">Click the picture where the face is. The homepage orb centres on it.</p>
        {f && <button type="button" className="btn-ghost" onClick={() => onChange(null)}>Reset framing</button>}
      </div>
    </div>
  );
}
