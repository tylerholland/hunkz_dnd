# Invisible Token Veil — Design Brief

> **Story 54.** Third of the Stories 52–55 token effects cluster.
>
> Cluster brief owns the §4 layer budget, §4.2 size-scaling, §8 composition
> rules, four condition-family colours (§6.4), and `Invisible`'s exclusion from
> the Story 53 badge set — fixed, not reargued. **This brief supersedes its §7**,
> and amends §8 Rule 4 (loop priority) and §11 (reduced-motion vanish).
> Divergences in §17.
>
> Builds on: Story 29, 29b, 31, 34, 44, 45, Story 52 (`.tk-hit` wrapper),
> Story 53 (badge orbit, detail-card block, `data-cond-band` resolver).
>
> **Colour policy:** universal. VEILED adds zero new colours. SECRET adds
> exactly one (`#7c93a8`). The faction ring keeps its palette colour — this
> feature changes its *shape*, never its hue.

---

## 1. Design intent

Every other cluster feature gives the board a voice; this one gives it a
**secret**, and gives the DM a reason to trust it. The DM-facing half must be
loud enough to be believed; the player-facing half must be a *true absence* (no
ghost, no gap, no tell) — otherwise the DM falls back to house rules and the
feature has failed.

> **V1 — The DM's map is a strict superset of every player's map, and `◇` marks
> exactly the difference. No `◇` means they can see it.**

Register: cold and quiet — a veiled token looks like it's *thinning out of the
world* (desaturated, dimmed, broken outline), never damaged or disabled.

Mental model: **the ring is what you are; a broken ring is that you're only
partly here; `◇` is what only I know.**

## 2. Three states and the invariants

| | Player viewer | DM viewer |
|---|---|---|
| **PC invisible** | VEILED | VEILED — byte-identical |
| **NPC invisible** | **ABSENT** | **SECRET** = VEILED + hatch + `◇` |

SECRET is constructed as VEILED plus two additions, never a separate visual
language — one veil, one optional DM annotation.

**Invariants (outrank every pixel here):**
- **V1** — enforced by §8.2: one server-computed flag drives both the omission
  and the `◇`, so they can never drift.
- **V2 — Absence is total.** ABSENT = zero rendering: no chip, name, badge,
  flash, shockwave, tracer endpoint, no DOM node, no hit area.
- **V3 — The veil never costs identity.** Dims/desaturates the **portrait
  layer only**, never `.token-chip`. Rings, badges, gem, label, drag affordance
  keep their own opacity.
- **V4 — Dimmers do not multiply.** Veil (0.55) × FALLEN (0.4) × held (0.88) —
  render at the **lowest single value**, never the product.

## 3. Information hierarchy

1. Portrait — 0.55 opacity / 0.35 grayscale, hatch coverage ~11% (well inside
   the ≤20% occlusion budget).
2. **Dashed faction ring** — the primary signal; a broken outline reads on any
   palette/terrain/colour-blindness with no legend or new colour.
3. `◇` marker (SECRET, 12 o'clock) — categorically distinct by construction,
   not just position.
4. Hatch scrim (SECRET) — the size-robust DM channel, below `◇` in prominence.
5. Story 53's condition badges — full opacity over the dimmed portrait.
6. Name label, italic @0.6.
7. Detail card's `◇ INVISIBLE` row — the authoritative record.

**Resolved competitions:** `◇` vs. concentration gem separated on 4 channels
(position, shape, construction, colour space) since invisible+concentrating is
the single most common co-occurrence (Invisibility is a concentration spell).
**Loop priority amended:** concentration pulse now outranks veil shimmer
(§7.4) — the pulse marks a breakable state, the shimmer is purely decorative.
Dashed ring vs. Story 52's wound halo coexist unambiguously (only the faction
ring dashes).

## 4. Colour tokens

| Token | Value | Used by |
|---|---|---|
| `--tk-veil-desat` | `0.35` | portrait grayscale |
| `--tk-veil-dim` | `0.55` | portrait opacity |
| `--tk-veil-sheen` | `rgba(255,255,255,0.13)` | shimmer peak |
| `--tk-dm-secret` | `#7c93a8` | `◇` fill, SECRET card row |
| `--tk-dm-secret-scrim` | `rgba(124,147,168,0.22)` | hatch scrim |
| `--tk-glyph-outline` | `rgba(0,0,0,0.55)` | 0.75px `◇` outline |

