# Token Attack Animation — Design Brief

> **Story 55.** Fourth and last of the Stories 52–55 token effects cluster.
>
> Cluster brief owns the §4 layer budget, §8 composition rules, §4.2
> size-scaling — normative, not reopened. **This brief supersedes its §9**
> (eleven amendments, §2.4). **Also amends `token-damage-flash-brief.md`
> (Story 52):** the fixed 60ms Phase-A start delay must become a supplied
> parameter (§2.4 A6).
>
> Builds on Story 29, 29b, 34, 44, 45, Story 52 (choreographed with it, shares
> its data stamp).
>
> **Colour policy:** load-bearing colour of every tracer is universal; the
> attacker's palette is a *secondary* glow channel only — correcting the
> cluster brief, which made palette load-bearing and would produce invisible
> bolts on `pitch`/`vellum` (A2).

---

## 1. Design intent

Combat currently reads as arithmetic — a number changes, the DM says "twelve,"
everyone maps that onto a circle independently. This feature gives the board
one sentence in under half a second: **"that one hit that one, from over
there."** It's the only effect that occupies space *between* tokens, which is
why it outranks everything while it plays — and why it must leave nothing
behind when done: **zero DOM, zero pixels, zero cost at rest.**

Mental model, completing the cluster's: **the ring is what you are, badges are
what's happening to you, and the space between tokens is what's happening
between you.**

## 2. Tier and key decisions

**Tier 1, ephemeral.** ~140–480ms, rank 1 on screen while playing, zero resting
footprint.

**The load-bearing assumption (needs confirmation, OQ-1):**
> **The tracer fires from whoever held the active initiative turn *at the
> moment damage was written*, to whoever received that damage, whenever both
> resolve to placed tokens on the current map.** Attacker snapshotted
> **server-side at write time**, never inferred client-side (§8.2). If either
> side doesn't resolve, or attacker==target → no tracer, silently. Zero new UI.

**Two visuals, not three: "Strike" (melee) and "Bolt" (everything else)** —
melee/ranged-weapon/spell can't be distinguished from data the app has today.
v1 reserves the upgrade axis deliberately: every Bolt arcs gently; a future
`range`/`attackType` tag makes a ranged *weapon* variant purely subtractive
(taut straight line), keeping the arc for spells. Path shape is the free axis;
colour is already spent on PC/NPC identity.

### Eleven amendments to the cluster brief §9

| # | Cluster said | This brief | Why |
|---|---|---|---|
| A1 | Melee/ranged split at ~1.5 combined diameters, normalised space | **Edge-to-edge gap ≤1.0 U, natural-image pixels** | Normalised space is anisotropic on non-square maps; 1.5 combined diameters ≈3 grid squares would call a 15ft archer melee |
| A2 | Bolt tinted with attacker's palette | **Core always universal `#dce8f0`; palette only in the glow** | `vellum`/`pitch` accents are dark, would vanish |
| A3 | Impact crescent inside `.token-chip` (L3), "upright for free" | **Moves to L4**, drawn in tracer SVG in natural-image space | A directional mark inside the counter-rotated chip needs a rotation correction — "upright for free" is wrong for directional marks |
| A4 | Lunge translate on L0 | **Dedicated `.tk-lunge` wrapper**, inside L0, outside counter-rotation | L0's transform is already claimed by poll-move + drag (same hazard Story 52 fixed with `.tk-hit`) |
| A5 | Bolt travel ease-out | **`cubic-bezier(.4,0,.7,.35)`**, near-linear/slightly accelerating | Decelerating-into-target reads as "caught," not "landing" |
| A6 | Damage flash at fixed +60ms | **Delay = impact time + 60ms, capped 480ms**; Story 52 exposes this as a parameter | Fixed 60ms would fire the flash mid-flight |
| A7 | AoE not addressed | **One bolt to nearest target; crescents on all, staggered 60ms** | N bolts from one origin = starburst/glitch |
| A8 | Only melee has an attacker-side cue | **Ranged gains a muzzle bloom** at the attacker's rim | On mobile a 220ms bolt is over before the eye arrives at the target |
| A9 | Support tracer = same geometry as attack | **Melee-range heal does not lunge** — two blooms, no travel/crescent | A lunging heal reads as a punch |
| A10 | Lunge = 6% translate | **18%** of attacker diameter (26% in the small band) | 6% of 36px is 2.2px — sub-pixel in the everyday 12–30px mobile band |
| A11 | Sync shape left to architecture | **Attacker ref stamped into the same write as Story 52's damage stamp** | Client-side inference is provably wrong on the player's map (§8.2) |

