# Feature Story: Attack Targeting Flow

**Status**: Implemented
**Source**: RPG Consultant (live-session feedback)
**Prototype**: `design/prototypes/attack-targeting-flow.html`

**Note**: This is a goal/gameplay story only — it decides *what* the targeting interaction is and *why*, not how it looks, animates, or is laid out on screen. Do not treat anything below as a visual spec; that's `design-strategist`'s job next. This story directly supersedes Story 55's "OQ-1" lighter-first-pass inference model (see below) and gives Story 56's spell `role` field an actual point of use at roll time, not just in the merged reference list.

## Goal

Right now, attacking on the map is two disconnected actions: a player rolls dice somewhere in the Combat tab, and separately, someone (usually the DM) applies damage to a token's HP. Nothing in between ever says *who was being attacked* or *with what*. Story 55 worked around this by inferring intent after the fact — whoever holds the active initiative turn is assumed to be the attacker, whoever just took damage is assumed to be the target — which is a reasonable guess for "who," but has no way to guess "with what," so it can't tell a fireball apart from a longsword. That gap is blocking Story 55's planned "Channel" spellcasting visual, which currently has to ship as a generic "Bolt" instead.

This story closes that gap at the source: a player explicitly declares who they're attacking and with what, before they roll, instead of the app inferring it after the fact. Declaring a target is also just a more natural way to play — pointing at the monster you're swinging at is exactly what happens at a physical table, and it's the dominant pattern in mature digital tools (Foundry VTT's whole combat workflow is built around targeting a token first, then rolling against it). This is a small, additive change to the existing roller, not a new combat system: it gives the player a second, map-driven way to arrive at the same pre-filled roll they already get today from tapping a weapon's ATK/DMG button.

## User stories

- As a player, I want to tap the enemy token I'm attacking on the map, then pick which weapon or attack spell I'm using, so my dice roller is set up for that specific attack without me hunting through my weapons list.
- As a player with Extra Attack (or similar features granting multiple attacks per turn), I want to declare a second (or third) attack right after the first resolves — against the same or a different target — without having to back out of the flow and start over.
- As a player, I want to be able to change my mind about who I'm targeting, or back out entirely, before I've actually rolled anything.
- As a DM, I want to see who a player's roll was aimed at and with what (e.g., "Aragorn attacks Goblin 2 with Longsword: 17 to hit") in the shared roll feed, instead of just a bare number, without having to run any new targeting UI myself.
- As a player who plays a pure martial character, I want this to work the same way for my melee attacks as it does for ranged ones, so I only have to learn one way to declare an attack regardless of what I'm swinging.

## Functional requirements