**`#7c93a8` is a system-level commitment** (flagged OQ-1): a cold desaturated
blue-grey adjacent to the DM dashboard's Ocean accent — "**this colour means
information only the DM can see**," reusable for hidden initiative entries,
DM-only pins. **Reciprocal rule: must never appear on a player-visible
surface** — the VEILED card row uses neutral `#c8c0b4` instead.

## 5. Anatomy

- **Resting** — untouched, adds nothing to a visible creature.
- **Dashed ring** — same colour/width, **16 evenly distributed dashes** (~57%
  duty cycle), specified as a *count* (closes seamlessly at any radius, dash
  length scales with the creature).
- **Portrait desat+dim** — grayscale(0.35)+opacity(0.55), portrait layer only.
  Most size-robust channel in the feature — legible at 6px.
- **Black outline stays solid** — load-bearing; exposes a "stitched" edge
  through the dash gaps, guarantees contrast on light terrain.
- **Name label** — opacity 0.6 + italic (app's existing "not literal" convention).
- **Shimmer** — low-opacity sheen sweeping the portrait, 3.2s cycle, per-token
  phase offset. Lowest-priority loop, first to yield; never load-bearing.
- **`◇` (SECRET only)** — 12 o'clock, 9px, bare filled rhombus, `#7c93a8` +
  0.75px dark outline. **Deliberately not a plated badge** — construction
  difference is stronger than position/colour difference alone. Counter-scaled
  like every L2 mark.
- **Hatch scrim (SECRET only)** — 45°, ~3px pitch (counter-scaled), clipped to
  the circle. Classic cartographic "special-cased" mark.

### The money diagram
On the DM's map, an invisible NPC shows hatched+dashed+`◇`. On the player's
map at the same instant: **nothing** — no ghost, no dim disc, no gap, no hit
area. A veiled PC looks identical on both maps, with no `◇` (which would
falsely claim "your players can't see this"). The DM's footer token count
includes the SECRET token; **no player-facing UI may ever report a count that
includes omitted tokens.**

### The vanish (player's map, NPC goes invisible)
Must not pop — a hard cut reads as "it's still there and something's hiding
it," a graceful exit reads as "it left." 500ms: opacity 1→0, translateY
0→−8%, scale 1→0.94.

### Detail card
Slots in as the **first row** of Story 53's condition block (above every
condition — being barely present outranks being poisoned). VEILED row: `◇
INVISIBLE`, `#c8c0b4`, visible to **every** viewer. SECRET row: same row in
`#7c93a8` + DM-only second line `◦ UNSEEN BY PLAYERS`. Card width stays 124px
(shorten text before widening the card).

## 6. DOM / layer structure

Owns portrait fill (L1a), ring *style* (L1b), one L2 slot (12 o'clock), and
borrows Story 52's `.tk-hit` wrapper for the vanish only.

```
L0  .token-pos
    └── .tk-hit          (Story 52's wrapper) ← tkTokenExit runs HERE
        └── .token-chip  counter-rotated · scaled. data-veil="1" / data-veil-secret="1"
            ├── .token-portrait   filter: grayscale(); opacity.
            │   ├── .tk-veil-sheen    conditional, clipped sheen band
            │   └── .tk-veil-hatch    conditional, SECRET only, repeating-linear-gradient 45°
            ├── ring stack
            │   ├── faction ring      border-color → transparent when veiled
            │   ├── .tk-veil-ring     conditional, SVG <circle>, animated stroke-dasharray
            │   ├── black outline     UNCHANGED, stays solid — load-bearing
            │   └── .tk-wound (52)    UNCHANGED
            └── L2 badge orbit
                ├── .tk-secret-mark   NEW, 12 o'clock, SECRET only, 9px ◇
                └── Story 53 column, gem, number badge, name label — UNTOUCHED
```

**Non-negotiables:** `pointer-events: none` on all four new elements. All
conditionally rendered, never present at opacity 0. Veil dims the *portrait
element*, never `.token-chip` (V3). No CSS `rotate` property anywhere.
`overflow: visible` required on ancestors (`◇` extends ~7px above the chip box).

**Coordination with Story 52:** the vanish reuses `.tk-hit` rather than adding
a 4th wrapper. The exit cancels any in-flight recoil. If Story 54 ships first,
it introduces `.tk-hit` with the same contract.

**Compositing (V4, dimmers don't multiply):** implement as ordered CSS rules
keyed on data attributes, never nested opacity containers (which multiply by
definition). VEILED+FALLEN → FALLEN's own values (0.4/0.6, the more severe
single treatment). VEILED+held → veil's 0.55 (the lower value vs. held's
0.88). Per cluster rule, **FALLEN keeps the veil** — dashed ring/hatch/`◇`
persist while badges collapse to one summary.

