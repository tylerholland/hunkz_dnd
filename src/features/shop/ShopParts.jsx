// Story 72 — pieces of the player's shop page.
import { I, itemArt, shelfColor, fmtDay, fmtTime, fromNow } from "./shopData";

/** A line-drawn icon (static paths from shopData). */
export function ShopIcon({ name }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: I[name] || I.pack }} />
  );
}

/** An item's round frame: its picture if there is one, else its icon. */
export function ItemOrb({ item, art = itemArt(item.id), className = "" }) {
  return (
    <span className={`sp-orb${art ? " art" : ""} ${className}`} style={{ "--cat": shelfColor(item.cat) }}>
      {art ? <img src={art} alt="" loading="lazy" /> : <ShopIcon name={item.icon} />}
    </span>
  );
}

/** Shutters over the scene: closed, back soon, or shut for the fighting. */
export function ShopShutters({ status, opensAt, closesText, keeperName, plaques = {} }) {
  if (status === "thrown") {
    return (
      <div className="sp-shutters" role="status">
        <div className="sp-plaque"><h2>And Stay Out!</h2><p>“{plaques.thrown}” — {keeperName}</p></div>
        <div className="sp-when">You've been thrown out for this opening<small>A friend can still buy for you. The DM can let you back in.</small></div>
      </div>
    );
  }
  if (status === "combat") {
    return (
      <div className="sp-shutters fight" role="status">
        <div className="sp-plaque"><h2>Closed for the Fighting</h2><p>“{plaques.fight}” — {keeperName}</p></div>
        <p style={{ fontStyle: "italic", opacity: 0.85, margin: 0 }}>The shop reopens when the fighting ends. Your satchel keeps.</p>
      </div>
    );
  }
  if (status === "scheduled" && opensAt) {
    const t = Date.parse(opensAt);
    return (
      <div className="sp-shutters" role="status">
        <div className="sp-plaque"><h2>Back Soon</h2><p>“{plaques.backSoon}” — {keeperName}</p></div>
        <div className="sp-when">Opens {fmtDay(t)} at {fmtTime(t)}<small>{fromNow(t)} · {closesText}</small></div>
      </div>
    );
  }
  return (
    <div className="sp-shutters" role="status">
      <div className="sp-plaque"><h2>Closed</h2><p>“{plaques.closed}” — {keeperName}</p></div>
      <div className="sp-when">Not open right now<small>The DM opens the shop when the story brings you here.</small></div>
    </div>
  );
}

/** Your pack: what you already carry, plus what's in the satchel on its way. */
export function PackPanel({ character, groups, satchelRows, fresh, open, onToggle, purseLabel, sell = null }) {
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const initial = (character?.name || "?").trim().charAt(0).toUpperCase();
  const row = (r, extra = "") => (
    <div className={`sp-pack-row${extra}${fresh.has(r.key) ? " fresh" : ""}`} key={r.key}>
      <ItemOrb item={{ id: r.id || r.key, cat: r.cat, icon: r.icon }} art={r.art} />
      <span className="nm">{r.name}</span>
      {r.worn ? <span className="worn">worn</span> : <span className="q">{r.qty > 1 ? `×${r.qty}` : ""}</span>}
    </div>
  );
  return (
    <aside className={`sp-pack${open ? " open" : ""}`} aria-label="Your pack">
      <button className="sp-pack-head" type="button" onClick={onToggle} aria-expanded={open}>
        {character?.portraitUrl ? <img src={character.portraitUrl} alt="" /> : <span className="ini">{initial}</span>}
        <span><b>Your pack</b><small>{character?.name} · {total} thing{total === 1 ? "" : "s"}</small></span>
        <span className="chev">{open ? "▴" : "▾"}</span>
      </button>
      {satchelRows.length > 0 && (
        <div className="sp-pack-group"><h4>In your satchel</h4>{satchelRows.map((r) => row(r, " coming"))}</div>
      )}
      {groups.map((g) => <div className="sp-pack-group" key={g.name}><h4>{g.name}</h4>{g.rows.map((r) => row(r))}</div>)}
      {!total && <p className="sp-pack-empty">Nothing yet but lint and hope.</p>}
      <div className="sp-pack-foot"><span>Purse <b>{purseLabel}</b></span><span>Satchel <b>{satchelRows.reduce((n, r) => n + r.qty, 0)}</b></span></div>
      {sell && <button className={`sp-btn sp-pack-sell${sell.active ? " on" : ""}`} type="button" onClick={sell.onClick}><ShopIcon name="coin" /> {sell.label}</button>}
    </aside>
  );
}

