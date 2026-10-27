import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSessionState, getShop, postShopPurchase, verifyPassword } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import TopNav from "../components/TopNav";
import { useTextScale } from "../lib/useTextScale";
import { useAdaptivePolling, ACTIVE_POLL_MS, CONNECTED_POLL_MS } from "../lib/liveSync";
import { useSessionSocket } from "../lib/useSessionSocket";
import { acceptVersion, characterVersionKey } from "../lib/versionFloors";
import {
  KEEPERS, SCENES, SHELVES, shelfColor, itemArt, SHELF_ART, SHELF_LINES, ITEM_LINES, POOR_LINES, OUT_LINES, ADD_LINES,
  pick, say, closesText,
} from "../features/shop/shopData";
import { haveCount, packGroups, loadSatchel, saveSatchel, placeBubble, flyCoins } from "../features/shop/shopPlayer";
import { ShopIcon, ItemOrb, ShopShutters, PackPanel, SatchelSheet, Receipt } from "../features/shop/ShopParts";
import "../features/shop/shop.css";

// Story 72 — the shop, as a player sees it: the keeper's scene with their
// speech bubble, the item in hand, the shelves, what you already carry, and a
// satchel you pay for. Opening hours, stock and prices come from the DM page.

const DENOMS = [["cp", 0.1], ["sp", 1], ["ep", 5], ["gp", 10], ["pp", 100]];
const purseWorth = (coin) => Math.round(DENOMS.reduce((s, [k, v]) => s + (parseInt(coin?.[k], 10) || 0) * v, 0) * 10) / 10;
const onlySilver = (coin) => DENOMS.every(([k]) => k === "sp" || !(parseInt(coin?.[k], 10) > 0));

function readPassword(slug) {
  try {
    const own = sessionStorage.getItem(`dnd_char_${slug}`);
    if (own !== null) return own;
    return sessionStorage.getItem("dnd_dm_password");
  } catch {
    return null;
  }
}

function SignIn({ slug, onSignedIn }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await verifyPassword(slug, password);
      if (!result?.valid) { setError("That password didn't work."); return; }
      sessionStorage.setItem(result.role === "dm" ? "dnd_dm_password" : `dnd_char_${slug}`, password);
      onSignedIn(password);
    } catch {
      setError("Couldn't check the password. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="sp-card" onSubmit={submit}>
      <h2>Sign in to shop</h2>
      <p style={{ margin: 0 }}>Your character's password, so purchases go into the right pack.</p>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" autoFocus />
      {error && <p className="sp-error" role="alert">{error}</p>}
      <button className="sp-btn gold" type="submit" disabled={busy}>{busy ? "Checking…" : "Enter the shop"}</button>
    </form>
  );
}

// The keeper speaks, typed out.
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function useTyped(text) {
  const [typing, setTyping] = useState({ text, n: text.length });
  if (typing.text !== text) setTyping({ text, n: reducedMotion() ? text.length : 0 });
  useEffect(() => {
    const id = setInterval(() => {
      setTyping((t) => (t.n >= t.text.length ? t : { ...t, n: t.n + 1 }));
    }, 18);
    return () => clearInterval(id);
  }, []);
  return typing.text.slice(0, typing.n);
}

