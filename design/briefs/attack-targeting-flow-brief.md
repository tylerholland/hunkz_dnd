# Attack Targeting Flow — Design Brief

> **Story 57.** A genuinely new touch gesture on the live battle-map surface, plus a
> new persistent action bar. Consumes Story 56's spell `role`; supersedes part of
> Story 55's inference model.
>
> **Prototype recommendation: YES — build one, and scope it tightly.**
> Unlike Story 56 (list/form UI assembled from existing patterns), this brief's
> load-bearing decisions are *felt, not read*: a tap-vs-hold discriminator layered
> onto a surface that already owns pan, pinch-zoom and own-token drag; threshold
> constants (8px / 500ms) that only thumb-testing can validate; and a four-state
> bar choreography that is a **sequence**, not a layout. Prototype exactly:
> one map, three NPC tokens + the player's own token, the reticle, the bar's four
> states, retarget-while-armed, and a reduced-motion switch. **Do not** prototype
> roll math, the roll feed, or the spell editor. Route to `ux-designer` first, then
> `code-architect`.

---

## 1. Tier

**Tier 1** — combat-critical. This is a turn-action surface; it exists only while a
declaration is live and is absent the rest of the time.

## 2. Design intent

Point at the thing you're hitting, say what you're hitting it with, then roll —
the physical-table ritual, in that order, without leaving the board. The map stops
being a status display and becomes the place you act from.

## 3. Information hierarchy + layout

Ranked: **the Roll button** → the target's name → the chosen attack → the attack
picker → the reticle on the token → everything else on the map, unchanged.

Two surfaces, and only two. **No anchored popover chasing the token** — it fights
pan/zoom, lands off-screen at map edges, and occludes the board you just pointed at
(rejected for those three reasons).

### 3.1 The reticle (on the token)

```
.token-chip[data-targeted]
  .tk-target-ring                             — SVG, sits OUTSIDE the faction ring (r = ringR + 3px)
    path × 4                                  — 60° arcs centred at 45°/135°/225°/315°
      (underlay)                              — stroke rgba(0,0,0,0.55), 3px
      (stroke)                                — var(--pal-accent-bright), 1.5px, linecap round
```

Four diagonal arcs, not a crosshair over the portrait. The N/E/S/W gaps are
deliberate: they keep Story 54's `◇` 12-o'clock slot and Story 53's left-edge badge
column visually clear, and the ring channel never occludes a face. Lives **inside**
`.token-chip`, so it inherits Story 45's counter-rotation and stays upright on a
rotated map with no correction.

**Tinted with the viewing player's own `--pal-accent-bright`, not a universal
colour.** Every other token-layer effect colour is universal because it states a
shared truth; a declared target is *private intent* — only the declaring player sees
it (OQ-5). Palette-tinting says "this is mine" for free, and the black under-stroke
keeps `vellum`/`ash`/`pitch` legible over any terrain.

### 3.2 The Attack Bar

**Fixed to the bottom edge of the session-mode viewport** (not docked inside the map
panel), 64px, full shell width, `z-index: 150`, opaque `--pal-surface-solid`
background. Present only while a declaration is live. Fixed position means it never
moves under pan/zoom, it is thumb-reachable on mobile, and it survives a sub-tab
switch — a player can check spell slots before rolling without losing their
declaration. While it is mounted, the session scroll container gains
`padding-bottom: <bar height>` so nothing is permanently occluded.

```
.cs-atk-bar[data-state=pick|armed|result|expiring]
  .cs-atk-bar-inner                           — flex row, gap 12, shell horizontal padding
    button.cs-atk-target                      — 44px; tap re-centres the map on the target
      .cs-atk-target-glyph  ◎                 — 13px, --pal-accent-bright
      .cs-atk-target-name                     — 13px --font-ui, uppercase, 0.16em, --pal-text, ellipsis @14ch
    button.cs-atk-cancel  ×                   — 44px, #c06060 @ 0.7
    .cs-atk-divider                           — 1px vertical, --pal-border
    .cs-atk-picker                            — PICK only; flex 1; horizontal scroll, no scrollbar
      button.cs-atk-chip[data-kind=weapon]    — 44px min-height; name + to-hit
      .cs-atk-chip-divider                    — 1px vertical hairline; only if both runs non-empty
      button.cs-atk-chip[data-kind=spell][data-state=ready|spent]
        .cs-atk-chip-glyph  ✶                 — 11px, --pal-gem  (Story 56 vocabulary, unchanged)
        .cs-atk-chip-name
        .cs-atk-chip-slot   "SLOTS 0"         — spent only; 10px, --pal-text-muted
    .cs-atk-chosen                            — ARMED/RESULT; replaces the picker
      button.cs-atk-chosen-chip               — 44px; --pal-accent-dim bg; tap reopens the picker
      .cs-atk-result                          — RESULT only
        .cs-atk-result-total                  — 28px Cinzel
        .cs-atk-result-dice                   — 11px --font-ui, --pal-text-muted, "[14] +3"
    .cs-atk-actions
      button.cs-atk-roll.btn-primary          — ≥44px, min-width 96px
      button.cs-atk-secondary.btn-ghost       — RESULT only
```

