# Feature Story: Ability Check Dice — 2d6 + Modifier

**Status**: Ready for Architect Notes
**Source**: DM ruling

---

## Goal

Ability checks currently roll 1d20 + ability modifier. The DM's system uses 2d6 + ability modifier instead. Fix the player dice roller so ability check buttons roll 2d6 and add the correct modifier (the derived +/- value, not the raw score). Advantage/disadvantage should work too: advantage rolls 3d6 and keeps the two highest; disadvantage rolls 3d6 and keeps the two lowest.

The ability chips should be tappable in every mode where they appear — the Dice Roller panel (Combat tab) and the session mode ability grid. Currently the session mode chips are display-only; this story makes them active.

## User stories

1. As a player, when I click an ability chip (e.g. Strength), I want the dice roller to roll 2d6 + my ability modifier so that my roll uses the correct system.

2. As a player, when I have advantage or disadvantage set, I want the 2d6 ability check to roll 3d6 and keep the best or worst two dice so that adv/dis works correctly for this system.

3. As a player, I want the ability chips in session mode to be clickable and trigger the same 2d6 roll as the Dice Roller panel, so that I can roll checks regardless of which mode I am in.

## Scope

- Change `rollAbility` in `src/components/DiceRoller.jsx` to use `2d6` instead of `1d20`. Keep `onClick` (single click).
- The flat modifier already uses `getAbilityMod` (which returns `floor((score-10)/2) + item bonuses`) — no change needed there.
- Add 2d6 adv/dis handling in `executeRoll`: when the roll is 2d6 and adv/dis mode is active, roll a third d6 and drop the lowest (adv) or highest (dis) before summing.
- The 3d6 keep-2 result display should show all three dice with the dropped one visually distinguished (struck-through or dimmed), consistent with how d20 adv/dis discarded rolls are shown.
- Crit/fumble display does not apply to 2d6 — no special handling needed.
- Wire up the ability mod chips in `src/features/characterSheet/CharacterSheetSessionMode.jsx` to call `rollAbility` (or equivalent) on click. The Dice Roller is already rendered in session mode; ensure it opens and fires the roll when a chip is tapped from the session mode grid.
- No backend changes. No other roller modes affected.

---

## Architect Notes

**Applies**: ADR-002 (feature-sliced screens), ADR-013 (game-rule logic lives in frontend constants — this 2d6 house rule is a frontend-only rule change, no backend/DynamoDB involvement).

**Tech approach**: This is a self-contained change to `DiceRoller.jsx` plus a wiring change in `CharacterSheetSessionMode.jsx`. No new infrastructure, no new pattern, no ADR needed. The `executeRoll` result object already carries `advKept`/`advDiscarded` scalars for the existing d20 adv/dis path — reuse that shape rather than inventing a parallel one. Roll-history persistence already flows through `buildCharacterRollPayload` / `buildLocalRollHistoryEntry` and needs no signature change (see the roll-history caveat under Risks).

Concrete function changes, in order:

1. **`rollAbility` (line 214)** — change the two hard-coded values only:
   - `groups: [{ count: 1, sides: 20 }]` → `groups: [{ count: 2, sides: 6 }]`
   - `isD20Attack: true` → `isD20Attack: false`
   The `flat: mod` via `getAbilityMod(stat)` is already correct — do not touch it. Setting `isD20Attack: false` is what correctly suppresses crit/fumble on 2d6 (crit/fumble are gated on `isD20Attack` at lines 153–154), so no separate "no crit for 2d6" guard is required.

2. **`executeRoll` (line 126)** — the current adv/dis block (lines 137–148) is gated on `isD20Attack && isSingleD20 && advMode !== "normal"` and cannot be reused as-is because it (a) requires `isD20Attack`, which is now false for ability checks, and (b) only rolls one extra die and keeps a single scalar. Add a **separate, parallel branch** for the 2d6 case rather than overloading the d20 branch. Detect it with a local like `isAbility2d6 = groups.length === 1 && groups[0].sides === 6 && groups[0].count === 2`. When `isAbility2d6 && advMode !== "normal"`: roll a **third** d6, combine with the two already in `rolledGroups[0].rolls`, sort, then for advantage keep the top two / for disadvantage keep the bottom two. Write the two kept values back into `rolledGroups[0].rolls` (so `diceTotal` at line 150 sums the correct two) and store the dropped die. The `advMode` state is labelled "d20 mode" in the UI (line 321) but functionally applies to any keep-highest/lowest roll — it is fine to reuse it for 2d6; just be aware the on-screen label says "d20 mode".

