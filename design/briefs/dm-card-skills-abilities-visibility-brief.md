# DM Card — Skills & Special Abilities Visibility — Design Brief

> Story 50. The always-present capability reference on the DM party card.
> Produced by design-strategist as the implementation spec for ux-designer.
>
> Scope: replaces today's uncapped Skills / Spells / Special Abilities badge wall with a bounded, fixed-position **Capability Rail** (rest state) plus a one-tap **Codex drawer** (full detail). Designed as the container Story 51 will extend — see §9.

---

## 0. Diagnosis — what is actually broken

The story's first open question asks whether the badges are *absent in one mode* or *present but easy to miss*. The answer is neither, exactly, and the distinction changes the fix:

| Observed | Consequence |
|---|---|
| The badge area renders unconditionally, below the condition row. Nothing gates it on Adventure vs Combat. | This is **not** a mode-visibility bug. A "show it in combat too" flag would fix nothing. |
| It prints **every** skill, **every** spell and **every** ability, uncapped. A Warlock with 9 skills + 12 spells + 3 abilities produces ~24 chips ≈ 5 wrapped lines. | The block is the tallest region on the card. It pushes XP/coin, notes and the death-saves strip far below the fold. |
| Every chip has identical visual weight — no grouping labels, no counts. | 24 equal-weight chips read as texture, not information. The eye slides off. **Showing everything is why nothing is seen.** |
| In combat the card grows (conditions, concentration, slots, death saves) and the party column scrolls. The block sits at variable depth, landing in a different place on every card. | "Not reliably visible in combat" is real — but the cause is *unbounded, variable-position height*, not a mode conditional. |

**Therefore the fix is subtractive.** Take content *off* the resting card (uncapped wall → hard 2-line budget), give the region a fixed position identical on every card in every mode, and put the full list one tap away. For a typical caster the resting card gets ~60px **shorter**, not taller.

**Tier declaration** (required before layout, per the Story 16 convention):
- **Capability Rail** (rest) — **Tier 1c**: passive reference, same band as the saves strip. Read at scene transitions and turn starts, not every round.
- **Codex drawer** (expanded) — **Tier 3**: on-demand lookup. Never open by default except on the active-turn card in combat (§4.4).

---

## 1. Design intent

The DM should never have to ask "are you proficient in Perception?" or "what does your ability do again?" — and should never have to hunt for where the answer lives on a card. The rail makes each character's *capability surface area* an ambient, glanceable property of their card: the same two lines, in the same place, on every card, in both modes. What changes between Adventure and Combat is emphasis, never presence. The mental model: **the rail prioritises, the codex catalogues.**

---

## 2. Information hierarchy

Within the capability region (most → least prominent):

1. **Printed chips of the two mode-priority clusters** — 12px IM Fell English, cluster-coloured. These are the words the DM actually reads. Two clusters print; never three.
2. **Count chip of the third cluster** — right end of the last line (`SPELLS 12` / `SKILLS 9`). Number first, label second. Guarantees all three clusters are *represented* in both modes — the literal answer to the story's requirement.
3. **`+N` overflow chip** — end of a printed cluster, in that cluster's colour. Tells the DM the list is longer than shown, so a truncation is never mistaken for the whole truth.
4. **`⌄` chevron** — far right of the last line. Lowest weight; the rail itself is the tap target, the chevron is only the affordance glyph.

Card stack, top to bottom:

`HP → conditions/concentration → spell slots → saves strip → ⟨CAPABILITY RAIL⟩ → ══ Tier 2 divider ══ → XP/coin → notes → death saves`

**Competition resolved:** the saves strip and the capability rail are both passive reference. Rather than let them fight, they are deliberately adjacent and form one **reference band**, separated from the volatile combat cluster above by a thin palette-tinted rule and from Tier 2 below by the existing heavier divider. One band, one glance, identical position on caster and non-caster cards (both always have a saves strip).

**Cluster colour coding** — inherited unchanged from the character sheet so a chip means the same thing on both surfaces:

| Cluster | Treatment |
|---|---|
| Skills | accent — border `--pal-accent` @45%, text `--pal-accent-bright`, transparent bg |
| Spells | neutral — border `--pal-border`, text `--pal-text-body`, bg `--pal-surface` |
| Special Abilities | gem — border `--pal-gem` @45%, text `--pal-gem`, bg gem @8% |

Colour carries cluster identity, so the rail needs **no per-cluster labels** at rest. That is what buys the 2-line budget.

---

## 3. Annotated wireframes

### 3a. Card at ~400px — Adventure mode, collapsed (the common case)

