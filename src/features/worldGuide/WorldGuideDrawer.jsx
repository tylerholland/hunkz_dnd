/**
 * WorldGuideDrawer
 *
 * Right-edge slide-in drawer for the campaign World Guide (Story 26).
 *
 * Props:
 *   open     {boolean}  — whether the drawer is open
 *   onClose  {function} — called to close the drawer
 *
 * State:
 *   toc         — fetched toc.json data
 *   tocState    — "idle" | "loading" | "error"
 *   view        — "toc" | "reading"
 *   currentFile — file path currently being read
 *   currentTitle  — title of current section
 *   currentParent — parent section title (for breadcrumb)
 *   sectionText — fetched markdown text for current section
 *   sectionState — "idle" | "loading" | "error"
 *   gazetteerOpen — Gazetteer panel expanded
 *   filterText    — realm filter query
 *   transitioning — cross-fade in progress
 *
 * Session cache: useRef(Map) keyed by file path; never re-fetches.
 *
 * sessionStorage keys (all prefixed dnd_guide_):
 *   dnd_guide_open               — open/closed state
 *   dnd_guide_section            — last-viewed file path
 *   dnd_guide_scroll_${file}     — scroll position per section
 *   dnd_guide_gazetteer_expanded — Gazetteer expansion state
 */

import { useState, useRef, useEffect, useCallback } from "react";
import "./worldGuide.css";

// ─── Markdown renderer ────────────────────────────────────────────────────────
// Minimal hand-written renderer. Supports:
//   # Title (stripped — rendered as section title)
//   ## / ### / #### headings
//   Paragraphs
//   **bold** *italic*
//   - unordered lists, 1. ordered lists
//   [text](url) links (intercepts .md for in-drawer navigation)
//   `inline code`

function renderInlineMarkdown(text, onInternalLink) {
  // Split on bold, italic, links, inline code
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[0].startsWith("**")) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[0].startsWith("*")) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[0].startsWith("`")) {
      parts.push(<code key={match.index}>{match[4]}</code>);
    } else if (match[0].startsWith("[")) {
      const linkText = match[5];
      const href = match[6];
      const isInternal = href && !href.startsWith("http") && href.endsWith(".md");
      if (isInternal) {
        parts.push(
          <a
            key={match.index}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (onInternalLink) onInternalLink(href);
            }}
          >
            {linkText}
          </a>
        );
      } else {
        parts.push(
          <a key={match.index} href={href} target="_blank" rel="noreferrer">
            {linkText}
          </a>
        );
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

function renderMarkdown(text, onInternalLink) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;
  let listType = null; // "ul" | "ol" | null
  let listItems = [];
  let keyCounter = 0;

  function flushList() {
    if (listItems.length === 0) return;
    const key = `list-${keyCounter++}`;
    if (listType === "ul") {
      elements.push(<ul key={key}>{listItems}</ul>);
    } else {
      elements.push(<ol key={key}>{listItems}</ol>);
    }
    listItems = [];
    listType = null;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip h1 (already extracted as section title)
    if (/^# /.test(trimmed)) {
      flushList();
      i++;
      continue;
    }

    // h4
    if (/^#### /.test(trimmed)) {
      flushList();
      const content = trimmed.slice(5);
      elements.push(
        <h4 key={`h4-${keyCounter++}`}>
          {renderInlineMarkdown(content, onInternalLink)}
        </h4>
      );
      i++;
      continue;
    }

    // h3
    if (/^### /.test(trimmed)) {
      flushList();
      const content = trimmed.slice(4);
      elements.push(
        <h3 key={`h3-${keyCounter++}`}>
          {renderInlineMarkdown(content, onInternalLink)}
        </h3>
      );
      i++;
      continue;
    }

    // h2
    if (/^## /.test(trimmed)) {
      flushList();
      const content = trimmed.slice(3);
      elements.push(
        <h2 key={`h2-${keyCounter++}`}>
          {renderInlineMarkdown(content, onInternalLink)}
        </h2>
      );
      i++;
      continue;
    }

    // Unordered list item
    if (/^[-*] /.test(trimmed)) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      const content = trimmed.slice(2);
      listItems.push(
        <li key={`li-${keyCounter++}`}>
          {renderInlineMarkdown(content, onInternalLink)}
        </li>
      );
      i++;
      continue;
    }

    // Ordered list item
    if (/^\d+\. /.test(trimmed)) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      const content = trimmed.replace(/^\d+\. /, "");
      listItems.push(
        <li key={`li-${keyCounter++}`}>
          {renderInlineMarkdown(content, onInternalLink)}
        </li>
      );
      i++;
      continue;
    }

    // Empty line
    if (trimmed === "") {
      flushList();
      i++;
      continue;
    }

    // Paragraph
    flushList();
    elements.push(
      <p key={`p-${keyCounter++}`}>
        {renderInlineMarkdown(trimmed, onInternalLink)}
      </p>
    );
    i++;
  }

  flushList();
  return elements;
}

