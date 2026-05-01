# Story 08 — DM Dice Roller

**Status**: Needs UX design

---

## Goal

Give the DM a fast, purpose-built dice roller on the dashboard that handles the volume and variety of in-combat DM rolling: group rolls for multiple creatures, inline advantage/disadvantage per roll, free-form expressions, and a quick shortcut to pre-fill a damage-apply action after rolling. All state is transient — no server changes required.

---

## User stories

1. **As the DM**, I want to roll the same attack or damage expression for a group of N identical monsters and see each result individually labeled, so I can quickly see which attacks hit and which missed without doing mental gymnastics.

2. **As the DM**, I want to set advantage or disadvantage on a specific roll without toggling a global mode, so a single disadvantaged perception check doesn't affect the goblin attack rolls immediately following it.

3. **As the DM**, I want a free-form expression input (e.g., `2d6+3`, `1d20+5`) and a die picker, so I'm not limited to predefined roll types.

4. **As the DM**, I want to see the last 8–10 rolls in a history list (most recent first), so I can glance back at what just happened without re-rolling.

5. **As the DM**, I want the roller to collapse and stay out of my way when I'm not actively rolling, so it doesn't crowd the party cards that are my primary working surface.

6. **As the DM**, after rolling damage, I want to tap a party member's name to pre-fill that character's "Deal Damage" quick-action with the rolled value, so I can apply damage in one extra tap rather than re-typing the number.

---

## Functional requirements

### Panel placement and visibility

- The dice roller lives in a collapsible panel on the DM dashboard.
- Collapsed by default; expand/collapse state persisted in `sessionStorage`.
- When collapsed, only a header row (label + toggle) is visible — no permanent vertical footprint.
- Placement: above the initiative tracker or anchored to the bottom of the left (party) column; does not interrupt the party card strip.

### Roll ×N (group rolls)

- Any roll can be repeated 1–10 times.
- Results are displayed as individually labeled rows: "Roll 1: 17 · Roll 2: 9 · Roll 3: 22 (crit) · Roll 4: 11".
- Each result is evaluated independently — the repeat count is not a multiplier on a single total.
- Critical hits (natural 20) and fumbles (natural 1) are labeled per-result when a d20 is part of the roll.

### Advantage / disadvantage

- Each roll has an inline Normal / Advantage / Disadvantage selector, defaulting to Normal.
- Applies only to d20 rolls within that roll. Non-d20 dice are unaffected.
- There is no global sticky adv/dis toggle (unlike the player roller).
- When advantage or disadvantage is active, both d20 results are shown with the discarded value struck through, matching existing player roller display convention.

### Dice picker and expression input

- Standard die buttons: d4, d6, d8, d10, d12, d20, d100 — same as the existing player `DiceRoller` component.
- Count stepper (1–10) next to the die buttons.
- Free-form expression text input accepting syntax like `2d6+1d4+3`; when non-empty, overrides the picker on roll.
- A flat numeric modifier field.
- A single "Roll" action executes the current configuration.

### Roll history

- Last 8–10 rolls retained, most recent first.
- Each history entry shows: expression rolled, repeat count (if > 1), timestamp or relative time, and the result(s).
- History is session-only (not persisted across page reloads or tab closes).

### Apply-to shortcut

- After any roll that consists entirely of non-d20 dice (i.e., a damage roll), a compact "Apply to…" row appears below the result.
- One button per party member (character name, styled with their palette accent).
- Tapping a button pre-fills that character's "Deal Damage" quick-action popover with the rolled total (first result only, or sum of a multi-roll if that is unambiguous — see Open Questions).
- The DM still confirms inside the popover; no auto-apply.
- The "Apply to…" row is dismissed once the DM navigates away from the result or starts a new roll.

### What this roller does NOT include

- Weapon or ability preloads tied to any specific character stat block (the DM has no character sheet).
- A secret-roll mode (the DM dashboard is already private).
- Random table lookups.

---

## Data model changes

None. All roller state (current expression, repeat count, adv/dis selection, roll history) is UI-local and ephemeral. `sessionStorage` is used only for panel open/closed state.

---

## Out of scope

- Named monster slots ("Goblin A / Goblin B") — numbered labels are sufficient.
- Saving custom roll presets or macro buttons.
- Sharing roll results with players or broadcasting to the player view.
- Any backend changes.
- Random encounter or loot tables.
- Auto-applying damage without DM confirmation.

---

## Open questions