```
┌──────────────────────────────────────────────────────┐
│ (◍) Aragorn                                      ⋯   │
│     Human · Ranger · Lvl 8          ↗ Sheet    [17]  │
├──────────────────────────────────────────────────────┤
│            52 / 60                                   │
│   [−] [█████████████████░░░] [+]      [⚔] [✦]        │
├──────────────────────────────────────────────────────┤
│ ① PERC 14 · Wis +1 · Con +5 · Dex +6 · 35ft          │
│ ─────────────────── ② hairline ──────────────────────│
│ ③[Athletics][Survival][Perception][Stealth] ④[+5]    │
│ ⑤[Backstab][Ritual]              ⑥ SPELLS 12   ⑦ ⌄   │
├════════════════ Tier 2 divider ══════════════════════┤
│  GP  [240 gp]  [Give]                                │
└──────────────────────────────────────────────────────┘
```

① **Saves strip** — unchanged (Story 20). Now the first member of the reference band.
② **Hairline rule** — `1px solid var(--pal-border)` at 55% opacity, `margin: 6px 0`. Separates two reference surfaces without implying a new section. Not the heavy Tier 2 divider.
③ **Skills cluster, printed first in Adventure mode.** Accent chips. Skills lead here because ability checks and "who's the face" questions dominate roleplay scenes.
④ **`+5` overflow chip** — accent-coloured, Cinzel numeral. Chips are dropped **whole**; a label is never ellipsed mid-word. A half-read word is worse than an honest count.
⑤ **Abilities cluster** — gem chips, always printed in both modes. Smallest, rarest and most-forgotten set, so it is never demoted to a count.
⑥ **Spells count chip** — the non-printed cluster, right-aligned. Reads `SPELLS 12`: label 11px `.label-ui`, numeral 12px Cinzel in `--pal-text-body`. Tapping opens the Codex anchored to Spells.
⑦ **Chevron `⌄`** — 12px, `--pal-text-muted` @60%. Glyph only; the entire rail (both lines) is the tap target, min-height 44px.

### 3b. Same card — Combat mode, collapsed

```
│ ─────────────────── hairline ────────────────────────│
│ ⑧[Backstab][Ritual]                                  │
│ ⑨[Hunter's Mark][Ensnaring Strike][+10]  ⑩SKILLS 9 ⌄ │
```

⑧ **Abilities move to line 1** — in combat the "you're forgetting you can do this" reminder is the highest-value line on the card.
⑨ **Spells print** — the sanity-check surface when a player announces a cast. Overflow into `+10` as the budget demands.
⑩ **Skills become the count chip** — still present, still one tap from full detail. **No cluster ever disappears; only its density changes.**

**Rule, stated once:** exactly two clusters print, one summarises. Abilities always print. Adventure prints Skills + Abilities. Combat prints Abilities + Spells.

### 3c. Codex drawer — expanded (either mode)

```
├──────────────────────────────────────────────────────┤
│ ⑪ CAPABILITIES                                   ⌃   │
│                                                      │
│ ⑫ SKILLS · 9                                         │
│   [Athletics][Survival][Perception][Stealth]         │
│   [Insight][Animal Handling][Investigation]          │
│   [Medicine][Nature]                                 │
│                                                      │
│   ABILITIES · 2                                      │
│   [Backstab][Ritual]                                 │
│                                                      │
│   SPELLS · 12                            ⑬ ▒scroll▒  │
│   [Hunter's Mark][Cure Wounds][Zephyr Strike]        │
│   [Ensnaring Strike][Spike Growth][Longstrider]      │
│   …                                                  │
├════════════════ Tier 2 divider ══════════════════════┤
```

⑪ **Drawer header** — `CAPABILITIES` in `.label-ui`; `⌃` collapse at right, 44px target. The header exists so the expanded region is unambiguously one object and the collapse control has a stable home that does not move as sections wrap.
⑫ **Canonical section order — Skills → Abilities → Spells, always, regardless of mode.** Deliberate contrast with the rail: the rail prioritises for the current task; the codex is a stable catalogue the DM builds muscle memory against.
⑬ **Internal scroll** — drawer `max-height: 320px`, `overflow-y: auto` with the app's 6px thin scrollbar. The card never grows more than 320px + 32px header, so the party column's scroll position stays predictable no matter how spell-heavy a character is.

### 3d. Sparse card at 320px — non-caster, few proficiencies

```
│ PERC 11 · Wis +0 · Con +3 · Dex +2                   │
│ ─────────────────────────────────────────────────────│
│ [Athletics][Intimidation]         [Rage]          ⌄  │
```

One line, 44px, no counts, no overflow. This is the calm state, and it should look finished — not like a truncated version of a richer card.

