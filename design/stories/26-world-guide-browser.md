# Story 26 — World Guide Browser

**Status**: Implemented
**Source**: RPG Consultant
**Prototype**: (leave blank — ux-designer fills this in)

---

## Goal

Give players and the DM a low-footprint, in-app reference for the campaign world. Mid-session, when a player can't remember who rules a particular kingdom or what the political relationship is between two factions, they should be able to open a compact guide browser, navigate to the right section in a few taps, read what they need, and close it — all without leaving their character sheet or the DM dashboard, and without disrupting the session flow. The guide exists but lives outside the app; this story brings it in as a browsable reference, not a permanent UI fixture.

This is Phase 1 of Story 25. No AI search layer, no editing, no upload UI — just a reliable manual browser backed by content that already exists on disk.

---

## User stories

- As a player, I want to open a world guide browser from my character sheet so that I can look up a kingdom, ruler, or faction mid-session without switching to another document or app.
- As a player, I want to navigate a table of contents so that I can jump to a specific chapter or realm entry without reading the entire guide.
- As a player, I want to read an individual guide section in a readable format so that I can quickly extract the information I need and return to play.
- As the DM, I want the same world guide browser accessible from the campaign dashboard so that I can look up lore without leaving the party view.
- As the DM, I want the guide to be available as a passive reference tool that does not take over the screen so that I can open it during a session without losing sight of HP, initiative, or conditions.

---

## Functional requirements

The guide is already structured and available: 7 chapter files plus 56 realm files under `world-guide/04-gazetteer/`, with a `toc.json` manifest describing the hierarchy. The app simply needs to serve this content as a navigable browser.

**Content delivery**
- Guide files are markdown. The app renders them as formatted text (headings, paragraphs, lists, bold/italic). No raw markdown syntax visible to the reader.
- The `toc.json` manifest drives the navigation tree — the app does not infer structure from filenames. Chapter and realm entries are distinct levels in the hierarchy.
- Content is served statically (bundled at build time or loaded from S3). No database, no auth gating — the guide is not sensitive material.

**Access points**
- Accessible from the player character sheet. Because the sheet already has four tabs (Inventory, Persona, Combat, Map), the guide should not become a fifth tab — it is a secondary reference tool used occasionally, not a session-primary surface. A dedicated entry point (icon, button, or anchor) that opens the guide in a non-tab presentation is the right model. The exact control and its placement are UX decisions.
- Accessible from the DM dashboard in a similarly non-intrusive way. The dashboard is already dense; the guide entry point must not compete with party cards, initiative, or NPC combat.
- On both surfaces, the guide opens over or beside the current view rather than replacing it, so the player or DM can close it and resume exactly where they were.

**Navigation**
- The table of contents is the starting view. It shows chapters and can expand to show realm entries within a chapter.
- Selecting a section loads and renders that section's content.
- Navigation back to the TOC is always available from within a section.
- The most recently viewed section is remembered for the duration of the session (not persisted across page loads).

**Reading experience**
- Section content renders with appropriate typographic hierarchy: headings, body text, lists.
- The guide uses the app's existing palette theming so it does not visually clash with the character sheet or dashboard.
- Long sections scroll within the guide container without the background page scrolling.

**Performance**
- Individual guide sections load on demand — not all at once on first open.
- The TOC and any recently viewed sections may be cached in memory for the session to avoid re-fetching the same content.

---

## Data model changes

No DynamoDB changes. No new API endpoints required.

**Static content**:
- `world-guide/` directory (7 chapter files + 56 realm files) bundled or served from S3 alongside other static assets.
- `world-guide/toc.json` — manifest describing the hierarchy; format to be confirmed during design, but at minimum: chapter title, chapter file path, array of realm entries each with title and file path.

**Session state**:
- Last-viewed section identifier stored in `sessionStorage` (key: `dnd_guide_section`) so the guide reopens to the last-read section within a tab session. Not persisted beyond the tab.
- Open/closed state of the guide panel stored in `sessionStorage` (key: `dnd_guide_open`) consistent with how the dice roller persists its collapsed state.

---

## Out of scope

- AI-powered search or question answering (Phase 2, deferred — see Story 25).
- DM control over which sections are visible to players. All guide content is treated as player-accessible. Per-section visibility controls are a future concern.
- In-app editing or annotation of guide content. The guide is read-only in this phase; edits happen externally.
- Full-text search or keyword filtering within the guide.
- Any route change or standalone guide page (`/guide`). The browser opens as an overlay or panel without changing the URL. This keeps the feature lightweight and avoids navigation complexity.
- Integration with the map system, character sheet fields, or dice roller.
- Multi-guide support. One campaign world, one guide.

