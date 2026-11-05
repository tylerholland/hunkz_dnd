import { useState } from "react";
import { presenceLabel, presenceState } from "../lib/presence";
import "./presenceDot.css";

// A green / yellow / gray dot on a portrait (or inline): who has the app open.
// Hover, focus or tap shows the words. `light` darkens it for light palettes.
export default function PresenceDot({ name, lastSeen, now, light = false, size = 16, inline = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const state = presenceState(lastSeen, now);
  const label = presenceLabel(name, lastSeen, now);
  return (
    <span
      className={`presence-dot presence-dot--${state}${light ? " presence-dot--light" : ""}${inline ? " presence-dot--inline" : ""}${open ? " open" : ""} ${className}`}
      style={{ "--pd-size": `${size}px` }}
      role="img"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      onBlur={() => setOpen(false)}
    >
      <span className="presence-dot-tip" aria-hidden="true">{label}</span>
    </span>
  );
}
