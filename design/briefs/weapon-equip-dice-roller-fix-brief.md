# Design Brief: Weapon Equip Fix — Dice Roller Visibility

**Story**: `design/stories/48-weapon-equip-dice-roller-fix.md`
**Type**: Correctness fix (no new feature surface, no data model change)
**Tier**: Tier 1 — combat-critical. A weapon you cannot roll is a weapon you cannot use.

---

## 1. Design intent

A player mid-fight should never have to leave the surface they are looking at to make a weapon
rollable. The Combat tab's weapon quick-reference becomes the single authoritative answer to
"what can I swing right now, and what else am I carrying" — equipped weapons on top, stowed
weapons visible-but-dimmed directly below, one tap between them. The mental model to reinforce:
**the dice roller is a mirror of the quick-reference, not a separate list.** If a weapon is bright
in the quick-reference, it has a button in the roller. If it's dim, it doesn't. That equivalence
must be learnable in one tap.

The second half of the fix is diagnostic honesty: a weapon that is equipped but has no Attack Bonus
and no Damage modifier can never be rollable, and today it fails silently. It must say so on its own row.

---

## 2. Information hierarchy

Within the Combat tab weapon quick-reference block, ranked:

1. **Equipped weapon names + their to-hit / damage values** — brightest, `pal.text` / `pal.gem`.
   This is what the eye must find in under a second under pressure.
2. **The equip glyph (■ / □)** — high-contrast but small. Second because it's the action, and
   actions come after orientation. Its *state* is ambient (readable without looking directly at
   it); its *affordance* is discovered on the second glance.
3. **`STOWED` divider label** — a quiet structural signpost. Legible enough to answer "where's my
   other weapon?" without a tap, never competing with the equipped rows above it.
4. **Stowed weapon rows** — 0.5 opacity. Present, findable, deliberately backgrounded.
5. **`— no attack or damage set` diagnostic note** — muted, italic, occupies the columns where
   numbers would have been. Low prominence by design: it's rare, and when it appears it's already
   adjacent to the row you're staring at.
6. **`N EQUIPPED` count in the section header** — lowest. Ambient confirmation only.

**Competition resolved:** the equip glyph and the attunement gem indicator both want the left edge
of the row. In the Inventory tab today the ■ sits left of the name and the attunement gem sits
right, before the expand arrow. Keep exactly that split on the Combat tab quick-reference — do not
invent a new arrangement. Consistency across the two surfaces is worth more than local optimisation.

**Not touched:** the dice roller's own internal hierarchy is unchanged. Its weapon rows simply
appear and disappear.

---

## 3. Wireframes

### 3a. Combat tab — Weapons quick-reference (~400px)

```
┌─────────────────────────────────────────────┐
│ ①WEAPONS                        ②2 EQUIPPED │
│─────────────────────────────────────────────│
│ ③■  Longsword          ④+7   ⑤1d8+4   ⑨◆ ▾ │
│ ③■  Shortbow             +5    1d6+3     ▾ │
│ ③■  Torch        ⑥— no attack or damage  ▾ │
│ ──────────────── ⑦STOWED ─────────────────  │
│ ⑧□  Warhammer            +6    1d10+4    ▾ │
│ ⑧□  Dagger               +5    1d4+3     ▾ │
│ ⑩ ＋ 2 more stowed                          │
└─────────────────────────────────────────────┘
        ↓ (unchanged section order)
┌─────────────────────────────────────────────┐
│ ⑪ ⚔ DICE ROLLER                          ⌄  │
└─────────────────────────────────────────────┘
```

① **Section header** — existing `WEAPONS` label, `.label-ui` (IM Fell English 11px, 0.22em,
`pal.textMuted`). Unchanged.

② **`N EQUIPPED` count** — right-aligned in the header row, same `.label-ui` treatment at
`pal.textMuted`, opacity 0.7. Ambient only; no tap target. Renders only when total weapons > 1.
The cheapest possible way to make "some of your weapons are not here" pre-attentive.

③ **Equip glyph, equipped state** — filled ■, 12px visual (up from Inventory's 10px — this surface
is used under pressure), `pal.gem`. Tap target **44×40px** via a `::before` overlay, not by
inflating the glyph. 8px gap between the glyph's target and the name/expand region so a thumb
aiming at "expand" cannot unequip a weapon. Left-most because it is the row's state, and state
reads before content.

