# Feature Story: Session-Mode Spell Slot Management

**Status**: Needs UX design
**Source**: User request
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

Session mode (`/characters/:slug/session`) already displays a Spell Slots component in its persistent right column — a per-level pip row where a filled pip means the slot is available and an unfilled pip means it's been used. Today that display is purely read-only: tapping a pip does nothing, and there is no way to restore spent slots from Session mode at all. Meanwhile the classic Profile view's Combat tab has the *only* working spend/restore interaction in the app — tapping a pip toggles it, and Long Rest / Short Rest buttons restore slots per the standard 5e rules. Story 59 (`design/stories/59-simplify-profile-view.md`, brief `design/briefs/simplify-profile-view-brief.md`) proposes removing that classic Combat tab entirely, and its own brief flagged this exact gap as OQ-1, a blocking regression: removing it today would leave players with zero self-serve way to spend or restore a spell slot anywhere in the app, since rests are otherwise only triggerable party-wide from the DM dashboard. This story closes that gap by making the spend/restore *capability* that already exists in the classic Combat tab available on the Spell Slots component that already exists in Session mode — not by importing a second, separate spell-slot UI element into Session mode. Once this ships, Story 59's Combat-tab removal can proceed without a functional regression.

## User stories

- As a player, I want to mark a spell slot as used directly from Session mode when I cast a spell, so my available slots stay accurate during actual play without switching to the classic Profile view.
- As a player, I want to restore my spell slots via Short Rest or Long Rest from Session mode, so I don't have to leave the live-play surface to recover resources my character just earned.
- As a DM, I want players to be able to manage their own spell slots during a session without asking me to do it for them or having them dig into the classic sheet, so combat and rests keep moving.

## Functional requirements

- The existing Spell Slots pip display in Session mode's right column becomes interactive: a player can mark an available slot as spent and an already-spent slot as available again, per level, matching the same spend/restore interaction the classic Combat tab's pips already provide today.
- Session mode gains a Short Rest action and a Long Rest action that a player can trigger for their own character, restoring spell slots per the same rules the classic Combat tab's existing Short Rest / Long Rest buttons already use (per standard 5e slot-recovery rules: Long Rest restores all spent slots; Short Rest restores slots per any class-specific short-rest recovery the character already has configured, matching whatever the classic tab currently does — this story does not change those rules, only where they can be triggered from).
- This reuses the Spell Slots component that already exists in Session mode's persistent right column — it does not add a second, separate spell-slot display or duplicate the Story 56 Spells reference row below it.
- The Spell Slots component currently lives in Session mode's persistent right column, visible regardless of which of the four sub-tabs (combat/loadout/map/notes) is active — it is not gated to the "combat" sub-tab today. Whether the new spend/restore interaction and the new rest actions should keep that same always-visible right-column placement, or instead move into (or duplicate into) the "combat" sub-tab specifically, is an open question below — not decided by this story.
- All new writes go through the same `patchSession` no-auth write path every other Session-mode control already uses — consistent with how the read-only version of this component and every other Session-mode interaction (HP, conditions, concentration, inspiration) already work.

## Data model changes

None. This reuses the existing `spellSlots` array (`{level, max, used}` per level, per its existing shape and usage in the classic Combat tab) exactly as it's already read by Session mode's current read-only display — no new fields, no reshaping.

## Out of scope

- Any change to the classic Profile view's own Combat tab. It keeps spending/restoring slots exactly as it does today, independent of this story, until/unless Story 59 removes it separately.
- Any change to how spell slots are configured — adding or removing slot levels, or changing a level's max value. That remains an edit-mode/authoring concern, not a live-session one.
- Any change to the Story 56 Spells reference row's content or behavior beyond what's already there. This story is about slots and rests specifically, not the spell list itself, unless `design-strategist` finds a reason the two need to change together.
- Any change to the DM dashboard's existing party-wide rest triggers, if any exist today — this story adds a per-character, player-triggered path in Session mode; it doesn't touch DM-side rest tooling.

## Open questions

