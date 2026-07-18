# Feature Story: Shared Top Nav & Consistent Menu Language

**Status**: Approved — Ready to Build
**Source**: DM priority list 2026-07-16

---

## Goal

One `TopNav` component used by every page — character library, character sheet (view/profile/session), DM campaign, map library, map viewer — with a consistent design language for navigation and menus across player and DM surfaces.

## Why

Each page currently hand-rolls its own top bar (different back-link styles, button placement, DM affordances). Players and the DM context-switch between pages constantly mid-session; consistent chrome reduces mis-taps on mobile and gives the app one identity instead of five.

## Nav audit (2026-07-18, screenshots taken per page)

Six different top-bar patterns exist today:

| Surface | Left | Center | Right | Notes |
|---|---|---|---|---|
| Character Library | Huge Cinzel page title | — | `DM Login` ghost button | DM-authed adds a second row of ghost links (Campaign · Maps · End Session) |
| Classic sheet | `← ALL CHARACTERS` breadcrumb | — | book icon · ⚔ Session · Export JSON · 🔒 Edit Character | No page title in bar; four boxed buttons crowd mobile |
| Session mode | `← ALL CHARACTERS` | character name | LIVE dot · ❡ Profile / ⚔ Session pills | **No book icon** — World Guide unreachable in the surface used most during play |
| Map viewer | `← CLOSE MAP WINDOW` | map name | zoom controls | Popout window; legitimately different |
| DM dashboard | breadcrumb *below* the bar | — | Manage Party · book icon · palette · All Actions · Live dot | Action-dense; breadcrumb placement unique to this page |
| Map library | `← Campaign` breadcrumb | page title as heading | Upload | Third distinct breadcrumb style |

## Decisions from DM review (2026-07-18)

- Keep the open-book icon as the World Guide trigger — and add it to session mode, where it's currently missing.
- Demote "← All Characters": no longer a shouting uppercase label; navigation back is a quiet glyph, not the bar's primary action.
- Current page title sits top-left (chosen over center — it pairs with the back glyph and survives mobile widths better).
- Export JSON moves into a ⋯ flyout context menu — it's a rare action and doesn't earn permanent chrome.
- Edit Character leaves the top bar entirely and moves into the profile page body (Story 42's slimmed surface — e.g. a quiet button near the header or above collections).
- Mode pills (❡ Profile / ⚔ Session) stay visible on character surfaces — they're the one high-frequency switch.

## UX Design

- **Anatomy** (single row, 52px, sticky, `--pal-bg` with bottom `--pal-border`), same slots on every page:
  - **Left**: quiet back glyph `‹` (44px target, `--pal-text-muted`, brightens on hover; hidden on the library root) followed by the **page title** — Cinzel small-caps ~15px, `--pal-text`: "Character Library", character name on character surfaces, "Campaign" on `/dm`, "Map Library" on `/maps`. The title is identity, not a button.
  - **Center**: mode pills where a mode exists (❡ Profile / ⚔ Session on character surfaces; Battle Mode state on DM map contexts stays in-panel). Desktop only; on mobile the pills drop to the existing second row.
  - **Right**, fixed order: **Live/Polling dot** (live surfaces only) · **open-book World Guide trigger** (all surfaces incl. session mode — currently missing there) · **⋯ context menu**.
- **⋯ context menu** (one popover spec everywhere): anchored dropdown, `--pal-surface-solid` panel, 8px radius, 40px rows, 13px IM Fell English labels, destructive rows `#c06060`, 1px `--pal-border` dividers. Contents by context:
  - Character surfaces: Export JSON · All Characters · (DM-authed: Campaign) — Edit Character is NOT here; it moves into the profile page body (Story 42 surface).
  - Library (anon): DM Login. Library (DM): Campaign · Maps · divider · End Session — replaces the second-row ghost links.
  - DM dashboard: the existing All Actions dropdown merges into this menu (same spec, same anchor position); Manage Party keeps a dedicated bar button (high-frequency).
- **Back glyph targets**: library ← none; character surfaces ← library; `/dm` ← library; `/maps` ← `/dm`; map viewer keeps its `← Close Map Window` variant (popout window — exempt from the shared bar but adopts the same typography).
- **Mobile (<560px)**: `‹` + title left, dot + book + ⋯ right; nothing else. Minimum 44px touch targets throughout; no horizontal overflow at 375px.
- **Palette**: nav inherits the surface's palette via the existing `--pal-*` cascade — character pages tint to the character palette, DM pages to campaign Ocean.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- **New** `src/components/TopNav.jsx` + `src/components/topNav.css` (ADR-014: static CSS file, `--pal-*` variables, no runtime style injection). Props: `{ pal, backTo, backLabel, title, children (page-specific right-slot actions), menuItems }`. Export a `NavMenu` popover primitive reusable for other menus.
- **Adopt page-by-page** in one story: `CharactersListPage`, `CharacterPage` (view-mode top bar), `CharacterModePage`, `DmDashboardPage`, `MapLibraryPage`, `MapViewerPage`. Remove each page's bespoke bar; keep page-specific controls by passing them as children (e.g. Export JSON / Edit Character on the sheet; Manage Party on the dashboard).
- **Do not** move auth logic into TopNav — pages keep owning auth state; TopNav receives `dmActive` / `ownerName` as props.
- **Watch mobile width pressure** on the DM dashboard (the reason Short/Long Rest left the top bar previously — don't reintroduce crowding).
- **Tests**: render test per adopted page asserting the shared nav mounts with correct back target; menu open/close test on the primitive.
- **Update** `design/design-system.md` (new nav + menu spec) and `design/app-overview.md` per-page descriptions.

## Acceptance Criteria

1. All six pages render the shared TopNav; no page defines its own bespoke top-bar markup anymore.
2. DM and player menus follow one visual spec; End Session appears only in the DM menu, styled destructive.
3. Mobile: no horizontal overflow at 375px on any page; all targets ≥44px.
4. All tests pass; palettes cascade correctly (vellum character sheet nav remains readable).

## Out of Scope

- New routes, breadcrumb history stacks, notification badges.
