# Feature Story: Token Attack Animation

**Status**: Implemented
**Source**: RPG Consultant (live-session feedback)
**Prototype**: `design/prototypes/token-effects-review.html`

**Note**: Fourth of the four-story visual-effects cluster (Stories 52–55). This story defines only the gameplay trigger, what data it needs, and the melee-vs-ranged/spell distinction — a `design-strategist` pass is the planned next step for the actual animation treatment. Do not treat anything below as a visual spec. This is also the most structurally new of the four — unlike Stories 52–54, which reuse data the app already tracks, this one needs a way to know *who attacked whom* and *with what kind of attack*, which doesn't fully exist yet (see Open Questions).

## Goal

Combat on the shared map currently plays out as HP numbers changing with no connection back to the map itself — a token's HP drops, but nothing shows *what just happened to it or from where*. A visible attack animation — something moving from the attacker's token to the target's token when an attack resolves — turns the map from a static status board into something that actually reads as a fight happening in a shared space. Distinguishing melee from ranged/spell attacks (a thrown weapon or arcane bolt traveling across the map vs. a strike that happens at point-blank range) reinforces basic tactical information — who's in melee range of whom, who's slinging spells from the back line — that's currently invisible on the map.

## User stories

- As a player or DM, when an attack resolves against a target, I want to see a brief animation connecting the attacker's token to the target's token, so the map reflects what actually happened in the fight rather than just updated numbers.
- As a player or DM, I want melee attacks to look and feel different from ranged weapon attacks and spell attacks, so the map communicates real tactical information (who's in someone's face vs. who's shooting/casting from range) at a glance.
- As a DM, I want this to work for both PC and NPC attacks, so the whole combat — not just player actions — feels alive on the map.

## Functional requirements

- **Trigger**: an attack roll resolves against a specific target — this requires knowing both who made the attack and who (or what token) it was aimed at, which the app does not currently capture (see Open Questions — today's dice roller produces a roll result but no target).
- **Attack type distinction**: the animation should differ based on whether the attack is melee (hand-to-hand) vs. ranged weapon or spell (something traveling across distance) — this is a meaningful gameplay distinction, not just visual variety.
- **Scope**: applies to attacks made by PCs and by NPCs, since both sides of a fight should read visually on the map.
- **Visibility**: visible to everyone who can already see both the attacking and target tokens on their map (no additional visibility restriction beyond existing token visibility — including the invisible-token rules from Story 54, where an invisible attacker or target's involvement in an animation shouldn't itself leak their position to players who shouldn't see it).
- **Timing**: brief and non-blocking — this is a momentary visual event tied to a roll resolving, not something that should pause or gate further play.

## Data model changes

This is the one story in this cluster that likely needs genuinely new data, not just a new rendering surface for existing fields:

- A way to associate an attack roll with a specific target token (attacker and target both need to resolve to a token on the current map — today's roll/dice data has no target concept at all).
- A way to classify the attack as melee vs. ranged/spell — potentially derivable from existing weapon mod data (a weapon or spell could plausibly be tagged with a range category), or captured at roll time if no such classification exists on the item today.
- Exact shape (e.g., extending the existing roll-broadcast/roll-history mechanism vs. a separate lightweight event) is an implementation decision for architecture.

## Out of scope

- The actual animation design (projectile path, spell-effect visuals, melee flourish, timing curve, easing) — design-strategist territory next.
- Any new targeting UI beyond what's minimally needed to know who was attacked (e.g., a full "select target from map" flow is plausible scope, but the interaction design for it belongs to design/architecture, not this story).
- Damage number pop-ups (related to Story 52, not bundled here).
- Any change to how attack rolls themselves are calculated — this is purely a map-visualization layer on top of an attack roll that already happened.

## Open questions

- This is the one item in the cluster that depends on capturing information the app doesn't currently have (a target for an attack roll). Should this story be scoped down to "animate any resolved attack roll against whichever token the DM/player manually points at afterward" as a lighter first pass, versus a full "pick your target before rolling" targeting flow? Worth resolving before this goes to design, since it materially changes the size of the feature.
- Should melee vs. ranged/spell be inferred automatically from the weapon/spell being used (e.g., a weapon tagged with a range, or a known spell list), or does the player/DM need to manually indicate it at the moment of the attack?
- Does this apply only to weapon/spell attack rolls from the dice roller, or also to freeform/manual damage entries the DM applies directly via "Apply to…" or the Damage/Heal modal (which have no associated "roll" at all)?

---

## UX Design

**Brief**: `design/briefs/token-effects-symbology-brief.md` (§9) — part of the
combined Stories 52–55 cluster.

### UX-relevant assumption (flagged, not silently resolved)

The story is right that the data doesn't exist. Rather than block on a targeting
flow, here is the **minimum signal already present in the app**:

> **The tracer fires from the token of whichever entity holds the active
> initiative turn, to the token of whichever entity had damage applied to it,
> whenever both resolve to tokens on the current battle map.**

- **Target** is already captured — the DM dice roller's "Apply to…" pills and
  `DamageHealModal` both name a specific character; NPC HP steppers name an NPC.
- **Attacker** is inferred from `initiative.activeTurnIndex`, which the app
  already tracks and the whole table already agrees on.
- **Zero new UI, zero new capture step.** Correct in the overwhelming majority of
  cases, because attacks happen on your turn.
- **If either side doesn't resolve to a placed token → no tracer.** Silent. Never
  an error, never a partial animation. Same if there's no active combat.

This resolves the story's OQ-1 in favour of the lighter first pass. **This is the
load-bearing guess in the entire cluster — please confirm it explicitly.**

### Two visuals, not three — a deliberate push-back

Melee / ranged-weapon / spell **cannot be earned from data we can infer today**.
Distance separates melee from everything else; it cannot separate an arrow from a
firebolt. **Ship two well rather than three badly.**

- **Melee — "Strike."** Nothing travels, because nothing crosses distance.
  A 6% **attacker lunge** toward the target and back (140ms out / 180ms back),
  plus an **impact crescent** on the target's circumference oriented on the
  attacker→target bearing (`#dce8f0` cold steel — gold is already claimed by
  crits and completed counter wheels). The lunge alone communicates *who attacked
  whom* without drawing a line across the map.
- **Ranged/spell — "Bolt."** A ~3px tapered streak travelling along a gently
  arced path with a trailing fade, **duration scaled by distance (220ms floor,
  420ms ceiling)**, terminating in the same impact crescent. Rendered **below the
  chips in z-order** so it emerges from behind the attacker and vanishes behind
  the target — depth, and it never occludes a face.
- **Bolt is tinted with the attacker's palette accent for PCs, `#c0c8c0` neutral
  for NPCs.** Identity for free: an ember-palette attacker's bolt arrives warm
  orange and the table knows who fired without a label. When item tagging
  eventually lands, spells keep the palette tint and ranged weapons drop to
  neutral steel — which is the right eventual three-way distinction.

### Other open questions resolved

- *Melee vs. ranged classification* → **inferred from token distance in
  normalised image space.** Within ~1.5 combined token diameters → Melee;
  beyond → Ranged. Zero new data, right most of the time, and when wrong the
  consequence is purely cosmetic — no rule or HP value depends on it. Upgrade to
  an explicit `range`/`attackType` item tag later.
- *Dice roller only, or manual damage too?* → **Every damage-apply path fires
  it** — "Apply to…", `DamageHealModal`, and the inline ±1 HP stepper alike. The
  DM shouldn't have to learn which button is "the animated one."
- *Heals* → recommended: a **support tracer**, same geometry, `#5a9a5a` green, no
  impact crescent (soft bloom on arrival instead). A cleric reaching across the
  map is a real event. Easiest thing in the cluster to cut.

### Composition & implementation traps

- **Layers:** the bolt lives on the token layer (L4) in natural-image space and
  **rotates with the map — correct, no correction needed.** The impact crescent
  lives inside `.token-chip` (L3) and is upright for free via Story 45's
  counter-rotation.
- **The one trap:** the melee lunge is visually attached to a chip but is
  *spatially* meaningful. Applied on `.token-chip` it inherits the
  counter-rotation and will point the wrong way on a rotated map. **Apply it on
  the position wrapper, outside the counter-rotation.** Do not add a rotation
  correction — choosing the right layer is the fix.
- **Choreography with Story 52:** an attack and its damage are **one event in two
  beats** — crescent at t=0, damage shockwave at t=+60ms. Firing them
  simultaneously reads as a rendering glitch, not a hit.
- **Visibility:** if either endpoint is an ABSENT token for a viewer (Story 54),
  **that viewer sees no tracer at all** — not a tracer to empty space, not half a
  tracer. A bolt from nowhere leaks the invisible attacker's position as
  effectively as rendering the token.

**Flagged for approval:** the attacker-inference assumption (brief OQ-3); heal
tracers (OQ-3); distance-inferred melee/ranged (OQ-4); two visuals instead of
three (OQ-5).

### Prototype review addendum (2026-08-04)

The following refinements came out of live visual review against
`design/prototypes/token-effects-review.html` and supersede the corresponding
details in the brief/UX Design section above where they conflict. The prototype's
map-view (Section 2, mirrored DM/player board) is the reference implementation —
its Section 4 (Event Choreography Rail) demo cards use fixed decorative geometry
for review convenience only and were explicitly *not* corrected to be
geometrically accurate; do not build from the rail cards' exact start-points.

- **"Bolt" is now three distinct visuals, not one shared ranged/spell
  treatment**, revising the brief's "two visuals, not three" push-back:
  - **Strike (melee)** — unchanged: attacker lunge + impact crescent, nothing
    travels. **New addition**: three small chevrons (`>>>`) emanate from the
    attacker's edge facing the target and light up in sequence (staggered ~55ms
    apart, each a brief fade in/out), traveling only a short distance — this is a
    close-in motion cue, not a projectile, and should not travel anywhere near the
    full attacker-target distance regardless of how far apart the two tokens are.
    Chevrons must originate from the side of the attacker's token facing the
    target (not the token's centre or an arbitrary edge) and are aimed along the
    attacker→target bearing.
  - **Ranged weapon ("Bolt")** — a traveling comet/streak, per the original brief,
    with a straighter (less arced) travel path than first prototyped.
  - **Spell ("Channel")** — visually distinct from the ranged bolt: instead of a
    single traveling projectile, the full line from caster to target draws in
    (reveals) all at once with a soft glow, plus a magical mist/smoke texture
    layered on top (SVG turbulence/displacement) for an arcane feel that a plain
    steel bolt shouldn't have.
- **Both Bolt and Channel are tinted white-core with a glow tinted to the
  attacker's own faction ring colour** (Ocean blue, Forest green, Ember orange,
  neutral grey for NPCs) rather than the brief's flatter "PC palette accent /
  neutral steel for NPCs" language — the glow needed to be strong enough that two
  different casters' effects are visually distinguishable from each other at a
  glance, not just technically tinted.
- **Choreography timing (crescent at t=0, Story 52 damage shockwave at
  t=+60ms)** is unchanged and applies to all three visuals including the new
  chevrons.

---

## Architect Notes

**Applies**: ADR-022 (attacker ref stamped in the same write as the damage stamp),
ADR-021 (`.tk-lunge` wrapper, CSS file location), ADR-023 (attacker-ref stripping),
ADR-011, ADR-014.

### Tech approach

**The inference is wireable, and it must be resolved server-side.** Confirmed
against the code:

- **Target** is already unambiguous at every damage-apply site. All PC damage
  funnels through `PATCH /characters/{slug}/session` (the slug *is* the target) and
  all NPC damage funnels through `PUT /npc-combat` (the NPC id is the target). See
  Story 52's notes for the full call-site table — the same list, and the same
  conclusion: **do not enumerate client call sites, stamp in the two handlers.**
- **Attacker** comes from `initiative.activeTurnIndex`, resolved **at write time,
  in the handler**, into `lastDamageFrom = { type: "character"|"npc", sourceId }`
  (or `null`). Per ADR-022, client-side inference is rejected outright: the public
  initiative feed strips hidden entries (`initiativeProjection.js:17`), so a
  player's `entries` array does **not** index-align with the DM's, and a player
  would draw the bolt from the wrong creature. It is also racy on the DM's own map
  — "apply damage" then "Next Turn" can coalesce into one poll payload.

**No extra latency for the attacker resolution.** `session.js` already issues a
`GetCommand` for the character (line 36); widen it to a `BatchGetCommand` for
`{ slug, "initiative" }` — still one round trip. `putNpcCombat.js` already needs a
`getNpcCombatState()` read for Story 52's diff; make that a `BatchGetCommand` for
`{ "npc-combat", "initiative" }` — also one round trip. `lastDamageFrom` is written
in the **same** `UpdateCommand`/`PutCommand` as `lastDamagedAt`, which is what makes
the two beats atomic by construction: they cannot separate across a poll boundary,
a WebSocket nudge, a reconnect, or a tab return.

Attacker ref resolution table (from `initiative.entries[activeTurnIndex]`):
`type: "pc"` → `{type:"character", sourceId: entry.slug}`; `type: "npc"` →
`{type:"npc", sourceId: entry.npcId}`; `"manual"`, no active combat, or attacker
=== target → `null` (the last one auto-suppresses ongoing-poison and
start-of-turn damage for free).

**Projections** (ADR-023): add `lastDamageFrom` to `DM_PARTY_FIELDS`,
`DM_PARTY_PROJECTION_EXPRESSION`, and `PLAYER_VISIBLE_FIELDS` in
`partyProjection.js`, and to `npcCombatPublic` in `getSessionState.js`. **Strip it
in the public variant whenever the referenced attacker is invisible or is linked
to a hidden initiative entry** — a bolt from an empty square leaks position as
effectively as rendering the token. Reuse the hidden-entry set
`initiativeProjection.js` already computes and Story 54's `invisible` resolver.

**Frontend.** New `TracerLayer.jsx` rendering one SVG in natural-image space,
mounted as the **first child of `tokenLayerChildren`** on both `MapPanel.jsx` and
`PlayerMapViewer`. **Correction to the brief §6:** it claims the SVG paints below
the chips because there is "no `z-index` on chips" — false. `.token-chip` has
`z-index: 10` (`battleMode.css:37`). Give the tracer layer an explicit lower
`z-index` (e.g. `4`) rather than relying on document order.

The SVG must be sized to the **union bounding box of live tracer geometry + 1U
margin**, never the full natural image — a 6000px-wide map-sized SVG per tracer is
a memory hazard, not a micro-optimisation. `pointer-events: none` on the whole
layer (`.token-layer` already defaults to `none`, but the DM branch sets it to
`auto`, so set it explicitly on the tracer layer).

Geometry per brief §5, in **natural-image pixels, not normalised fractions** —
normalised space is anisotropic on non-square maps and would misclassify melee vs.
ranged. `U = 36 × map.tokenScale`; `rA = 18 × attacker.scale × map.tokenScale`;
classification `gap = dist − rA − rB`, `gap <= 1.0U → Strike`. Rotation never
enters this math (x/y are natural-image fractions), so classification is
rotation-invariant and identical on every viewer.

**The melee lunge goes on ADR-021's `.tk-lunge` wrapper** — inside the position
wrapper, outside `.token-chip`'s counter-rotation. Applied on `.token-chip` it
would inherit the counter-rotation and point the wrong way on a rotated map; **do
not add a rotation correction, choose the right layer.** `.tk-lunge` animates
`translate()` only, with `--lunge-x`/`--lunge-y` supplied as px custom properties,
and carries no transition (which would fight the keyframe).

**The choreography clock lives in `tokenEffects.js` as its single owner** —
`phaseAStartDelay = tracerImpactTime + 60`, capped at 480ms total, defaulting to
`0` when no tracer plays (which is today's Story 52 behaviour, unchanged). Both
maps must consume the same module instance or the two surfaces will drift.
This amends Story 52's fixed 60ms into a supplied parameter; **only the token
flash waits** — HP numerals everywhere else update immediately and optimistically,
per ADR-011.

**Freshness gate is Story 52's, reused verbatim** — one shared gate. A flash
without its tracer, or a tracer without its flash, is worse than neither.

### Scope boundary

**In**: `lastDamageFrom` written server-side in `session.js` and `putNpcCombat.js`;
projection + strip; `TracerLayer.jsx` on both maps; `.tk-lunge`; the three visuals
per the prototype review addendum (Strike + chevrons, Bolt, Channel); the impact
crescent; the muzzle bloom; distance-based classification; the choreography clock;
the one-bolt-at-a-time / 3-crescent / 250ms-queue caps; reduced-motion static-path
substitution.

**Out — and this is a story that will try hard to grow**:
- **Any targeting UI.** No "pick your target", no `↯ FROM GOBLIN 1` confirmation
  line on `DamageHealModal` (brief OQ-4 — defer). The whole point of this
  implementation is zero new capture steps.
- **Any `range` / `attackType` tag on weapons or spells.** That is the eventual
  correct answer and it is deliberately deferred; the distance heuristic ships
  first because it costs nothing and, when wrong, the consequence is purely
  cosmetic — no rule, HP value, or state depends on it.
- **Support/heal tracers** (brief OQ-3, §8.7). They need `lastHealedAt` +
  `lastHealFrom`, which Story 52 deliberately does not stamp. This is an explicit
  **separable Phase 2** and is the cleanest cut in the entire cluster — cut it
  unless it is specifically wanted.
- "Attack missed" tracers (a miss writes no damage, so there is no event).
- Any attack log, "last attacked by" line, or new roll-history entry type. The
  roll-history feed already carries the causing roll (ADR-015).
- A "Map effects" DM on/off toggle (brief OQ-11) — do not build it.

**Sizing**: this is the largest of the four and the only one that is genuinely
optional. If the cluster needs to be cut short, cut this one — 52/53/54 are
independently valuable and this one depends on all three.

### Performance notes

- `stroke-dashoffset` is not compositor-accelerated. Cost is bounded by design:
  **at most one bolt in flight**, ≤420ms, 3 stroke elements, on a correctly
  bounded SVG. The one-bolt-at-a-time rule is simultaneously a legibility rule and
  the performance rule — don't relax one without the other.
- The Channel variant's SVG turbulence/displacement filter (per the prototype) is
  the single most expensive thing in this cluster on a mobile GPU. Bound it: one
  filter instance, applied to the channel path only, mounted only while playing,
  never at rest. If it drops frames on a phone, degrade Channel to Bolt-with-glow
  before degrading anything else.
- Geometry is snapshotted at fire time and does not track token movement
  mid-flight — drift under 600ms is invisible and tracking would mean recomputing
  paths per frame.
- No `will-change` at rest. The tracer layer is not in the DOM when nothing is
  attacking. `.tk-lunge` is the one permanent structural addition (bare `<div>`,
  no transform/transition at rest, zero paint cost) — it cannot be conditionally
  inserted without remounting the chip and losing hover/drag state.
- `aria-hidden` on the tracer layer; HP changes are already surfaced elsewhere.

### Cost notes

Zero new AWS resources, no new endpoint, no new sentinel, no new write, no schema
version. The attacker resolution is folded into reads Story 52 already added
(BatchGet vs. Get — same round trip, negligible RCU difference at PAY_PER_REQUEST).
Payload grows by one small object per party member and per NPC.

### Dependencies — this story has the most, and they are hard

1. **ADR-021's wrapper split** — `.tk-lunge` must exist.
2. **Story 52 must land first.** This story shares its damage stamp write, its
   freshness gate, and its `tokenEffects.js` module, and it *amends* 52's fixed
   60ms delay into a supplied parameter. Building 55 first means building 52's
   backend anyway, then rewriting its timing contract.
3. **Story 54 must land first.** The `lastDamageFrom` strip depends on 54's
   server-side `invisible` resolver and the "absence always wins" rule. Shipping
   55 before 54 ships a feature that leaks invisible attackers' positions — the
   exact thing 54 exists to prevent.
4. **Story 53 should land first** for the shared band resolver and condition
   normaliser, though the coupling here is weaker than for 54.

### Risks / decisions needed

1. **The attacker-inference model is the single most load-bearing guess in the
   whole cluster and needs explicit confirmation** (brief OQ-1). Everything else
   here is mechanical; if this assumption is rejected, the story needs a real
   targeting flow and is a different, much larger story.
   **Resolved (2026-08-05): confirmed as specified.**
2. **Confirm server-resolved over client-supplied attacker ref** (OQ-2).
   Recommendation: server-resolved. Atomicity — one write — is non-negotiable
   either way; a client-supplied-and-server-validated ref is the fallback but is
   fragile because many call sites can forget to send it, and "some buttons
   animate" is exactly the failure the cluster is trying to avoid.
   **Resolved (2026-08-05): server-resolved, as recommended.**
3. Confirm the `1.0U` melee threshold (OQ-8 — the single most behaviour-shaping
   constant here; the rule's *shape* matters more than the number, so ship it as
   one named constant in `tokenEffects.js` and tune after a session), the 480ms
   Phase-A delay cap (OQ-9), and the one-bolt/3-crescent/250ms caps (OQ-10).
   **Resolved (2026-08-05): ship all named constants as specified; tune after a
   live session.**
4. **Confirm three visuals, not two.** The prototype review addendum revises the
   brief's "ship two well rather than three badly" push-back and adds Channel as a
   distinct spell treatment — but the app still has no way to distinguish a spell
   from a ranged weapon. **Which data drives Bolt-vs-Channel is an open question
   the story does not answer**, and it must be resolved before implementation. The
   two viable answers: (a) ship Bolt only for v1 and hold Channel until a
   `range`/`attackType` item tag exists, or (b) add that tag now, which pulls a
   whole item-schema change into this story. Do not let the implementer guess.
   **Resolved (2026-08-05): option (a) — ship Bolt-only for v1.** Every
   ranged-distance attack (weapon or spell) renders as Bolt; Channel is cut from
   this build entirely, not degraded-to at runtime. Story 57's brief already
   independently reached the same conclusion ("Story 55 should still ship
   Bolt-only") while adding `level`/`toHit`/`damage` to the spell `role` field —
   that amendment is the data Channel needs and doesn't exist yet. **Follow-up
   tracked on Story 57** (see that story's Open Questions / Follow-ups): once
   Story 57 ships and spells carry that data, a small follow-on story should add
   the Channel visual back in, keyed off a correlation window (a declared spell
   attack against `sourceId` within ~20s of a damage-apply to that same
   `sourceId`) rather than reopening this story.
5. **Most likely implementation failure: the lunge on the wrong layer.** It looks
   correct on an unrotated map and points backwards at 180°. Test every visual at
   all four rotations before calling it done.

---

## RPG Consultant: Spell Classification

**Answers the question Architect Notes risk #4 left open** ("which data drives
Bolt-vs-Channel"). Written from the table, not the codebase: what actually helps
a player at their turn, and what real 5e sheets already do about it.

### 1. What classification is actually useful here

5e spells sort along two independent axes. Only one of them matters for this
story.

- **Resolution mechanic** — does the caster roll to hit (spell attack roll, e.g.
  Fire Bolt, Eldritch Blast, Guiding Bolt), or does the *target* roll a saving
  throw against the caster's DC (e.g. Fireball, Hold Person, Poison Spray)? These
  are mechanically distinct — one is a d20 roll by the caster, the other isn't —
  but from a player's mental model at the table, both are "the spell I cast *at*
  someone to hurt/hinder them." Neither this story nor a v1 player needs the
  distinction; it only starts to matter if the dice roller later grows spell-roll
  buttons the way it has weapon ATK/DMG buttons today, since attack-roll spells
  and save spells are rolled differently (to-hit vs. "here's your DC"). Recommend
  deferring this split — track it as a future refinement, not a v1 field.
- **Target/intent** — self, an ally, or an enemy — is the axis that actually
  matters, because it's the axis that answers "is this the kind of thing you'd
  roll to hit someone with." This is the one worth building.

Practical bucket list, in descending order of how much they matter to this story:

1. **Attack** — cast at an enemy to damage or debuff them, whether by attack roll
   or forced save (Fire Bolt, Eldritch Blast, Fireball, Hold Person, Poison
   Spray, Guiding Bolt). This is the bucket Story 55's Channel visual should key
   off. Note for the map-effects math specifically: a **melee spell attack**
   (Shocking Grasp, Vampiric Touch — touch-range spells) is still real and
   distinct from a ranged spell attack, but the token-distance heuristic the
   architect already specced handles this for free — a touch-spell caster is
   standing next to their target when they cast it, so it reads as Strike
   without any special-casing. No extra category needed for that case.
2. **Heal / support** — restores HP or removes a condition on an ally (Cure
   Wounds, Healing Word, Lesser Restoration). Not needed for this story (heal
   tracers are explicitly deferred per Architect Notes), but cheap to capture now
   since it's the same shape of flag and directly unlocks that Phase 2 later
   without a second data migration.
3. **Everything else** (buff/self, utility, ritual) — no attack semantics, no map
   trigger, ever. This is the default/unset state, not a category anyone
   actively picks.

**Recommendation: one small enum field per spell, not a full taxonomy.**
Something in the shape of `role: "attack" | "heal" | undefined` (naming is
architect's call) is enough. Do not build multi-target/AoE flags, spell
school/level, or ritual flags for this — none of them are load-bearing for what
Story 55 (or its likely Phase 2) needs, and every one of them is a UI surface
someone has to fill in for every spell on every character sheet. A player
picking a category for a cantrip they cast every fight is a five-second task the
first time and free thereafter; a player filling in spell school for RP flavor
they'll never need is homework.

**On AoE specifically** — it doesn't need its own flag to work correctly here.
The existing damage-apply model already handles a Fireball hitting four party
members for free: the DM taps Deal Damage on each affected character
individually, and each tap independently fires its own Attack-classified
tracer to that character. Four separate tracers converging on the same caster
in quick succession *is* what a Fireball should look like on the map. No new
capability needed, just noting it so nobody tries to build "AoE mode."

### 2. Prior art — and it validates the user's instinct directly

This is the one part of the question with a genuinely authoritative answer,
because WotC already solved it on the physical character sheet:

- **The Player's Handbook character sheet itself has a section literally titled
  "Attacks & Spellcasting"** — one table, weapon attacks and spells with an
  attack/save component listed together, columns for name / atk bonus or DC /
  damage & type. This isn't a VTT convention, it's the official paper design —
  the strongest possible precedent for the user's proposed rename.
- **D&D Beyond** mirrors this with a two-tier structure: spells live in full on
  a dedicated Spells tab (prep, slots, full text — the "what do I have available
  today" view), but any spell with an attack roll or forced save *also* surfaces
  in the sheet's condensed Actions list alongside weapons — the "what can I do
  right now" view. Two views of the same data, not one merged data structure.
- **Roll20's 5e sheet** has its own "Attacks & Spellcasting" table that pulls in
  any spell flagged with an attack/save component alongside manually-entered
  weapon attacks.
- **Foundry VTT's dnd5e system** tags every actionable item — weapon, spell,
  or feature — with an `actionType` (melee/ranged weapon attack, melee/ranged
  spell attack, save, heal, utility) specifically so the sheet can group
  "things you roll on your turn" independently of whether the underlying item is
  a weapon or a spell. This is effectively the same enum shape recommended
  above, arrived at independently by three different digital tools.

The convergence across the official paper sheet and three separate VTTs on
"surface attack-flagged spells next to weapons in a rollable list, but don't
merge spell prep into weapon inventory" is about as strong a signal as this kind
of question ever gets.

### 3. Recommendation on the IA question

**Merge at the point of display and rolling, not at the point of storage.**
Concretely:

- Keep spells as their own list, structurally distinct from `weapons[]` — the
  user's instinct not to shoehorn spells into items is correct, and it matches
  every precedent above. Spells don't equip, don't attune, don't carry qty —
  forcing them through `ItemEditorModal`'s item shape would immediately show
  irrelevant fields (Track Quantity, Requires Attunement) that make no sense for
  a spell.
- **Rename and merge the Combat tab's "Weapons quick-reference" list** (and, by
  extension, the Dice Roller's weapon-roll-buttons row) to show weapon entries
  *and* Attack-flagged spell entries together — this is the "what can I roll to
  hurt this guy right now" view a player actually consults mid-turn, and it's
  exactly the list this story's tracer needs to key off. "Weapons & Attack
  Spells" is a fine label; "Attacks" is shorter and reads cleanly even for a
  pure martial character with zero spells (see below). Either works — that's a
  naming call, not a classification call.
- **Do not** rename or merge the Inventory tab's Loadout grid. That grid is
  "what I'm carrying" (equip toggles, attunement gems, qty steppers) — a
  fundamentally different mental mode from "what I can attack with," and spells
  have no business there regardless of how the Combat tab is labeled.
- **Nice-to-have, not load-bearing**: only show the merged label ("Weapons &
  Attack Spells") when the character actually has at least one Attack-flagged
  spell; fall back to plain "Weapons" otherwise. A pure fighter with no spells
  shouldn't see spell-flavored chrome on a section that, for them, is just their
  sword and bow. Cheap conditional, real payoff for how the sheet reads to a
  non-caster.

This gives the player one place to look when it's their turn ("what do I roll to
hit"), keeps spell preparation/slots exactly where it already lives (the Combat
tab's Spell Slots block is unaffected), and gives Story 55 a clean signal
(Attack-flagged spell + ranged distance → Channel; anything else at ranged
distance → Bolt) without pretending spells are items.

### 4. Open questions for the architect

- The `spells` field today is `string[]` — freeform display tags, not
  individually-addressable records. Attaching a per-spell `role` flag requires
  giving spells *some* structured shape (id, name, `role`, and presumably the
  mods a future spell-roll button would need — this doesn't need to happen in
  this story, but the flag can't exist until spells have individual identity).
  That shape decision is squarely architect territory; flagging only so it isn't
  missed as a hidden prerequisite.
- Given the above is nontrivial, is Story 55 better served by shipping **Bolt
  only for all ranged-distance attacks in v1** (per Architect Notes option (a))
  and holding Channel until the spell-structure work lands on its own timeline —
  rather than pulling a spell data-model change into this story's scope? From a
  gameplay standpoint Bolt-for-everything is a perfectly fine v1; Channel is a
  nice-to-have polish pass, not a mechanic anyone is blocked without.
- If/when the `role: "attack"` flag exists, should un-flagged spells that
  nonetheless get "cast at" a target via a manual DM damage-apply (a DM just
  eyeballing damage from an un-tagged spell) still fire a tracer? Recommend yes
  — the tracer trigger should stay keyed off "damage was applied to a token from
  the active attacker," per the Architect Notes model, regardless of whether the
  causing spell happens to be flagged. The `role` flag only decides *which
  visual* (Bolt vs. Channel), never *whether* a tracer fires at all.
