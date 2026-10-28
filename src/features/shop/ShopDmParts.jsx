// Story 72 — pieces of the DM's shop page (design/prototypes/shop.html, "DM · Open the shop").
import { useMemo, useRef, useState } from "react";
import {
  KEEPERS, SCENES, USUAL, SHELVES, LEVELS, FILL_NAMES, TEMPERS, shelfColor, markupName, markedPrice, sameMarkups,
  fmtDay, fmtTime, fromNow, closesText, keeperFaceStyle,
} from "./shopData";
import { byMood, linesFor } from "./keeperLines";
import { catalogToCsv, csvToItems, diffCatalog } from "./shopCsv";
import { ItemOrb } from "./ShopParts";
import { InfoTip } from "./ShopHelp";

const Seg = ({ value, options, onChange, disabled, label }) => (
  <div className="sd-seg" role="group" aria-label={label}>
    {options.map(([v, l]) => (
      <button key={v} type="button" className={v === value ? "on" : ""} aria-pressed={v === value} disabled={disabled} onClick={() => onChange(v)}>{l}</button>
    ))}
  </div>
);
const toLocalInput = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// ── The sticky status bar: the state and its one main action first; the
// schedule under it, opening into an editor that saves as a whole.
export function StatusBar({ info, opening, nextSessionAt, inStock, busy, onAction, onSchedule, onPreview, now }) {
  const [draft, setDraft] = useState(null);
  const { status } = info;
  const isLive = status === "open" || status === "lockup";
  const lockLeft = info.lockupUntil ? Math.max(0, Math.ceil((Date.parse(info.lockupUntil) - now) / 1000)) : 0;
  const opens = info.opensAt ? Date.parse(info.opensAt) : null;
  const s = {
    open: { t: "Open", sub: <><small>In stock</small> {inStock}</>, main: ["close", "Close now"] },
    lockup: { t: "Locking up", sub: `Anyone with something in their satchel has ${Math.floor(lockLeft / 60)}:${String(lockLeft % 60).padStart(2, "0")} to pay`, main: ["closeNow", "Close at once"] },
    combat: { t: "Shut for the fighting", sub: "Combat closed it; it reopens when combat ends" },
    scheduled: { t: "Scheduled", sub: opens ? `Opens ${fmtDay(opens)} at ${fmtTime(opens)} · ${fromNow(opens, now)}, no need to be online` : "", main: ["open", "Open now"], alt: ["cancel", "Cancel opening"] },
    closed: { t: "Closed", sub: "Players see the shutters", main: ["open", "Open now"] },
  }[status] || { t: status };
  const none = status === "closed" || status === "combat";
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const schedText = isLive ? cap(closesText(info, nextSessionAt))
    : status === "scheduled" && opens && opening?.mode === "next" && nextSessionAt
      ? `${opening.lead} min before ${fmtDay(Date.parse(nextSessionAt))}'s session (${fmtTime(opens)}), ${opening.closeOn === "start" ? "closes as it starts" : "open until you close it"}`
    : status === "scheduled" && opens ? `${fmtDay(opens)}, ${fmtTime(opens)}${info.closesAt ? ` until ${fmtDay(Date.parse(info.closesAt))}, ${fmtTime(Date.parse(info.closesAt))}` : ", open until you close it"}`
    : "No opening scheduled";

  function openEditor() {
    const next = nextSessionAt ? Date.parse(nextSessionAt) : null;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    setDraft(isLive
      ? { nowClose: "manual" }
      : { mode: next ? "next" : "pick", lead: 45, closeOn: "start", opens: toLocalInput(+tomorrow), closes: toLocalInput(next || +tomorrow + 3 * 3600000) });
  }
  async function save() {
    if (isLive) await onAction("closes", { nowClose: draft.nowClose });
    else await onSchedule(draft.mode === "pick"
      ? { mode: "pick", opens: new Date(draft.opens).toISOString(), closes: draft.closes ? new Date(draft.closes).toISOString() : null }
      : { mode: "next", lead: draft.lead, closeOn: draft.closeOn });
    setDraft(null);
  }
  const next = nextSessionAt ? Date.parse(nextSessionAt) : null;

  return (
    <div className="sd-sbar-wrap">
      <div className={`sd-sbar is-${status}`} data-tour="status">
        <div className="sd-sb-main">
          <span className="dot" aria-hidden="true" />
          <div className="what"><b>{s.t} <InfoTip id="status" /></b><span>{s.sub}</span></div>
          <button className="sd-tbtn" type="button" data-tour="preview" onClick={onPreview} title="Walk the shop as players will see it, with these settings. Nothing changes.">👁 Preview</button>
          {s.alt && <button className="sd-tbtn" type="button" disabled={busy} onClick={() => onAction(s.alt[0])}>{s.alt[1]}</button>}
          {s.main && <button className="sd-gold" type="button" data-tour="main" disabled={busy} onClick={() => onAction(s.main[0])}>{s.main[1]}</button>}
        </div>
        <div className="sd-sb-sched">
          <span className="lbl">{isLive ? "Closes" : "Schedule"}</span>
          <span className="txt">{schedText}</span>
          <InfoTip id="schedule" />
          {!draft && <button className={`sd-tbtn${none ? " primary" : ""} push`} type="button" onClick={openEditor}>{none ? "＋ Schedule an opening" : "✎ Change"}</button>}
        </div>
        {draft && (
          <div className="sd-sb-edit">
            {isLive ? (
              <div className="sd-row"><span className="lbl">Closes</span>
                <Seg label="Closes" value={draft.nowClose} onChange={(v) => setDraft({ ...draft, nowClose: v })} options={[["manual", "When I close it"], ["hour", "In an hour"], ["start", "When the session starts"]]} />
              </div>
            ) : (
              <>
                <div className="sd-row"><span className="lbl">Opens</span>
                  <Seg label="Opens" value={draft.mode} onChange={(v) => setDraft({ ...draft, mode: v })} options={[...(next ? [["next", "Before the next session"]] : []), ["pick", "Pick the times"]]} />
                </div>
                {draft.mode === "next" ? (
                  <>
                    <div className="sd-row"><span className="lbl" />
                      <select className="sd-in" value={draft.lead} onChange={(e) => setDraft({ ...draft, lead: Number(e.target.value) })} aria-label="How long before the session">
                        {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`} before</option>)}
                      </select>
                      <span className="sd-from">{fmtDay(next)} · {fmtTime(next)} <small>(from the Chronicle)</small></span>
                      <span>→ opens at <b>{fmtTime(next - draft.lead * 60000)}</b></span>
                    </div>
                    <div className="sd-row"><span className="lbl">Closes</span>
                      <Seg label="Closes" value={draft.closeOn} onChange={(v) => setDraft({ ...draft, closeOn: v })} options={[["start", "When the session starts"], ["manual", "When I close it"]]} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sd-row"><span className="lbl" /><input className="sd-in" type="datetime-local" value={draft.opens} onChange={(e) => setDraft({ ...draft, opens: e.target.value })} aria-label="Opens at" /></div>
                    <div className="sd-row"><span className="lbl">Closes</span><input className="sd-in" type="datetime-local" value={draft.closes} onChange={(e) => setDraft({ ...draft, closes: e.target.value })} aria-label="Closes at" />
                      <span className="sd-hint">Leave it open for days for downtime between sessions.</span></div>
                  </>
                )}
              </>
            )}
            <div className="sd-row sd-acts">
              <span className="sd-hint">{isLive ? "" : "You don't need to be online: the shop opens and closes itself."}</span>
              <span style={{ flex: 1 }} />
              <button className="sd-tbtn" type="button" onClick={() => setDraft(null)}>Cancel</button>
              <button className="sd-tbtn primary" type="button" disabled={busy || (!isLive && draft.mode === "pick" && !draft.opens)} onClick={save}>Save schedule</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// The place the chosen sign suggests, as [town, street].
const signPlace = (setup) => {
  const k = KEEPERS[setup.keeper] || KEEPERS.mags;
  return k.names[Math.max(0, Math.min(k.names.length - 1, setup.sign?.nameIdx || 0))][1].split(" · ");
};

// ── The shop: a template (a keeper and their usual setup) or a saved shop.
export function ShopPicker({ setup, display, onPick, onSign, onPlace, onTemper, onBuysBack, onReset, onSave }) {
  const isSaved = setup.saved.some((m) => m.id === setup.pick);
  const [tab, setTab] = useState(isSaved ? "saved" : "templates");
  const k = KEEPERS[setup.keeper];
  const scene = SCENES[setup.keeper];
  const u = USUAL[setup.keeper];
  const usual = u.cats.length === setup.carries.length && u.cats.every((c) => setup.carries.includes(c)) && sameMarkups(u.markups, setup.markups) && u.temper === setup.temper;
  const own = !!setup.sign?.custom;
  const greet = useMemo(() => [byMood(linesFor(setup.keeper).greet, "easy")].flat()[0].replace("{name}", "friend"), [setup.keeper]);
  const card = (id, key, title, sub) => (
    <button key={id} type="button" className={`sd-kc${setup.pick === id ? " on" : ""}`} style={keeperFaceStyle(key)} onClick={() => onPick(id)} aria-pressed={setup.pick === id}>
      <span>{title}<small>{sub}</small></span>
    </button>
  );
  return (
    <section className="sd-card setup" aria-labelledby="sd-shop-h" data-tour="shop">
      <h3 id="sd-shop-h">The shop <InfoTip id="shop" /></h3>
      <Seg label="Shop list" value={tab} onChange={setTab} options={[["templates", `Shop templates · ${Object.keys(KEEPERS).length}`], ["saved", `Saved shops · ${setup.saved.length}`]]} />
      <div className="sd-keepers">
        {tab === "templates"
          ? Object.keys(KEEPERS).map((key) => card(key, key, KEEPERS[key].keeper, KEEPERS[key].names[0][0]))
          : setup.saved.length
            ? setup.saved.map((m) => card(m.id, m.keeper, m.name, `${KEEPERS[m.keeper]?.keeper} · ${String(m.where || "").split(" · ")[0]}`))
            : <p className="sd-hint" style={{ margin: 0 }}>No saved shops yet. Set one up from a template and press Save this shop.</p>}
      </div>
      <div className="sd-prev" style={{ backgroundImage: `url(${scene.src})`, backgroundPosition: scene.pos }}>
        <div className="txt"><div className="where">{display.where}</div><h4>{display.name}</h4><p>{display.sub}</p><q>{greet}</q></div>
      </div>
      <div className="sd-row"><span className="lbl">Sign</span>
        <div className="sd-names">
          {k.names.map(([n], i) => <button key={n} type="button" className={!own && (setup.sign?.nameIdx || 0) === i ? "on" : ""} onClick={() => onSign({ nameIdx: i })}>{n}</button>)}
          <button type="button" className={own ? "on" : ""} onClick={() => onSign({ nameIdx: setup.sign?.nameIdx || 0, custom: { name: display.name } })}>Your own name…</button>
        </div>
      </div>
      {own && (
        <div className="sd-row"><span className="lbl" />
          <input className="sd-in" value={setup.sign.custom.name} onChange={(e) => onSign({ ...setup.sign, custom: { ...setup.sign.custom, name: e.target.value } })} aria-label="Shop name" placeholder="Shop name" />
        </div>
      )}
      <div className="sd-row"><span className="lbl">Town</span>
        <input className="sd-in" value={setup.place?.town || ""} onChange={(e) => onPlace({ ...setup.place, town: e.target.value })} aria-label="Town" placeholder={signPlace(setup)[0]} style={{ width: 170 }} />
        <input className="sd-in" value={setup.place?.street || ""} onChange={(e) => onPlace({ ...setup.place, street: e.target.value })} aria-label="Street or district (optional)" placeholder={signPlace(setup)[1] || "Street (optional)"} style={{ width: 210 }} />
        <InfoTip id="town" />
      </div>
      <div className="sd-row" data-tour="temper"><span className="lbl">Temper</span>
        <Seg label="Temper" value={setup.temper} onChange={onTemper} options={Object.entries(TEMPERS).map(([key, t]) => [key, t.name])} />
        <InfoTip id="temper" />
      </div>
      <p className="sd-hint">{TEMPERS[setup.temper].hint}</p>
      <div className="sd-row"><span className="lbl">Buys back</span>
        <button type="button" className={`sd-sw${setup.buysBack !== false ? " on" : ""}`} role="switch" aria-checked={setup.buysBack !== false} aria-label="Buys back from players" onClick={() => onBuysBack(setup.buysBack === false)}><i /></button>
        <span>{setup.buysBack !== false ? `${k.keeper} buys things back at half the list price` : `${k.keeper} only sells`}</span>
        <InfoTip id="buysBack" />
      </div>
      <div className="sd-row sd-foot">
        <span className="sd-hint" style={{ margin: 0 }}>
          {isSaved ? "A saved shop: changes you make are kept with it."
            : usual ? `${k.keeper}'s usual: ${u.cats.length} shelves, ${LEVELS[u.level].name.toLowerCase()}, ${TEMPERS[u.temper].name.toLowerCase()}.`
            : `Changed from ${k.keeper}'s usual. Your changes are remembered for next time.`}
        </span>
        <span style={{ flex: 1 }} />
        {!isSaved && <button className="sd-tbtn" type="button" disabled={usual} onClick={onReset}>Reset to usual</button>}
        {!isSaved && <button className="sd-tbtn primary" type="button" onClick={() => { onSave(); setTab("saved"); }}>Save this shop</button>}
      </div>
    </section>
  );
}

// ── Shelves & stock: one row per shelf — carried or not, its markup, its stock.
export function ShelvesStock({ setup, items, isLive, locked, onUpdate, onRollPrices, onRollStock, onCarryItem }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const out = new Set(setup.out);
  const shown = items.filter((it) => !it.hidden);
  const carriedItems = shown.filter((it) => setup.carries.includes(it.cat));
  const q = query.trim().toLowerCase();
  const hits = (it) => !q || it.name.toLowerCase().includes(q);
  const all = SHELVES.every((s) => expanded.has(s.id));
  const toggleOut = (id) => onUpdate({ out: out.has(id) ? setup.out.filter((x) => x !== id) : [...setup.out, id] });
  const lockCls = locked ? " locked" : "";
  return (
    <section className={`sd-card${isLive ? " live" : ""}`} aria-labelledby="sd-stock-h" data-tour="stock">
      <h3 id="sd-stock-h">Shelves &amp; stock <InfoTip id="stock" /> {isLive && <span className="sd-livepill">Live</span>}</h3>
      <div className={`sd-row${lockCls}`} style={{ marginTop: 0 }}><span className="lbl">Prices</span>
        <Seg label="Price level" value={setup.level} disabled={locked} onChange={(v) => onRollPrices(v)} options={Object.entries(LEVELS).map(([key, l]) => [key, l.name])} />
        <button className="sd-tbtn" type="button" disabled={locked} onClick={() => onRollPrices(setup.level)}>⟳ Reroll prices</button>
        <InfoTip id="prices" />
      </div>
      <div className="sd-row"><span className="lbl">Stock</span>
        <Seg label="Stock level" value={setup.fill} disabled={isLive} onChange={(v) => onRollStock(v)} options={Object.entries(FILL_NAMES)} />
        <button className="sd-tbtn" type="button" disabled={isLive || setup.fill === "all"} onClick={() => onRollStock(setup.fill)}>⟳ Reroll stock</button>
        <InfoTip id="stockLevel" />
        <span className="sd-count"><small>In stock</small> {carriedItems.filter((it) => !out.has(it.id)).length} of {carriedItems.length}</span>
      </div>
      <p className="sd-hint">{isLive
        ? "No rerolling while the shop is open. Flip items one at a time instead; restocked items show as “Just in”."
        : "Each shelf's markup and stock are rolled from these; nudge any of them below. The stock roll favours staples: bread and rope rarely run out; armour, mounts and the occult shelf go first."} <InfoTip id="markup" label="About a shelf's markup" /></p>
      <div className="sd-row">
        <input className="sd-in" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an item… (e.g. rope)" aria-label="Find an item" style={{ minWidth: 240 }} />
        {isLive && <span className="sd-hint">Anything you flip shows on the shelves straight away.</span>}
        <span style={{ flex: 1 }} />
        <button className="sd-tbtn" type="button" onClick={() => setExpanded(all ? new Set() : new Set(SHELVES.map((s) => s.id)))}>{all ? "Collapse all" : "Expand all"}</button>
      </div>
      <div className="sd-shelves">
        {SHELVES.filter((s) => !q || shown.some((it) => it.cat === s.id && hits(it))).map((s) => {
          const on = setup.carries.includes(s.id);
          const list = shown.filter((it) => it.cat === s.id);
          const m = setup.markups[s.id] || 0;
          const eg = list[0];
          const open = !!q || expanded.has(s.id);
          return (
            <div key={s.id} className={`sd-shelf${on ? "" : " off"}`} style={{ "--cat": shelfColor(s.id) }}>
              <div className="sd-sh-row">
                <button type="button" className={`sd-sw${on ? " on" : ""}${lockCls}`} role="switch" aria-checked={on} aria-label={`Carry ${s.name}`} disabled={locked}
                  onClick={() => onUpdate({ carries: on ? (setup.carries.length > 1 ? setup.carries.filter((c) => c !== s.id) : setup.carries) : [...setup.carries, s.id] })}><i /></button>
                <span className="dotc" aria-hidden="true" /><b className="nm">{s.name}</b>
                {on ? (
                  <>
                    <span className={`sd-mkc${lockCls}`}>
                      <button type="button" aria-label={`${s.name} cheaper`} disabled={locked} onClick={() => onUpdate({ markups: { ...setup.markups, [s.id]: Math.max(-50, m - 5) } })}>−</button>
                      <b className={m > 0 ? "up" : m < 0 ? "down" : ""}>{markupName(m)}</b>
                      <button type="button" aria-label={`${s.name} dearer`} disabled={locked} onClick={() => onUpdate({ markups: { ...setup.markups, [s.id]: Math.min(200, m + 5) } })}>+</button>
                    </span>
                    <small className="eg">{eg ? <>{eg.name.toLowerCase()} {markedPrice(eg, setup.markups)}s{m ? <> <s>{eg.price}s</s></> : null}</> : null}</small>
                    <span className="cnt"><small>In stock</small> {list.filter((it) => !out.has(it.id)).length} of {list.length}</span>
                  </>
                ) : <><small className="eg">not carried here</small><span className="cnt" /></>}
                <button type="button" className="chev" aria-expanded={open} aria-label={`Show ${s.name} items`} onClick={() => setExpanded((prev) => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}>{open ? "▾" : "▸"}</button>
              </div>
              {open && (
                <>
                  <div className="sd-items">
                    {list.filter(hits).map((it) => on ? (
                      <button key={it.id} type="button" className={`sd-stk${out.has(it.id) ? " out" : ""}`} style={{ "--cat": shelfColor(it.cat) }} onClick={() => toggleOut(it.id)}
                        aria-pressed={!out.has(it.id)} title={out.has(it.id) ? "Out of stock: tap to stock it" : "In stock: tap to mark sold out"}>
                        <ItemOrb item={it} />{it.name} <i>{markedPrice(it, setup.markups)}s</i>
                      </button>
                    ) : (
                      <button key={it.id} type="button" className="sd-stk nc" style={{ "--cat": shelfColor(it.cat) }} onClick={() => onCarryItem(it)} title="Carry this shelf, with just this in stock">
                        <ItemOrb item={it} />{it.name}
                      </button>
                    ))}
                  </div>
                  {!on && <p className="sd-hint" style={{ margin: "6px 0 0" }}>Tap an item to carry this shelf with just that in stock.</p>}
                </>
              )}
            </div>
          );
        })}
        {q && !shown.some(hits) && <p className="sd-hint" style={{ margin: 0 }}>Nothing called “{query}” in the catalog. Add it under Item catalog.</p>}
      </div>
    </section>
  );
}

// ── The item catalog: edit in place, or round-trip a spreadsheet.
export function CatalogEditor({ items, onSave, busy }) {
  const [draft, setDraft] = useState(items);
  const [baseline, setBaseline] = useState(items);
  const [importing, setImporting] = useState(null);
  const [filter, setFilter] = useState("");
  const [shelf, setShelf] = useState("");
  const fileRef = useRef(null);
  if (baseline !== items) { setBaseline(items); setDraft(items); }
  const dirty = JSON.stringify(draft) !== JSON.stringify(items);
  const edit = (id, patch) => setDraft((d) => d.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const q = filter.trim().toLowerCase();
  const rows = draft.filter((it) => (!shelf || it.cat === shelf) && (!q || it.name.toLowerCase().includes(q)));

  function exportCsv() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([catalogToCsv(draft)], { type: "text/csv" }));
    a.download = "shop-items.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function readFile(file) {
    const text = await file.text();
    const { items: incoming, errors } = csvToItems(text, SHELVES.map((s) => s.id));
    setImporting({ name: file.name, incoming, errors, diff: diffCatalog(draft, incoming), hideMissing: true });
  }
  function applyImport() {
    const { incoming, diff, hideMissing } = importing;
    const byId = new Map(incoming.map((i) => [i.id, i]));
    const next = draft.map((it) => byId.get(it.id) || (hideMissing && diff.missing.some((m) => m.id === it.id) ? { ...it, hidden: true } : it));
    for (const it of diff.added) next.push(it);
    setDraft(next);
    setImporting(null);
  }
  function addItem() {
    const id = `item-${Date.now().toString(36)}`;
    setDraft((d) => [...d, { id, name: "New item", cat: shelf || "gear", price: 1 }]);
  }

  return (
    <section className="sd-card" aria-labelledby="sd-cat-h" data-tour="catalog">
      <h3 id="sd-cat-h">Item catalog <InfoTip id="catalog" /></h3>
      <p className="sd-hint" style={{ marginTop: 0 }}>The list prices, seeded from World of Dungeons. Each opening marks them up or down per shelf. Items already in someone's pack are their own copies, so changes here never change what anyone owns.</p>
      <div className="sd-row">
        <input className="sd-in" placeholder="Search items…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search items" />
        <select className="sd-in" value={shelf} onChange={(e) => setShelf(e.target.value)} aria-label="Shelf">
          <option value="">All shelves</option>
          {SHELVES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button className="sd-tbtn" type="button" onClick={exportCsv}>⇩ Export CSV</button>
        <button className="sd-tbtn" type="button" onClick={() => fileRef.current?.click()}>⇧ Import CSV</button>
        <InfoTip id="csv" />
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
        <button className="sd-tbtn" type="button" onClick={addItem}>＋ Add item</button>
      </div>
      <div className="sd-table-wrap">
        <table className="sd-catalog">
          <thead><tr><th /><th>Item</th><th>Shelf</th><th>Price (s)</th><th>Per</th><th>Effect</th><th>Notes</th><th title="Shown in the shop">Shown</th></tr></thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} className={it.hidden ? "hidden" : ""}>
                <td><ItemOrb item={it} /></td>
                <td><input className="sd-in" value={it.name} onChange={(e) => edit(it.id, { name: e.target.value })} aria-label="Name" /></td>
                <td><select className="sd-in" value={it.cat} onChange={(e) => edit(it.id, { cat: e.target.value })} aria-label="Shelf">{SHELVES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                <td><input className="sd-in" style={{ width: 72 }} inputMode="decimal" value={it.price} onChange={(e) => edit(it.id, { price: e.target.value === "" ? "" : Number(e.target.value) })} aria-label="Price" /></td>
                <td><input className="sd-in" style={{ width: 60 }} value={it.per || ""} onChange={(e) => edit(it.id, { per: e.target.value })} aria-label="Per" placeholder="—" /></td>
                <td><input className="sd-in" value={it.stat || ""} onChange={(e) => edit(it.id, { stat: e.target.value })} aria-label="Effect" placeholder="—" /></td>
                <td><input className="sd-in" value={it.notes || ""} onChange={(e) => edit(it.id, { notes: e.target.value })} aria-label="Notes" placeholder="—" /></td>
                <td><button type="button" className="sd-eye" aria-pressed={!it.hidden} aria-label={it.hidden ? `Show ${it.name}` : `Hide ${it.name}`} onClick={() => edit(it.id, { hidden: !it.hidden })}>{it.hidden ? "◌" : "◉"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sd-row sd-foot">
        <span className="sd-hint" style={{ margin: 0 }}>{dirty ? "Unsaved changes." : "Saved."}</span>
        <span style={{ flex: 1 }} />
        <button className="sd-tbtn" type="button" disabled={!dirty} onClick={() => setDraft(items)}>Discard</button>
        <button className="sd-tbtn primary" type="button" disabled={!dirty || busy} onClick={() => onSave(draft.map((it) => ({ ...it, price: Number(it.price) || 0 })))}>Save catalog</button>
      </div>
      {importing && (
        <div className="sd-veil" onClick={(e) => { if (e.target === e.currentTarget) setImporting(null); }}>
          <div className="sd-modal" role="dialog" aria-label="Import items">
            <h3>Import items: check the changes</h3>
            <p className="sd-hint" style={{ marginTop: 0 }}><code>{importing.name}</code> · {importing.incoming.length} rows</p>
            <ul>
              {importing.diff.added.map((i) => <li key={`a${i.id}`}><span className="sd-pill new">New</span> {i.name}: {i.price}s{i.stat ? ` · ${i.stat}` : ""}</li>)}
              {importing.diff.changed.map((c) => <li key={`c${c.item.id}`}><span className="sd-pill chg">Changed</span> {c.item.name}: {c.fields.join(", ")}</li>)}
              {importing.diff.missing.length > 0 && (
                <li><span className="sd-pill gone">Not in file</span> {importing.diff.missing.map((i) => i.name).join(", ")}
                  <label style={{ display: "inline-flex", gap: 6, alignItems: "center", marginLeft: 8 }}><input type="checkbox" checked={importing.hideMissing} onChange={(e) => setImporting({ ...importing, hideMissing: e.target.checked })} /> hide from the shop</label>
                </li>
              )}
              {importing.errors.map((e) => <li key={e}><span className="sd-pill gone">Skipped</span> {e}</li>)}
              {!importing.diff.added.length && !importing.diff.changed.length && !importing.diff.missing.length && <li>No changes.</li>}
            </ul>
            <p className="sd-safe">Matched by the <b>id</b> column. Nothing in anyone's pack changes. Review, then Save catalog to keep it.</p>
            <div className="sd-row sd-acts"><span style={{ flex: 1 }} /><button className="sd-tbtn" type="button" onClick={() => setImporting(null)}>Cancel</button><button className="sd-tbtn primary" type="button" onClick={applyImport}>Apply to the list</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Who haggled for what this opening, and who was thrown out.
export function HaggleLog({ log, thrown, onLetIn, busy }) {
  const bad = /badly|refused|warning|thrown|lost/;
  return (
    <section className="sd-card" aria-labelledby="sd-log-h">
      <h3 id="sd-log-h">Haggling &amp; sales this opening <InfoTip id="log" /></h3>
      {thrown.map((t) => (
        <div className="sd-hl out" key={t.slug}>
          <b>{t.name}</b> was thrown out.
          <button className="sd-tbtn primary" type="button" disabled={busy} onClick={() => onLetIn(t.slug)}>Let back in</button>
        </div>
      ))}
      {log.length ? log.slice(0, 20).map((h, i) => (
        <div className="sd-hl" key={`${h.at}-${i}`}>
          <b>{h.who}</b> · {h.item} · <span className={bad.test(h.result) ? "bad" : /off/.test(h.result) ? "ok" : ""}>{h.result}</span>
        </div>
      )) : <p className="sd-hint" style={{ margin: 0 }}>Nothing yet. Who haggled for what, how it went, and what was sold back, shows here.</p>}
      <p className="sd-hint">Let back in: they can shop again, but the keeper won't haggle with them any more this opening.</p>
    </section>
  );
}