**Attack chip order is Story 56's merged-list order verbatim** — weapons first, one
hairline, then `✶` spells. No interleaving, no re-sort. The same set the dice roller
can already roll: weapons with an Attack Bonus or Damage mod, plus `role: "attack"`
spells.

### 3.3 The four states

| State | Bar contents | Primary button | Secondary |
|---|---|---|---|
| **PICK** | target + `×` + picker row | — | — |
| **ARMED** | target + `×` + chosen chip | `ATTACK` | — |
| **RESULT (atk)** | target + chip + total + dice | `⚔ DAMAGE` | `↺ AGAIN` |
| **RESULT (dmg)** | target + chip + total + dice | `↺ AGAIN` | — |

`ATTACK` → `⚔ DAMAGE` → `↺ AGAIN` is the verbal ritual at a real table ("seventeen"
/ "hit" / "eight damage"). It is also what makes Extra Attack cheap: attacks 2 and 3
cost **two taps each**, never a re-declaration.

### 3.4 Editable roll expression + Advantage/Disadvantage (added 2026-08-06)

**Neither of these is new roll logic.** `DiceRoller.jsx` already has a working
Advantage/Disadvantage toggle (`advMode`, three-state strip, §"Advantage strip") and
a typed-expression path (`exprInput` + `parseDiceExpr`) used by its own Free Roll
panel. The Attack Bar surfaces both at declare-time instead of inventing anything —
this is wiring, not a new mechanic.

**Chosen chip shows the loaded expression, tap to edit.** In ARMED, `.cs-atk-chosen-chip`
displays the expression that will actually be rolled — `1d20+7` for the attack step,
the weapon/spell's damage string for the damage step — computed the same way
`rollWeaponAtk`/`rollWeaponDmg` do today. Tapping the expression (not the whole chip —
tapping the chip elsewhere still reopens the picker) turns it into a single-line text
input pre-filled with that same string, validated on blur/Enter with the existing
`parseDiceExpr`; an invalid expression shows the roller's existing inline error text
and does not arm. This exists because a DM's house-rule modifier isn't always
encoded in the sheet's weapon/spell mods — the loaded value is the right default, but
it must not be the only option.

```
.cs-atk-chosen
  button.cs-atk-chosen-chip
    .cs-atk-chosen-name
    .cs-atk-chosen-expr[contenteditable-on-tap]  — "1d20+7"; tap → text input, existing parseDiceExpr validation
  .cs-atk-adv-strip[data-visible=atk-step-only]   — 3 segments, 32px tall: Normal / Adv / Dis
    button[data-mode=normal|advantage|disadvantage]
```

**The Adv/Dis strip only appears for the to-hit (ATK) step, never for damage** —
this mirrors `executeRoll`'s existing `isD20Attack` gate exactly (advantage/disadvantage
only ever applies to a single d20 roll in this app today); it is absent in the
`⚔ DAMAGE` sub-state. Selecting Advantage/Disadvantage sets the same `advMode` value
`DiceRoller` already threads through `executeRoll` — the Attack Bar's `ATTACK` button
calls the same roll path, just supplying `advMode` from this strip instead of the
panel's own strip. Compact three-segment control, no drawer.

## 4. Colour tokens

