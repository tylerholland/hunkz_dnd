# World Guide Browser — Design Brief

> Story 26. A low-footprint, on-demand reference overlay for the campaign world guide. Opens from both the character sheet and DM dashboard without changing routes or replacing the current view.
>
> Core principle: the guide is a **drawer the user pulls open, reads, and pushes shut**. It must feel like reaching for a book on the shelf, not navigating to a different room.

---

## 1. Design intent

A player at the table can't remember whether the County of Urnst is loyal to Nyrond or Iuz. They want the answer in under fifteen seconds and back in their character sheet before anyone notices they checked. The guide is not a destination — it is a glance.

**Mental model**: a reference drawer that slides over the right edge of the current view. The character sheet or dashboard remains visible behind it as an anchor — the user never feels they've left their seat. Open → drill down two taps → read → close. The whole interaction is muscle memory inside a session.

**Emotional goal**: calm, unhurried lookup. The guide is **library light**, not search-engine fast. Cinzel headings, Crimson Text body, generous line height. It rewards the reader who pauses to read a paragraph; it does not punish the reader who needs one fact in five seconds.

**Functional goal**: zero route change, zero state loss on the underlying surface. Closing the guide returns the user to the exact same character sheet tab, the exact same dashboard scroll position, the exact same expanded NPC card.

---

## 2. Information hierarchy

**Trigger discoverability:** the entry point must be findable on first hunt but invisible during normal use. Tier 3 — on-demand, ambient.

**Within the drawer, TOC view (priority order):**

1. **Section title** ("World Guide") + close affordance
2. **Chapter list** — top-level entries, generous tap targets, Cinzel
3. **Gazetteer disclosure** — expands in-place to reveal realm entries; a chevron, not a separate screen
4. **Last-viewed shortcut** (when present) — "Resume: Furyondy"

**Within the drawer, reading view:**

1. **Back to TOC** affordance — top-left, always visible
2. **Section title** (Cinzel, 22px)
3. **Body content**
4. **Close drawer** — top-right

The section title and Back affordance occupy a **sticky header** that persists during scroll.

---

## 3. Entry point placement

### 3a. Character sheet

The four-tab strip is full and Tier 1. The guide does **not** earn a tab.

**Placement: the top bar, right side, next to Export JSON.**

```
┌──────────────────────────────────────────────────────────────┐
│ ← All Characters        ① 📖   Export JSON   🔒 Edit Character │
└──────────────────────────────────────────────────────────────┘
```

① **Guide trigger** — 32×32px tap target padded to 44px. Open-book glyph SVG, `pal.textMuted`. On hover (desktop): `pal.accent`. On open: glyph fills `pal.accentBright`. `aria-label="World Guide"`, `title="World Guide"` for desktop tooltip. Keyboard: `g` opens, `Esc` closes.

### 3b. DM dashboard