// ─── Extract title and body from markdown ─────────────────────────────────────
function extractTitleAndBody(text) {
  const lines = text.split("\n");
  let title = "";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("# ")) {
      title = trimmed.slice(2).trim();
      bodyStart = i + 1;
      break;
    }
    // If no h1 found in first few lines, just use everything as body
    if (i > 3) break;
  }
  const body = lines.slice(bodyStart).join("\n");
  return { title, body };
}

// ─── Find section metadata by file path ───────────────────────────────────────
function findSectionMeta(toc, filePath) {
  if (!toc || !toc.sections) return { title: "", parent: "" };
  for (const section of toc.sections) {
    if (section.file === filePath) {
      return { title: section.title, parent: "" };
    }
    if (section.children) {
      for (const child of section.children) {
        if (child.file === filePath) {
          return { title: child.title, parent: section.title };
        }
      }
    }
  }
  return { title: "", parent: "" };
}

// ─── Find section title by file path ─────────────────────────────────────────
function findTitleByFile(toc, filePath) {
  const meta = findSectionMeta(toc, filePath);
  return meta.title;
}

// ─── WorldGuideDrawer ─────────────────────────────────────────────────────────
export default function WorldGuideDrawer({ open, onClose, pal }) {
  // TOC data
  const [toc, setToc] = useState(null);
  const [tocState, setTocState] = useState("idle"); // "idle" | "loading" | "error"

  // Navigation
  const [view, setView] = useState("toc"); // "toc" | "reading"
  const [currentFile, setCurrentFile] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentParent, setCurrentParent] = useState("");

  // Section content
  const [sectionText, setSectionText] = useState("");
  const [sectionState, setSectionState] = useState("idle");

  // Gazetteer
  const [gazetteerOpen, setGazetteerOpen] = useState(
    () => sessionStorage.getItem("dnd_guide_gazetteer_expanded") === "true"
  );
  const [filterText, setFilterText] = useState("");

  // Animated Gazetteer max-height (set via ref for DOM manipulation)
  const gazetteerPanelRef = useRef(null);
  const gazetteerInnerRef = useRef(null);

  // Cross-fade state
  const [tocFading, setTocFading] = useState(false);
  const [readingActive, setReadingActive] = useState(false);
  const [readingFading, setReadingFading] = useState(false);

  // Fetch cache: file path → markdown text
  const cacheRef = useRef(new Map());

  // Scroll ref for reading view
  const readingScrollRef = useRef(null);

  // Scroll position to restore (set before navigating)
  const pendingScrollRef = useRef(null);

  // Resume section from sessionStorage
  const resumeFile = sessionStorage.getItem("dnd_guide_section") || "";
  const resumeTitle = toc ? findTitleByFile(toc, resumeFile) : "";

  // ── Fetch TOC on first open ────────────────────────────────────────────────
  const tocFetchedRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    if (tocFetchedRef.current) return;
    tocFetchedRef.current = true;
    setTocState("loading");
    let cancelled = false;
    fetch("/world-guide/toc.json")
      .then((r) => {
        if (!r.ok) throw new Error("TOC fetch failed");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setToc(data);
        setTocState("idle");
      })
      .catch(() => {
        if (cancelled) return;
        tocFetchedRef.current = false; // allow retry
        setTocState("error");
      });
    return () => { cancelled = true; };
  }, [open]);

  // ── Persist open/closed state; clear on unmount ───────────────────────────
  useEffect(() => {
    sessionStorage.setItem("dnd_guide_open", open ? "true" : "false");
  }, [open]);
  useEffect(() => {
    return () => {
      sessionStorage.setItem("dnd_guide_open", "false");
    };
  }, []);

  // ── Persist gazetteer state ───────────────────────────────────────────────
  useEffect(() => {
    sessionStorage.setItem("dnd_guide_gazetteer_expanded", gazetteerOpen ? "true" : "false");
  }, [gazetteerOpen]);

  // ── Animate Gazetteer panel ───────────────────────────────────────────────
  useEffect(() => {
    const panel = gazetteerPanelRef.current;
    const inner = gazetteerInnerRef.current;
    if (!panel || !inner) return;
    if (gazetteerOpen) {
      panel.style.maxHeight = inner.scrollHeight + "px";
    } else {
      panel.style.maxHeight = "0px";
    }
  }, [gazetteerOpen]);

  // ── Keyboard: Esc to close ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // ── Restore scroll after reading view mounts ─────────────────────────────
  useEffect(() => {
    if (readingActive && pendingScrollRef.current !== null) {
      if (readingScrollRef.current) {
        readingScrollRef.current.scrollTop = pendingScrollRef.current;
      }
      pendingScrollRef.current = null;
    }
  }, [readingActive]);

  // ── Throttled scroll save ─────────────────────────────────────────────────
  const scrollTimerRef = useRef(null);
  function handleReadingScroll(e) {
    const el = e.currentTarget;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (currentFile) {
        sessionStorage.setItem(`dnd_guide_scroll_${currentFile}`, String(el.scrollTop));
      }
    }, 250);
  }

  // ── Navigate to a section ─────────────────────────────────────────────────
  const navigateTo = useCallback((filePath, parentTitle, scrollTo) => {
    if (!filePath) return;

    // Save pending scroll for after reading view activates
    pendingScrollRef.current = scrollTo != null ? scrollTo : null;

    // Persist last-viewed section
    sessionStorage.setItem("dnd_guide_section", filePath);

    // Determine title from toc (or fall back to empty; will be set from markdown)
    const meta = findSectionMeta(toc, filePath);
    const resolvedTitle = meta.title || "";
    const resolvedParent = parentTitle != null ? parentTitle : meta.parent || "";

    setCurrentFile(filePath);
    setCurrentTitle(resolvedTitle);
    setCurrentParent(resolvedParent);

    // Cross-fade: TOC out → reading in
    setTocFading(true);
    setTimeout(() => {
      setView("reading");
      setTocFading(false);
      setReadingActive(false);

      // Fetch content
      if (cacheRef.current.has(filePath)) {
        const cached = cacheRef.current.get(filePath);
        setSectionText(cached);
        setSectionState("idle");
        setReadingActive(true);
      } else {
        setSectionState("loading");
        setSectionText("");
        setReadingActive(true);
        fetch(`/world-guide/${filePath}`)
          .then((r) => {
            if (!r.ok) throw new Error("Section fetch failed");
            return r.text();
          })
          .then((text) => {
            cacheRef.current.set(filePath, text);
            setSectionText(text);
            setSectionState("idle");
          })
          .catch(() => setSectionState("error"));
      }
    }, 90);
  }, [toc]);

  // ── Handle internal markdown links ────────────────────────────────────────
  const handleInternalLink = useCallback((href) => {
    // href is something like "furyondy.md" — find full path in toc
    if (!toc) return;
    const filename = href.replace(/^\.\//, "");
    // Search toc for a file ending with this filename
    let found = null;
    for (const section of toc.sections) {
      if (section.file && (section.file === filename || section.file.endsWith("/" + filename))) {
        found = { file: section.file, parent: "" };
        break;
      }
      if (section.children) {
        for (const child of section.children) {
          if (child.file && (child.file === filename || child.file.endsWith("/" + filename))) {
            found = { file: child.file, parent: section.title };
            break;
          }
        }
      }
      if (found) break;
    }
    if (found) {
      navigateTo(found.file, found.parent);
    }
    // If not found in TOC, render as plain text (handled in renderInlineMarkdown by not intercepting)
  }, [toc, navigateTo]);

  // ── Navigate back to TOC ──────────────────────────────────────────────────
  function handleBack() {
    // Clear scroll for this file
    if (currentFile) {
      sessionStorage.removeItem(`dnd_guide_scroll_${currentFile}`);
    }
    setReadingFading(true);
    setTimeout(() => {
      setView("toc");
      setReadingFading(false);
      setReadingActive(false);
    }, 90);
  }

  // ── Resume last section ───────────────────────────────────────────────────
  function handleResume() {
    if (!resumeFile) return;
    const scrollPos = parseInt(sessionStorage.getItem(`dnd_guide_scroll_${resumeFile}`) || "0", 10);
    const meta = findSectionMeta(toc, resumeFile);
    navigateTo(resumeFile, meta.parent, scrollPos);
  }

  // ── Scrim visibility: tablet only (700–1099px), no scrim on desktop ───────
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    function onResize() { setWindowWidth(window.innerWidth); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const showScrim = open && windowWidth >= 700 && windowWidth < 1100;

  // ── Retry handler ─────────────────────────────────────────────────────────
  const handleRetrySection = useCallback(() => {
    cacheRef.current.delete(currentFile);
    navigateTo(currentFile, currentParent);
  }, [currentFile, currentParent, navigateTo]);

  // ── Render section body ───────────────────────────────────────────────────
  function renderSectionContent() {
    if (sectionState === "loading") {
      return <div className="wg-loading">Loading…</div>;
    }
    if (sectionState === "error") {
      return (
        <div className="wg-error-state">
          <div className="wg-error-msg">Could not load this section.</div>
          <button
            className="wg-retry-btn"
            onClick={handleRetrySection}
          >
            Retry
          </button>
        </div>
      );
    }
    if (!sectionText) return null;
    const { title, body } = extractTitleAndBody(sectionText);
    const displayTitle = title || currentTitle;
    return (
      <>
        <div className="wg-section-title">{displayTitle}</div>
        {currentParent && (
          <div className="wg-breadcrumb">{currentParent}</div>
        )}
        <div className="wg-reading-content">
          {renderMarkdown(body, handleInternalLink)}
        </div>
      </>
    );
  }

  // ── Render TOC ────────────────────────────────────────────────────────────
  function renderTOC() {
    if (tocState === "loading") {
      return <div className="wg-loading">Loading guide…</div>;
    }
    if (tocState === "error") {
      return (
        <div className="wg-error-state">
          <div className="wg-error-msg">Could not load the World Guide.</div>
          <button
            className="wg-retry-btn"
            onClick={() => {
              setToc(null);
              setTocState("idle");
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    if (!toc) return null;

    return (
      <>
        {/* Resume row */}
        {resumeFile && resumeTitle && (
          <div className="wg-resume-row" onClick={handleResume}>
            <span className="wg-resume-diamond">✦</span>
            <span className="wg-resume-text">
              Resume: <strong>{resumeTitle}</strong>
            </span>
          </div>
        )}

        <div className="wg-toc-section-label">Chapters</div>

        {toc.sections.map((section, idx) => {
          const hasChildren = section.children && section.children.length > 0;
          const isGazetteer = section.file === null && hasChildren;

          if (isGazetteer) {
            // Special Gazetteer treatment: filter input + realm rows
            const filteredChildren = filterText.trim()
              ? section.children.filter((c) =>
                  c.title.toLowerCase().includes(filterText.toLowerCase())
                )
              : section.children;

            return (
              <div key={idx}>
                <div
                  className="wg-chapter-row"
                  onClick={() => setGazetteerOpen((v) => !v)}
                >
                  <span className="wg-chapter-name">{section.title}</span>
                  <span className={`wg-chapter-chevron${gazetteerOpen ? " is-expanded" : ""}`}>
                    ›
                  </span>
                </div>
                <div className="wg-gazetteer-panel" ref={gazetteerPanelRef} style={{ maxHeight: 0 }}>
                  <div className="wg-gazetteer-inner" ref={gazetteerInnerRef}>
                    <div className="wg-filter-wrap">
                      <div className="wg-filter-icon-wrap">
                        <span className="wg-filter-icon">⌕</span>
                        <input
                          className="wg-filter-input"
                          type="text"
                          placeholder="Filter realms…"
                          value={filterText}
                          onChange={(e) => setFilterText(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                    {filteredChildren.length === 0 && filterText ? (
                      <div className="wg-no-match">
                        No realms match &ldquo;{filterText}&rdquo;
                      </div>
                    ) : (
                      filteredChildren.map((child, ci) => (
                        <div
                          key={ci}
                          className="wg-realm-row"
                          onClick={() => navigateTo(child.file, section.title)}
                        >
                          <span className="wg-realm-name">{child.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (hasChildren) {
            // Expandable section with children (Folk, Geography, Power Groups, Gods)
            // Use local state via a sub-component to avoid extra state at top level
            return (
              <ExpandableSection
                key={idx}
                section={section}
                onNavigate={(file, parent) => navigateTo(file, parent)}
              />
            );
          }

          // Simple chapter row: tap to navigate
          return (
            <div
              key={idx}
              className="wg-chapter-row"
              onClick={() => section.file && navigateTo(section.file, "")}
            >
              <span className="wg-chapter-name">{section.title}</span>
              <span className="wg-chapter-chevron">›</span>
            </div>
          );
        })}
      </>
    );
  }

  // Palette CSS variables — set inline on the drawer so all children can use
  // var(--pal-*). WorldGuideDrawer uses position:fixed so it escapes the
  // mount context's CSS cascade; inject vars explicitly (same pattern as
  // ItemEditorModal).
  const palVars = pal ? {
    "--pal-bg":            pal.bg,
    "--pal-surface":       pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border":        pal.border,
    "--pal-accent":        pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim":    pal.accentDim,
    "--pal-text":          pal.text,
    "--pal-text-body":     pal.textBody,
    "--pal-text-muted":    pal.textMuted,
    "--pal-glow-1":        pal.glow1,
    "--pal-glow-2":        pal.glow2,
    "--pal-gem":           pal.gem,
    "--pal-gem-low":       pal.gemLow,
  } : {};

  return (
    <>
      {/* Scrim — tablet/mobile only */}
      <div
        className={`world-guide-scrim${showScrim ? " is-visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`world-guide-drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-label="World Guide"
        aria-modal={windowWidth < 1100 ? "true" : "false"}
        style={palVars}
      >
        {/* TOC sticky header */}
        {view === "toc" && (
          <div className="wg-toc-header">
            <div className="wg-drawer-title">World Guide</div>
            <button className="wg-close-btn" onClick={onClose} aria-label="Close World Guide" type="button">
              ×
            </button>
          </div>
        )}

        {/* View host */}
        <div className="wg-view-host">
          {/* TOC view */}
          <div
            className={`wg-toc-view${tocFading ? " is-fading-out" : ""}${view === "reading" ? " is-fading-out" : ""}`}
            style={{ display: view === "toc" || tocFading ? undefined : "none" }}
          >
            {renderTOC()}
          </div>

          {/* Reading view */}
          <div
            className={`wg-reading-view${readingActive && !readingFading ? " is-active" : ""}${readingFading ? " is-fading-out" : ""}`}
            style={{ display: view === "reading" || readingFading ? undefined : "none" }}
            ref={readingScrollRef}
            onScroll={handleReadingScroll}
          >
            {/* Reading sticky header */}
            <div className="wg-reading-header">
              <button className="wg-back-btn" onClick={handleBack} type="button">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9,2 4,7 9,12" />
                </svg>
                Back to Guide
              </button>
              <button className="wg-close-btn" onClick={onClose} aria-label="Close World Guide" type="button">
                ×
              </button>
            </div>

            <div className="wg-reading-body">
              {/* eslint-disable-next-line react-hooks/refs */}
              {renderSectionContent()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ExpandableSection ─────────────────────────────────────────────────────────
// Sub-component for TOC sections that have both a file (index) and children
// (Folk, Geography, Power Groups, Gods). Tapping the row navigates to the
// index file; the chevron toggles children expansion.
function ExpandableSection({ section, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const innerRef = useRef(null);

  useEffect(() => {
    const panel = panelRef.current;
    const inner = innerRef.current;
    if (!panel || !inner) return;
    panel.style.maxHeight = isOpen ? inner.scrollHeight + "px" : "0px";
  }, [isOpen]);

  function handleRowClick(e) {
    // If the chevron was clicked, toggle only
    if (e.target.closest(".wg-chapter-chevron-btn")) {
      setIsOpen((v) => !v);
      return;
    }
    // If section has a file, navigate to it
    if (section.file) {
      onNavigate(section.file, "");
    } else {
      setIsOpen((v) => !v);
    }
  }

  return (
    <div>
      <div className="wg-chapter-row" onClick={handleRowClick}>
        <span className="wg-chapter-name">{section.title}</span>
        <span
          className={`wg-chapter-chevron wg-chapter-chevron-btn${isOpen ? " is-expanded" : ""}`}
          onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
        >
          ›
        </span>
      </div>
      <div
        ref={panelRef}
        className="wg-gazetteer-panel"
        style={{ maxHeight: 0 }}
      >
        <div ref={innerRef} className="wg-gazetteer-inner" style={{ padding: "4px 0" }}>
          {section.children.map((child, ci) => (
            <div
              key={ci}
              className="wg-child-row"
              onClick={() => child.file && onNavigate(child.file, section.title)}
            >
              <span className="wg-child-name">{child.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
