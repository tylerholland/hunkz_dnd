/**
 * BattleModeToggle — pill button for the MapPanel header.
 * When active: pal.accentDim background + pal.accent border + pal.accentBright text.
 * When inactive: ghost style.
 */
export default function BattleModeToggle({ active, onClick, pal, disabled = false }) {
  const baseClass = `battle-mode-toggle${active ? " battle-mode-toggle--active" : ""}`;
  return (
    <button
      type="button"
      className={baseClass}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        "--pal-border": pal.border,
        "--pal-accent": pal.accent,
        "--pal-accent-bright": pal.accentBright,
        "--pal-accent-dim": pal.accentDim,
        "--pal-text-muted": pal.textMuted,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      title={disabled ? "Tokens not supported on PDF maps" : undefined}
    >
      <span className="battle-mode-toggle__icon">⚔</span>
      {active ? "Battle Mode" : "Battle Mode"}
    </button>
  );
}
