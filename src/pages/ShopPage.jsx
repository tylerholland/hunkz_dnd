import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getSessionState, getShop, getShopPreview, listCharacters, postShopHaggle, postShopPurchase, postShopSell, verifyPassword } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import TopNav from "../components/TopNav";
import { useTextScale } from "../lib/useTextScale";
import { useAdaptivePolling, ACTIVE_POLL_MS, CONNECTED_POLL_MS } from "../lib/liveSync";
import { useSessionSocket } from "../lib/useSessionSocket";
import { acceptVersion, characterVersionKey } from "../lib/versionFloors";
import {
  KEEPERS, SCENES, SHELVES, shelfColor, itemArt, SHELF_ART, pick, closesText, fmtTime, townOf, dealPrice,
} from "../features/shop/shopData";
import { byMood, linesFor } from "../features/shop/keeperLines";
import { haveCount, packGroups, loadSatchel, saveSatchel, placeBubble, flyCoins } from "../features/shop/shopPlayer";
import { ShopIcon, ItemOrb, ShopShutters, PackPanel, SatchelSheet, Receipt } from "../features/shop/ShopParts";
import "../features/shop/shop.css";

// Story 72 — the shop, as a player sees it: the keeper's scene with their
// speech bubble, the item in hand, the shelves, what you already carry, and a
// satchel you pay for. Opening hours, stock and prices come from the DM page.

const DENOMS = [["cp", 0.1], ["sp", 1], ["ep", 5], ["gp", 10], ["pp", 100]];
const purseWorth = (coin) => Math.round(DENOMS.reduce((s, [k, v]) => s + (parseInt(coin?.[k], 10) || 0) * v, 0) * 10) / 10;
// "Rogue (Thief)" → "rogue"; "Half-Elf" → "half-elf"; blank → the fallback.
const simpleWord = (v, fallback) => String(v || "").replace(/\(.*?\)/g, "").trim().split(/[\s/,]+/)[0]?.toLowerCase() || fallback;
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

