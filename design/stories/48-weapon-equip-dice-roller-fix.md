# Feature Story: Weapon Equip Fix — Dice Roller Visibility

**Status**: Needs UX design
**Source**: RPG Consultant (live-session feedback)
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

A player had a weapon sitting in their inventory during a live session and it never showed up as a rollable option in the Combat tab's dice roller — and they had no way to mark it equipped from wherever they were looking. At the table this is a hard stop: you can't attack with a weapon you can't roll for. This is a correctness fix, not a new feature — equipped weapons with an Attack Bonus or Damage modifier should always be rollable, and a player should always be able to find the equip toggle when they need it mid-session.

## User stories

- As a player, I want every weapon I currently have equipped and that has an attack bonus or damage value to appear in my dice roller's weapon list, so that I can roll for it during combat.
- As a player, I want to be able to mark a weapon as equipped/unequipped from any screen where I'd naturally look for it during a live session (not just a separate inventory-editing screen), so that I'm not stuck mid-fight unable to pull out a weapon I'm carrying.
- As a player, I want unequipped weapons to disappear from my rollable list, so my quick-reference stays focused on what I can actually use right now.

## Functional requirements

- The dice roller's weapon roll buttons must only offer weapons that are (a) marked `equipped` and (b) carry an Attack Bonus or Damage modifier. Today the roller appears to source from the full weapons list regardless of equipped state — confirm and fix.
- The equip/unequip control must be reachable from whatever surface a player is actually using live at the table. Today the equip toggle only lives in the Inventory tab's expandable weapon row; if a player is working from Session Mode (the two-column live-play layout) or the Combat tab's weapon quick-reference, they need a way to see and flip equipped state without having to hunt for a different tab.
- Toggling equipped state should take effect immediately in the dice roller — no page reload, no re-entering the tab.
- This should hold true consistently across both the classic full character sheet and Session Mode, since players may be using either at the table.

## Data model changes

None. `weapons[].equipped` already exists (defaults `true` when absent). This is a matter of making sure every surface that lists weapons for rolling actually respects the field, and every surface where a player would look for the toggle actually exposes it.

## Out of scope

- Changing how equip/unequip works for equipment (non-weapon) items — this story is scoped to the reported weapon/dice-roller symptom.
- Any new attunement, slot-limit, or loadout-management mechanics.

## Open questions

- Root cause is unconfirmed — is the roller not filtering by `equipped` at all, is the specific weapon missing an Attack Bonus/Damage mod entirely (so it never qualifies), or is the equip toggle simply not visible from where the player was looking (e.g., Session Mode's simplified loadout view)? Worth a quick repro before scoping the fix.
- Should the equip toggle be duplicated onto the Combat tab / Session Mode weapon quick-reference, or is a link/shortcut back to Inventory sufficient?

## UX Design

**Brief**: `design/briefs/weapon-equip-dice-roller-fix-brief.md`
**Tier**: Tier 1 — combat-critical.

### Design intent

The dice roller is a *mirror* of the Combat tab's weapon quick-reference, not a separate list. Bright row in the quick-reference → button in the roller. Dim row → no button. Making that equivalence visible and one-tap reversible is the whole fix — sending a player to a different tab mid-combat to fix a combat problem is the failure, not an acceptable workaround (this overrides the story's own open question about a link/shortcut being sufficient).

### Where the toggle lives

The equip glyph (■ filled / □ hollow, same semantics as the Inventory tab today) is added to the **Combat tab weapon quick-reference** (classic sheet), the **session-mode Combat sub-tab** quick-reference, and the **session-mode Loadout sub-tab** grid. 12px visual glyph, **44×40px tap target**, with an 8px dead zone before the row's expand region so a thumb aiming at "expand description" can't unequip a weapon mid-fight.

The quick-reference splits into two groups: equipped weapons first at full brightness; a `STOWED` divider (renders only when ≥1 weapon is unequipped — sparse-first); stowed weapons below at 0.5 opacity with numbers still visible (compare damage before drawing); `＋ N more stowed` overflow past 3. Section header gains an ambient `N EQUIPPED` count.

