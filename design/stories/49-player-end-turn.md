# Feature Story: Player End Turn

**Status**: Design agreed (2026-10-21) — prototype for approval
**Source**: RPG Consultant (live-session feedback); decisions from the player (2026-10-21)
**Prototype**: design/prototypes/player-end-turn.html

## Goal

During combat, initiative is DM-owned: the DM's dashboard advances `activeTurnIndex` with a "Next Turn" button, and players only ever see a read-only public initiative order. That means every single turn transition — even a trivial one where a player has clearly finished acting — requires the DM to stop what they're doing (often mid-conversation with a different player, or managing an NPC turn) and click Next Turn. At a real table this is exactly the kind of busywork a live-session tool should take off the DM's plate. Giving a player a way to say "I'm done" — and, when it's genuinely their turn, advance the tracker themselves — keeps combat moving without asking the DM to babysit every handoff.

## User stories

- As a player, when it's my turn in initiative, I want to signal that I'm finished acting so combat can move on without waiting on the DM to notice and click Next Turn.
- As a DM, I want the tracker to keep advancing correctly even when players end their own turns, so I don't have to manually confirm every handoff during a busy fight.
- As a DM, I want to be confident a player can only ever end *their own* turn — never skip someone else's or jump the queue.

## Functional requirements

- An "End Turn" action is available to a player only when the initiative tracker's active entry currently belongs to that player's character.
- Ending a turn advances the shared initiative state the same way the DM's "Next Turn" does: active turn moves to the next entry, and round number increments when wrapping from the last entry back to the first — this is one shared mechanic with one owner of the "advance" logic, not a parallel player-only path.
- The action must be rejected if the tracker's active entry does not belong to the requesting player's character — mirroring the existing rule that a player can only move their own map token, never someone else's.
- The DM dashboard reflects the advance immediately (or on next poll/nudge), same as if the DM had clicked Next Turn themselves — there's no separate "player requested end turn, awaiting DM confirmation" state; this is a direct action, not a request.
- If it is not currently the player's turn, no End Turn control is offered (there's nothing to end).

## Data model changes

None expected. Initiative entries for PCs already reference the owning character (needed to know whose turn it is at all); that same reference is what lets the server verify a player is only ending their own turn.

## Out of scope

- Any DM approval step before a player-triggered turn advance takes effect (this is directly actionable, not a request/notify pattern) — see Open Questions if that assumption should change.
- NPC turn advancement (NPCs are DM-controlled; only PC-owned entries can be ended by that player).
- Undo/rewind of a turn advance — same as the DM's existing Next Turn, this is a one-way action (the DM's manual ± round steppers already exist for correction).

## Decisions (2026-10-21)

- **End Turn button — always visible in the player's Session view, disabled until it's their turn.** Discoverable without explanation. States:
  - *Someone else's turn*: muted, disabled, reads "Liu Sha's turn" (doubles as a who's-up readout).
  - *You're next*: still disabled, reads "You're next" — a heads-up to plan. Visual only, no sound.
  - *Your turn*: lit in the character's palette with a gentle glow, reads "End Turn"; pressing it advances initiative.
- **Not in the attack bar** for now (idea for later).
- **"Your turn" cue** — one tier below the Battle/Adventure splash, because turns come round constantly:
  - A banner covers **only the left panel** (portrait, initiative, party cards): portrait + "Your turn" + round number. It appears for ~1.5s, then slides back / fades out. It doesn't block the rest of the page.
  - A single soft chime (the same sound for every character) — played **only for the player whose turn it is**; everyone else just sees their button change.
  - The End Turn button keeps glowing until pressed; the browser tab title shows "● Your turn".
  - No phone vibration.
  - Fires once per turn — not on page refreshes, not on first load mid-turn (the glowing button covers that).
  - Works whenever initiative is running, in Battle or Adventure mode. Banner and chime are for that player only — never the other players or the DM.
  - Respects a new player menu switch **"Turn alerts: On/Off"** (next to Roll animation) and reduced motion (fade instead of slide).
- **DM Settings switch "Players can end their own turn"**, on by default — off for fights the DM wants to narrate.
- **Reactions**: no pause or confirmation; table talk handles it. The DM's existing steppers fix an early end.
- **Multiple entries**: End Turn only ends the currently active entry.
- **Logging**: the advance writes the same "Round N · X's turn" event as the DM's Next Turn.

## Open questions

- Should the DM be able to disable player-initiated turn advancement for a given encounter (e.g., a boss fight where the DM wants to narrate every transition and doesn't want it to feel rushed)? Or is direct player action always fine given this is a trusted home-table tool?
- Reaction windows: 5e frequently has other players wanting to act on someone else's turn (e.g., a reaction spell) between "that player is done" and the tracker moving on. Should End Turn have any pause/confirmation, or is that a table-talk problem the app shouldn't try to solve?
- What happens if a player has multiple initiative entries (rare, but possible with certain effects) — does End Turn only ever apply to the currently active one? (Almost certainly yes — flagging for completeness.)
