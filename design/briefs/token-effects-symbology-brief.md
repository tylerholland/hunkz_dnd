# Token Effects & Symbology — Preliminary Design Brief

> Stories 52–55, briefed as one cluster. Damage flash, persistent condition
> indicators, the invisibility veil, and attack animations all land on the same
> 36px object and will frequently be true at the same instant. Briefing them
> separately would guarantee four independent solutions competing for the same
> pixels. This brief's centrepiece is §4, the layer budget — the rule that lets
> all four coexist without arbitration.
>
> **Status: PRELIMINARY.** Structural decisions, spatial allocation, colour
> families, priority orders and composition rules are locked. Exact keyframe
> percentages and the 14 individual condition glyphs are deliberately left as
> concepts for the ux-designer to draw.
>
> Produced by design-strategist. Builds on `battle-map-tokens-brief.md` (29),
> `battle-map-token-polish-brief.md` (29b), `per-token-resize-brief.md` (44),
> and Story 45 (map rotation).
>
> Palette: Ocean for DM chrome (`#0d0f14` / `#6a8fa8` / `#a0c0d0`). Player
> surfaces inherit each character's palette. Effect colours in this brief are
> **universal, not palette-derived** — the same reasoning as HP bar tiers and
> death-save pips. Damage is red on every palette.

---

## 1. Design intent

The battle map today is an accurate but **mute** board — things are in the right
places and nothing tells you what just happened to them. These four effects give
the board a voice. A DM glancing up mid-narration should absorb, without
focusing: *who got hurt and hasn't acted yet*, *who's still poisoned*, *where the
invisible ogre actually is*, and *that the archer just shot across the room*.

The emotional goal is **a board that reacts**. The functional goal is
unchanged from Story 29 and is the harder constraint: **the token layer must
still disappear when nothing is happening.** A healthy, unafflicted, out-of-turn
token must look exactly like it does today — portrait, ring, name. Every effect
in this brief is opt-in by state; nothing renders a placeholder, an empty slot,
or a "no conditions" indicator.

Mental model reinforced: **the ring is what you *are*, the badges are what's
*happening to you*, the space between tokens is what's happening *between* you.**
That sentence is the whole system, and it is the rule any future token effect
should be placed by.

---

## 2. Tier declaration

Per Story 16 discipline, and stricter than Stories 52–55 imply:

| Effect | Tier | Justification |
|---|---|---|
| **Damage flash — Phase A (impact)** | **Tier 1** | The loudest thing on the map for ~450ms. It is an interrupt: "look here now." |
| **Damage flash — Phase B (wound residue)** | **Tier 2** | Ambient. Answers "who's been hit since they last acted" on a scan, never demands a look. |
| **Condition badges** | **Tier 2** | Passive reference. Read during someone else's turn, acted on during yours. Never an interrupt. |
| **Invisibility veil (PC)** | **Tier 2** | Persistent state. Must be unmistakable but never animated loudly. |
| **Invisibility marker (NPC, DM-only)** | **Tier 1 (DM only)** | The DM adjudicates on this. Getting it wrong breaks the fiction. |
| **NPC absence (player view)** | **Not a tier — a rule** | This is information security, not visual design. See §7.4. |
| **Attack tracer** | **Tier 1, ephemeral** | Loud, short, then gone. Zero resting footprint. |

The Tier 1 / Tier 2 split inside Story 52 is the single most important
reinterpretation in this brief — see §5.1.

---

## 3. Information hierarchy

When multiple effects are live on one token, the eye must land in this order.
This ordering is enforced by the layer budget in §4, not by luck:

1. **Attack tracer** (while playing, ~220–420ms) — motion crossing empty map
   space beats everything. It's the only element that moves *between* objects.
2. **Damage impact** (~450ms) — a shockwave and a recoil on a single token.
3. **The token's portrait** — identity always outranks status. Nothing in this
   brief is allowed to obscure more than ~20% of the portrait, ever.
4. **Faction ring + wound halo** — the circumference. Highest-contrast edge on
   the token, survives at every zoom level, which is why both "faction" and
   "recently hurt" and "not fully here" live here.
5. **Condition badge cluster** — left column, quiet dark plates.
6. **DM-only invisible marker `◇`** — 12 o'clock, quiet, but categorically
   distinct so it never gets read as a condition.
