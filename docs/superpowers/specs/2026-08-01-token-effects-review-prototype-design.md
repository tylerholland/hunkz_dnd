# Token Effects Review Prototype Design

Date: 2026-08-01

## Summary

Build a standalone HTML review artifact at `design/prototypes/token-effects-review.html` that lets the team review Stories 52–55 together before implementation. The prototype should feel like a direct extension of `design/prototypes/maps.html`, not a detached style lab.

The artifact's job is to make the token-effects system reviewable in one place:

- Story 52: damage flash and wound residue
- Story 53: persistent condition badges and size-band collapse
- Story 54: invisible veil, DM-only SECRET state, and player omission
- Story 55: attack tracer choreography and its timing relationship with Story 52

It must also answer a practical table-timing question that the individual story briefs only partly cover: turns may last 60–120 seconds, and players may look away from the board during the initial beat of an action. The prototype must therefore test not just the first second of an effect, but the memory of that action until the next meaningful action occurs.

## Why This Format

Three prototype shapes were considered:

1. `Battle Atlas`: one map-anchored review page with focused supporting sections
2. `Mirrored Encounter Sandbox`: mostly a synchronized DM/player board
3. `Specimen Sheet + Motion Rail`: enlarged token anatomy with lighter map context

Use `Battle Atlas`.

It is the only shape that simultaneously supports:

- side-by-side DM/player review for Story 54
- enlarged and banded condition review for Story 53
- motion choreography review for Stories 52 and 55
- real map-context reading, which is the natural home of the token system

## Artifact Requirements

- Create one self-contained prototype file: `design/prototypes/token-effects-review.html`
- Reuse the app's current DM-facing visual language:
  - Ocean palette
  - ambient radial background treatment
  - IM Fell English / Cinzel / Crimson Text typography stack already used in prototypes
  - dark-surface cards and section chrome aligned with `maps.html`
- Use the real 36px token shell as the base primitive, then scale it up only where review requires it
- Keep the prototype review-oriented and deterministic; it is not a freeform sandbox

## Page Structure

### 1. Top Bar And Review Presets

The page opens with a DM-style top bar and a compact preset rail. Presets switch the entire review page into one curated state:

- `Baseline`
- `Damage`
- `Control`
- `Bind`
- `Sense`
- `Physical`
- `Invisible`
- `Attack`
- `Overlap`
- `Slow Turns`
- `Reduced Motion`

Purpose:

- prevent the page from feeling like an uncontrolled demo dump
- let reviewers quickly compare the same artifact under different story-focused states
- provide a stable review vocabulary during implementation discussions
- ensure the full Story 53 condition spectrum is reviewable by family, not collapsed into one broad `Conditions` bucket

Preset intent:

- `Control`: incapacitating conditions and exhaustion promotion at severity 4+
- `Bind`: restrained / grappled / prone
- `Sense`: blinded / charmed / frightened / deafened
- `Physical`: poisoned and exhaustion 1–3
- `Overlap`: mixed-state scenarios where damage, concentration, invisibility, and conditions coexist
- `Slow Turns`: the same scene after several seconds of table time, to test action memory rather than only initial impact

### 2. Primary Board: Mirrored DM / Player Encounter

The top review surface is two synchronized map panels showing the same encounter:

- left: DM view
- right: player view

This is the anchor section of the whole page.

Requirements:

- same token positions on both boards
- same map art and board framing
- the DM board may show SECRET invisible NPC state
- the player board must fully omit that NPC
- invisible PCs remain veiled on both boards
- include compact controls for:
  - map rotation
  - zoom / effective-size band changes
  - reduced-motion state
  - elapsed-time snapshots such as `0s`, `5s`, `10s`, and `until next action`

This section is the primary proof that the system reads correctly in real board context.

The mirrored board must also include at least one scenario where:

- a token strikes an NPC enemy
- a condition is applied to the acting token or to a different target
- both the original strike and the newly applied condition remain legible long enough for a bystander to understand what changed

### 3. Persistent Token States Strip

Below the mirrored board, include a magnified specimen strip built from the same token anatomy.

Show at minimum:

- baseline PC token
- baseline NPC token
- wounded token with resting halo
- one exemplar from each Story 53 family:
  - Control
  - Bind
  - Sense
  - Physical
