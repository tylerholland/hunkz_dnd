# Feature Story: Dice Roller

**Status**: Needs architect review  
**Depends on**: Story 04 (Combat tab) — dice roller lives inside the Combat tab  
**Source**: RPG Consultant Review, Priority 7; RPG Consultant Addendum (2026-04-29)  
**Prototype**: `design/prototypes/dice-roller.html`

---

## Goal

Add an inline dice roller to the Combat tab that feels tactile and satisfying — the digital equivalent of grabbing a handful of dice and throwing them. It must handle the full range of 5e roll types, including combination rolls (multiple die types in one throw), and surface roll history so players can glance back at recent results without interrupting play.

---

## User stories

- As a **player in active combat**, I want to roll an attack by tapping my weapon, so I don't have to mentally add modifiers under time pressure.
- As a **player**, I want advantage and disadvantage available on any d20 roll, toggled once before rolling, so I don't have to re-open the roller for common situations.
- As a **player**, I want to roll an ability check by tapping the ability score, so skill checks and saving throws are a single tap.
- As a **player with Blade Flourish or a paladin smite**, I want to roll a combination of different die types (e.g. 1d8 + 1d6 + 4) as a single action, so I don't have to roll twice and add mentally.
- As a **player**, I want a free roller where I can choose any die type and count, so I can handle any edge case the sheet doesn't cover.
- As a **player**, I want to see my last few rolls in a history log, so I can glance back without asking "wait, what did I roll?"
- As a **player**, I want a natural 20 to look and feel meaningfully different from other results, because critical hits deserve a moment.

---

## Functional requirements

### Placement

An inline collapsible **"Dice" section** at the bottom of the Combat tab — below spell slots, above the bottom of the page. Collapsed by default; a single tap expands it. When a weapon ATK or DMG button is tapped, the section auto-expands and scrolls into view.

A collapsible section is preferred over a floating action button (FAB) because it keeps rolls in context with the stats being referenced, and avoids the extra tap cost of a FAB on a phone held one-handed in dim light.

---

### Advantage / disadvantage toggle

A three-state strip at the top of the dice section: **Normal · Advantage · Disadvantage**.  
- Applies to all d20 rolls (weapon attacks and ability checks) until changed.  
- In advantage mode: rolls 2d20, keeps the higher. Both results shown as chips; the discarded one is struck through and dimmed.  
- In disadvantage mode: rolls 2d20, keeps the lower. Same display.  
- State persists within the session (does not reset on collapse). Resets on page reload.

---

### Weapon roll buttons

Each weapon row in the dice section shows: **name · ATK button · DMG button**.

- **ATK**: rolls 1d20 + the weapon's attack bonus. Applies advantage/disadvantage. Triggers crit/fumble visual on natural 20/1.
- **DMG**: rolls the weapon's damage expression. Supports multi-term expressions (e.g. `1d8+2d8`, `1d8+1d6+4`). Displays each die group's results as individual chips, then a total.

Weapon data comes directly from `char.weapons` — no new data model changes needed.

---

### Ability check roll

All six ability scores are shown as tappable circles (STR / DEX / CON / WIS / INT / CHA).  
- Tapping rolls 1d20 + the ability's computed modifier.  
- Applies advantage/disadvantage.  
- Triggers crit/fumble visual on natural 20/1.  
- Modifiers are computed the same way as the rest of the sheet: `floor((score - 10) / 2) + item bonuses`.

---

### Free dice picker

A row of 7 die buttons: **d4 · d6 · d8 · d10 · d12 · d20 · d100**.  
- Each button is an SVG showing the correct polygon shape for that die (triangle, square, diamond, etc.).  
- A count stepper (1–10) sets how many dice to roll.  
- A **"+ Add die"** button lets the player add a second die type to the current roll, building a combo expression (e.g. 1d8 + 1d6). The pending expression is shown before rolling.  
- The player can double click on any of the polygon shape representations of a die to add one of those die to the dice combination, skipping the Add Die button
- A flat **modifier input** (+ or − integer) can be added to any roll.  
- A **free-form expression input** accepts typed expressions like `2d6+1d4+3` for power users and edge cases. Parses `NdX` terms and flat integers separated by `+` or `-`.

---

### Combination roll support

The RPG consultant confirmed that mixed-die-type rolls occur in ~10% of 5e rolls, primarily from:
- **Blade Flourish** (College of Swords Bard): weapon damage + Bardic Inspiration die of a different size
- **Elemental Weapon spell**: `1d4 elemental + 1d8 weapon`
- **Paladin smite on a non-d8 weapon**: same die type (not mixed), but still multi-group

All roll paths (weapon DMG, free picker) must support expressions of the form `XdA + YdB + N`. When rolling a combo expression:
- Each die group animates and lands with a short stagger (the first group lands, then the second 200ms later).
- Individual group results shown as chips (e.g. `d8: [6]  d6: [4]  +3`).
- Total is shown prominently below.

---

### Dice animation