**Placement: between `Manage Party` and `End Session` in the top bar.**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Library   Campaign   [pal]   Manage Party    ② 📖    End Session       │
└──────────────────────────────────────────────────────────────────────────┘
```

② Same icon, same 44px touch zone, same behaviour as character-sheet trigger. Consistency is the load-bearing UX decision — the icon means the same thing on both surfaces.

---

## 4. Interaction model — the drawer

### 4a. Form factor: right-edge slide-in drawer

**Decision: right-edge slide-in drawer, not a modal, not a popover.**

- A modal hides underlying context. The DM loses sight of HP and initiative.
- A drawer preserves the spatial anchor. The character sheet remains visible at the left edge.
- The drawer can be wide enough to read in (440px) while leaving ~60–70% of the parent surface visible on desktop.
- Right edge because the trigger icon is top-right on both surfaces — spatial continuity.

### 4b. Dimensions

| Viewport | Drawer width | Underlying surface |
|---|---|---|
| ≥1100px (desktop) | 440px fixed | Fully interactive — no scrim |
| 700–1099px (tablet) | 420px fixed | Dim scrim 0.4 opacity; tap-to-close |
| <700px (mobile) | 100vw (full takeover) | Hidden |

**Height: always 100vh, edge-to-edge vertically.**

**No scrim on desktop**: the DM may want to keep glancing at HP values while reading a realm description. A scrim implies "you must close this to continue" — wrong message.

### 4c. Closing

1. **× Close button** — top-right corner, always visible, 44px tap target
2. **Esc key**
3. **Tap scrim** — tablet/mobile only

On desktop, clicking the underlying surface does **not** close the drawer (it is intentionally co-resident). Re-tapping the trigger icon also closes (toggle).

---

## 5. Navigation within the guide

### 5a. Two-level TOC

The TOC is two-level. Chapter entries at the top level; the Gazetteer expands **in-place** to reveal realm entries. A flat list of 60+ entries would lose the editorial structure of the source.

**Gazetteer disclosure**: collapsed by default, expands in-place when tapped (not a drill-down). Chevron rotates 90° → 0° over 220ms. The 56 realm rows reveal with `max-height` ease-out. Within the expanded list, an inline filter input appears.

### 5b. TOC layout

```
┌───────────────────────────────────────────────┐
│ WORLD GUIDE                             ×      │
│───────────────────────────────────────────────│
│                                               │
│  ✦ Resume: Furyondy            (when present) │
│                                               │
│  Greyhawk's World                        ›    │
│  Folk of the Flanaess                    ›    │
│  History of the Flanaess                 ›    │
│  Gazetteer of the Flanaess               ⌄    │
│  Geography of the Flanaess               ›    │
│  Power Groups                            ›    │
│  Greyhawk's Gods                         ›    │
│  Appendix                                ›    │
│                                               │
└───────────────────────────────────────────────┘
```

- **Drawer title**: "WORLD GUIDE" — IM Fell English, 12px, uppercase, `letter-spacing: 0.28em`, `pal.textMuted`. Sticky.
- **× Close**: 16px glyph, `pal.textMuted` → `pal.accentBright` on hover. 44px target.
- **Resume row**: shown only when `sessionStorage.dnd_guide_section` is set. `✦` prefix (Cinzel, 11px, `pal.accent`). Tapping restores last section + scroll position.
- **Chapter row**: Cinzel, 16px, `pal.text`. Padding `14px 20px`. Trailing `›` in `pal.textMuted`. Hover: row bg `pal.surface`, chevron `pal.accent`.
- **Gazetteer row**: same style, trailing `⌄` rotates to indicate expansion. `file: null` — tapping only toggles, never navigates.

### 5c. Expanded Gazetteer realm list

```
│  Gazetteer of the Flanaess               ⌄    │
│  ┌─────────────────────────────────────────┐  │
│  │  ⌕ Filter realms…                        │  │
│  ├─────────────────────────────────────────┤  │
│  │  Overview                                │  │
│  │  Ahlissa                                 │  │
│  │  Bandit Kingdoms                         │  │
│  │  …                                       │  │
│  │  Zeif                                    │  │
│  └─────────────────────────────────────────┘  │
```

- **Filter input**: IM Fell English placeholder, `pal.surface` bg, `pal.border` border. Client-side substring filter on title. Clears on drawer close.
- **Realm row**: Cinzel, 14px, `pal.textBody`. Indented 16px beyond chapter rows. No trailing chevron — one tap to read.
- The realm list scrolls as part of the whole TOC document — no nested scroll container.

> Note: filtering is TOC-level navigation (filtering 56 title strings), not content search. Distinct from the "full-text search" scoped out of Story 26.

---

## 6. Reading view

### 6a. Layout

```
┌───────────────────────────────────────────────┐
│ ‹ Back to Guide                          ×     │
│───────────────────────────────────────────────│
│                                               │
│ FURYONDY                                      │
│ Gazetteer of the Flanaess                     │
│                                               │
│ Capital                                       │
│ Chendl                                        │
│                                               │
│ Ruler                                         │
│ King Belvor IV (LG male human Ftr14)…         │
│                                               │
│ Overview                                      │
│ Furyondy is a kingdom in decline…             │
│                                               │
└───────────────────────────────────────────────┘
```

- **‹ Back to Guide**: sticky header, top-left. IM Fell English, 12px, uppercase, tracked, `pal.accent`. 44px target. Returns to TOC with prior expansion state restored.
- **× Close**: top-right. Closes drawer entirely.
- **Section title**: Cinzel, 22px, `pal.text`. Padding `18px 24px 4px`. The markdown `# Title` is rendered here and stripped from body to avoid duplication.
- **Breadcrumb**: IM Fell English, 11px, uppercase, `pal.textMuted`. Parent chapter name (e.g., "Gazetteer of the Flanaess"). Absent for top-level chapter pages.
- **Body prose**: Crimson Text, 16px, `pal.textBody`, `line-height: 1.8`. Not justified (drawer is narrow; justify creates rivers at 380px). Paragraph spacing 1em.
- **Subheadings** (`##`, `###`): Cinzel 18px / 16px, `pal.text`, `margin-top: 1.8em`.
- **Lists**: `◆` diamond bullets, 14px Crimson Text.
- **Bold** (`**text**`): `font-weight: 600`, `pal.text`.