1. **Multi-roll apply-to**: If the DM rolled ×4 for four goblins and one attack hit, which result should pre-fill the damage popover? Options: (a) the DM taps the specific result row to select it, then sees "Apply to…"; (b) always use the highest; (c) show "Apply to…" once per result row. Option (a) seems most accurate — confirm with UX.

2. **Placement specifics**: Above the initiative tracker vs. below the party column. These behave differently on mobile (single-column layout below 900px). UX prototype should explore both.

3. **Repeat count cap**: 10 is assumed sufficient for typical encounters (4–6 creatures plus legendary actions). Should it go to 12 or 15 for larger hordes? Keep simple for now; revisit if requested.

4. **History length**: 8 vs. 10 entries. 8 fits more comfortably without scrolling in a collapsed panel; 10 is more useful during long combat turns. UX to decide based on available height.

---

## UX Design

**Prototype**: `design/prototypes/dm-dice-roller.html`

### Reuse strategy

The existing `DiceRoller` component is embedded wholesale. Nothing about the component's internal structure changes — all of the following transfer unchanged:

- Die picker (d4–d100 SVG buttons, selection glow, double-click combo behavior)
- Count stepper (1–10)
- Combo builder (pending expression chips, "+ Add to Roll", clear button)
- Flat modifier input
- Expression text input (freeform parser, Enter key)
- Big Roll button (label updates dynamically as expression builds)
- Roll stage (single-die and multi-group animations, CSS spin/land keyframes, crit/fumble pulse/shake)
- Result breakdown chips (individual die values, group subtotals, total chip)
- Advantage/disadvantage three-button strip (Normal / Adv. / Disadv.) — visual design identical
- Roll history row layout and crit/fumble tags

**What the DM wrapper adds**: three new behaviors (×N repeat, adv/dis auto-reset, Apply-to row), a collapsible panel with ember palette chrome, and a longer history cap. The `DiceRoller` component itself is not modified — all DM-specific logic lives in a new `DmDiceRoller` wrapper that uses shared pure utilities (`parseDiceExpr`, `rollDie`, `DieShape`) exported from `DiceRoller.jsx`.

### Palette treatment

The roller panel uses the same **ocean palette** as the rest of the DM dashboard — no visual separation between the roller and the surrounding chrome. The panel blends into the page as a natural section rather than a distinct tool with its own colour identity.

### Panel placement

The roller is a **collapsible section at the bottom of the left (party) column**, below the three party cards and the party-wide rest row. This matches the existing player roller's position (bottom of the Combat tab) and keeps the DM's primary surfaces — party cards — at the top of the column and unobstructed.

**Why not the right column?** The initiative tracker occupies the right column. Splitting the roller there would make it compete with turn order, which the DM references constantly. The left column naturally grows downward.

**Collapsed by default**: only the header row (die icon + "Dice Roller" title + subtitle + chevron) is visible. No vertical footprint when closed. State persisted as `sessionStorage.dnd_dice_dm_open`.

### ×N repeat count

A compact inline control flanks the Roll button on the left: `[ × | − | N | + ]`. Range 1–8.

- At ×1 the roll is identical to the player roller in every way — one die animation, one result.
- At ×2–8: a single spin animation plays on the main die stage (satisfying roll feedback, ~1 second), then N labeled result rows reveal with a 110ms stagger. Each row: "Roll N · [value] · [crit/fumble tag] · [breakdown italic right-aligned]".
- The main die display shows the first result; result rows show the rest.
- Crit and fumble detection applies per-row when a d20 is in the expression.
- No summing — each result is discrete and independently labeled.

**Why not animate N dice separately?** Animating 6 goblins sequentially takes ~7 seconds at current stagger rates. The single-spin + staggered-rows approach gives visual feedback in ~1.7 seconds total, keeping combat pace.

### Advantage/disadvantage behavioral change

The three-button strip is **visually identical** to the player roller. The only change is behavioral: after each roll, the selection automatically resets to Normal (300ms post-result, giving the DM time to read before the button state changes).

The DM actively selects Adv. or Disadv. for the specific roll they need it for, then it resets. This prevents the common error of leaving Disadvantage active for goblin attacks after using it for a Stealth check.

Implementation: a single `autoResetAdvDis` flag or equivalent effect hook in `DmDiceRoller`. `DiceRoller.jsx` is not changed.

### "Apply to…" flow

After any roll whose expression contains **no d20** (all dice are d4/d6/d8/d10/d12/d100), an "Apply to…" row appears below the result. It contains:

- A small uppercase "Apply to…" label (IM Fell English, `pal.textMuted`)
- One pill button per party member, colored with that character's palette accent: `border-radius: 10px`, `border: 1px solid pal.accent`, `color: pal.accentBright`
- A confirmation line below that populates after a pill is tapped

Tapping a pill **pre-fills** the Deal Damage modal with the rolled total and opens it. The DM still confirms. No auto-apply.

**For ×N rolls**: the first result row is auto-selected (accent border highlight). The DM can tap any other result row to reselect it, updating the Apply-to total. This resolves Open Question 1 from the consultant story — option (a): DM taps the specific result row to target it.

**Detection logic**: `isDamageRoll(groups)` — true when every die group has `sides !== 20`. A pure d20 roll, or any expression containing a d20 (e.g. `1d20+2d6`), does not show Apply-to.

The "Apply to…" row dismisses when a new roll starts.

### Mobile considerations

Below 900px the dashboard collapses to single column. Order: party cards → dice roller panel → initiative tracker. The dice picker wraps at narrow widths (`flex-wrap: wrap`). The ×N repeat control stays inline with the Roll button — both are compact enough to share a row at 360px+. The adv/dis strip wraps on very narrow viewports. Apply-to pills also wrap. No horizontal scroll introduced.

The DM can collapse the panel to reclaim vertical space and open it only when rolling.

### Resolved open questions

**Q1 — Multi-roll apply-to**: Option (a). First result auto-selected; DM taps any row to switch. Selected row shows accent border. Apply-to total updates on tap.

**Q2 — Placement**: Bottom of the left (party) column. Party cards remain primary and are never scrolled past. On mobile, roller appears after cards and before initiative tracker.

**Q3 — Repeat count cap**: 8. Ergonomically clean (single digit). The functional requirements said 1–10; 8 is sufficient for typical 5e encounters (4–6 creatures plus legendary actions).

**Q4 — History length**: 8 entries (the prototype; Architect Notes call for 10 — either is fine, defer to architect). Fade curve: entries 1–2 full opacity, 3–4 at 45%, 5–6 at 22%, 7–8 hidden in DOM.

### New open questions

1. **Apply-to for ×N attack rolls**: Currently no Apply-to shows after a d20-containing roll. Should the DM be able to select a specific hit result row and then trigger a damage roll pre-targeted to that same Apply-to target? Out of scope here but worth flagging for a follow-on story.

2. **NPC damage application**: Apply-to pills only show party members. Should the DM be able to apply damage to NPCs tracked in the initiative list? Out of scope for this story.

3. **Roll button label truncation**: For long combo expressions with ×N, the button label can overflow on narrow viewports (e.g., "Roll 3d8+1d6+2d4+3 ×6"). The builder may want to truncate the expression and show only the ×N suffix at narrow widths.

---

## Architect Notes

### Component strategy: wrapper, not prop extension (follows ADR-002)

Build a new `DmDiceRoller` component in `src/components/DmDiceRoller.jsx` that composes the existing `DiceRoller` internally rather than extending `DiceRoller` with optional DM props. Rationale:

- `DiceRoller` is already ~820 lines. Adding `dmMode`, `repeatCount`, `partyMembers`, and `onApplyDamage` props plus their conditional render branches would push it past the ADR-002 threshold and entangle two unrelated concerns (player rolling vs. DM rolling) in one file.
- The DM roller has meaningfully different behavior: no weapons section, no ability checks section, ×N repeat, adv/dis that resets after each roll, and an "Apply to…" row. This is a different feature that happens to share dice math, not a parameterized variant of the player feature.
- The clean seam: `DmDiceRoller` uses `parseDiceExpr` and `rollDie` (both exported pure utilities — make them named exports from `DiceRoller.jsx`) plus the `DieShape` sub-component (also export it). It does not call `executeRoll` internally from `DiceRoller`; it owns its own roll state and calls its own roll function using the shared pure utilities.

**Action required on `DiceRoller.jsx`**: Add named exports for `parseDiceExpr`, `rollDie`, and `DieShape`. No behavioral changes to the existing component — the player experience is not touched.

### ×N repeat count: entirely in `DmDiceRoller`

The ×N repeat (1–8 per story, up to 10 per functional requirements — use 8 to match the story title and keep the UI compact) is implemented as a stepper in `DmDiceRoller` state. On roll, execute the expression N times in a single synchronous pass and store an array of result objects. No animation cycling between results — show results immediately as a labeled list. The existing single-roll animation is appropriate only for the player's focused roll experience; a DM rolling for six goblins wants results instantly.

