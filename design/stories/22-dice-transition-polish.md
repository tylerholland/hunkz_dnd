# Story 22 — Dice Roller Combat Transition Polish

## Goal
The DM dice roller currently "teleports" during combat mode toggle — it fades out in one location with a vertical gesture, then reappears in another location with a mismatched horizontal gesture. The browser reads them as two separate panels rather than one object relocating. This story fixes the motion so the dice roller reads as a single object with a coherent departure and arrival.

## Problem (precise diagnosis)

**Entering combat:** The dice fades out at t=780ms (a fully settled, dead moment where it's the only thing moving) via `translateY(-10px) scaleY(0.96)` — barely perceptible on a full-width panel, reads as a straight crossfade-to-nothing. Simultaneously, `max-height → 0` collapses the panel footprint, causing the page below to lurch upward as a second, competing motion. Then at t=1060ms — the busiest instant in the whole sequence (cards compacting + panels sliding in from the right) — the dice reappears in the center column via `translateX(-18px) scaleX(0.94)`. The exit said "up," the entrance says "from the left." They don't rhyme, so the brain registers: a thing disappeared, and a different thing appeared.

**Exiting combat:** The dice exits the center column via `translateX(-18px) scaleX(0.94)` (says "leaving left") then reappears at the bottom via `translateY(-10px) scaleY(0.96)` (says "coming from above"). Mismatched axes again. It then sits stranded at the bottom for ~240ms inside a card grid that hasn't re-flipped yet, looking like a rendering glitch.

## Required changes

### 1. Remove all horizontal motion from the dice panel

The `translateX` and `scaleX` transforms on `.dm-prototype-shell[data-dice-combat="true"]` states must be removed. All four states (visible/hidden × combat/non-combat) must use only `translateY` + uniform `scale`. The horizontal axis is used by the side panel (initiative/NPC) sliding in from the right — the dice roller using horizontal motion too creates the "two different objects" misread.

### 2. Unify transform-origin to `top center` in both modes

Currently `.dm-prototype-shell[data-dice-combat="true"] .dm-prototype-dice-panel` sets `transform-origin: left top`. Change to `top center` to match the non-combat state. Vertical growth from a centered anchor is consistent with all four of the new transforms.

### 3. Split CSS transitions: arrival curve on visible state, exit curve on hidden state

Replace the current single shared transition (0.28s or 0.46s) with asymmetric rules:

**Visible (arrival)** — slow, decelerating, confident landing:
```css
.dm-prototype-dice-panel {
  transition:
    max-height 420ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity    420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform  420ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

**Hidden (departure)** — faster, accelerating, decisive exit:
```css
.dm-prototype-shell[data-dice-visible="false"] .dm-prototype-dice-panel {
  transition:
    max-height 240ms cubic-bezier(0.4, 0, 1, 1),
    opacity    240ms cubic-bezier(0.4, 0, 1, 1),
    transform  240ms cubic-bezier(0.4, 0, 1, 1);
}
```

The CSS engine applies the correct curve in each direction automatically — no JS change needed for the easing.

### 4. Revise the four transform states

All four states use vertical axis only. The bottom-position (non-combat) uses slightly larger values (24px / 0.92) than the center-column (combat) position (20px / 0.94) because the full-width panel is physically larger:

```css
/* Non-combat, hidden — exits/enters via down+shrink / up+grow */
.dm-prototype-shell[data-dice-combat="false"][data-dice-visible="false"] .dm-prototype-dice-panel {
  opacity: 0;
  transform: translateY(24px) scale(0.92);
  pointer-events: none;
  max-height: 0;
}

/* Combat, hidden — same vertical axis, slightly smaller displacement */
.dm-prototype-shell[data-dice-combat="true"][data-dice-visible="false"] .dm-prototype-dice-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.94);
  pointer-events: none;
  max-height: 0;
}

/* Combat, visible — arrives from below, settles upward */
.dm-prototype-shell[data-dice-combat="true"][data-dice-visible="true"] .dm-prototype-dice-panel {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  max-height: 2200px;
}
```

The default `.dm-prototype-dice-panel` rule (non-combat, visible) already has `opacity: 1, transform: translateY(0) scaleY(1)` — update the scaleY(1) to `scale(1)` for consistency.

### 5. Re-choreograph JS timer offsets in `toggleCombatMode()`

Add two new timing constants alongside the existing ones:
```js
const DICE_EXIT_MS = 240;   // was implicit 280ms
const DICE_ENTER_MS = 420;  // new — arrival duration (matches CSS)
```

**Entering combat — revised sequence:**
```
t=0                                   Map collapses, non-combat chrome hides
t=MAP_TRANSITION_MS (320)             Cards FLIP (460ms) AND dice exits (concurrent — masked by card motion)
t=MAP_TRANSITION_MS + DICE_EXIT_MS    diceLayoutActive → true (dice re-mounts in center column, still hidden)
  (320 + 240 = 560)