---

## Open questions

- **`toc.json` format**: the manifest file exists but its exact schema needs to be confirmed before implementation. Does it include section metadata (chapter number, realm region, etc.) that could improve navigation grouping?
- **Guide entry point on the character sheet**: the four-tab strip is already full. Where should the guide trigger live — in the top bar, as a floating button, or somewhere else? This is the primary UX question for the designer.
- **Guide entry point on the DM dashboard**: the dashboard is dense and column-based. A panel approach (collapsible, like the Map panel) or a modal approach (opens over everything) each have tradeoffs. The designer should evaluate both.
- **Realm file count**: 56 realm files may make a flat list overwhelming. Should the TOC group realms under chapters (two-level hierarchy) or use a deeper grouping (regions, sub-regions)? Depends on how `toc.json` structures the content.
- **Mobile behavior**: the character sheet is used on phones during sessions. How does the guide browser behave at small viewport widths? A full-screen takeover may be unavoidable on mobile even if a sidebar approach works on desktop.

---

## UX Design

The world guide is delivered as a **right-edge slide-in drawer** triggered from a small open-book icon in the top bar of both the character sheet (between the back link and Export JSON) and the DM dashboard (between Manage Party and End Session). Same icon, same behaviour, same drawer on both surfaces — entry-point consistency is the load-bearing UX decision.

**Form factor**: 440px fixed-width drawer on desktop (≥1100px) with no scrim — the underlying surface stays interactive so the DM can keep watching HP and initiative while reading. 420px drawer with a 0.4 scrim on tablet (700–1099px). Full-screen takeover on mobile (<700px). Closes via `×`, `Esc`, scrim tap (tablet/mobile), or re-tapping the trigger icon.

**Navigation**: two-level TOC with chapter rows as the top level. The Gazetteer expands **in place** to reveal its realm entries (no drill-down). The expanded realm panel includes an inline filter that narrows the 56-entry list by title substring (TOC-level navigation, not content search). Tapping a chapter or realm cross-fades the drawer interior to a reading view with a sticky "‹ Back to Guide" header and breadcrumb.

**Reading**: the markdown `# Title` is stripped and rendered as the section header above body. Subheadings (`##`, `###`) render in Cinzel 18/16px. Body prose is Crimson Text 16px / line-height 1.8. Long sections scroll internally (`overscroll-behavior: contain`).

**State persistence (session-only)**:
- `dnd_guide_open` — drawer open/closed
- `dnd_guide_section` — last-viewed section (powers the "✦ Resume" shortcut at TOC top)
- `dnd_guide_scroll_${file}` — scroll position per section
- `dnd_guide_gazetteer_expanded` — Gazetteer expansion state

**Motion**: open 260ms ease-out slide from right; close 220ms ease-in. Gazetteer expand/collapse 220ms/180ms with chevron rotation. TOC ↔ Reading is a 250ms cross-fade inside the drawer. `prefers-reduced-motion` replaces all transitions with instant state changes.

**Full design spec**: `design/briefs/world-guide-browser-brief.md`

---

## Architect Notes

**Applies**: ADR-001 (CSS architecture), ADR-002 (feature-sliced modules), ADR-006 (sessionStorage), ADR-014 (variable schema). No new ADR needed — content delivery is plain `fetch()` of static assets that Vite serves from `public/`, which is a stock framework feature, not an architectural choice worth recording.

**Tech approach**: Build under `src/features/worldGuide/` following ADR-002 — three files: `WorldGuideDrawer.jsx` (shell, owns all state, hosts both TOC + reading views), `WorldGuideTrigger.jsx` (icon button), `worldGuide.css` (drawer animation, sticky header, reading typography). Open/closed state lives **inside `WorldGuideDrawer`** as `useState`, hydrated once from `sessionStorage.dnd_guide_open`. The trigger button takes `open` and `onToggle` props from the drawer's parent (the page) so the parent only manages the single shared boolean. This keeps the drawer self-contained and avoids leaking guide state into `CharacterPage.jsx` / `DmDashboardPage.jsx`.

Markdown rendering: hand-write a small renderer (`renderMarkdown(text)`) inside `worldGuide/` — do **not** add `react-markdown` or `marked` as a dependency. The content is constrained (your own files), and `react-markdown` + `remark` adds 30–50KB gzipped for features we don't need. Required support: `#` heading (strip, surface as section title), `##`/`###` headings, paragraphs, `**bold**`, `*italic*`, unordered (`-`/`*`) and ordered lists, links (`[text](url)` — for in-drawer links to other guide files, intercept and route through the same loader; for `http://...` links, render as `target="_blank" rel="noreferrer"`). Defer for Phase 2 unless trivially cheap: tables, code blocks, images (the content currently has none — confirm via grep before deciding). Use `renderInline()` in `theme.jsx` as a stylistic reference, not a dependency — write your own line-by-line parser that emits a flat array of React elements.

