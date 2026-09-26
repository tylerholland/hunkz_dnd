# Persistent Map in Session View — Design Brief

> **Story 60.** Take the battle map out of the session-mode sub-tab rotation and give it a
> permanent, always-on-screen home. Produced by design-strategist as the implementation spec.
>
> This is a layout brief, not an additive one — it moves a large existing surface and changes
> the shape of the page around it. The load-bearing sections are §3 (placement, resolved),
> §9 (the size ladder — the mobile answer is what forces the desktop answer), and §10.3
> (targeting precision, the one real constraint Story 57 imposes on how small this can get).
>
> **Prototype: YES — one, tightly scoped. See §14.**

---

## 1. Tier

**Tier 1 while `mapLibrary.combatMode` is true; Tier 2 otherwise.** That mode-dependence *is*
the design — it is the entire reason the band's default open/closed state is mode-aware (§7)
rather than unconditional. A map during a fight is combat-critical; a map during a tavern
scene is scenery.

## 2. Design intent

The board stops being a place you go and becomes a window you're sitting at — always in the
corner of your eye, never in the way of what you're reading. Where you are on the map is a
fact about you, like your HP; it should not require a navigation decision.

---

## 3. Placement — RESOLVED: a sticky band at the top of the right column

**Decision: the map becomes `.cs-sm-map-band` — a three-state (collapsed / docked / full)
panel pinned with `position: sticky` to the top of the right column on desktop, and to the
top of the page on mobile. It is removed from the sub-tab strip, which goes 4 → 3.**

Everything else in both columns keeps its exact position and order. The left column is not
touched at all.

**Why the right column and not full-width above both columns.** The left column is
`position: sticky; top: 48px; height: calc(100vh - 48px)`. A full-width band above the grid
forces both of those values to become functions of the band's current height — so every
collapse/expand reflows the initiative and party strips, the two things a player is watching
during someone else's turn. Right-column placement leaves the left column byte-for-byte
unchanged. That alone decides it. *(Also rejected: full-width gives the map a ~1400×380
letterbox on a wide monitor — worse aspect ratio for a tactical map than the narrower,
taller right column produces.)*

**Why sticky and not "just put the map panel above the tabs."** Un-sticky, the map sits at
scroll offset ~0 and is gone the moment you scroll to your spell slots — which is the exact
failure this story exists to fix, reproduced one screen lower. Sticky is not an enhancement
here; it is the feature.

**Why not a third column** (rejected): three columns collapse to unusable widths between
900–1200px, and the map column would be the one that has to give.

**Why not inside the left column** (rejected): 340px wide, already holding four sections, and
its spare vertical space is variable (a 9-entry initiative plus a 5-member party consumes all
of it). A map that sometimes has room is not a persistent map.

**Mobile side-by-side is categorically dead** — the story flags this as open; it isn't. At
390px wide, a side-by-side split gives the map ~190px, at which a 36px base token renders
around 7px. Stacked-sticky is the only viable model below 900px, and because that's forced,
the same mechanism is used above 900px too: one idea, one implementation, two sizes.

**Scope answer — player-side only, with one optional DM one-liner (OQ-2).** The DM's
`MapPanel` is *already* persistent and non-tab-gated (top of the party column, collapsible,
drag-resizable, height persisted as `dnd_dm_map_height`). The complaint that generated this
story — "board awareness costs a navigation decision" — is not true of the DM's surface, so
it does not need this redesign. **Do not remove the DM's collapse toggle**: the party column
is the densest surface in the app and reclaiming 300–700px during a non-combat scene is a
real need. The only DM-side change worth making is a default: expand `MapPanel` by default
when `combatMode` is true. One line, optional, not bundled — see OQ-2.

---

## 4. Information hierarchy + layout

Ranked within the band: **the map surface itself** → the collapse/expand controls → the map
name → the `⚔` battle-mode marker. The rail exists to be ignored.

Ranked on the page after this story: the band is now the first thing in the right column, but
it is deliberately *quiet* (no pulse, no glow — §5) so the HP hero card immediately beneath it
keeps its Tier-1 read.

