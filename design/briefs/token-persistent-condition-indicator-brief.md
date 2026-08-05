# Persistent Condition Indicator on Tokens — Design Brief

> **Story 53.** Second of the Stories 52–55 token effects cluster.
>
> Cluster brief (`token-effects-symbology-brief.md`) owns the §4 layer budget —
> normative and unchanged. **This brief supersedes its §6.** Divergences listed
> in §13.
>
> Builds on: `battle-map-tokens-brief.md` (29), `battle-map-token-polish-brief.md`
> (29b), Story 31 (number badge), Story 34 (player drag), Story 44 (resize),
> Story 45 (rotation).
>
> **Colours are universal, not palette-derived** — same reasoning as HP-bar
> tiers and death-save pips.

---

## 1. Design intent

The map is spatially truthful but medically silent. A glance across eight
tokens should answer "who's impaired, and roughly how badly" with no focused
read — for the DM and for players. Register is **cold and clinical**:
conditions are standing facts, not events. **No resting animation ever** —
motion exists only at the moment state changes.

Mental model: **the ring is what you are; badges are what's happening to you.**
Badges live strictly outside the ring, annotating the creature, never becoming
part of it.

## 2. Tier

**Tier 2 — ambient reference.** No resting animation of any kind (loop budget
never applies — badges have no loop to lose). Badges are **not interactive**,
`pointer-events: none` unconditionally.

## 3. Information hierarchy

1. Portrait — badges occlude **0%** of it (column is left-of-token, not overlaid).
2. Slot 1 badge — highest-priority active condition, fixed position, the read.
3. Slot 2, then Slot 3 (carries stack motif when more are hidden).
4. Name label (pushed 2px→4px further out by this feature).
5. Detail card's condition block — authoritative, on demand.

**Resolved competitions:** slot 1 vs. concentration gem separated by position,
construction (dark plate+ring vs. bare dot), and colour space. Slot 3 vs. name
label resolved by moving the label offset 2px→4px globally.

## 4. Anatomy and layout

Lives in `L2 BADGE ORBIT` (child of `.token-chip`, cluster §4) — free rotation
handling (counter-rotated) and counter-scaled against `--token-size-mult` (same
physical size on a Tiny familiar and a Gargantuan dragon; badges are chrome
*about* the creature, not content).

**Single left-edge column, top-anchored ~11 o'clock, growing downward.**
Three invariants:
- **I1 — Slot 1 never moves.** Column anchored at top, not centred.
- **I2 — top→bottom = priority order.**
- **I3 — 1px min clear air** between badge and ring (`r=19` nominal 36px chip)
  — Story 52's wound halo and Story 54's veil ring both write to the ring.

```css
.token-cond-column {
  position: absolute; top: -1px; left: -14px; width: 12px;
  display: flex; flex-direction: column; gap: 1px;
  pointer-events: none;
  transform: scale(calc(1 / var(--token-size-mult, 1)));
  transform-origin: center right;
}
```
Badge diameter 12px, slot pitch 13px. Slot centres relative to chip centre:
`(-20,-13)`, `(-20,0)`, `(-20,+13)`. Requires `overflow: visible` on ancestors.

**One layout change to an existing element:** name label offset 2px → 4px
below the token, global and unconditional.

### Badge anatomy
Dark plate `rgba(10,10,12,0.88)` + 0.5px white hairline outside the ring +
1.5px family-colour ring + filled glyph in a 7.5px box. Dark plate (not solid
colour chip) reads on any terrain including `vellum`, matches the app's
existing dark-surface-coloured-stroke grammar.

**Stack motif** ("more behind this"): second plate, no ring, offset `(-2px,
+2px)`, ~2px crescent visible. Used for: N>slots (bottom badge carries it),
collapsed 1-slot band, and 0-HP summary badge.

## 5. Condition set, priority, glyphs