7. **Concentration gem** (existing, 1–2 o'clock) and **number badge**
   (existing, 4–5 o'clock).
8. **Name label** (existing, 6 o'clock) — last, as established in Story 29.

**Resolved competition:** the damage flash and the attack tracer will nearly
always fire together (the attack *causes* the damage). They do **not** compete —
they are choreographed as one two-beat event (§8, Rule 3). Treating them as two
independent animations is the failure mode to avoid; it looks like a rendering
glitch, not a hit.

---

## 4. The layer budget — how four effects share one 36px object

This is the load-bearing section. Every effect is assigned exactly one layer and
is forbidden from borrowing another's. Because the assignments are disjoint, all
four can be simultaneously active with no arbitration logic.

```
L4  TOKEN LAYER          natural-image space, BELOW chips in z, rotates with map
    └─ Bolt tracer (55)

L0  POSITION WRAPPER     outside .token-chip's counter-rotation
    └─ x/y placement · poll-move glide (29b) · drop bounce (29)
    └─ Melee lunge (55)          ← spatial, must NOT be counter-rotated

L1  .token-chip          counter-rotated upright against --map-rotation (45)
    ├─ L1a  Portrait fill
    │        └─ veil desaturate (54) · DM hatch scrim (54) · FALLEN grey (29)
    ├─ L1b  Ring stack (inside → out)
    │        1. faction ring   2px   pal.accent (PC) / neutral grey (NPC)   [29]
    │           └─ becomes DASHED when invisible                            [54]
    │        2. black outline  1px   rgba(0,0,0,0.4)                        [29]
    │        3. wound halo   1.5px   #c06060 @0.7, slow breathe             [52B]
    │        4. interaction glow     held / drag / resize-selected     [29/34/44]
    └─ L1c  Whole-chip transform
             └─ impact recoil (52A) · hover-expand grow (29) · resize (44)

L2  BADGE ORBIT          child of chip → upright for free
                         counter-scaled against --token-size-mult (§4.2)
    12 o'clock  ◇ DM-only invisible marker                                  [54]
    1–2         ◆ concentration gem (existing)                              [29]
    10 → 8      condition badge column + overflow                           [53]
    4–5         number badge (existing)                                     [31]
    6           name label (existing)                                       [29]

L3  EPHEMERAL BURST      child of chip, top of z, pointer-events: none
    └─ damage shockwave ring (52A) · impact crescent (55)
```

### 4.1 Map rotation — the rule, and the one trap

Story 45's counter-rotation on `.token-chip` does almost all the work for free:

- **Anything placed inside the chip (L1, L2, L3) is upright automatically.**
  All condition badges, the `◇` marker, the shockwave, the impact crescent —
  no rotation handling needed. Put it in the chip; it stays readable.
- **Anything on the token layer (L4) rotates with the map, which is correct.**
  The bolt tracer is a spatial object connecting two map coordinates; it *should*
  rotate. Compute it in natural-image space and let it inherit. No correction.

**The one trap: the melee lunge.** It is visually attached to a chip but is
spatially meaningful (it points at the target). If applied on `.token-chip` it
inherits the counter-rotation and will point in the wrong direction on a rotated
map. **Apply the lunge translate on the L0 position wrapper, outside the
counter-rotation.** Never add a rotation correction to fix this — the correct
fix is choosing the right layer.

### 4.2 Effect symbology does NOT scale with per-token size

`effective_px = 36 × token.scale × map.tokenScale × mapViewerZoom`

With Story 44's per-token scale (0.5–3.0) stacked on calibration (0.5–2.5) and
zoom (0.5–5×), the chip's rendered size varies by ~100×. Naïvely-scaled badges
would be 6px on a familiar and 90px on a Gargantuan dragon.

**Decision: badges and the `◇` marker scale with calibration and zoom, but are
divided back out of the per-token `scale`** — implement as
`scale(calc(1 / var(--token-size-mult)))` on the L2 orbit container. A status
badge is the same physical size on every creature.

Rationale: this mirrors 29b §4's "tray chips do NOT scale" precedent and the
chrome-vs-content distinction it rests on. Creature size is *content*. A status
badge is *chrome about* the creature. A dragon with dinner-plate condition icons
would be absurd; a familiar with invisible ones would be broken.

Ring treatments (faction, wound halo, veil dash) **do** scale with everything —
they are part of the creature's silhouette, and scaling keeps them proportional
at any size.

---

## 5. Story 52 — Damage flash

### 5.1 The reinterpretation: two phases, not one

The story says "a flash that persists until the token's next turn." Taken
literally that is a pulsing red alarm sitting on the board for 60+ seconds, ×3
tokens in a busy round. That is unusable, and it would drown Stories 53–55.

**Split into two phases with completely different volumes:**

- **Phase A — IMPACT.** ~450ms. Loud. Tier 1. "This just happened."
- **Phase B — WOUND.** Persists to the token's next turn. Quiet, ambient,
  Tier 2. "Hasn't acted since being hit."

The story's *gameplay* requirement — "still marked reads as hasn't-acted-yet" —
is fully satisfied by Phase B. The *emotional* requirement — "damage registers
as an event" — is Phase A's job. Neither can do both.

### 5.2 Phase A — Impact

Three simultaneous elements, all universal red:

| Element | Layer | Treatment |
|---|---|---|
| **Shockwave ring** | L3 | Ring pseudo-element expands 100% → 165% of chip diameter, opacity 0.9 → 0. Colour `#e06060` (bright sibling of the app's universal `#c06060`). |
| **Impact recoil** | L1c | `scale: 1.0 → 0.92 → 1.04 → 1.0`. A compress-then-rebound, not a grow — reads as *taking* force, whereas the Story 29 drop-bounce (1.0→1.08→1.0) reads as *landing*. Deliberately the inverse curve so the two never read as the same event. |
| **Portrait wash** | L1a | Red multiply/overlay tint at 0.45 peak, fading to 0. |

**Timing:** ~450ms total. Recoil leads (0–200ms, ease-out then ease-in),
shockwave rides on top (0–380ms, ease-out), wash fades last (0–450ms).

**Two intensity tiers** (recommended, flagged as OQ-2):

- **Standard** (<25% of `hpMax` in one hit): recoil + wash only, no shockwave,
  ~300ms. A scratch shouldn't shake the room.
- **Heavy** (≥25% of `hpMax`, or any hit that crosses the token below 20% HP):
  full three-element treatment at listed values.

### 5.3 Phase B — Wound residue

**A `#c06060` halo ring at 1.5px sitting immediately outside the token's black
outline, at 0.7 opacity, breathing very slowly (0.5 ↔ 0.85 over 2.6s).**

Why the ring and not a badge or an inner shadow:

- **It survives the degradation ladder.** At 14px effective size, badges are
  gone but a red-outlined circle still reads. "Who's hurt" is a scan-the-board
  question and needs the highest-contrast element on the token.
- **It costs zero badge-orbit real estate**, which is fully spoken for by
  conditions.
- **It cannot be confused with FALLEN.** FALLEN is opacity 0.4 + grayscale 0.6 +
  an *inset* wash. The wound halo is an *outset* ring on a full-opacity token.
  Different axis entirely.
- **It preserves the faction read.** It's added *outside* the faction ring, not
  substituted for it. Both are legible simultaneously.

**Clearing:** at the start of that token's initiative turn, the halo fades out
over 400ms. That fade is itself a signal — "you're up, and you've shaken it off."

**Out of combat (OQ resolved):** no initiative to anchor to → **fixed 12s
window**, then the same 400ms fade. Long enough to survive a table conversation,
short enough not to lie.

**Multiple hits before the next turn (OQ resolved):** each hit **re-fires Phase A
and resets Phase B's anchor**. The most recent hit is the one that matters; a
"stacking" wound halo would just be a brighter red with no additional meaning.

**FALLEN interaction:** damage on a 0-HP token still fires **Phase A** (it drives
death saves — a real event) but leaves **no Phase B residue** (a corpse being
"recently hurt" isn't actionable). See §8, Rule 6.

---

## 6. Story 53 — Persistent condition indicators

### 6.1 Placement — the left column

The chip's clock face is already heavily claimed. Free arc: 7 o'clock through
12 o'clock.

```
                       12  ⑦ ◇ DM-only invisible marker (54)
                 11         1
          10 ⑤ ╭───────────╮ ◆ ②  concentration gem (existing, 29)
               │           │
       9  ⑤    │     ①     │        3
               │  PORTRAIT │
           8 ⑤ ╰───────────╯ ③ 3   number badge (existing, 31)
              7             5
                     ⑥
                 [ Goblin 1 ]      name label (existing, 29)
                       6
```

**⑤ Condition badges occupy the 10 → 8 o'clock column**, top to bottom, in
severity priority order. Left, because: the eye scans left-first (established in
the DM card work), and it is the largest contiguous free arc.

**Implementation shape:** a flex column tangent to the circle's leftmost point,
1px gap. Nudge badges 2 and 3 rightward by ~2px each to loosely trace the
curvature — enough to feel attached, not enough to require arc math.

### 6.2 The cap, and honouring "nothing silently unrepresented"

I'm partially overriding the story here. Six legible discrete icons cannot fit
around an 18–36px circle. Attempting it produces a token you cannot identify.

**Decision: 3 badge slots maximum. If more than 3 conditions are active, slot 3
becomes a `+N` overflow badge showing the count of unshown conditions.**

The story's actual requirement — *no condition silently unrepresented* — is met
by a two-surface guarantee:

1. **The count is never wrong.** `2 badges + "+3"` states truthfully that five
   things are wrong.
2. **The existing hover-expand HP card gains a condition line** listing every
   active condition in full text (IM Fell English 11px, family-coloured glyph +
   name). This is the complete truth, on demand, on a surface that already
   exists. Zero new chrome.

Ambient signal = the badges. Authoritative record = the hover card. That's the
correct split, and it's the same one the app already uses for HP (bar ambient,
numerals on demand).

### 6.3 Severity priority order (locked — do not leave to the implementer)

Which 3 of 6 conditions show is a gameplay decision, not an arbitrary sort.
Ranked by how much the condition changes what happens on the target's next turn:

| Rank | Conditions | Family |
|---|---|---|
| **1 — Incapacitating** | Unconscious · Paralyzed · Stunned · Petrified · Incapacitated | Control |
| **2 — Positional** | Restrained · Grappled · Prone | Bind |
| **3 — Sense / will** | Blinded · Charmed · Frightened · Deafened | Sense |
| **4 — Attrition** | Poisoned · Exhaustion | Physical |

Positional conditions rank *above* sense conditions specifically because this is
a **map** surface — "can't move" is the information a map is best at carrying.
Within a tier, sort by the order the conditions were applied (oldest first) so
badges don't shuffle position when an unrelated condition is added; a badge that
jumps around is a badge you have to re-read.

**Invisible is excluded from the badge set entirely** — it is Story 54's
whole-token treatment. Double-representing it would waste a slot and split the
signal. (Resolves Story 54 OQ-2.)

### 6.4 Colour families

Colour does the coarse read ("what *kind* of trouble"), the glyph does the fine
read ("which trouble"). Four families only — 14 distinct colours is not a real
option.

| Family | Colour | Meaning |
|---|---|---|
| Control | `#b05878` red-violet | loses or forfeits their turn |
| Bind | `#c8903c` amber *(reuses the existing universal wounded-amber)* | can't move freely |
| Sense | `#8a7cc8` violet-blue | perception or will compromised |
| Physical | `#8fae3c` toxic green | ongoing attrition |

`#8fae3c` is deliberately yellower than the app's healthy-HP `#5a9a5a` — the two
must never be confused on the same board.

### 6.5 Badge anatomy

**12px circle · dark plate `rgba(10,10,12,0.85)` fill · 1.5px family-coloured
ring · family-coloured glyph inside.**

Not a solid coloured chip. The dark-plate-with-coloured-stroke construction:
- reads on light terrain, dark terrain, and the `vellum` palette identically;
- matches the app's existing surface grammar (dark surface, coloured stroke);
- keeps the four families distinguishable without four different glyph colours.

**Overflow badge:** 14px, same plate, neutral `#c8c0b4` ring, `+N` numeral in
Cinzel 11px. *This is a deliberate exception to the design system's 12px minimum
text rule* — flagged for approval as OQ-10. If rejected, the fallback is a
three-dot `⋯` glyph with the count only in the hover card.

**Glyph concepts** (drawing is the ux-designer's job; these are the intents):

| Condition | Glyph concept | Condition | Glyph concept |
|---|---|---|---|
| Unconscious | filled downward crescent | Blinded | slashed eye |
| Paralyzed | forked bolt across a bar | Deafened | slashed ear arc |
| Stunned | tight spiral | Charmed | heart outline |
| Petrified | faceted hexagon | Frightened | jagged downward spike |
| Incapacitated | circle with a null bar | Poisoned | droplet |
| Restrained | two interlocking loops | Exhaustion | numeral 1–6 |
| Grappled | opposed clamp arcs | | |
| Prone | horizontal bar, dot above | | |

Every glyph must be legible as a **silhouette at 12px** — no interior detail, no
strokes under 1.5px. Test each against a busy forest-terrain background.

### 6.6 Exhaustion (Story 53 OQ-1 — resolved, flagged)

**Exhaustion is included in the cluster as a badge showing its numeral (1–6),
Physical family, and it sorts into Control-tier priority when level ≥ 4** (at
which point 5e halves HP max and zeroes speed — genuinely incapacitating) **and
Physical-tier priority at 1–3.** It consumes a normal slot; no exemptions.

One rule, honest representation. Flagged as OQ-1 because "exhaustion is out of
scope for the map" is a defensible alternative.

---

## 7. Story 54 — Invisibility

Three render states, not two. The story frames it as PC-vs-NPC; the real matrix
is viewer × subject.

| | Player viewer | DM viewer |
|---|---|---|
| **PC invisible** | **(a) VEILED** | **(a) VEILED** — identical |
| **NPC invisible** | **(c) ABSENT** | **(b) SECRET** |

### 7.1 (a) VEILED — invisible PC, seen by anyone

- Portrait: `grayscale(0.35)` + `opacity: 0.55`.
- **Faction ring becomes dashed** — 4px dash / 3px gap, same faction colour,
  same 2px width. This is the primary signal and it is **shape-based, not
  colour-based**, so it survives every palette, every terrain, and every form of
  colour blindness. A broken outline says "not fully here" without any legend.
- Slow shimmer: a low-opacity radial sheen sweeping the portrait every ~3.2s.
  Ambient only; subject to the one-loop cap (§8, Rule 4).
- Name label: opacity 0.6, rendered *italic* — the app already uses italic for
  "not literal" (nicknames, flavour text).
- No condition badge (§6.3).
- The owning player's own veiled token **remains draggable** (Story 34 unchanged).

**On the DM's map a veiled PC gets the veil and nothing more** — no `◇` marker,
because `◇` means "your players can't see this," which is false for a PC.
(Resolves the story's "presumably the same or DM-specific" ambiguity — OQ-9.)

### 7.2 (b) SECRET — invisible NPC, DM's map

Everything in (a), **plus** two DM-only additions:

- **Diagonal hatch scrim** across the portrait, `rgba(124,147,168,0.22)`,
  ~3px pitch. Hatching is the classic cartographic "this region is special-cased"
  mark and it's instantly distinguishable from a plain wash.
- **`◇` open-diamond glyph badge at 12 o'clock**, in `#7c93a8`, same 12px
  dark-plate anatomy as condition badges but positioned in its own reserved slot
  so it is never mistaken for one.

**Establishing a reusable rule:** `#7c93a8` — a cold, desaturated blue-grey
adjacent to the DM dashboard's own Ocean accent — becomes the app's colour for
**"information only the DM can see."** The DM's chrome colour marks the DM's
private knowledge. Future features (hidden initiative entries, DM-only map pins)
should reuse it. Flagged as OQ-7 because it's a system-level commitment.

**Hover card** on a SECRET token gains one line:
`◇ Invisible — not visible to players`, IM Fell English 11px, `#7c93a8`.
Unambiguous confirmation, since the whole feature's value is the DM trusting it.

### 7.3 (c) ABSENT — invisible NPC, player's map

Not rendered. No ghost, no dim, no placeholder, no gap in a layout.

**Transition matters.** When an NPC goes invisible while players are watching,
it must not *pop* out — a pop draws the eye hard to the last known position.
**Fade out over 500ms with a slight upward drift and scale to 0.94** — reads as
"it left," not "it's still there and I'm hiding it." Players legitimately saw it
turn invisible; a graceful exit is honest, a hard cut is jarring.

**Reappearance:** fade in over 280ms **at its current position**, which may be
somewhere else entirely. That discontinuity is not a bug — it is the mechanic
working, and it will land well at the table.

### 7.4 The rule that outranks everything

**Absence always wins.** If a token is not rendered for a viewer, then *nothing*
about it renders for that viewer: no damage flash, no shockwave, no condition
badge, no attack tracer terminating or originating at its position, no name
label. (Confirms Story 54 OQ-3 and the consultant's RAW reasoning — taking
damage does not reveal an invisible creature's location.)

**Design requirement, not an implementation detail:** the omission must happen
**server-side**, in the player-facing payload projection. A client-side filter is
a design failure — the position would be sitting in devtools and the feature
would be theatre. This must be stated plainly to code-architect.

---

## 8. Composition — the rules that make all four coexist

Six rules. Together they are the answer to "poisoned + flashing + resized +
rotated at once."

**Rule 1 — One layer per effect, no borrowing.** Per §4. Damage owns the ring
halo + a chip transform + an L3 burst. Conditions own the badge orbit.
Invisibility owns the portrait fill + the ring *style*. Attacks own L0 and L4.
Disjoint by construction — no arbitration code required.

**Rule 2 — Colour is never the only channel.** Invisibility signals with
**shape** (dashed ring). Damage signals with **motion + a halo**. Conditions
signal with **glyphs**, colour only grouping them coarsely. This is what stops
the token becoming a rainbow, and it's what makes the system colourblind-safe.

**Rule 3 — Ephemeral motion: one event per token, choreographed.** When an
attack tracer and a damage flash fire together (the common case), they are **one
event in two beats**, not two animations:

```
t = 0ms      bolt tracer arrives at target / melee lunge peaks
t = 0ms      impact crescent strikes target's circumference   [L3]
t = +60ms    damage shockwave expands from target             [L3]
t = +60ms    target impact recoil begins                      [L1c]
t = ~510ms   settled; wound halo now resting                  [L1b]
```

The 60ms offset is the entire trick — it turns two effects into cause and effect.
Firing them at t=0 simultaneously reads as a rendering glitch.

**Rule 4 — Persistent motion: one continuous loop per token, by priority.**
Three loops are possible at once (concentration pulse 1.4s, wound breathe 2.6s,
veil shimmer 3.2s). Three loops on a 36px object is noise.

Priority: **wound halo > veil shimmer > concentration pulse.** Lower-priority
loops render as their **static end state** — the concentration gem is still
present, just not pulsing; the veil is still applied, just not shimmering. No
information is lost, only motion.

This is intentionally the identical mechanism as the `prefers-reduced-motion`
"replace, don't delete" rule from 29b §9 — **the busy-token path and the
reduced-motion path should be the same code**, differing only in what triggers
them.

**Rule 5 — Degradation ladder by effective token size.**
`effective_px = 36 × token.scale × map.tokenScale × mapViewerZoom`

| Effective size | Behaviour |
|---|---|
| **≥ 30px** | Everything renders. 3 badge slots. |
| **20 – 30px** | Badge cap drops **3 → 2** (+N absorbs the rest). Name label hides below 0.6 combined scale (existing 29b rule). |
| **12 – 20px** | Badges collapse to **one summary badge**: a single dark plate, ring in the *highest-priority active family's* colour, total condition count as the numeral. Coarse but never wrong. |
| **< 12px** | Badges hide entirely. **Ring treatments persist** — wound halo and dashed veil ring survive at any size. Conditions reachable only via hover-expand. |

This is the direct answer to the resized-boss case. A Gargantuan dragon sits at
the top band with full symbology; a Tiny familiar at 0.5× on a zoomed-out map
sits at the bottom band and keeps only its rings. Both are legible; neither is
cluttered.

**Rule 6 — FALLEN suppresses.** At 0 HP (opacity 0.4, grayscale 0.6):

- Condition badges: **hidden.** Conditions on a body aren't actionable.
- Wound halo: **hidden.** Everything about a FALLEN token already says "hurt."
- Veil: **kept.** A dying invisible NPC is still hidden — this still matters.
- Number badge: **kept.** Identity always survives.
- Damage Phase A: **still fires** (drives death saves). Phase B: suppressed.

---

## 9. Story 55 — Attack tracer

### 9.1 UX-relevant assumption (flagged, not silently resolved)

The data doesn't exist. Rather than block on a targeting flow, here is the
**minimum signal that already exists in the app**:

> **The tracer fires from the token of whichever entity holds the active
> initiative turn, to the token of whichever entity had damage applied to it,
> whenever both resolve to tokens on the current battle map.**

- **Target** is already captured — the DM dice roller's "Apply to…" pills and the
  `DamageHealModal` both name a specific character; NPC HP steppers name an NPC.
- **Attacker** is inferred from `initiative.activeTurnIndex`, which the app
  already tracks and everyone at the table already agrees on.
- **Zero new UI. Zero new capture step.** Correct in the overwhelming majority of
  cases, because attacks happen on your turn.
- **If either side doesn't resolve to a placed token: no tracer.** Silent. Never
  an error, never a partial animation.

This resolves Story 55 OQ-1 in favour of the lighter first pass, and OQ-3
affirmatively: **any damage-apply path fires it** — dice roller "Apply to…",
`DamageHealModal`, and the inline ±1 HP stepper alike. The DM shouldn't have to
learn which button is "the animated one."

**Heals** (recommended, flagged as OQ-3): fire a **support tracer** — same
geometry, `#5a9a5a` healthy green, no impact crescent (a soft bloom on arrival
instead). A cleric reaching across the map is a real event worth showing. Easy
to cut if unwanted.

### 9.2 Melee vs. ranged — inferred from distance

Also solvable with zero new data: **measure the distance between the two tokens
in normalised image space.** Within ~1.5 combined token diameters → **Melee**.
Beyond → **Ranged**.

Right most of the time. When wrong (a reach weapon, a point-blank spell) the
consequence is purely cosmetic — no rule, HP value, or state depends on it.

**Push-back on the story's three-way split:** melee / ranged-weapon / spell
cannot be earned from data we can infer today. Distance separates melee from
everything else; it cannot separate an arrow from a firebolt.
**Ship two visuals well (Strike and Bolt) rather than three badly.** A third
"Arcane" variant becomes available the moment a `range` / `attackType` tag lands
on weapon and spell items — flagged as the v2 upgrade (OQ-4, OQ-5).

### 9.3 Melee — "Strike"

Nothing travels, because nothing crosses distance. Two elements:

- **Attacker lunge** — 6% translate toward the target and back. 140ms out
  (ease-out), 180ms back (ease-in). Applied on the **L0 position wrapper**
  (§4.1 trap). This alone communicates *who attacked whom* without drawing a
  single line across the map.
- **Impact crescent** — a short arc on the *target's* circumference, oriented on
  the attacker→target bearing. 120ms scale-and-fade. Colour `#dce8f0` cold steel
  white — universal, reads as physical impact, and cannot be confused with the
  gold already claimed by crits and completed counter wheels.

### 9.4 Ranged / spell — "Bolt"

- A tapered streak ~3px wide travelling attacker → target along a straight line
  with a gentle quadratic arc (sag ≈ 8% of distance), trailing a short fade.
- **Duration scales with distance: 220ms floor, 420ms ceiling.** A long shot
  feels like it travels; a short one doesn't drag.
- Terminates in the same impact crescent.
- **Rendered on L4, below the chips in z-order.** The bolt emerging from behind
  the attacker and vanishing behind the target reads as depth and never occludes
  a face. Elevation as meaning.
- **Colour = the attacker's palette accent for PCs, `#c0c8c0` neutral for NPCs.**
  This buys identity for free: an ember-palette attacker's bolt arrives warm
  orange and the table instantly knows who fired without reading a label. When
  spell classification eventually arrives, spells keep the palette tint and
  ranged weapons drop to neutral steel — which is exactly the right eventual
  distinction.

### 9.5 Visibility

Governed entirely by §7.4. If either endpoint is an ABSENT token for a viewer,
**that viewer sees no tracer at all** — not a tracer to empty space, not a
half-tracer. The bolt originating from nowhere would leak the invisible
attacker's position just as effectively as rendering the token.

---

## 10. Motion & animation summary (preliminary)

Durations and curves are directional. Exact keyframe percentages are the
ux-designer's to finalise.

| Event | Element / motion | Duration · easing | Communicates |
|---|---|---|---|
| Damage — Heavy | Shockwave 100→165% + recoil 1→0.92→1.04→1 + red wash | ~450ms; recoil ease-out/ease-in, ring ease-out | "that landed hard" |
| Damage — Standard | Recoil + wash, no shockwave | ~300ms | "took a hit" |
| Wound halo appears | opacity 0 → 0.7 | 200ms ease-out | "still carrying that" |
| Wound halo resting | breathe 0.5 ↔ 0.85 | 2.6s loop, ease-in-out | ambient, non-demanding |
| Wound halo clears (turn start) | fade to 0 | 400ms ease-out | "you're up — shaken off" |
| Condition badge appears | scale 0.7→1 + opacity 0→1 | 180ms ease-out | "something new arrived" |
| Condition badge clears | scale 1→0.8 + opacity→0 | 140ms ease-in | "that's over" |
| Badge column reflows | siblings translate to new slot | 160ms ease-out | "the stack changed, same items" |
| Veil applied | grayscale + opacity + ring solid→dashed | 320ms ease-in-out | "fading out of the world" |
| Veil shimmer | radial sheen sweep | 3.2s loop | ambient presence |
| Veil removed | reverse | 240ms ease-out | "back" |
| NPC vanishes (player view) | opacity→0, translateY −4%, scale→0.94 | 500ms ease-in | "it left" — not "it's hidden here" |
| NPC reappears (player view) | opacity+scale 0→1 at current position | 280ms ease-out | "there it is — and it moved" |
| Melee lunge | 6% translate toward target and back | 140ms out / 180ms back | "A struck B" |
| Bolt travel | tapered streak, arc, trailing fade | 220–420ms by distance, ease-out | "something crossed the room" |
| Impact crescent | arc scale-in + fade on target rim | 120ms ease-out | "it connected, from that side" |
| Support (heal) tracer | green streak + soft bloom, no crescent | same as bolt | "help arrived" |
| Attack + damage combined | crescent t=0, shockwave t=+60ms | ~510ms total | cause, then effect |

---

## 11. `prefers-reduced-motion`

Fold into the **single authoritative block in `tokens.css`** established by
29b §9. Strategy remains **replace, don't delete** — see §8 Rule 4; this is the
same mechanism as the busy-token loop cap.

| Motion point | Reduce-motion behaviour |
|---|---|
| Damage Phase A (all three elements) | Replaced by a **single static red rim flash held 900ms** then removed. The event must still be perceivable — silently dropping it loses real information. |
| Wound halo breathe | Static at 0.7 opacity. Halo stays. |
| Wound halo appear / clear | Instant. |
| Condition badge appear / clear / reflow | Instant. |
| Veil apply / remove | Instant. |
| Veil shimmer | Suppressed; desaturation + dashed ring remain. |
| NPC vanish / reappear (player) | Instant. |
| Melee lunge | Suppressed. **Impact crescent held static 300ms** so the attack is still readable. |
| Bolt travel | Replaced by a **static line held 200ms** then removed — the spatial relationship is the whole point and must survive. |
| Support tracer | Same static-line substitution, green. |

The principle throughout: **motion may be removed; meaning may not.** Every
suppressed animation is replaced by a static state that carries the same
information for a comparable duration.

---

## 12. Edge cases & empty states

**The empty state is the most common state and must look intentional:** a
healthy, unafflicted, visible, off-turn token renders as **exactly today's
token** — portrait, faction ring, black outline, name label. No empty badge
slots, no zero-count indicator, no reserved gutters. If nothing is wrong, the
symbology layer is not in the DOM.

| Case | Behaviour |
|---|---|
| Poisoned + wounded + resized Huge + map rotated 90° | All four independent: badge upright via chip counter-rotation, counter-scaled against `--token-size-mult`; wound halo proportional to the enlarged ring; nothing collides. This is the target scenario and the layer budget resolves it with no special-casing. |
| 6 conditions active | 2 badges + `+4`. Full list in the hover card. |
| Condition added while another is animating out | New badge's entrance waits for the reflow (160ms) to settle, then plays. Never two badges mid-transit in one slot. |
| Invisible + poisoned (PC) | Veil + badges both render; badges stay at full opacity while the portrait dims — status must not become unreadable just because the creature is faint. |
| Invisible NPC + damage (player view) | Nothing. §7.4. |
| Invisible NPC + damage (DM view) | Full Phase A + Phase B over the hatched veil. |
| FALLEN + 3 conditions | Badges hidden (Rule 6); conditions still listed in the hover card. |
| Damage lands on a token not on the map | No tracer, no flash. Silent. HP still updates everywhere else. |
| Attacker and target are the same token | No tracer (self-damage). Damage flash still fires. |
| Attack while `activeTurnIndex` is null / no combat | No tracer. Damage flash still fires. Never guess an attacker. |
| Two damage events within 450ms | Second re-fires Phase A from the start (interrupts, does not queue) and resets Phase B. |
| Token removed from map mid-effect | All effects unmount with it. No orphaned L3/L4 elements. |
| Map switched mid-tracer | Tracer cancels immediately. |
| Effect state arrives for a token that no longer exists | Silently discarded. |
| `vellum` (light) palette map / very light terrain | Every effect carries the 1px `rgba(0,0,0,0.4)`-family dark outline convention. Badge dark plates are the reason this works — a light-fill badge would disappear on parchment. |

---

## 13. Mobile vs. desktop delta

Token symbology is **map-relative, not screen-relative**, so nothing reflows,
truncates, or disappears purely by viewport width. The real deltas are three:

| Aspect | Mobile (<900px, 320px map) | Desktop (≥900px, 480px map) |
|---|---|---|
| **Practical degradation band** | The DM zooms out further on a 320px-tall map, so **20–30px effective is the everyday case** → **2 badges + overflow is the canonical layout to design against**, not 3. | 3-badge layout is common. |
| **Access to the authoritative condition list** | Long-press 280ms → hover-expand card. Slower and more deliberate → **the badge cluster carries proportionally more of the load**; glyph legibility at 12px matters more here than anywhere. | Hover, 120ms. Cheap. Badges can be more purely ambient. |
| **Attack tracer legibility** | Bolt on a 320px map is short. Enforce the **220ms floor** so it doesn't flicker past unseen. | Distance range is wider; the 420ms ceiling matters more. |

Everything else — colours, glyphs, ring treatments, veil, motion curves, the
degradation ladder — is identical across breakpoints by design.

---

## 14. Files likely touched (for code-architect)

**Frontend**
- `src/features/dmDashboard/battleMode/BattleModeController.jsx` — `TokenChip`:
  L1b ring stack, L2 badge orbit + counter-scale, L3 burst container, veil
  variants, DM-vs-player branch for the `◇` marker.
- `src/features/dmDashboard/tokens.css` — all new symbology classes, the four
  family colour tokens, the degradation-ladder container queries / size bands,
  and additions to the single authoritative reduced-motion block.
- `src/features/maps/MapViewer.jsx` — L4 tracer overlay in natural-image space
  (below the chip layer in z); confirm it inherits `--map-rotation` uncorrected.
- `src/features/dmDashboard/MapPanel.jsx` — tracer trigger wiring from
  damage-apply paths; attacker resolution from `initiative.activeTurnIndex`.
- `src/features/characterSheet/CharacterSheetSessionMode.jsx` (`PlayerMapViewer`)
  — player-side tracer + the ABSENT filter's client-side counterpart.
- New: a small shared `tokenEffects` module — condition→family/glyph/priority
  map, size-band resolver, loop-priority resolver. Consumed by both maps.

**Backend**
- Player-facing map/token projection — **server-side omission of invisible NPC
  tokens** (§7.4). Non-negotiable.
- Player-facing token payload must carry `conditions` for PC tokens (Story 54
  OQ-1) — while continuing to withhold invisible NPCs entirely.
- Damage-event timestamp for cross-viewer flash sync (Story 52's
  `lastDamagedAt`-style field) — shape is architecture's call.

---

## 15. Open questions

1. **Exhaustion on tokens.** Brief includes it as a numeral badge, Physical
   family, escalating to Control-tier priority at level ≥ 4. Alternative: omit
   from the map entirely. *Recommend include.*
2. **Damage flash intensity tiers.** Brief proposes two (Standard <25% hpMax,
   Heavy ≥25% or crossing below 20% HP). Alternative: one uniform treatment.
   *Recommend two — a scratch and a critical hit shouldn't look identical.*
3. **Attack tracer trigger + heal tracers.** Brief assumes attacker = active
   initiative turn, target = damage recipient, fires on every damage-apply path,
   and adds a green support tracer for heals. **Confirm the attacker assumption
   explicitly — it is the load-bearing guess in this whole cluster.** Heal
   tracers are the easiest thing here to cut.
4. **Melee/ranged inferred from token distance.** Zero new data, right most of
   the time. Alternative: block Story 55 until a `range`/`attackType` tag exists
   on weapons and spells. *Recommend ship on inference now, upgrade later.*
5. **Two attack visuals, not three.** Brief collapses ranged-weapon and spell
   into one "Bolt" for v1. Confirm the three-way split can wait for item tagging.
6. **Wound residue out-of-combat window: 12s.** Tune after playtest.
7. **`#7c93a8` as the app-wide "DM-only knowledge" colour.** This is a
   system-level commitment beyond these four stories. Confirm before it
   propagates.
8. **Badges counter-scale against `--token-size-mult`** (constant physical badge
   size on every creature). *Recommend yes.* The alternative is proportional
   badges, which break at both size extremes.
9. **Veiled PC on the DM's map gets no `◇` marker.** Rationale: `◇` means
   "players can't see this," which is false for a PC. Confirm.
10. **`+N` overflow numeral at 11px** violates the design system's 12px minimum
    text rule. Flagged as a requested exception. Fallback if rejected: a `⋯`
    glyph with the count only in the hover card.
11. **Should the wound halo also appear on the DM's *party cards*, not just
    tokens?** Out of scope here, but the same "hasn't acted since being hit"
    question exists on the card strip. Worth a follow-up story.