// `preview`: the DM walks the shop as any character, as if it were open now,
// whatever its real state. Nothing is bought; nothing changes.
export default function ShopPage({ preview = false }) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [roster, setRoster] = useState([]);
  const slug = preview ? (searchParams.get("as") || roster[0]?.slug || null) : params.slug;
  const [password, setPassword] = useState(() => (preview ? (() => { try { return sessionStorage.getItem("dnd_dm_password"); } catch { return null; } })() : readPassword(params.slug)));
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

  useEffect(() => {
    if (!preview) return undefined;
    let cancelled = false;
    listCharacters().then((list) => { if (!cancelled) setRoster((list || []).filter((c) => c?.slug).sort((a, b) => String(a.name || a.slug).localeCompare(String(b.name || b.slug)))); }).catch(() => {});
    return () => { cancelled = true; };
  }, [preview]);

  // ── Data: session state carries the character and a shop summary; the
  // shop itself is fetched only when that summary changes.
  const refresh = useCallback(async () => {
    if (password === null || !slug) return;
    try {
      const d = await getSessionState({ slug, dmPassword: password });
      if (d.character && acceptVersion(characterVersionKey(slug), d.character.version)) setCharacter(d.character);
      setSummary(d.shop || null);
      // Only count the shop as loaded once it has been: a failed fetch is
      // retried on the next poll instead of leaving a stale (closed) shop.
      const key = `${d.shop?.version}|${d.shop?.status}`;
      if (key !== shopKeyRef.current) {
        const next = await (preview ? getShopPreview(password) : getShop({ slug, password }));
        shopKeyRef.current = key;
        setShop(next);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(preview && err?.status === 403
        ? "The preview needs the DM password. Sign in on the DM page and try again."
        : "Couldn't reach the shop. Retrying…");
    }
  }, [slug, password, preview]);
  useEffect(() => { const t = setTimeout(refresh, 0); return () => clearTimeout(t); }, [refresh]);
  const { connected: wsConnected } = useSessionSocket(useCallback(() => { refresh(); }, [refresh]));
  useAdaptivePolling({ enabled: password !== null, poll: refresh, activeMs: wsConnected ? CONNECTED_POLL_MS : ACTIVE_POLL_MS });
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // Unknown (null) until loaded; a preview is never "closed" — it's either loaded or still loading.
  const status = shop?.status || (preview ? null : summary?.status || null);
  // Until the shop itself loads, the session-state summary says whose shop it is.
  // Whose shop it is, once we know; until then nothing shop-specific shows.
  const knownKeeper = [shop?.keeper, summary?.keeper].find((k) => KEEPERS[k]) || null;
  const keeperKey = knownKeeper || "mags";
  const keeper = KEEPERS[keeperKey];
  // This keeper's voice: {name}, {item}, {price} and {time} filled in.
  const voice = linesFor(keeperKey);
  const speak = (list, vars = {}) => {
    const chosen = byMood(list, shop?.visit?.read?.mood);
    const text = Array.isArray(chosen) ? pick(chosen) : chosen;
    const race = simpleWord(character?.race, "traveller"), cls = simpleWord(character?.charClass, "adventurer");
    const an = (w) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`);
    const who = { town: townOf(display.where), name: character?.name || "friend", race, class: cls, a_race: an(race), A_race: `A${an(race).slice(1)}`, a_class: an(cls), A_class: `A${an(cls).slice(1)}` };
    return String(text || "").replace(/\{(\w+)\}/g, (m, k) => ({ ...who, ...vars })[k] ?? m);
  };
  const scene = SCENES[keeperKey];
  const display = shop?.display || {
    keeperName: summary?.keeperName || keeper.keeper,
    name: summary?.name || keeper.names[0][0],
    where: summary?.name ? "" : keeper.names[0][1],
    sub: summary?.name ? "" : keeper.names[0][2],
  };
  const items = useMemo(() => shop?.items || [], [shop]);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const shelves = useMemo(() => SHELVES.filter((s) => items.some((it) => it.cat === s.id)), [items]);
  // This shopper's own haggling: deals struck, items refused to them, thrown out.
  const visit = shop?.visit || null;
  const deals = useMemo(() => visit?.deals || {}, [visit]);
  const refused = useMemo(() => new Set(visit?.refused || []), [visit]);
  const thrownOut = !preview && visit?.thrownOut === true;
  const myPrice = (it) => dealPrice(it.price, deals[it.id]?.mult || 1);
  const browsing = (status === "open" || status === "lockup") && !thrownOut;
  const shut = status === "closed" || status === "scheduled";
  // A preview keeps its satchel in memory only.
  const openingId = preview ? null : shop?.openingId || null;

  // The satchel survives a reload, for this opening only. Once the doors are
  // shut for good, an unpaid satchel goes back on the shelves.
  const [satchelFor, setSatchelFor] = useState(null);
  if (openingId && satchelFor !== openingId) { setSatchelFor(openingId); setSatchel(loadSatchel(slug, openingId)); }
  if ((shut || thrownOut) && satchel.length) setSatchel([]);
  if (satchel.some((l) => refused.has(l.itemId))) setSatchel(satchel.filter((l) => !refused.has(l.itemId)));
  useEffect(() => { if (openingId) saveSatchel(slug, openingId, satchel); }, [slug, openingId, satchel]);

  const satchelLines = satchel.map((l) => ({ item: byId.get(l.itemId), qty: l.qty })).filter((l) => l.item)
    .map((l) => ({ ...l, each: myPrice(l.item), deal: deals[l.item.id]?.mult !== 1 ? deals[l.item.id] : null }));
  const total = satchelLines.reduce((s, l) => s + l.each * l.qty, 0);
  const worth = purseWorth(character?.coin);
  const purseLabel = `${worth}s`;

  // Which shelf, and what's in hand.
  const currentCat = shelves.some((s) => s.id === cat) ? cat : shelves[0]?.id || null;
  // Each keeper has a favourite to push; otherwise the first thing in stock.
  const favourite = byId.get(voice.recommend);
  const recommended = favourite && !favourite.out ? favourite : items.find((it) => !it.out) || null;
  const inHand = byId.get(inHandId) || recommended;

  // Greet once per opening; warn when locking up.
  const [greeted, setGreeted] = useState(null);
  const greetKey = `${openingId}|${keeperKey}|${status === "lockup" ? "lock" : "open"}`;
  if (browsing && character && greeted !== greetKey) {
    setGreeted(greetKey);
    setLine(status === "lockup" ? speak(voice.lockup) : speak(voice.greet));
  }
  // Something restocked while you're here: the keeper says so.
  const justInKey = items.filter((it) => it.justIn && !it.out).map((it) => it.id).sort().join(",");
  const [seenJustIn, setSeenJustIn] = useState(null);
  if (browsing && justInKey !== seenJustIn) {
    const before = new Set((seenJustIn || "").split(",").filter(Boolean));
    const fresh = justInKey.split(",").filter((id) => id && !before.has(id));
    setSeenJustIn(justInKey);
    if (seenJustIn !== null && fresh.length) setLine(speak(voice.restock, { item: byId.get(fresh[0])?.name }));
  }
  const typed = useTyped(line ? `“${line}”` : "");

  // The bubble sits by the keeper's face; recomputed as the scene resizes.
  // The scene stays a quiet placeholder until the right keeper's picture has loaded.
  const [readySrc, setReadySrc] = useState(null);
  const sceneReady = !!knownKeeper && readySrc === scene.src;
  const place = useCallback(() => {
    const el = sceneRef.current, img = imgRef.current;
    if (img?.complete && img.naturalWidth && img.getAttribute("src") === scene.src) setReadySrc(scene.src);
    if (!el || !img || matchMedia("(max-width: 760px)").matches) { setBubble(null); return; }
    setBubble(placeBubble(scene, { width: el.clientWidth, height: el.clientHeight, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }));
  }, [scene]);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(place);
    addEventListener("resize", place);
    return () => { cancelAnimationFrame(frame); removeEventListener("resize", place); };
  }, [place, browsing, knownKeeper]);

  function hold(item) {
    if (!item) return;
    setInHandId(item.id); setQty(1); setPopKey((k) => k + 1);
    setDealNote(null);
    setSelling(null);
    if (item.out) setLine(speak(voice.out));
    else if (refused.has(item.id)) setLine(speak(voice.notToYou));
    else if (voice.items?.[item.id]) setLine(speak(voice.items[item.id]));
    else if (myPrice(item) > worth - total) setLine(speak(voice.poor));
    else setLine(speak(voice.shelf?.[item.cat] || voice.add));
    const r = sceneRef.current?.getBoundingClientRect();
    if (r && (r.bottom < 120 || r.top > innerHeight)) sceneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // Haggling: the server rolls; we show the dice, the new price and the keeper's answer.
  // Selling back: the pack's sellable things, the one being offered, and the view.
  const [sellView, setSellView] = useState(false);
  const [selling, setSelling] = useState(null);
  const [sellBusy, setSellBusy] = useState(false);
  const offers = shop?.sellOffers || [];
  const canSell = !preview && status === "open" && shop?.buysBack !== false;
  function offer(o) {
    setSelling(o);
    setLine(speak(voice.sell.offer, { item: o.name, price: o.price }));
    const r = sceneRef.current?.getBoundingClientRect();
    if (r && (r.bottom < 120 || r.top > innerHeight)) sceneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function sellNow() {
    if (!selling || sellBusy) return;
    setSellBusy(true);
    try {
      const res = await postShopSell(slug, password, selling.entryId);
      setCharacter((prev) => ({ ...prev, ...res.character }));
      setShop((prev) => (prev ? { ...prev, sellOffers: res.sellOffers } : prev));
      setLine(speak(voice.sell.sold, { item: res.name, price: res.price }));
      setSelling(res.sellOffers.find((o) => o.entryId === selling.entryId) || null);
    } catch (err) {
      setLine(err?.status === 409 && /won't buy/.test(err?.data?.error || "") ? speak(voice.sell.wontBuy) : err?.data?.error || speak(voice.sell.notBuying));
    } finally {
      setSellBusy(false);
    }
  }

  const [haggling, setHaggling] = useState(false);
  const [dealNote, setDealNote] = useState(null);
  async function haggleNow() {
    if (!inHand || haggling || preview) return;
    setHaggling(true); setPayError(null);
    try {
      const res = await postShopHaggle(slug, password, inHand.id);
      const o = res.outcome;
      setShop((prev) => (prev ? { ...prev, visit: res.visit } : prev));
      setLine(speak(voice.haggle[o.say] || voice.haggle.holds));
      if (o.dice) {
        const ord = ["", "", "Second try: y", "Last try: y"][o.tries] || "Y";
        const cha = o.cha ? `, ${o.cha > 0 ? "+" : "−"}${Math.abs(o.cha)} Charisma` : "";
        const what = o.kind === "refuse-item" ? "" : o.kind === "refuse" ? " No luck." : o.say === "miss" ? " The price went up." : o.better ? ` ${o.short[0].toUpperCase()}${o.short.slice(1)}.` : " No lower than before.";
        setDealNote({ itemId: inHand.id, text: `${ord}ou rolled ${o.dice[0]} and ${o.dice[1]}${cha}.${what}` });
      } else setDealNote(null);
    } catch (err) {
      setLine(err?.data?.error || "Hmm? Speak up.");
    } finally {
      setHaggling(false);
    }
  }

  function addToSatchel() {
    if (!inHand || inHand.out || refused.has(inHand.id) || status !== "open") return;
    setSatchel((prev) => {
      const found = prev.find((l) => l.itemId === inHand.id);
      return found ? prev.map((l) => (l.itemId === inHand.id ? { ...l, qty: Math.min(99, l.qty + qty) } : l)) : [...prev, { itemId: inHand.id, qty }];
    });
    setLine(speak(voice.add)); setBump((b) => b + 1); setPayError(null);
  }

  async function pay() {
    if (!satchelLines.length || paying) return;
    if (preview) { setPayError("This is a preview: nothing is bought, and no coin leaves the purse."); return; }
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
      setLine(speak(voice.pay));
      // What's in the pack changed, so do the sell offers.
      getShop({ slug, password }).then(setShop).catch(() => {});
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
    <TopNav backTo={preview ? "/dm/shop" : `/characters/${slug}/session`} title={!knownKeeper ? (preview ? "Preview" : "Shop") : preview ? `Preview · ${display.name}` : display.name} menuItems={[{ label: "Your sheet", href: `/characters/${slug}/session` }, { label: "All Characters", href: "/" }, { divider: true }, textScaleMenuItem]} />
  );

  const previewBanner = preview && (
    <div className="sp-preview">
      <span><b>DM preview.</b> The shop as players will see it with your current settings, open whatever its real state. Nothing here is bought.</span>
      <label>Preview as{" "}
        <select value={slug || ""} onChange={(e) => setSearchParams({ as: e.target.value }, { replace: true })}>
          {roster.map((c) => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}
        </select>
      </label>
      <Link className="sp-btn gold" to="/dm/shop">Back to setup</Link>
    </div>
  );
  if (preview && password === null) {
    return <div className="sp-page" style={pageStyle}>{nav}<main className="sp-main"><div className="sp-card"><h2>DM only</h2><p>Sign in as the DM to preview the shop.</p><Link className="sp-btn gold" to="/dm/shop">Go to the shop page</Link></div></main></div>;
  }
  if (password === null) {
    return <div className="sp-page" style={pageStyle} data-light={pal.light ? "true" : undefined}>{nav}<main className="sp-main"><SignIn slug={slug} onSignedIn={setPassword} /></main></div>;
  }

  const lockLeft = shop?.lockupUntil ? Math.max(0, Math.ceil((Date.parse(shop.lockupUntil) - now) / 1000)) : 0;
  const realLabel = { open: "open", lockup: "locking up", combat: "shut for the fighting", scheduled: "scheduled", closed: "closed" }[shop?.realStatus] || "closed";
  const hoursText = !status ? "Opening the doors…" : preview ? `Preview · really ${realLabel}` : thrownOut ? "Thrown out" : {
    open: `Open · ${closesText(shop || {}, null)}`,
    lockup: "Locking up",
    combat: "Shut for the fighting",
    scheduled: shop?.opensAt ? `Opens ${new Date(shop.opensAt).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}` : "Opening soon",
    closed: "Closed",
  }[status];
  const inSatchel = satchelLines.find((l) => l.item.id === inHand?.id)?.qty || 0;
  const each = inHand ? myPrice(inHand) : 0;
  const deal = inHand && deals[inHand.id]?.mult !== 1 ? deals[inHand.id] : null;
  const tries = inHand ? deals[inHand.id]?.tries || 0 : 0;
  const refusedHere = inHand ? refused.has(inHand.id) : false;
  const short = inHand ? each * qty > worth - total : false;
  const have = inHand ? haveCount(character, inHand) : 0;
  const shelf = SHELVES.find((s) => s.id === currentCat);
  const shelfItems = items.filter((it) => it.cat === currentCat);
  const groups = packGroups(character, byId);
  const satchelRows = satchelLines.map((l) => ({ key: `s-${l.item.id}`, id: l.item.id, name: l.item.name, qty: l.qty, cat: l.item.cat, icon: l.item.icon, art: itemArt(l.item.id) }));

  return (
    <div className={`sp-page${shut || status === "combat" ? " sp-shut" : ""}${status === "lockup" ? " sp-locking" : ""}`} style={pageStyle} data-light={pal.light ? "true" : undefined}>
      {previewBanner}
      {nav}
      <main className="sp-main">
        <header className="sp-head">
          <div>
            <div className="sp-kicker">{knownKeeper ? display.where : "\u00a0"}</div>
            <h1>{knownKeeper ? display.name : "\u00a0"}</h1>
            <div className="sp-sub">{knownKeeper ? display.sub : "\u00a0"}</div>
          </div>
          <span className="sp-spacer" />
          <span className={`sp-hours${status === "lockup" ? " lock" : status === "open" ? "" : " off"}`}><i />{hoursText}</span>
        </header>
        {loadError && <p className="sp-error" role="alert">{loadError}</p>}

        <div className={`sp-scene${sceneReady ? "" : " loading"}`} ref={sceneRef} aria-busy={!sceneReady}>
          {knownKeeper && <img ref={imgRef} className={sceneReady ? "ready" : ""} src={scene.src} alt={`${display.keeperName} behind the counter`} style={{ objectPosition: scene.pos }} onLoad={() => { setReadySrc(scene.src); place(); }} />}
          {!sceneReady && <div className="sp-loading"><span>Navigating the streets &amp; alleyways…</span></div>}
          {browsing && sceneReady && (
            <>
              {typed && (
                <div className={`sp-speech${bubble?.mode === "left" ? " left" : bubble?.mode === "below" ? " below" : ""}`} style={bubble?.style} aria-live="polite">
                  <span className="who">{display.keeperName}</span>{typed}
                  {visit?.read && (
                    <span className={`sp-read m-${visit.read.mood}${visit.read.sure ? "" : " unsure"}`}>
                      <i aria-hidden="true" />{visit.read.sure ? <>{display.keeperName} seems <b>{{ easy: "easy", wary: "wary", testy: "testy", done: "done with you" }[visit.read.mood]}</b></> : <><b>{{ easy: "easy", wary: "wary", testy: "testy", done: "done with you" }[visit.read.mood]}</b>… you think?</>}
                    </span>
                  )}
                </div>
              )}
              {selling && (
                <div key={`sell-${selling.entryId}`} className="sp-float pop" style={{ "--cat": shelfColor(selling.cat) }}>
                  <button className="x" type="button" aria-label="Keep it" onClick={() => { setSelling(null); setLine(speak(voice.putBack)); }}>×</button>
                  <div className="sp-eyebrow">Sell to {display.keeperName}</div>
                  {itemArt(selling.itemId)
                    ? <div className="sp-showcase"><img src={itemArt(selling.itemId)} alt={selling.name} /></div>
                    : <ItemOrb item={{ id: selling.itemId, cat: selling.cat, icon: selling.icon }} />}
                  <h3>{selling.name}</h3>
                  <p>You have {selling.qty}{selling.worn ? ", and you're wearing it" : ""}. {display.keeperName} buys back at half the list price, one at a time.</p>
                  <div className="sp-buy"><span className="sp-price deal">+{selling.price}s</span></div>
                  <div className="sp-buy">
                    <button className="sp-btn gold" type="button" style={{ flex: 1 }} onClick={sellNow} disabled={sellBusy || !canSell}>{sellBusy ? "…" : `Sell one for ${selling.price}s`}</button>
                  </div>
                </div>
              )}
              {inHand && !selling && (
                <div key={popKey} className={`sp-float${popKey ? " pop" : ""}`} style={{ "--cat": shelfColor(inHand.cat) }}>
                  {inHandId && <button className="x" type="button" aria-label="Put it back" onClick={() => { setInHandId(null); setLine(speak(voice.putBack)); }}>×</button>}
                  <div className="sp-eyebrow">{!inHandId && inHand === recommended ? `${display.keeperName} recommends` : SHELVES.find((s) => s.id === inHand.cat)?.name}</div>
                  {itemArt(inHand.id)
                    ? <div className="sp-showcase"><img src={itemArt(inHand.id)} alt={inHand.name} /></div>
                    : <ItemOrb item={inHand} />}
                  <h3>{inHand.name}</h3>
                  {inHand.stat && <span className="sp-stat">{inHand.stat}</span>}
                  <p>{inHand.notes || "Exactly what it says on the tag."}</p>
                  {have > 0 && <p className="owned">You already carry {have > 1 ? have : "one"}.</p>}
                  <div className="sp-buy">
                    <span className={`sp-price${short ? " short" : ""}${deal ? (deal.mult < 1 ? " deal" : " worse") : ""}`}>
                      {deal && <s className="was">{(inHand.price * qty).toLocaleString()}s</s>}{deal ? " " : ""}{(each * qty).toLocaleString()}s{inHand.per && qty === 1 ? `/${inHand.per}` : ""}
                    </span>
                    <div className="sp-qty">
                      <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                      <span aria-live="polite">{qty}</span>
                      <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
                    </div>
                  </div>
                  {dealNote?.itemId === inHand.id && <p className="sp-deal-note">{dealNote.text}</p>}
                  <div className="sp-buy">
                    <button className="sp-btn gold" type="button" style={{ flex: 1 }} onClick={addToSatchel} disabled={short || inHand.out || refusedHere || status !== "open"}>
                      {status === "lockup" ? "Locking up" : inHand.out ? "Sold out" : refusedHere ? "Not for sale to you" : short ? `Short ${Math.ceil(each * qty - (worth - total))} silver` : inSatchel ? "Add more" : "Into the satchel"}
                    </button>
                    <button className="sp-btn" type="button" onClick={haggleNow}
                      disabled={preview || haggling || status !== "open" || inHand.out || refusedHere || tries >= (visit?.maxTries || 3)}
                      title={preview ? "Haggling isn't part of the preview" : "Try for a better price: 2d6 + your Charisma"}>
                      ⚂ {haggling ? "…" : tries >= (visit?.maxTries || 3) ? "Haggled out" : tries ? "Haggle again" : "Haggle"}
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
          {!browsing && status && sceneReady && <ShopShutters status={thrownOut ? "thrown" : status} plaques={{
            closed: speak(voice.plaques.closed), fight: speak(voice.plaques.fight), thrown: speak(voice.plaques.thrown),
            backSoon: shop?.opensAt ? speak(voice.plaques.backSoon, { time: fmtTime(Date.parse(shop.opensAt)) }) : "",
          }} opensAt={shop?.opensAt} closesText={closesText(shop || {}, null)} keeperName={display.keeperName} />}
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
                      onClick={() => { setCat(s.id); setSelling(null); setLine(speak(voice.shelf?.[s.id] || voice.add)); }} aria-pressed={s.id === currentCat}>
                      {!art && <ShopIcon name={s.icon} />}
                      <b>{s.name}</b>
                      <small>{lo === hi ? `${lo}s` : `${lo}–${hi.toLocaleString()}s`}{outN ? <> · <span className="o">{outN} out</span></> : null}</small>
                    </button>
                  );
                })}
              </div>
              {sellView && (
                <>
                  <div className="sp-section-h"><h2>Sell to {display.keeperName}</h2><span>from your pack · half the list price</span></div>
                  <div className="sp-goods">
                    {offers.map((o) => (
                      <button key={o.entryId} type="button" className={`sp-good${selling?.entryId === o.entryId ? " sel" : ""}`} style={{ "--cat": shelfColor(o.cat) }} onClick={() => offer(o)} aria-label={`Sell ${o.name} for ${o.price} silver`}>
                        <span className="sp-tag deal">+{o.price}s</span>
                        <ItemOrb item={{ id: o.itemId, cat: o.cat, icon: o.icon }} />
                        {o.qty > 1 && <span className="sp-have">×{o.qty}</span>}
                        <span className="nm">{o.name}</span><span className="st">{o.worn ? "worn" : ""}</span>
                      </button>
                    ))}
                  </div>
                  {!offers.length && <p className="sp-cat-line">Nothing in your pack {display.keeperName} would buy.</p>}
                  <p className="sp-cat-line"><button type="button" className="sp-btn" onClick={() => { setSellView(false); setSelling(null); }}>Back to the shelves</button></p>
                </>
              )}
              {shelf && !sellView && (
                <>
                  <div className="sp-section-h"><h2>{shelf.name}</h2><span>{shelfItems.filter((it) => !it.out).length} on the shelf{shelfItems.some((it) => it.out) ? ` · ${shelfItems.filter((it) => it.out).length} sold out` : ""}</span></div>
                  <div className="sp-goods">
                    {shelfItems.map((it) => {
                      const n = haveCount(character, it);
                      const poor = !it.out && myPrice(it) > worth - total;
                      const d = deals[it.id]?.mult !== 1 ? deals[it.id] : null;
                      const no = refused.has(it.id);
                      return (
                        <button key={it.id} type="button" className={`sp-good${poor ? " poor" : ""}${it.out || no ? " out" : ""}${inHand?.id === it.id && inHandId ? " sel" : ""}`} style={{ "--cat": shelfColor(it.cat) }}
                          onClick={() => hold(it)} aria-label={`${it.name}, ${it.price} silver${it.out ? ", sold out" : ""}`}>
                          {it.justIn && !it.out && <span className="sp-justin">Just in</span>}
                          <span className={`sp-tag${d ? (d.mult < 1 ? " deal" : " worse") : ""}`}>{myPrice(it).toLocaleString()}s{it.per ? `/${it.per}` : ""}</span>
                          <ItemOrb item={it} />
                          {it.out ? <span className="sp-soldout">Sold out</span> : no ? <span className="sp-soldout">Not to you</span> : null}
                          {n > 0 && <span className="sp-have">have {n}</span>}
                          <span className="nm">{it.name}</span><span className="st">{it.stat || ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <PackPanel character={character} groups={groups} satchelRows={satchelRows} fresh={fresh} open={packOpen} onToggle={() => setPackOpen((o) => !o)} purseLabel={purseLabel}
              sell={canSell ? { label: `Sell to ${display.keeperName} · half price`, active: sellView, onClick: () => { setSellView(true); setLine(speak(offers.length ? voice.sell.offer : voice.sell.wontBuy, { item: offers[0]?.name, price: offers[0]?.price })); } } : null} />
          </div>
        )}
        {!browsing && status && sceneReady && (
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