- **Where should the interactive pips and the new rest buttons live?** The Spell Slots component's current placement is the persistent right column, visible no matter which sub-tab is active. Keeping that placement preserves today's always-visible availability. Alternatively, per the user's original framing, the rest buttons (and possibly the interactive pips) could instead sit inside the "combat" sub-tab, matching where the equivalent classic-tab controls live — at the cost of hiding them whenever a player has the loadout/map/notes sub-tab open. This changes the interaction's availability depending on what a player happens to be looking at, and should be resolved by `design-strategist` rather than assumed either way.
- **What's the actual interaction for spending a slot?** The user does not have a strong opinion here ("I still don't know how we use those bits"). The classic Combat tab's existing pattern — tapping a pip toggles it between available and spent — is the most likely starting point, but not a foregone conclusion; `design-strategist` should confirm whether tap-to-toggle is right for Session mode specifically, or whether a different interaction (e.g., a confirmation step, given how easy an accidental tap during combat could be) serves better.
- Should Short Rest / Long Rest in Session mode require any confirmation step (e.g., given a Long Rest is a meaningful narrative event some tables gate behind DM approval), or should it be an immediate, unconfirmed action matching the pip-tap's directness? Not decided here.
- Does anything about "who can trigger a rest" need consideration — e.g., should a Short Rest triggered by one player have any visibility to the rest of the party, given rests are typically a party-wide event even though slot recovery itself is per-character? Flagging for `design-strategist`/`code-architect` rather than assuming Session mode's existing pattern of purely independent per-character writes is sufficient here.

---

## UX Design

**Brief**: `design/briefs/session-spell-slot-management-brief.md` — the authoritative spec.

**Prototype: not required.** Every decision here is read, not felt — no new gesture, no
sequence, no threshold constant to thumb-test. It assembles entirely from patterns the app
already ships: 44px pip targets (death-saves strip), inline two-tap confirm (Drop Item),
rebase-at-commit and poll-quiescence (Story 58). Route straight to `code-architect`.

**Tier: 2 for the pips** (ambient resource accounting — must never compete with the HP hero
card or the concentration pulse directly above it); **Tier 3 for the two rest buttons**
(on-demand, once or twice a session). That split is the whole reason the rests are quiet
right-aligned ghosts in the section's own header row rather than full-width buttons.

**Placement — RESOLVED: keep it in the persistent right column. Do not move it into the
`combat` sub-tab, do not duplicate.** This is a design decision, not a question handed
back. The deciding argument is Story 57's: the Attack Declaration Bar lives on the **Map**
sub-tab and was explicitly designed to survive sub-tab switches so "a player can check spell
slots before rolling without losing their declaration." Moving slots into `combat` turns
that check into a tab round-trip away from the board you are currently pointing at — the one
moment slots matter most is the one moment that placement would hide them. Three supporting
reasons: slot state belongs with the other four things that are true about you regardless of
what you're reading (HP, conditions, concentration, inspiration); players cast from the
Loadout, Notes and Map tabs, not just Combat; and the pips are already there, so this story
spends zero existing spatial memory. **The rest buttons go in the Spell Slots section's own
header row — deliberately not near the HP hero card, where a `LONG REST` button would read
as "this will heal me," which it will not.**

**Spend interaction — RESOLVED: single tap. No confirm, no hold.** Live play does not need a
heavier gesture; it needs a bigger target, an unmissable state change, and one cheap undo.
The action is self-inverse (the undo is the same gesture one pip over), a hold would collide
with the meaning Story 57 gave hold on the adjacent Map sub-tab, and every peer control in
this column — inspiration, condition pills, HP ±1, death-save pips — is a plain tap. **The
real failure mode is not the accidental tap, it's not noticing it**, so the budget goes to
feedback rather than friction. Two upgrades over the classic tab: pips get **28×44px hit
areas with zero gap between them**, and — because `spellSlots` stores a *count*
(`{level, max, used}`), not per-pip flags — the interaction is honest about that: tapping
anywhere in the filled run spends the **boundary** pip, tapping anywhere in the hollow run
restores it. Any tap in the correct run gives the correct result, and the change always
animates at the boundary, where the eye already is.

**Plus one 3-second `↺ UNDO`** that borrows the row's own `N / M` count pixels (no new row,
no layout shift, nothing at rest). It exists for the one mistake the inverse tap doesn't
cover: tapping the *wrong level's* row. It also cancels the pending write outright inside
the 400ms debounce, so an immediate undo produces no network call. **This is the single
cheapest thing to cut** if you want the minimum diff — brief OQ-2.

**Rest confirmation — RESOLVED: yes, inline two-tap for both, and the confirm is a
preview.** Every rest trigger that exists in the app today is already gated: the DM's
party-wide Short/Long Rest and the per-character `QuickActionPopover` rests all show a
confirm dialog. A one-tap player rest would be the *only* unconfirmed rest in the app, and
it's the one that wipes the most state (a full caster's Long Rest is 7+ pips to re-enter by
hand). **Inline, not modal** — matching Drop Item's `[Confirm] [Cancel]` swap, since a modal
over a live-play surface is heavier than a once-a-session action warrants. **Same gate on
both**, despite Short Rest doing less: they sit adjacent, and an asymmetry where one fires
instantly and its neighbour doesn't is a trap. The second tap earns its cost by being
**informative rather than ceremonial** — it names the exact consequence, computed live:
`RESTORE 2 PACT?` / `RESTORE ALL 7?`. Auto-reverts after 5s. Both buttons render disabled at
0.4 opacity when their effect would be a no-op, and **`SHORT REST` is absent entirely — not
disabled — when the character has no `isPactMagic` slot**, since for a non-warlock it can
never do anything (brief OQ-3).