```
.cs-session-right
  .cs-sm-map-band[data-state=collapsed|docked|full][data-combat=true|false]
    .cs-sm-map-rail                          — 44px, opaque --pal-surface-solid, sticky anchor
      .cs-sm-map-rail-glyph   ▦              — 13px, --pal-accent
      .cs-sm-map-rail-name    "Goblin Warren"— 13px --font-ui, --pal-text, ellipsis
      .cs-sm-map-rail-combat  ⚔              — 11px --pal-accent-bright; only [data-combat=true]
      .cs-sm-map-rail-spacer                 — flex: 1
      button.cs-sm-map-full   ⤢ / ⤡          — 44px; absent in collapsed
      button.cs-sm-map-toggle ⌄ / ⌃          — 44px
    .cs-sm-map-surface                       — height: var(--map-band-h)
      PlayerMapViewer                        — MapViewer + token layer + TracerLayer
                                               + ConditionGlyphSprite, ALL UNCHANGED
  .cs-sm-map-band-spacer                     — in-flow placeholder, only in [data-state=full]
  (concentration banner · HP hero · conditions · spell slots · spells row
   · inspiration · tab strip · tab panel — ALL UNCHANGED, order UNCHANGED)

.cs-sm-tabs                                  — 3 buttons: combat | loadout | notes
```

**Nothing is added below the band.** The 44px rail is paid for by the map tab button this
story deletes from the strip; the three remaining tabs get wider targets for free.

**`.cs-sm-map-surface` is never unmounted.** Collapse is `height: 0; visibility: hidden;
overflow: hidden` — not a conditional render. Unmounting would reset Story 52's
mount/freshness gate on every expand and replay stale impacts.

## 5. Colour tokens

| Token | Role |
|---|---|
| `--pal-surface-solid` | rail background — **must be opaque**, it sticks over scrolling content |
| `--pal-border` | rail bottom hairline; band bottom hairline in docked/full |
| `--pal-bg` | letterbox behind the map image (existing `MapViewer` behaviour, unchanged) |
| `--pal-text-muted` | `▦` glyph at rest; map name when collapsed |
| `--pal-text` | map name when docked/full |
| `--pal-accent` | chevron / `⤢` resting stroke |
| `--pal-accent-bright` | chevron / `⤢` hover+active; `⚔` marker; the auto-promote rail brighten |
| `--pal-accent-dim` | rail background **only when `[data-state=collapsed][data-combat=true]`** — the one ambient signal in this band: "the board is live behind the fold" |

**No new tokens, universal or palette. No glow, no pulse, anywhere in this band, in any
state** — Story 63 established that the right column's ambient channel is already fully
spent by the concentration pulse and HP-critical red, both Tier 1. A pulsing map rail would
compete with both. The `--pal-accent-dim` rail wash is a *static* state, not an animation.

## 6. Motion & animation spec

```
Band arrives:
  Trigger: activeMapId goes null → set (DM loads a map), or session mode mounts with one
  Animation: height 0→rail+docked, opacity 0→1
  Duration: 260ms, cubic-bezier(0.2, 0.8, 0.2, 1)
  Communicates: "the board just arrived" — a real event, worth an entrance
```
```
Band departs:
  Trigger: activeMapId goes set → null (DM clears the map)
  Animation: height → 0, opacity 1→0
  Duration: 180ms, cubic-bezier(0.4, 0, 0.6, 1)
  Communicates: "there is no board now" — then the band is absent, not empty (§10.1)
```
```
Collapse (docked → collapsed):
  Trigger: tap chevron
  Animation: --map-band-h → 0 with overflow hidden; chevron rotates 180°
  Duration: 200ms, cubic-bezier(0.4, 0, 0.6, 1) — closing curve, decelerate-out
  Communicates: "folded away, still here" — the rail persisting is the "still here"
```
```
Expand (collapsed → docked):
  Trigger: tap chevron, or auto-promote (below)
  Animation: --map-band-h 0 → docked; chevron rotates back
  Duration: 220ms, cubic-bezier(0.2, 0.8, 0.2, 1) — opening curve, overshoot-free settle
  Communicates: "unfolded" — deliberately the asymmetric partner of the collapse curve
```
```
Docked → full:
  Trigger: tap ⤢
  Animation: band switches to position:fixed, inset: <topbar> 0 0 0, z-index 140;
             .cs-sm-map-band-spacer holds the docked height in flow so NOTHING beneath
             reflows; height/inset animate over 240ms cubic-bezier(0.2,0.8,0.2,1)
  Communicates: "the whole screen is the board now"
  Non-negotiable: must NOT be implemented as a taller sticky — that reflows the entire
             right column twice per toggle
```
```
Full → docked:
  Trigger: tap ⤡, or Escape
  Duration: 200ms, cubic-bezier(0.4, 0, 0.6, 1)
```
```
Auto-promote on your turn:
  Trigger: initiative activeTurnIndex transitions INTO this player's own entry, while
           the band is collapsed and combatMode is true
  Animation: rail background brightens --pal-accent-dim → --pal-accent-bright @ 0.18
             over 120ms, THEN the standard 220ms expand runs
  Communicates: causality — the brighten-then-move sequence says "your turn caused this,"
             where a bare expand would read as a stray tap
  Suppression: fires at most once per turn; if the player manually re-collapses during
             their own turn, it does not fire again until the next turn they own
```
```
Map switched by the DM (activeMapId changes, band already visible):
  Animation: .cs-sm-map-surface crossfades 160ms ease-out; the band frame does not move
  Communicates: "different board, same window" — a hard swap reads as a rendering glitch
```

