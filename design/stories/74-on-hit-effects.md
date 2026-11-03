# Feature Story 74: On-Hit Effects

**Status**: Backlog — design direction approved, not built (written 2026-11-03).
**Prototype**: `design/prototypes/on-hit-effects.html` (round 2; round 1, with save handling inside Deal Damage, was too heavy and is in git history).
**Builds on**: NPC abilities (`src/features/dmDashboard/npcStats.js`), conditions + spell effects (`src/lib/spellEffects.js`), Take Action / Deal Damage, the initiative tracker.

## Goal

A poisoned shank, a charming touch, a cursed ring: an attack source can carry an effect that lands on a hit. It is set up once, on the thing that causes it, and from then on is just a badge — not extra decisions during play.

## Approved direction

- **Where**: any attack source — an NPC's rollable ability, a player's weapon, an inventory item.
- **Badge**: each effect has its own shape and colour (droplet/green Poisoned, heart/pink Charmed, bolt/yellow Paralyzed, ghost/violet Frightened, sigil/purple Hexed…). Hover, focus or tap shows the details (effect, duration, save, what it does). Light palettes deepen the colours.
- **Setup**: a "＋" after the source's name opens an **Effect** form; tapping a badge opens the same form to edit or remove. The form: effect (tiles: 5e conditions, then the DM's effects incl. custom ones), **lasts** N turns (stepper) or until removed, optional **saving throw** (DC + ability), and a one-sentence summary.
- **In play**: Deal Damage gains one pre-ticked chip — "Also Poisoned · 10 turns", with "unless they make the DC 11 Con save — untick if they did" when there's a save. Hidden on a miss. Apply writes HP and the condition together; History logs it.
- **Duration**: counted down on the target's turns in the initiative tracker; at 0 the condition comes off by itself. The token shows the badge and turns left.

## Data sketch

`onHit: { effect: "Poisoned", turns: 10 | null, save: { dc: 11, ability: "CON" } | null }` on the source. The condition lands in the target's existing `conditions` array; duration needs something new beside it (e.g. `conditionTimers: { Poisoned: 10 }`), decremented by the initiative tracker's turn advance. Backend normalisers must whitelist the shape.

## Open questions

- Turns left on the map token, or only on the card?
- Items such as a poison vial: is "the effect shows when the DM deals damage" enough, or should a vial coat a weapon for N hits (more complex)?
- Phase order: NPC abilities first (DM-only, smallest), then player weapons/items (character sheet + the log's apply flow).