④ **To-hit** — existing treatment. Cinzel, `pal.accentBright`. Fixed-width right-aligned column so
multiple rows form a scannable vertical stack.

⑤ **Damage expression** — existing treatment. Fixed-width column right of to-hit.

⑥ **No-mods diagnostic** — replaces columns ④ and ⑤ when the weapon has neither an Attack Bonus
nor a Damage mod. Crimson Text italic 12px, `pal.textMuted`, text: `— no attack or damage set`.
This row is *equipped* (■ filled, name at full brightness) but has no roller button, and this note
is the only thing that explains why. Non-interactive; the fix lives in edit mode and this is not
the moment to send someone there. Renders on both equipped and stowed rows.

⑦ **`STOWED` divider** — a centred label interrupting a 1px `pal.border` rule (label sits on the
rule with 10px of background padding either side). `.label-ui`, 10px, `pal.textMuted` at 0.75
opacity. Renders **only when at least one weapon is unequipped** — sparse-first: a fully-equipped
character never sees this row exists.

⑧ **Equip glyph, stowed state** — hollow □, 12px, 1.5px stroke, `pal.textMuted`. Entire stowed row
(glyph + name + numbers) at **0.5 opacity**. Numbers stay visible on stowed rows deliberately: the
player choosing what to draw wants to compare damage before drawing it.

⑨ **Attunement gem** — existing indicator, unchanged position (right of the value columns, left of
the expand arrow), unchanged behaviour. Shown only on items with `requiresAttunement`.

⑩ **`＋ N more stowed`** — appears only when stowed count > 3; the first 3 stowed rows render, the
remainder collapse behind this control. `.btn-ghost`-adjacent styling, 11px `.label-ui`, full-width
44px tap row. Reuses the existing "+N more" / "Show all N" idiom already used by DM condition chips
and NPC ability lists. Toggles to `− Show less` when expanded.

⑪ **Dice roller header** — unchanged position and collapse behaviour (collapsed by default,
`dnd_dice_open_${slug}`). Gains one transient state: see motion spec §4.3.

### 3b. Dice roller weapon block — the two states that matter

Some weapons equipped & rollable (unchanged):
```
┌─────────────────────────────────────────────┐
│ Longsword          [ ⚔ ATK ]   [ ◆ DMG ]    │
│ Shortbow           [ ⚔ ATK ]   [ ◆ DMG ]    │
└─────────────────────────────────────────────┘
```

Nothing rollable (new):
```
┌─────────────────────────────────────────────┐
│ ⑫ Nothing equipped — equip a weapon above   │
└─────────────────────────────────────────────┘
```

⑫ **Roller empty nudge** — Crimson Text italic 13px, `pal.textMuted`, centred, 32px tall. Renders
when `rollableWeapons.length === 0` **and** `weapons.length > 0`. When the character has no weapons
at all, the whole weapon block does not render (no nudge — there is nothing to equip). "above" is
literally accurate: the quick-reference sits directly above the roller in the Combat tab and in the
session-mode Combat sub-tab.

### 3c. Session mode — Combat sub-tab

Identical structure to 3a, using `.cs-sm-` prefixed classes. The session-mode right column is
narrower in the two-column layout (roughly 480–620px at desktop) but the row anatomy is unchanged —
it was already designed at ~400px.

### 3d. Session mode — Loadout sub-tab

The simplified 2-column name/qty/attunement grid gains the ■/□ glyph on **weapon** rows only, in
the same left-most position with the same 44px target. No `STOWED` grouping here — this grid is an
inventory listing, not a combat surface, so unequipped weapons stay in document order at 0.5
opacity. Equipment rows are untouched (out of scope per the story).

---

## 4. Motion & animation spec

**4.1 — Equip: □ → ■**
```
    Trigger:      tap the hollow □ on a stowed row
    Animation:    glyph — stroke collapses to fill; opacity 0.5 → 1.0 on the whole row
    Duration:     120ms, ease-out
    Communicates: "this is now yours to use"
```