## 7. Reduced-motion table

| Animation | `prefers-reduced-motion: reduce` |
|---|---|
| Band arrives | Instant at full docked height |
| Band departs | Instant removal |
| Collapse / Expand | Instant height swap; chevron glyph swaps with no rotation |
| Docked → full / full → docked | Instant; the fixed-position switch and spacer are unchanged |
| Auto-promote | Instant expand, but the rail brighten **holds statically for 400ms** — the causality cue is information, not decoration |
| Map crossfade | Instant swap |

## 8. Interaction model

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| Chevron `⌄`/`⌃` | Tap (44px) | Band collapses / expands | writes `dnd_session_map_${slug}` | Tap again |
| `⤢` / `⤡` | Tap (44px) | Docked ↔ full | **not persisted** (§9 data) | Tap again, or Escape |
| Rail (name area) | Tap | **Nothing** — deliberately inert | — | — |
| Escape key | Press | Full → docked only; no effect in docked/collapsed | — | — |
| Map surface | pan / pinch / wheel | Unchanged `MapViewer` behaviour | — | — |
| NPC token | tap / hold | **Unchanged Story 57 behaviour**, now available from every sub-tab | — | — |
| Own token | drag | **Unchanged Story 34 behaviour** | `moveMapToken` | — |

No hold, no swipe, no drag on any band chrome. The rail is deliberately not tappable as a
whole — a 44px strip that toggles on any touch will get toggled by every mis-aimed thumb
during a scroll.

## 9. Data contracts and sync/freshness

**Zero data-model change.** The band reads what `getSessionState` already returns:
`mapLibrary.activeMapId`, `.combatMode`, `.maps[].tokens[]`, `.activeMapView.cx/cy`. No new
endpoint, no new field, no new poll target, no write path of its own.

**New sessionStorage key: `dnd_session_map_${slug}` → `"collapsed" | "docked"`.**
- `"full"` is **never persisted** — a maximised map restored on reload is a lie about intent,
  and restoring is one tap.
