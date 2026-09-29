# Feature Story: Lingering Spell Effects (Hex, Bless, Hunter's Mark…)

**Status**: Draft (2026-09-28): not scheduled
**Source**: Playtest. Casting Hex showed that many spells aren't "roll damage once"

## The problem

The app treats an attack spell as a one-off hit. Many 5e spells instead **attach an effect to a creature that lasts until the spell ends**, and change later rolls while it lasts. Hex is the example from play:

- On cast: pick a target and an ability; the target has **disadvantage on checks with that ability**.
- While it lasts: **+1d6 necrotic damage whenever the caster hits that target**.
- It lasts up to an hour, **ends when the caster's concentration breaks**, and can be moved to a new target when the first one drops.

Similar shape: Hunter's Mark (+1d6 on hits), Bless (+1d4 to attacks and saves for up to 3 allies), Bane, Faerie Fire (attacks against have advantage), Hold Person (paralyzed, save each turn).

## Goal

A spell can place a named **effect** on one or more tokens. The effect is visible on the map (see the condition rings in the Token Condition Rings preview), lasts until it's ended, and nudges the rolls it affects. The dice aren't automated away: the player or DM still decides, and the app reminds them.

## Sketch

- **Effect record** on the target (character or NPC): `{ id, name: "Hex", source: {type, sourceId}, kind: "harmful"|"helpful", concentration: true, rider?: { onHitDamage: "1d6", damageType: "necrotic" }, disadvantage?: ["Strength"], startedAt }`.
- **Spell setup** (character editor): a spell can be marked "places an effect", with its rider (extra damage on hit), any disadvantage/advantage it imposes, and whether it needs concentration.
- **Casting** from the attack bar or the DM's Take Action applies the effect to the target, sets the caster's concentration to that spell, and logs it (Story 69 history).
- **While active:**
  - The target's token shows the effect ring (a curse sigil for Hex).
  - The caster's attack bar shows "+1d6 Hex" on attacks against that target and adds it to the damage roll (can be switched off).
  - Checks against a hexed ability show a "disadvantage" reminder.
- **Ending it:** dropping concentration (the existing Concentration toggle), the DM ending it, or the target falling (offer "move Hex to a new target").

## Open questions

- Which effects do we pre-define (Hex, Hunter's Mark, Bless, Bane, Faerie Fire, Hold Person) vs. leave for a generic "custom effect" form?
- Saves each turn (Hold Person): a reminder on the target's turn, or out of scope?
- Do players see effects on enemies they didn't cast? (Probably yes; the ring is visible at the table.)

## Out of scope for now

Full rules automation (auto-applying disadvantage to rolls, tracking durations by the clock).