| Token | Role |
|---|---|
| `--pal-accent-bright` | reticle arc stroke; `◎` glyph; chosen-chip border |
| `rgba(0,0,0,0.55)` | reticle contrast under-stroke — universal, all palettes |
| `--pal-accent-dim` | chosen-chip background (ARMED/RESULT) |
| `--pal-gem` | `✶` spell glyph in chips; result total, ordinary roll |
| `--pal-surface-solid` | bar background — opaque, it overlays the map |
| `--pal-border` | bar top border; chip resting border; vertical dividers |
| `--pal-text` / `--pal-text-muted` | target name / dice array, `SLOTS 0`, disabled chips |
| `--tk-dmg-rest` `#c06060` | GONE state; fumble total; `×` cancel at 0.7 opacity |
| *(existing roller crit / fumble colours)* | result total on crit/fumble — **reuse verbatim, invent nothing** |

No new universal token is introduced. `--tk-target-*` was considered and rejected —
the reticle is palette-tinted by design (§3.1).

## 5. Motion & animation spec

```
Reticle charge (added 2026-08-06 — gesture reversal):
  Trigger: pointerdown on an enemy token, targeting armed
  Animation: a thin arc sweeps clockwise from 12 o'clock around the faction ring's
             outer edge, 0%→100% over the 500ms hold window, tracking elapsed time
             1:1 (not a fixed-duration animation — it is literally a progress meter)
  Cancel: pointer moves >8px, or releases <500ms → arc retracts to 0% over 100ms
          ease-out and vanishes; no reticle, falls through to the tap→inspect path
  Complete: at 500ms the sweep reaches 100% and hands off directly into Reticle
             appears below — no gap, no restart, the completed sweep arc *is* the
             seed the four bracket arcs draw outward from
  Communicates: "hold to lock on" — without this, a 500ms commit-on-hold gesture
             with zero feedback reads as unresponsive; the sweep is what makes the
             gesture legible while it's happening, not just after
```
```
Reticle appears:
  Trigger: hold on an enemy token reaches the 500ms threshold (targeting commits
           mid-press, not on release — see §7.1)
  Animation: group scale 1.25→1.0 + per-arc stroke-dashoffset draw from arc midpoint outward
  Duration: 200ms, cubic-bezier(0.2,0.8,0.2,1)
  Communicates: "locked on" — the arcs converging is the lock
```
```
Reticle at rest:
  Animation: opacity 0.70↔1.00 breathe
  Duration: 2.4s ease-in-out, infinite alternate
  Communicates: "this declaration is still live" — ambient, readable without looking
```
```
Reticle clears:
  Trigger: cancel, retarget, or target gone
  Animation: scale 1→1.2 + opacity 1→0
  Duration: 140ms ease-out
  Communicates: "released" — the inverse of the lock
```
```
Bar enters:
  Trigger: a target is declared
  Animation: translateY(100%)→0 + opacity 0→1
  Duration: 220ms, cubic-bezier(0.2,0.8,0.2,1)
  Communicates: "a statement docked at the edge of the world"
```
```
Bar exits:
  Trigger: cancel / expiry complete
  Animation: translateY(0)→100%
  Duration: 160ms ease-in
```
```
PICK → ARMED:
  Trigger: tap an attack chip
  Animation: chosen chip translates to the chip slot at full opacity; the other chips
             fade 1→0 + scale 1→0.94 in place; Roll button opacity 0→1 + scale 0.9→1
  Duration: 180ms ease-out for the collapse; Roll button 120ms at +60ms delay
  Communicates: "your choice survived, the rest got out of the way"
```
```
ARMED → PICK (change attack):
  Exact reverse, 180ms ease-out. Same curve both directions — reversible, not a new step.
```
```
Roll resolves (ARMED → RESULT):
  Trigger: tap ATTACK / ⚔ DAMAGE
  Animation: total scale 0.85→1.0 + opacity 0→1; dice array fades in at +80ms
  Duration: 240ms, cubic-bezier(0.2,0.8,0.2,1)
  Crit/fumble: reuse the dice roller's existing 420ms gold/red glow treatment unchanged
  Communicates: "the number landed" — deliberately NOT a dice-spin; the roller owns that
```
```
Retarget while armed:
  Trigger: tap a different enemy token in ARMED/RESULT
  Animation: old reticle clears (140ms) overlapping the new reticle draw (200ms) by 60ms;
             bar target-name crossfades 140ms; the chosen attack does not move
  Communicates: "same weapon, new victim"
```
```
Target gone:
  Trigger: target token absent from the map payload for 2 consecutive poll ticks
  Animation: strikethrough draws L→R across the name (180ms) + colour → --tk-dmg-rest;
             " — GONE" fades in; held 1400ms; bar exits
  Communicates: "the thing you declared against isn't there any more" — NOT silent
```
```
Spent spell chip tapped:
  Animation: 3-cycle ±3px horizontal shake, 90ms total. No state change.
  Communicates: "not that one" — refusal, not an error message
```