**4.2 — Row migrates from Stowed group to equipped list**
```
    Trigger:      same tap, begins immediately after 4.1 starts (not sequenced)
    Animation:    row exits the stowed group (max-height → 0, opacity → 0, 160ms ease-out)
                  and enters at the end of the equipped list (max-height 0 → auto,
                  opacity 0 → 1, translateY −4px → 0, 200ms ease-out, 40ms delay)
    Duration:     ~240ms total
    Communicates: "it moved to the list you roll from" — this motion IS the undo
                  affordance. The player sees exactly where the row went, so a
                  mis-tap needs no confirm dialog and no toast: tap it again.
```
If the equipped list is off-screen above the fold, do **not** auto-scroll. The roller feedback
(4.3) is the confirmation in that case.

**4.3 — Dice roller acknowledges a new rollable weapon**
```
    Trigger:       rollableWeapons gains an entry
    Roller OPEN:   the new weapon row enters — opacity 0 → 1, translateY −4px → 0,
                   max-height 0 → auto. 200ms ease-out, 80ms after the tap.
    Roller CLOSED: the collapsed header's label cross-fades from "⚔ DICE ROLLER"
                   to "⚔ LONGSWORD READY" (140ms), holds 1400ms, cross-fades back
                   (140ms). Header border-color lifts to pal.accent for the same
                   window. No auto-expand — never move the page under someone's thumb.
    Communicates:  closes the causal loop between the tap and its consequence, which
                   is the entire point of this story. Without this, equipping from
                   the Combat tab while the roller is collapsed produces zero visible
                   result — the exact failure mode we are fixing.
```
Truncate the weapon name to 18 chars in the header flash. If two weapons are equipped within the
hold window, the label shows `⚔ 2 WEAPONS READY` and the timer restarts.

**4.4 — Unequip: ■ → □**
```
    Trigger:      tap the filled ■ on an equipped row
    Animation:    reverse of 4.1 + 4.2, 200ms ease-out. Roller row exits with
                  opacity 1 → 0 + max-height → 0, 160ms ease-out.
    Communicates: "stowed, still carried." No warning, no confirm — fully reversible,
                  and a confirm dialog on a reversible one-tap action is a tax.
```

**4.5 — `STOWED` divider mounts / unmounts**
```
    Trigger:      stowed count crosses 0 ↔ 1
    Animation:    max-height + opacity, 180ms ease-out
    Communicates: structural — "a second category now exists / no longer exists"
```

**4.6 — `＋ N more stowed` expand**
```
    Trigger:      tap
    Animation:    max-height 0 → auto, 200ms ease-out; rows stagger 30ms each
    Communicates: "these were here all along"
```

**4.7 — No-mods diagnostic note**
```
    Instant, no animation. It is a static property of the weapon, not a change
    the user caused or needs to track spatially.
```

**4.8 — `N EQUIPPED` count changing**
```
    Instant, no animation. Incidental confirmation; animating it would pull the
    eye away from the row that actually moved.
```

**4.9 — `prefers-reduced-motion: reduce`**
All of the above collapse to `0ms` — rows appear/disappear in place, glyph state swaps instantly,
the 4.3 header label still swaps and still holds 1400ms (it is information, not decoration) but
cross-fades in 0ms.

---

## 5. Interaction model

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| Equip glyph ■/□ (Combat tab, session Combat sub-tab, session Loadout sub-tab, Inventory tab) | Single tap, 44×40px target | Glyph state flips + row reflows optimistically (§4.1–4.2) | `patchSession({ weapons: [...] })`, no auth. Debounce **300ms**, coalescing rapid taps into one write | Tap again — idempotent toggle. On API failure: row animates back to its prior position (200ms) and the glyph reverts. No error toast; the reverting motion is the message |
| Weapon row body | Single tap anywhere except the glyph | Expands description (existing behaviour) | none | Tap again to collapse |
| `＋ N more stowed` | Single tap, full-width 44px row | Expands remaining stowed rows | none (local state, not persisted) | Tap `− Show less` |
| Dice roller weapon ATK/DMG | Unchanged | Unchanged | Unchanged | Unchanged |
| No-mods diagnostic note | — | Non-interactive | — | — |

**No hold, no swipe.** A hold-to-equip would be undiscoverable for a control whose entire purpose
is discoverability. A swipe would collide with the map pan/token drag gestures already live in
session mode.

**Optimism is mandatory.** The story requires the roller to update with no reload. Local state
drives the reflow and the roller's filtered list; the network write follows. Never gate the reflow
on the response.

---

## 6. Weapon filtering logic — the spec the roller must implement

This is the correctness core. `DiceRoller.jsx` must build its weapon list as:

```
rollable(weapon) =
      weapon.equipped !== false                       // absent === equipped
  &&  hasCombatMod(weapon)

hasCombatMod(weapon) =
  weapon.mods?.some(m =>
    (m.attribute === "Attack Bonus" || m.attribute === "Damage")
    && m.value !== "" && m.value != null              // presence, not truthiness
  )
```

Three traps that are the leading root-cause candidates for the reported bug — all three must be
handled:

1. **`equipped !== false`, never `!!equipped`.** `equipped` is absent on every weapon created
   before the field existed. Treating absent as unequipped would hide most of the party's weapons;
   treating explicit `false` as equipped is the bug we're fixing. Only the `!== false` form is correct.
2. **Do not qualify a Damage mod with `parseModInt`.** `parseModInt` uses `/^[+-]?\d+$/` and
   deliberately rejects dice notation, so a weapon whose Damage mod is `1d8` returns `NaN` and
   would be silently excluded from the roller while looking perfectly normal in Inventory.
   **This is my leading hypothesis for the reported symptom.** Damage-mod qualification is a
   presence check; the *value* is later handed to `parseDiceExpr`, which is the parser that
   understands dice.
3. **A mod value of `0` qualifies.** `Attack Bonus: +0` is a legitimate weapon. Test presence, not
   truthiness.

Corollary for the UI: the quick-reference's `— no attack or damage set` note must be driven by
**the same `hasCombatMod` predicate** the roller uses. One predicate, two consumers — if they can
drift, they will, and the drift is invisible until someone is mid-combat.

The equip filter applies to the **roller only**. It must not change `_itemBonuses`, the
ability-score flyout, or the armor breakdown — those already handle `equipped === false` correctly
and are out of scope.

---

## 7. Edge cases and empty states