Content fetch: plain `fetch('/world-guide/toc.json')` and `fetch('/world-guide/${file}')` — no API layer entry in `src/api.js` (that file is for backend calls; static asset fetch is different and clearer if kept inline). Wrap both in a tiny in-drawer cache: `const cacheRef = useRef(new Map())` keyed by file path, so re-opening Furyondy in the same session doesn't refetch. TOC fetched lazily on first drawer open, then memoized for the tab lifetime. Loading state: render `pal.textMuted` skeleton placeholder text ("Loading guide…"). Error state: centered retry button per §9 of the brief.

**Scope boundary**:

In scope:
- Drawer shell with open/close animation, sticky header, internal scroll
- Two-level TOC, Gazetteer expand-in-place with chevron
- Realm filter input (substring match on titles only)
- Reading view with `# Title` strip + breadcrumb
- Minimal markdown renderer (headings, paragraphs, bold/italic, lists, links)
- In-drawer link interception for `[text](sibling.md)` cross-references
- Resume row from `dnd_guide_section`
- `sessionStorage` persistence for `dnd_guide_open`, `dnd_guide_section`, `dnd_guide_scroll_${file}`, `dnd_guide_gazetteer_expanded`
- Mount in both CharacterPage and DmDashboardPage top bars
- `prefers-reduced-motion` instant-transition fallback
- `Esc` key to close; trigger toggle on re-tap
- Mobile full-screen takeover (<700px)

Out of scope (feature-builder should resist adding):
- Any backend / API / Lambda changes
- Route changes — no `/guide` URL, no React Router state involvement
- Full-text search across content
- Per-section DM visibility controls (Phase 2)
- Editing or annotation UI
- Mid-session preloading of all 80+ files
- A markdown library dependency
- Bundling markdown into JS (it stays in `public/`)
- Caching across page reloads (`sessionStorage` only — no IndexedDB, no Service Worker)
- Keyboard shortcut `g` to open (brief §3 mentions it, but defer — shortcut collisions on the character sheet are not yet inventoried)

**Performance notes**:
- Lazy-load markdown files only when the user navigates to a section. Total guide is ~80 files; eager-loading them all costs nothing in dev but ships ~500KB of unused content on first open.
- The 56-realm filter runs on every keystroke. With 56 entries this is fine without throttling — straightforward `.filter()` on the rendered list.
- Scroll position write to `sessionStorage` must be throttled to 250ms per brief §6c — use a `setTimeout` ref pattern, not `lodash.throttle` (no new deps).
- Both pages already poll every 1s (ADR-011). The drawer does **not** add any polling. The underlying surface keeps polling while the drawer is open on desktop — this is correct and expected (DM keeps watching HP).
- Drawer mount: keep it cheap. Mount the trigger always; mount the drawer body only when `open === true` (or on first open, then keep mounted) so closed-state has zero rendering cost beyond the icon.

**Cost notes**: None. No new AWS resources. Markdown files live in `public/world-guide/` and are copied verbatim into `dist/` by Vite, then synced to S3 with the existing `deploy.sh`. They're served by S3 static hosting (ADR-009) at the same near-zero cost as the rest of the SPA. Total content size ~500KB across 80+ files is negligible relative to the existing portrait assets.

**Dependencies**: None — this is fully decoupled from character/DM data. The `toc.json` and markdown files already exist at `public/world-guide/`. Confirm shape match: each section has `{ title, file, level, children? }`; the Gazetteer node should have `file: null` (or absent) since tapping it only expands. Verify this in `toc.json` before wiring expand-vs-navigate logic, and degrade gracefully if `file` is present but `children` exists (treat as "tap navigates, chevron expands" if both — but ideally the manifest should be unambiguous).

**Mount point specifics**:

`CharacterSheetViewMode.jsx` line 491 — insert as **first child** of `.cs-topbar-actions`, before the Export JSON button:
```jsx
<div className="cs-topbar-actions">
  <WorldGuideTrigger pal={pal} open={guideOpen} onToggle={() => setGuideOpen(o => !o)} />
  <button onClick={exportJSON} className="cs-toolbar-btn">Export JSON</button>
  ...
</div>
```
The drawer itself mounts at the top of `CharacterSheetViewMode`'s return tree (sibling of `.cs-content`) so it overlays the entire sheet. `guideOpen` lives in `CharacterSheetViewMode` as local state. **Do not** lift to `CharacterSheet.jsx` container — edit mode does not show the guide, so the state belongs in view mode only.