```
Roll overlay (added 2026-08-06):
  Trigger: tap ATTACK / ⚔ DAMAGE / ↺ AGAIN — every roll fired from this flow, not
           the roller's own panel
  Surface: a centred full-viewport overlay, above the map and the bar, `z-index: 200`,
           translucent scrim behind it (does not fully obscure the board — this is a
           moment, not a modal)
  Animation: reuses the roller's existing cycling-number mechanic (`cycleNum`,
             ~90ms interval, `resolveTime` ≈1050ms for a single group) at large scale
             (Cinzel, ~25vh) instead of the panel's small numeral; settles on the
             final total with the same crit/fumble colour treatment the panel already
             has (gold pulse / red shake — reused verbatim). Auto-dismisses ~400ms
             after settling, or on tap-anywhere.
  Also updates: the bar's own RESULT line-item total updates in lock-step (not
             instead of) — the overlay is the "big event" version of the same number,
             it does not replace the bar's persistent record of it.
  Communicates: "this is a big swing, not a background calculation" — the user's own
             framing ("treat it like a big event for the player")
  Non-goal: the overlay is Attack-Bar-only. The roller's own panel (weapon quick-roll
             buttons, Free Roll, ability checks) is explicitly unchanged — no scope
             creep into the existing roller's own visual language.
```

## 6. Reduced-motion table

| Animation | `prefers-reduced-motion: reduce` |
|---|---|
| Reticle charge | No sweep arc; instead a single static dot at 12 o'clock that simply appears once the 500ms hold threshold is reached (duration itself is preserved — it's still a 500ms hold — only the animated feedback is removed) |
| Reticle appears | Instant, full opacity, no draw, no scale |
| Reticle at rest | **No breathe** — static at 1.0 opacity |
| Reticle clears | Instant removal |
| Bar enters / exits | Instant, 0ms |
| PICK → ARMED / back | Instant swap, no collapse |
| Roll resolves | Number appears instantly; crit/fumble becomes a static colour, no glow pulse |
| Retarget | Instant reticle swap, instant name swap |
| Target gone | Instant strikethrough + colour; **1400ms hold preserved** (duration is information, not decoration) |
| Spent chip shake | Instant 90ms opacity dip 1→0.5→1 instead |
| Roll overlay | Number appears instantly at final value, no cycling; crit/fumble becomes a static colour; scrim fades instantly; still auto-dismisses ~400ms later (that hold is information — it's the moment you'd otherwise be watching cycle) |

## 7. Interaction model

### 7.1 The gesture — the resolution of the story's core conflict

**Revised 2026-08-06 — reverses the original OQ-2 decision.** The brief originally
put targeting on the fast gesture (tap) on the theory that a combat surface should
give the frequent action the cheap gesture. On review of the prototype, the call is
reversed: **tap = inspect (unchanged from today), hold = target.** On enemy (NPC)
tokens only.

| Gesture on an NPC token | Result |
|---|---|
| pointerdown→up, <500ms, <8px movement | Existing tap detail card (Story 53), **completely unchanged from today — zero regression risk** |
| pointerdown→up, ≥500ms, <8px movement | **Declare target** (or untarget if already targeted) — commits mid-press, at the moment the 500ms threshold is crossed, not on release |
| pointer moves >8px | Map pan (existing `MapViewer` behaviour, unchanged) |

The 8px movement threshold is what makes this unambiguous against panning — it is the
single most important constant in this brief, unchanged by this reversal. The 500ms
threshold is now what protects a passing tap-to-inspect from ever being misread as a
declare.

**Today's existing gesture is fully preserved: tap still opens the detail card,
exactly as it does right now, on every NPC token, regardless of whether targeting is
armed.** Only the *new* behavior — targeting — is added, on the gesture that didn't
exist as a dedicated action before (hold). This is a strictly additive change to
existing muscle memory, not an inversion of it: nothing a player already knows how to
do on an enemy token changes. **Because commit-on-hold with no feedback would feel
broken, hold now needs its own affordance while charging — see the new "Reticle
charge" motion spec in §5** — the reversal is not gesture-only, it changes the
timeline: previously the reticle only ever appeared *after* a completed action (a tap
already resolved); now the token must visibly respond *during* the hold, before the
gesture is known to succeed.

