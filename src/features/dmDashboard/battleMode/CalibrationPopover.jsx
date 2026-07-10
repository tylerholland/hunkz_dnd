import { useEffect, useRef } from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const STEP = 0.05;

/**
 * CalibrationPopover — ⚙ gear popover in the map panel header (Battle Mode
 * only). 0.5x–2.5x token scale slider with flanking ± steppers, numeric
 * readout, and a reset-to-1.0x ghost button. Writes flow through the
 * debounced `onChange` handler owned by MapPanel.
 */
export default function CalibrationPopover({ tokenScale, onChange, onClose, pal }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const pct = Math.round(((tokenScale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100);

  return (
    <div
      ref={popoverRef}
      className="calib-popover"
      style={{
        "--pal-surface-solid": pal.surfaceSolid || pal.surface,
        "--pal-border": pal.border,
        "--pal-accent": pal.accent,
        "--pal-accent-bright": pal.accentBright,
        "--pal-text-muted": pal.textMuted,
        "--pal-gem": pal.gem || pal.accentBright,
      }}
    >
      <div className="calib-title">Map Calibration</div>
      <div className="calib-subtitle">Token size</div>
      <div className="calib-row">
        <button
          type="button"
          className="calib-step-btn"
          onClick={() => onChange(Math.round((tokenScale - STEP) * 100) / 100, { tween: true })}
          title="Decrease"
        >−</button>
        <input
          className="calib-slider"
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={STEP}
          value={tokenScale}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ "--slider-pct": pct }}
        />
        <button
          type="button"
          className="calib-step-btn"
          onClick={() => onChange(Math.round((tokenScale + STEP) * 100) / 100, { tween: true })}
          title="Increase"
        >+</button>
        <div className="calib-readout">{tokenScale.toFixed(2)}×</div>
      </div>
      <div className="calib-range-labels">
        <span>small</span>
        <span>large</span>
      </div>
      {Math.abs(tokenScale - 1) > 0.001 && (
        <button type="button" className="calib-reset-btn" onClick={() => onChange(1, { tween: true })}>
          ⟳ Reset to 1.00×
        </button>
      )}
    </div>
  );
}
