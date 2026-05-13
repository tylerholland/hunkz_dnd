# Story 17 — Player Sheet Improvements

## Goal

Reduce visual noise on the player character sheet so that in-session state (active conditions, current HP, live coin) reads faster, and passive reference content (skills, spells, abilities, XP progress) no longer competes with it for above-the-fold attention.

---

## Changes

### 1. Condition display — color-coding and sparse-first

**Color assignments** (fixed, independent of palette):

| Color | Hex | Conditions |
|---|---|---|
| Red | `#c06060` | Blinded, Paralyzed, Petrified, Poisoned, Stunned, Unconscious |
| Amber | `#c09040` | Exhausted (when exhaustionLevel > 0), Grappled, Prone, Restrained |
| Blue | `#6090c0` | Deafened |
| Purple | `#9060b8` | Charmed, Frightened, Incapacitated |

Note: `Invisible` (from the existing `CONDITIONS` constant) is not covered by the expert's spec. Assign it to **Blue** (perception/awareness group) — it is a sensory/detection effect analogous to Deafened.

**Sparse-first behavior:**

*Empty state* (no active conditions): render only a `＋ Add Condition` trigger button. No condition grid shown. The exhaustion stepper is always visible below this row (unchanged — it already has its own display pattern).

*Active conditions* (one or more conditions active): render each active condition as a large color-coded chip at the top of the CONDITIONS section. Each chip:
- Background: the condition's severity color at ~15% opacity (`color + "26"`)
- Border: the condition's severity color at ~70% opacity (`color + "b3"`)
- Text: the condition's severity color (full)
- Font: `pal.fontUI`, 13px, `letterSpacing: "0.1em"`, uppercase, `borderRadius: 14`
- Padding: `5px 14px`
- Has an inline `×` dismiss button on the right (same interaction as current toggle-off — removes from `conditions` array via `patchSession`)
- The `×` uses `color: pal.textMuted`, `fontSize: 14`, `marginLeft: 8`, `cursor: "pointer"`

After the active chips row, render the `＋ Add Condition` trigger button regardless of whether conditions are active — it is always the entry point to adding more.

*Add Condition picker* (expanded state): clicking `＋ Add Condition` expands a compact grid of all 14 standard conditions that are not currently active. These are shown as small ghost pills (transparent background, `pal.border` border, `pal.textMuted` text, same `borderRadius: 14`). Tapping one adds it to the active conditions (same `patchSession` call as current). The picker collapses after each selection, or when the user clicks `＋ Add Condition` again (toggle).

`＋ Add Condition` trigger styling:
- Ghost button: `background: "transparent"`, `border: "1px solid ${pal.border}"`, `borderRadius: 14`, `color: pal.textMuted`, `fontFamily: pal.fontUI`, `fontSize: 11`, `letterSpacing: "0.18em"`, `textTransform: "uppercase"`, `padding: "4px 14px"`, `cursor: "pointer"`
- Label: `＋ Add Condition` (the ＋ is fullwidth U+FF0B, not ASCII +, to give visual weight without a separate icon element)

**"Clear All Conditions" button**: Keep as-is. It already only appears when `(conditions.length > 0 || exhaustionLevel > 0)`. Position it after the exhaustion stepper row, before the section ends — same as current placement.

**Exhaustion stepper**: No change to the stepper itself. It remains always-visible below the active chips / picker. The amber color for "Exhausted" chip only appears when `exhaustionLevel > 0`; it is not a standard `CONDITIONS` array member — it is a separate field managed by the stepper. The label "Exhausted" is a generated synthetic chip added visually alongside active conditions when `exhaustionLevel > 0`, to give the DM and player a unified conditions view. Its `×` remove resets exhaustion to 0 (same as clicking the stepper down to 0). The exhaustion stepper itself stays below for precise control.

---

### 2. XP strip — moved to Inventory tab

**Remove from**: The above-the-fold stats block. The XP panel currently renders immediately after the ability scores grid (line ~562 in `CharacterSheetViewMode.jsx`), inside the surface panel, before the `HR` divider that leads to the Skills/Spells section. Remove it from this location.

**Add to**: The bottom of the Inventory tab content (`combatTab === "loadout"`), below the Coin section. It renders only when `(char.levelingMode || "milestone") === "xp"`.

**Compact strip design** (matches the DM card XP strip from Story 16):

```
XP  [thin 4px progress bar]  14,200 / 23,000  [+ button]
```

