/**
 * TopNav — shared sticky top navigation bar (Story 37).
 *
 * Props:
 *   backTo      {string|null}  — URL for the back glyph; omit/null to hide it
 *   title       {string}       — page title rendered in Cinzel small-caps
 *   center      {ReactNode}    — optional center slot (segmented control)
 *   notch       {ReactNode}    — a mode toggle hanging off the bar's lower
 *                                edge (the DM's Adventure | Combat)
 *   menuItems   {Array}        — this page's items for the ⋯ menu (see
 *                                below); TopNav adds Settings and Theme for the
 *                                DM, then Sign out for anyone signed in
 *   showLive    {boolean}      — whether to show the live/polling dot
 *   wsConnected {boolean}      — true = Live (green pulse), false = Polling
 *   onBookClick {function}     — called when the World Guide book icon is clicked
 *   bookOpen    {boolean}      — whether the World Guide is currently open
 *   children    {ReactNode}    — extra action buttons in the right slot (e.g. Upload)
 *
 * menuItems shape:
 *   { label: string, onClick?: fn, href?: string, destructive?: boolean }
 *   | { divider: true }
 *   | { select: true, label: string, value: string, options: [{key, label}], onChange: (key) => void }
 *   | { toggle: true, label: string, checked: boolean, onChange: () => void }  — an on/off switch
 *
 * Export: NavSegment — the segmented-control primitive, used standalone on
 * the DM dashboard (Adventure | Combat) and in the center slot.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { PALETTES } from "../features/characterSheet/theme";
import { anyoneSignedIn, isDmSignedIn, setDmPalette, signOutEverywhere, useCombatActive, useDmPalette } from "../lib/dmSession";
import "./topNav.css";

const BOOK_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

/**
 * NavSegment — segmented control primitive.
 * Props:
 *   options   [{key, label}]   — the two (or more) segments
 *   value     string           — currently active key
 *   onChange  (key) => void
 */