Everything else in the cluster brief is adopted unchanged.

## 3. Information hierarchy

1. The tracer itself — motion between objects beats colour/size/position.
2. Impact crescent — converts travel into contact, shows which side it came from.
3. Story 52's Phase A on the target, from impact+60ms.
4. Both portraits — **0% occlusion at every frame** (bolt renders below chips,
   crescent outside the ring, lunge moves the whole chip).
5. Everything else — unchanged.

**Resolved competitions:** tracer + its own damage flash are one event in two
beats, tracer strictly leads (§8.5). Attacker's lunge (translate toward) vs.
target's recoil (scale down) — opposite directions, different properties,
never misread as the same event. Two tracers in one payload: at most one bolt,
at most 3 crescent groups in motion, everything staggered (§8.6).

## 4. Colour tokens

| Token | Value | Used by |
|---|---|---|
| `--tk-atk-core` | `#dce8f0` | Bolt core, crescent, muzzle bloom — cold steel white, universal |
| `--tk-atk-shade` | `rgba(0,0,0,0.45)` | **Mandatory** under-stroke (app's dark-outline convention) — makes near-white survive `vellum` |
| `--tk-atk-npc` | `#c0c8c0` | Bolt/muzzle glow for NPC attackers |
| *(PC glow)* | `var(--pal-accent)` @0.40 | Bolt/muzzle glow for PC attackers — **the only palette-derived value** |
| `--tk-sup-core` | `#cfe8cf` | Support tracer core |
| `--tk-sup-glow` | `#5a9a5a` | Support glow/bloom — the app's existing universal healthy-HP green |

Core universal + glow palette-derived keeps 100% of identity value and loses
0% of legibility (the reason for A2).

## 5. Geometry

All geometry expressed in one derived unit `U`, in natural-image pixels:

```
U = 36 × map.tokenScale            (≈ one grid square, matches Story 29b's calibration)
rA = 18 × attacker.scale × map.tokenScale     rB likewise for target
dx,dy computed in NATURAL pixels (not normalised — avoids anisotropy)
dist = hypot(dx,dy);  u = (dx,dy)/dist;  gap = dist − rA − rB
```
`U` is calibration-aware and creature-size-aware for free, and it's the token
layer's native coordinate system. **Rotation never enters this math** — x/y
are natural-image fractions, so classification is rotation-invariant and
identical on every viewer regardless of what's rotated.

**Classification (A1):** `kind = (gap ≤ 1.0 U) ? "strike" : "bolt"` — an
edge-to-edge gap of one grid square or less is melee. Degeneracy is impossible
by construction (a Bolt can never be asked to render near-zero length). When
wrong, the cost is purely cosmetic (OQ-8).

### Anatomy
- **Strike:** attacker's **entire chip** (portrait, ring, badges, label)
  translates `0.18 × 2rA` along `u` and back — moves the piece, doesn't draw on
  it.
- **Bolt:** rim-to-rim (not centre-to-centre) — starts at `A+u·rA`, ends at
  `B−u·rB`, comet emerges from behind the attacker's chip. Renders **below**
  both chips (depth cue, guarantees 0% occlusion).
- **Muzzle bloom** (Bolt, A8): radial bloom at attacker's rim, `0.45U→0.70U`,
  110ms.
- **Impact crescent:** 64° arc just outside the target's ring, centred on the
  bearing *back toward* the attacker, `rB+0.06U→rB+0.22U`, sweep 64°→84°,
  stroke `0.14U`, `--tk-atk-core`, round caps. **Full opacity on frame 1, then
  fades** — an impact doesn't fade in.

### Bolt full geometry
```
path      quadratic Bézier, P0=A+u·rA, P2=B−u·rB, P1=midpoint + n·sag
sag       min(0.10 × dist, 2.5 U)
travel    gap (always ≥1.0 U)
core      stroke-width 0.09U, glow 0.24U, shade 0.15U (painted first, under both)
comet     dash length clamp(0.45×travel, 1.2U, 6U)
duration  clamp(180 + 12×(travel/U), 220, 420) ms
easing    cubic-bezier(.4,0,.7,.35) — near-linear, slightly accelerating (A5)
```
Sag direction always `u` rotated +90° — deterministic, so a retaliation bolt
arcs on the opposite visual side (never draws over the original). Stroke
widths proportional to `U` — always ≈1/11th of a token wide at any zoom.

### Strike full geometry
```
lunge      0.18 × 2rA along u, supplied as px via CSS custom properties
timing     140ms out (ease-out) / 180ms back (ease-in) = 320ms total
crescent   same as above, fires at lunge peak (t=140ms)
```
Overlap when tokens are touching is not clamped — reads as a shove, correct.

### Support (heal) tracer — separable Phase 2 (§8.7)
| | Ranged (gap>1U) | Melee (gap≤1U, A9) |
|---|---|---|
| Travel | Same Bézier, `--tk-sup-*` colours | **None** |
| Origin | Muzzle bloom in sup-glow | Bloom at healer's rim |
| Arrival | Soft bloom, no crescent, `0.9rB→1.6rB`, 300ms ease-out | Same bloom |
| Attacker motion | None | No lunge — a lunging heal reads as a punch |

No Story 52 beat follows a heal (that brief's deliberate refusal, unchanged).

## 6. DOM / layer structure

Owns exactly two slots, does **not** touch L3 (leaves Story 52 sole owner of
the ephemeral burst layer — a simplification over the cluster's allocation).

```
TOKEN LAYER (natural-image space, inherits --map-rotation UNCORRECTED)
├── L4  <svg class="tk-tracer-layer">   NEW. First child of tokenLayerChildren
│         │                             (paints BELOW every chip — no z-index on chips).
│         │                             pointer-events: none. Mounted only while ≥1 tracer live.
│         ├── path .tk-bolt-shade  (painted first)
│         ├── path .tk-bolt-glow
│         ├── path .tk-bolt-core   (animated stroke-dashoffset)
│         ├── circle .tk-muzzle
│         ├── path .tk-crescent    (one per target)
│         └── circle .tk-sup-bloom (support only)
└── L0  .token-pos
        └── .tk-lunge   NEW. transform ONLY: translate(). NOT counter-rotated,
            │           so the vector is in map space and points correctly even
            │           on a rotated map — free, no correction (A4).
            └── .tk-hit (Story 52) scale() only
                └── .token-chip   counter-rotate + scale. UNTOUCHED by this story.
                    └── L3 .tk-shock  Story 52's, exclusively — this story adds nothing here.
```

**Non-negotiables:** `pointer-events: none` on the entire tracer layer. SVG
sized to the **union bounding box of live tracer geometry + 1U margin — never
the full natural image** (a memory hazard, not a micro-opt). Conditionally
rendered, never present at opacity 0. `.tk-lunge` animates translate only, no
transition (would fight the keyframe). No CSS `rotate` property anywhere —
crescent orientation is baked into SVG path data computed in JS. No
`will-change` at rest.

**Rotation is closed with zero correction code anywhere:** L4 elements inherit
map rotation correctly (they're spatial objects in natural-image space); the
lunge vector is rotated by its ancestor along with the target (points at it
for free); everything inside `.token-chip` is untouched.

## 7. Motion spec

No resting/looping animation of any kind — never participates in the loop
budget cap.

| Event | Duration · easing | Communicates |
|---|---|---|
| Muzzle bloom | 110ms ease-out | "it came from here" |
| Bolt travel | 220–420ms by distance, `cubic-bezier(.4,0,.7,.35)` | "something crossed the room" |
| Melee lunge | 140ms out / 180ms back | "A swung at B" |
| Impact crescent | 140ms ease-out | "it connected, from that side" |
| Story 52 Phase A | impact+60ms (A6) | cause, then effect |
| Support travel/arrival bloom | as bolt / 300ms ease-out | "help is on the way" / "arrived" |
| Multi-target crescents | staggered 60ms, Story 52's stable order | "one blast, several bodies" |
| Tracer completes | 0ms, all elements unmount | nothing left behind |

`tkBoltTravel` animates `stroke-dashoffset` on shade/glow/core together (dash
= comet length, path length supplied per-tracer). `tkLunge`: 0%→translate(0,0),
44%→`translate(var(--lunge-x), var(--lunge-y))`, 100%→back to 0 (44%=140ms
out, remaining 180ms back). `tkCrescent`/`tkMuzzle`: full opacity/scale on
frame 1, decay outward (`transform-box: fill-box` required on the `<path>`).

**Refusals:** no attacker motion on a Bolt (muzzle bloom is the origin cue; a
ranged recoil would collide with Story 52's semantically). Tracer doesn't
track token movement mid-flight (geometry snapshotted at fire time — drift is
invisible under 600ms). No "attack missed" tracer (a miss writes no damage,
therefore no event — OQ-7). No fade-in on anything — every element appears at
full strength and decays.

**Performance:** `stroke-dashoffset` isn't compositor-accelerated, but cost is
bounded — at most one bolt in flight, ≤420ms, 3 stroke elements on a correctly
bounded SVG. `offset-path`/`offset-distance` is the future compositor-friendly
swap (Safari support not yet baseline — not the v1 choice).

## 8. Trigger, sync, lifecycle — the hardest section

### 8.1 What counts as an attack event
All of: (1) `hpCurrent` decreased (same trigger as Story 52 — heals/rests/
tempHP absorption produce nothing); (2) target resolves to a placed token on
the active map; (3) the write carries an attacker ref (§8.3) that also
resolves to a placed token; (4) attacker ≠ target. Any failure → no tracer,
silently; Story 52's flash still fires normally.

### 8.2 One write, one atomic event
> **Extend Story 52's damage stamp with an attacker reference, resolved
> server-side at write time, in the same call.**

New field: **`lastDamageFrom`** — the attacker snapshotted from
`initiative.activeTurnIndex` at the instant of write, or `null` when
unresolvable.

**Why not client-side inference:** provably wrong on the player's map — the
public initiative feed strips hidden entries, so a player's `entries` array
doesn't align with the DM's; also racy even on the DM's own map (apply damage
+ tap Next Turn can land in one payload, drawing the bolt from the wrong
creature). A wrong tracer actively misinforms about positioning — worse than
none. **Rejected.**

**Why not a separate `attack-events` sentinel:** two DynamoDB items can't
update in one non-transactional call — a second write on the hot damage path
that can land in a *different* payload from the flash, reintroducing exactly
the desync problem the two-beat choreography can't survive. **Rejected.**

**Same-write metadata (accepted):** the two beats become atomic by
construction — can't separate across a poll boundary, WS nudge, reconnect, or
tab-return. No new endpoint/sentinel/write. Freshness gate is Story 52's,
reused verbatim. Cost: damage-write handlers (`session.js`) need one extra
`BatchGetItem` to resolve `activeTurnIndex` — acceptable on a human-frequency
action. Fallback if rejected: client sends its believed ref, server
**validates** it against `activeTurnIndex` (fragile — many call sites can
forget). *Recommend server-resolved* (OQ-2).

### 8.3 Attacker reference shape
Must resolve to a token using only the payload the client already holds —
natural choice is `{ type: "character"|"npc", sourceId }`; a raw initiative
`entryId` is an acceptable alternative if easier server-side. **Not
acceptable: any shape requiring the client to consult `activeTurnIndex`.**

| Active entry is… | Ref |
|---|---|
| Party PC | `{type:"character", sourceId:slug}` |
| Linked NPC combat entry | `{type:"npc", sourceId:npc.id}` |
| Manual combatant (no token) | `null` |
| No active combat | `null` |
| The damaged entity itself | `null` — never draw a tracer to yourself (self-suppresses ongoing poison/start-of-turn damage automatically) |

### 8.4 Freshness gate — Story 52's, reused verbatim
> A tracer plays only if `serverTime − lastDamagedAt ≤ 4000ms` AND newer than
> this client's last-rendered value. **One shared gate** — a flash without its
> tracer (or vice versa) is worse than neither.

Never plays on first paint; all age arithmetic uses `serverTime`; a repeat hit
inside a live tracer interrupts and restarts from frame 0, re-anchoring
Story 52's beat with it.

### 8.5 The choreography clock (A6) — amends Story 52
> The invariant isn't "+60ms after tracer start," it's **"+60ms after
> impact."** Story 52's Phase-A delay becomes a supplied parameter:
> `tracerImpactTime + 60`, `0` when no tracer plays (today's behaviour stays
> the default). **Hard cap: total delay ≤480ms.**

Only the token flash waits — HP numerals everywhere else update immediately
and optimistically. This clock must live in the shared `tokenEffects` module
as its single owner so both maps can't drift.

### 8.6 Multi-target and multi-attacker
**One attacker, N≥2 fresh targets (fireball):** one bolt to the *nearest*
target only (N bolts = starburst/glitch); a crescent on every target, staggered
60ms in Story 52's stable order; cap 3 crescents in motion, targets 4+ get
flash only on Story 52's own schedule.

**Two attackers in one payload:** both tracers fire, but at most one bolt in
flight — the second queues up to a **250ms ceiling**, then degrades to
crescent-only.

**Duplicate tokens for one `sourceId`:** fire from the duplicate nearest the
target.

### 8.7 Support tracer's data cost — why separable
Needs data nothing else wants: `lastHealedAt`+`lastHealFrom` (Story 52
deliberately stamps nothing on heals). If shipped: suppress when ≥3 entities
get fresh heal stamps in one payload (a Long Rest, not a beat worth animating);
require active combat. *Recommend ship as an explicit separable Phase 2* —
cuttable with one line of scope (OQ-3).

### 8.8 Visibility
Governed by cluster's "absence always wins." Target invisible → whole record
withheld → no tracer, free. **Attacker invisible → the ref would still sit on
the visible target's record, naming a creature the player shouldn't know
about.** **Requirement: strip `lastDamageFrom` server-side whenever the
referenced attacker is invisible or linked to a hidden initiative entry** —
same lever as Story 53 §9.3. A bolt from nowhere leaks position as effectively
as rendering the token; no partial tracers, ever.

### 8.9 Cleanup
No explicit cleanup needed — everything unmounts with its parent. A
never-cleared `lastDamageFrom` is harmless past the 4s gate; never an error.

## 9. Interaction model

Entirely non-interactive — zero tap targets, can't be dismissed (nothing left
to dismiss by the time a finger arrives).

**Must not change:** Story 34 drag (lunge on `.tk-lunge`, drag on L0 — no
conflict); Story 29b long-press/sweep (tracer paints below the chip, accepts
no pointers); Story 44 resize; MapViewer pan/zoom (`pointer-events:none` is
what makes this true); `HeldTokenFloater` is **never** a tracer endpoint in
either direction.

**No additions to any existing surface** — no "last attacked by" line, no
attack log (the roll-history feed already carries the causing roll).
Deliberately declined: a `↯ FROM GOBLIN 1` confirmation line on the DM's
DamageHealModal — highest-value trust addition if the inference ever wobbles,
but new chrome for an assumption that's usually right. *Recommend defer*
(OQ-4).

## 10. Size degradation ladder

Does **not** counter-scale — a tracer is a spatial object between creatures
(same category as the faction ring / Story 52's halo), not chrome about one
creature. Because geometry is in `U`, it's proportionally correct for free.

| Effective size | Behaviour |
|---|---|
| ≥30px | As specified |
| 20–30px | Crescent widens to `rB+0.28U` |
| 12–20px | Strokes widen (core 0.09U→0.16U, glow→0.36U, crescent→0.22U); **lunge widens to 26%** — the everyday mobile band |
| <12px | Bolt survives at widened strokes; **lunge dropped** (sub-pixel); **crescent survives longest** — preserves direction, the whole point |

Inverted from Story 52 (there, recoil dies first/shockwave survives longest;
here, lunge dies first/crescent survives longest) — in both cases the
surviving element is drawn outside the silhouette, where there's room.

## 11. Reduced motion

Single authoritative block, replace-don't-delete:

| Motion point | Reduced behaviour |
|---|---|
| Bolt travel | Complete static path drawn instantly @0.75 opacity, held **260ms** |
| Muzzle bloom | Instant at final radius, held 260ms |
| Melee lunge | **Suppressed entirely** |
| Impact crescent | Instant full opacity, held 260ms — the only surviving signal in melee, so it must be held |
| Support tracer | Static-path substitution; arrival bloom instant, held 260ms |
| Choreography clock | Collapses to constant 60ms (impact at t=0) |
| Multi-target stagger | Suppressed — all static crescents appear at once |

A reduced-motion user must still see *which token attacked which, and from
which side* — 260ms of static line + crescent is that signal.

## 12. Edge cases

**When nothing is attacking, this feature does not exist** — no tracer layer
in DOM, no reserved space. `.tk-lunge` is the one permanent structural
exception (can't be conditionally inserted without remounting the chip) — bare
`<div>`, no transform/transition/will-change at rest, zero paint cost.

| Case | Behaviour |
|---|---|
| No active combat | No tracer, never guess an attacker |
| Manual combatant active (no token) | No tracer, silent |
| Attacker == target | No tracer, flash still fires |
| Adventure mode | No token layer, inherently battle-mode-only |
| Attacker/target at identical coords | `gap≤1.0U` → forced Strike (degeneracy impossible) |
| Non-square map image | Correct — computed in natural pixels (the bug A1 fixes) |
| Map rotated | Zero corrections needed anywhere |
| Token glides mid-tracer | Geometry snapshotted at fire time; drift under 600ms invisible |
| Two damage events on one target within tracer window | Second interrupts, restarts from frame 0 |
| AoE: 1 attacker, 5 targets | One bolt nearest; crescents on first 3; 4–5 flash only |
| Target is FALLEN and takes damage | Full tracer fires (death saves matter); Phase B stays suppressed |
| Held token as endpoint | Never an endpoint — floater is portalled outside the token layer |
| Invisible NPC attacker, player view | Nothing — ref stripped server-side |
| Veiled PC as attacker/target | Full tracer — a veiled PC is visible to everyone |
| Temp-HP-absorbed hit | No hpCurrent decrease → no stamp → no tracer |
| Long Rest / mass heal | ≥3 fresh heal stamps → all support tracers suppressed |
| Clock-skewed client | Uses `serverTime` |
| `vellum`/bright terrain | Mandatory under-stroke separates near-white core |
| `pitch`/dark palette attacker | Core is universal, reads regardless (the bug A2 fixes) |
| Classic sheet Map tab | Feature absent — same limitation as Stories 52–54 (OQ-6) |

## 13. Mobile vs. desktop

Mobile: short maps put most pairs inside 1.0U → **Strike is the everyday
case**; the **220ms floor** is load-bearing (an unclamped short bolt would
flicker past unseen — also why the muzzle bloom exists, firing at t=0 before
the eye can travel); everyday degradation band is 12–20px (§10's widened-
stroke/26%-lunge is the canonical mobile rendering). Desktop: wider distance
range, the **420ms ceiling** does real work. Colours, curves, the
classification rule, freshness gate, choreography clock, reduced-motion
substitution are identical across breakpoints.

## 14. Accessibility

Primary channel: motion along a vector (a line that travels, or a piece that
shifts). Secondary: geometry (an arc on a specific side of a specific rim).
Colour carries only the tertiary PC/NPC distinction, in the glow not the core
— a fully colourblind viewer still reads "something crossed from that circle
to this one and struck its left side." Support core differs from attack core
by hue *and* by total absence of a crescent — distinguishable with zero colour
perception. No screen-reader announcement (HP changes are already surfaced
elsewhere; the tracer layer is `aria-hidden` decoration). The one
non-composited property (`stroke-dashoffset`) is bounded to a single path
group for ≤420ms — the reason for the one-bolt-at-a-time rule, which is
simultaneously a legibility and a performance rule.

## 15. Files likely touched

**Frontend:** new `TracerLayer.jsx` (the L4 SVG — bounding-box sizing,
conditional mount, keyframe application; first child of `tokenLayerChildren`
on both surfaces); extend the shared `tokenEffects` module (attacker-ref
resolution, the `U`-based geometry pack, the strike/bolt classifier, **the
choreography clock as single owner of `tracerImpactTime`** — DM and player
maps must consume the same instance); `BattleModeController.jsx` (`TokenChip`:
new `.tk-lunge` wrapper + `--lunge-x/-y` custom properties;
`HeldTokenFloater` explicitly excluded as an endpoint); tokens.css (6 colour
tokens, 5 keyframe blocks, 2 size-band overrides, single reduced-motion
block, no CSS `rotate`); `MapViewer.jsx` (confirm z-order lets the SVG paint
below chips without `z-index` on chips); `MapPanel.jsx`/`PlayerMapViewer` pass
`serverTime` + stamp group + initiative/npcCombat into the shared scheduler,
render `<TracerLayer>`.

**Backend:** `lastDamageFrom` (+ optionally `lastHealedAt`/`lastHealFrom`)
written in the **same call** as Story 52's stamp — `session.js`,
`putNpcCombat.js` — requires resolving `activeTurnIndex` at write time (one
extra `BatchGetItem`). `getSessionState.js` carries the field(s) in both
variants. Projection helpers implement the §8.8 strip (server-side, not a
client filter). **No new endpoint, sentinel, write, or schema version** —
that's the point of §8.2.

## 16. Open questions

1. The attacker-inference model itself — **the single most load-bearing guess
   in the whole cluster**, needs explicit confirmation. *Recommend confirm.*
2. Server-resolved vs. client-supplied attacker ref — *recommend
   server-resolved*; atomicity (one write) is non-negotiable either way.
3. Support tracers as a separable Phase 2 — *recommend ship*, but easiest cut
   in the cluster.
4. `↯ FROM GOBLIN 1` confirmation line on DamageHealModal — *recommend defer*.
5. Two visuals not three, path shape as the reserved upgrade axis — *recommend
   confirm*.
6. Classic sheet's Map tab has no token layer, feature absent there — confirm
   acceptable.
7. "Attack missed" tracers out of scope for v1 — confirm.
8. `1.0 U` melee threshold — the single most behaviour-shaping number here.
   *Recommend 1.0U*, revisit after a session; the rule's *shape* matters more
   than the constant.
9. 480ms delay cap on Story 52's Phase A — *recommend confirm*; watch at the
   table, mitigation is lowering the bolt ceiling from 420ms to ~340ms if it
   feels laggy.
10. One-bolt-at-a-time caps (250ms queue, 3-crescent cap) — confirm; it's
    simultaneously the legibility and performance rule.
11. A single "Map effects" DM toggle covering 52/53/55 — *recommend not
    building it* (invites turning features off rather than tuning them); flag
    if wanted as one shared story.

## 17. Divergences from cluster brief §9 — index

Full reasoning in §2.4. A1–A3 are defect fixes (anisotropy, invisible bolts,
wrong-direction crescent). A4 is trap avoidance (mirrors Story 52's `.tk-hit`).
A5, A8–A10 are refinements. A6 amends Story 52's brief directly. A7, A11 are
new (unspecified by the cluster brief). Adopted unchanged: §4 layer budget,
§4.2's counter-scale policy (not invoked here — §10), all §8 composition
rules, "absence always wins," the reduce-motion replace-don't-delete
principle, and the edge-case posture.