### Diagnostic note for unrollable-but-equipped weapons

A weapon with no Attack Bonus and no Damage mod can never be rollable. Its row shows `— no attack or damage set` (italic, muted) in place of the value columns — full brightness, ■ filled, so it's clearly *equipped*, just nothing to roll. Driven by the same predicate the roller uses, so the two can never drift apart.

### Weapon filtering logic (the correctness core)

```
rollable(w) = w.equipped !== false && hasCombatMod(w)

hasCombatMod(w) = w.mods?.some(m =>
  (m.attribute === "Attack Bonus" || m.attribute === "Damage")
  && m.value !== "" && m.value != null)
```

Three traps, all candidate root causes for the reported bug:

1. `equipped !== false`, **never** `!!equipped` — the field is absent on every pre-existing weapon; absent must mean equipped.
2. **Do not qualify a Damage mod with `parseModInt`.** It rejects dice notation (`/^[+-]?\d+$/`), so a `1d8` Damage mod yields `NaN` and the weapon silently vanishes from the roller while looking normal in Inventory. **Leading hypothesis for the reported bug.** Qualification is presence-only; the value goes to `parseDiceExpr` later.
3. A mod value of `0` qualifies — `Attack Bonus: +0` is real. Presence, not truthiness.

The filter applies to the **roller only** — `_itemBonuses`, the ability-score flyout, and armor breakdown already handle `equipped === false` correctly and must not change.

### Motion (full spec §4 of the brief)

- Equip: glyph fill 120ms; row opacity 0.5→1.0.
- Row migrates from Stowed into the equipped list (~240ms) — **this motion is the undo affordance**, no confirm dialog needed since the player sees exactly where the row went.
- **Collapsed roller header flash** (the single most important new behavior): when a weapon becomes rollable while the roller is collapsed (its default state), the header cross-fades `⚔ DICE ROLLER` → `⚔ LONGSWORD READY`, holds 1400ms, fades back — no auto-expand. Without this, equipping from the Combat tab while the roller is collapsed produces zero visible feedback, reproducing the exact "did that work?" confusion this story exists to fix.
- Unequip is the reverse, no confirm — fully reversible one-tap actions don't need one.
- All keyframes static in CSS, disabled under `prefers-reduced-motion` (header hold survives at 0ms transition — it's information, not decoration).

### Interaction

Single tap only (no hold — undiscoverable; no swipe — collides with map pan/token drag in session mode). Optimistic reflow; `patchSession({ weapons })` debounced 300ms, no auth. On failure the row animates back and the glyph reverts, no error toast.

### Empty states

- No weapons at all: quick-reference shows its existing empty message; roller's weapon block doesn't render (nothing to equip, no nudge).
- All equipped (healthy default): no divider, no overflow, no nudge — visually identical to today plus the glyph column.
- All unequipped (the reported bug's shape): everything under `STOWED`; roller shows `Nothing equipped — equip a weapon above`.

### Open questions for the user

1. **Repro first**, ranked: (a) `parseModInt` rejecting a `1d8` Damage mod — most likely; (b) no `equipped` filter at all + weapon genuinely had no mod; (c) toggle unreachable from Session Mode. Design fixes all three independently, so build isn't blocked — but the answer indicates whether spell-damage/ability-check paths share the bug.
2. Stowed weapons absent from the roller (recommended) vs. shown dimmed/disabled — recommending absent since a disabled button under pressure is a trap.
3. DM party card equip toggle — deliberately left to Story 51 to avoid two briefs designing the same row; Story 51 should reuse this glyph/motion vocabulary.
4. `＋ N more stowed` threshold assumed at 3 (matches condition-chip overflow elsewhere); trivially changed to 4.
5. No auto-open of the collapsed roller on equip — the 1.4s header flash is preferred over moving the page under a thumb mid-combat.