/** The satchel: a bottom sheet with the lines, the total and Pay. */
export function SatchelSheet({ open, onToggle, lines, total, purse, onRemove, onPay, paying, error }) {
  const n = lines.reduce((s, l) => s + l.qty, 0);
  const after = purse - total;
  return (
    <div className={`sp-sheet${open ? " open" : ""}`}>
      <button className="sp-sheet-head" type="button" onClick={onToggle} aria-expanded={open}>
        <b>Your satchel</b><span className="sum">{n ? `${n} item${n === 1 ? "" : "s"} · ${total.toLocaleString()}s` : "empty"}</span><span aria-hidden="true">{open ? "▾" : "▴"}</span>
      </button>
      <div className="sp-sheet-body">
        {lines.length ? lines.map((l, i) => (
          <div className="sp-line" key={l.item.id}>
            <ItemOrb item={l.item} />
            <span>{l.item.name}{l.qty > 1 ? ` × ${l.qty}` : ""}{l.deal?.short && <small className={l.deal.mult < 1 ? "disc" : "bad"}>{l.deal.short}</small>}</span>
            <span>{l.deal && <s className="was">{(l.item.price * l.qty).toLocaleString()}s</s>}{l.deal ? " " : ""}{(l.each * l.qty).toLocaleString()}s</span>
            <button className="x" type="button" aria-label={`Put back ${l.item.name}`} onClick={() => onRemove(i)}>×</button>
          </div>
        )) : <p style={{ opacity: 0.7, fontStyle: "italic" }}>Nothing yet. Pick something off the shelves.</p>}
        {lines.length > 0 && (
          <div className="sp-totals">
            <div className="grand"><span>Total</span><span>{total.toLocaleString()}s</span></div>
            <div><span>Your purse after</span><span className={after < 0 ? "bad" : ""}>{Math.round(after * 10) / 10}s</span></div>
          </div>
        )}
        <div className="sp-actions">
          {error && <p className="sp-error" role="alert">{error}</p>}
          <button className="sp-btn gold" type="button" onClick={onPay} disabled={!lines.length || after < 0 || paying}>{paying ? "Paying…" : "Pay"}</button>
        </div>
      </div>
    </div>
  );
}

/** The receipt, after paying. */
export function Receipt({ shopName, buyer, lines, total, onDone }) {
  return (
    <div className="sp-veil" onClick={(e) => { if (e.target === e.currentTarget) onDone(); }}>
      <div className="sp-receipt" role="dialog" aria-label="Receipt">
        <h3>{shopName}</h3><small style={{ margin: 0 }}>Sold to {buyer}</small>
        <div className="r-lines">
          {lines.map((l) => <div key={l.itemId}><span>{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}{l.short ? <i> ({l.short})</i> : null}</span><span>{(l.each * l.qty).toLocaleString()}s</span></div>)}
          <div style={{ fontWeight: 600 }}><span>Paid</span><span>{total.toLocaleString()}s</span></div>
        </div>
        <span className="stamp">Paid in full</span>
        <small>Added to {buyer}'s pack.</small>
        <div style={{ marginTop: 14 }}><button className="sp-btn gold" type="button" onClick={onDone} autoFocus>Back to the shelves</button></div>
      </div>
    </div>
  );
}