---

## 4. Motion & animation spec

### 4.1 Codex opens
- **Trigger**: tap on the rail, a count chip, or the chevron.
- **Animates**: drawer `max-height 0 → 320px` + `opacity 0 → 1`; chevron `rotate(0 → 180deg)`.
- **Duration**: 220ms, `cubic-bezier(0.2, 0.8, 0.2, 1)` (matches the World Guide drawer's open curve).
- **Communicates**: "this card grew downward from the point you touched" — the spatial anchor is the rail, so the DM's eye stays put while content arrives beneath it.

### 4.2 Codex closes
- **Trigger**: tap rail/chevron again, `Escape`, or another card's codex opening.
- **Animates**: reverse of 4.1.
- **Duration**: 180ms, `cubic-bezier(0.4, 0, 0.6, 1)`. Faster out than in — dismissal should feel immediate, arrival should feel placed.

### 4.3 Adventure ⇄ Combat cluster swap
- **Trigger**: DM toggles the top-bar `Adventure | Combat` segment (or the derived mode flips — §7).
- **Animates**: outgoing cluster fades `1 → 0`, translates `y: 0 → -4px`; incoming cluster fades in from `y: +4px`. 40ms stagger between line 1 and line 2.
- **Duration**: 200ms total, `ease-out`.
- **Communicates**: "the same information reordered itself" — not "content vanished." Without this the DM perceives a loss. This animation is the entire licence for mode-dependent emphasis; **if it is cut, cut the mode-dependent ordering too** and ship a fixed Adventure layout.

### 4.4 Active-turn auto-expand (combat only)
- **Trigger**: this character becomes the active initiative turn while combat mode is effective.
- **Animation**: 4.1's open, **delayed 260ms** so it does not compete with the card's own active-turn highlight landing first.
- **On turn-off**: 4.2's close — *unless* the DM manually opened the drawer, in which case it stays open until manually closed (manual intent always outranks automation).
- **Communicates**: "it is this character's turn, here is everything they can do." Mirrors the established NPC ability-reference behaviour from Story 23, so PCs and NPCs behave identically on their turn.

### 4.5 Count-chip anchor flash
- **Trigger**: DM taps a count chip (e.g. `SPELLS 12`) rather than the rail body.
- **Animation**: codex opens (4.1); the matching section label pulses `--pal-text-muted → --pal-accent-bright → --pal-text-muted` and the drawer scrolls that section to the top (`scroll-behavior: smooth`).
- **Duration**: 900ms label pulse, `ease-in-out`; scroll 300ms.
- **Communicates**: "you asked for spells, here is spells" — closes the loop on a targeted tap inside a multi-section panel.

### 4.6 Chip appears / disappears mid-session
- **Trigger**: polled data shows the player added or removed a skill/spell/ability on their own sheet.
- **Animation**: `scale 0.7 → 1.0` + `opacity 0 → 1`, 180ms `ease-out` (in); reverse over 140ms (out).
- **Communicates**: "the player changed their sheet just now." Reuses the condition-chip idiom so the motion vocabulary stays consistent.

### 4.7 Explicitly no animation
- **Rail on card mount** — instant. It is part of the card's resting state, not an event.
- **Overflow count recalculating on card resize** — instant text swap. Incidental, not something to track.
- **Tooltip inside the codex** — 120ms fade + 2px rise in, 90ms fade out. Minimal; a hover artefact, not a state change.

### 4.8 Reduced motion
Under `prefers-reduced-motion: reduce`, all of the above become `0ms` / `none`. The codex opens and closes instantly; the cluster swap is an instant re-render. Nothing is functionally lost.

---

## 5. Interaction model

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| Rail body (both lines) | Tap / click / `Enter` / `Space` | Chevron begins rotating on `pointerdown` | Codex opens; `dnd_codex_open` = this slug | Tap again, `Escape`, or open another card's codex |
| Count chip (`SPELLS 12`) | Tap | Chip border brightens to its cluster's bright tone for 120ms | Codex opens **anchored** to that section (4.5) | Same as above |
| Chevron `⌄` / `⌃` | Tap | — | Same as rail body (redundant affordance, not a separate control) | Same |
| Chip **in the rail** | Hover (desktop) | `Type: Name` tooltip | none — display only | — |
| Chip **in the codex** | Tap / hover / focus | `Type: Name` tooltip, 120ms fade-in | Tooltip only; dismiss on next tap, blur, or `Escape` | Tap elsewhere |
| Whole region | Outside tap | **Nothing** — the drawer does not close on outside tap | — | — |

**Deliberate decisions:**
- **Rail chips are display-only; codex chips are interrogable.** Removes the tap ambiguity between "expand the card" and "tooltip this chip" on touch. The rail gets one honest 44px target; per-item interrogation happens where there is room for it.
- **No outside-tap-to-close.** This is an in-card region, not a popover. Closing on outside tap would fight the DM scrolling the party column or tapping a neighbouring card's HP stepper.
- **One codex open at a time.** Opening card B's codex closes card A's. Prevents the party strip becoming a wall of drawers and keeps scroll offsets predictable during combat.
- **Read-only, always.** No editing surface, no long-press menu, no swipe. Nothing here is destructive, so no undo is required — stated so the implementer does not invent one.
- **Persistence**: `sessionStorage` key `dnd_codex_open` holds the single open slug (or absent). Survives the Story 36b silent auto-reload, so a deploy mid-lookup does not lose the DM's place.

**Accessibility**: rail is a `<button aria-expanded>` controlling a `role="region"` drawer labelled by the rail. Codex chips are `<button>` with `aria-label="Skill: Athletics"` — the same string as the tooltip. `Escape` closes the open codex from anywhere on the dashboard.

---

## 6. Edge cases and empty states

| Case | Behaviour |
|---|---|
| **All three arrays empty** | Region does not render at all — no rail, no hairline, no placeholder. Sparse-first: this character genuinely has nothing to reference, and `↗ Sheet` remains the escape hatch. |
| **Only one cluster populated** | That cluster prints, no count chip. Rail collapses to a single 44px line. Looks finished, not truncated. |
| **Non-caster (`spells: []`)** | No spells count chip in Adventure; in Combat, Skills print on line 2 instead of Spells and there is no count chip at all. The mode swap becomes a no-op for that card — correct, since there is nothing to trade off. |
| **Everything fits within the budget** | No `+N` chips. Rail is a plain, complete list. |
| **A single label longer than one line** (40-char homebrew spell name) | Chip may ellipse — the one permitted ellipsis, because dropping a lone chip would render the cluster empty. `max-width: 100%`, `text-overflow: ellipsis`; full text on tooltip and in the codex. |
| **Skill keys stored lowercase (`athletics`)** | Displayed through a key→label map with proper casing. A key with no map entry renders title-cased from the raw key rather than being hidden — never silently drop data. |
| **Codex content shorter than 320px** | Drawer height is content-driven up to the cap; no empty scroll gutter. |
| **Empty section inside the codex** | Section omitted entirely — no "SPELLS · 0" row. |
| **Character at 0 HP, not fallen** | Rail renders at full opacity. A downed PC's abilities still matter to the table. |
| **FALLEN (3 death-save failures)** | Rail dims to `opacity: 0.55`, codex auto-closes. They cannot act; the reference becomes noise competing with the tombstone strip. |
| **Card is the active initiative turn** | Codex auto-expands per §4.4. |
| **Vellum palette** | Gem chips on cream need verification — `--pal-gem` on vellum is `#4a3418` (dark on light, reads fine), but the 8% gem background wash will be near-invisible. Drop the wash on vellum; rely on border + text. |
| **Polled data changes while codex is open** | Chips animate in/out per §4.6; drawer height re-measures with the same 220ms curve. Scroll position preserved. |

---

## 7. Mode derivation (specified, not left open)

The top-bar `Adventure | Combat` segment only renders **when an active map is loaded** — so `mapMode` alone cannot drive this. Effective mode for the rail:

```
combatMode = (activeMap?.mapMode === "battle") || (initiative.entries.length > 0 && initiative.round > 0)
```

Otherwise Adventure. This mirrors the heuristic the player sheet already uses to auto-switch into session mode, so the app has one shared notion of "we are in a fight." If neither signal is available, Adventure ordering is the default — the safer, more general-purpose layout.

---

## 8. Mobile vs desktop delta

The DM dashboard stacks to a single column below 900px; the party card is the same component at both widths, so the rail's flex-wrap-with-budget behaviour handles this without a breakpoint.

| | 320px | 400px (typical) | ≥1200px desktop |
|---|---|---|---|
| Line budget | 2 lines (unchanged) | 2 lines | 2 lines |
| Printed chips | Fewer fit → more roll into `+N` | Baseline | Marginally more; party column is width-constrained so gains are small |
| Count chip | **Never dropped** — it is the guarantee that all three clusters are represented | same | same |
| Chevron | Same 44px target | same | Also brightens 60% → 100% opacity on card hover |
| Rail chip tooltips | Not available (rail chips are display-only) | — | Hover tooltip, desktop enhancement only |
| Codex | Same drawer, `max-height: min(320px, 45vh)` so it never eats the viewport on a short phone | 320px | 320px |
| Codex chips | Wrap more; 12px floor never reduced | — | — |

Nothing truncates, disappears or reflows into a different structure between widths. The only responsive mechanism is "fewer chips print, the count absorbs the rest."

---

## 9. Relationship to Story 51 (expand for weapons / inventory)

These are one pattern, not two. **Build the codex drawer here in Story 50 as a section-stacked panel; Story 51 adds Weapons and Inventory as two further sections in the same drawer**, below Spells, in the order `Skills → Abilities → Spells → Weapons → Inventory`. The 320px cap with internal scroll is what makes that extension safe — it is why the cap exists now rather than being added later.

This also answers Story 51's own open question (expand-in-place vs. modal drill-in): **expand-in-place, with an internal scroll cap.** A modal would cost the DM their view of initiative and the rest of the party strip — the exact friction Story 51 is trying to remove.

Story 51 should add nothing to the *rail*. Weapons and inventory do not earn resting-card space; their access point is the codex.

---

## 10. Open questions

1. **Mode-dependent cluster ordering** — this brief commits to Adventure = Skills+Abilities, Combat = Abilities+Spells, with the §4.3 swap animation. If you would rather have absolute spatial stability, override to a fixed Adventure layout in both modes; everything else is unaffected. **Recommendation: keep the swap** — the DM initiates the mode change, so the reorder is expected rather than surprising.
2. **Placement** — I moved the region from "below the condition row" to "below the saves strip," forming the reference band. This is a downward move past spell slots. Override if you want it kept adjacent to conditions; the cost is that the volatile combat cluster is then split by a passive surface.
3. **Active-turn auto-expand (§4.4)** — on by default, matching NPC behaviour from Story 23. If the drawer opening under the DM's thumb mid-scroll proves annoying in play, the fallback is a subtle chevron pulse on the active card instead of an auto-open.
4. **DM party projection** — confirm at architecture review that `skills`, `specialAbilities` and `spells` are in the DM variant's whitelist. The card already renders badges, so they should be — but Story 51 will additionally need `weapons` and `equipment`; worth checking in the same pass.
5. **Skill display labels** — needs a `skillKey → "Athletics"` map. Should the codex also show the governing ability (`Athletics (STR)`)? **Recommendation: yes in the codex, never in the rail** — exactly the disambiguation a DM wants when calling for a check, and there is room in the drawer. Flagged because it needs a skill→ability table that may not exist yet.
6. **Rich tooltips** — out of scope per the story; `Type: Name` carries over verbatim. Noted as the known gap it already is.

---

## Implementation hooks

**New component**: `src/features/dmDashboard/characterCard/CapabilityRail.jsx` — owns rail rendering, budget calculation, codex open state, and mode-derived cluster ordering. Composed by `CharacterCard.jsx` between the saves strip and the Tier 2 divider. Props: `{ skills, specialAbilities, spells, combatMode, isActiveTurn, isFallen, slug }`.

**CSS** in `src/features/dmDashboard/characterCard.css`:
`.cap-band` (hairline + wrapper) · `.cap-rail` (min-height 44px, `padding: 7px 12px`, `gap: 5px`, `flex-wrap: wrap`) · `.cap-chip` (20px tall, `padding: 2px 8px`, IM Fell English 12px, `letter-spacing: 0.06em`, `border-radius: 2px`) with `--skill` / `--spell` / `--abil` modifiers · `.cap-overflow` · `.cap-count` (`.label-ui` span + 12px Cinzel numeral) · `.cap-chevron` · `.cap-codex` · `.cap-codex-header` · `.cap-codex-section` · `.cap-codex-label` · `.cap-codex-label.anchor-flash`.

**Keyframes** in `dashboard.css`: `capChipIn` (4.6) · `capClusterSwapOut` / `capClusterSwapIn` (4.3) · `capAnchorFlash` (4.5). Codex open/close is a `max-height` + `opacity` transition, not a keyframe.

**Budget algorithm** (deterministic, no measurement loop): render the two printing clusters into a 2-line flex container with `overflow: hidden`; after layout, hide chips whose `offsetTop` exceeds line 2 and emit a `+N` chip per cluster for the hidden count. Recompute on `ResizeObserver` and on data change. Never ellipse a chip to make it fit — drop it whole.

**sessionStorage**: `dnd_codex_open` — slug of the single open codex, or absent.

**Reduced motion**: one `@media (prefers-reduced-motion: reduce)` block zeroing every transition and animation in the `.cap-*` namespace, matching the existing pattern in `characterSheet.css`.
