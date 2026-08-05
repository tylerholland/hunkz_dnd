# Token Damage Flash — Design Brief

> **Story 52.** First of the Stories 52–55 token effects cluster; the shared
> spatial contract lives in `design/briefs/token-effects-symbology-brief.md`
> (the "cluster brief"). **This brief supersedes the cluster brief's §5 where
> they differ.** Cluster brief remains authoritative for the layer budget (§4),
> composition rules (§8), and Stories 53–55.
>
> Builds on `battle-map-tokens-brief.md` (29), `battle-map-token-polish-brief.md`
> (29b), `per-token-resize-brief.md` (44), Story 45 (map rotation).
>
> **Colour policy:** universal, not palette-derived — same rule as HP-bar tiers,
> death-save pips, error text. Damage is red on every palette. The faction ring
> is never touched by this feature.

---

## 1. Design intent

The battle map tells you where things are but nothing about what just happened.
This feature gives it a voice for one event — **something just got hurt** —
then a quiet residue answering "who's carrying a wound they haven't answered
for yet." For ~450ms the struck token is the loudest thing on screen; at rest,
a healthy token looks exactly like it does today (no ring, no slot, nothing in
the DOM).

Mental model: **the ring is what you *are*; motion is what just *happened*; a
resting glow is what's still *true*.**

## 2. Two phases, not one flash

A literal "flash that persists until next turn" would be a 60s+ alarm. Split
into two tiers with different jobs:

| Phase | Tier | Life | Job |
|---|---|---|---|
| **A — IMPACT** | 1, interrupt | ~450ms | "This just happened, look now." |
| **B — WOUND** | 2, ambient | until next turn | "Hasn't acted since being hit." |

Phase B matters because the map is pannable/zoomable — a viewer may simply not
have been looking when Phase A played. Phase A is lossy; Phase B is the
recoverable record.

**Three amendments to the cluster brief:**
1. Impact recoil does **not** animate `.token-chip`'s transform (fully claimed
   by Story 45's counter-rotation + Story 44's scale). **Recoil gets its own
   wrapper `.tk-hit`**, between the position wrapper and the chip.
2. Phase A's portrait wash uses plain alpha compositing, not a blend mode.
3. Below 24px effective size, Standard hits promote to Heavy (recoil degrades
   first, shockwave survives longest).

## 3. Information hierarchy

1. Phase A motion on the struck token (outranks map, initiative, party cards).
2. The struck token's portrait — **no element may obscure >~20%** of it.
3. Wound halos across the board (Phase B) — read as a scan-level set.
4. Everything already on the token — unchanged, unmoved.

**Resolved competitions:**
- **Multiple tokens hit at once** (AoE): stagger 70ms apart, stable order — not
  simultaneous (reads as a glitch).