t=MAP_TRANSITION_MS + CARD_FLIP_MS    Combat panels begin slide-in, cards compact
  (320 + 460 = 780)
t=780 + 120 = 900                     Dice ARRIVES (420ms ease-out settle — solo beat, last element to land)
```

In code:
```js
setCombatMode(true);
setMapCollapsed(true);
setNonCombatChromeVisible(false);
setDiceVisible(false);                           // ← move to t=0, concurrent (was t=780)
queueTransitionStep(() => {
  triggerCardFlip(true);
}, MAP_TRANSITION_MS);
queueTransitionStep(() => {
  setDiceLayoutActive(true);                     // ← re-mount in combat position (was same step as arrival)
}, MAP_TRANSITION_MS + DICE_EXIT_MS);
queueTransitionStep(() => {
  setCardsCompact(true);
  setCombatPanelsVisible(true);
}, MAP_TRANSITION_MS + CARD_FLIP_MS);
queueTransitionStep(() => {
  setDiceVisible(true);                          // ← arrives 120ms after panels start
}, MAP_TRANSITION_MS + CARD_FLIP_MS + 120);
```

**Exiting combat — revised sequence:**
```
t=0                                   Combat panels hide AND dice exits (concurrent — both combat elements leave together)
t=DICE_EXIT_MS (240)                  diceLayoutActive → false, cards un-compact (dice re-mounts at bottom, still hidden)
t=DICE_EXIT_MS + CARD_COMPACT_MS      Cards FLIP 1-col → 2-col
  (240 + 240 = 480)