### Adv/dis reset: opt-in, not a breaking change

The player `DiceRoller` uses a sticky `advMode` toggle (state persists until the user changes it). Do not change this. `DmDiceRoller` independently manages its own `advMode` state and resets it to `"normal"` immediately after each roll is executed. This is two lines inside `DmDiceRoller`'s roll handler — it never touches `DiceRoller.jsx`.

The story says adv/dis applies only to d20 rolls within the expression. The existing `executeRoll` logic in `DiceRoller` already gates adv on `isD20Attack && isSingleD20`. In `DmDiceRoller`, since there is no weapon/ability context, treat any expression containing exactly one d20 group as adv-eligible (same rule). Multi-die expressions that include a d20 alongside damage dice should have adv/dis apply only to the d20 component — this matches the existing logic and requires no changes to the shared utilities.

### "Apply to…" shortcut — `patchSession` usage

The existing `patchSession(slug, { hpCurrent: newHp }, dmPassword)` call pattern in `DmDashboardPage.jsx` (lines ~201, ~212) is the correct target. The "Apply to…" flow in `DmDiceRoller` should **not** call `patchSession` directly — it should invoke the existing `QuickActionPopover` opened in "damage" mode with the rolled value pre-filled.

Concrete mechanism: `CharacterCard` currently opens `QuickActionPopover` with `mode = null` (user picks damage/heal/condition/tempHp). Add two props to `QuickActionPopover`: `initialMode?: string` and `initialVal?: string`. When `initialMode="damage"` and `initialVal="14"` are passed, the popover opens directly on the damage input with the field pre-filled. `CharacterCard` then needs a way to be opened with those props from outside — expose a callback prop `onOpenWithDamage(val)` from `CharacterCard` that sets `popoverOpen = true` and passes `initialMode`/`initialVal` down.

`DmDiceRoller` receives `partyMembers` (array of `{ slug, name, palette }`) and an `onApplyDamage(slug, value)` callback from `DmDashboardPage`. The dashboard page wires `onApplyDamage` to call the relevant `CharacterCard`'s `onOpenWithDamage` — use a `Map<slug, openFn>` ref or lift the active-popover state into the dashboard page. The DM confirms inside the popover before `patchSession` fires; no auto-apply.

The "Apply to…" row is only shown when the last roll contained no d20 dice (pure damage expression). Check: `result.groups.every(g => g.sides !== 20)`.

### `sessionStorage` key for panel state

Use `dnd_dice_dm_open` (no slug, since the DM dashboard has no character context). Consistent with the existing pattern in `DiceRoller` (`dnd_dice_open_${slug}`).

### History length

Store last 10 entries in `DmDiceRoller` state (session-only, not `sessionStorage`). The DM dashboard has more vertical real estate than a character sheet panel — 10 is appropriate. Each history entry for a ×N roll stores the full results array plus the expression and timestamp.

### No backend work needed

Confirmed. All roller state is component-local. The only backend call is the existing `patchSession` triggered through the already-implemented `QuickActionPopover` — no new Lambda, no DynamoDB schema change, no SAM template change.

### Scope boundaries

- `src/components/DiceRoller.jsx` — add named exports for `parseDiceExpr`, `rollDie`, `DieShape` only. Zero behavioral change.
- `src/components/DmDiceRoller.jsx` — new file, ~350–450 lines. Owns all DM-specific roll state, ×N logic, adv reset, "Apply to…" row.
- `src/pages/DmDashboardPage.jsx` — add `DmDiceRoller` to the panel layout; add `initialMode`/`initialVal` props to `QuickActionPopover`; add `onOpenWithDamage` prop to `CharacterCard`; wire `onApplyDamage` callback.
- No changes to `CharacterSheet.jsx`, `api.js`, or backend.

### Open question resolution (for builder)

Open question 1 (multi-roll apply-to): implement option (a) — each result row gets its own "Apply to…" trigger. The DM taps a specific result row, which surfaces the party name buttons for that result's total. This is the most accurate and is straightforward with per-row state in `DmDiceRoller`.

Open question 3 (repeat count cap): cap at 8 to match the story title ("×N repeat count (1–8)"). The functional requirements say 1–10 — defer to the story's stated scope.

Open question 4 (history length): 10 entries as noted above.
