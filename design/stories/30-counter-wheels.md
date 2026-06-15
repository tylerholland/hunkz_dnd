# Story 30 — Counter Wheels (Progress Clocks)

**Status**: Needs UX prototype
**Source**: DM request
**Brief**: `design/briefs/counter-wheels-brief.md`
**Prototype**: (leave blank — ux-designer fills this in)

---

## Goal

Give the DM ad-hoc radial segment counters — "clocks" / "wheels" in the Blades in the Dark sense — on the DM Campaign page (`/dm`). The DM uses them to track fictional progress that has no home in HP, conditions, or initiative: an alarm being raised, a ritual completing, a bridge collapsing, a patron's patience running out. The wheels are entirely DM-driven and manual — no automation, no rules enforcement — a visible memory aid the DM glances at between narration beats.

## User stories

- As the DM, I want to create as many counter wheels as I need (realistically 1–8 at once) so I can track several independent progress fronts in a scene.
- As the DM, I want to name each wheel (multi-word labels, wrapping is fine) so I know at a glance which clock is which.
- As the DM, I want to set the number of segments (2–12) when I create a wheel so the wheel's resolution matches the fiction.
- As the DM, I want to tap individual segments to fill or empty them so I can advance or wind back a clock manually, turn by turn.
- As the DM, I want to remove any wheel at any time, regardless of its fill state, so I can clear clocks that no longer matter.
- As the DM, I want to reset a wheel's filled segments back to empty so I can reuse it for a new instance of the same situation.
- As the DM, I want to rename a wheel after creating it so I can repurpose or correct it without deleting and recreating.
- As the DM, I want Reset and Remove tucked behind a hover/tap menu (not inline buttons) so the dashboard stays uncluttered.
- As the DM, I want wheels to persist across refreshes so I don't lose campaign state when the page reloads.
- As the DM, I want wheel creation to leave a light note in the shared activity log so the moment a clock starts is timestamped alongside the dice feed.

## Placement & behavior

- **Location**: a collapsible panel in the DM dashboard **left column**, positioned **below the Map Panel and above the party card strip** — visible without scrolling during combat.
- **Expand/collapse (mode-aware)**:
  - Adventure/exploration mode (initiative empty): collapsed by default; auto-expands if any wheels exist; the DM's manual toggle then wins until a mode transition.
  - Combat mode (initiative has entries): expanded by default.
  - An `+ Add Counter` affordance is reachable even while the panel is collapsed (tapping it expands the panel and opens the creation form).

## Functional requirements

- Wheels are SVG radial segment dials (full pie slices with constant-degree gaps). Empty segments: faint border, background-matching fill. Filled segments: `pal.gem` fill with a soft glow. Wheels are roughly square cells; label and `N/M` count sit below the wheel.
- 4–6 wheels fit per row at the ~400–600px left-column width; the grid reflows responsively.
- Tapping a segment toggles it (independent per-segment fill — gaps allowed). Optimistic update + debounced write.
- A per-wheel `⋯` menu (revealed on hover desktop / persistent-faint on touch) offers **Rename** (inline), **Reset** (clear all fills), and **Remove** (delete, no confirm by default).
- Creation is an inline form (not a modal): name input + segment stepper (2–12, default 6) + live mini-preview + Cancel/Create.
- A full wheel (`N/N`) shows a steady elevated glow and a one-time completion pulse; it remains reversible.

## Activity-log integration

- On **creation only**, append a light administrative entry to the shared `roll-history` feed: `◷ [Wheel name] — N segments`, styled distinctly from dice-roll rows (clock-glyph marker, no big numeric total). Tag the entry with a `type: "wheel"` discriminator so the history renderer branches to the note layout. Segment toggles, resets, renames, and removes are NOT logged.

## Persistence

- Wheels persist across refreshes. Conceptually an ordered array of `{ id, name, segments, filled }` where `filled` is **per-segment** (boolean array or filled-index array — not a single count, because non-contiguous fills are required). A new `slug: "counter-wheels"` sentinel is the clean home (campaign-scoped DM state; must NOT be wiped by "End Combat"). DM-auth writes; optimistic-write + adaptive-polling pattern (ADR-011). The architect finalizes the exact storage shape.

## Out of scope

