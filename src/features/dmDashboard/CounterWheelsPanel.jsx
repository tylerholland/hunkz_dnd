import { useState, useRef, useCallback, useEffect } from "react";
import { getCounterWheels, putCounterWheels } from "../../api";
import "./counterWheels.css";

/* ════════════════════════════════════════════════════════════════════════════
   SVG WHEEL MATH
   Pure helper functions — ported from the prototype script, no DOM mutation.
   ════════════════════════════════════════════════════════════════════════════ */

const GAP_DEG = 3;

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180; // 0° = 12 o'clock
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
  const p1 = polar(cx, cy, rOuter, startDeg);
  const p2 = polar(cx, cy, rOuter, endDeg);
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
  if (rInner <= 0.01) {
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
  }
  const p3 = polar(cx, cy, rInner, endDeg);
  const p4 = polar(cx, cy, rInner, startDeg);
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ════════════════════════════════════════════════════════════════════════════
   WheelSVG — declarative SVG renderer from filledCount
   Props: { id, segments, filledCount, isComplete, size }
   ════════════════════════════════════════════════════════════════════════════ */

function WheelSVG({ id, segments, filledCount, isComplete, size = 100 }) {
  const cx = 50, cy = 50, rOuter = 47;
  const hubR = rOuter * 0.18;
  const sweep = 360 / segments;
  const filledGradId = `wfg-${id}`;
  const goldGradId = `wfg-gold-${id}`;

  const segElements = [];

  if (segments === 1) {
    // Notched full ring — binary toggle
    const notch = GAP_DEG;
    const start = notch / 2;
    const end = 360 - notch / 2;
    const filled = filledCount >= 1;
    const d = segPath(cx, cy, rOuter, hubR, start, end);
    const fillAttr = filled ? (isComplete ? `url(#${goldGradId})` : `url(#${filledGradId})`) : undefined;
    segElements.push(
      <path
        key="seg-1"
        className={filled ? "wheel-seg-filled" : "wheel-seg-empty"}
        data-seg="1"
        d={d}
        fill={fillAttr}
      />
    );
    // Separator notch line at 12 o'clock
    const n1 = polar(cx, cy, hubR, 0);
    const n2 = polar(cx, cy, rOuter, 0);
    segElements.push(
      <line
        key="sep-0"
        x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
        stroke="var(--pal-bg)" strokeWidth={1.5} strokeLinecap="butt"
      />
    );
  } else {
    // Annular sectors — separator lines provide visual gaps
    for (let i = 0; i < segments; i++) {
      const segIndex = i + 1;
      const start = i * sweep;
      const end = (i + 1) * sweep;
      const filled = segIndex <= filledCount;
      const d = segPath(cx, cy, rOuter, hubR, start, end);
      const fillAttr = filled ? (isComplete ? `url(#${goldGradId})` : `url(#${filledGradId})`) : undefined;
      segElements.push(
        <path
          key={`seg-${segIndex}`}
          className={filled ? "wheel-seg-filled" : "wheel-seg-empty"}
          data-seg={String(segIndex)}
          d={d}
          fill={fillAttr}
        />
      );
    }
    // Separator lines at each sector boundary
    for (let i = 0; i < segments; i++) {
      const angle = i * sweep;
      const p1 = polar(cx, cy, hubR, angle);
      const p2 = polar(cx, cy, rOuter, angle);
      segElements.push(
        <line
          key={`sep-${i}`}
          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke="var(--pal-bg)" strokeWidth={1.5} strokeLinecap="butt"
        />
      );
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* Filled gradient: uses CSS custom properties for palette awareness */}
        <radialGradient
          id={filledGradId}
          cx={cx} cy={cy} r={rOuter}
          fx={cx} fy={cy}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.15" style={{ stopColor: "var(--pal-accent-bright)" }} />
          <stop offset="1"    style={{ stopColor: "var(--pal-accent)" }} />
        </radialGradient>
        {/* Gold gradient: intentionally fixed warm gold for the "completed" state */}
        <radialGradient
          id={goldGradId}
          cx={cx} cy={cy} r={rOuter}
          fx={cx} fy={cy}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.15" stopColor="#f2e8d2" />
          <stop offset="1"    stopColor="#c8ae84" />
        </radialGradient>
      </defs>
      {segElements}
      <circle className="wheel-hub" cx={cx} cy={cy} r={hubR} />
    </svg>
  );
}

