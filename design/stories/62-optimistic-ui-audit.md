# Feature Story: Audit for Missing Optimistic UI Updates

**Status**: Needs UX design
**Source**: User request
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

Players have reported a perceived "delay" when using the app during sessions. The suspicion is that this isn't really network latency — it's that some player-facing actions still wait for a full server round-trip before the UI shows any change, while most of the app already follows an established optimistic-update convention (update the UI immediately, reconcile with the server in the background). An action that visibly waits reads as lag even when the network itself is fine, and at the table that kind of friction is worse than it sounds: mid-turn, a player shouldn't have to wonder whether their tap registered, re-tap out of doubt, or lose track of what they were doing while staring at a button that hasn't responded yet. In a fast-paced combat round, that hesitation compounds — one laggy-feeling action slows down the whole table's pace, not just one player's turn.

**Note on scope of this pipeline stage**: this story states the goal and the reasoning only. It deliberately does not attempt to enumerate which specific buttons, actions, or code paths are missing the optimistic pattern — this stage doesn't read source code and shouldn't guess at implementation gaps. Identifying the concrete list of non-optimistic actions is `code-architect`'s job when it reviews this story (it has access to source and can verify what actually round-trips today vs. what only appears to).

## User stories

- As a player, I want every action I take during a live session to reflect immediately in the UI so that I never have to wonder whether my tap registered before moving on to my next action.
- As a player, I want the app to feel equally responsive across all its live-session actions — not fast in some places and noticeably slower in others — so that inconsistent responsiveness doesn't itself become a source of confusion ("did that one work? it usually doesn't take this long").
- As a DM, I want my own live actions (damage/heal, initiative advance, condition changes, etc.) to feel just as immediate as the player-facing ones, since the DM is also operating live at the table and is equally sensitive to perceived lag.

## Functional requirements

- Every player-facing (and DM-facing) write during live session play that *can* be optimistically reflected in the UI should be — i.e., the interaction should show its result immediately, with the actual server write reconciling in the background per the app's established pattern, rather than the UI waiting on a round-trip before showing any change.
- The audit performed against this story should distinguish genuine network latency (a slow connection, which optimistic UI cannot fully solve but can mask) from missing optimistic-update coverage (a UI that waits by design, regardless of connection speed) — these are different problems with different fixes, and conflating them would misdiagnose the complaint.
- Where an action genuinely cannot be safely optimistic (e.g., because the outcome depends on server-side data the client doesn't have, such as a value derived from other players' concurrent state), that should be called out explicitly as an intentional exception rather than silently left inconsistent with everything else.
- The end result players and the DM should notice: no player-facing button used during a live session visibly "hangs" waiting for a network response under normal conditions.

## Data model changes

None anticipated. This is an interaction-pattern consistency pass on existing write paths, not a new feature with new data — no new fields are expected as a result of this story.

## Out of scope

- Enumerating the specific list of affected buttons/handlers — that determination requires reading source code and belongs entirely to `code-architect`'s review of this story, not to this stage.
- Any change to what an action actually does once it completes (e.g., changing damage math, changing what a button applies) — this is strictly about how quickly and confidently the UI reflects an action that already exists and already works correctly, not about changing behavior.
- Backend performance work (e.g., speeding up Lambda cold starts, DynamoDB query optimization) — if the audit finds that some perceived delay really is network/backend latency rather than a missing optimistic-update pattern, addressing that root cause is a separate, later concern, not bundled into this story.
- Any change to non-live-session surfaces (e.g., the character creation flow, edit mode, the Map Library management page) where a deliberate "wait and confirm" pattern may be entirely appropriate since those aren't used in the middle of live play.

## Open questions

- Is there a specific moment or action the player(s) who complained can point to, or was the feedback general ("the app feels slow sometimes") without a specific trigger? A concrete example, if one exists, would help `code-architect` prioritize the audit — but per this story's own scope note, finding that example (or confirming none was given) is fine to leave to the next stage rather than chasing it here.
- Should this audit also cover the DM dashboard's write paths (damage/heal, initiative, conditions, NPC HP) with the same rigor as the player-facing sheet, or is the reported complaint specifically about the player experience? The user's phrasing ("they complained") suggests players, but the DM is equally a live-session user of this app and the same reasoning likely applies equally.
