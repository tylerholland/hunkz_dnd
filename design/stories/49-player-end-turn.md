# Feature Story: Player End Turn

**Status**: Needs UX design
**Source**: RPG Consultant (live-session feedback)
**Prototype**: (leave blank — ux-designer fills this in)

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

## Open questions

- Should the DM be able to disable player-initiated turn advancement for a given encounter (e.g., a boss fight where the DM wants to narrate every transition and doesn't want it to feel rushed)? Or is direct player action always fine given this is a trusted home-table tool?
- Reaction windows: 5e frequently has other players wanting to act on someone else's turn (e.g., a reaction spell) between "that player is done" and the tracker moving on. Should End Turn have any pause/confirmation, or is that a table-talk problem the app shouldn't try to solve?
- What happens if a player has multiple initiative entries (rare, but possible with certain effects) — does End Turn only ever apply to the currently active one? (Almost certainly yes — flagging for completeness.)
