// The DM's main table actions in Adventure (design/prototypes/dm-adventure-layout.html):
// big tiles for what he reaches for during play. Smaller party actions sit
// under them (passed as children).
export default function DmActionTiles({ tiles, children }) {
  return (
    <section className="dm-action-tiles" aria-label="Table actions">
      <div className="dm-action-tiles-grid">
        {tiles.map(({ key, icon, title, sub, onClick, disabled, wide }) => (
          <button key={key} type="button" className={`dm-action-tile${wide ? " dm-action-tile--wide" : ""}`} onClick={onClick} disabled={disabled}>
            <span className="dm-action-tile-icon" aria-hidden="true">{icon}</span>
            <span className="dm-action-tile-title">{title}</span>
            {sub && <span className="dm-action-tile-sub">{sub}</span>}
          </button>
        ))}
      </div>
      {children}
    </section>
  );
}