export function NavSegment({ options, value, onChange }) {
  return (
    <div className="topnav-segment" role="group">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`topnav-seg-btn${value === opt.key ? " topnav-seg-btn--active" : ""}`}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * NavMenu — ⋯ popover menu primitive.
 * Exported so it can be composed independently if ever needed.
 */
export function NavMenu({ items }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleItemClick = useCallback((item) => {
    setOpen(false);
    item.onClick?.();
  }, []);

  const handleStepClick = useCallback((e, fn) => {
    e.stopPropagation();
    fn?.();
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="topnav-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`topnav-menu-trigger${open ? " topnav-menu-trigger--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="More actions"
        title="More actions"
      >
        ⋯
      </button>
      <div className={`topnav-menu-popover${open ? " topnav-menu-popover--open" : ""}`}>
        {items.map((item, idx) => {
          if (item.divider) {
            return <div key={idx} className="topnav-menu-divider" />;
          }
          if (item.select) {
            return (
              <div key={idx} className="topnav-menu-select-row">
                <label className="topnav-menu-select-label">{item.label}</label>
                <select
                  className="topnav-menu-select"
                  value={item.value}
                  onChange={(e) => item.onChange?.(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.options.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          }
          if (item.toggle) {
            // A switch flips in place; the menu stays open.
            return (
              <button
                key={idx}
                type="button"
                role="menuitemcheckbox"
                aria-checked={!!item.checked}
                className="topnav-menu-item topnav-menu-toggle"
                onClick={(e) => { e.stopPropagation(); item.onChange?.(); }}
              >
                {item.label}
                <span className={`topnav-switch${item.checked ? " on" : ""}`} aria-hidden="true"><i /></span>
              </button>
            );
          }
          if (item.stepper) {
            return (
              <div key={idx} className="topnav-menu-stepper">
                <button
                  type="button"
                  className="topnav-menu-stepper-btn"
                  onClick={(e) => handleStepClick(e, item.onDecrement)}
                  aria-label={`Decrease ${item.label}`}
                >−</button>
                <span className="topnav-menu-stepper-label">{item.label}: {item.value}</span>
                <button
                  type="button"
                  className="topnav-menu-stepper-btn"
                  onClick={(e) => handleStepClick(e, item.onIncrement)}
                  aria-label={`Increase ${item.label}`}
                >+</button>
              </div>
            );
          }
          if (item.href) {
            return (
              <Link
                key={idx}
                to={item.href}
                className={`topnav-menu-item${item.destructive ? " topnav-menu-item--destructive" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          }
          return (
            <button
              key={idx}
              type="button"
              className={`topnav-menu-item${item.destructive ? " topnav-menu-item--destructive" : ""}`}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The DM's places, the same on every page. Settings lives in ⋯.
const DM_PAGES = [
  { key: "campaign", label: "Campaign", to: "/dm" },
  { key: "shop", label: "Shop", to: "/dm/shop" },
  { key: "maps", label: "Maps", to: "/maps" },
  { key: "chronicle", label: "Chronicle", to: "/chronicle" },
];
function currentDmPage(pathname) {
  if (pathname === "/dm") return "campaign";
  if (pathname.startsWith("/dm/shop")) return "shop";
  if (pathname.startsWith("/maps")) return "maps";
  if (pathname.startsWith("/chronicle")) return "chronicle";
  return null;
}
const isDmArea = (pathname) => pathname === "/" || pathname.startsWith("/dm") || pathname.startsWith("/maps") || pathname.startsWith("/chronicle");

function CombatMark() {
  return <span className="topnav-fight" role="img" aria-label="in combat" title="In combat" />;
}

// Phones (and character pages): the DM's places folded into one menu.
function DmSwitcher({ label, current, combat }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div className="topnav-dmswitch" ref={wrapRef}>
      <button type="button" className="topnav-dmswitch-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="topnav-dmswitch-label">{label}</span>
        {current === "campaign" && combat && <CombatMark />}
        <span className="topnav-dmswitch-caret" aria-hidden="true">▾</span>
      </button>
      <div className={`topnav-menu-popover topnav-dmswitch-pop${open ? " topnav-menu-popover--open" : ""}`}>
        {DM_PAGES.map((p) => (
          <Link key={p.key} to={p.to} className="topnav-menu-item" aria-current={p.key === current ? "page" : undefined} onClick={() => setOpen(false)}>
            {p.label}{p.key === "campaign" && combat && <CombatMark />}
          </Link>
        ))}
        <div className="topnav-menu-divider" />
        <Link to="/" className="topnav-menu-item" onClick={() => setOpen(false)}>⌂ Party (home)</Link>
      </div>
    </div>
  );
}

/**
 * TopNav — the full sticky bar.
 */
export default function TopNav({
  backTo = null,
  title,
  center = null,
  notch = null,
  menuItems = [],
  showLive = false,
  wsConnected = false,
  onBookClick,
  bookOpen = false,
  children,
}) {
  const [backTapped, setBackTapped] = useState(false);
  const { pathname } = useLocation();
  const dmPalette = useDmPalette();
  const combat = useCombatActive();
  const isDm = isDmSignedIn();
  const signedIn = anyoneSignedIn();
  const current = currentDmPage(pathname);
  // On DM pages (and the homepage) the DM's places replace the title; on a
  // character's pages the title stays and the places fold into "DM ▾".
  const dmLinks = isDm && isDmArea(pathname);
  const currentLabel = DM_PAGES.find((p) => p.key === current)?.label || title || "DM";

  const handleBackClick = () => {
    setBackTapped(true);
    setTimeout(() => setBackTapped(false), 220);
  };

  const items = [
    ...menuItems,
    ...(isDm ? [
      { divider: true },
      ...(pathname.startsWith("/dm/settings") ? [] : [{ label: "Settings", href: "/dm/settings" }]),
      {
        select: true,
        label: "Theme",
        value: dmPalette,
        options: Object.keys(PALETTES).map((key) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1) })),
        onChange: setDmPalette,
      },
    ] : []),
    ...(signedIn ? [{ divider: true }, { label: "Sign out", onClick: signOutEverywhere, destructive: true }] : []),
  ].filter((item, i, all) => !(item.divider && (i === 0 || all[i - 1]?.divider)));

  return (
    <>
      <nav className={`topnav${dmLinks ? " topnav--dm" : ""}${notch ? " topnav--notched" : ""}`} aria-label="Page navigation">
        {/* Left: back glyph (or home, for the DM) + the DM's places or the title */}
        <div className="topnav-left">
          {backTo ? (
            <Link
              to={backTo}
              className={`topnav-back${backTapped ? " topnav-back--tapped" : ""}`}
              onClick={handleBackClick}
              aria-label="Go back"
              title="Go back"
            >
              ‹
            </Link>
          ) : dmLinks && pathname !== "/" && (
            <Link to="/" className="topnav-back topnav-home" aria-label="Home — the party" title="Home — the party">⌂</Link>
          )}
          {dmLinks ? (
            <>
              <nav className="topnav-dmlinks" aria-label="DM pages">
                {DM_PAGES.map((p) => (
                  <Link key={p.key} to={p.to} className="topnav-dmlink" aria-current={p.key === current ? "page" : undefined}>
                    {p.label}{p.key === "campaign" && combat && <CombatMark />}
                  </Link>
                ))}
              </nav>
              <DmSwitcher label={pathname === "/" ? "DM pages" : currentLabel} current={current} combat={combat} />
            </>
          ) : (
            title && <span className="topnav-title">{title}</span>
          )}
        </div>

        {/* Center: segmented mode control (desktop only — see mobile row below) */}
        {center && (
          <div className="topnav-center">
            {center}
          </div>
        )}

        {/* Right: children (page-specific buttons) + dot + book + ⋯ */}
        <div className="topnav-right">
          {isDm && !dmLinks && <DmSwitcher label="DM" current={current} combat={combat} />}
          {!signedIn && pathname === "/" && <Link to="/dm" className="topnav-dm-link">DM</Link>}
          {children}

          {showLive && (
            <div
              className={`topnav-dot-wrap${wsConnected ? "" : " topnav-dot-wrap--polling"}`}
              title={wsConnected ? "Live — connected for instant sync" : "Polling — reconnecting to live sync"}
            >
              <span className="topnav-dot" />
              <span className="topnav-dot-label">{wsConnected ? "Live" : "Polling"}</span>
            </div>
          )}

          {onBookClick && (
            <button
              type="button"
              className={`topnav-book${bookOpen ? " topnav-book--open" : ""}`}
              onClick={onBookClick}
              aria-label="World Guide"
              title="World Guide"
            >
              {BOOK_SVG}
            </button>
          )}

          <NavMenu items={items} />
        </div>

        {/* The mode toggle hangs off the bar's lower edge, like a notch. */}
        {notch && <div className="topnav-notch">{notch}</div>}
      </nav>
      {notch && <div className="topnav-notch-space" aria-hidden="true" />}

      {/* Mobile second row: center segment drops here below 560px */}
      {center && (
        <div className="topnav-mobile-row" aria-hidden="true">
          {center}
        </div>
      )}
    </>
  );
}
