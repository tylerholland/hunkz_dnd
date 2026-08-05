# Feature Story: Token Damage Flash

**Status**: Implemented
**Source**: RPG Consultant (live-session feedback)
**Prototype**: `design/prototypes/token-effects-review.html`

**Note**: This is the first of a four-story cluster (Stories 52–55) covering visual effects and symbology on map tokens. This story defines only the gameplay trigger, duration, and visibility rule — a `design-strategist` pass is the planned next step for the actual visual treatment (flash color, glow style, animation timing). Do not treat anything below as a visual spec.

## Goal

Right now, damage lands on a character or NPC and the only place it's reflected is a number changing on an HP bar — on the party card, or on the character's own sheet. On the shared battle map, where everyone's attention is during a fight, nothing draws the eye to "that token just got hit." A brief, noticeable visual cue on the token itself — visible to everyone looking at the map — makes damage register as an event in the moment it happens, not just a number you might notice later if you happen to glance at HP totals.

## User stories

- As a player, when any token on the map takes damage, I want that token to visibly flash/glow so I immediately notice something happened to it, even if I'm not staring at HP numbers.
- As a DM, I want the same cue on my map view, so I can track who's been hit during a chaotic multi-token fight without cross-referencing party cards.
- As a player or DM, I want the effect to fade or clear on its own once the fight has moved past that token's next turn, so the map doesn't stay cluttered with stale "you were hit" indicators from three rounds ago.

## Functional requirements

- **Trigger**: a token's associated character or NPC takes damage — i.e., its current HP decreases. (Healing, temp HP changes, and non-damage HP adjustments should not trigger this — this is specifically a "you got hurt" cue, not a general "HP changed" cue.)
- **Duration**: the effect persists until that token's next turn comes up in the initiative order. This ties the cue to something everyone already tracks (initiative), so "still flashing" reads as "hasn't acted since being hit" and clears naturally as combat progresses. If the token isn't in initiative at all (no active combat, or an off-turn NPC), the effect should still clear after a reasonable fixed window rather than never fading — noted as an open question below for exact behavior.
- **Scope**: applies to both PC and NPC tokens, on both the DM's map and the player-facing map.
- **Visibility**: this effect should be visible to everyone who can already see that token (no additional visibility restriction beyond who already sees the token today).
- **Reads from**: the same HP data already driving HP bars/numbers elsewhere in the app (`hpCurrent` for characters, `hpCurrent` for NPC combat entries) and the same initiative state that already drives "whose turn is it."

## Data model changes

Likely needed: some lightweight way for the server/session state to record "this entity was damaged at time X" so that all connected viewers (DM and every player) see the same flash state in sync, rather than each client trying to infer "was there a recent HP decrease" purely from polling deltas. A candidate shape: a `lastDamagedAt` timestamp (or similar) tracked per character and per NPC combat entry, cleared/reset when that entity's initiative turn becomes active. Exact field name and mechanism is an implementation decision for architecture — flagging here only because the "syncs across all viewers" requirement likely can't be done purely client-side with the existing data.

## Out of scope

- The actual visual design of the flash/glow (color, intensity, animation curve) — that's the design-strategist's job next.
- Damage number pop-ups / floating combat text (a related but separate idea, not requested here).
- Distinguishing damage type visually (e.g., fire vs. cold) — out of scope unless folded in during design.

## Open questions

- What should happen when there's no active combat (no initiative round running) — does the flash just use a fixed timeout (e.g., a few seconds) since there's no "next turn" to clear on?
- What happens if the token is removed from the map or the encounter ends while the flash is still active — does it just quietly stop mattering, or does state need explicit cleanup?
- Should multiple hits before the next turn "renew" the flash duration, or just keep the existing one going?

---

## UX Design

**Brief**: `design/briefs/token-damage-flash-brief.md` — dedicated Story 52
implementation spec. It supersedes `design/briefs/token-effects-symbology-brief.md`
§5 wherever the two differ; the cluster brief remains authoritative for the shared
layer budget (§4) and composition rules (§8) that Stories 53–55 also depend on.