- exhaustion 3 and exhaustion 4 promotion
- two-condition token
- overflow / collapsed badge cases
- veiled PC
- SECRET invisible NPC
- FALLEN overlap cases
- condition plus concentration overlap
- condition plus recent-damage overlap

This strip exists so reviewers can inspect styling without losing the app's actual token shell.

### 4. Event Choreography Rail

Include a motion-focused section with short, repeatable demonstrations for:

- melee strike
- ranged bolt
- Story 52 Phase A damage beat
- Story 52 Phase B wound residue
- Story 55 tracer + Story 52 flash timing
- condition application on self
- condition application on another token
- invisible vanish / reappear behavior

This section should communicate order and rhythm, not just show isolated CSS flourishes.

Two choreography rules are especially important:

- the tracer must clearly lead the damage flash
- the vanish must read as absence, not as a ghost still occupying the board
- if more than one action happens in close sequence, the second action must not erase the viewer's comprehension of the first

### 5. Size Degradation Ladder

Add a section proving the condition and token system across size bands.

Show the same representative token/state in:

- `full`
- `two`
- `one`
- `none`

Also include Tiny / Medium / Huge examples to prove that:

- condition badges counter-scale against creature size
- ring-based effects still scale with the creature silhouette

This section should make Story 53's degradation rules immediately reviewable.

### 5A. Action Memory And Turn Cadence

Add a dedicated review section for slow real-table timing.

This section exists because a brief 300–500ms burst may be correct as animation design but still fail as table communication if a turn takes a minute or two and the watcher misses the initial beat.

Show the same representative action sequence at:

- action start
- 5 seconds later
- 10 seconds later
- just before the next action

The prototype should make explicit how the map remembers an action between beats. Compare calm persistence candidates rather than assuming the initial burst is sufficient.

At minimum, show and label these strategies:

- lingering residue on the affected token
- lingering source/target memory marks after an attack
- a quiet reminder pulse or replay option if residue alone is too subtle

Recommendation for the designer:

- prefer a calm lingering state over replaying the full loud action every few seconds
- treat periodic re-pulsing as a comparison candidate, not the default answer
- the persistence treatment should preserve comprehension without turning the board into a constant alert surface

This section must specifically cover:

- damage dealt to an NPC
- a condition applied to self
- a condition applied to another token
- the case where those actions happen in the same short span of play

### 6. Detail Card Authority

Include the detail-card states that act as the authoritative fallback when token-space compresses information.

Show at minimum:

- full condition list
- invisible line
- wound line
- hidden-HP NPC variant

The review goal here is to confirm that the map-level ambient symbols and the detail-card record remain aligned.

### 7. Review Notes / Decision Targets

End the page with a compact notes section that states what this prototype is meant to settle:

- condition family readability
- overflow / collapse treatment
- DM-only `◇` clarity
- tracer readability and sequencing
- action-memory treatment across slow turns
- reduced-motion substitutions

This keeps the prototype tied to concrete approval decisions instead of drifting into unstructured taste review.

## Fidelity Rules

- Do not invent a new visual language for the token system
- Keep the prototype anchored to current map and token styling already established in `maps.html` and the battle-map token work
- Favor app-faithful static and loop states over speculative polish
- Motion should be demonstrative and reviewable, not cinematic
- Any enlarged specimen should still visibly derive from the live token shell
- The prototype must distinguish between:
  - the loud first-beat event
  - the quieter memory of that event across slow tabletop pacing

## Out Of Scope

- No production `src/` or `backend/` changes in this prototype task
- No attempt to solve implementation architecture in the prototype file
- No generic icon gallery detached from map context
- No new gameplay rules beyond the approved Story 52–55 briefs

## Success Criteria

The prototype is successful if a reviewer can answer these questions from one page:

- Does the damage system read as event first, residue second?
- Does the preset rail cover the full condition spectrum in a way that is actually reviewable by family and overlap?
- Do condition badges stay legible and honest across size bands?
- Is DM-only invisibility unmistakable on the DM board and truly absent on the player board?
- Does attack motion read as cause, then impact, without fighting token identity?
- Can a watcher still understand what just happened 5–10 seconds later, and still before the next action?
- Do the reduced-motion substitutions preserve information?

## Handoff

Next execution step: build `design/prototypes/token-effects-review.html` from this spec using the repo's prototype conventions and the existing map/token visual language.
