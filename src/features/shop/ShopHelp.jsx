// The DM shop page's ⓘ notes and Quick Start tour (design/prototypes/shop-dm-help.html).
// Both draw inside .sd-page (so they keep its palette) with position: fixed,
// converting screen coordinates by the page's text-scale zoom.
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HELP, TOUR, markTourSeen } from "./shopHelpText";

// "**Closed**: players…" → <b>Closed</b>: players…
const rich = (text) => text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>));

const zoomOf = (el) => parseFloat(getComputedStyle(el.closest(".sd-page") || document.body).zoom) || 1;

/** Put `box` just under `anchorRect` (or above, if there's no room), inside the window. */
function place(box, anchorRect) {
  const z = zoomOf(box);
  const w = box.offsetWidth * z, h = box.offsetHeight * z;
  const left = Math.min(Math.max(16, anchorRect.left + anchorRect.width / 2 - w / 2), window.innerWidth - w - 16);
  let top = anchorRect.bottom + 10;
  if (top + h > window.innerHeight - 16) top = Math.max(16, anchorRect.top - h - 10);
  box.style.left = `${left / z}px`;
  box.style.top = `${top / z}px`;
}

// Only one note open at a time, page-wide.
let closeOpenTip = null;

/** A small ⓘ button that opens a short note about one part of the page. */
export function InfoTip({ id, label }) {
  const help = HELP[id];
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const boxRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const reposition = () => { if (boxRef.current && btnRef.current) place(boxRef.current, btnRef.current.getBoundingClientRect()); };
    reposition();
    boxRef.current?.querySelector(".sd-tip-close")?.focus();
    const outside = (e) => { if (!boxRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition);
    };
  }, [open]);

  function toggle() {
    if (open) { setOpen(false); return; }
    closeOpenTip?.();
    closeOpenTip = () => setOpen(false);
    setOpen(true);
  }

  if (!help) return null;
  return (
    <>
      <button ref={btnRef} type="button" className="sd-info" aria-label={label || `About ${help.title.toLowerCase()}`} aria-expanded={open} onClick={toggle}>
        <span aria-hidden="true">i</span>
      </button>
      {open && (
        <div ref={boxRef} className="sd-tip" role="dialog" aria-label={help.title}>
          <button type="button" className="sd-tip-close" aria-label="Close" onClick={() => { setOpen(false); btnRef.current?.focus(); }}>✕</button>
          <h4>{help.title}</h4>
          {help.paras.map((p) => <p key={p}>{rich(p)}</p>)}
          {help.secret && <p className="sd-tip-secret">{help.secret}</p>}
        </div>
      )}
    </>
  );
}

/** The first-visit offer of the tour, until it's taken or dismissed on this device. */
export function TourBanner({ onStart, onDismiss }) {
  return (
    <div className="sd-tour-banner">
      <span>New here? A one-minute tour of setting up and opening the shop.</span>
      <button type="button" className="sd-tbtn primary" onClick={onStart}>Take the tour</button>
      <button type="button" className="sd-tour-x" aria-label="Dismiss the tour" onClick={() => { markTourSeen(); onDismiss(); }}>✕</button>
    </div>
  );
}

/**
 * The Quick Start tour: spotlights each [data-tour] element in turn with a
 * card beside it. It only points — it never changes the shop. `onTab`
 * switches the page's tab for steps on the catalog.
 */
export function ShopTour({ onTab, onClose }) {
  const [i, setI] = useState(0);
  const shadeRef = useRef(null);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const steps = TOUR;
  const step = steps[i];
  const last = i === steps.length - 1;

  function finish() { markTourSeen(); onClose(); }
  // Steps whose element isn't on the page right now are skipped.
  const target = (s) => document.querySelector(`[data-tour="${s.el}"]`);
  function move(dir) {
    let j = i + dir;
    while (j >= 0 && j < steps.length && !steps[j].tab && !target(steps[j])) j += dir;
    if (j >= steps.length) finish();
    else if (j >= 0) setI(j);
  }

  useEffect(() => { onTab(step.tab || "open"); }, [step, onTab]);

  // Keys reach the latest move/finish without re-running the step's effect.
  const actRef = useRef(null);
  useEffect(() => { actRef.current = { move, finish }; });

  // Once per step: bring the target into view, spotlight it, put the card by it.
  useLayoutEffect(() => {
    let raf = 0;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const el = () => document.querySelector(`[data-tour="${TOUR[i].el}"]`);
    const draw = () => {
      const t = el(), shade = shadeRef.current, card = cardRef.current;
      if (!t || !shade || !card) return;
      const r = t.getBoundingClientRect();
      const z = zoomOf(shade);
      Object.assign(shade.style, { left: `${(r.left - 6) / z}px`, top: `${(r.top - 6) / z}px`, width: `${(r.width + 12) / z}px`, height: `${(r.height + 12) / z}px` });
      place(card, { left: r.left - 6, top: r.top - 6, width: r.width + 12, bottom: r.bottom + 6 });
    };
    // Wait a frame so a tab switch has rendered.
    raf = requestAnimationFrame(() => {
      el()?.scrollIntoView?.({ block: "center", behavior: reduce ? "auto" : "smooth" });
      draw();
      nextRef.current?.focus();
    });
    const key = (e) => {
      if (e.key === "Escape") actRef.current?.finish();
      else if (e.key === "ArrowRight") actRef.current?.move(1);
      else if (e.key === "ArrowLeft") actRef.current?.move(-1);
    };
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", draw, { passive: true });
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", draw);
      window.removeEventListener("resize", draw);
    };
  }, [i]);

  return (
    <>
      <div ref={shadeRef} className="sd-tour-shade" aria-hidden="true" />
      <div ref={cardRef} className="sd-tour-card" role="dialog" aria-labelledby="sd-tour-h" aria-describedby="sd-tour-p">
        <div className="sd-tour-step">Step {i + 1} of {steps.length}</div>
        <h4 id="sd-tour-h">{step.title}</h4>
        <p id="sd-tour-p">{step.text}</p>
        <div className="sd-tour-pips" aria-hidden="true">{steps.map((s, j) => <i key={s.el} className={j === i ? "on" : ""} />)}</div>
        <div className="sd-tour-acts">
          <button type="button" className="sd-tour-skip" onClick={finish}>Skip tour</button>
          <button type="button" className="sd-tbtn" disabled={i === 0} onClick={() => move(-1)}>Back</button>
          <button ref={nextRef} type="button" className="sd-tbtn primary" onClick={() => (last ? finish() : move(1))}>{last ? "Done" : "Next"}</button>
        </div>
      </div>
    </>
  );
}