**Badge-eligible = `conditions[]` minus `"Invisible"` (Story 54's own
treatment), plus `Exhaustion` when `exhaustionLevel ≥ 1`.** 14 possible marks,
applied identically on every viewer so counts always agree.

**Four colour families** (colour = coarse read, glyph = fine read — a glyph
only needs to differ within its own family):

| Family | Colour | Meaning |
|---|---|---|
| Control | `#b05878` red-violet | loses/forfeits turn |
| Bind | `#c8903c` amber (reuses app's wounded-amber) | can't move freely |
| Sense | `#8a7cc8` violet-blue | perception/will compromised |
| Physical | `#8fae3c` toxic green (yellower than healthy-HP green, never confused) | ongoing attrition |
| Unknown | `#c8c0b4` neutral | unrecognised string |

Colour-blind safety: Control/Physical (the classic confusable pair) separated
by luminance + maximally distinct glyph silhouettes; colour never carries
meaning alone.

**Priority order (locked, gameplay decision, not implementer's choice):**

| Rank | Conditions | Family |
|---|---|---|
| 1 Incapacitating | Unconscious, Paralyzed, Stunned, Petrified, Incapacitated | Control |
| 2 Positional | Restrained, Grappled, Prone | Bind |
| 3 Sense/will | Blinded, Charmed, Frightened, Deafened | Sense |
| 4 Attrition | Poisoned, Exhaustion 1–3 | Physical |
| dynamic | Exhaustion ≥4 promotes to rank 1, ring becomes Control | — |

Positional ranks above sense because this is a *map* ("can't move" is map
information; "can't see" belongs on the sheet). **Tie-break: order of
appearance in `conditions[]`** (already application order) — never alphabetical
(would reshuffle badges and break I1).

**Glyph mandate: filled paths only, no strokes anywhere** — silhouettes survive
downscaling, strokes don't. Authored on a 10×10 viewBox → 7.5px glyph box, min
limb 2 viewBox units, no interior detail under 2 units, knockout-gap technique
for slashes (Blinded/Deafened). Full glyph table:

| Condition | Family | Silhouette |
|---|---|---|
| Unconscious | Control | thick downward crescent (closed eyelid) |
| Paralyzed | Control | three-segment bolt |
| Stunned | Control | tapering spiral, 1.25 turns |
| Petrified | Control | solid irregular hexagon |
| Incapacitated | Control | filled annulus + diagonal bar, knockout-gapped |
| Restrained | Bind | bold filled X (a net) |
| Grappled | Bind | two opposed chevrons pointing inward |
| Prone | Bind | bar + circle resting on it (body lying down) |
| Blinded | Sense | almond eye + knockout slash |
| Deafened | Sense | two nested crescents (sound waves) + knockout slash |
| Charmed | Sense | filled heart |
| Frightened | Sense | bold downward chevron `V` |
| Poisoned | Physical | filled droplet |
| Exhaustion | Physical→Control | six-segment radial micro-gauge, `exhaustionLevel` segments filled clockwise from 12, 2-unit centre dot |
| unrecognised | Unknown | single filled dot, neutral ring |

**Exhaustion uses a gauge, not a numeral** — a numeral in a 12px badge renders
~8px (below the 12px text minimum, illegible on a moving map); the gauge reads
as proportion-of-severity at any size and reuses the Counter Wheels
fill-to-here vocabulary. Exact number lives in the detail card.

## 6. Detail card — authoritative record

Two-surface guarantee (like HP bar/numerals): ambient badge column (top 1–3 +
honest "more" mark) + the existing hover/long-press card gaining a condition
block listing **every** active condition. Slots in immediately below the HP
bar, above the concentration row (conditions outrank concentration here — it's
why the card was opened).

```
│  ✕ RESTRAINED            │  9px glyph + 11px IM Fell English,
│  ◍ POISONED              │  uppercase, letterSpacing 0.12em,
│  ◍ EXHAUSTION 3          │  family colour. Line height 14px.
```
Card width stays 124px. Order matches badge-column priority (superset, not a
differently-sorted list). No section label. Exhaustion is the one item shown
numerically here. Invisible gets its own line from Story 54, not this block.

## 7. Interaction model

Non-interactive by design (`pointer-events: none`) — a 12px tap target would
violate the 44px minimum, sit inside the drag/long-press gesture paths, and an
accidental clear would be silent data loss. Conditions are managed on existing
surfaces (DM party card chips, `⋯` Add Condition popover, character sheet
condition grid) — this is a **display surface** only.

**Size-band resolution:** `effective_px = 36 × scale × tokenScale × zoom`,
computed in JS (container queries unreliable in a transformed layer), written
as `data-cond-band`, **80ms debounce + 2px hysteresis** at boundaries (prevents
strobing during pinch-zoom).

| Band | effective_px | Slots |
|---|---|---|
| full | ≥30px | 3 |
| two | 20–30px | 2 — everyday mobile case |
| one | 12–20px | 1 (collapsed; stack if N>1) |
| none | <12px | 0 — detail card only |

Column is top-anchored (I1), so a band change removes slot 3 and moves nothing.

## 8. Motion spec

No resting animation (§2). Key events:

| Event | Motion | Duration |
|---|---|---|
| Badge appears | scale 0.7→1 + opacity 0→1 | 180ms ease-out |
| Badge clears | scale 1→0.8 + opacity→0 | 140ms ease-in |
| Column reflow | siblings translateY to new slot | 160ms ease-out |
| Insert after reflow | reflow first, then new badge's entrance | 160+180ms sequential |
| Stack motif appear/clear | plate opacity + translate shift | 140ms ease-out |
| Exhaustion gauge step | segment opacity 0→1 | 120ms ease-out |
| Exhaustion tier escalation (3→4) | ring colour change + one opacity pulse | ~400ms total — the only badge that ever raises its voice |
| Band change / collapse to summary | drop/gain badges as above | as above |
| Map rotates | nothing — already counter-rotated | 0ms |

**Explicitly no animation:** first-render colour, priority shifting from an
unrelated condition clearing, anything on the card independent of the card.

**Reduced motion** (single authoritative block, 29b §9): all of the above
become instant snaps; escalation pulse suppressed (colour change alone
carries the meaning).

## 9. Edge cases

**The empty state is the most common state** — healthy token = exactly today's
token, column absent from DOM entirely if no badge-eligible conditions.

| Case | Behaviour |
|---|---|
| Only condition is Invisible | Column absent — Story 54's veil is the signal |
| exhaustionLevel: 0 | No exhaustion badge |
| 6 conditions, full band | 3 badges, slot 3 carries stack, all 6 in card |
| hpCurrent=0/FALLEN | Collapses to single summary badge @0.6 opacity (stack if N>1) — deliberate divergence from cluster brief's "hide entirely"; compressing beats deleting |
| Unrecognised string | Neutral badge, single-dot glyph, rank 4, never dropped |
| Added/removed within one poll | Never rendered — no event queue to replay |
| Mid-drag (own PC) | Badges ride the chip at full opacity |
| Damage flash firing (52) | Independent layers; badges recoil with chip, don't tint red |
| Veiled PC (54) | Portrait dims/desaturates; **badges stay full opacity** |
| Invisible NPC, player view | Nothing renders — absence always wins |
| Gargantuan / Tiny token | Badges same physical size via counter-scale |
| Adventure mode / classic sheet Map tab | No token layer, feature absent |

### Player-side visibility rules (design requirements)
1. **PC badges follow `partyVisibilityEnabled`** (hides with HP when off); own
   token always shows its own badges.
2. **NPC conditions must be added to the public projection** — not carried
   today (`initiativePublic` strips to `healthTier`); required backend addition.
3. **Hidden initiative entry ⇒ no public conditions** for that NPC — reuses the
   existing hide-entry toggle as the single secrecy lever.
4. `Invisible` stripped from every viewer's badge-eligible set identically —
   counts must never leak a hidden condition.

## 10. Mobile vs. desktop

Map-relative, not screen-relative. Mobile's everyday band is `two` (design/
review the 2-slot layout as canonical); long-press 280ms makes the badge
column carry proportionally more load, so 12px glyph legibility matters most
there. Desktop: `full` is common, hover 120ms is cheap, badges can be more
purely ambient. Colours/glyphs/geometry/priority/motion/ladder identical
across breakpoints.

## 11. Implementation notes

New shared module (`tokenConditions.js` or fold into cluster's `tokenEffects`):
condition→`{family,rank,glyphId}` map, badge-eligible filter, stable priority
sort, size-band resolver — **must be consumed by both maps** (two copies
guarantees drift). Glyph delivery via one SVG `<symbol>` sprite + `<use>` (not
inlined paths per token). `overflow: visible` required on ancestors up to the
map layer. No CSS `rotate` property anywhere (repo-wide rule, Story 45).
Counter-scale origin `center right`.

**Backend:** NPC `conditions` added to the public projection
(`initiativeProjection.js`/`getSessionState.js`), with the hidden-entry strip.
PC conditions already in `projectPlayerCharacter()`. `exhaustionLevel` must
reach both maps (NPCs have no such field — simply never show the badge).

## 12. Open questions

1. Exhaustion on the map — *recommend include* as the 6-segment gauge.
2. Clearing a condition from the map — deliberately out of scope; natural home
   is a future `Conditions ▸` submenu on the DM's long-press menu.
3. Exhaustion tier-escalation pulse — *recommend keep*, easiest thing to cut
   if conditions need to stay fully mute.
4. Making NPC conditions public — a real information change; §9 rule 3 gives
   the DM an escape hatch. Confirm sufficient, or want a per-NPC toggle?
5. PC badges hidden with `partyVisibilityEnabled` — confirm (own token always
   shows).
6. 0-HP collapsed summary badge (vs. hiding entirely) — *recommend the summary*.
7. Family colours propagating to sheet condition pills / DM card chips — good
   outcome but a design-system change beyond this story; confirm before it
   propagates.
8. Name label offset 2px→4px — trivial but touches an existing element, confirm.

## 13. Divergences from the cluster brief §6

| Topic | Cluster brief | This brief | Why |
|---|---|---|---|
| Overflow | `+N` numeral badge | No numeral — stack motif on bottom badge | 3 real conditions beat 2+"5"; removes a 12px-text exception |
| Column anchoring | Centred, curvature-nudged | Top-anchored, slot 1 fixed forever | Centred column reflows/moves slots on every change |
| Exhaustion glyph | Numeral | 6-segment radial gauge | Numeral illegible at 12px |
| Collapsed summary | Ring + count numeral | Actual glyph + stack motif | True subset of full state |
| 0 HP / FALLEN | Hidden | Collapsed to 1 summary @0.6 | Compressing beats deleting |
| Glyph construction | "no strokes under 1.5px" | Filled paths only, no strokes | Forces silhouettes |
| Badge plate | `rgba(10,10,12,0.85)` | `0.88` + 0.5px hairline | Separates dark plate from dark terrain |
| Party visibility | Not addressed | PC badges hide with `partyVisibilityEnabled` | Coherence with hidden HP |
| NPC secrecy | Not addressed | Hidden entry ⇒ no public conditions | Reuses existing lever |
| Size-band mechanism | Container queries | JS `data-cond-band` + debounce/hysteresis | Container queries unreliable in transformed layer |
| Card condition line | Unspecified | Fully specified block | Prevents ad-hoc implementation |
| Resting motion | Implicit via loop cap | Explicit, permanent law | — |

Everything else (layer budget §4, counter-scale §4.2, family colours, priority
order, `Invisible` exclusion, "absence always wins" §7.4, degradation
thresholds §8 Rule 5) is adopted unchanged.
