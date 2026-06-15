# Counter Wheels (Progress Clocks) — Design Brief

> Story 30. Ad-hoc radial segment counters ("clocks" / "wheels", à la Blades in the Dark) on the DM Campaign page. The DM creates named wheels with 2–12 segments, fills/empties segments by tap, and manages them via a hover/tap menu. Collapsible panel in the left column, below the Map Panel, above the party strip.
>
> Produced by design-strategist. Implementation spec for ux-designer.
>
> Palette: Ocean (DM dashboard chrome) — `bg #0d0f14`, `accent #6a8fa8`, `gem #8ab4c8`, `accentBright #a0c0d0`. Fonts: Cinzel (display), IM Fell English (UI labels), Crimson Text (body).

---

## 1. Design intent

A counter wheel is a thing the DM *fills as fiction advances* — the alarm being raised, the ritual completing, the bridge collapsing, the patience of a duke running out. The emotional goal is **anticipation made visible**: an at-a-glance read of "how close is the bad (or good) thing." The wheel should feel like a dial on an instrument panel, not a checkbox list — circular, deliberate, slightly ominous when nearly full.

**Mental model**: a pie that fills clockwise. Each tap is a turn of the screw. The DM owns it entirely — manual, no automation, no rules enforcement. It is a memory aid the DM glances at between narration beats, never a thing they fight with.

**Functional goal**: zero-friction toggling, near-invisible chrome. Creating, filling, and removing a wheel must all happen in-place on the dashboard with no modal, no route change, no context loss. Wheels that don't exist cost nothing; a healthy "no clocks running" dashboard shows a single quiet add affordance.

---

## 2. Information tier declaration

Per the Story 16 tier doctrine, Counter Wheels are **Tier 2 — secondary, ambient**. They are *not* combat-critical like HP and conditions (Tier 1), but they are more session-relevant than on-demand notes (Tier 3). This dictates their placement and weight:

- They sit **below** the Map Panel and **above** the party card strip — present in peripheral vision during combat but never competing with HP/condition reads.
- A nearly-full wheel earns a glow nudge (ambient escalation) but never a flash, shake, or sound — those belong to Tier 1 danger states only.
- In the collapsed state they contribute one header row of height. The sparse-first rule applies: no wheels → near-zero footprint.

---

## 3. Information hierarchy

Within the expanded panel, the eye should land in this order:

1. **Filled segments of each wheel** — the bright accent-gem arcs are the highest-contrast element. The DM's eye is drawn to *how full* each wheel is, which is the entire point.
2. **The wheel shapes themselves** (empty rings) — establish the grid and the denominator ("how many segments total").
3. **Wheel labels** — Cinzel, directly below each wheel. Read second, after the visual fill state. You glance at fill, then read the name to know *which* clock that is.
4. **Panel header** ("Counter Wheels" + count badge + collapse chevron) — orienting chrome, low weight.
5. **The `⋯` per-wheel menu trigger** — hidden until hover/tap. Zero weight at rest by design.
6. **`+ Add Counter` affordance** — quiet dashed/ghost tile at the end of the grid. Discoverable, never loud.

**Competition resolution**: filled segments and labels both want attention. Filled segments win the *first* glance (color + glow); labels win the *second* (the DM already knows the shape, now needs the name). We enforce this by giving fill high chroma + glow and giving labels muted-but-legible Cinzel — present, never shouting. A label never out-competes its own wheel's fill.

---

## 4. Annotated wireframes

### 4a. Collapsed — adventure mode, zero wheels (sparse-first default)

```
┌──────────────────────────────────────────────────────────┐
│ ① ◷ COUNTER WHEELS                          ② + Add   ⌄ ③ │
└──────────────────────────────────────────────────────────┘
```

① **Panel header label** — `◷` clock glyph + "COUNTER WHEELS" in IM Fell English, 12px, uppercase, `letter-spacing 0.22em`, `pal.textMuted`. Matches the Map Panel header treatment exactly so the two collapsibles read as siblings. The `◷` glyph in `pal.accent` at rest.

② **`+ Add` shortcut** — reachable *while collapsed*. Tapping it expands the panel AND immediately opens the inline creation form (see 4f). IM Fell English 11px, `pal.accent`, hover → `pal.accentBright`. 44px touch height. This is the "Add Counter button accessible even when collapsed" requirement.

③ **Collapse chevron** — `⌄` / `⌃`, 44px tap target, far right. `pal.textMuted`, hover → `pal.accent`. Rotates 180° on toggle. Tapping anywhere on the header bar (except the `+ Add` zone) also toggles.

