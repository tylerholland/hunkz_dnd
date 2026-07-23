/**
 * TopNav — shared sticky top navigation bar (Story 37).
 *
 * Props:
 *   backTo      {string|null}  — URL for the back glyph; omit/null to hide it
 *   title       {string}       — page title rendered in Cinzel small-caps
 *   center      {ReactNode}    — optional center slot (segmented control)
 *   menuItems   {Array}        — items for the ⋯ context menu (see below)
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
 *
 * Export: NavSegment — the segmented-control primitive, used standalone on
 * the DM dashboard (Adventure | Combat) and in the center slot.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
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

/**
 * TopNav — the full sticky bar.
 */
export default function TopNav({
  backTo = null,
  title,
  center = null,
  menuItems = [],
  showLive = false,
  wsConnected = false,
  onBookClick,
  bookOpen = false,
  children,
}) {
  const [backTapped, setBackTapped] = useState(false);

  const handleBackClick = () => {
    setBackTapped(true);
    setTimeout(() => setBackTapped(false), 220);
  };

  return (
    <>
      <nav className="topnav" aria-label="Page navigation">
        {/* Left: back glyph + title */}
        <div className="topnav-left">
          {backTo && (
            <Link
              to={backTo}
              className={`topnav-back${backTapped ? " topnav-back--tapped" : ""}`}
              onClick={handleBackClick}
              aria-label="Go back"
              title="Go back"
            >
              ‹
            </Link>
          )}
          {title && <span className="topnav-title">{title}</span>}
        </div>

        {/* Center: segmented mode control (desktop only — see mobile row below) */}
        {center && (
          <div className="topnav-center">
            {center}
          </div>
        )}

        {/* Right: children (page-specific buttons) + dot + book + ⋯ */}
        <div className="topnav-right">
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

          <NavMenu items={menuItems} />
        </div>
      </nav>

      {/* Mobile second row: center segment drops here below 560px */}
      {center && (
        <div className="topnav-mobile-row" aria-hidden="true">
          {center}
        </div>
      )}
    </>
  );
}