`DmDashboardPage.jsx` line 618-621 — insert **between** `Manage Party` and the palette select (per brief §3b "between Manage Party and End Session" — practically: right after the Manage Party button):
```jsx
<button className="btn-ghost" onClick={() => setShowManageParty(true)}>Manage Party</button>
<WorldGuideTrigger pal={pal} open={guideOpen} onToggle={() => setGuideOpen(o => !o)} />
<select value={palKey} ...>
```
`guideOpen` is a new local state hook near the other `useState` calls at the top of `DmDashboardClassicPage`. Drawer mounts at the top of the returned tree, inside `PalCtx.Provider`.

`WorldGuideTrigger` should style itself as a `.cs-toolbar-btn` on character sheet and `.btn-ghost` on dashboard — accept a `className` prop and pass the appropriate class from each mount, OR (simpler) make the trigger a square icon-only button with its own class `.guide-trigger` defined in `worldGuide.css` that uses `--pal-*` variables. Recommend the latter — the icon-only square treatment in the brief (32×32 padded to 44) doesn't match either existing button style, so a dedicated class is correct per ADR-001's "three or more uses justifies a class" rule (used in two surfaces with intentional consistency).

**CSS approach**: New `src/features/worldGuide/worldGuide.css` file alongside the JSX, imported at the top of `WorldGuideDrawer.jsx`. Uses the standard `--pal-*` variables from ADR-014 — the drawer inherits palette from its mount context automatically because both `CharacterSheetViewMode` and `DmDashboardPage` set `--pal-*` on ancestor roots. No need to re-declare. Z-index: existing values in the app top out at 1000 (`MapUploadModal`). Set the drawer to `z-index: 1100` to sit above all current modals; set the scrim to `1099`. This leaves headroom but won't conflict. Drawer uses `position: fixed; top: 0; right: 0; height: 100vh; transform: translateX(100%)` and animates to `translateX(0)` on open. Use a `.world-guide-drawer.is-open` class toggle for animation state — no inline `style={{ transform }}` since the values are static (only the boolean flips). Sticky header inside drawer uses `position: sticky; top: 0`. `overscroll-behavior: contain` on the scroll container per brief §6c.

**SessionStorage key audit**: The four new keys (`dnd_guide_open`, `dnd_guide_section`, `dnd_guide_scroll_${file}`, `dnd_guide_gazetteer_expanded`) do not collide with any existing key (`dnd_palette_${slug}`, `dnd_dm_password`, `dnd_char_${slug}`, `dnd_tab_${slug}`, `dnd_dice_open_${slug}`, `dnd_dice_dm_open`, `dnd_dm_palette`). One housekeeping note: `dnd_guide_scroll_${file}` writes one key per visited section — at ~80 sections worst case this is fine, but **clear stale keys** when the user taps "Back to TOC" per §6c, not just on tab close, to keep the keyspace bounded.

**Risks / decisions needed**:
1. **In-drawer markdown links** — brief §11 question 2 recommends Phase 1, brief §12 confirms. Cost is small if the renderer already maps `[text](url)`: detect `.md` suffix and intercept the click to call the drawer's internal navigate function instead of opening a new tab. Decision: **include in Phase 1**. If a link target isn't in `toc.json`, fall back to rendering as plain text (don't expose broken links).
2. **Vite static asset handling for `public/`** — confirm `vite.config.js` has no `publicDir` override that would change the URL path. The brief context says it's standard `base: '/'` — verify before implementation.
3. **`toc.json` Gazetteer file field** — confirm whether the Gazetteer chapter row has its own `file` (an "overview" page) or `file: null`. The brief assumes `file: null` (tap toggles only). If the manifest has both `file` and `children`, the implementation choice is: chevron toggles expansion, tapping the row label navigates to the overview. Surface this to the user if ambiguous in the manifest.
4. **Cross-page drawer state** — `sessionStorage` is shared across same-origin tabs/routes, so navigating from CharacterPage to DmDashboardPage carries `dnd_guide_open=true`. Per brief §9 "User navigates away (route change) → Drawer unmounts; `dnd_guide_open` set false in cleanup". Confirm: on `useEffect` cleanup in `WorldGuideDrawer`, write `dnd_guide_open = "false"`. This is the only correct behavior — a guide that auto-opens on page change would be jarring.
5. **No `prefers-reduced-motion` test infrastructure exists yet** — implement the media query CSS but expect this won't be automatically verified. Manual QA pass required.
