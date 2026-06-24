# Story 30 — Counter Wheels (Progress Clocks)

**Status**: Implemented
**Source**: DM request
**Brief**: `design/briefs/counter-wheels-brief.md`
**Prototype**: `design/prototypes/counter-wheels.html`

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
**Prototype**: `design/prototypes/counter-wheels.html`

### Scope summary

- **Tier**: Tier 2 (secondary/ambient). Below the Map Panel, above the party strip. Present in peripheral vision during combat; never competes with Tier-1 HP/condition reads. Sparse-first: zero wheels → near-zero footprint (header row only when collapsed).
- **Hierarchy**: filled segments (bright + glow) read first → wheel shapes → labels (Cinzel, 2-line wrap) → `N/M` count → panel chrome → `⋯` (hidden at rest) → `+ Add` tile.
- **Wheel SVG**: full pie slices, start at 12 o'clock, fill clockwise, constant 2–3° gaps regardless of segment count (2–12 keeps the same visual rhythm). Empty = `surfaceSolid` fill + faint `border` stroke, no glow. Filled = `pal.gem` fill + `accentBright` stroke + soft `rgba(138,180,200,0.45)` glow. Small dark hub center (~18% radius) with low-opacity `accent` ring. ~84–96px desktop, ~100–110px mobile (for 12-seg tap targets ≥44px).
- **Fill model (resolved)**: fill-to-here clockwise (Blades-classic), not independent per-segment toggle. A single `filledCount: number` (0..segments) drives the render — segments 1..filledCount are filled, contiguous from 12 o'clock. Tap empty segment N → `filledCount = N`. Tap filled segment N → `filledCount = N-1`. Optimistic update, 300ms debounced write (same pattern as the HP stepper).
- **Segment floor (resolved)**: minimum is 1 segment. A 1-segment wheel renders as a full ring with a 2–3° notch at 12 o'clock and behaves as a binary toggle (tap fills, tap again empties). The prototype's *creation form* stepper itself still floors at 2 per the brief's explicit §4f wireframe — flagged as an unresolved tension between the open-question answer (floor=1) and the form spec (2–12) in an inline ambiguity note in the prototype; feature-builder/architect should confirm which wins for the live stepper before implementation.
- **`⋯` menu**: Rename (inline label edit, autofocus + select-all, commit on Enter/blur, Esc reverts) · Reset (clockwise de-fill sweep staggered 25ms/segment, no confirm) · divider · Remove (red `#c06060`, no confirmation — resolved open question). Popover in `surfaceSolid`, anchored below-right of the `⋯` trigger, flips up near the panel's bottom edge, raises the host wheel cell's z-index above neighbors so it's never clipped (same pattern as the party-card `⋯` popover). Closes on outside click, Esc, or action selection.
- **Creation**: inline form (no modal), inserted at the top of the grid (pushes existing wheels down) — name input (autofocus, placeholder example, empty-on-submit defaults to `Counter N`) + segment stepper 2–12 default 6 (steppers visually disable at bounds, `opacity 0.4`) + live ~40px mini-preview that re-renders on every stepper change + Cancel/Create Wheel. Reachable from the collapsed header's `+ Add` shortcut (which expands the panel first) and from the grid's dashed Add tile.
- **Expand/collapse (mode-aware, resolved)**: collapsed by default in adventure mode unless ≥1 wheel exists (auto-expands); expanded by default in combat mode. The DM's last manual toggle wins until a mode transition re-applies the default — persisted via `dnd_wheels_open` in `sessionStorage`. A count-badge (`N active`) appears in the collapsed header once wheels exist, as the passive nudge to re-expand. `+ Add` remains reachable from the collapsed header at all times.
- **Motion** (all collapse to instant under `prefers-reduced-motion`):
  - Segment fill: 160ms ease-out — color fade-in + glow bloom + 0.92→1.0 scale of that slice.
  - Segment empty: 200ms total ease-in — 90ms glow collapse then 110ms fill fade-out.
  - Wheel completes (`N/N`): one-time 420ms ease-in-out pulse (glow opacity 0.45→0.9→0.6, scale 1.0→1.04→1.0), then holds at a steady elevated glow state — calm, not alarming (distinct from Tier-1 danger flashes).
  - Reset: clockwise de-fill sweep, each filled slice emptying staggered 25ms from 12 o'clock; total duration 90ms + 25ms × filledCount.
  - Wheel created: cell scales 0.7→1.0 + opacity 0→1 over 200ms, existing cells reflow over 180ms, both ease-out.
  - Wheel removed: cell scales 1.0→0.8 + opacity 1→0 over 140ms, then reflow 180ms.
  - Panel expand/collapse: max-height + opacity, 220ms ease-out (matches Map Panel treatment).
  - Count badge appears: opacity 0→1 + slight x-slide, 150ms ease-out.
  - `⋯` reveal on hover: opacity 0→1, 120ms ease-out (desktop only — persistent-faint at 0.5 opacity on touch, no hover state).
