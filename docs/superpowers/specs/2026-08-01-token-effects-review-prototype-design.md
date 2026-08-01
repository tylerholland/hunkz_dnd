# Token Effects Review Prototype Design

Date: 2026-08-01

## Summary

Build a standalone HTML review artifact at `design/prototypes/token-effects-review.html` that lets the team review Stories 52–55 together before implementation. The prototype should feel like a direct extension of `design/prototypes/maps.html`, not a detached style lab.

The artifact's job is to make the token-effects system reviewable in one place:

- Story 52: damage flash and wound residue
- Story 53: persistent condition badges and size-band collapse
- Story 54: invisible veil, DM-only SECRET state, and player omission
- Story 55: attack tracer choreography and its timing relationship with Story 52

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
- `Conditions`
- `Invisible`
- `Attack`
- `Stress`
- `Reduced Motion`

Purpose:

- prevent the page from feeling like an uncontrolled demo dump
- let reviewers quickly compare the same artifact under different story-focused states
- provide a stable review vocabulary during implementation discussions

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

This section is the primary proof that the system reads correctly in real board context.

### 3. Persistent Token States Strip

Below the mirrored board, include a magnified specimen strip built from the same token anatomy.

Show at minimum:

- baseline PC token
- baseline NPC token
- wounded token with resting halo
- one-condition token
- two-condition token
- overflow / collapsed badge cases
- veiled PC
- SECRET invisible NPC
- FALLEN overlap cases

This strip exists so reviewers can inspect styling without losing the app's actual token shell.

### 4. Event Choreography Rail

Include a motion-focused section with short, repeatable demonstrations for:

- melee strike
- ranged bolt
- Story 52 Phase A damage beat
- Story 52 Phase B wound residue
- Story 55 tracer + Story 52 flash timing
- invisible vanish / reappear behavior

This section should communicate order and rhythm, not just show isolated CSS flourishes.

Two choreography rules are especially important:

- the tracer must clearly lead the damage flash
- the vanish must read as absence, not as a ghost still occupying the board

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
- reduced-motion substitutions

This keeps the prototype tied to concrete approval decisions instead of drifting into unstructured taste review.

## Fidelity Rules

- Do not invent a new visual language for the token system
- Keep the prototype anchored to current map and token styling already established in `maps.html` and the battle-map token work
- Favor app-faithful static and loop states over speculative polish
- Motion should be demonstrative and reviewable, not cinematic
- Any enlarged specimen should still visibly derive from the live token shell

## Out Of Scope

- No production `src/` or `backend/` changes in this prototype task
- No attempt to solve implementation architecture in the prototype file
- No generic icon gallery detached from map context
- No new gameplay rules beyond the approved Story 52–55 briefs

## Success Criteria

The prototype is successful if a reviewer can answer these questions from one page:

- Does the damage system read as event first, residue second?
- Do condition badges stay legible and honest across size bands?
- Is DM-only invisibility unmistakable on the DM board and truly absent on the player board?
- Does attack motion read as cause, then impact, without fighting token identity?
- Do the reduced-motion substitutions preserve information?

## Handoff

Next execution step: build `design/prototypes/token-effects-review.html` from this spec using the repo's prototype conventions and the existing map/token visual language.
