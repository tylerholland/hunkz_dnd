import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getChronicle, getShopDm, putShopCatalog, putShopSetup, putShopStatus } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import { PalCtx } from "../features/dmDashboard/dashboardShared";
import DmLoginPrompt from "../features/dmDashboard/DmLoginPrompt";
import TopNav from "../components/TopNav";
import { useTextScale } from "../lib/useTextScale";
import { useAdaptivePolling } from "../lib/liveSync";
import { useSessionSocket } from "../lib/useSessionSocket";
import { USUAL, rollMarkups, rollStock, signFor } from "../features/shop/shopData";
import { StatusBar, ShopPicker, ShelvesStock, CatalogEditor } from "../features/shop/ShopDmParts";
import "../features/shop/shop.css";
import "../features/shop/shopDm.css";

// Story 72 — the DM's shop page: when it's open (a sticky status bar with the
// schedule), which shop it is, its shelves, prices and stock, and the item
// catalog. Setup changes save as you make them; while the shop is open, stock
// stays live and the rest is locked until the DM unlocks it.

const SETUP_KEYS = ["keeper", "pick", "sign", "display", "carries", "level", "markups", "temper", "fill", "out", "memo", "saved"];
const statusOf = (d) => ({ status: d.status, opensAt: d.opensAt, closesAt: d.closesAt, lockupUntil: d.lockupUntil, openingId: d.openingId, opening: d.shop?.opening || null });
const setupOf = (shop) => Object.fromEntries(SETUP_KEYS.map((k) => [k, shop[k]]));

// The sign players see follows the keeper and sign; each template remembers
// how the DM last set it up, and a saved shop keeps its own changes.
function withDerived(s) {
  const display = signFor(s.keeper, s.sign);
  const settings = { cats: s.carries, level: s.level, markups: s.markups, temper: s.temper };
  const isSaved = s.saved.some((m) => m.id === s.pick);
  return {
    ...s,
    display,
    saved: isSaved ? s.saved.map((m) => (m.id === s.pick ? { ...m, ...settings, name: display.name, where: display.where } : m)) : s.saved,
    memo: isSaved ? s.memo : { ...s.memo, [s.pick]: { ...settings, sign: s.sign } },
  };
}