- **Phase A vs. attack tracer (Story 55):** one event in two beats — tracer
  peaks at t=0, Phase A begins at **t=+60ms** (exposed as a start-delay param
  for Story 55; see that brief's amendment).
- **Phase B vs. concentration pulse:** wound halo outranks — gem renders at its
  static end state while halo breathes.
- **Phase B vs. FALLEN:** suppressed on FALLEN tokens (Phase A still fires).

## 4. Colour tokens

| Token | Value | Used by |
|---|---|---|
| `--tk-dmg-hot` | `#e06060` | Shockwave, Phase A wash, reduced-motion static rim |
| `--tk-dmg-rest` | `#c06060` | Phase B halo border. Same red as HP-bar critical, death-save fail pip, error text. |
| `--tk-dmg-glow` | `rgba(192,96,96,0.45)` | Halo's outer glow — what survives at tiny sizes |

Wash = edge-weighted radial gradient, **plain alpha, no blend mode** (`multiply`
crushes dark portraits, `screen` blows out light ones):
```css
background: radial-gradient(circle, rgba(224,96,96,0.18) 28%, rgba(224,96,96,0.50) 100%);
```
The existing 1px `rgba(0,0,0,0.4)` outline already separates halo from light
terrain (`vellum`) — no extra branch needed.

## 5. Anatomy (magnified ~4×)

- **Portrait + faction ring + outline** — untouched.
- **Concentration gem / number badge / name label** — untouched; gem's pulse
  yields to halo's breathe.
- **Impact recoil** — whole token compresses `scale(0.92)` then rebounds through
  `1.045`, settles. Compress-then-rebound (inverse of Story 29's drop-bounce
  `1→1.08→1`) so placement and being-hit are never confused.
- **Portrait wash** — edge-weighted red radial, peaks ~15% into the phase.
- **Shockwave ring** — expands from circumference to 165%, fades. Rendered
  **outside the silhouette** — zero portrait occlusion, survives smallest sizes.
- **Wound halo (Phase B)** — 1.5px `--tk-dmg-rest` ring outside the black
  outline + `--tk-dmg-glow` bloom, breathes 0.5↔0.85 over 2.6s. Outset (vs.
  FALLEN's inset), so never confused with it.

Phase A timeline: recoil leads → wash peaks with it → shockwave rides on top
and outlives both → resolves directly **into** Phase B (no separate arrival).

## 6. DOM / layer structure

```
L0  .token-pos            x/y placement · poll-move glide (29b) · drop bounce (29)
    └── .tk-hit           NEW (L1c). transform ONLY (scale()). No translate/rotate/size-mult.
        └── .token-chip   counter-rotated (45) · scaled by --token-size-mult (44). UNTOUCHED.
            ├── portrait fill
            ├── .tk-wash      L1a overlay, inset 0, radius 50%, opacity-animated. Mounted only while playing.
            ├── ring stack (faction ring, black outline)
            │   └── .tk-wound L1b, inset -3px, 1.5px border + glow bloom. Mounted only while wounded.
            ├── badge orbit   ← Story 53's, never touched
            └── .tk-shock     L3 ephemeral burst, inset 0, radius 50%, transform+opacity to 165%. Mounted only while playing.
```

**Non-negotiables:** `pointer-events: none` on wash/wound/shock (shockwave
extends 65% beyond the chip and must not swallow taps). All three conditionally
rendered, never present at opacity 0. No `will-change` at rest. Everything
inside `.token-chip` is radially symmetric and upright for free — no rotation
correction needed or permitted.

## 7. Motion spec

| Event | Duration · easing | Communicates |
|---|---|---|
| Phase A — Heavy (recoil+wash+shockwave) | 450ms total | "that landed hard" |
| Phase A — Standard (recoil+wash, no shockwave) | 300ms total | "took a hit" |
| Recoil (Heavy) `.tk-hit` scale `1→0.92→1.045→1` | 280ms segmented | absorbing force |
| Recoil (Standard) scale `1→0.95→1.02→1` | 240ms | lesser blow |
| Wash opacity `0→1→0`, peak ~15% | 450 / 300ms | moment of contact |
| Shockwave scale `1→1.65`, opacity `0.9→0` | 380ms `cubic-bezier(.16,.84,.28,1)` | force leaving the body |
| Halo appears, opacity `0→0.7` | 200ms ease-out | "still carrying that" |
| Halo resting, opacity `0.5↔0.85` | 2.6s ease-in-out, infinite | ambient |
| Halo clears (turn start / 12s out-of-combat) | 400ms ease-out, unmount | "shaken off" / "old news" |
| AoE batch stagger | 70ms apart, stable order | "one blast, several bodies" |
| Attack tracer present (55) | Phase A start +60ms after crescent | cause then effect |

Keyframes (`tkRecoil`, `tkWash`, `tkShock`, `tkWoundBreathe`, `tkWoundShed`) are
concrete cubic-bezier curves — see git history / architect notes for exact
values if not already ported. **Two refusals:** heals produce zero motion; the
halo's arrival is never separately announced (already at rest when the burst
clears).

**Shockwave thickness:** scaling a 1.5px ring to 165% thickens its stroke
visually (opacity fade masks this — not required to fix; optional
`border-width: 1.5px→0.75px` companion animation if desired).

## 8. Trigger, sync, lifecycle

**Trigger = `hpCurrent` decreased.** Healing/rest/hpMax edits/tempHP changes: no
cue in v1 (tempHP "deflect" beat is OQ-3). A DM's HP-correction via the stepper
will fire a flash too — accepted, documented, not fixed.

**Intensity tiers:**
| Tier | Condition | Treatment |
|---|---|---|
| Standard | damage < 25% of hpMax | recoil+wash, 300ms, no shockwave |
| Heavy | damage ≥25% hpMax, or crosses below 20% HP, or reduces to 0 | full 450ms |

**Data contract** (shape is architecture's call): per-entity `lastDamagedAt`
(server timestamp), `lastDamageAmount`, and reuse of the existing `serverTime`
— all age arithmetic must use `serverTime`, never `Date.now()`.

**Freshness gate (prevents flash storms):** Phase A fires only if
`serverTime − lastDamagedAt ≤ 4000ms` AND newer than last-rendered value for
that token. Otherwise Phase B only, no burst. An impact you didn't watch happen
is history, not an event.

**Mount rule:** never play Phase A on first paint (init "last rendered" from
first payload). **AoE batching:** ≥2 new stamps in one payload stagger 70ms
apart (stable order); beyond 6 tokens, overflow gets wash-only. **Repeat hit
during active Phase A:** restart from frame 0, reset Phase B anchor.

**Phase B lifecycle:** clears on transition *into* the entity's next
initiative turn (not continuously while active) — **recommend server clears
`lastDamagedAt` on turn-advance-into-entity** (client-derived clear can't be
consistent for a viewer who joined mid-combat). Out of combat: fixed **12s**
window against `serverTime`, then the same 400ms fade.

**Cleanup:** no explicit client cleanup state — everything unmounts with the
token. A never-cleared server stamp is harmless past its window; never treat as
an error.

## 9. Interaction model

Almost entirely non-interactive by design — zero taps, no dismiss/undo. Must
not change: Story 34 player drag (pointer-events:none on all overlay elements),
Story 29b long-press/resize, held-token floater (**never flashes**).

**One addition:** hover-expand HP card gains a line while Phase B is active —
`◦ Took 7 — hasn't acted` (needs `lastDamageAmount`, already required above).
Suppressed on FALLEN; shown as `◦ Recently wounded` (no number) when a player
views an NPC whose exact HP is hidden.

## 10. Size degradation ladder

`effective_px = 36 × token.scale × map.tokenScale × mapViewerZoom` (~100× range)

| Effective size | Phase A | Phase B |
|---|---|---|
| ≥30px | Full per tier | Halo 1.5px + glow, breathing |
| 20–30px | Full; shockwave to 175% | Unchanged |
| 12–20px | **All hits play Heavy**; recoil widened to `0.88/1.06` | Breathe widened to `0.45↔0.95` |
| <12px | Shockwave+wash only, recoil dropped | **Halo persists** — last surviving signal |

The `--tk-dmg-glow` bloom (not the hairline border) is what carries at tiny
sizes. Ring treatments (halo, faction ring) scale with the creature, unlike
Story 53's counter-scaled badges.

## 11. Reduced motion

Single authoritative block in `tokens.css` (29b §9.1), replace-don't-delete:

| Motion point | Reduced behaviour |
|---|---|
| Phase A (all 3 elements) | One static rim: `.tk-wound` mounted at opacity 1, `--tk-dmg-hot`, held **900ms**, then settles to resting Phase B appearance |
| Halo breathe | Static at opacity 0.7 — halo stays, it's information |
| Halo appear/clear | Instant |
| AoE stagger | Suppressed, all rims appear at once |

## 12. Edge cases

| Case | Behaviour |
|---|---|
| Healthy token | Nothing — not in DOM |
| Damage on entity with no token | Silent, HP updates elsewhere |
| Token placed while fresh stamp exists | Fades in, shows Phase B only |
| FALLEN takes damage | Phase A fires (death saves), Phase B suppressed |
| Hit causes FALLEN | Phase A (Heavy) plays, then existing 220ms FALLEN transition |
| 2 hits within 450ms | Restarts Phase A from frame 0 |
| AoE 6+ tokens | 70ms stagger; 7+ wash-only |
| Held token (DM placing) takes damage | Floater never flashes; committed token flashes for others |
| Dragged token takes damage | Recoil on `.tk-hit`, drag on L0 — no conflict |
| Map rotated | Radially symmetric, upright for free |
| Mid poll-move glide | Both play — reads as "hit in transit," correct |
| Backgrounded tab returns | Freshness gate → no burst, halos per lifecycle rules |
| Classic sheet Map tab | Feature absent — no token layer there (OQ-6) |
| Invisible NPC (54, not yet built) | Absence wins — no flash/halo/shockwave for that viewer |

## 13. Files likely touched

**Frontend:** `BattleModeController.jsx` (`TokenChip`: `.tk-hit` wrapper,
conditional shock/wash/wound mounting, freshness gate, mount rule, exposed
60ms start-delay param); `tokens.css`/`battleMode.css` (colour tokens,
keyframes, size bands, single reduced-motion block); a shared `tokenEffects`
helper (intensity resolver, freshness gate, AoE stagger, size-band resolver) —
**consumed by both DM and player maps**; `MapPanel.jsx` /
`CharacterSheetSessionMode.jsx` pass `serverTime` + damage fields through;
hover-card gets one conditional line.

**Backend:** damage stamp (`lastDamagedAt`+`lastDamageAmount`) written wherever
`hpCurrent` decreases — `session.js`, `putNpcCombat.js` (every path, or "some
buttons animate"); cleared on turn-advance-into-entity in `initiative.js`;
`getSessionState.js` carries both fields in both variants; add to
`partyProjection.js` whitelists (not secret data).

## 14. Open questions

1. Two intensity tiers vs. one — *recommend two*.
2. 12s out-of-combat window — tune after playtest.
3. Temp-HP-absorbed hits show nothing in v1; optional "deflect" beat deferred
   to v2 unless the stamp is cheap.
4. Hover-card wound line — *recommend include*.
5. Wound halo on DM party cards/initiative rows — out of scope, follow-up story.
6. Classic sheet's Map tab has no token layer — confirm acceptable.
7. Held-token floater never flashes — confirm.
8. AoE stagger 70ms / cap 6 — confirm.
9. Server clears damage stamp on turn-advance — *strongly recommend*.
10. Freshness gate at 4000ms — *recommend*, revisit after one session.