- Layout: single `display: "flex"`, `alignItems: "center"`, `gap: 14`, `padding: "10px 0"`, `borderTop: "1px solid ${pal.border}"`, `marginTop: 18`
- `XP` label: `fontFamily: pal.fontUI`, `fontSize: 11`, `letterSpacing: "0.25em"`, `textTransform: "uppercase"`, `color: pal.textMuted`, `flexShrink: 0`
- Progress bar: `flex: 1`, `height: 4`, `borderRadius: 2`, `background: "${pal.accent}20"`; inner fill uses `pal.accent` (or `pal.gem` when ready to level up), same progress calculation as current
- Values text: `fontFamily: pal.fontUI`, `fontSize: 12`; current XP in `pal.gem`, separator `/` in `pal.textMuted`, threshold in `pal.textMuted`; shown as `14,200 / 23k` (current uses `toLocaleString()`; threshold abbreviated with `k` suffix when ≥ 1000, e.g., `23,000` → `23k`)
- `+` award button: 24×24px, `borderRadius: "50%"`, `background: "transparent"`, `border: "1px solid ${pal.border}"`, `color: pal.textMuted`, `fontSize: 16`, `cursor: "pointer"`, `flexShrink: 0`; opens an inline input for entering XP amount to add (same flow as current `+` button behavior)
- "Ready to level up" pulse badge: keep existing behavior and animation; render it at the far right, replacing the `+` button when `isReadyToLevelUp` is true (or show both — implementer's call based on how tight the layout feels)

The `xpLevelupPulse` keyframe animation is already injected inline near the current XP block; move it to wherever the new XP strip is rendered.

---

### 3. Coin — multi-denomination collapse

This change applies **only to `coinMode === "full"`** characters. The `coinMode === "gp"` GP-only pill stays exactly as it is.

**Collapsed state (default):**

Replace the current 5-column denomination grid with a single compact line:
```
GP  [≈ 131.52 gp]  [↓]
```
- `GP` label: same style as the XP `XP` label above (fontUI, 11px, uppercase, textMuted, flexShrink 0)
- GP-equivalent pill: `fontFamily: pal.fontDisplay`, `fontSize: 14`, `color: pal.gem`; the `≈` prefix is rendered at 10px `pal.textMuted` immediately before the number (no space); the `gp` suffix is 11px `pal.textMuted`; entire pill has `background: "${pal.gem}14"`, `border: "1px solid ${pal.gem}55"`, `borderRadius: 12`, `padding: "3px 10px"`
- `[↓]` expand toggle: 24×24px ghost button, `color: pal.textMuted`, `fontSize: 13`, `cursor: "pointer"`; no border (or `border: "1px solid transparent"` with hover to `pal.border`)

**GP-equivalent conversion rules** (from Story 16 — same formula):
- 1 PP = 10 GP · 1 GP = 1 GP · 1 EP = 0.5 GP · 1 SP = 0.1 GP · 1 CP = 0.01 GP
- Sum all denominations in GP-equivalent, round to 2 decimal places
- If total is a whole number, show no decimals (e.g., `5 gp` not `5.00 gp`)
- If total is zero, show `0 gp`
- Example: `{ cp: 12, sp: 34, ep: 0, gp: 88, pp: 4 }` → `12×0.01 + 34×0.1 + 0 + 88 + 4×10 = 0.12 + 3.40 + 88 + 40 = 131.52 gp` → `≈ 131.52 gp`

**Expanded state (after tapping `[↓]`):**

The summary line stays in place. A denomination row appears directly below it:
```
GP  [≈ 131.52 gp]  [↑]
    [12 cp]  [34 sp]  [0 ep]  [88 gp]  [4 pp]
```
Each denomination chip uses the existing `COIN_COLORS` values from `constants.js` for its metallic tint. Chip style: same as existing per-denom display but as inline readable chips rather than vertical steppers. For editing individual denominations, the player can still tap into a chip to open an inline edit input (number input, same `patchCoin` call). Alternatively, the implementer may keep the existing vertical stepper layout below the collapsed summary line — the key requirement is that all 5 are hidden by default and revealed on tap.

`[↑]` collapse toggle: same button as `[↓]`, label flips.

Expand/collapse state is **local component state only** (no sessionStorage persistence needed — it resets to collapsed on tab switch or reload, which is acceptable).

---

### 4. Skills/Spells/Special Abilities — moved to Persona tab

**Remove from**: The above-the-fold stats block. Currently the section renders after the XP strip (or directly after ability scores when XP mode is off), ending just before the tab strip `HR` divider. The `<HR>` before the Skills heading and the Skills/Spells/Special Abilities block itself are both removed from the above-the-fold area. The `<HR>` that currently separates the section from the tab strip also goes away (the tab strip will now follow directly after the ability scores and XP strip — or after ability scores alone once XP is moved).

The section heading (`Skills, Spells & Special Abilities`) and all three badge rows (Skills, Spells, Special Abilities) move to the Persona tab.

**Add to**: The Persona tab (`combatTab === "persona"`), rendered **above** the existing `inPlay[]` traits list. The Persona tab structure becomes:

1. `Skills, Spells & Special Abilities` section (moved here)
   - Same three badge groups: Skills (accentBright color), Spells (accent color), Special Abilities (gem color)
   - Same `InfoBadge` component and tooltip behavior — no change to the rendering, only the location
   - Each group renders its "None listed." italic fallback if empty — same as current behavior
2. `<HR>` divider (if both sections are present and non-empty; omit if traits list is empty to avoid orphaned divider)
3. `inPlay[]` traits list (existing diamond-bullet grid)
   - Existing empty state message if no traits

The Skills/Spells section does not need a new panel or border — it sits directly in the Persona tab content area the same way the traits list does currently.

---

## What does NOT change

- Spell slots panel (Combat tab) — untouched
- Map tab — untouched
- Dice roller (Combat tab) — untouched
- Session Notes section (Combat tab) — untouched
- Persona tab collections / backstory sections (the rich-text collection viewer rendered below the stats block) — untouched
- HP / Hit Dice / Armor row in the stats block — untouched
- Ability scores grid in the stats block — untouched
- Inspiration toggle (Combat tab) — untouched
- Concentration banner and set-concentration input (Combat tab) — untouched
- Weapons quick-reference (Combat tab) — untouched
- `coinMode === "gp"` coin display — untouched, stays as the existing GP stepper
- Edit mode — none of the edit mode sections change; XP and Coin editing fields stay exactly where they are
- DM dashboard party cards — covered by Story 16; this story is player sheet only
- `CONDITIONS` array in `constants.js` — do not add or remove entries; the color mapping is pure presentation logic added alongside the existing array
- The `conditionStyle` / active condition rendering on the DM dashboard cards — that is Story 16 territory; this story only touches `CharacterSheetViewMode.jsx`