3. **Result object / display shape** — the existing `advKept`/`advDiscarded` fields are scalars and the single-die breakdown-chip renderer (lines 530–576) shows exactly two chips: one "used" + one struck-through "discarded". A 2d6-keep-2 needs to show **three** dice (two kept, one dropped). Two viable options — pick the smaller one:
   - **Preferred (least churn):** leave `advKept`/`advDiscarded` as they are for the d20 path, and for the 2d6 path store the full picture on the result object as a small new field, e.g. `keptRolls: [a, b]` + `droppedRoll: c`. Then in the breakdown-chip block add one branch: if `droppedRoll != null`, render the two kept values as normal "used" chips and the dropped value as a `line-through` / `opacity: 0.38` chip (reuse the exact `chipStyle("discarded")` already defined at lines 537–545 — do not invent new CSS). The 2d6 result renders through the **single-die** display path (not `isMultiGroup`, since it's one group), so the big die shape stays a d6 and the breakdown row underneath carries the three-chip story. That is consistent with how the story asks for "all three dice with the dropped one distinguished."
   - The struck-through visual treatment already exists and matches the d20 convention — no new styling work, which is the whole point of reusing `chipStyle`.

4. **Session mode chips (`CharacterSheetSessionMode.jsx`, lines 695–704)** — these are display-only `<div className="cs-sm-ability-chip">` with no handler. Do **not** duplicate `rollAbility` logic here. The `DiceRoller` is already rendered in the same component (line 1195) and owns the roll logic. Lift a trigger out of `DiceRoller` via one of:
   - **Preferred:** add a `ref` with `useImperativeHandle` on `DiceRoller` exposing `rollAbility(statName)` (or accept it as a callback prop the parent stores), then have each session-mode ability chip's `onClick` call it with the matching stat. `DiceRoller` already calls `ensureOpen()` inside `executeRoll` (line 129), so tapping a session-mode chip will auto-open/scroll the roller and fire the roll with no extra work.
   - Note the stat-name mismatch: session mode's `abilityMods` uses `a.name` sourced from `s.stat` (line 471), while `DiceRoller` keys stats by `s.name` (line 404) against `STAT_NAMES`. When wiring, pass the full stat name and let `DiceRoller` resolve the stat object from its own `stats` prop the same way its internal chip does (`stats.find(s => s.name === name)`), so the +/- mod and item bonuses are computed once, in one place.

**Scope boundary**:
- In: `rollAbility` → 2d6; new 2d6 adv/dis branch in `executeRoll`; 3d6 keep-2 breakdown display; session-mode chips made clickable and wired to the existing `DiceRoller`.
- Out: weapon attack/damage rolls (stay d20/parsed), free roll, DM dice roller (`DmDiceRoller.jsx` — not in scope, do not touch), the "d20 mode" label text (leave as-is unless the user asks to rename it), any backend or roll-history payload schema change.

**Performance notes**: None. Rolls are UI-only client-side RNG; no added network calls beyond the existing single `postCharacterRoll` fire-and-forget already in place.

**Cost notes**: None — no AWS resources touched.

**Dependencies**: None. All referenced code (`getAbilityMod`, `chipStyle` discarded variant, `ensureOpen`, `extractRollValues`) already exists.

**Risks / decisions needed**:
- **Roll-history value extraction is the sharp edge.** `extractRollValues` in `src/lib/rollHistory.js` (lines 24–29) returns exactly `[advKept, advDiscarded]` whenever those two fields are set. If you reuse `advKept`/`advDiscarded` for the 2d6 path you will silently record only two of the three dice AND mislabel which were kept. If you instead add `keptRolls`/`droppedRoll` (preferred option 3 above), update `extractRollValues` to handle that shape so the shared feed shows all three values (e.g. `[...keptRolls, droppedRoll]`) — otherwise the DM's shared roll feed and the local history rows will disagree with what's on screen. `exprLabel` via `buildDiceExprLabel` will read `2d6` from `groups[0].rolls.length` after you write two kept dice back — confirm you're writing 2 (not 3) rolls back into `rolledGroups[0].rolls` so the label says `2d6`, not `3d6`.
- **Decision for the user (minor):** the adv/dis toggle is labelled "d20 mode" in the roller header. Once ability checks are 2d6, that toggle also governs 2d6 checks, so the label is slightly inaccurate. Recommend renaming it to just "Roll mode" — flag to the user but not blocking.
- **Cycling animation die shape:** during the roll, `setCycleNum(rollDie(groups[0]?.sides || 20))` (line 158) and the spinner `DieShape` uses `selectedSides` (line 451), which tracks the free-picker, not the ability roll. This is a pre-existing cosmetic quirk (the spinner shape may not match the rolled die) — out of scope to fix here, but do not let the 2d6 change make it worse.