export default function ShopDmPage() {
  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem("dnd_dm_password"));
  const [tab, setTab] = useState("open");
  const [info, setInfo] = useState(null);
  const [setup, setSetup] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [nextSessionAt, setNextSessionAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();
  const pendingRef = useRef(null);
  const savingRef = useRef(false);
  const { textScale, textScaleMenuItem } = useTextScale();
  const palKey = sessionStorage.getItem("dnd_dm_palette") || "ocean";
  const pal = PALETTES[palKey] || PALETTES.ocean;

  const load = useCallback(async () => {
    if (!authed) return;
    try {
      const d = await getShopDm(dmPassword);
      setInfo(statusOf(d));
      setCatalog(d.catalog.items);
      // Don't overwrite edits that are still on their way to the server.
      if (!pendingRef.current && !savingRef.current) setSetup(setupOf(d.shop));
      setError(null);
    } catch (err) {
      if (err?.status === 403) { sessionStorage.removeItem("dnd_dm_password"); setAuthed(false); return; }
      setError("Couldn't load the shop. Check your connection.");
    }
  }, [authed, dmPassword]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    getChronicle().then((c) => { if (!cancelled) setNextSessionAt(c?.nextSession?.at || null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [authed]);
  const { connected: wsConnected } = useSessionSocket(useCallback(() => { load(); }, [load]));
  useAdaptivePolling({ enabled: authed, poll: load, activeMs: wsConnected ? 30000 : 10000 });
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const isLive = info?.status === "open" || info?.status === "lockup";
  if (!isLive && unlocked) setUnlocked(false);
  const locked = isLive && !unlocked;

  // Setup changes apply as you make them (saved a moment after the last one).
  function update(patch) {
    const next = withDerived({ ...setup, ...patch });
    setSetup(next);
    clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(async () => {
      pendingRef.current = null;
      savingRef.current = true;
      try {
        const d = await putShopSetup(dmPassword, next);
        setInfo(statusOf(d));
        setError(null);
      } catch {
        setError("Couldn't save that change. Check your connection; it will retry on your next change.");
      } finally {
        savingRef.current = false;
      }
    }, 350);
  }

  // Preview what's set now: save anything still on its way first.
  async function preview() {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
      try { await putShopSetup(dmPassword, setup); } catch { /* the preview shows the last saved setup */ }
    }
    navigate("/dm/shop/preview");
  }

  function pickShop(id) {
    const saved = setup.saved.find((m) => m.id === id);
    if (saved) {
      update({ pick: id, keeper: saved.keeper, carries: saved.cats, level: saved.level, markups: saved.markups, temper: saved.temper, sign: { nameIdx: 0, custom: { name: saved.name, where: saved.where } } });
      return;
    }
    const m = setup.memo[id] || USUAL[id];
    update({ pick: id, keeper: id, carries: m.cats, level: m.level, markups: m.markups, temper: m.temper, sign: setup.memo[id]?.sign || { nameIdx: 0 } });
  }
  function saveThisShop() {
    const id = `saved-${Date.now().toString(36)}`;
    const d = setup.display;
    update({
      pick: id,
      sign: { nameIdx: setup.sign?.nameIdx || 0, custom: { name: d.name, where: d.where } },
      saved: [...setup.saved, { id, keeper: setup.keeper, name: d.name, where: d.where, cats: setup.carries, level: setup.level, markups: setup.markups, temper: setup.temper }],
    });
  }
  function carryItem(it) {
    const others = (catalog || []).filter((x) => x.cat === it.cat && x.id !== it.id).map((x) => x.id);
    update({ carries: [...new Set([...setup.carries, it.cat])], out: [...new Set([...setup.out.filter((x) => x !== it.id), ...others])] });
  }

  async function act(action, fields) {
    setBusy(true);
    try {
      const d = await putShopStatus(dmPassword, action, fields);
      setInfo(statusOf(d));
      setError(null);
    } catch (err) {
      setError(err?.data?.error || "Couldn't change the shop's status. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function saveCatalog(items) {
    setBusy(true);
    try {
      const d = await putShopCatalog(dmPassword, items);
      setCatalog(d.items);
      setError(null);
    } catch (err) {
      setError(err?.data?.error || "Couldn't save the catalog.");
    } finally {
      setBusy(false);
    }
  }

  const palVars = {
    "--pal-bg": pal.bg, "--pal-surface": pal.surface, "--pal-surface-solid": pal.surfaceSolid, "--pal-border": pal.border,
    "--pal-accent": pal.accent, "--pal-accent-bright": pal.accentBright, "--pal-accent-dim": pal.accentDim,
    "--pal-text": pal.text, "--pal-text-body": pal.textBody, "--pal-text-muted": pal.textMuted,
    "--font-display": pal.fontDisplay, "--font-body": pal.fontBody, "--font-ui": pal.fontUI,
  };

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt onSuccess={(pw) => { setDmPassword(pw); setAuthed(true); }} />
      </PalCtx.Provider>
    );
  }

  const shown = (catalog || []).filter((it) => !it.hidden && setup?.carries.includes(it.cat));
  const inStock = `${shown.filter((it) => !setup.out.includes(it.id)).length} of ${shown.length} wares`;
  const picker = setup && (
    <ShopPicker setup={setup} display={setup.display} onPick={pickShop} onSign={(sign) => update({ sign })} onTemper={(temper) => update({ temper })}
      onReset={() => { const u = USUAL[setup.keeper]; update({ carries: u.cats, level: u.level, markups: u.markups, temper: u.temper }); }} onSave={saveThisShop} />
  );
  const shelves = setup && catalog && (
    <ShelvesStock setup={setup} items={catalog} isLive={isLive} locked={locked} onUpdate={update}
      onRollPrices={(level) => update({ level, markups: rollMarkups(level) })}
      onRollStock={(fill) => update({ fill, out: rollStock(catalog.filter((it) => !it.hidden), fill) })}
      onCarryItem={carryItem} />
  );

  return (
    <div className="sd-page" style={{ ...palVars, zoom: textScale, background: `radial-gradient(ellipse at 50% -10%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}` }} data-light={pal.light ? "true" : undefined}>
      <TopNav backTo="/dm" title={setup?.display?.name ? `Shop · ${setup.display.name}` : "Shop"} menuItems={[
        { label: "Campaign", href: "/dm" }, { label: "📜 Chronicle", href: "/chronicle" }, { label: "⚙ DM Settings", href: "/dm/settings" }, { divider: true }, textScaleMenuItem,
      ]} />
      {info && tab === "open" && (
        <StatusBar info={info} opening={info.opening} nextSessionAt={nextSessionAt} inStock={inStock} busy={busy} now={now} onAction={act} onSchedule={(fields) => act("schedule", fields)} onPreview={preview} />
      )}
      <main className="sd-main">
        <div className="sd-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "open"} className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>Open the shop</button>
          <button type="button" role="tab" aria-selected={tab === "catalog"} className={tab === "catalog" ? "on" : ""} onClick={() => setTab("catalog")}>Item catalog</button>
        </div>
        {error && <p className="sd-error" role="alert">{error}</p>}
        {!setup || !catalog ? <p className="sd-hint">Loading the shop…</p> : tab === "catalog" ? (
          <CatalogEditor items={catalog} onSave={saveCatalog} busy={busy} />
        ) : isLive ? (
          <>
            <div className="sd-lockbar">
              <span><b>The shop is open.</b> Stock changes show in the shop straight away. The shop, its shelves and prices are {unlocked ? "unlocked: changes go live as you make them" : "locked so nothing shifts while people shop"}.</span>
              <button className="sd-tbtn" type="button" onClick={() => setUnlocked((u) => !u)}>{unlocked ? "Lock again" : "Unlock"}</button>
            </div>
            {shelves}
            <div className={locked ? "sd-locked" : ""} aria-disabled={locked || undefined}>{picker}</div>
          </>
        ) : (
          <>{picker}{shelves}</>
        )}
      </main>
    </div>
  );
}