- **Activity log**: creation-only entry, `◷ [name] — N segments`, clock glyph in `pal.accent`, name in `pal.text`, segment count in `pal.textMuted`, no numeric total — visually distinct from dice rows in the shared feed so it reads as an administrative note, not another roll. Tagged `type: "wheel"` for the history renderer to branch on.
- **Responsive**: desktop/left-column (~400–600px) uses `repeat(auto-fill, minmax(96px, 1fr))` → 4–6 wheels/row, `⋯` reveals on hover. Mobile (<900px stack, ~320–560px) relaxes to `minmax(110px, 1fr)` → 2–3 wheels/row with larger ~100–110px wheels so 12-segment slices keep ≥44px tap zones; `⋯` persistent-faint (no hover); creation form stacks vertically.
- **Edge cases covered in the prototype**: zero wheels (collapsed = header only; expanded = single Add tile, calm intentional empty state) · max segments (12, `+` stepper disables) · min segments (1, notched ring, binary toggle) · long multi-word label (2-line clamp + ellipsis, wheel never resizes to fit) · empty name at creation (defaults to `Counter N`) · empty name on rename (reverts to prior name) · many wheels (8 shown; panel body caps at `min(40vh, 360px)` with internal scroll so Tier 2 content never crowds the Tier-1 party strip below it) · full wheel reversibility (tapping any segment of a full wheel still unfills normally).
- **Data (conceptual)**: ordered `{ id, name, segments, filledCount }` — `filledCount` is a single number per the resolved fill-semantics question, not a per-segment array. New `slug: "counter-wheels"` sentinel; not wiped by End Combat; DM-auth write; ADR-011 optimistic + polling pattern.

### Implementation flags for code-architect / feature-builder

1. **Stepper floor mismatch**: the resolved open question sets the segment minimum at 1, but the brief's creation-form wireframe (§4f, item ⑰) explicitly states "Range 2–12, default 6" for the *stepper*. The prototype keeps the live creation stepper at floor=2 and only demonstrates floor=1 on a pre-seeded (already-created) wheel, with an inline ambiguity note flagging this for confirmation. Decide whether the create-form stepper should also floor at 1, or whether 1-segment wheels are only reachable via some other path (unlikely — there's no other creation path in the brief). Recommend defaulting the stepper floor to 1 to match the resolved open question, unless there's a reason 2 was chosen deliberately for the form.
2. **Backend data shape**: story's "Persistence" section (above) still describes `filled` as a per-segment array ("not a single count, because non-contiguous fills are required") — this predates the brief's resolution to Blades-classic fill-to-here and is now stale. The correct shape per the resolved open question and brief §10 is `filledCount: number`. The architect should treat the brief and this UX Design section as authoritative over the story's older "Persistence" prose.

---

## Architect Notes

**Applies**: ADR-003 (DynamoDB flat schema / sentinel items), ADR-004 (one Lambda per HTTP op), ADR-005 + ADR-007 (DM auth via `x-character-password` header), ADR-011 (optimistic write + adaptive polling), ADR-014 (CSS custom-property classes, no `<style>` injection). New: **ADR-015** (typed roll-history entries) and **ADR-016** (`counter-wheels` sentinel) added for this story.