## 7. Motion spec

| Event | Motion | Duration |
|---|---|---|
| Veil applied | grayscale 0→0.35, opacity 1→0.55, ring dash opens from solid | 320ms `cubic-bezier(.4,0,.2,1)` |
| Veil removed | exact reverse, dash closes to solid | 240ms ease-out — faster than arrival |
| Hatch appear/clear | opacity 0↔1, rides the veil | 320/240ms matched |
| `◇` appears | scale 0.7→1 + opacity 0→1 | 180ms ease-out `(.2,.8,.2,1)` — same curve as a Story 53 badge entrance |
| `◇` clears | scale 1→0.8 + opacity→0 | 140ms ease-in |
| Shimmer | sheen sweep, per-token phase offset | 3.2s linear infinite |
| NPC vanishes (player view) | `.tk-hit` opacity 1→0, translateY 0→−8%, scale→0.94 | 500ms ease-in `(.32,0,.67,0)` |
| NPC reappears (player view) | **existing Story 29 appear animation, unchanged** — no bespoke version | as Story 29 |
| Map rotates | nothing — inside counter-rotated chip | 0ms |

Ring dash `stroke-dasharray`: starts "113.1 0.01" (visually solid, matches the
CSS border it replaces) → "4.04 3.03" (16 dashes). Asymmetric transition
durations (apply 320ms, remove 240ms) come from CSS reading the *target*
state's rule — no JS needed. `translateY(-8%)` (not the cluster's −4%, which
is sub-pixel at nominal size).

**Two refusals:** no announce-flash for the veil (it's a standing fact, not an
interrupt); **reappearance gets no bespoke animation** — deliberately, so a
returning NPC is indistinguishable from a newly-placed one (the exact
inference the feature exists to deny).

**Loop budget (amended cluster §8 Rule 4):** wound halo (52) > concentration
pulse (29) > veil shimmer (54). Lower-priority loops render as their static end
state. Per-token phase offset derived deterministically from token id (never
random per mount).

