// Story 72 — the shop on the next-session line (homepage, Chronicle) and on
// the session sheet: when it opens, or a way in while it's open. Says nothing
// while the shop is closed.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getShop } from "../../api";
import { fmtDay, fmtTime, fromNow, closesText, keeperFaceStyle } from "./shopData";
import "./shopLine.css";

/**
 * `summary` is getSessionState().shop; pass `undefined` to have the line fetch
 * it itself. `slug` is the shopper (without one there's no way in).
 * `only`: which states to show (the sheet shows only open and locking up).
 */
export default function ShopLine({ summary, slug, nextSessionAt = null, only = ["scheduled", "open", "lockup"], className = "" }) {
  const [fetched, setFetched] = useState(null);
  const wantFetch = summary === undefined;
  useEffect(() => {
    if (!wantFetch) return undefined;
    let cancelled = false;
    getShop()
      .then((s) => { if (!cancelled) setFetched({ status: s.status, opensAt: s.opensAt, closesAt: s.closesAt, keeper: s.keeper, keeperName: s.display?.keeperName, name: s.display?.name }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wantFetch]);
  const shop = wantFetch ? fetched : summary;
  if (!shop || !only.includes(shop.status)) return null;

  const face = <span className="shopline-face" style={keeperFaceStyle(shop.keeper)} aria-hidden="true" />;
  const href = slug ? `/characters/${slug}/shop` : null;
  if (shop.status === "scheduled" && shop.opensAt) {
    const t = Date.parse(shop.opensAt);
    return <div className={`shopline ${className}`}>{face}<span>{shop.name} opens <b>{fmtDay(t)}, {fmtTime(t)}</b> · {fromNow(t)}</span></div>;
  }
  const locking = shop.status === "lockup";
  return (
    <div className={`shopline ${className}`}>
      {face}
      <span className={`shopline-state${locking ? " lock" : ""}`}>{locking ? "Locking up" : "Open"}</span>
      <span>{shop.name} · {locking ? "two minutes to pay for your satchel" : closesText(shop, nextSessionAt)}</span>
      {href
        ? <Link className="shopline-btn" to={href}>{locking ? "Pay up" : `Visit ${shop.keeperName || "the shop"}`}</Link>
        : <span className="shopline-hint">Sign in as your character to visit.</span>}
    </div>
  );
}