### 4b. Collapsed — wheels active (count badge)

```
┌──────────────────────────────────────────────────────────┐
│ ◷ COUNTER WHEELS  ④ 3 active                  + Add   ⌃   │
└──────────────────────────────────────────────────────────┘
```

④ **Count badge** — small pill `④ N active`. IM Fell English 11px, `pal.accentBright` text, `pal.accentDim` background, border `pal.accent`, radius 3px. Shown only when ≥1 wheel exists. Communicates "there are clocks running, you have them collapsed" — a passive nudge to expand. When the panel auto-expands (combat / has-wheels), this badge is not needed inside the open panel header (the wheels themselves are the count).

### 4c. Expanded — populated grid (the common live state)

```
┌──────────────────────────────────────────────────────────┐
│ ◷ COUNTER WHEELS                              + Add   ⌃   │
│ ────────────────────────────────────────────────────────  │
│   ⑤            ⑥⋯          ⑤            ⑤                  │
│  ╭────╮       ╭────╮       ╭────╮       ╭────╮             │
│ │ ◜◝ ◞◟│     │ ███◜◝│     │ ████│     │ ◜◝ ◞◟│            │
│ │◜    ◝│     │██   ◝│     │█████│     │◜    ◝│            │
│ │◟    ◞│     │██   ◞│     │█████│     │◟    ◞│            │
│  ╰────╯       ╰────╯       ╰────╯       ╰────╯             │
│  ⑦ Alarm     The Ritual    Bridge      Duke's            │
│   Raised      Completes    Holds       Patience          │
│   ⑧ 0/6        4/8          6/6 ⑨       2/4               │
│                                                            │
│   ⑩ ┌──────┐                                               │
│     │  +   │   (add tile — last cell in the grid)          │
│     └──────┘                                               │
└──────────────────────────────────────────────────────────┘
```

⑤ **Wheel cell** — roughly square. SVG wheel occupies the top ~78%, label + count below. Cells flow in a responsive grid: `repeat(auto-fill, minmax(96px, 1fr))`, `gap 14px`. At the ~400–600px left-column width this yields **4–6 wheels per row** (target met). Each wheel SVG is ~84–96px diameter.

⑥ **`⋯` menu trigger** — appears top-right of a wheel cell on hover (desktop) or persistently faint on touch. Same glyph and behavior as the party-card `⋯`. 24px visible / 44px tap target. Opens the per-wheel menu (4e). Only the hovered wheel shows its `⋯`.

⑦ **Wheel label** — Cinzel, 13–14px, `pal.text`, centered, `line-height 1.25`. **Wraps to a max of 2 lines**, then ellipsis on the 2nd. Multi-word labels are expected and supported. Sits directly under the wheel.

⑧ **Segment count readout** — `0/6`, `4/8`, etc. IM Fell English, 11px, `pal.textMuted`, centered below the label. Ambient denominator: tells the DM the fill ratio numerically without counting arcs. This is the lightest text on the cell.

⑨ **Full-wheel state** — when `filled === segments` (e.g. `6/6`), the entire ring gets a steady (non-pulsing) elevated glow and the count readout shifts to `pal.accentBright`. Communicates "this clock has gone off." Calm, not alarming — it's the DM's tool firing, an expected event, not a danger Tier 1 flash. (See §6 for the one-time completion animation.)

### 4d. The SVG wheel itself — segment geometry

```
        segment gap (2–3°)
            ╲
     ┌───────┴───────┐
     │   ███████     │   ← filled segment: pal.gem fill,
     │  █████████    │      faint accent stroke, soft glow
     │ ████│   ◜◝    │
     │ ████│      ◝  │   ← empty segment: bg-matching fill
     │ ████│      ◞  │      (pal.bg / surfaceSolid), faint
     │  ████   ◞◟    │      pal.border stroke, NO glow
     │   ████ ◞      │
     └───────────────┘
       hub: small dark
       center disc, faint
       accent ring
```

**Segment construction** — each segment is an SVG `<path>` full pie slice (center to rim). Full pie slices are preferred over thin annular arcs — fewer gaps, bolder fill read at small sizes, and maximal tap target area. Segments start at 12 o'clock and fill **clockwise**.