### 6b. Markdown rendering rules

| Element | Render |
|---|---|
| `#` heading | Stripped (rendered as section title above body) |
| `##` / `###` | Cinzel 18px / 16px, `pal.text`, margin-top 1.8em |
| Paragraphs | Crimson Text 16px, line-height 1.8 |
| `**bold**` | font-weight 600, `pal.text` |
| `*italic*` | font-style italic, `pal.textBody` |
| `- list` | ◆ bullet |
| `1. list` | Numbered, IM Fell English prefix, `pal.accent` |
| Links | Underlined, `pal.accent`; external → new tab |
| Code | `pal.surface` panel, `pal.fontUI` (graceful degradation) |
| Tables | Plain block (not expected in content) |
| Images | `max-width: 100%`, `border-radius: 3px`, `margin: 1em 0` |

### 6c. Scroll behaviour

- Reading area scrolls **internally**. Body page behind the drawer does not scroll while drawer is active.
- Use `overscroll-behavior: contain` to prevent scroll-chaining on touch.
- Sticky header (Back / ×) remains pinned during scroll.
- Scroll position saved to `sessionStorage` as `dnd_guide_scroll_${file}`, throttled at 250ms. Cleared when Back is tapped.

---

## 7. Motion spec

| Event | Animation | Duration | Easing |
|---|---|---|---|
| Open drawer | `translateX(100%) → 0`; scrim fades `0 → 0.4` (tablet) | 260ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Close drawer | `translateX(0) → 100%`; scrim fades `0.4 → 0` | 220ms | `cubic-bezier(0.4, 0, 0.6, 1)` |
| Trigger icon open/close state | Glyph fill cross-fades | 140ms | linear |
| Gazetteer expand | `max-height: 0 → scrollHeight`; chevron rotates `0 → 90deg` | 220ms | ease-out |
| Gazetteer collapse | Reverse | 180ms | ease-in |
| Realm filter row remove | Opacity fade then height collapse | 120ms + 100ms | ease-in |
| TOC → Reading view | TOC `opacity 1→0` (90ms), reading `opacity 0→1` (160ms, 60ms delay) | 250ms total | ease-in-out |
| Reading → TOC | Reverse cross-fade | 250ms | ease-in-out |

**Asymmetric timing**: open (260ms) is slightly slower than close (220ms). The opening announces itself; the dismissal gets out of the way.

**Reduced motion**: replace all slides/cross-fades with instant transitions. Preserve opacity changes for state communication.