| Case | Result |
|---|---|
| **No weapons at all** | Quick-reference block renders its existing empty message. Roller's weapon block does not render at all — no nudge, no `STOWED` divider, nothing to equip. |
| **All weapons equipped** (the common, healthy state) | No `STOWED` divider, no `＋ N more`, no roller nudge. The surface is visually identical to today plus a column of ■ glyphs and the `N EQUIPPED` count. This is the state that must look intentional and calm. |
| **All weapons unequipped** (the reported bug's shape) | Every row sits under `STOWED` at 0.5 opacity; the roller shows ⑫ `Nothing equipped — equip a weapon above`. One tap resolves it. |
| **Exactly 1 weapon, unequipped** | `STOWED` divider renders above a single row. Slightly heavy chrome for one row, accepted — the divider is what makes the dim row legible as a *category* rather than a rendering bug. |
| **Equipped weapon with no ATK/DMG mod** | Row at full brightness, ■ filled, columns replaced by ⑥. No roller button. |
| **Stowed weapon with no ATK/DMG mod** | Row at 0.5 opacity, □ hollow, ⑥ shown at the same 0.5. Equipping it does **not** produce a roller row — and the note is right there explaining why. No §4.3 header flash fires in this case (nothing became rollable); the row reflow alone is the feedback. |
| **> 3 stowed weapons** | First 3 render, rest behind `＋ N more stowed`. Threshold of 3 matches the DM card's condition-chip overflow. |
| **Rapid double-tap on the glyph** | Debounced to a single write reflecting the final state. Row reflow plays for each tap — visually busy, but honest. |
| **`patchSession` failure** | Row reverts with motion (§5). No modal, no toast. |
| **DM viewing a player's sheet** | Toggle is live for the DM too — it writes through the same no-auth session path. Correct: a DM adjudicating "you don't have that drawn" should be able to enforce it. |
| **`vellum` palette** | Stowed rows at 0.5 opacity on a light parchment background remain legible; verify the hollow □ at `pal.textMuted` reads as an outline and not a smudge. Bump the stroke to 2px on vellum if needed. |

---

## 8. Mobile vs desktop delta

| | 320px mobile | ≥900px desktop |
|---|---|---|
| Glyph | 12px visual, 44×40px target, 8px gap to name | Same target (touch-first); hover raises glyph to `pal.accentBright` |
| Weapon name | Truncates with ellipsis at the to-hit column edge | Full name, ample room |
| To-hit / damage columns | Fixed-width right-aligned, 44px + 64px | Same, more slack |
| No-mods note ⑥ | Below 360px, wraps to a second line beneath the name (indented to the name's left edge) rather than squeezing into the columns | Inline, occupying the two value columns |
| `N EQUIPPED` header count | Abbreviates to `2/5` below 340px | Full `2 EQUIPPED` |
| `STOWED` divider | Unchanged | Unchanged |
| §4.3 header flash | Unchanged — this is the mobile-critical feedback path, since the roller is more likely off-screen on a phone | Unchanged |

Nothing disappears at any width.

---

## 9. Open questions

1. **Root cause is still unconfirmed** (story's own open question). Ranked hypotheses, for the
   architect to confirm with a 5-minute repro before writing code:
   (a) the roller qualifies weapons with `parseModInt`, so any `NdM`-style Damage mod is silently
   excluded — **most likely**;
   (b) the roller does not filter by `equipped` at all, and the reported weapon genuinely lacked an
   ATK/DMG mod, so it never qualified regardless;
   (c) the weapon was fine and the player simply could not reach the toggle from Session Mode.
   The design in this brief fixes all three independently, so implementation is not blocked on the
   answer — but knowing which one it was tells us whether other rollable-value paths (spell damage,
   ability checks) share the bug.

2. **Should stowed weapons appear in the roller as dimmed/disabled rows instead of being absent?**
   Recommend **no** — story requirement 3 explicitly wants the rollable list focused, and a
   disabled button under pressure is a trap. Flagged because it's the one place where I'm
   overriding a plausible alternative reading.

3. **Does the DM party card need the same toggle?** Story 51 (`dm-card-expand-loadout`) is already
   circling this surface. Kept out of scope here to avoid two briefs designing the same row.
   Recommend the DM-side equip affordance be specced in 51, referencing this brief's glyph and
   motion vocabulary.

4. **`＋ N more stowed` threshold of 3** — assumed for consistency with existing overflow patterns.
   If real characters routinely carry 5+ weapons, 3 will feel stingy; easy to change to 4.

5. **Should equipping in the Combat tab also auto-open the collapsed dice roller?** Recommend no
   (§4.3) — moving the page under a thumb mid-combat is worse than a 1.4s header flash.

---

## 10. Implementation checklist

- [ ] One shared `hasCombatMod(weapon)` predicate; consumed by both the roller filter and the ⑥ diagnostic note
- [ ] `equipped !== false` everywhere, never `!!equipped`
- [ ] Presence-not-truthiness mod-value test (`+0` qualifies, `1d8` qualifies)
- [ ] ■/□ glyph with a 44×40px `::before` target and an 8px dead zone before the row-expand region
- [ ] `STOWED` divider renders only when stowed count ≥ 1
- [ ] Roller nudge ⑫ renders only when `rollableWeapons.length === 0 && weapons.length > 0`
- [ ] Collapsed-roller header flash (§4.3) — the single most important new behaviour in this brief
- [ ] Optimistic reflow, 300ms debounced `patchSession`, animated revert on failure
- [ ] Parity across: Combat tab (classic sheet), session-mode Combat sub-tab, session-mode Loadout sub-tab
- [ ] All keyframes static in CSS files (no runtime injection), all disabled under `prefers-reduced-motion`
- [ ] Verify on `vellum`

---

## Notes on the design decisions worth your attention

**The one thing to protect in review**: the collapsed-roller header flash (§4.3). The dice roller is collapsed by default (`dnd_dice_open_${slug}` defaults to `false`), so without it, tapping the new equip glyph in the Combat tab produces literally no visible change in the roller — reproducing the original "did that work?" confusion in a new place. It costs zero resting pixels.

**The likely actual bug**, flagged for `code-architect` to confirm before implementation: if `DiceRoller.jsx` qualifies weapons using `parseModInt` on the Damage mod, then `parseModInt`'s `/^[+-]?\d+$/` guard (which exists specifically to reject dice notation) returns `NaN` for a Damage mod of `1d8` — and the weapon silently never appears in the roller while looking completely normal in the Inventory tab. That matches the reported symptom better than the equipped-flag theory does. This is a hypothesis for the architect to confirm against the actual source, not a finding from reading `DiceRoller.jsx` directly.

**Where this pushes back on the story**: its open question asks whether "a link/shortcut back to Inventory is sufficient." It isn't. Sending a player to a different tab mid-combat to fix a combat problem is the failure, not the workaround. The toggle goes on the surface they're already on.
