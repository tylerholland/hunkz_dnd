# Feature Story: Shared Top Nav & Consistent Menu Language

**Status**: Implemented (2026-07-20)
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
- (2026-07-19, after prototype review) The mode switch is a **segmented control**, not two adjacent buttons: one capsule with fully rounded outer ends, active half filled, inactive half quiet. Less "button-y", reads as state.
- (2026-07-19) Battle Mode stays **in-panel** on the DM map (it's shared world state on the active map — flips `mapMode` for everyone — not a view mode), but adopts the same segmented-control primitive: `Adventure | Battle`.
- **(2026-07-20, superseding the note above)** Move the `Adventure | Battle` segmented control into the DM dashboard's TopNav **center slot** instead — same slot pattern as Profile/Session on character surfaces, same segmented-control primitive. Visible labels read **`Adventure | Combat`** (the underlying `mapMode` value stays `"battle"` in code/API — display label only). This replaces `BattleModeToggle.jsx`'s current placement inside `MapPanel.jsx`; the toggle should be lifted out of the map panel and driven from `DmDashboardPage.jsx`'s TopNav instance, wired to the same `putMapActive`/`patchMapTokens` mapMode state `MapPanel.jsx` already owns.
- **(2026-07-20)** `Manage Party` is not high-frequency enough to earn a dedicated bar button — move it into the DM dashboard's ⋯ context menu, alongside the merged All Actions items.

## UX Design

- **Anatomy** (single row, 52px, sticky, `--pal-bg` with bottom `--pal-border`), same slots on every page:
  - **Left**: quiet back glyph `‹` (44px target, `--pal-text-muted`, brightens on hover; hidden on the library root) followed by the **page title** — Cinzel small-caps ~15px, `--pal-text`: "Character Library", character name on character surfaces, "Campaign" on `/dm`, "Map Library" on `/maps`. The title is identity, not a button.
  - **Center**: mode switch where a mode exists — a **segmented control**: single capsule (fully rounded outer ends, 1px `--pal-border`), two halves separated by a hairline; active half filled with a `--pal-accent` tint + `--pal-text`, inactive half transparent + `--pal-text-muted`; visually slim (~30–32px tall) with the touch target extended to ≥44px via padding/pseudo-element, not visual height. `❡ Profile / ⚔ Session` on character surfaces; `Adventure | Combat` on the DM dashboard (drives the existing `mapMode` state — `"adventure"`/`"battle"` — currently owned by `MapPanel.jsx`'s `BattleModeToggle.jsx`, lifted up into the header control; `BattleModeToggle.jsx`'s in-panel placement is removed so there is one control, not two). Desktop only; on mobile it drops to the existing second row.
  - **Right**, fixed order: **Live/Polling dot** (live surfaces only) · **open-book World Guide trigger** (all surfaces incl. session mode — currently missing there) · **⋯ context menu**.
- **⋯ context menu** (one popover spec everywhere): anchored dropdown, `--pal-surface-solid` panel, 8px radius, 40px rows, 13px IM Fell English labels, destructive rows `#c06060`, 1px `--pal-border` dividers. Contents by context:
  - Character surfaces: Export JSON · All Characters · (DM-authed: Campaign) — Edit Character is NOT here; it moves into the profile page body (Story 42 surface).
  - Library (anon): DM Login. Library (DM): Campaign · Maps · divider · End Session — replaces the second-row ghost links.
  - DM dashboard: the existing All Actions dropdown merges into this menu (same spec, same anchor position), plus **Manage Party** (2026-07-20: demoted from a dedicated bar button — not high-frequency enough to earn permanent chrome).
- **Back glyph targets**: library ← none; character surfaces ← library; `/dm` ← library; `/maps` ← `/dm`; map viewer keeps its `← Close Map Window` variant (popout window — exempt from the shared bar but adopts the same typography).
- **Mobile (<560px)**: `‹` + title left, dot + book + ⋯ right; nothing else. Minimum 44px touch targets throughout; no horizontal overflow at 375px.
- **Palette**: nav inherits the surface's palette via the existing `--pal-*` cascade — character pages tint to the character palette, DM pages to campaign Ocean.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- **New** `src/components/TopNav.jsx` + `src/components/topNav.css` (ADR-014: static CSS file, `--pal-*` variables, no runtime style injection). Props: `{ pal, backTo, backLabel, title, children (page-specific right-slot actions), menuItems }`. Export a `NavMenu` popover primitive reusable for other menus.
- **Adopt page-by-page** in one story: `CharactersListPage`, `CharacterPage` (view-mode top bar), `CharacterModePage`, `DmDashboardPage`, `MapLibraryPage`, `MapViewerPage`. Remove each page's bespoke bar; keep page-specific controls by passing them as children (e.g. Export JSON on the sheet via the ⋯ menu).
- **DM dashboard `Adventure | Combat` control**: `src/features/dmDashboard/battleMode/BattleModeToggle.jsx` currently renders inside `src/features/dmDashboard/MapPanel.jsx` and toggles `mapMode` (persisted via `patchMapTokens`/`putMapActive` — check `MapPanel.jsx` for the exact call and state it currently owns). Reuse `BattleModeToggle.jsx`'s existing state-toggle logic but re-render it through the new segmented-control primitive in `DmDashboardPage.jsx`'s TopNav center slot instead of inside `MapPanel.jsx`; the map panel keeps reading `mapMode` (as a prop from the page) but no longer renders its own toggle. Confirm in `MapPanel.test.jsx` whether tests assert the toggle's in-panel presence and update accordingly.
- **`Manage Party`**: remove its dedicated top-bar button on `DmDashboardPage.jsx`; add it as a `menuItems` entry in the shared ⋯ menu alongside the merged All Actions items.
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