- **Absent → mode-aware default** (Counter Wheels' `dnd_wheels_open` rule verbatim):
  `combatMode ? "docked" : "collapsed"`.
- **Present → last manual toggle wins**, with one override: on a `combatMode` **false → true**
  transition the band promotes to `"docked"` and rewrites the key. Combat starting outranks a
  stale preference from an hour ago.
- **Viewport-height override:** below `500px` of viewport height (landscape phone), the
  default is `"collapsed"` regardless of mode, and the docked floor drops to 160px (§10.8).

**Migration, load-bearing:** `dnd_session_subtab_${slug}` can hold `"map"` from an earlier
session. Coerce `"map"` → `"combat"` on read. Without this, returning players land on a tab
that no longer exists and see an empty panel.

**Freshness:** unchanged 1s / 30s + WS-nudge cadence. One positive consequence worth stating:
the map surface is now mounted for the whole session instead of only while its tab was open,
so Story 52's mount/freshness gate fires **once per session-mode mount** rather than once per
tab open — strictly fewer legitimately-missed impacts and tracers. Effects that fire while
the band is collapsed are missed (the surface is `visibility: hidden`); **no "something
happened" cue is added to the rail** — considered and rejected as exactly the additive
clutter this app's sparse-first principle forbids, and made near-moot by the mode-aware
default plus auto-promote.

## 10. Size-degradation ladder

| Step | Layout |
|---|---|
| **≥1200px** | Band sticky at top of `.cs-session-right`, `top: <same offset as .cs-session-left>`, `z-index: 100`. `--map-band-h: clamp(300px, 42vh, 520px)`. Rail: `▦` + `MAP ·` + name + `⚔` + `⤢` + chevron. |
| **900–1199px** | Identical; band narrows with the column. Rail drops the `MAP ·` label, keeps the name. |
| **560–899px** | Single column. Band moves to the **top of the page**, sticky beneath the topbar, above the identity strip. `--map-band-h: clamp(200px, 34vh, 320px)`. Full-bleed to the shell's side padding. |
| **<560px** | Same. Rail name truncates at 14ch. `⤢` and chevron stay 44px and never collapse. |
| **<380px** | 200px height floor holds; nothing else changes. |
| **viewport height <500px** | Default collapsed; docked floor 160px (§9). |

**Sticky `top` must be read from the same source `.cs-session-left` uses, not hardcoded.**
The docs disagree with themselves — design-system.md says TopNav is 52px, `characterSheet.css`
says `.cs-session-left { top: 48px }`, and below 560px `.cs-mobile-mode-row` adds a second
sticky row beneath the bar. One variable, three consumers. See OQ-6.

## 11. Key edge cases

1. **No active map → the band does not render at all.** Not a rail, not a message. This is a
   deliberate deviation from the story's "preserve the existing empty-state messaging" line:
   that message belonged in a panel the player *chose* to open, and a permanent
   "The DM hasn't loaded a map yet" strip is precisely the plaintive empty state this app's
   principles forbid. The arrival animation (§6) does the announcing instead. **OQ-4.**
2. **Map active, battle mode off** → band renders, defaults collapsed, rail shows name, no
   `⚔`, no accent-dim wash. Token layer absent exactly as today.
3. **DM clears the map while the band is in `full`** → restore to docked (200ms) *then* depart
   (180ms). Never a hard unmount from a full-viewport surface.
4. **DM switches maps mid-session** → 160ms surface crossfade; pan/zoom re-initialises to the
   DM's centre via Story 47a's `activeMapView.cx/cy`; the band's collapsed/docked/full state
   is preserved across the switch.
5. **Story 57 declaration live and the player collapses the band** → allowed. The reticle is
   hidden, the Attack Bar still carries the target name — this is Story 57 §10 case 8, which
   after this story is the *only* way that case can arise (it was written for sub-tab
   switches, which no longer hide the map).
6. **Mobile thumb-scroll landing on the map** → pans the map instead of scrolling the page.
   Same as today inside the map sub-tab, but now reachable more often. Mitigation is the rail:
   it is a 44px non-map strip at the top of the band and the content column below is the
   scroll target. Accepted, not solved.
7. **Player's token not placed on the map** → unchanged, band still shows.
8. **Landscape phone (390px tall)** → 34vh = 133px, below the floor. This is why the
   viewport-height override in §9 exists; without it the band plus rail plus topbar plus
   Attack Bar consumes 76% of the screen.
9. **Vellum (light palette)** → rail uses `--pal-surface-solid`; no hardcoded darks anywhere
   in this band.

### 10.3 · The one real constraint: targeting precision (Story 57)

A 36px base token at `tokenScale: 1.0`, on a 1000px-tall map fitted into a 270px-tall band,
renders at roughly **10px on screen**. That is far below a reliable hold-to-target. So:

**The docked band is a situational-awareness surface, not a targeting surface, and the design
must not pretend otherwise.** Three things resolve this, in order:

1. `⤢` **full state exists specifically for this.** It is the direct replacement for the map
   sub-tab's former full-panel size — without it, this story is a net *reduction* in usable
   map area and Story 57's whole gesture gets worse. `⤢` is not a nice-to-have.
2. **Pinch-zoom already works** at any band size and is unchanged.
3. **Auto-promote on your turn** (§6) guarantees the band is at least docked at the moment
   targeting becomes relevant, so the player is never one *hidden* step away from the board.

**Explicitly not specced:** any auto-zoom, auto-full-screen on turn start, or minimum-token-
size enforcement. Hijacking the whole screen at turn start is more aggressive than the
problem warrants, and a size-threshold rule that silently changes gesture availability is
worse than a small map.

## 12. Files touched

- `src/features/characterSheet/SessionMapBand.jsx` — **new**; band shell, rail, three-state
  machine, sessionStorage. Extracted rather than inlined because `CharacterSheetSessionMode.jsx`
  is already large.
- `src/features/characterSheet/CharacterSheetSessionMode.jsx` — mounts the band above the
  right column's existing content; removes `map` from the sub-tab strip and panels; subtab
  migration; passes `activeMap` / `combatMode` / own-turn signal into the band.
- `src/features/characterSheet/characterSheet.css` — `.cs-sm-map-*`, sticky rules, the fixed
  `full` state + spacer, the size ladder, new keyframes; 3-tab strip widths.
- `src/features/maps/MapViewer.jsx` — **verify, likely no change**. It fits-to-container on
  mount; it must not break when the container height *animates*. This is the single most
  likely implementation surprise in the story — see OQ-5.
- `design/app-overview.md`, `design/design-system.md` — feature-builder updates.

**Not touched:** `AttackDeclarationBar.jsx`, `BattleModeController.jsx`, `TokenChip`,
`tokenEffects.js`, `TracerLayer.jsx`, the left column, and every backend file.

## 13. Open questions

- **OQ-1 — auto-promote on your turn.** Recommended: keep. It is the most direct answer to
  the story's third user story ("passive glanceable awareness without a dedicated tap"). It is
  also the cheapest single thing to cut for a minimum diff.
- **OQ-2 — the DM `MapPanel` one-liner.** Recommended: adopt (default expanded when
  `combatMode` is true, mode-aware, last manual toggle still wins). **Explicitly rejecting**
  removal of the DM's collapse toggle or any further DM-side redesign — the DM's map is
  already persistent and already resizable; the story's complaint doesn't apply to it.
- **OQ-3 — drag-to-resize the band** (adopting the DM's `dnd_dm_map_height` pattern).
  Recommended: **not in v1**. Three named states cover the real postures; a drag handle on a
  player's phone is gesture cost for a preference most players will set once.
- **OQ-4 — no-active-map behaviour.** Recommended: band absent entirely (§11.1). This
  contradicts the story's literal wording, so it needs a yes/no.
- **OQ-5 — `MapViewer` under an animating container height.** Needs verification, not a
  decision: does it re-fit, hold its transform, or misbehave? Flagged for `code-architect`.
- **OQ-6 — the exact sticky offset and z-index.** Docs disagree (TopNav 52px vs
  `.cs-session-left` `top: 48px`; topbar `z-index` documented as both 200 and 110). One
  variable, verified against the CSS, consumed by both columns and the band.

## 14. Prototype recommendation — YES, and scope it tightly

Story 63 needed no prototype because every decision in it was *read*. This one is the
opposite: its load-bearing risk is **spatial**, and spatial risk is felt on a device, not
resolved in a spec. The unanswerable-on-paper question is exactly one sentence: *is a 34vh
map on a 390×844 phone big enough to read token positions, and is the remaining ~414px of
content column tolerable to actually use?*

**Prototype exactly:** one session shell at three widths (1280 / 820 / 390), the band's three
states with the real transitions and curves, a placeholder map image with six tokens at
realistic scale, the 3-tab strip, and a button that fires the auto-promote trigger. Include
the Attack Bar as a static 64px block so the mobile vertical budget is honest.

**Do not prototype:** `MapViewer` pan/zoom, the token effects cluster (Stories 52–55), the
Attack Bar's own states, or anything in the left column.

## 15. Cross-references

- **Story 57 (`attack-targeting-flow-brief.md`) — AMENDED.** Its §10 edge case 8 ("the reticle
  is only visible on the Map sub-tab") is now obsolete: the reticle is visible from every
  sub-tab. The Attack Bar itself is unchanged (fixed bottom, `z-index: 150`); the band's
  `full` state sits at `z-index: 140`, deliberately **below** the bar so a player can target
  and roll with the map maximised. §10.3 above is this brief's answer to that story's
  precision requirement.
- **Story 63 (`session-spell-slot-management-brief.md`)** — right-column content and order are
  entirely unchanged; the band is inserted above all of it. Its no-glow/no-pulse rule is
  extended to this band for the same reason (the ambient channel is already spent).
- **Story 59 (`simplify-profile-view-brief.md`)** — removes the classic sheet's Map tab,
  making session mode the app's sole map surface. No dependency in either direction; either
  can ship first.
- **Stories 52–55 (token effects)** — unchanged code, improved reach: effects now play whenever
  session mode is open, not only while the map tab was selected. Mount/freshness gate now
  fires once per session mount (§9).
- **Story 47a** — `activeMapView.cx/cy` initial centring now applies at band mount and on
  every DM map switch (§11.4).
- **Story 34** — own-token drag unchanged; see §11.6 for the mobile scroll interaction.
- **Story 30 (Counter Wheels)** — its mode-aware-default + last-manual-toggle-wins collapse
  rule is reused verbatim for `dnd_session_map_${slug}`. No second version of that logic.
- **Story 16** — the tier principle in §1.