**PC tokens are completely untouched.** The player's own token keeps Story 34's
Pointer-Events drag; other PCs keep tap→detail card. There is no collision because
targeting is NPC-only — you can never drag an enemy token, and you can never target
a friendly one (v1).

**No collision with an existing hold gesture — verified against the code, not
assumed.** `handleClick` (tap) already triggers `onTokenClick` directly and
immediately — the detail card genuinely is tap-triggered today, confirming the
original brief's own framing. There *is* one existing hold/long-press gesture in
`BattleModeController.jsx` (`token-longpress-ring`, "Hold to remove") — but its own
comment marks it **DM-only**, it's a token-management menu (resize/remove), and it
lives on a different persona's view of this shared component. It has nothing to do
with the player-facing NPC tap/hold this brief specifies and there is no shared
surface to collide on. Convenient bonus: that existing DM gesture already proves a
charging-ring affordance pattern works fine in this app — the new player-facing
"Reticle charge" (§5) is a sibling of an established idea, not a first-of-its-kind
risk.

**Targeting is only armed when `activeMap.mapMode === "battle"` AND the character has
≥1 rollable attack.** Otherwise every token behaves exactly as it does today.

### 7.2 Everything else

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| Enemy token | Hold (≥500ms) | Charge sweep, then reticle draws; bar enters in PICK | none (transient) | Hold same token again |
| Enemy token (already targeted) | Hold (≥500ms) | Reticle clears; bar exits | none | — |
| Enemy token (while ARMED/RESULT) | Hold a *different* one (≥500ms) | Reticle moves; attack retained | none | Hold the new one again to clear |
| Map background | Tap (<8px) **in PICK** | Declaration clears | none | Re-tap the token |
| Map background | Tap **in ARMED/RESULT** | **Nothing** | — | — |
| `×` cancel | Tap (44px) | Bar exits, reticle clears | none | Re-tap the token |
| Attack chip (ready) | Tap (44px) | Picker collapses; ARMED | none | Tap chosen chip → reopen |
| Attack chip (spent) | Tap | Shake refusal | **none** | — |
| Chosen chip | Tap (44px) | Reopens picker (PICK, target kept) | none | Pick the same one again |
| `ATTACK` / `⚔ DAMAGE` / `↺ AGAIN` | Tap (≥44px) | Result readout replaces button label state | **Roll fires + broadcasts** | **None — a broadcast roll is a public statement** |
| Target name | Tap (44px) | Map re-centres on the target token | none | — |
| Escape key | Press | Same as `×` | none | — |

The PICK/ARMED asymmetry on background taps is intentional: **cheap state is cheap to
lose; committed state requires an explicit `×`.**

**No hold, no swipe, no drag anywhere in the bar.** Every affordance is a ≥44px tap.

## 8. Data contracts and sync/freshness

**Transient client state**, owned by `CharacterSheetSessionMode`, never persisted and
**never written to `sessionStorage`** (a declaration restored after a reload is a lie
about a board that has moved on):

```js
declaration = {
  target: { type: "npc", sourceId, name },        // name captured at declaration time
  attack: { kind: "weapon"|"spell", id, name, toHit?, damage? },
  phase:  "pick" | "armed" | "result" | "expiring",
  lastRoll: { kind: "atk"|"dmg", total, dice[], crit, fumble } | null,
}
```

**Write path: the existing `postCharacterRoll` broadcast only.** Two new optional
fields on that payload — `target` and `attack` (same shapes as above). Zero new
endpoints, zero `patchSession` writes, zero polling cost, no optimistic-update rule.
Fire-and-forget exactly as today: the UI never blocks on it, and a failed broadcast
is silent (the roll still resolved locally and is in the roller's own history).

**The feed renders the *captured* target name, never a live lookup.** This is the
answer to the story's NPC-identity open question: an entry is a historical statement
about what was declared, and it must stay correct after the NPC is renamed,
duplicated, or deleted. `sourceId` rides along for future consumers (Story 55's
tracer, the DM Apply-to loop) and is **allowed to dangle**.

**Roll-feed rendering — no new row type, no extra vertical space.** The existing
`RollHistoryRow` action-label slot carries the declaration:

```
2d6+1d4    Aragorn   Longsword → ◎ Goblin 2      [14] +3      17
```

`◎` (U+25CE) is the target glyph, used in exactly two places app-wide: this feed row
and the bar's target label. Deliberately **not** `◆`/`◇` (attunement, Persona
bullets, DM-secret), not `✦` (Heal/STABLE), not `✶`/`✚` (Story 56 spell roles), not
`⚔` (Damage). Target name in `--pal-text-muted` italic; the rest of the row is
unchanged. The DM sees this for free — the DM dashboard renders the same component.