---

## 8. State persistence

| Key | Written when | Cleared when | Purpose |
|---|---|---|---|
| `dnd_guide_open` | On open/close | Tab close | Drawer open/closed on same-tab navigation |
| `dnd_guide_section` | When a section is opened | Tab close | Powers Resume row |
| `dnd_guide_scroll_${file}` | Throttled during scroll | Back tapped, or tab close | Restores scroll on Resume |
| `dnd_guide_gazetteer_expanded` | When Gazetteer toggles | Tab close | Restores expansion state |

**Not persisted**: filter input (transient), TOC scroll position (short list).
**Reload behaviour**: drawer closes on hard refresh (treat as fresh start). Resume row still works via `dnd_guide_section`.

---

## 9. Edge cases

| Case | Behaviour |
|---|---|
| First open, no last-viewed | TOC, no Resume row, Gazetteer collapsed |
| TOC fetch fails | Centered retry message, `pal.textMuted` |
| Section fetch fails | Title + breadcrumb visible; body shows retry; Back still works |
| Realm filter — no matches | "No realms match '_query_'" centered in `pal.textMuted` italic |
| Drawer open during active combat | No lockout — DM decides when to consult lore |
| User navigates away (route change) | Drawer unmounts; `dnd_guide_open` set false in cleanup |
| Section is very long | Internal drawer scroll; header sticks; no length cap |
| Animating in/out when icon tapped | Cancel current animation, reverse to new target |
| Mobile: opened during session | Full-screen takeover; closing returns to exact sheet tab/scroll |

---

## 10. Mobile vs. desktop delta

| | Desktop ≥1100px | Tablet 700–1099px | Mobile <700px |
|---|---|---|---|
| Width | 440px fixed | 420px fixed | 100vw |
| Scrim | None | 0.4 opacity | n/a |
| Tap outside closes | No | Yes | n/a |
| Keyboard shortcuts | `g` + `Esc` + Tab/Enter | `Esc` | `Esc` |
| Body font | 16px | 16px | 16px |

---

## 11. Open questions

1. **Filter scope**: the realm filter filters TOC titles (not content). Framed as navigation. Recommend keeping — saves real time on a 56-item alphabetical list.
2. **Cross-linking**: should `[Ahlissa](ahlissa.md)` in the Furyondy markdown render as a tappable in-drawer link? Recommend yes for Phase 1 (low cost, high lore value). Architect's call on scope.
3. **Content delivery**: bundle markdown with Vite build vs. serve from S3. Recommend bundle — ~500KB total, no network round-trips, no loading states.
4. **Icon glyph**: open-book SVG. Alternatives: scroll, compass, atlas. Recommend book — reads as "reference" universally.
5. **Session re-open on reload**: treat reload as fresh start (drawer closed), but Resume row persists. Override if continuity-through-reload is wanted.

---

## 12. Implementation paths (for the architect)

- `src/features/worldGuide/WorldGuideDrawer.jsx` — drawer shell, manages open/closed state, hosts TOC and reading views
- `src/features/worldGuide/WorldGuideTrigger.jsx` — icon button, reusable in both top bars
- `src/features/worldGuide/worldGuide.css` — drawer slide animation, sticky header, scroll containment, reading typography
- Mount points: `src/pages/CharacterPage.jsx` top bar; `src/pages/DmDashboardPage.jsx` top bar
- Content: bundle `world-guide/` as Vite static assets; `toc.json` imported directly; markdown files loaded via dynamic `import()` keyed by file path (lazy per-section load)
- Markdown renderer: minimal purpose-built renderer for this constrained content — headings, paragraphs, lists, bold/italic, links. Avoid full markdown lib if possible.
- `sessionStorage` keys prefixed `dnd_guide_*` as listed in §8
- Palette: drawer inherits `--pal-*` from its mount context — character sheet uses character palette, dashboard uses ocean palette
