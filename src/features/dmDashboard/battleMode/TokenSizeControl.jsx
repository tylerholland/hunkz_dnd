import { MAX_TOKEN_SCALE, MIN_TOKEN_SCALE, sizeLabel, stepTokenScale } from "./tokenSizes";
import "./tokenSizeControl.css";

// Compact "− LARGE 2× +" size stepper (Story 65). Shared by the token hover
// card and the NPC card's ⋯ menu. Pointer events stop here so a tap never
// starts a token drag, long-press, or targeting gesture underneath.
export default function TokenSizeControl({ scale, onChange, className = "", disabled = false }) {
  const value = Number.isFinite(scale) ? scale : 1.0;
  const stop = (e) => e.stopPropagation();
  const step = (direction) => (e) => {
    e.stopPropagation();
    const next = stepTokenScale(value, direction);
    if (next !== value) onChange(next);
  };
  return (
    <div
      className={`token-size-ctl${disabled ? " token-size-ctl--disabled" : ""} ${className}`.trim()}
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={stop}
    >
      <button
        type="button"
        className="token-size-ctl__btn"
        onClick={step(-1)}
        disabled={disabled || value <= MIN_TOKEN_SCALE}
        aria-label="Decrease token size"
      >−</button>
      <span className="token-size-ctl__readout">
        <span className="token-size-ctl__label">{sizeLabel(value)}</span>
        <span className="token-size-ctl__mult">{value}×</span>
      </span>
      <button
        type="button"
        className="token-size-ctl__btn"
        onClick={step(1)}
        disabled={disabled || value >= MAX_TOKEN_SCALE}
        aria-label="Increase token size"
      >+</button>
    </div>
  );
}