The die SVG animates on every roll:
1. Die shape morphs to match the type being rolled (d4 = triangle, d6 = square, d8 = diamond, d20 = hexagon, etc.)
2. Spins with random number cycling (new random face every ~90ms) for ~1 second
3. When multiple die types are involved in a roll, each should be represented on the page
4. Final number lands with a scale-reveal + glow pulse

**Critical hit (natural 20, d20 rolls only)**: gold number color, golden glow bloom, "✦ CRITICAL HIT ✦" label with scale-bounce animation.  
**Fumble (natural 1, d20 rolls only)**: red number color, red glow, "✕ FUMBLE ✕" label with shake animation.  
Crit/fumble states apply only to single d20 rolls — not damage dice, not multi-dice expressions.

Animation total duration: ≤ 1.5 seconds. Player cannot initiate a second roll while current roll is in progress. The Roll Dice button should be disabled while a roll is active, and reenabled when it completes.

---

### Roll history log

Shows the last 5 rolls, most recent at top.  
Each entry: die expression, result, roll type label (e.g. "Longsword ATK", "STR check", "Free roll").  
Entries fade in opacity: most recent = full, one back = 45%, two back = 22%, beyond that hidden.  
History is session-only (not persisted to DynamoDB). Clears on page reload.

---

### Empty / no-weapon state

If the character has no weapons configured, the weapon roll section shows: *"No weapons configured — add them in Inventory."* with a tab link. Ability checks and the free roller are always shown regardless.

---

## Data model changes

No new fields. All data comes from existing character fields:
- `char.weapons[]` — name, attack bonus (`attackBonus`), damage (`damage`)
- `char.stats[]` — scores and item mods (ability modifiers computed on-the-fly, same formula as rest of sheet)

Roll history and advantage/disadvantage state are UI-only, stored in component state, not persisted.

---

## Out of scope

- Dice rolling for saving throws with proficiency bonus (requires storing proficiency data — future story)
- Spell attack rolls (no spell attack bonus stored in data model currently)
- Rolling with custom modifiers entered per-roll (the flat modifier field in the free picker covers basic cases)
- Roll automation (auto-applying damage to HP on a hit) — intentionally excluded; the DM adjudicates hits
- Sound effects
- Shared visible rolls (party can see your roll) — story 05 extension

---

## Open questions

- **Weapon attack bonus format**: weapon rows store `attackBonus` as a string like `"+5"` or `"3"`. The roller needs to parse this as an integer. Confirm this is consistent across all characters, or handle both formats.
- **Damage expression parsing**: weapon `damage` strings currently use formats like `"1d8+3"` or `"2d6"`. The parser needs to handle edge cases — confirm no weapons use notation like `"1d8+1d6"` currently (those would be new entries), so the parser can be introduced without migrating existing data.
- **Collapsible default state**: should the Dice section remember whether it was open or closed (via `sessionStorage`)? Suggest yes — a player who uses dice frequently shouldn't have to expand it every session.

---

## Architect Notes

### Resolving the open questions

**Weapon attack bonus format (confirmed)**: The story's data model description is wrong. Weapons do not have top-level `attackBonus` or `damage` fields. The actual shape is:

```js
item.mods = [
  { attribute: "Attack Bonus", value: "5" },   // or "+5", or "-1"
  { attribute: "Damage",       value: "1d8+3" },
]
```

This is sourced directly from `ItemEditorModal`, which stores whatever string the user types into the mod value field. The Combat tab weapons quick-reference (line 2563–2564 in CharacterSheet.jsx) already reads these as `item.mods?.find(m => m.attribute === "Attack Bonus")` and `item.mods?.find(m => m.attribute === "Damage")`. The builder must use the same lookup pattern.

**Attack bonus parsing**: `parseModInt` (ADR-010) accepts `"+5"`, `"-1"`, `"5"` — all plausible attack bonus formats — and would work correctly for the d20 roll. However, it explicitly rejects dice notation. That is correct behavior here: attack bonus is always a flat integer and `parseModInt` is the right tool. If the value fails `parseModInt` (e.g., user entered something malformed), the roller should fall back to a plain 1d20 roll and show a warning chip rather than throwing.

**Damage expression format (confirmed)**: `item.mods` stores the `Damage` value as a freeform string entered by the user — currently only simple expressions like `"1d8+3"` or `"2d6"` exist in practice. Mixed-die expressions like `"1d8+1d6"` do not exist in current data but are a valid future entry; the parser must handle them from day one. No data migration is needed — the parser just needs to accept anything matching `/(\d+)d(\d+)/g` plus flat integer terms separated by `+`/`-`.

**Collapsible default state**: Yes, persist via `sessionStorage` key `dnd_dice_open_${slug}`, consistent with the existing `dnd_tab_${slug}` pattern (ADR-006). Default to `false` (collapsed) if the key is absent.

---

### Dice expression parser

Implement a pure utility function (no side effects, no React dependency) — e.g., `parseDiceExpr(str)` — that returns an array of roll terms:

```js
// parseDiceExpr("1d8+2d6+3") →
// [{ count: 1, sides: 8 }, { count: 2, sides: 6 }, { flat: 3 }]
```

Use a single `/([+-]?\s*\d+)d(\d+)|([+-]?\s*\d+)/g` regex scan. Keep it simple — no operator precedence, no parentheses, `+` and `-` terms only. This covers every 5e case. Place the function as a module-level `const` near `parseModInt` inside CharacterSheet.jsx (or in the extracted file — see file size note below).

Rolling is pure math: `Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)`. No external library needed.

---

### Animation approach

Use CSS keyframe animations injected via the existing `<style>` tag pattern (ADR-001) — do not add an animation library. Required keyframes: `@keyframes dice-spin` (rapid number cycling via opacity flicker), `@keyframes dice-land` (scale 1.3 → 1.0 + glow), `@keyframes crit-bounce` (scale bounce + golden glow), `@keyframes fumble-shake` (translate shake + red glow).

**State management**: A single `rollState` object in `useState`:

```js
{
  rolling: false,       // gates the Roll button disabled state
  result: null,         // { terms: [{ sides, rolls: [n,…] }], flat: n, total: n, isCrit, isFumble }
  label: "",            // e.g. "Longsword ATK"
}
```

Set `rolling: true` on roll initiation, then use a single `setTimeout(~1100ms)` to resolve the result and set `rolling: false`. Do not use `setInterval` for the number-cycling animation — drive it entirely with CSS so the JS thread is never blocked by animation ticks. The 90ms number-cycling described in the story should be a CSS `animation-duration` on the cycling element, not a JS timer.

**iOS Safari quirk**: `transform: scale()` animations that also animate `box-shadow` (for the glow) can cause layer compositing jank on iOS Safari. Use `filter: drop-shadow()` instead of `box-shadow` for the crit/fumble glow, which composites on the GPU and does not repaint. Also ensure the animated elements have `will-change: transform` to prevent layout thrashing.

**Stagger for combo rolls**: The 200ms stagger between die groups can be `animation-delay` on each group's chip container — no JS timer needed.

---

### Where to put the new code

**ADR-002 flag**: CharacterSheet.jsx is currently 2,761 lines, already past the ~2,500 line revisit threshold stated in ADR-002. Adding the dice roller — a genuinely independent sub-feature with its own state, parser utility, animation styles, and sub-components — is the exact scenario ADR-002 identified as warranting a split.

**Recommendation**: Extract the dice roller as `src/components/DiceRoller.jsx` before or as part of this story. It receives `weapons` and `stats` as props (both already available on `char`) and `pal` for theming. It owns its own `rollState`, `history`, and `advantageMode` state internally. It does not need `patchSession` or any backend call. CharacterSheet.jsx imports it as `<DiceRoller weapons={char.weapons} stats={char.stats} pal={pal} />` and renders it at the bottom of the Combat tab section, replacing the inline implementation. This reduces CharacterSheet.jsx by the ~200–300 lines the roller will occupy and keeps the feature self-contained.

If the builder chooses to keep it inline (e.g., for schedule reasons), flag that the next architectural review should split it. Do not add more sub-features inline after this one.

---

### Scope boundaries — resist adding

- **Saving throws with proficiency**: correctly out of scope; proficiency bonus is not stored. Do not approximate it.
- **Auto-damage application**: correctly excluded. Do not add even as an option — it requires the DM adjudication step and would complicate the session state model.
- **Roll visibility / sharing**: the story lists this as a story 05 extension. The history log in this story is purely local state. Do not wire it to `patchSession` or any broadcast mechanism here.
- **Sound effects**: out of scope. CSS-only animation is sufficient and avoids autoplay policy headaches.
- **d100 (percentile) display**: the free picker includes d100. Roll it as a single 1–100 result (not 2d10 tens/units), which is simpler and sufficient for 5e's rare percentile uses.

---

### Summary of implementation tasks

1. Write `parseDiceExpr(str)` utility — pure function, no React, tested mentally against `"1d8"`, `"1d8+3"`, `"1d8+2d6"`, `"+5"` (flat only), `"-1"` (negative flat).
2. Extract `DiceRoller.jsx` (preferred) or add inline section to Combat tab.
3. Wire weapon ATK/DMG buttons to read from `item.mods?.find(m => m.attribute === "Attack Bonus")` and `item.mods?.find(m => m.attribute === "Damage")`.
4. Wire ability check circles to compute modifier via existing `modOf(score) + itemBonuses` formula — same as the rest of the sheet.
5. Inject CSS keyframes via `<style>` tag; use `filter: drop-shadow` not `box-shadow` for glow on animated elements.
6. Persist collapsible state to `sessionStorage` key `dnd_dice_open_${slug}`.
7. Disable roll button while `rolling === true`; re-enable on `setTimeout` completion.
8. History log: plain `useState` array, max 5 entries, no persistence.
