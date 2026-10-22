# Feature Story: Lingering Spell Effects (Hex, Bless, Hunter's Mark…)

**Status**: In design (2026-10-21) — damage-rider prototype for a choice. Earlier: Draft (2026-09-28). **Manual step built:** a fixed list of effects (`src/lib/spellEffects.js`: Blessed, Hasted, Heroism, Shielded, Raging, Dodging, Hidden; Hexed, Marked, Baned, Outlined) is set by hand from the condition pickers and stored in the same `conditions` array. The map draws a gold halo for helpful effects and the curse sigil for Hexed. This story later sets them automatically from spells.
**Source**: Playtest. Casting Hex showed that many spells aren't "roll damage once"

## Decisions (2026-10-21)

- **Record the caster on an applied effect** (who cast it, from which spell) — needed for anything below.
- **Damage riders, documented on the effect**: Hexed = +1d6 necrotic and Marked (Hunter's Mark) = +1d6, applying only to the **caster's** hits on that target. How the +1d6 reaches the damage roll is to be chosen from a prototype (`design/prototypes/effect-damage-riders.html`):
  - **A — attack bar adds it**: when the caster rolls damage against a target they've hexed, the DAMAGE step shows a "✦ +1d6 Hex" chip (on by default, tap to drop it) and rolls it in.
  - **B — DM log offers it**: a damage roll from the caster against the hexed target shows "✦ Hexed by Eòghan: +1d6 necrotic" with a [Roll +1d6] button, so Deal Damage applies the total.
  - Players tend to forget riders or mistype the dice, so the app should carry it rather than rely on memory.
  - **Chosen: A only** (2026-10-21). B can't work reliably: rolls from the dice panel carry no target (and no attack), so the DM's log has nothing to match against the hexed target — and the only other case (the caster switching the chip off) is deliberate. The rider is part of the attack bar's damage roll for the caster against the target they hexed; the log row shows the split ("incl. ✦ Hex +4") and Deal Damage applies the total.
- **Concentration: not tied to anything yet** — it hasn't come up at the table. Effects last until removed by hand. Revisit after checking with the DM.
- **Helpful effects** (Blessed, etc.) work the same way as curses; no concentration link.
- **Flying** and a **custom effect** (DM types a name, picks curse / helpful / neutral; gets a ring) — folded in from Noam's notes.
- Out of scope still: saves each turn, durations by the clock, moving an effect when its target falls (revisit with concentration).

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