**Freshness / target liveness:** the declaration's `target.sourceId` is validated
against the latest polled `activeMap.tokens[]`. Absent for **two consecutive poll
ticks** → the GONE path (§5). Two ticks, not one, so a single degraded response can't
flicker the bar out from under a player mid-turn. An NPC that goes Invisible is
absent from the player payload by Story 54's design, so it takes the identical
GONE path with no extra code.

## 9. Size-degradation ladder

1. **≥900px** (two-column session) — bar spans the shell, single 64px row:
   `◎ TARGET  ×  |  [chips…]  |  [ATTACK]`.
2. **560–900px** — identical; the chip row absorbs the squeeze via horizontal scroll.
3. **<560px** — two rows, 72px total: row 1 = `◎ TARGET` + `×`; row 2 = picker *or*
   (chosen chip + result + buttons). Roll button min-width 96px, right-aligned.
4. **<380px** — attack chips drop the to-hit value and show name only; the full
   `Longsword +7` is visible on the chosen chip in ARMED. Result dice array hides;
   the total never does.

The Roll button, the target name, and the result total never truncate at any step —
they are the reason the bar exists.

## 10. Key edge cases

1. **No battle-mode map / no tokens placed** → no targeting, no bar; tokens and the
   Combat sub-tab behave exactly as today. (Story requirement, restated as a rule.)
2. **Character has zero rollable attacks** → hold-to-target does not arm; a hold
   just falls through to today's tap detail-card behaviour, unaffected. An empty
   picker after a deliberate hold reads as broken; unavailability should be
   invisible, not announced.
3. **Player's own token not placed on the map** → targeting still works. Range and
   line-of-sight are explicitly out of scope; the app does not police who can reach
   whom.
4. **Target drops to 0 HP mid-declaration** → declaration persists unchanged. The app
   does not adjudicate death, and finishing off a downed enemy is a real action.
5. **Target goes Invisible (Story 54)** → identical to GONE. Correct by construction:
   the token is absent from the player's payload, not hidden.
6. **Two enemies with the same name** → the bar and feed show the name; `sourceId`
   disambiguates internally. Story 24's numbered spawn already makes this rare.
7. **Declaration survives a turn change** — deliberately. Opportunity attacks are real
   and a turn-boundary auto-clear would eat them. Only `×`, retarget, target-gone, or
   leaving session mode clears it.
8. **Player switches sub-tab while armed** → bar persists (it is fixed to the
   viewport). The reticle is only visible on the Map sub-tab; the bar carries the
   target name, so nothing is lost.
9. **Map rotated 90/180/270** → reticle is inside `.token-chip` and inherits Story
   45's counter-rotation. No correction needed. Test at all four rotations.
10. **Crit on the attack roll** → the roller's existing gold treatment; the follow-on
    stays `⚔ DAMAGE`. No auto-doubled dice — out of scope.

## 11. Files touched

- `src/features/characterSheet/AttackDeclarationBar.jsx` — **new**; the bar, all four states
- `src/features/characterSheet/CharacterSheetSessionMode.jsx` — owns `declaration` state; mounts the bar; passes `targetedTokenId` + `onTargetToken` into `PlayerMapViewer`
- `src/features/characterSheet/characterSheet.css` — `.cs-atk-*`, bar keyframes, mobile two-row ladder
- `src/features/dmDashboard/battleMode/BattleModeController.jsx` — `TokenChip`: tap-vs-hold discriminator on NPC tokens, `targeted` prop, `.tk-target-ring`
- `src/features/dmDashboard/battleMode.css` — `.tk-target-ring` + reticle keyframes
- `src/components/DiceRoller.jsx` — expose the existing weapon ATK/DMG roll handlers, `advMode`, and `exprInput`/`parseDiceExpr` so the bar can trigger the same `executeRoll` path (imperative handle or lifted callback) with a bar-supplied expression override and adv/dis mode; attach declaration context to `postCharacterRoll`. **No change to roll mechanics, animation, crit/fumble, or its own history/panel display** — the bar reuses `executeRoll`, it does not fork it.
- `src/components/RollOverlay.jsx` — **new**; the centred full-viewport roll-landing overlay (§5), Attack-Bar-only, reuses `DiceRoller`'s cycling-number mechanic at large scale.
- `src/api.js` — `postCharacterRoll` payload gains optional `target` / `attack`
- `backend/src/handlers/postCharacterRoll.js` — validate + pass through the two optional fields
- the shared `RollHistoryRow` renderer (DM feed) + `DiceRoller.jsx`'s history rows — declaration in the action-label slot
- `src/features/characterSheet/constants.js` — Story 56 spell-shape amendment (§13)
- `design/app-overview.md`, `design/design-system.md` — feature-builder updates