export default function ShopPage() {
  const { slug } = useParams();
  const [password, setPassword] = useState(() => readPassword(slug));
  const [character, setCharacter] = useState(null);
  const [summary, setSummary] = useState(null);
  const [shop, setShop] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [cat, setCat] = useState(null);
  const [inHandId, setInHandId] = useState(null);
  const [qty, setQty] = useState(1);
  const [popKey, setPopKey] = useState(0);
  const [line, setLine] = useState("");
  const [satchel, setSatchel] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [fresh, setFresh] = useState(new Set());
  const [bump, setBump] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [bubble, setBubble] = useState(null);
  const shopKeyRef = useRef(null);
  const sceneRef = useRef(null);
  const imgRef = useRef(null);
  const payRef = useRef(null);
  const { textScale, textScaleMenuItem } = useTextScale();

  // ── Data: session state carries the character and a shop summary; the
  // shop itself is fetched only when that summary changes.
  const refresh = useCallback(async () => {
    if (password === null) return;
    try {
      const d = await getSessionState({ slug, dmPassword: password });
      if (d.character && acceptVersion(characterVersionKey(slug), d.character.version)) setCharacter(d.character);
      setSummary(d.shop || null);
      const key = `${d.shop?.version}|${d.shop?.status}`;
      if (key !== shopKeyRef.current) {
        shopKeyRef.current = key;
        setShop(await getShop());
      }
      setLoadError(null);
    } catch {
      setLoadError("Couldn't reach the shop. Check your connection.");
    }
  }, [slug, password]);
  useEffect(() => { const t = setTimeout(refresh, 0); return () => clearTimeout(t); }, [refresh]);
  const { connected: wsConnected } = useSessionSocket(useCallback(() => { refresh(); }, [refresh]));
  useAdaptivePolling({ enabled: password !== null, poll: refresh, activeMs: wsConnected ? CONNECTED_POLL_MS : ACTIVE_POLL_MS });
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const status = shop?.status || summary?.status || "closed";
  const keeperKey = KEEPERS[shop?.keeper] ? shop.keeper : "mags";
  const keeper = KEEPERS[keeperKey];
  const scene = SCENES[keeperKey];
  const display = shop?.display || { keeperName: keeper.keeper, name: keeper.names[0][0], where: keeper.names[0][1], sub: keeper.names[0][2] };
  const items = useMemo(() => shop?.items || [], [shop]);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const shelves = useMemo(() => SHELVES.filter((s) => items.some((it) => it.cat === s.id)), [items]);
  const browsing = status === "open" || status === "lockup";
  const shut = status === "closed" || status === "scheduled";
  const openingId = shop?.openingId || null;

  // The satchel survives a reload, for this opening only. Once the doors are
  // shut for good, an unpaid satchel goes back on the shelves.
  const [satchelFor, setSatchelFor] = useState(null);
  if (openingId && satchelFor !== openingId) { setSatchelFor(openingId); setSatchel(loadSatchel(slug, openingId)); }
  if (shut && satchel.length) setSatchel([]);
  useEffect(() => { if (openingId) saveSatchel(slug, openingId, satchel); }, [slug, openingId, satchel]);

  const satchelLines = satchel.map((l) => ({ item: byId.get(l.itemId), qty: l.qty })).filter((l) => l.item);
  const total = satchelLines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const worth = purseWorth(character?.coin);
  const purseLabel = `${worth}s`;

  // Which shelf, and what's in hand.
  const currentCat = shelves.some((s) => s.id === cat) ? cat : shelves[0]?.id || null;
  const recommended = byId.get("fire-oil") && !byId.get("fire-oil").out ? byId.get("fire-oil") : items.find((it) => !it.out) || null;
  const inHand = byId.get(inHandId) || recommended;

  // Greet once per opening; warn when locking up.
  const [greeted, setGreeted] = useState(null);
  const greetKey = `${openingId}|${keeperKey}|${status === "lockup" ? "lock" : "open"}`;
  if (browsing && character && greeted !== greetKey) {
    setGreeted(greetKey);
    setLine(status === "lockup" ? "Quick now, I'm locking up. Pay for what's in your satchel." : say(pick(keeper.greet), character.name));
  }
  const typed = useTyped(line ? `“${line}”` : "");

  // The bubble sits by the keeper's face; recomputed as the scene resizes.
  const place = useCallback(() => {
    const el = sceneRef.current, img = imgRef.current;
    if (!el || !img || matchMedia("(max-width: 760px)").matches) { setBubble(null); return; }
    setBubble(placeBubble(scene, { width: el.clientWidth, height: el.clientHeight, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }));
  }, [scene]);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(place);
    addEventListener("resize", place);
    return () => { cancelAnimationFrame(frame); removeEventListener("resize", place); };
  }, [place, browsing]);

  function hold(item) {
    if (!item) return;
    setInHandId(item.id); setQty(1); setPopKey((k) => k + 1);
    if (item.out) setLine(pick(OUT_LINES));
    else if (ITEM_LINES[item.id]) setLine(ITEM_LINES[item.id]);
    else if (item.price > worth - total) setLine(pick(POOR_LINES));
    else setLine(pick(SHELF_LINES[item.cat] || ADD_LINES));
    const r = sceneRef.current?.getBoundingClientRect();
    if (r && (r.bottom < 120 || r.top > innerHeight)) sceneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function addToSatchel() {
    if (!inHand || inHand.out || status !== "open") return;
    setSatchel((prev) => {
      const found = prev.find((l) => l.itemId === inHand.id);
      return found ? prev.map((l) => (l.itemId === inHand.id ? { ...l, qty: Math.min(99, l.qty + qty) } : l)) : [...prev, { itemId: inHand.id, qty }];
    });
    setLine(pick(ADD_LINES)); setBump((b) => b + 1); setPayError(null);
  }

  async function pay() {
    if (!satchelLines.length || paying) return;
    setPaying(true); setPayError(null);
    if (!reducedMotion()) flyCoins(payRef.current?.querySelector(".sp-btn.gold"), sceneRef.current, total);
    try {
      const before = new Set([...(character?.weapons || []), ...(character?.equipment || [])].map((e) => e.id));
      const res = await postShopPurchase(slug, password, satchelLines.map((l) => ({ itemId: l.item.id, qty: l.qty })));
      setCharacter((prev) => ({ ...prev, ...res.character }));
      const after = [...(res.character.weapons || []), ...(res.character.equipment || [])];
      setFresh(new Set(after.filter((e) => !before.has(e.id) || satchelLines.some((l) => e.bought?.itemId === l.item.id)).map((e) => e.id || e.name)));
      setSatchel([]); setSheetOpen(false);
      setReceipt({ lines: res.lines, total: res.total });
      setLine(say(pick(keeper.pay), character?.name));
    } catch (err) {
      setPayError(err?.data?.error || err?.message || "Couldn't pay. Try again.");
      refresh();
    } finally {
      setPaying(false);
    }
  }

  // ── Render ──
  const pal = PALETTES[character?.palette] || PALETTES[(() => { try { return sessionStorage.getItem(`dnd_palette_${slug}`); } catch { return null; } })()] || PALETTES.ocean;
  const palVars = {
    "--pal-bg": pal.bg, "--pal-surface": pal.surface, "--pal-surface-solid": pal.surfaceSolid, "--pal-border": pal.border,
    "--pal-accent": pal.accent, "--pal-accent-bright": pal.accentBright, "--pal-accent-dim": pal.accentDim,
    "--pal-text": pal.text, "--pal-text-body": pal.textBody, "--pal-text-muted": pal.textMuted,
    "--font-display": pal.fontDisplay, "--font-body": pal.fontBody, "--font-ui": pal.fontUI,
  };
  const pageStyle = { ...palVars, zoom: textScale, background: `radial-gradient(ellipse at 50% -10%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}` };
  const nav = (
    <TopNav backTo={`/characters/${slug}/session`} title={display.name} menuItems={[{ label: "Your sheet", href: `/characters/${slug}/session` }, { label: "All Characters", href: "/" }, { divider: true }, textScaleMenuItem]} />
  );

  if (password === null) {
    return <div className="sp-page" style={pageStyle} data-light={pal.light ? "true" : undefined}>{nav}<main className="sp-main"><SignIn slug={slug} onSignedIn={setPassword} /></main></div>;
  }

  const lockLeft = shop?.lockupUntil ? Math.max(0, Math.ceil((Date.parse(shop.lockupUntil) - now) / 1000)) : 0;
  const hoursText = {
    open: `Open · ${closesText(shop || {}, null)}`,
    lockup: "Locking up",
    combat: "Shut for the fighting",
    scheduled: shop?.opensAt ? `Opens ${new Date(shop.opensAt).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}` : "Opening soon",
    closed: "Closed",
  }[status];
  const inSatchel = satchelLines.find((l) => l.item.id === inHand?.id)?.qty || 0;
  const short = inHand ? inHand.price * qty > worth - total : false;
  const have = inHand ? haveCount(character, inHand) : 0;
  const shelf = SHELVES.find((s) => s.id === currentCat);
  const shelfItems = items.filter((it) => it.cat === currentCat);
  const groups = packGroups(character, byId);
  const satchelRows = satchelLines.map((l) => ({ key: `s-${l.item.id}`, id: l.item.id, name: l.item.name, qty: l.qty, cat: l.item.cat, icon: l.item.icon, art: itemArt(l.item.id) }));

  return (
    <div className={`sp-page${shut || status === "combat" ? " sp-shut" : ""}${status === "lockup" ? " sp-locking" : ""}`} style={pageStyle} data-light={pal.light ? "true" : undefined}>
      {nav}
      <main className="sp-main">
        <header className="sp-head">
          <div>
            <div className="sp-kicker">{display.where}</div>
            <h1>{display.name}</h1>
            <div className="sp-sub">{display.sub}</div>
          </div>
          <span className="sp-spacer" />
          <span className={`sp-hours${status === "lockup" ? " lock" : status === "open" ? "" : " off"}`}><i />{hoursText}</span>
        </header>
        {loadError && <p className="sp-error" role="alert">{loadError}</p>}

        <div className="sp-scene" ref={sceneRef}>
          <img ref={imgRef} src={scene.src} alt={`${display.keeperName} behind the counter`} style={{ objectPosition: scene.pos }} onLoad={place} />
          {browsing && (
            <>
              {typed && (
                <div className={`sp-speech${bubble?.mode === "left" ? " left" : bubble?.mode === "below" ? " below" : ""}`} style={bubble?.style} aria-live="polite">
                  <span className="who">{display.keeperName}</span>{typed}
                </div>
              )}
              {inHand && (
                <div key={popKey} className={`sp-float${popKey ? " pop" : ""}`} style={{ "--cat": shelfColor(inHand.cat) }}>
                  {inHandId && <button className="x" type="button" aria-label="Put it back" onClick={() => { setInHandId(null); setLine("Suit yourself."); }}>×</button>}
                  <div className="sp-eyebrow">{!inHandId && inHand === recommended ? `${display.keeperName} recommends` : SHELVES.find((s) => s.id === inHand.cat)?.name}</div>
                  {itemArt(inHand.id)
                    ? <div className="sp-showcase"><img src={itemArt(inHand.id)} alt={inHand.name} /></div>
                    : <ItemOrb item={inHand} />}
                  <h3>{inHand.name}</h3>
                  {inHand.stat && <span className="sp-stat">{inHand.stat}</span>}
                  <p>{inHand.notes || "Exactly what it says on the tag."}</p>
                  {have > 0 && <p className="owned">You already carry {have > 1 ? have : "one"}.</p>}
                  <div className="sp-buy">
                    <span className={`sp-price${short ? " short" : ""}`}>{(inHand.price * qty).toLocaleString()}s{inHand.per && qty === 1 ? `/${inHand.per}` : ""}</span>
                    <div className="sp-qty">
                      <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                      <span aria-live="polite">{qty}</span>
                      <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
                    </div>
                  </div>
                  <div className="sp-buy">
                    <button className="sp-btn gold" type="button" style={{ flex: 1 }} onClick={addToSatchel} disabled={short || inHand.out || status !== "open"}>
                      {status === "lockup" ? "Locking up" : inHand.out ? "Sold out" : short ? `Short ${Math.ceil(inHand.price * qty - (worth - total))} silver` : inSatchel ? "Add more" : "Into the satchel"}
                    </button>
                  </div>
                </div>
              )}
              <div className="sp-counter">
                <div className="sp-chip" title="Your purse"><div className="sp-coins"><i /><i /><i /></div><div><b>{worth}</b> <small>{onlySilver(character?.coin) ? "silver" : "silver's worth"}</small></div></div>
                <button key={bump} className={`sp-chip satchel${bump ? " bump" : ""}`} type="button" onClick={() => setSheetOpen(true)}>Satchel <span className="n">{satchelLines.reduce((n, l) => n + l.qty, 0)}</span></button>
              </div>
            </>
          )}
          {!browsing && <ShopShutters status={status} opensAt={shop?.opensAt} closesText={closesText(shop || {}, null)} keeperName={display.keeperName} />}
        </div>

        {status === "lockup" && (
          <div className="sp-lockup" role="status">
            <div className="t">{display.keeperName} is locking up.<small>Pay for what's in your satchel before the shutters come down. No more off the shelves.</small></div>
            <span className="clock">{Math.floor(lockLeft / 60)}:{String(lockLeft % 60).padStart(2, "0")}</span>
            <button className="sp-btn gold" type="button" onClick={() => setSheetOpen(true)}>Pay now</button>
          </div>
        )}

        {browsing && (
          <div className="sp-browse">
            <div>
              <div className="sp-section-h"><h2>Browse the shelves</h2><span>{items.filter((it) => !it.out).length} of {items.length} wares in stock</span></div>
              <div className="sp-cats" style={{ "--shelves": Math.max(4, shelves.length) }}>
                {shelves.map((s) => {
                  const list = items.filter((it) => it.cat === s.id);
                  const prices = list.map((it) => it.price);
                  const lo = Math.min(...prices), hi = Math.max(...prices);
                  const outN = list.filter((it) => it.out).length;
                  const art = SHELF_ART[s.id] && itemArt(SHELF_ART[s.id]);
                  return (
                    <button key={s.id} type="button" className={`sp-cat${s.id === currentCat ? " on" : ""}${art ? " art" : ""}`} style={{ "--cat": shelfColor(s.id), ...(art ? { "--art": `url(${art})` } : {}) }}
                      onClick={() => { setCat(s.id); setLine(pick(SHELF_LINES[s.id] || ADD_LINES)); }} aria-pressed={s.id === currentCat}>
                      {!art && <ShopIcon name={s.icon} />}
                      <b>{s.name}</b>
                      <small>{lo === hi ? `${lo}s` : `${lo}–${hi.toLocaleString()}s`}{outN ? <> · <span className="o">{outN} out</span></> : null}</small>
                    </button>
                  );
                })}
              </div>
              {shelf && (
                <>
                  <div className="sp-section-h"><h2>{shelf.name}</h2><span>{shelfItems.filter((it) => !it.out).length} on the shelf{shelfItems.some((it) => it.out) ? ` · ${shelfItems.filter((it) => it.out).length} sold out` : ""}</span></div>
                  <div className="sp-goods">
                    {shelfItems.map((it) => {
                      const n = haveCount(character, it);
                      const poor = !it.out && it.price > worth - total;
                      return (
                        <button key={it.id} type="button" className={`sp-good${poor ? " poor" : ""}${it.out ? " out" : ""}${inHand?.id === it.id && inHandId ? " sel" : ""}`} style={{ "--cat": shelfColor(it.cat) }}
                          onClick={() => hold(it)} aria-label={`${it.name}, ${it.price} silver${it.out ? ", sold out" : ""}`}>
                          {it.justIn && !it.out && <span className="sp-justin">Just in</span>}
                          <span className="sp-tag">{it.price.toLocaleString()}s{it.per ? `/${it.per}` : ""}</span>
                          <ItemOrb item={it} />
                          {it.out && <span className="sp-soldout">Sold out</span>}
                          {n > 0 && <span className="sp-have">have {n}</span>}
                          <span className="nm">{it.name}</span><span className="st">{it.stat || ""}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="sp-cat-line">{shelf.line}</p>
                </>
              )}
            </div>
            <PackPanel character={character} groups={groups} satchelRows={satchelRows} fresh={fresh} open={packOpen} onToggle={() => setPackOpen((o) => !o)} purseLabel={purseLabel} />
          </div>
        )}
        {!browsing && (
          <p className="sp-cat-line"><Link to={`/characters/${slug}/session`} style={{ color: "var(--pal-accent-bright)" }}>Back to your sheet</Link></p>
        )}
      </main>

      {browsing && (
        <div ref={payRef}>
          <SatchelSheet open={sheetOpen} onToggle={() => setSheetOpen((o) => !o)} lines={satchelLines} total={total} purse={worth}
            onRemove={(i) => setSatchel((prev) => prev.filter((_, j) => j !== i))} onPay={pay} paying={paying} error={payError} />
        </div>
      )}
      {receipt && <Receipt shopName={display.name} buyer={character?.name} lines={receipt.lines} total={receipt.total} onDone={() => setReceipt(null)} />}
    </div>
  );
}