- **Trigger**: on a battle-mode map with tokens placed, a player can select an enemy (NPC) token on the map to begin declaring an attack against it.
- **Attack selection**: after a target is selected, the player is shown their own available attacks — every equipped weapon, plus every `role: "attack"` spell from Story 56's merged Weapons & Attack Spells list — and picks one.
- **Roll setup, not a new roll engine**: choosing an attack pre-fills the existing dice roller (`DiceRoller.jsx`) exactly as if the player had pressed that weapon's existing ATK/DMG quick-roll button. This flow is a second entry point into the roller that already exists, not a parallel rolling system.
- **Explicit confirm to roll**: selecting a target and an attack sets up the roll; it does not roll automatically. The player still takes a final, deliberate action to roll the dice, same as today.
- **Change/cancel before rolling**: the player can change their selected target, change their selected attack, or back out of the flow entirely at any point before confirming the roll, with no penalty and no partial commitment.
- **Declared context travels with the roll**: the target and the chosen weapon/spell are carried along with the resulting roll into the shared roll-history/broadcast feed, so the table (and especially the DM) sees "Aragorn attacks Goblin 2 with Longsword: 17 to hit," not just a bare number attributed to Aragorn.
- **Applies uniformly to melee, ranged weapon, and ranged/touch spell attacks** — the player targets and rolls the same way regardless of range. Only the eventual on-map visual differs, and that's Story 55's job to consume, not this story's job to draw.
- **Multiple attacks per turn**: after a roll resolves, the flow is ready to declare another attack immediately (supporting Extra Attack and similar features) without forcing the player away from the map or back through unrelated navigation.
- **Miss handling is unchanged**: nothing automatic happens to HP on a miss, exactly as today (there is no AC-comparison/auto-resolution anywhere in the app currently, and this story doesn't add one — hit/miss stays a human judgment call). No new "attack missed" visual is introduced by this story, matching Story 55's existing precedent that a miss produces no event.
- **Player-only**: this is a player-facing flow. The DM's existing dice roller and "Apply to…" damage-application pattern are unaffected — the DM already knows who's attacking whom while running the encounter and doesn't need a target-picker to tell them.
- **Only enemy/NPC tokens are valid targets** for this flow in v1 — this is specifically an "attack" flow, matching Story 56's `role: "attack"` framing. Targeting a friendly token (e.g., for a heal-role spell) is explicitly not part of this story.
- **Single target only** — no multi-select for AoE spells. A Fireball-style attack that hits several enemies is still resolved the way the DM already resolves it today: applying damage to each affected character individually. This story doesn't change that, and doesn't need to.
- **Graceful fallback**: when there's no active battle-mode map, or no tokens are placed, none of this applies — the Combat tab's weapon-quick-reference and dice roller behave exactly as they do today. This is a new option layered on top of the existing flow, not a replacement that requires a map to exist.

## Data model changes

- No new persistent character or session field is needed for the in-progress target/attack selection itself — this is transient client-side state (you're mid-declaration, not mid-save).
- The roll-broadcast payload (whatever carries a resolved roll into the shared roll-history feed) needs to optionally carry the declared target's name/identity and the chosen weapon/spell's name, so the feed can render "attacks Goblin 2 with Longsword" instead of a bare total. Exact shape (new optional fields on the existing broadcast vs. something else) is architecture's call.
- No changes to `weapons[]` or `equipment[]`. This story consumes Story 56's spell `role` field as-is; it doesn't add to it.
- No changes to the `maps[].tokens[]` shape — target selection reads existing token data (`type`, `sourceId`) to know which NPC was tapped; it doesn't need to write anything to the token itself.

## Out of scope

- **The "attack-first" alternative flow** (pick a weapon/spell first, then choose a target from the map). The user's own instinct is that target-first is simpler, and it matches the dominant convention in the most mature digital tabletop tools (Foundry VTT's core workflow targets a token first). Not building both entry points in v1 — a caster who wants to check "do I have the slot" before committing to a target already has that answer visible passively, via Story 56's merged Weapons & Attack Spells list and the existing Spell Slots block, without needing a second full flow.
- **Any DM-facing targeting UI.** The DM's dice roller and "Apply to…" pattern are unchanged by this story.
- **Automatic hit/miss resolution** (comparing the roll to the target's AC). Still a human judgment call, same as today.
- **Any new visual or feedback for a missed attack.** Matches Story 55's existing "a miss writes no damage, so there is no event" precedent.
- **Multi-target / AoE selection.**
- **Targeting allies or heal-role spells.** Consistent with Story 56's own deferral of heal-role tracers to a later phase.
- **Range or line-of-sight validation.** The app doesn't police tactical legality of who can attack whom today (a player could physically be nowhere near a token and still declare it as a target), and this story doesn't add that check. Acknowledged, not solved.
- **Automatically applying damage to the target on a hit.** Damage application remains the existing separate step (the DM applies damage manually, whether via "Apply to…," the Damage/Heal modal, or an NPC HP adjustment). This story only carries the declared-target context forward for display and for Story 55/56 to eventually consume — it does not write HP.
- **Any change to the dice roller's actual rolling mechanics, animation, crit/fumble handling, or roll history display.** This story only adds a new way to arrive at an already-existing pre-filled roll.

## Open questions

- Should the DM's "Apply to…" flow eventually read the declared target off a roll-history entry to pre-select or highlight the matching pill, fully closing the loop from "player declared a target" to "DM applies damage to that exact target with one fewer tap"? This is a strong, cheap follow-on but isn't required for this story to be useful on its own — flagging so it isn't lost. **Resolved: deferred (brief OQ-6, 2026-08-06) — tracked as a follow-on story, see "Follow-ups" note above.**
- NPCs don't have a stable per-character identifier the way PCs have a `slug` — they're entries in the `npc-combat` array, keyed by an internal `id`. What identifies a targeted NPC in the roll broadcast/history well enough to survive being renamed, duplicated (Story 24's numbered spawn), or removed mid-encounter? Needs an architecture answer. **Resolved: the feed renders the captured target name at declaration time, never a live lookup; `sourceId` rides along for future consumers and is allowed to dangle (see UX Design above, "The roll feed gets no new row type").**
- What should happen if the declared target is removed from the map (or the map itself changes) between the moment a player selects it and the moment they roll — e.g., the DM removes/kills that NPC mid-declaration? Recommend the pending declaration silently clears rather than allowing a roll to broadcast against a target that no longer exists, but this needs to be decided explicitly. **Resolved: NOT silent — strikethrough + "— GONE" + 1400ms hold, then the bar exits (see UX Design above, "Target removed mid-declaration").**
- The RPG-consultant read here is that melee target ambiguity is genuinely low (you're usually only in reach of one thing), so this flow's real payoff is concentrated on ranged/spell attacks — should melee still get the exact same full interaction for consistency, or a lighter/optional version, given a martial character may be declaring 2–3 melee attacks in a single turn? Recommend consistency (one interaction to learn, not two) but flagging this explicitly for `design-strategist`, since it affects how light-touch the gesture needs to feel. **Resolved: one consistent interaction for all attack types, as recommended — Extra Attack made cheap via sticky target/weapon (two taps per additional attack), not a lighter melee-only mode.**
- Should a spell whose slot is already exhausted still appear as a selectable option in the attack picker (and just fail/warn), or should it be hidden/disabled outright? Recommend disabling it — a player shouldn't be able to select a spell they can't currently cast — but the exact treatment (hidden vs. visibly disabled vs. a warning) is a design call. **Resolved: visibly disabled — spent spell chips show `SLOTS 0` and shake-refuse on tap rather than being hidden or erroring (see UX Design above and brief §3.2/§5).**
- The Map sub-tab already has an existing tap/drag interaction for a player's own token (Story 34 — dragging your own token to move it). Does tapping an *enemy* token to target it need to be interactionally distinguishable from that, or from simply panning/zooming the map? This is a real interaction-design conflict on the same surface and needs to be resolved by `design-strategist`, not assumed away here. **Resolved, superseded 2026-08-06: tap = inspect (unchanged from today) / hold = target on NPC tokens only (8px/500ms thresholds), zero collision with Story 34 since targeting is NPC-only and dragging is own-PC-only (brief OQ-2/OQ-7).**
- Should this flow be available from both the session-mode Map sub-tab and the classic full character sheet's Map tab, or only session mode (where the token/battle-mode layer currently lives per `app-overview.md`)? Recommend session mode only for v1, since that's the only surface with a token layer today, but flagging so it's a deliberate choice rather than an oversight. **Resolved: session mode only for v1 (brief OQ-8).**

Sources: [Foundry VTT — Token Targeting](https://foundryvtt.com/packages/fvtt-token-targeting), [Foundry VTT — Minor QOL (attack-roll-vs-target automation)](https://gitlab.com/tposney/minor-qol/-/blob/99e8b6a08c9048a6b55a4264ac49e793af0ed8ea/README.md)

---

## UX Design

**Brief**: `design/briefs/attack-targeting-flow-brief.md` — the authoritative spec.

**Prototype: recommended — build one, scoped tight.** Unlike Story 56 (list/form UI
assembled from existing patterns), this story's load-bearing decisions are *felt, not
read*: a tap-vs-hold discriminator layered onto a surface that already owns pan,
pinch-zoom, and own-token drag; threshold constants that only thumb-testing validates;
and a four-state bar choreography that is a sequence rather than a layout. Prototype
one map + three NPC tokens + the own token, the reticle, the bar's four states,
retarget-while-armed, and a reduced-motion switch. **Not** roll math, the roll feed,
or the spell editor.

**Tier**: 1 — combat-critical. Present only while a declaration is live.

**Superseded 2026-08-06, after prototype review: the gesture is reversed to
`tap = inspect, hold = target`**, on NPC tokens only. Tap (<500ms, <8px movement)
keeps today's existing detail-card behaviour completely unchanged; hold (≥500ms,
<8px) declares a target instead, committing mid-press the moment the threshold is
crossed; any movement >8px is a map pan, unchanged. The 8px threshold is still the
single most important constant in the design — it is what makes targeting
unambiguous against panning. This is now **strictly additive to existing muscle
memory rather than an inversion of it** — nothing about the tap gesture players
already know changes; only the previously-unused hold gesture gains a new meaning.
Because a 500ms commit-on-hold with no feedback would feel unresponsive, this
required adding a "Reticle charge" affordance (brief §5) — a sweep arc that fills
over the hold window and hands directly into the reticle draw at 100%, so the
gesture is legible while it's happening, not just after. **Zero collision with
Story 34** — targeting is NPC-only, dragging is own-PC-only, and neither can ever
apply to the same token. **Also verified zero collision with the DM's existing
long-press-to-remove/resize gesture** (`BattleModeController.jsx`) — that gesture is
explicitly DM-only and lives on a different persona's view of the shared token
component; it already proves a charging-ring affordance works in this app. Only
armed when `mapMode === "battle"` and the character has ≥1 rollable attack;
otherwise every token behaves exactly as today.

**Confirmation is a four-arc bracket reticle outside the faction ring**, not a
crosshair over the portrait. Gaps at N/E/S/W keep Story 54's `◇` slot and Story 53's
left-edge badge column clear. It lives inside `.token-chip`, so Story 45's
counter-rotation keeps it upright for free. **Tinted with the viewing player's own
`--pal-accent-bright` rather than a universal colour** — every other token-layer
effect colour states a shared truth, but a declared target is *private intent*, and
palette-tinting says "this is mine" at no cost.

**One fixed Attack Bar, not an anchored popover.** A popover chasing a token fights
pan/zoom, lands off-screen at map edges, and occludes the board you just pointed at.
The bar is fixed to the bottom of the session-mode viewport (64px; 72px two-row below
560px), so it never moves under pan, is thumb-reachable, and **survives a sub-tab
switch** — a caster can check spell slots mid-declaration without losing anything.
Four states: **PICK** (target + attack chips) → **ARMED** (chosen chip + `ATTACK`) →
**RESULT/atk** (total + `⚔ DAMAGE` / `↺ AGAIN`) → **RESULT/dmg** (total + `↺ AGAIN`).
That sequence is the literal verbal ritual at a table — "seventeen" / "hit" / "eight
damage."

**Target and attack both stay sticky through a roll.** Extra Attack costs **two taps
per additional attack**, never a re-declaration. Tapping a *different* enemy while
armed retargets and keeps the weapon — the one-tap "same swing, new victim" case.
The declaration deliberately **survives turn changes** (opportunity attacks are real);
only `×`, retarget, target-gone, or leaving session mode clears it.

**Cancel is staged, with a deliberate asymmetry**: in PICK, a background tap or a
second tap on the token clears it; in ARMED/RESULT a background tap does **nothing**
and only the explicit `×` clears. Cheap state is cheap to lose; committed state
requires intent.

**The roll feed gets no new row type.** The existing `RollHistoryRow` action-label slot
carries `Longsword → ◎ Goblin 2` — one new glyph (`◎` U+25CE, used in exactly two
places app-wide), no extra vertical space in an already-dense feed, and the DM sees it
for free because the dashboard renders the same component. **The feed renders the
*captured* target name, never a live lookup** — this answers the story's NPC-identity
question: an entry is a historical statement and must stay correct after the NPC is
renamed, duplicated, or deleted. `sourceId` rides along for later consumers and is
allowed to dangle.

**Target removed mid-declaration is NOT silent** — amending the story's recommendation.
The name strikes through, turns `#c06060`, gains `— GONE`, holds 1400ms, then the bar
exits. Silent disappearance of an element the player is looking at produces the "I
tapped Roll and nothing happened" mystery for zero benefit. Triggered after **two**
consecutive poll ticks of absence, so one degraded response can't flicker the bar out
mid-turn. An NPC going Invisible (Story 54) takes the identical path for free.

**Write path is the existing `postCharacterRoll` broadcast plus two optional fields
(`target`, `attack`).** Zero new endpoints, zero `patchSession` writes, zero polling
cost. The declaration itself is transient client state and is deliberately **not**
written to `sessionStorage` — a declaration restored after a reload is a lie about a
board that has moved on.

**Two hard gaps found in Story 56 — this is the blocker (OQ-1).** Story 56's spell
shape (`{ id, name, role?, description? }`) means an attack spell in this picker has
**nothing to roll** and **no way to know whether its slot is spent** — this story's
"disable exhausted spells" requirement is literally unimplementable as specced.
**Recommendation: add `level?: number` (0 = cantrip), `toHit?: string`, and
`damage?: string`** as three inputs in Story 56's *existing* role drawer. This narrowly
reverses Story 56's OQ-2; that objection was "adding the mod editor pulls
`ItemEditorModal`'s weight back in," and two freeform expression fields parsed by the
existing `parseDiceExpr` are not that. Graceful degradation is specced at every level
of data completeness, so Story 56 can still ship first unchanged.

**Important cross-reference — this does NOT close Story 55's Architect risk #4.** It
captures `attack.kind` at *roll* time, but Story 55's tracer fires off a
*damage-apply*, which still carries no item reference. The cheapest path to Channel is
a correlation window (declared spell attack against `sourceId` within ~20s of a
damage-apply to that same `sourceId`) — flagged for a later story, not built here.
Story 55 should still ship Bolt-only.

**Follow-up confirmed (2026-08-05):** Story 55 has been approved to build with this
exact scoping — Bolt-only for v1, Channel cut entirely rather than degraded-to at
runtime (see Story 55's Architect Notes, Risks/decisions #4, Resolved). Once *this*
story ships and lands its spell-shape amendment (`level`/`toHit`/`damage` on
`role: "attack"` spells, OQ-1 above), the data Channel needs will exist for the first
time. **Action item for whoever picks this up next:** open a small follow-on story
to add the Channel visual to Story 55's tracer, keyed off the correlation-window
approach described above — do not fold it back into Story 55 or reopen that story's
scope.

**All open questions resolved 2026-08-06** (brief §12): OQ-1 through OQ-8 all
approved as recommended. Two additions came out of approval and are specced in the
brief's §3.4 and §5 — both reuse existing `DiceRoller.jsx` mechanics rather than
inventing new roll logic:

- **Editable roll expression + Adv/Dis in the bar** (out of OQ-3): the chosen
  chip's loaded dice expression (e.g. `1d20+7`) is tap-to-edit, reusing the
  roller's existing `exprInput`/`parseDiceExpr`; a compact Advantage/Disadvantage
  strip (ATK step only) reuses the roller's existing `advMode`. Covers DM
  house-rule modifiers the sheet doesn't capture.
- **Full-viewport roll overlay** (out of OQ-4): landing a roll from this flow also
  plays a large centred number-reveal overlay (reusing the roller's cycling-number
  mechanic at scale), in addition to — not instead of — the bar's own line-item
  result. "Treat it like a big event for the player."

**Follow-ups tracked, not built here:**
- **OQ-5 (DM shared reticle)** and **OQ-6 (DM Apply-to pre-selection)** were both
  deferred with an explicit ask to be reminded — flag both as candidate follow-on
  stories once this story ships and `target.sourceId` is flowing through the roll
  feed. OQ-6 in particular is recommended as "~10 lines" once that data exists.
- The Story 55 Channel-visual follow-up noted above (once this story's spell-shape
  amendment lands).

**Prototype built (2026-08-06)**: `design/prototypes/attack-targeting-flow.html`.
Covers the full interactive flow on a live demo (one map, three NPC tokens — Goblin 1,
Goblin 2 downed at 0 HP, Bandit Captain — plus Eoghan's own token): the tap-vs-hold
gesture discriminator with a live elapsed-ms/moved-px HUD, the four-arc reticle
(entrance/rest/clear per §5's timing), all four bar states plus the editable-expression
+ Adv/Dis strip (§3.4), the full-viewport roll overlay with cycling-number settle and
crit/fumble reuse (§5), retarget-while-armed, the GONE sequence (§5/§8), and a manual
reduced-motion toggle switch demonstrating the §6 alternate treatment end-to-end. Also
covers edge cases #1–#2 (targeting-disarmed toggles), #4 (downed target), #7 (turn
persistence), #8 (sub-tab survival), and #9 (map rotation) via dedicated debug
controls, plus a static reticle-anatomy close-up, a states-at-a-glance reference strip,
and the §9 size-degradation ladder. Two implementation ambiguities are flagged inline
(HTML comment + on-page note) per the brief's own instruction to implement the most
reasonable interpretation rather than block. Ready for `code-architect`.

**Gesture reversed post-review (2026-08-06):** after using the prototype, the
decision on OQ-2 (§7.1) is reversed — **tap = inspect (unchanged from today),
hold = target**, not the original tap = target / hold = inspect. This keeps every
player's existing tap-to-inspect muscle memory completely intact and adds targeting
only on a gesture that had no prior meaning on the player's map. The reversal
required a new "Reticle charge" affordance (brief §5) — a sweep-arc progress
indicator during the hold — since a 500ms commit gesture needs feedback while it's
happening, not just a result at the end. The brief (§3.1, §5, §6, §7.1, §7.2) and
this story's UX Design section above are updated to match. **The prototype itself
still reflects the old tap=target/hold=inspect mapping and needs a follow-up
`ux-designer` pass to swap the gesture discriminator (lines ~974–1040 of
`attack-targeting-flow.html`), add the charge-sweep visual, and update the Section 4
gesture-table explainer before this goes to `code-architect`.**

---

## Architect Notes

**Applies**: ADR-026 (roll provenance — written for this story), ADR-027 (single roll
engine — written for this story), ADR-028 (token gesture layering — written for this
story), ADR-025 (spell `toHit`/`damage` formats — consumed as decided, not
re-litigated), ADR-024 (`normalizeSpells()` tolerance), ADR-021 (`.token-chip`
transform chain / CSS file location), ADR-015 (roll-history additive fields),
ADR-011, ADR-014, ADR-005.

**Build note before anything else — the prototype is stale on exactly one point.**
`design/prototypes/attack-targeting-flow.html` implements the **old**
tap=target / hold=inspect mapping and was deliberately never updated (the follow-up
`ux-designer` pass was cancelled to save tokens). **Brief §7.1 and this story's
"Gesture reversed post-review" note are authoritative: tap = inspect, hold (≥500ms)
= target.** Everything else in the prototype — Attack Bar states, reticle anatomy,
roll overlay, size-degradation ladder, GONE sequence, reduced-motion toggle — is
accurate and is good reference. Do not read the prototype's gesture-handling JS
(~lines 974–1040) at all; implement the discriminator from the brief.

### Tech approach

**The roll path is a lookup, not a second engine — and the wiring already exists.**
Per ADR-027: `DiceRoller` is already a `forwardRef` with
`useImperativeHandle(ref, () => ({ rollAbility }))` (`DiceRoller.jsx:241`), and
session mode **already holds `diceRollerRef`** and mounts the roller at
`CharacterSheetSessionMode.jsx:1247` — *outside* the sub-tab panels, so it stays
mounted across sub-tab switches. Add `rollAttack` to that same handle. No lifted
state, no new hook, no fork of `executeRoll`.

Per ADR-025, a weapon and a spell collapse into one shape here — `toHit` is a signed
bonus (`"+7"`), `damage` is a dice expression (`"2d6+3"`), matching the `"Attack
Bonus"` / `"Damage"` mod values verbatim. So the bar's ATK step is
`executeRoll({ groups:[{count:1,sides:20}], flat: parseInt(toHit), isD20Attack:true })`
and the DMG step is `parseDiceExpr(damage)` → `executeRoll` — literally what
`rollWeaponAtk`/`rollWeaponDmg` already do at `DiceRoller.jsx:220–231`. **Consume
Story 56's `buildAttackEntries({ weapons, spells })`** (Story 56's Architect Notes)
for the chip list rather than re-deriving the merge — it already returns
`{ id, kind, name, toHit, damage, description }` in weapons-then-spells order, which
is exactly the bar's chip order (brief §3.2).

**Three concrete traps in `executeRoll`, all of them will bite:**

1. **`advMode` is closed-over state used in two places** — the dice logic
   (`:139`) *and* the `modeTag` appended to the broadcast label (`:198`). The bar's
   Adv/Dis strip must pass its mode as a **parameter** so both sites see it
   (ADR-027 rule 1). Override only the dice logic and `(adv)` silently vanishes
   from the shared feed.
2. **`executeRoll` returns nothing and resolves ~1050ms later** via `setRollState`.
   The bar needs `{ total, dice[], crit, fumble }` to render RESULT and to drive the
   overlay's settle, so pass an explicit completion callback in the parameter object.
3. **`if (rollState.rolling) return;` early-returns silently** (`:127`). Tap ATTACK
   while any roll is in flight and *nothing happens* — the bar would sit in ARMED
   forever. Disable the roll buttons while a roll is in flight; do not let this fail
   open.

Also note `executeRoll` calls `ensureOpen()`, which force-opens the roller panel and
writes `dnd_dice_open_${slug}`. Rolling from the Map sub-tab will therefore pop the
roller open in the right column. Decide deliberately — suppress it via a parameter
(recommended) rather than reordering state.

**The gesture — ADR-028, and the brief's framing needs one correction.** Brief §7.1's
table implies a dispatch ("movement >8px → map pan"). In reality `TokenChip` uses
**Pointer** events and `MapViewer`'s pan/pinch uses **Mouse/Touch** events on an
ancestor; both fire, independently, and already coexist (that is how the DM
long-press works alongside pan today). So the 8px rule is purely a **cancel**
condition on the chip's own timer — there is nothing to hand off to, and no routing
code to write. Concretely, in `BattleModeController.jsx`:

- `handlePointerDown` currently early-returns for a player on an NPC token
  (`if (!isDm || isHeld) return;`, `:570`) — that line is the insertion point.
  `canDrag` (`:309`) is own-PC-only, so **there is no possible collision with Story
  34**, exactly as the brief says.
- **Do not set `panSuppressedRef`** (ADR-028 #2) — that is the drag's mechanism and
  setting it would break pan-started-on-a-token.
- **Set `suppressClickRef.current = true` when the hold commits** (ADR-028 #3), or a
  completed hold fires targeting *and* the click path.
- Track distance from the pointerdown origin in a ref and test it in
  `handlePointerMove`; **do not** cancel via `onPointerLeave` (ADR-028 #5). Note the
  existing DM long-press has **no** movement threshold at all — it relies on
  pointer-leave — so the 8px logic is genuinely new and cannot be copied from it.
- `LONG_PRESS_MS = 480` already exists (`:220`). The brief's 500ms is 20ms away from
  it; ship 500ms as a **separately named constant with a comment on why it differs**
  (ADR-028 #6), or the two will drift.

**The charge sweep is cheaper than the brief thinks.** `.token-longpress-ring`
(`battleMode.css:776–806`) is a `stroke-dashoffset` CSS transition on a circle —
setting `transition-duration` to the hold threshold makes it a 1:1 elapsed-time
progress meter with **zero JS**, no `requestAnimationFrame` loop. Copy the
mechanism, new class name. Note that block's reduced-motion rule is
`display: none` (`:1723`), so the player charge needs its own class to get §6's
static-dot treatment instead of vanishing.

**Reticle goes inside `.token-chip`** (brief §3.1) — correct per ADR-021: it inherits
Story 45's counter-rotation and stays upright on a rotated map with no correction.
New classes and keyframes go in `battleMode.css`; **do not create `tokens.css`**
(ADR-021).

**Write path — ADR-026.** `postCharacterRoll` gains two optional structured fields,
`target` / `attack`. **Do not bake the target into `label`**, even though that would
need zero backend change (`postCharacterRoll.js:22` stores `label` verbatim and
`RollHistoryRow:69` already renders it) — the two named follow-ons (DM Apply-to
pre-selection, Story 55's Channel correlation) need `sourceId` as data. `label` stays
`"Longsword ATK"` + the `(adv)` tag. Backend is ~4 lines in
`postCharacterRoll.js` mirroring the existing optional-field style of
`isCrit`/`isFumble`; `buildRollHistoryPayload` in `src/lib/rollHistory.js` gains the
same two pass-throughs using its established `if (…) payload.x = …` pattern.

**Correction to brief §8's feed mock-up.** It shows one flat row
(`2d6+1d4  Aragorn  Longsword → ◎ Goblin 2  [14] +3  17`). The real
`RollHistoryRow` is **two lines**: line 1 is the italic uppercase action label, line 2
is `characterName` + `exprLabel` (`RollHistoryList.jsx:91–142`). The declaration
belongs on line 1, appended after the action label. Render it from
`entry.target`/`entry.attack`, not by parsing `label`. The DM feed gets it for free —
same component.

**Declaration state lives in `CharacterSheetSessionMode`** (brief §11), passed down as
`targetedTokenId` + `onTargetToken` through `PlayerMapViewer` into `TokenChip`.
Transient only — **never `sessionStorage`**, per brief §8. The sub-tab panels use a
CSS `.active` class and all stay mounted (`:1222`), so both the bar and the reticle
survive a sub-tab switch with no extra work (edge case #8 is free).

### Scope boundary

**In**: `AttackDeclarationBar.jsx` (four states, editable expression per §3.4,
Adv/Dis strip on the ATK step only); the hold discriminator + `.tk-target-ring` +
charge sweep in `BattleModeController.jsx`/`battleMode.css`; `rollAttack` on
`DiceRoller`'s existing imperative handle + the three `executeRoll` parameter
overrides above; `RollOverlay.jsx` (§5, Attack-Bar-only); the two optional fields
through `api.js` → `postCharacterRoll.js` → `RollHistoryRow`; the GONE 2-tick
liveness check; the size ladder (§9); the reduced-motion table (§6); `.cs-atk-*` CSS
in `characterSheet.css`.

**Out** — and note the story's own Out of scope list and brief §10 are both
load-bearing, restated here only where implementation would drift:
- **Any HP write.** This story carries context for display; damage application stays
  the DM's existing separate step. No auto-apply on hit, ever.
- **Any hit/miss adjudication or AC comparison**, and no miss visual.
- **Multi-target / AoE selection**, targeting allies, or heal-role spells.
- **Range or line-of-sight validation** (edge case #3 — the player's own token need
  not even be on the map).
- **Any DM-facing targeting UI**, including the shared reticle (OQ-5) and Apply-to
  pre-selection (OQ-6). Both deferred, both explicitly asked to be re-raised later.
- **Any change to the roller's own panel** — no per-spell ATK/DMG buttons, no change
  to its mechanics, animation, crit/fumble treatment, or its own history rows. The
  overlay is Attack-Bar-only (§5 non-goal).
- **Story 55's Channel visual.** This story does **not** close Story 55's Risk 4;
  the tracer still fires off a damage-apply that carries no item reference. Separate
  follow-on, correlation-window based. Do not reopen 55.
- **Attack-first entry** (pick weapon, then target). One entry point in v1.
- **The classic sheet's Map tab** — session mode only (OQ-8).
- **No new `type` on roll-history rows** (ADR-015 stays a two-variant branch).
- **No `postDmRoll` change.** Player-only.

**Sizing — split this.** It is the largest of the recent cluster and has two cleanly
separable halves:

- **57a — declare and roll**: gesture + reticle + charge, bar PICK/ARMED, `rollAttack`
  on the handle, the two broadcast fields, the feed row. This is the whole story's
  gameplay value.
- **57b — the flourishes**: `RollOverlay.jsx`, the editable expression, the Adv/Dis
  strip, RESULT/`↺ AGAIN` stickiness.

57a is shippable and testable alone; 57b is polish on top and is where the schedule
risk lives (the overlay is a new full-viewport surface reusing a mechanic that is
currently private to the roller). If the pass runs long, cut 57b, not scope inside
57a.

### Performance notes

- **The 2-tick liveness check must not scan on every render.** Derive it from the
  polled `activeMap.tokens[]` in one `useMemo` keyed on the token id list, with the
  consecutive-miss count in a ref. `PlayerMapViewer` is already `memo()`'d and
  `visibleTokens` is already memoised (`:1487`) specifically so `TokenChip`'s `memo()`
  holds — a new prop that changes identity every tick would defeat both. Pass
  `targeted` as a **boolean per chip**, not the declaration object.
- **`onTargetToken` must be a stable `useCallback`**, same reason.
- The charge sweep is a CSS transition on `stroke-dashoffset` — not
  compositor-accelerated, but it is one element, ≤500ms, at most one at a time. Fine.
  The rest-state breathe is an infinite `opacity` animation on **one** token; keep it
  to opacity only and never add it to more than the targeted chip.
- **The roll overlay is the one real cost.** It reuses the roller's 90ms
  `setInterval` cycling number at ~25vh. Cap it at one instance, mount only while
  playing, unmount on dismiss — no `will-change` at rest, nothing in the DOM when
  idle.
- The chip list is ≤ ~20 entries and lives in a fixed bar; do not memoise rows.
- The bar is `position: fixed` — adding `padding-bottom` to the session scroll
  container on mount (brief §3.2) will reflow the column. Set it as a CSS var toggled
  by a class, not by measuring the bar.

### Cost notes

**Zero new AWS resources, zero new endpoints, zero new writes, zero added polling.**
This is a strictly additive-fields story on an existing fire-and-forget broadcast
that the player already sends on every roll. Payload grows by ~80 bytes on rolls that
carry a declaration; `roll-history` is a capped sentinel so there is no growth in
stored size beyond that. No `patchSession` write, no new sentinel, no projection
widening — the target is read from `activeMap.tokens[]`, which is already on
`GET /session-state`. Nothing here moves the needle on the free-tier request quota
that ADR-011's amendments exist to protect.

`postCharacterRoll` is already unauthenticated (ADR-005 unchanged, brief §13). Note
the consequence, which is pre-existing and not worsened: the two new fields are
client-supplied and unvalidated beyond type/length, so a crafted request could
attribute a declaration that never happened. At this trust model that is the same
exposure the existing `label`/`total` already carry. **Bound both strings (name ≤ ~60
chars) in the handler** so they can't be used to bloat the sentinel.

### Dependencies

**Story 56 must land first — and it can be built against 56's *decided architecture*
rather than waiting for 56 to be feature-built.** Story 56's Architect Notes fix the
exact seven-field spell shape, and ADR-024/ADR-025 fix the semantics
(`toHit` = signed bonus, `damage` = dice expression, `level` absent ≠ 0). Those are
settled decisions, so this story can be *written* against them safely. But it cannot
**ship** first: without 56, `role: "attack"` spells don't exist, `buildAttackEntries()`
doesn't exist, and the spell half of the picker has nothing to read. Build in
dependency order — 56, then 57 — which is what was asked for.

Concretely, from Story 56 this consumes, unchanged: `role: "attack"`,
`normalizeSpells()`, `buildAttackEntries()`, the weapons-then-spells order, the `✶`
glyph, and `level`/`toHit`/`damage`.

**Two of Story 56's open risks land directly on this story's correctness:**
- **56's Risk 1 (`level` and the `|| 0` trap).** If an unspecified level is coerced to
  `0`, every spell reads as a cantrip and this story's "disable exhausted spells"
  requirement never disables anything. This bar is the *only* consumer of `level`, so
  the bug is invisible until 57 ships.
- **56's Risk 2 (`toHit` is a bonus, not an expression).** If it ships as
  `"1d20+7"`, the ATK step forks away from `rollWeaponAtk` and ADR-025's one-roll-path
  premise is gone.

**Also depends on** Story 54 having shipped (invisible NPCs are absent from the player
payload, so they are untargetable by construction and take the GONE path for free —
already true) and ADR-021's wrapper chain (already in place).

**Does not depend on** Story 55, and must not reopen it.

### Risks / decisions needed

1. **The brief's "tap = inspect, unchanged from today" is factually wrong, and this
   needs a decision before build.** Verified: the token detail card (`expanded`) is
   triggered **only** by `onMouseEnter` with a 120ms delay
   (`BattleModeController.jsx:421`). `onTokenClick` is never passed by
   `PlayerMapViewer` — so on the player's map, **tap on an NPC token does nothing
   today, and on touch there is no way to see the detail card at all.** The reversal's
   *safety* argument survives intact and is actually stronger than claimed (there is
   zero existing tap behaviour to regress). But row 1 of §7.1's table describes
   behaviour that does not exist. Two options: **(a)** leave tap as a no-op — truly
   zero-risk, ship hold=target only, and touch users still have no detail card
   (status quo); or **(b)** additionally wire tap→expand, which is genuinely new work
   and arguably its own small story. **Recommendation: (a)**, and note (b) as a
   follow-on. Do not let the implementer discover this mid-build and guess.
2. **Hold on desktop will pop the hover detail card over the token you are
   targeting.** The mouse is over the chip, so the 120ms hover timer fires ~380ms
   before the hold commits, and the card then sits over the reticle until
   mouseleave. Fix is the established one-line precedent at `:424`
   (`if (resizeActive) return;` — Story 44 does exactly this): suppress hover-expand
   while a target charge is active. Confirm this is wanted; it is the difference
   between the gesture feeling clean and feeling like a glitch.
3. **Confirm the 500ms/480ms near-collision.** Brief OQ-7 says ship 500ms as
   specified, but `LONG_PRESS_MS = 480` already exists two functions away. Two
   long-press thresholds 20ms apart in one component is a maintenance trap.
   Recommendation: ship 500ms as its own named constant with a comment; reject
   reusing 480 (the DM gesture may want to be retuned independently).
4. **Confirm structured `target`/`attack` fields over the baked-label shortcut**
   (ADR-026). Baking the string into `label` is ~4 lines total with **no** backend and
   **no** renderer change, versus ~30 lines for the structured path — a real
   temptation. Recommendation: structured, because both named follow-ons need
   `sourceId` as data and the alternative is regexing a display string later.
5. **Confirm the 57a/57b split** above, and specifically whether the full-viewport
   roll overlay is in the first build. It is the single largest new surface in the
   story and the only part that isn't reuse of something already working.
6. **Most likely implementation failure: the trailing click and the double-fire.**
   A committed hold that forgets `suppressClickRef` fires targeting and the click
   path together; and because pointer and mouse/touch families both fire, a
   half-implemented threshold check produces a token that targets *and* pans. Test
   on real touch, not just a desktop mouse — and test at all four map rotations
   (edge case #9), which is the failure mode that looks fine unrotated.
7. **Second most likely: silent no-op on ATTACK** via `executeRoll`'s
   `if (rollState.rolling) return;`. Disable the button while rolling; do not leave
   the bar armed with no feedback.

---

## Implementation Notes (2026-08-10)

**Built**: the full gesture (tap = inspect unchanged, hold ≥500ms = target, 8px
cancel), the charge-sweep + reticle on `TokenChip`, the four-state
`AttackDeclarationBar.jsx` including the editable roll expression and Adv/Dis
strip (§3.4), `RollOverlay.jsx` (§5), `rollAttack`/`getAttackExpr`/`advMode`+
`setAdvMode` added to `DiceRoller`'s existing imperative handle (ADR-027, no fork
of `executeRoll`), the two optional `target`/`attack` fields threaded through
`postCharacterRoll` → `RollHistoryRow` (ADR-026), the GONE 2-tick liveness check,
the size-degradation ladder (§9), and the reduced-motion table (§6). `buildAttackEntries()`
gained `level` pass-through for spells (previously omitted), needed for the
"disable exhausted spell" slot check.

**Known implementation-level simplifications** (flagged for follow-up, not
silently dropped):
- **Tap-to-recenter the map on the target name** (brief §7.2's "Target name |
  Tap (44px) | Map re-centres on the target token") was **not** implemented —
  `PlayerMapViewer`'s pan/zoom view state isn't exposed outside that component
  today, and adding a recenter API was judged out of proportion to this story's
  gameplay value. The target-name button is present but currently a no-op tap.
- **Reticle exit animation** (§5's 140ms scale+fade "Reticle clears") was
  simplified to an instant unmount — the GONE path (which is the case that
  actually needs to not be silent) still gets its full 1400ms hold +
  strikethrough treatment; a plain retarget/cancel losing its old reticle
  instantly is a minor polish loss, not a comprehension problem.
- **Reticle geometry** uses a dasharray-gapped circle (matching the codebase's
  existing `.tk-veil-ring`/`.token-longpress-ring` technique) rather than four
  hand-authored SVG arc paths — visually equivalent, cheaper to get right.
- **Tap→inspect on the player's map** (Architect Risk #1, option (a)) was left
  as a no-op, per the architect's explicit recommendation — no new scope was
  added to wire tap→expand on touch.

**Follow-ups confirmed still open, not built here**: OQ-5 (DM shared reticle),
OQ-6 (DM Apply-to pre-selection), and Story 55's Channel visual (now unblocked
data-wise by this story's `level`/`toHit`/`damage` fields, but still needs the
correlation-window logic described in this story's UX Design section above).