## 12. Open questions — all resolved 2026-08-06

- **OQ-1 — the Story 56 spell-shape amendment.** **Resolved: approved as
  recommended.** Add `level?: number` (0 = cantrip), `toHit?: string`,
  `damage?: string` to Story 56's spell role drawer.
- **OQ-2 — tap = target / hold = inspect on enemy tokens** (§7.1). **Superseded
  2026-08-06, after reviewing the prototype: reversed to tap = inspect (unchanged
  from today) / hold = target.** See §7.1 for the full rationale and the new
  "Reticle charge" motion spec (§5) this reversal required.
- **OQ-3 — bar placement.** **Resolved: fixed to the viewport, as recommended**
  ("dock to the viewport, let's see how well that works"). **Plus an addition**:
  the loaded dice expression must be editable in the bar for DM house-rule
  modifiers the sheet doesn't capture — specced in new §3.4.
- **OQ-4 — result readout in the bar at all?** **Resolved: yes, keep the bar's
  line-item readout, as recommended — plus an addition**: also show the roll
  landing as a large centred full-viewport overlay, "treat it like a big event
  for the player" — specced as the new Roll overlay motion spec in §5. The overlay
  supplements the bar's readout, it doesn't replace it.
- **OQ-5 — shared reticle on the DM's map.** **Resolved: deferred, as
  recommended.** Follow-up story tracked — see Story 57's "Follow-ups" note.
- **OQ-6 — DM "Apply to…" pre-selection.** **Resolved: deferred, as
  recommended.** Follow-up story tracked — see Story 57's "Follow-ups" note.
- **OQ-7 — the four named constants** (8px / 500ms / 2-tick / 1400ms).
  **Resolved: ship as specified.**
- **OQ-8 — session mode only for v1?** **Resolved: yes, as recommended.** (Noted
  for later: the classic sheet's Map tab may be removed entirely down the line —
  not this story's concern.)

## 13. Cross-references

- **Story 56 (`structured-spell-list-brief.md`) — AMENDED.** Adds `level?: number`,
  `toHit?: string`, `damage?: string` to the spell shape in §9 of that brief, and
  narrowly reverses its OQ-2. See OQ-1 above. Story 56's `role: "attack"` filter,
  weapons-then-spells order, and `✶` glyph are consumed **unchanged**.
- **Story 55 (`token-attack-animation-brief.md`) — partially supersedes its OQ-1
  inference model, but does NOT close its Architect risk #4.** This story captures
  `attack.kind` at *roll* time; Story 55's tracer fires off a *damage-apply*, which
  still carries no item reference. The cheapest path to Channel is a correlation
  window (a declared spell attack against `sourceId` within ~20s of a damage-apply to
  that same `sourceId`) — **flagged for a later story, not built here.** Story 55
  should still ship Bolt-only (its option (a)).
- **Story 54 (`invisible-token-veil-brief.md`)** — depended upon: invisible NPCs are
  absent from the player payload, so they are untargetable by construction and take
  the GONE path for free. No new leak surface.
- **Story 53 (`token-persistent-condition-indicator-brief.md`)** — its hover/long-press
  detail card becomes **hold-only** on NPC tokens (§7.1). PC tokens unchanged. The
  reticle's N/E/S/W gaps preserve its left-edge badge column.
- **Story 34 (player token drag)** — untouched. No gesture collision: targeting is
  NPC-only, dragging is own-PC-only.
- **Story 16 (DM card redesign)** — tier declaration in §1 follows its information-tier
  principle.
- **ADR-005** — unchanged; the roll broadcast is already unauthenticated and this story
  adds no authenticated write.