**Tech approach**: This is a clean copy of the `npc-library` sentinel pattern, nothing new architecturally. Backend: add `COUNTER_WHEELS_SLUG = "counter-wheels"` to `backend/src/lib/specialItems.js` and include it in `RESERVED_CHARACTER_SLUGS` (this is what filters it out of `list.js`/`dmParty.js` — easy to forget). Add `getCounterWheelsState()` / `saveCounterWheelsState()` / `normalizeCounterWheelsRecord()` to `specialRecords.js` (mirror the NPC-library trio). Add two DM-auth handlers, `getCounterWheels.js` (copy `getNpcLibrary.js` almost verbatim) and `putCounterWheels.js` (copy `putNpcLibrary.js` — validate `Array.isArray(body.wheels)`, full-array replacement), wired into `template.yaml` as `GET /counter-wheels` and `PUT /counter-wheels`. Stored shape is `{ wheels: [{ id, name, segments, filledCount }] }` with `filledCount: number` (0..segments) — **single count, not a boolean array** (the story's old "Persistence" prose is stale per implementation flag #2; the brief/UX section win). Frontend: this is a new `src/features/dmDashboard/` slice (a `CounterWheelsPanel.jsx` plus a `counterWheels.css` and the SVG wheel builder — keep `segPath`/`polar`/`buildWheelSVG` as pure module functions ported from the prototype `<script>`). `DmDashboardPage.jsx` owns the fetch/poll and the optimistic-write orchestration; the panel is a presentational+local-interaction child. Add `getCounterWheels`/`putCounterWheels` to `src/api.js` next to the `getNpcLibrary`/`putNpcLibrary` pair. **Port the prototype's SVG math, not its DOM**: the prototype rebuilds SVG via `innerHTML`/`outerHTML` string swaps and global mutable `wheelStores` — that is throwaway demo code. In React, segments are derived from `filledCount` and rendered declaratively; do not replicate the imperative `updateWheelVisual` swap. **CSS per ADR-014**: the prototype's `<style>` block and runtime keyframes must move into a static `counterWheels.css`; only the SVG slice `fill`/computed glow and the panel `max-height` toggle stay inline-dynamic. **Roll-history note (ADR-015)**: creation appends a `type: "wheel"` entry; do NOT route it through `postCharacterRoll`/`postDmRoll` — their validation rejects total-less payloads. Append it as part of (or immediately alongside) the wheel-create `PUT`, and branch `RollHistoryRow` on `entry.type` for the note layout. **sessionStorage** key `dnd_wheels_open` (no slug suffix — DM dashboard has no character context, same as `dnd_dice_dm_open`) holds the manual collapse override.

**Scope boundary**:
- **In**: `counter-wheels` sentinel + 2 handlers + 2 api.js functions; collapsible panel in DM left column below Map Panel / above party strip; create (inline form, name + 1–12 segment stepper), fill-to-here clockwise toggle, rename (inline), reset, remove (no confirm); mode-aware default expand (combat=expanded, adventure=collapsed-unless-wheels-exist) with `dnd_wheels_open` manual override; creation-only `type: "wheel"` roll-history note + `RollHistoryRow` branch.
- **Out** (resist even though tempting): editing segment count after creation; auto-advancing/rules-driven clocks; per-wheel color categories (Ocean `pal.gem` only); any player-sheet surfacing/visibility; logging anything but creation; per-wheel optimistic-marker reconciliation as sophisticated as the HP field-level merge in `liveSync.js` (see Performance note — a simpler debounced-flush is sufficient here).
- **Stepper floor decision (implementation flag #1)**: ship the live create-form stepper with **floor = 1** to match the resolved open question (a 1-segment wheel is a valid binary clock and has no other creation path). The prototype's form floors at 2 only because of a stale brief wireframe; the prototype already demonstrates the 1-segment notched-ring render. Builder: set min to 1.

**Optimistic write with rollback**: Segment taps and panel toggles must follow the full try/undo/complete pattern: (1) apply change to local state immediately so the UI responds without waiting for the network, (2) fire the debounced `PUT`, (3) on success do nothing (local state is already correct), (4) **on failure, revert local `wheels` state to the last server-confirmed snapshot and re-render** — the DM must not be left with phantom state after a network error. Keep a `lastConfirmedWheels` ref updated on every successful PUT response; that is what rollback restores.

**Palette-aware segment colors**: The prototype hardcodes hex values for the radial gradient (`#bfd4e0` inner, `#5c8ba4` outer). In the real implementation all segment colors must use `--pal-*` CSS custom properties so they track the DM's selected theme. Mapping: filled segment gradient inner → `var(--pal-accent-bright)`, outer → `var(--pal-accent)`. Empty segment fill → `var(--pal-surface-solid)` (or nearest `--pal-*` equivalent). Glow → `var(--pal-gem)` at low opacity. The SVG `<radialGradient>` stops must use `stop-color: var(--pal-accent-bright)` etc., not hardcoded hex — modern browsers support CSS custom properties in SVG `stop-color`. The completed-wheel gold (`#e4d3b5` / `#f2e8d2` → `#c8ae84`) is intentionally a fixed warm gold (state-change signal, not palette-derived) and may stay hardcoded.

**Performance notes**: Wheel writes do NOT need the full field-level optimistic-merge machinery from `liveSync.js` (which exists to reconcile concurrent HP edits between DM and player). Counter wheels are single-writer (DM only) and DM-only-visible — there is no second editor to race against. Use the simpler pattern: optimistic local state on tap, a ~300ms debounced full-`wheels`-array `PUT`, and let the next poll reconcile. Re-render scope is small (≤8 wheels, ≤12 segments) so no memoization concern. One caveat: because `PUT` is full-array replacement, a debounced write must always send the latest full array (not a stale snapshot captured at debounce-schedule time) — same stale-base rule as ADR-011's HP flush.

**Cost notes**: No new AWS resources beyond two more Lambdas (still within the ADR-004 "~15 handler" comfort revisit threshold — note handler count is already past 21, so this nudges the `template.yaml` maintenance cost flagged in ADR-004; not blocking, just logged). DynamoDB: one extra item, PAY_PER_REQUEST, polled by the single DM client only — effectively zero cost at current scale. No S3, no new gateway integrations beyond the two routes.

**Polling**: confirm whether the DM dashboard should poll `GET /counter-wheels` on the ADR-011 cadence, or fetch-on-mount + refetch-after-write only (like `npc-library`, which CLAUDE.md notes is "fetched on dashboard mount, not polled"). Recommendation: **fetch-on-mount + immediate refetch after each write, no interval poll** — wheels are single-writer DM state, so there is no remote mutation source to poll for. This is cheaper and matches the `npc-library` precedent. Flagging as a decision rather than assuming.

**Dependencies**: None hard. The `RollHistoryRow` `type` branch (ADR-015) is the only cross-cutting change — it touches the shared roll feed renderer used by both the DM dashboard and character sheets, so verify the existing dice rows render unchanged (regression spot-check `RollHistoryList.test`-style coverage if present). The "must survive End Combat" constraint (ADR-016) depends on the builder NOT adding `counter-wheels` to whatever clears `initiative`/`npc-combat` — there is no shared teardown helper to wire it into, so this is an omission to maintain, not code to write.

**Risks / decisions needed**:
1. **Polling vs. fetch-on-mount** for `GET /counter-wheels` — see Polling note above; recommend fetch-on-mount only. Confirm before building.
2. **Stepper floor 1 vs 2** — recommend 1 (resolved open question); confirm the form should expose it.
3. **Roll-history note write path** — recommend appending the `type: "wheel"` event inside the same DM-auth flow as the create write rather than adding a third roll-history POST endpoint. Confirm no separate endpoint is desired.
4. Most-likely implementation pitfall: porting the prototype's imperative SVG-string mutation into React instead of rendering segments declaratively from `filledCount`. Call this out to the feature-builder explicitly.