**Party visibility of a rest (the story's fourth OQ) — a genuine judgment call about your
table, with a concrete recommendation and the cheapest possible implementation.** The app
already has a shared, DM-visible activity feed that already carries non-roll events (counter
wheels post `type: "wheel"` entries rendered as `◷ name — N segments`). **Recommendation:
a Long Rest posts one line to it — `☾ Long Rest — slots restored` — and a Short Rest posts
nothing.** A Long Rest is a narrative beat the DM should see land; a Short Rest refreshing
two pact slots is noise if the warlock takes three. Zero new data model, zero new UI. **Do
not gate a player rest behind DM approval** — the app's model is trust (no-auth session
writes everywhere) and a request/approve handshake would be the heaviest interaction in
Session mode. Cut the feed line and nothing else changes.

**Motion: recovery is refilling, not achievement.** Spend = 160ms fill-drain with the rim
holding (the slot still exists, it's just empty). Restore = 200ms fill with a small
overshoot. A rest replays the restore keyframe staggered left→right (35ms) and top→bottom
(+60ms/row), capped at 400ms total. **Explicit non-goal: no completion pulse, no gold, no
glow** — the counter-wheel completion vocabulary must not leak here. And **no glow anywhere
in this section at any state, including zero slots**: a pulsing pip would compete directly
with the concentration banner's pulse and the HP-critical state, both Tier 1 and both
directly above. "You're out of slots" is said by the row dimming to `opacity: 0.55`, and by
nothing else. **A remote change (DM party rest, second device) plays the same sweep** rather
than snapping — a silent value swap is a lost event — gated on mount so arriving at the page
never plays a phantom refill.

**Data: zero model change.** Reuses `spellSlots: [{level, max, used, isPactMagic}]` and the
`patchSession` no-auth path. Pip writes coalesce at 400ms; rests write immediately. Both
**rebase at commit against the freshest polled array**, never against the render snapshot —
Story 58's rule verbatim, and load-bearing here because the DM can party-rest concurrently.

**The one refactor: extract the rest rules so Story 59 can delete the classic tab without
deleting them.** Pull the classic Combat tab's existing logic into two pure helpers in
`constants.js` — `applyShortRest()` / `applyLongRest()` — and have both surfaces call them.
Behaviour identical, no visual change. **Scope guard, load-bearing:** the player-side Long
Rest restores **spell slots only** and must **not** copy the DM party-wide version's extra
`hpCurrent = hpMax` restore — a player silently full-healing themselves is a DM-authority
change this story doesn't own. Whether the classic tab also restores `hitDiceCurrent` must
be *verified*, not assumed (brief OQ-4).

**Open questions needing your decision** (brief §16): **OQ-1** — Long Rest posts to the
shared roll feed (recommended) or stays private. **OQ-2** — keep the 3s undo (recommended)
or cut for the minimum diff. **OQ-3** — hide `SHORT REST` for non-pact casters (recommended)
vs. show it disabled. **OQ-4** — verify what the classic Long Rest restores beyond slots.
**OQ-5** — should Story 57's Attack Bar auto-spend a slot on cast? Recommend not in this
story (it would double-count against manual pips); strong cheap follow-on.

**Cross-references**: **closes Story 59's OQ-1** — its declared blocking regression and
declared prerequisite; on ship, the Combat-tab removal proceeds with no functional loss
(Story 59's OQ-2 exhaustion-stepper gap is separate and **not** closed here). **Story 57** —
the Attack Bar reads the same `spellSlots` and its §3.2 rationale is the strongest argument
for the placement decision above; this story doesn't make the bar write slots. **Story 58** —
reuses its rebase-at-commit, poll-quiescence and write-failure rules verbatim, no second
versions. **Story 56** — deliberately does *not* reuse `.cs-spell-row-enter` (arrival vs.
recovery are different meanings); new keyframes. **Story 52** — borrows only its
mount/freshness-gate concept. **Story 16** — the tier principle is why the rest buttons are
header ghosts, not primary buttons.