- Editing segment count after creation (segment count is set once, immutable thereafter).
- Auto-advancing / rules-driven clocks (manual only).
- Per-wheel color categories (all wheels use the Ocean `pal.gem` accent in v1).
- Player visibility (DM-only; not surfaced to player sheets in this story).
- Logging anything other than creation to the activity feed.

## Open questions

- **Remove confirmation**: **Resolved: no confirmation.** The two-step UX of hover → menu opens → click Remove is sufficient gating. No inline confirm needed.
- **Single-segment wheels**: **Resolved: no minimum floor.** Segment count stepper minimum is 1. All segments start empty by default.
- **Fill semantics**: **Resolved: fill-to-here clockwise (Blades-classic).** Tap an empty segment → fills all segments from 12 o'clock up to and including that one. Tap a filled segment → unfills that segment and everything after it. Stored as `filledCount: number` (0..segments), not a boolean array.
- **Manual-toggle persistence vs. mode auto-default**: **Resolved: persist with optimistic sync.** Last manual toggle wins (stored in `dnd_wheels_open` sessionStorage). Segment writes use optimistic update + debounced patch, same as HP stepper.

---

## UX Design

**Brief**: `design/briefs/counter-wheels-brief.md`

### Scope summary

- **Tier**: Tier 2 (secondary/ambient). Below the Map Panel, above the party strip. Present in peripheral vision during combat; never competes with Tier-1 HP/condition reads. Sparse-first: zero wheels → near-zero footprint (header row only when collapsed).
- **Hierarchy**: filled segments (bright + glow) read first → wheel shapes → labels (Cinzel, 2-line wrap) → `N/M` count → panel chrome → `⋯` (hidden at rest) → `+ Add` tile.
- **Wheel SVG**: full pie slices, start at 12 o'clock, fill clockwise, constant 2–3° gaps. Empty = `surfaceSolid` fill + faint `border` stroke, no glow. Filled = `pal.gem` fill + `accentBright` stroke + soft `rgba(138,180,200,0.45)` glow. Small dark hub center. ~84–96px desktop, ~100–110px mobile (for 12-seg tap targets).
- **Toggle**: fill-to-here clockwise (Blades-classic). Tap empty segment N → `filledCount = N`. Tap filled segment N → `filledCount = N-1`. Stored as a single number. Optimistic + 300ms debounced write.
- **`⋯` menu**: Rename (inline label edit) · Reset (de-fill sweep, no confirm) · divider · Remove (red, no confirm by default). Popover in `surfaceSolid`, raises host cell above neighbors.
- **Creation**: inline form (no modal) — name input (autofocus, defaults to `Counter N`) + segment stepper 2–12 default 6 + live mini-preview + Cancel/Create. Reachable from the collapsed header `+ Add`.
- **Expand/collapse**: mode-aware (collapsed in adventure unless wheels exist; expanded in combat); last manual toggle wins until a mode transition; `dnd_wheels_open` in sessionStorage.
- **Motion**: 160ms segment fill (color + glow bloom + slice scale); 200ms empty (glow-out then fill-out); 420ms one-time completion pulse at `N/N` then steady bright; staggered 25ms/slice Reset sweep; 200ms create scale-in + 180ms reflow; 140ms remove + reflow; 220ms panel expand. All collapse to instant under `prefers-reduced-motion`.
- **Activity log**: creation-only `◷ [name] — N segments` note, typed for distinct (non-dice-row) rendering in the shared history feed.
- **Responsive**: 4–6/row at left-column width; 2–3/row + larger wheels on mobile; `⋯` persistent-faint on touch (no hover); creation form stacks vertically below 900px.
- **Data (conceptual)**: ordered `{ id, name, segments, filled[] }`; `filled` per-segment (not a count); new `slug: "counter-wheels"` sentinel; not wiped by End Combat; DM-auth write; ADR-011 optimistic + polling.

### Open questions for user

1. Remove confirmation — brief default is no-confirm single-tap delete; flagged as the only undo-less destructive action.
2. Single-segment wheels — stepper floor defaults to 2; lower to 1 (notched ring) if wanted.
3. Fill semantics — independent per-segment toggle (brief default) vs. Blades-classic fill-to-here; drives the `filled` data shape, confirm before architect.
4. Manual-toggle vs. auto-default collapse persistence — last manual toggle wins until mode transition (brief default).