**Key decision — the story's single "flash" is split into two phases with
different volumes.** A literal flash persisting until the next turn would be a red
alarm sitting on the board for 60+ seconds across multiple tokens, and would drown
Stories 53–55.

- **Phase A — IMPACT** (Tier 1, ~450ms): shockwave ring expanding 100%→165% in
  `#e06060`, an impact recoil (`scale 1→0.92→1.045→1` — deliberately the inverse
  of Story 29's drop-bounce so the two never read as the same event), and an
  edge-weighted red portrait wash. Two intensity tiers: Standard (<25% `hpMax`)
  drops the shockwave and runs 300ms; Heavy (≥25% `hpMax`, or crossing below 20%
  HP, or reducing to 0) plays all three.
- **Phase B — WOUND** (Tier 2, persists to next turn): a 1.5px `#c06060` halo ring
  outside the token's black outline at 0.7 opacity, breathing 0.5↔0.85 over 2.6s,
  plus a soft glow bloom. Chosen over a badge because ring treatments survive the
  size-degradation ladder below 12px, cost zero badge-orbit real estate (fully
  claimed by Story 53), preserve the faction ring underneath, and cannot be
  confused with FALLEN (which is inset + desaturated + 0.4 opacity).

**Phase B has a second justification beyond "hasn't acted yet":** the map is
pannable, so any viewer may simply not have been looking when Phase A played.
Phase A is lossy; Phase B is the recoverable record.

**Three amendments to the cluster brief** (details in the dedicated brief §2.3):
1. The recoil gets **its own transform-only wrapper element** (`.tk-hit`) between
   the position wrapper and `.token-chip`. It must NOT animate `.token-chip`'s
   transform — that transform is fully claimed by Story 45's counter-rotation and
   Story 44's size multiplier, and a keyframe would silently drop both.
2. The wash uses **plain alpha compositing with an edge-weighted radial gradient**,
   not `mix-blend-mode` — predictable on every portrait, palette and terrain.
3. Below 24px effective token size, **Standard hits are promoted to the Heavy
   treatment** — the recoil is the first element to become imperceptible and the
   shockwave is the last, and 12–20px effective is the everyday mobile case.

**Story open questions resolved:**
- *No active combat* → fixed **12s** window measured against `serverTime`, then
  the same 400ms fade.
- *Multiple hits before next turn* → each hit **re-fires Phase A from frame 0
  (interrupt, don't queue) and resets Phase B's anchor.** Most recent hit is the
  one that matters; stacking adds no information.
- *Token removed / encounter ends* → all four elements are children of the token
  and unmount with it. **No cleanup state required.** A stale `lastDamagedAt` is
  harmless and must not be treated as an error.
- *FALLEN tokens* → Phase A still fires (damage at 0 HP drives death saves);
  Phase B is suppressed (a corpse being "recently hurt" isn't actionable).

**Sync model (the part that will make or break this at the table):**
- Requires per-entity **`lastDamagedAt`** (server clock) **and
  `lastDamageAmount`** (needed for the intensity tier and the hover-card line).
  All age arithmetic uses the **`serverTime`** already on `GET /session-state` —
  never `Date.now()`, or a clock-skewed phone never flashes.
- **Freshness gate:** Phase A fires only if the stamp is **≤4s** old and newer than
  what this client last rendered. Otherwise the token shows Phase B only. This is
  what prevents every tab-return and map switch from replaying old impacts.
- **Never fire Phase A on a token's first paint** (same rule as Story 29b's
  poll-move glide).
- **AoE batching:** ≥2 new stamps in one payload stagger **70ms apart** in a stable
  order; beyond 6 tokens the overflow plays wash-only. Simultaneous bursts read as
  a rendering glitch, a sweep reads as one blast.
- **Recommendation to architecture:** the **server clears the stamp on
  turn-advance-into-entity**. A client-derived clear can't be consistent for a
  viewer who joined mid-combat, which defeats the story's sync requirement. Note
  "on the transition into the turn" — so damage taken during your own turn
  correctly persists to your next one.
- **Every damage path must stamp it** (±1 stepper, Damage/Heal modal, dice-roller
  "Apply to…", NPC HP writes), or the DM learns that "some buttons animate."

**Composition:** damage owns the new `.tk-hit` wrapper, the ring stack's outer halo
slot, and the ephemeral burst layer. **It never touches the badge orbit.** All four
elements are `pointer-events: none` — the shockwave extends 65% beyond the chip and
would otherwise swallow taps meant for adjacent tokens and break Story 34's player
drag and Story 29b's 480ms long-press. When an attack tracer fires with it (the
common case), Story 52 exposes a **60ms start delay** so Story 55 can choreograph
them as **one event in two beats**, not two animations.

**Reduced motion:** Phase A is replaced by **one static hot rim held 900ms** on the
same halo element, then settled to the resting appearance. The halo stays, static
at 0.7. Motion may be removed; meaning may not.

**Flagged for approval:** two intensity tiers vs. one uniform treatment (brief
OQ-1); the 12s out-of-combat window (OQ-2); temp-HP-absorbed hits showing nothing
in v1 vs. a recoil-only "deflect" beat (OQ-3); the hover-card
`◦ Took 7 — hasn't acted` line (OQ-4); the 4s freshness gate (OQ-10); and the note
that **the classic full sheet's Map tab has no token layer at all, so this feature
won't appear there** (OQ-6).

---

## Architect Notes

**Applies**: ADR-021 (token DOM restructure — prerequisite), ADR-022 (damage stamps
on existing records), ADR-011 + ADR-019 (polling + WS nudge), ADR-014 / ADR-001
(CSS), ADR-003 (schemaless DynamoDB, additive fields).

### Tech approach

Two halves, and the backend half is far smaller than the brief implies.

**Backend — one handler change covers every PC damage path.** Do **not** enumerate
client call sites. Every PC HP write in the app already funnels through
`PATCH /characters/{slug}/session` → `backend/src/handlers/session.js`:

| Client path | Route |
|---|---|
| DM card ±1 stepper / hold-repeat (debounced flush) | `CharacterCard.jsx:163` → `patchSession({ hpCurrent })` |
| `DamageHealModal` (stepper, presets, direct input) | same flush |
| DM dice roller "Apply to…" pill | `DmDashboardPage.jsx:428 handleApplyDamage` → `cardOpenFnsRef` → same flush |
| Bulk party updates (rests, etc.) | `DmDashboardPage.jsx:329 commitPartySessionUpdates` → `patchSession` |
| Player's own sheet (Combat tab, session mode) | `patchSession` |

`session.js` **already does a `GetCommand` for the character before writing**
(line 36), so the previous `hpCurrent` is in hand for free. Add: if `body` carries
`hpCurrent` and it is strictly less than `result.Item.hpCurrent`, set
`lastDamagedAt = new Date().toISOString()` and `lastDamageAmount = prev - next` in
the same `UpdateCommand`. Nothing else changes; `notifySessionChanged()` already
fires at the end and pushes the nudge (ADR-019).

**NPC damage is symmetric but needs one added read.** All NPC HP writes funnel
through `PUT /npc-combat` → `putNpcCombat.js` (`DmDashboardPage.jsx:360
commitNpcCombatUpdate`, used by `handleApplyNpcDamage` and the NPC card steppers).
That handler is a blind full-array replace with **no read** today — add
`getNpcCombatState()` (already exported, `specialRecords.js:116`) and diff
`hpCurrent` per NPC id, stamping the same two fields onto each NPC object.
Then teach `normalizeNpcCombatRecord()` to pass the two fields through — per
ADR-017's rule, a normalizer that doesn't know a field silently drops it on read.

**Phase B clearing: derive, don't clear (deviation from the brief's OQ-9).** The
brief recommends the server clear `lastDamagedAt` on turn-advance-into-entity.
Don't — `PUT /initiative` (`initiative.js`) is a whole-record replace that doesn't
know the previous `activeTurnIndex`, and clearing would mean a cross-item write to
a character or the npc-combat sentinel on every "Next Turn" tap, non-atomically.
Instead (ADR-022): `initiative.js` stamps `turnStartedAt` on the initiative
sentinel whenever `activeTurnIndex` or `round` changes (one `getInitiativeState()`
in the PUT path — it's already imported). Clients derive:

```
phaseB_live = lastDamagedAt
              && !(entityIsCurrentlyActive && turnStartedAt >= lastDamagedAt)
              && (inCombat || serverTime - lastDamagedAt <= 12000)
```

Both operands are server clocks on records every viewer already polls, so a
mid-combat joiner computes the identical answer. It also gets the brief's subtle
requirement right for free: damage taken *during your own turn* persists to your
*next* one, because `turnStartedAt` only moves forward when you next become
active.

**Projections.** Add `lastDamagedAt` + `lastDamageAmount` to
`backend/src/lib/partyProjection.js` in **both** whitelists — `DM_PARTY_FIELDS`
*and* `PLAYER_VISIBLE_FIELDS` — and to `DM_PARTY_PROJECTION_EXPRESSION` in the same
change (`dmParty.js`'s Scan will silently drop them otherwise). These are not
secret data. Add them to `npcCombatPublic` in `getSessionState.js:161`. Add
`turnStartedAt` to `buildPublicInitiativePayload()` in `initiativeProjection.js`.

**Frontend.** ADR-021's wrapper split must land first (see Sequencing). Then:
a new `.tk-hit` scale-only wrapper for the recoil, and `.tk-wash` / `.tk-wound` /
`.tk-shock` as conditionally-mounted `pointer-events: none` children of
`.token-chip`, per the brief's §6 DOM diagram. All classes, colour tokens
(`--tk-dmg-hot`/`-rest`/`-glow`), and keyframes (`tkRecoil`, `tkWash`, `tkShock`,
`tkWoundBreathe`, `tkWoundShed`) go in
**`src/features/dmDashboard/battleMode.css`** — the briefs say `tokens.css`;
**that file does not exist and must not be created** (ADR-014 file map).

Create `src/features/dmDashboard/battleMode/tokenEffects.js` as the shared module
(intensity-tier resolver, freshness gate, AoE stagger scheduler, size-band
resolver, Phase-B liveness predicate above). It is consumed by both
`MapPanel.jsx` (DM) and `PlayerMapViewer` in `CharacterSheetSessionMode.jsx` —
two copies guarantee drift, and Story 55 will add the choreography clock to the
same module as its single owner.

**Freshness gate and mount rule are the whole feature's correctness.** Phase A
fires only when `serverTime - lastDamagedAt <= 4000` **and** the stamp is newer
than what this client last rendered for that token (keep a `Map<tokenId, stamp>`
ref in the parent, seeded from the first payload so first paint never bursts —
same rule as Story 29b's poll-move mount gate at `BattleModeController.jsx:176`).
Without both, every tab-return replays a batch of old impacts.

### Scope boundary

**In**: `lastDamagedAt`/`lastDamageAmount` written in `session.js` and
`putNpcCombat.js`; `turnStartedAt` in `initiative.js`; three projection widenings;
ADR-021 wrapper split; `.tk-hit`/`.tk-wash`/`.tk-wound`/`.tk-shock` on both maps;
two intensity tiers; the 12s out-of-combat window; 70ms AoE stagger with a 6-token
cap; the reduced-motion static-rim substitution; one conditional hover-card line
(`◦ Took N — hasn't acted`).

**Out — resist even though it will feel natural**:
- Any change to how HP is calculated, clamped, or optimistically merged. The
  existing debounce/optimistic contract in ADR-011 is load-bearing and easy to
  break; the stamp is a *byproduct* of the existing write, never a second write.
- Heal stamps (`lastHealedAt`). Story 55's support tracer is the only consumer and
  it is explicitly a separable Phase 2. Do not add the field speculatively.
- Temp-HP "deflect" beat (brief OQ-3) — v1 shows nothing when temp HP absorbs.
- Wound halo on DM party cards / initiative rows (brief OQ-5) — follow-up story.
- The classic sheet's Map tab (`/characters/:slug`) has no token layer. Confirmed
  correct: `PlayerMapViewer` and the token layer only exist in session mode and on
  the DM dashboard. Do not add one here.
- `lastDamageFrom` — that's Story 55, and it must land in the same write. See
  Sequencing.

### Performance notes

- **`.token-chip`'s `transform` is re-stated in six places** in
  `battleMode.css` (base line 35, `--poll-animated` transition endpoints, three
  `tkTokenBounce` keyframe stops, the removal keyframe). Animating `transform` on
  `.token-chip` for the recoil would silently drop position, calibration scale,
  per-token scale **and** counter-rotation. This is why ADR-021's `.tk-hit`
  wrapper is non-negotiable, not stylistic.
- Both effect layers animate `transform`/`opacity` only — compositor-friendly.
  The shockwave extends 65% beyond the chip; `pointer-events: none` on every
  overlay is what keeps Story 34's player drag and Story 29b's 480ms long-press
  working. `.token-layer` has no `overflow: hidden` and is sized to the natural
  image, so the overflow requirement is already satisfied.
- The intensity/freshness computation runs per-token per-payload. Compute it
  **once in the parent** (`MapPanel` / `PlayerMapViewer`) and pass a resolved
  `damageState` prop into `TokenChip`, rather than per-chip: `TokenChip` is
  `memo`'d and the player map re-renders every chip on every pan frame via
  `onViewChange={setViewerState}`.
- No `will-change` at rest. All three overlays conditionally rendered, never
  mounted at `opacity: 0`.

### Cost notes

Zero new AWS resources. One extra DynamoDB `GetCommand` on the NPC-combat write
path and one on `PUT /initiative` — both human-frequency (a few dozen per
session) on a PAY_PER_REQUEST table, effectively free at current scale. The PC
path adds **zero** reads (reuses the existing `GetCommand`). Payload growth is
~2 small attributes per party member and per NPC on a response that already
carries full character records.

### Dependencies

- **ADR-021's wrapper split must land before this story's frontend work.**
- Nothing else. Backend and projection work can start immediately and is
  independently shippable/testable (stamps appear in `GET /session-state`, no UI).

### Risks / decisions needed

1. **The wrapper restructure is the real risk**, not the animation. Six duplicated
   transform declarations plus Story 34's drag maths plus Story 45's rotation
   handling all key off `.token-chip`. Land ADR-021 as a standalone
   **no-visual-change** commit with `TokenChip.test.jsx` green before touching
   effects. If the restructure and the effects land together, a rotation or drag
   regression will be impossible to bisect.
2. **Confirm the derived-clear (`turnStartedAt`) over the brief's server-clear
   recommendation.** It is cheaper, atomic-free, and consistent for mid-combat
   joiners — but it is a deviation from brief OQ-9 and should be an explicit
   decision.
3. **Accepted and documented, not fixed**: a DM correcting HP downward via the
   stepper fires a flash. Anything that decreases `hpCurrent` is damage; there is
   no "this was a correction" signal and inventing one is not worth it.
4. Confirm brief OQ-1 (two tiers), OQ-2 (12s), OQ-8 (70ms stagger / cap 6),
   OQ-10 (4s gate) before implementation — all four are single constants in
   `tokenEffects.js` and cheap to tune after a session, but they should be
   chosen, not defaulted.
