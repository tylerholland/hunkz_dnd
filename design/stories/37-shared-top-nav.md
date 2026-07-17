# Feature Story: Shared Top Nav & Consistent Menu Language

**Status**: Approved — Ready to Build
**Source**: DM priority list 2026-07-16

---

## Goal

One `TopNav` component used by every page — character library, character sheet (view/profile/session), DM campaign, map library, map viewer — with a consistent design language for navigation and menus across player and DM surfaces.

## Why

Each page currently hand-rolls its own top bar (different back-link styles, button placement, DM affordances). Players and the DM context-switch between pages constantly mid-session; consistent chrome reduces mis-taps on mobile and gives the app one identity instead of five.

## UX Design

- **Anatomy** (single row, 52px, sticky, `--pal-bg` with bottom `--pal-border`):
  - **Left**: back/home breadcrumb (`←` + label, `btn-ghost` treatment). On the library page (root) this slot shows the app wordmark instead.
  - **Center** (mobile: suppressed): page title in IM Fell English uppercase tracked 13px, muted.
  - **Right**: icon cluster — World Guide trigger (existing open-book icon, 44px target), then page-specific actions, then the identity chip.
- **Identity chip**: shows `DM ✓` (accent) when DM-authenticated; character name chip on a player's own sheet; `DM Login` ghost button when anonymous on the library page. Tapping the chip opens the **standard menu**.
- **Standard menu** (one popover pattern to rule them all): anchored dropdown, `--pal-surface-solid` panel, 8px radius, item rows 40px with 13px IM Fell English labels, destructive items in `#c06060`, dividers as 1px `--pal-border`. Contents by context — DM: Campaign, Maps, Character Library, divider, End Session. Player: My Sheet, Profile/Session toggle, Character Library. This replaces the ad-hoc second row of links on `CharactersListPage` and absorbs "All Actions"-style overflow patterns where they are pure navigation (page-specific action menus like the DM dashboard's All Actions stay, but adopt the same popover visual spec).
- **Mobile (<560px)**: left slot + right icon cluster only; page-specific actions collapse into the standard menu. Minimum 44px touch targets throughout.
- **Palette**: nav inherits the surface's palette via the existing `--pal-*` cascade — character pages tint to the character palette, DM pages to campaign Ocean.
- **Session-mode note**: the session-mode `❡ Profile / ⚔ Session` pill toggle remains in-page (it is mode state, not navigation), but its visual style must match the new menu/pill spec.

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