- **Empty segment**: `fill` = `pal.surfaceSolid` (reads as the panel background), `stroke` = `pal.border` at ~1px, `stroke-opacity 0.6`. No glow.
- **Filled segment**: `fill` = `pal.gem` (`#8ab4c8`), `stroke` = `pal.accentBright` ~1px, plus a soft `drop-shadow`/`feGaussianBlur` glow tuned to `rgba(138,180,200,0.45)`, blur radius ~3px. The glow is per-segment but reads as a unified luminous arc when several adjacent segments are filled.
- **Gaps**: 2–3° of empty space between every segment (achieved by insetting each path's start/end angle). Gaps are what make it read as a *clock* and not a solid donut. Keep gaps constant in degrees regardless of segment count — a 12-seg wheel has thinner slices but the same visual rhythm.
- **Hub**: a small central disc (~18% of radius), `fill pal.bg`, thin `pal.accent` ring at low opacity. Gives the wheel a dial-like center and a visual anchor. Recommended.
- **Single-segment wheel (segments === 1)**: renders as a full ring with a 2–3° notch at 12 o'clock. Tapping the ring sets `filledCount = 1` (fill); tapping again sets `filledCount = 0` (unfill). Binary clock.

⑩ **Add tile** — the final cell in the grid (after the last wheel). Dashed `pal.border` border, radius 4px, centered `+` glyph in `pal.textMuted`. Same square footprint as a wheel cell so the grid stays even. Hover → border `pal.accent`, `+` → `pal.accentBright`. Tap opens the inline creation form (4f). When zero wheels exist and the panel is expanded, this tile is the only content (plus the header) — a calm, intentional empty state, not a void.

### 4e. Per-wheel menu (`⋯` popover)

```
        ╭────╮
       │ ███ │  ⋯ ← tap
        ╰────╯
        ┌──────────────┐
        │ ✎ Rename     │ ⑪
        │ ↺ Reset      │ ⑫
        │──────────────│
        │ ✕ Remove     │ ⑬
        └──────────────┘
```

⑪ **Rename** — converts the label below the wheel into an inline text input (in place; no modal). See §5 rename flow.

⑫ **Reset** — clears all filled segments to empty in one action. Single tap, no confirm (it's cheap to refill, and Reset is itself the undo of over-filling). The wheel empties with a brief de-fill animation (§6).

⑬ **Remove** — deletes the wheel entirely, *regardless of fill state* (requirement). Single tap, **no confirmation** — consistent with the NPC ability-remove and condition-chip patterns elsewhere (re-creating a wheel is a few taps; a confirm step is friction the DM doesn't want mid-session). Destructive styling: `✕` and label in universal error red `#c06060`. Separated from Rename/Reset by a thin divider so it isn't tapped by accident. *(See Open Questions — if the DM wants a confirm on Remove, it's a one-line change; brief default is no-confirm.)*

Popover styling: `pal.surfaceSolid` background, `pal.border` border, radius 4px, ~9px padding, rows 36–44px tall, IM Fell English 12px. Anchored to the `⋯` trigger, opens below-right, flips up if near the panel bottom edge. Closes on outside tap / Esc / action selection. Raises the host wheel cell above neighbors (z-index) so it isn't clipped — same pattern as the party card popover.

### 4f. Inline creation form

```
┌──────────────────────────────────────────────────────────┐
│  NEW COUNTER WHEEL                                    ⑭ ✕  │
│  ⑮ ┌────────────────────────────────────┐                 │
│     │ Name (e.g. The Ritual Completes)   │                 │
│     └────────────────────────────────────┘                 │
│  ⑯ SEGMENTS    [ − ]   ⑰ 6   [ + ]    ⑱ (preview ◷ 6)     │
│  ────────────────────────────────────────────────────────  │
│                          ⑲ [ Cancel ]   [ ⑳ Create Wheel ] │
└──────────────────────────────────────────────────────────┘
```

The form expands **in place** at the top of the wheel grid (or replaces the Add tile, pushing the grid down) — never a modal overlay.

⑭ **Close** — `✕`, dismisses the form without creating.
⑮ **Name input** — `.input-base` styling, Crimson Text 15px, autofocus on open. Placeholder shows an example. Empty name defaults to "Counter N" (see §5) — we don't block the DM on naming.
⑯ **Segments label** — IM Fell English 11px uppercase, `pal.textMuted`.
⑰ **Segment count** — Cinzel number, `pal.gem`, flanked by `−` / `+` steppers (`.btn-stepper`, 32px circles). Range **2–12**, default **6**. Steppers clamp at bounds and visually disable at the limit (`opacity 0.4`).
⑱ **Live mini-preview** — a small (~40px) empty wheel rendering the chosen segment count, updating as the stepper changes. Lets the DM *see* "8 slices" before committing.
⑲ **Cancel** — `.btn-ghost`, closes form, no wheel created.
⑳ **Create Wheel** — `.btn-primary` (accent-tinted). Creates the wheel (all segments empty), closes the form, new wheel animates into the grid (§6). Also writes the activity-log entry (§7).

---

## 5. Interaction model

### Toggle a segment (fill-to-here clockwise)
- **Model**: Blades-classic. Segments fill clockwise from 12 o'clock. The wheel stores a single `filledCount: number` (0..segments) — segments 1..filledCount are filled, the rest are empty. No gaps; the filled arc is always contiguous.
- **Trigger**: tap any segment of a wheel.
- **Fill**: tap an empty segment at position N → set `filledCount = N` (fills all segments up to and including N).
- **Unfill**: tap a filled segment at position N → set `filledCount = N - 1` (unfills N and everything after it).
- **Optimistic**: SVG updates instantly on tap, network write debounced ~300ms. Same pattern as HP stepper.
- **Touch target**: full pie slices (center-to-rim) maximize the tappable area. For high segment counts (≥10), segment hit-paths extend slightly into the gap so there are no dead zones.

### Reset
- **Trigger**: `⋯` → Reset.
- **Response**: all filled → empty with a de-fill animation; one debounced write.

### Rename (post-creation)
- **Trigger**: `⋯` → Rename.
- **Response**: the label below the wheel becomes an inline text input, pre-filled with the current name, text selected, autofocused. The wheel above stays put.
- **Commit**: Enter, or blur (tap away). Empty-on-commit reverts to the prior name (never let a wheel become nameless via rename).
- **Cancel**: Esc reverts to the prior name, exits edit.

### Create
- **Trigger**: `+ Add` (header, even when collapsed) or the Add tile.
- **Response**: inline form (4f). Collapsed panel expands first if needed.
- **Commit**: Create Wheel → new wheel appended to the grid, animates in, activity-log entry written.

### Remove
- **Trigger**: `⋯` → Remove. Single tap, no confirm (brief default).
- **Response**: wheel animates out (§6); grid reflows.

### Expand / collapse logic (mode-aware)
- **Adventure/exploration mode** (initiative empty): panel **collapsed by default**. Auto-expands if ≥1 wheel exists. If the DM manually collapses it, respect that for the session (`dnd_wheels_open` in sessionStorage; manual toggle overrides until mode changes).
- **Combat mode** (initiative has entries): panel **expanded by default**.
- The auto rules set the *default*; the user's last manual toggle wins until a combat↔adventure transition re-applies the default.
- `+ Add` is always reachable from the collapsed header.

---

## 6. Motion & animation spec

All durations assume `prefers-reduced-motion: no-preference`; under reduce, every animation below collapses to an instant state change.

**Segment fills (tap empty → filled)**
- Fill color fades in + glow blooms + subtle scale of that slice (0.92→1.0 about the wheel center)
- Duration: 160ms, ease-out cubic

**Segment empties (tap filled → empty)**
- Glow collapses (90ms) then fill fades to empty (110ms)
- Duration: 200ms total, ease-in

**Wheel completes (last empty → full)**
- After the normal 160ms segment fill, a ONE-TIME ring pulse: whole-wheel glow opacity 0.45→0.9→0.6 + 1.0→1.04→1.0 scale, then HOLD at elevated steady-glow state
- Duration: 420ms pulse, ease-in-out, fires once (not looping)

**Reset**
- All filled segments de-fill in a clockwise sweep — each filled slice empties staggered 25ms from 12 o'clock around
- Duration: 90ms + (25ms × filledCount), ease-in

**Wheel created**
- New cell scales 0.7→1.0 + opacity 0→1; existing cells reflow
- Duration: 200ms cell-in, 180ms reflow, ease-out

**Wheel removed**
- Cell scales 1.0→0.8 + opacity 1→0 (140ms), then remaining cells reflow (180ms)

**Panel expand / collapse**
- max-height + opacity transition on the panel body (matches Map Panel treatment)
- Duration: 220ms, ease-out

**Count badge appears (collapsed, first wheel created)**
- opacity 0→1 + slight x-slide, 150ms ease-out

**`⋯` menu trigger reveal (hover)**
- opacity 0→1, 120ms ease-out (desktop); persistent-faint on touch

---

## 7. Activity-log integration

When a wheel is **created**, write one entry to the shared `roll-history` feed.

- **Format**: `◷ [Wheel name] — N segments`
  - `◷` clock glyph as the leading marker (where a die row leads with its expression)
  - wheel name in `pal.text`
  - "— N segments" in `pal.textMuted`
  - No large numeric total (the absence is what distinguishes it from a roll)
- **When it fires**: only on creation. Segment toggles, resets, renames, and removes are NOT logged (high-frequency fidget actions would flood the feed).
- **Type tag**: give the entry a `type: "wheel"` (or `kind`) discriminator so the history renderer branches to the administrative-note layout instead of the dice-row layout.

---

## 8. Edge cases & empty states

- **Zero wheels (expanded)**: header + the single Add tile, left in the grid. Calm and intentional — not a void.
- **Zero wheels (collapsed, adventure mode)**: just the header row with `+ Add`. Lowest-footprint state.
- **Max segments (12)**: the `+` stepper disables at 12. Gaps stay constant-degree.
- **Min segments**: stepper floor is **1**. A single-segment wheel renders as a notched full ring (2–3° notch at 12 o'clock). All wheels start with `filledCount: 0` (all empty).
- **Very long / multi-word label**: wraps to 2 lines max, then ellipsis. The wheel never resizes to fit the label.
- **Empty name at creation**: defaults to `Counter N` (N = next index). The DM can Rename later.
- **Empty name on rename**: reverts to prior name.
- **Many wheels (1–8 typical; tolerate more)**: grid wraps to multiple rows; panel body scrolls internally if needed. Cap panel body at `min(40vh, 360px)` with internal scroll before it crowds the Tier-1 party cards.
- **Full wheel (`N/N`)**: steady elevated glow + `accentBright` count, one-time completion pulse on the filling tap. Reversible — tapping any segment empties it.
- **Rapid toggling**: optimistic UI + 300ms debounced write coalesces rapid taps into one network call.
- **Concurrent DM edits / poll races**: writes send the whole `filled[]` for the affected wheel. Build updates from the latest ref snapshot to avoid clobbering near-simultaneous actions.

---

## 9. Responsive considerations

- **Desktop / left column (~400–600px wide)**: `repeat(auto-fill, minmax(96px, 1fr))` → 4–6 wheels per row. Wheel SVG ~84–96px. `⋯` reveals on hover.
- **Mobile (<900px, single-column stack, ~320–560px)**:
  - Grid relaxes to `minmax(110px, 1fr)` → **2–3 wheels per row**, with **larger wheels (~100–110px)** so 12-segment slices keep ≥44px tap zones.
  - `⋯` has **no hover** — render persistently at low opacity (~0.5) on each wheel's top-right corner on touch devices.
  - The inline creation form stacks vertically.
  - Collapsed-with-count-badge is a great mobile resting state; mode-aware auto rules still apply.
- **Reduced motion**: all animations become instant state changes.

---

## 10. Data needs (conceptual — architect finalizes shape)

An ordered array of wheel objects:
- `id` — stable unique identifier
- `name` — string (defaults to `Counter N` if empty at create; never null)
- `segments` — integer 1–12, **immutable after creation**
- `filledCount` — integer 0..segments. Segments 1..filledCount are filled clockwise from 12 o'clock; rest are empty. A plain number — not an array.

Persistence survives refresh. A new `slug: "counter-wheels"` sentinel is the clean choice — clocks are campaign-scoped DM state, not combat-scoped, and must **not** be wiped by "End Combat." Reuse the optimistic-write + adaptive-polling pattern (ADR-011). DM-auth on write.

Creation also appends an entry to the existing `roll-history` sentinel (§7).

---

## 11. Open questions

1. **Remove confirmation** — **Resolved: no confirmation.** Hover → menu → Remove is sufficient gating. No inline confirm.
2. **Single-segment wheels** — **Resolved: minimum is 1.** Stepper floor = 1. Renders as a notched full ring.
3. **Fill semantics** — **Resolved: fill-to-here clockwise (Blades-classic).** `filledCount: number`, not `boolean[]`. Tap fills up to that segment; tap filled unfills from there back.
4. **Color customization per wheel** — deferred to a future story. All wheels use `pal.gem` in v1.
5. **Manual toggle persistence** — **Resolved: last manual toggle wins, persisted in `dnd_wheels_open` sessionStorage. Optimistic sync on segment writes.**