t=480 + 120 = 600                     Dice ARRIVES at bottom (420ms ease-out settle)
t=600 + DICE_ENTER_MS = 1020          Map expands, action buttons show
```

In code:
```js
setCombatMode(false);
setCombatPanelsVisible(false);
setDiceVisible(false);                           // ← move to t=0, concurrent with panel exit (was t=460)
queueTransitionStep(() => {
  setDiceLayoutActive(false);                    // ← re-mount at bottom
  setCardsCompact(false);
}, DICE_EXIT_MS);
queueTransitionStep(() => {
  triggerCardFlip(false);
}, DICE_EXIT_MS + CARD_COMPACT_MS);
queueTransitionStep(() => {
  setDiceVisible(true);                          // ← arrives 120ms after card flip starts
}, DICE_EXIT_MS + CARD_COMPACT_MS + 120);
queueTransitionStep(() => {
  setMapCollapsed(false);
  setNonCombatChromeVisible(true);
}, DICE_EXIT_MS + CARD_COMPACT_MS + 120 + DICE_ENTER_MS);
```

### 6. Add `prefers-reduced-motion` support

```css
@media (prefers-reduced-motion: reduce) {
  .dm-prototype-dice-panel,
  .dm-prototype-shell[data-dice-visible="false"] .dm-prototype-dice-panel {
    transition: opacity 120ms linear;
    transform: none !important;
  }
}
```

The `max-height` animation is intentionally omitted here — let it snap instantly. A fast opacity-only crossfade is the most graceful reduced-motion option and avoids vestibular discomfort from large layout shifts.

## Files to change
- `src/pages/DmDashboardPrototypePage.jsx` — timer choreography in `toggleCombatMode()`
- `src/features/dmDashboard/dashboard.css` — dice panel transition rules

## Success criteria
- The dice roller reads as one object relocating, not two panels swapping
- Entering combat: dice exits while cards are flipping (not visible as a solo event), arrives as the final calm beat after combat panels are in motion
- Exiting combat: dice and combat panels exit together, dice arrives during (not after) the card flip
- No horizontal transforms on the dice panel at any point
- `max-height`, `opacity`, and `transform` animate with identical duration and easing in all states
- Motion is suppressed to a 120ms opacity-only fade under `prefers-reduced-motion: reduce`

---

## Architect Notes

**Applies**: ADR-001, ADR-014

**Tech approach**: Pure CSS/JS motion polish on the existing DM dashboard prototype page. No new infrastructure, no backend, no data shape changes, no new ADR. Follows ADR-001/ADR-014: all transition rules belong in the static `dashboard.css` file, never a runtime `<style>` injection — the story's CSS blocks go directly into `src/features/dmDashboard/dashboard.css`. The state/timer choreography stays in `toggleCombatMode()` in `DmDashboardPrototypePage.jsx`. The story's exact values were verified against current source and are sound; one timing-constant cleanup is needed (see Risks). Note `DmDashboardPrototypePage.jsx` is the prototype variant (it `export default`s `DmDashboardPage` too); the production `DmDashboardPage.jsx` is a separate file and is out of scope.

**Scope boundary**:
- In: CSS rules for `.dm-prototype-dice-panel` and its four `[data-dice-combat]`/`[data-dice-visible]` state selectors (lines 279-336 of `dashboard.css`), a new `prefers-reduced-motion` block, and the `toggleCombatMode()` timer sequence + two new timing constants in `DmDashboardPrototypePage.jsx`.
- Out: the production `src/pages/DmDashboardPage.jsx` (do not port these changes there in this story); `.dm-prototype-side-panel` motion (its horizontal axis is intentional and is the reference the dice panel must stop competing with — leave it alone); `.dm-prototype-party-actions` transition (lines 272-277, unrelated); card-flip FLIP logic in `triggerCardFlip()`; any visual restyling of the dice roller itself.

**Replace vs. add (precise)**:
- **Replace** the `transition` declaration inside the default `.dm-prototype-dice-panel` rule (currently line 288, `0.28s ease-out`) with the 420ms arrival triple, and change `transform: translateY(0) scaleY(1)` (line 283) to `scale(1)`.
- **Replace** the body of `.dm-prototype-shell[data-dice-combat="true"] .dm-prototype-dice-panel` (lines 311-315) — keep `grid-column: 2; grid-row: 1;`, **delete** `transform-origin: left top;` (the `top center` from the default rule then cascades correctly).
- **Replace** the two hidden-state rules (lines 317-322 and 324-329) and the combat-visible rule (lines 331-336) with the story's new vertical-only transforms.
- **Add** (new, does not exist anywhere): the `.dm-prototype-shell[data-dice-visible="false"] .dm-prototype-dice-panel` exit-curve rule, and the `@media (prefers-reduced-motion: reduce)` block. Confirmed there is currently no `prefers-reduced-motion` block in `dashboard.css` — this is a net-new addition, not an edit to an existing media query.
- **Replace** the `toggleCombatMode()` body (lines 717-752) with the story's two revised sequences.

**Performance notes**: Animating `max-height` is not GPU-composited and forces layout on each frame, but the panel is a single element animated only on an explicit user toggle (not on scroll/poll), so this is acceptable and unchanged from current behavior — do not "optimize" it into a height/clip-path rewrite. `opacity`/`transform` are composited and fine. No new event listeners or render loops.

**Risks / decisions needed**:
- **Stale timing constants**: the story adds `DICE_EXIT_MS = 240` and `DICE_ENTER_MS = 420`, and its revised sequences no longer reference `DICE_TRANSITION_MS` (280) or `PANEL_TRANSITION_MS` (460). After rewriting `toggleCombatMode()`, grep the file for `DICE_TRANSITION_MS` and `PANEL_TRANSITION_MS` — if `toggleCombatMode()` is their only consumer, remove the now-dead constants (lines 25-26) to avoid leaving misleading dead config. Verify before deleting; do not assume.
- **Specificity / curve direction**: the exit-curve selector `[data-dice-visible="false"] .dm-prototype-dice-panel` (1 attr + 1 class) is more specific than the default `.dm-prototype-dice-panel` (1 class), so it correctly wins for the `transition` property while hidden, and the default rule's slower curve applies on the return to visible — this is the intended asymmetric behavior and requires no `!important`. Confirm the new rules are placed so source order doesn't let an equal-specificity later rule clobber the exit curve.
- **Combat-visible transform redundancy**: `[data-dice-combat="true"][data-dice-visible="true"]` (2 attrs + 1 class) overrides the default rule's `transform: scale(1)` with the same value — harmless, keep as written for state symmetry/readability.
- **`prefers-reduced-motion` + `max-height`**: the reduced-motion block intentionally omits `max-height` from its `transition`, so `max-height` snaps with no transition (instant show/hide) while opacity does a 120ms fade. This is the desired graceful degradation, not a bug — do not "fix" it by adding `max-height` back.
- **No open decisions** — the story is fully specified and self-consistent; proceed once the dead-constant check above is done.