**Hatch pitch counter-scaled** against `--token-size-mult` (same fix as Story
53's badge sizing) so it stays a texture, not moiré, at any creature scale.

## 8. The visibility contract

**Trigger:** `conditions` contains `Invisible` (normalised match, trim +
case-insensitive — OQ-8). No duration, no timer, no cleanup state.

> **The server computes one boolean per token, `invisible`, emitted in both DM
> and public variants. The public variant additionally omits every `type:
> "npc"` token whose flag is true.**

The DM client must **not** re-derive invisibility independently — if the `◇`
and the omission are computed separately they can drift, and V1 becomes false.
The flag also drives the PC veil (works even when `partyVisibilityEnabled:
false` strips all condition data from the player payload) — a narrower,
safer payload than carrying raw `conditions` on the token.

**Omission must be server-side on every unauthenticated path** — including
**`GET /maps` (`getMapLibrary.js`), which has no auth today** and is the leak
a `getSessionState`-only fix would miss. Also any write-echo path.

**Fail-open:** if a token's subject can't be resolved, it renders (not
invisible). Fail-closed would hide a token from players while the DM's map
shows it with no `◇` — silently breaking V1. Document it; don't "harden" it.

**Exit animation carries no metadata about cause** — went invisible, removed
by DM, bulk-cleared all look identical (one 500ms fade-drift), closing a leak
where a differentiated exit would tell players "it's still there."

Rules: diff-driven (present→absent, same mapId); **bulk cap — instant above
3** vanishing at once (a bulk op, not a stealth event); map switch always
instant; never on first paint; ghosts inert (`pointer-events:none`, excluded
from hit-testing/counts); **return-during-exit cancels** and snaps back with no
re-appear animation; a returning token mounts fresh (no inherited poll-move
glide from old coordinates — the positional discontinuity *is* the mechanic).

**Accepted leak (OQ-5):** number-badge gaps let players infer a hidden
creature exists (existence, not position — the only thing 5e invisibility
conceals). DM's escape hatch: hide the initiative entry.

## 9. Interaction model

Non-interactive by design. Must not change: Story 34 drag (full-strength
affordance ring even when veiled — the veil dims portrait only), Story 29b
long-press/sweep (sweep stays solid, drawn above the dashed ring — an
interaction affordance never inherits a state treatment), Story 44 resize, hit
area (unchanged size/shape). `HeldTokenFloater` **does** carry the veil (DM
must know what they're placing) with full SECRET treatment.

**No toggle from the map** — conditions managed on existing surfaces;
recommend deferring to Story 53's proposed `Conditions ▸` submenu (OQ-7). **No
preview-player-view mode** — the `◇` is the cheaper answer to the same need.

**Tray chip (unplaced):** dashed ring only, no hatch/`◇` (meaningless for a
token not on the board — OQ-6).

## 10. Size degradation ladder

Reuses Story 53's `data-cond-band` resolver (80ms debounce, 2px hysteresis) —
**do not compute a second band.**

| effective_px | VEILED | SECRET adds |
|---|---|---|
| ≥30px | desat+dim, 16-dash ring, shimmer, italic label | hatch, `◇` 9px |
| 20–30px | unchanged (everyday mobile case) | unchanged |
| 14–20px | **shimmer suppressed** | unchanged |
| 10–14px | dash count drops 16→8 | **`◇` persists** — one-band exception to cluster §8 Rule 5 |
| <10px | desat+dim carry the state alone | **hatch is the only channel**, still legible |

Desaturation is the most size-robust signal in the cluster — legible at 6px,
where the halo and every badge are long gone.

## 11. Reduced motion

Single authoritative block, replace-don't-delete:

| Motion point | Reduced behaviour |
|---|---|
| Veil apply/remove | Instant — desaturation/dim/dashed ring persist |
| Ring dissolve | Instant at final pattern |
| Shimmer | Suppressed entirely — fully carried by desat+ring |
| Hatch/`◇` appear/clear | Instant |
| **NPC vanish** | **200ms opacity-only fade** (divergence from cluster's "instant") — a cross-fade isn't a vestibular trigger, and "it left" is meaning, not decoration |
| NPC reappear | Whatever Story 29's appear does under reduced motion |

## 12. Edge cases

**A player's map with an invisible NPC on it looks exactly like a player's map
with no such NPC — that is the deliverable, not a missing state.**

| Case | Behaviour |
|---|---|
| Invisible PC, DM viewer | VEILED, no `◇` (OQ-2) |
| Invisible NPC + damage, player view | Nothing — absence wins, RAW-consistent |
| Invisible NPC + damage, DM view | Full Story 52 flash over the hatched veil |
| Attack tracer with ABSENT endpoint (55) | No tracer at all, not a half-tracer |
| Invisible + poisoned (PC) | Veil + badges both render, badges full opacity |
| Invisible + concentrating | Common case — gem full opacity pulsing, shimmer yields |
| Invisible + FALLEN | Veil kept; portrait at FALLEN's values, not multiplied; badges collapse to 1 summary; `◇`/hatch persist |
| `partyVisibilityEnabled: false` | **Ally veil still renders** (token-level flag); Story 53 badges hide |
| Condition unresolvable (orphaned entry) | Fail-open: renders for players, no `◇` for DM |
| Mid poll-move glide / mid Phase A | Independent — no interference |
| NPC goes invisible mid Phase A, player view | Exit runs on `.tk-hit`, cancels the recoil |
| "Clear NPCs from Map" with 5 invisible | Already absent for players; bulk cap (>3) → instant |
| Classic sheet Map tab | No token layer, but the `GET /maps` omission requirement still applies |
| `vellum` palette | No light-mode branch needed — outline/hatch-on-portrait/`◇` outline already handle it |

## 13. Mobile vs. desktop

Everyday mobile band: 20–30px dropping into 14–20px → **dashed ring + desat +
dim, no shimmer is the canonical mobile veil.** Long-press 280ms means
token-level signals (dash count degrading 16→8 rather than vanishing) carry
more load than the card. Desktop: shimmer is actually seen, hover is cheap.

## 14. Accessibility

Primary channel is **shape** (broken outline) — works in full monochrome.
Secondary channel is **saturation**, not hue — correct for all colour
blindness including achromatopsia. Tertiary: italic label. `#7c93a8` never
carries meaning alone (always paired with `◇`'s distinct shape/position and
the hatch's distinct texture). No screen-reader announcement — the ABSENT rule
holds in the accessibility tree too (node doesn't exist). Shimmer is the only
long-lived loop, `transform`+`opacity` only, first to yield, suppressed below
20px.

## 15. Files likely touched

**Frontend:** `BattleModeController.jsx` (`TokenChip`: `data-veil`/
`data-veil-secret`, `.tk-veil-ring`/`-hatch`/`-sheen`, `.tk-secret-mark`,
DM-vs-player branch, shimmer phase offset, `HeldTokenFloater` veil); tokens.css
(colour tokens, keyframes, hatch counter-scale, size bands, single
reduced-motion block); shared `tokenEffects` module (normalised `Invisible`
matcher, three-state resolver, amended loop-priority, shimmer phase hash); a
**token-exit registry** (diff-based, 500ms ghosts, >3 bulk cap, return-cancel) —
shared by both maps; `MapPanel.jsx`/`PlayerMapViewer` pass the `invisible` flag
through (**must not filter client-side** — second source of truth for a
security rule); detail card gets the `◇ INVISIBLE` row; tray chip gets dashed
ring only.

**Backend:** per-token `invisible` flag computed once in the map projection,
emitted in both `getSessionState.js` variants. **Server-side omission in the
public variant AND in `getMapLibrary.js` (unauthenticated `GET /maps` today) —
the second is the easy miss.** Flag is derived, never stored — `patchMapTokens`/
`moveMapToken` must not accept/round-trip an `invisible` field from a client.

## 16. Open questions

1. `#7c93a8` as the app-wide "DM-only knowledge" colour — *recommend confirm*
   (reciprocal rule keeps it safe).
2. Veiled PC gets no `◇` on the DM's map — *recommend confirm*.
3. One exit animation for every disappearance (touches Story 29 too) —
   *recommend confirm*.
4. Shimmer: keep or cut — *recommend keep*, but cheapest thing here to delete.
5. Existence leak via number badges — accepted, confirm acceptable.
6. Tray chips: dashed ring, no hatch/`◇` — *recommend as specified*.
7. Toggling Invisible from the map — deliberately deferred to a follow-up story.
8. Condition-string matching needs a shared canonical table (Story 53 needs
   the same thing) — confirm one shared table, not two.
9. `◇` persists one band lower than badges (hides below 10px, not 12px) —
   *recommend confirm*.
10. Explicitly rejected: hiding an invisible PC from other players — would
    need a real stealth system, not a display rule.

## 17. Divergences from cluster brief §7 (and §8 Rule 4, §11)

| # | Topic | This brief | Why |
|---|---|---|---|
| 1 | `◇` construction | Bare filled rhombus, no plate/ring | Categorically distinct from a badge; filled survives downscaling |
| 2 | Multiple dimmers | V4 — lowest single value, never multiplied | Multiplying gives an unreadable 0.22 |
| 3 | Dim scope | Portrait layer only, never `.token-chip` | Protects Story 53's badge opacity and Story 34's drag affordance |
| 4 | Loop priority | wound halo > concentration pulse > shimmer | Invisible+concentrating is the common case |
| 5 | Reappearance | Reuses Story 29's appear animation, no bespoke variant | Information hygiene — must not confirm "this is the one that vanished" |
| 6 | Vanish drift | −8% not −4% | 4% is sub-pixel at nominal size |
| 7 | Reduced-motion vanish | 200ms fade, not instant | A fade isn't a vestibular trigger; "it left" is meaning |
| 8 | Detail-card row | On every viewer (not DM-only), first row of the condition block | Needs a legend somewhere; plugs the hole where Invisible had no authoritative text |
| 9 | Dash pattern | 16-dash count, not fixed pixel pitch | Closes seamlessly at any radius |
| 10 | `◇` ladder floor | Persists to 10px vs. badges' 12px | Tier 1 for the DM must outlive Tier 2 |
| 11 | Data contract | One boolean flag, not raw `conditions`; omission also applies to `GET /maps` | Narrower payload, closes a leak the cluster brief didn't name |
| 12 | Hatch pitch | Counter-scaled | Otherwise moiré on small tokens |
| 13 | Exit ownership | Reuses Story 52's `.tk-hit` | No 4th wrapper needed |
| 14 | Exit scope | One exit for every disappearance type | Removes a metadata leak |

Everything else (layer budget, counter-scale, family colours, priority order,
`Invisible` exclusion, "absence always wins", degradation thresholds, FALLEN
keeping the veil) is adopted unchanged.