/* Mini preview SVG (creation form) — uses a shared gradient id since only
   one preview is ever shown at a time */
function MiniPreviewSVG({ segments }) {
  return (
    <svg className="wcf-preview-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="wfg-preview" cx="50" cy="50" r="47" fx="50" fy="50" gradientUnits="userSpaceOnUse">
          <stop offset="0.15" style={{ stopColor: "var(--pal-accent-bright)" }} />
          <stop offset="1"    style={{ stopColor: "var(--pal-accent)" }} />
        </radialGradient>
      </defs>
      <WheelSVGInner segments={segments} filledCount={0} id="preview" />
    </svg>
  );
}

/* Helper that renders just the paths/lines/hub — used inside the preview SVG
   wrapper above (skips the outer <svg> and <defs>) */
function WheelSVGInner({ segments, filledCount, id }) {
  const cx = 50, cy = 50, rOuter = 47;
  const hubR = rOuter * 0.18;
  const sweep = 360 / segments;

  const elements = [];

  if (segments === 1) {
    const notch = GAP_DEG;
    const start = notch / 2;
    const end = 360 - notch / 2;
    const filled = filledCount >= 1;
    elements.push(
      <path
        key="seg-1"
        className={filled ? "wheel-seg-filled" : "wheel-seg-empty"}
        data-seg="1"
        d={segPath(cx, cy, rOuter, hubR, start, end)}
        fill={filled ? `url(#wfg-${id})` : undefined}
      />
    );
    const n1 = polar(cx, cy, hubR, 0);
    const n2 = polar(cx, cy, rOuter, 0);
    elements.push(
      <line key="sep-0" x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
        stroke="var(--pal-bg)" strokeWidth={1.5} strokeLinecap="butt" />
    );
  } else {
    for (let i = 0; i < segments; i++) {
      const segIndex = i + 1;
      const start = i * sweep;
      const end = (i + 1) * sweep;
      const filled = segIndex <= filledCount;
      elements.push(
        <path
          key={`seg-${segIndex}`}
          className={filled ? "wheel-seg-filled" : "wheel-seg-empty"}
          data-seg={String(segIndex)}
          d={segPath(cx, cy, rOuter, hubR, start, end)}
          fill={filled ? `url(#wfg-${id})` : undefined}
        />
      );
    }
    for (let i = 0; i < segments; i++) {
      const angle = i * sweep;
      const p1 = polar(cx, cy, hubR, angle);
      const p2 = polar(cx, cy, rOuter, angle);
      elements.push(
        <line key={`sep-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke="var(--pal-bg)" strokeWidth={1.5} strokeLinecap="butt" />
      );
    }
  }

  elements.push(<circle key="hub" className="wheel-hub" cx={cx} cy={cy} r={hubR} />);
  return <>{elements}</>;
}

/* ════════════════════════════════════════════════════════════════════════════
   WheelCell — single wheel card with segment tap, menu, rename
   ════════════════════════════════════════════════════════════════════════════ */

function WheelCell({ wheel, menuOpenId, onTapSegment, onOpenMenu, onRename, onReset, onRemove }) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(wheel.name);
  const inputRef = useRef(null);
  const menuPopoverRef = useRef(null);
  const isMenuOpen = menuOpenId === wheel.id;
  const isComplete = wheel.filledCount === wheel.segments;

  // Autofocus rename input
  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  function handleSvgClick(e) {
    const target = e.target.closest("[data-seg]");
    if (!target) return;
    const segN = parseInt(target.getAttribute("data-seg"), 10);
    onTapSegment(wheel.id, segN);
  }

  function commitRename() {
    const val = renameValue.trim();
    const finalName = val.length ? val : wheel.name;
    setRenaming(false);
    if (finalName !== wheel.name) {
      onRename(wheel.id, finalName);
    }
  }

  function cancelRename() {
    setRenameValue(wheel.name);
    setRenaming(false);
  }

  function handleMenuToggle(e) {
    e.stopPropagation();
    onOpenMenu(isMenuOpen ? null : wheel.id);
  }

  function handleStartRename() {
    onOpenMenu(null);
    setRenameValue(wheel.name);
    setRenaming(true);
  }

  function handleReset() {
    onOpenMenu(null);
    onReset(wheel.id);
  }

  function handleRemove() {
    onOpenMenu(null);
    onRemove(wheel.id);
  }

  // Flip popover up if near panel bottom
  useEffect(() => {
    if (!isMenuOpen || !menuPopoverRef.current) return;
    const rect = menuPopoverRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 160) {
      menuPopoverRef.current.classList.add("flip-up");
    } else {
      menuPopoverRef.current.classList.remove("flip-up");
    }
  }, [isMenuOpen]);

  return (
    <div className={`wheel-cell${isComplete ? " full" : ""}${isMenuOpen ? " menu-open" : ""}`}>
      <div className="wheel-svg-wrap">
        <div onClick={handleSvgClick} style={{ width: "100%", height: "100%" }}>
          <WheelSVG
            id={wheel.id}
            segments={wheel.segments}
            filledCount={wheel.filledCount}
            isComplete={isComplete}
          />
        </div>

        <button
          className="wheel-menu-trigger"
          onClick={handleMenuToggle}
          aria-label="Wheel options"
        >
          ⋯
        </button>

        <div ref={menuPopoverRef} className="wheel-menu-popover">
          <div className="wheel-menu-row" onClick={handleStartRename}>
            <span className="menu-glyph">✎</span> Rename
          </div>
          <div className="wheel-menu-row" onClick={handleReset}>
            <span className="menu-glyph">↺</span> Reset
          </div>
          <div className="wheel-menu-divider" />
          <div className="wheel-menu-row danger" onClick={handleRemove}>
            <span className="menu-glyph">✕</span> Remove
          </div>
        </div>
      </div>

      <div className="wheel-label-wrap">
        {renaming ? (
          <input
            ref={inputRef}
            className="wheel-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur(); }
              else if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
            }}
          />
        ) : (
          <div className="wheel-label">{wheel.name}</div>
        )}
        <div className="wheel-count">{wheel.filledCount}/{wheel.segments}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CreateForm — inline creation form shown at the top of the grid
   ════════════════════════════════════════════════════════════════════════════ */

function CreateForm({ wheelCount, onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [segments, setSegments] = useState(6);
  const nameInputRef = useRef(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  function handleCreate() {
    const finalName = name.trim().length ? name.trim() : `Counter ${wheelCount + 1}`;
    onCreate(finalName, segments);
  }

  return (
    <div className="wheel-create-form">
      <div className="wcf-header">
        <span className="wcf-title">New Counter Wheel</span>
        <button className="wcf-close" onClick={onCancel}>✕</button>
      </div>
      <input
        ref={nameInputRef}
        className="wcf-name-input"
        type="text"
        placeholder="Name (e.g. The Ritual Completes)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
      />
      <div className="wcf-row">
        <span className="wcf-seg-label">Segments</span>
        <div className="wcf-stepper-group">
          <button
            className="btn-stepper"
            onClick={() => setSegments((s) => Math.max(1, s - 1))}
            disabled={segments <= 1}
          >−</button>
          <span className="wcf-seg-count">{segments}</span>
          <button
            className="btn-stepper"
            onClick={() => setSegments((s) => Math.min(12, s + 1))}
            disabled={segments >= 12}
          >+</button>
        </div>
        <div className="wcf-preview-wrap">
          <span className="wcf-preview-label">Preview</span>
          <MiniPreviewSVG segments={segments} />
        </div>
      </div>
      <div className="wcf-divider" />
      <div className="wcf-actions">
        <button className="wcf-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="wcf-btn-create" onClick={handleCreate}>Create Wheel</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CounterWheelsPanel — main component
   Props: { pal, dmPassword, initiativeEntries }
   ════════════════════════════════════════════════════════════════════════════ */

export default function CounterWheelsPanel({ pal, dmPassword, initiativeEntries }) {
  const [wheels, setWheels] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Removing animation tracking: wheel IDs currently animating out
  const [removingIds, setRemovingIds] = useState(new Set());

  // Collapse state — mode-aware default, manual toggle wins
  const [expanded, setExpanded] = useState(() => {
    const saved = sessionStorage.getItem("dnd_wheels_open");
    if (saved !== null) return saved === "true";
    // Default: expanded in combat mode (initiative has entries)
    return Array.isArray(initiativeEntries) && initiativeEntries.length > 0;
  });

  // Optimistic write refs
  const lastConfirmedWheelsRef = useRef([]);
  const debounceTimerRef = useRef(null);
  const latestWheelsRef = useRef([]);

  // Keep latestWheelsRef in sync with state
  useEffect(() => {
    latestWheelsRef.current = wheels;
  }, [wheels]);

  // Fetch on mount
  useEffect(() => {
    if (!dmPassword) return;
    getCounterWheels(dmPassword)
      .then((data) => {
        const loaded = Array.isArray(data?.wheels) ? data.wheels : [];
        setWheels(loaded);
        lastConfirmedWheelsRef.current = loaded;
        latestWheelsRef.current = loaded;
        // Auto-expand if wheels exist and no manual override
        if (loaded.length > 0 && sessionStorage.getItem("dnd_wheels_open") === null) {
          setExpanded(true);
        }
      })
      .catch(() => {});
  }, [dmPassword]);

  // Re-apply mode-aware default when initiative transitions (combat start/end)
  // Only when no manual override is stored
  const prevHasEntriesRef = useRef(null);
  useEffect(() => {
    const hasEntries = Array.isArray(initiativeEntries) && initiativeEntries.length > 0;
    if (prevHasEntriesRef.current === hasEntries) return;
    prevHasEntriesRef.current = hasEntries;
    if (sessionStorage.getItem("dnd_wheels_open") === null) {
      setExpanded(hasEntries || latestWheelsRef.current.length > 0);
    }
  }, [initiativeEntries]);

  // Close menu on outside click / Escape
  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e) {
      if (!e.target.closest(".wheel-menu-popover") && !e.target.closest(".wheel-menu-trigger")) {
        setMenuOpenId(null);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setMenuOpenId(null);
    }
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpenId]);

  // Debounced write — always sends latest full array
  const schedulePut = useCallback((nextWheels, wheelEvent) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const toSend = latestWheelsRef.current; // always latest, not stale closure
      try {
        await putCounterWheels(dmPassword, toSend, wheelEvent || undefined);
        lastConfirmedWheelsRef.current = toSend;
      } catch {
        // Rollback to last confirmed
        const rollback = lastConfirmedWheelsRef.current;
        setWheels(rollback);
        latestWheelsRef.current = rollback;
      }
    }, 300);
  }, [dmPassword]);

  function handleToggleExpand() {
    const next = !expanded;
    setExpanded(next);
    sessionStorage.setItem("dnd_wheels_open", String(next));
  }

  function handleAddShortcut(e) {
    e.stopPropagation();
    if (!expanded) {
      setExpanded(true);
      sessionStorage.setItem("dnd_wheels_open", "true");
    }
    setShowCreateForm(true);
  }

  function handleCreate(name, segments) {
    setShowCreateForm(false);
    const newWheel = { id: genId(), name, segments, filledCount: 0 };
    const next = [...latestWheelsRef.current, newWheel];
    setWheels(next);
    // Pass wheelEvent so putCounterWheels appends the roll-history entry
    schedulePut(next, { name, segments });
  }

  function handleTapSegment(wheelId, segN) {
    const wheel = latestWheelsRef.current.find((w) => w.id === wheelId);
    if (!wheel) return;
    const wasFilled = segN <= wheel.filledCount;
    const to = wasFilled ? segN - 1 : segN;
    const from = wheel.filledCount;
    if (from === to) return;

    const direction = to > from ? 1 : -1;
    const steps = Math.abs(to - from);
    let step = 0;

    const sweep = () => {
      if (step >= steps) return;
      step += 1;
      setWheels((current) => {
        const next = current.map((w) =>
          w.id === wheelId ? { ...w, filledCount: w.filledCount + direction } : w
        );
        latestWheelsRef.current = next;
        return next;
      });
      if (step < steps) setTimeout(sweep, 25);
      else schedulePut(latestWheelsRef.current, { name: wheel.name, segments: wheel.segments, filledCount: to });
    };
    sweep();
  }

  function handleRename(wheelId, newName) {
    setWheels((current) => {
      const next = current.map((w) => w.id === wheelId ? { ...w, name: newName } : w);
      latestWheelsRef.current = next;
      schedulePut(next);
      return next;
    });
  }

  function handleReset(wheelId) {
    // Animate the de-fill: stagger each filled segment out 25ms apart
    const wheel = latestWheelsRef.current.find((w) => w.id === wheelId);
    if (!wheel || wheel.filledCount === 0) return;

    const total = wheel.filledCount;
    let step = 0;
    const sweep = () => {
      if (step >= total) return;
      step += 1;
      setWheels((current) => {
        const next = current.map((w) =>
          w.id === wheelId ? { ...w, filledCount: Math.max(0, w.filledCount - 1) } : w
        );
        latestWheelsRef.current = next;
        return next;
      });
      if (step < total) setTimeout(sweep, 25);
      else {
        // After sweep completes, debounce the write
        schedulePut(latestWheelsRef.current, { name: wheel.name, segments: wheel.segments, filledCount: 0 });
      }
    };
    setTimeout(sweep, 90); // initial delay before sweep begins
  }

  function handleRemove(wheelId) {
    // Animate out, then remove from state after 140ms
    setRemovingIds((s) => new Set([...s, wheelId]));
    setTimeout(() => {
      setRemovingIds((s) => { const ns = new Set(s); ns.delete(wheelId); return ns; });
      setWheels((current) => {
        const next = current.filter((w) => w.id !== wheelId);
        latestWheelsRef.current = next;
        schedulePut(next);
        return next;
      });
    }, 140);
  }

  const activeCount = wheels.length;

  return (
    <div
      className={`wheels-panel${expanded ? " expanded" : ""}`}
      style={{
        // Palette custom properties for CSS cascade
        "--pal-bg": pal.bg,
        "--pal-surface": pal.surface,
        "--pal-surface-solid": pal.surfaceSolid,
        "--pal-border": pal.border,
        "--pal-accent": pal.accent,
        "--pal-accent-bright": pal.accentBright,
        "--pal-accent-dim": pal.accentDim,
        "--pal-gem": pal.gem,
        "--pal-text": pal.text,
        "--pal-text-body": pal.textBody,
        "--pal-text-muted": pal.textMuted,
        "--pal-glow-1": pal.glow1,
        "--pal-glow-2": pal.glow2,
      }}
    >
      {/* Header row */}
      <div className="wheels-header" onClick={handleToggleExpand}>
        <span className="wheels-glyph">◷</span>
        <span className="wheels-label" style={{ fontFamily: pal.fontUI }}>Counter Wheels</span>
        {activeCount > 0 && !expanded && (
          <span className="wheels-count-badge" style={{ fontFamily: pal.fontUI }}>
            {activeCount} active
          </span>
        )}
        <span className="wheels-header-spacer" />
        <button className="wheels-add-shortcut" onClick={handleAddShortcut} style={{ fontFamily: pal.fontUI }}>
          + Add
        </button>
        <span className="wheels-toggle" style={{ fontFamily: pal.fontUI }}>⌄</span>
      </div>

      {/* Collapsible body */}
      <div className="wheels-body">
        <div className="wheels-body-inner">
          <div className="wheels-grid">
            {/* Inline creation form — always at grid start */}
            {showCreateForm && (
              <CreateForm
                wheelCount={wheels.length}
                onCancel={() => setShowCreateForm(false)}
                onCreate={handleCreate}
              />
            )}

            {/* Wheel cells */}
            {wheels.map((wheel) => {
              const isRemoving = removingIds.has(wheel.id);
              if (isRemoving) {
                // Placeholder that animates out; no interactive content during exit
                return <div key={wheel.id} className="wheel-cell removing" />;
              }
              return (
                <WheelCell
                  key={wheel.id}
                  wheel={wheel}
                  menuOpenId={menuOpenId}
                  onTapSegment={handleTapSegment}
                  onOpenMenu={setMenuOpenId}
                  onRename={handleRename}
                  onReset={handleReset}
                  onRemove={handleRemove}
                />
              );
            })}

            {/* Add tile — always shown when no create form is open */}
            {!showCreateForm && (
              <div className="wheel-add-cell">
                <button
                  className="wheel-add-tile"
                  onClick={() => setShowCreateForm(true)}
                  aria-label="Add counter wheel"
                >
                  +
                </button>
                <span className="wheel-add-tile-label" style={{ fontFamily: pal.fontUI }}>
                  Add Counter
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
