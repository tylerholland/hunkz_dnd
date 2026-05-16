# Story 19 — Death Saves & Combat Round Tracking

**Status**: Implemented

---

## Consultant analysis

Three related gaps share a common thread: the DM needs to track the passage of time and the survival of downed characters during combat, and currently has no tool for either.

### Death saves

When a PC drops to 0 HP, the highest-stakes moment in any session begins. The player rolls a d20 at the start of each of their turns: 10+ is a success, 9 or below is a failure, natural 20 stabilizes immediately, natural 1 counts as two failures. Three successes = stable; three failures = dead. The DM must know this state in real time — a player who rolls a natural 1 death save may not announce it clearly in the tension of the moment, and a player who rolls a natural 20 may not realize it stabilizes them outright.

Currently the DM dashboard has no death save tracker. Once a PC hits 0 HP, the DM must rely entirely on the player self-reporting correctly while simultaneously running the rest of combat. This is the single highest-urgency gap in the app.

### Round counter

Spell and effect durations in 5e are measured in rounds (1 minute = 10 rounds). Bless, Haste, Hold Person, Hypnotic Pattern, Hunger of Hadar, Web — all tick down by round. Without a round counter, the DM must manually tally rounds on paper or mentally count turns, which fails reliably under the cognitive load of a full combat. The round counter should increment automatically each time the initiative order completes one full cycle (i.e., "Next Turn" wraps from the last entry back to the first).

### Surprise round

When a surprise round occurs, surprised creatures cannot move, take actions, or use reactions on their first turn. There is currently no way to mark combatants in the initiative tracker as surprised. The DM must remember verbally which creatures were surprised and manually skip their actions on turn 1. In a complex initiative order with 8+ entries, this is a reliable source of mistakes.

---

## Goal

Give the DM the tools to track the three most time-critical combat states: whether a downed PC is succeeding or failing death saves, how many rounds have elapsed since combat began, and which combatants are surprised on the first turn.

---

## User stories

1. **As the DM**, when a PC's HP drops to 0, I want a death save tracker to appear on their party card — three success slots and three failure slots — so I can fill them in as the player rolls without relying on the player to self-report accurately.

2. **As the DM**, I want a natural-20 shortcut on the death save tracker that marks the character as stable immediately (clearing the tracker), because a natural 20 on a death save stabilizes the character outright in 5e.

3. **As the DM**, I want a round counter visible on the combat layout that increments automatically each time the initiative order completes a full cycle, so I can track spell and effect durations without counting turns on paper.

4. **As the DM**, I want to be able to manually adjust the round counter (increment or decrement), because sometimes I miss a "Next Turn" tap or need to correct an off-by-one error.

~~5. **As the DM**, I want to mark individual combatants in the initiative tracker as surprised before the first round begins, so their entry is visually flagged and I'm reminded to skip their turn on round 1.~~ **Out of scope — dropped.**

~~6. **As the DM**, I want surprised entries in the initiative tracker to auto-clear their surprised status after the first round completes, so I don't have to manually unmark them after the surprise round ends.~~ **Out of scope — dropped.**

---

## UX Design

> Full spec: `design/briefs/death-saves-round-tracking-brief.md`. Summary of key decisions below.

### Placement

- **Death save tracker** — on the party card, *replacing* the existing read-only "player-reported" pip stub (`CharacterCard.jsx` ~L1370), in the same slot: below the HP/temp-HP row, above conditions. Mounts only when `hpCurrent === 0`; unmounts (animated) when healed/stable/dead. Tier 1, combat-critical.
- **Round counter** — in the InitiativeTracker header row, on the line with "INITIATIVE ORDER" / "Clear ×". One small Cinzel numeral with recessive ± steppers. There is no pre-existing "Round X" label anywhere — this owns the concept. Not on a card (it's combat-global), not its own panel (it's one number).
- **Surprise marking** — ~~out of scope, dropped from this story~~.

### Key behavioural decisions

- **Pips are authoritative, not "player-reported."** Borders change from dashed (the old stub's "unofficial" signal) to solid; the "player-reported" caption is deleted. Tap an empty pip fills it + all to its left; tap a filled pip un-fills it + all to its right (correction path, instant/no-animation). 44px touch row; 14px visible circle.
- **Failures outrank successes visually:** failures right-aligned, error-red `#c06060`, with a glow filled pips don't have. Successes are informational green `#5a9a5a`, calmer. A divider rule (not a slash) separates the clusters for fast peripheral counting.
- **NAT1** = one-tap "+2 failures" (staggered pair fill + one combined block shake). **NAT20** = one-tap resolve. **"✦ Stable"** button covers external stabilization (Medicine/spell, no roll) — distinct from NAT20 because Stable = 0 HP unconscious, NAT20 = 1 HP awake.
- **Damage-at-0 integration (rules-mandated, not in the story text but required):** when the card's existing Damage flow lands on a character already at 0 HP, an inline `[+1 Failure] [Crit: +2] [Skip]` step appears. One extra tap, not a thing the DM must remember to do manually.
- **Round counter increments automatically** when `handleNextTurn` wraps `activeTurnIndex` last→first; a brief number-swap animation rides the same tap the DM already makes. Manual ± for corrections (no hold-to-repeat — overshoot risk; manual swap omits the "true round" brighten flash, an honest motion distinction). **Clear × / empty initiative resets round to 1** — load-bearing, easy-to-miss correctness requirement.
- **Surprise marking is out of scope.** The DM handles this verbally.

### Data model (assumed; architect to finalize)

- `deathSaves: { successes, failures }` on the character — already a read shape (`getDeathSaveCounts`); Story 19 makes it `patchSession`-writable (add to `SESSION_FIELDS`, no auth, ADR-005).
- `round: number` on the `slug:"initiative"` sentinel record, written atomically with `entries`/`activeTurnIndex` via the existing `putInitiative` path; absent → 1.
- `surprised: boolean` per initiative entry; cleared on all entries in the same write that takes round 1→2.
- Binding round + surprise-clear to the single atomic initiative write is a design constraint (prevents desync across polling clients), not an implementation detail.

### Edge cases handled (see brief §6 for full list)

Multiple simultaneous deaths (independent stacked trackers, no aggregation); stabilize-then-heal; death is reversible by un-tapping a failure pip (no pre-confirm modal — speed at the table); all-combatants-surprised (per-entry model handles it free; active-turn name stays un-dimmed for legibility); manual round adjustment vs. surprise-clear asymmetry; empty/no-combat = entire feature set dormant and silent (sparse-first).

### Resolved decisions (see brief §8)

1. **NAT20 = 1 HP + wake up** (rules-accurate). Sets `hpCurrent = 1`, clears tracker, character wakes.
2. **Damage-at-0: always show `[+1 Failure] [Crit: +2] [Skip]`** — DM picks which applies.
3. **Surprise marking: dropped.** DM handles verbally.
4. **Death has no confirmation dialog** — reversible by tapping a failure pip back down.

---

## Architect Notes

**Applies**: ADR-001/ADR-014 (CSS classes + keyframes, no `<style>` injection), ADR-003 (schemaless DynamoDB — no migration for new attributes), ADR-005 (session fields writable without auth), ADR-011 (adaptive polling + optimistic session/initiative writes — the contract this story must not break).

No new ADR is required. `round` on the initiative sentinel record is a straight extension of the established combat-global pattern (ADR-003 + the `slug:"initiative"` sentinel already documented in CLAUDE.md and written atomically through ADR-011's `commitInitiativeUpdate` path). `deathSaves` writable via `patchSession` is exactly the ADR-005 pattern already used by `conditions`/`hpCurrent`. Nothing here introduces a new service, data pattern, or frontend approach.

### 1. Files that change (with line anchors)

**Backend (2 files, both tiny):**
- `backend/src/handlers/session.js` — add `"deathSaves"` to the `SESSION_FIELDS` array (currently L9–23). One line. This is the only backend change required for the death-save tracker; the partial-update builder at L48–54 already handles any whitelisted field generically.
- `backend/src/handlers/dmParty.js` — add `deathSaves` to the `ProjectionExpression` (L17–18). **This is load-bearing and easy to miss:** `dmParty.js` projects an explicit attribute list, so without this the DM dashboard never receives `deathSaves` and the tracker always reads `0/0` (this is why the current read stub is effectively dead). `deathSaves` is not a reserved word — append it to the projection string directly, no `ExpressionAttributeNames` entry needed.
- `backend/src/handlers/initiative.js` — the PUT handler (L17–29) currently destructures only `entries` and `activeTurnIndex`. Add `round` pass-through. `backend/src/lib/specialRecords.js` — `normalizeInitiativeRecord` (L5–10) and `saveInitiativeState` (L98–103) must carry `round` (default/absent → `1`). See §4.
- `backend/src/handlers/get.js` — **no change**. `deathSaves` is not privacy-sensitive (unlike `playerNotes`); the player's own sheet doesn't currently render it. Leave it in the default GET payload.

**Frontend:**
- `src/features/dmDashboard/CharacterCard.jsx` — replace the death-save stub at **L1370–1390** (the `{showDeathSaves && (...)}` block with the dashed pips + `cc-player-reported` caption). `getDeathSaveCounts` (L132–140) stays as-is — it's already a tolerant clamped reader; the new writer standardizes on `{ successes, failures }`. The damage-at-0 hook touches **two** damage paths — see §5. `commitSessionFields` (L1162–1177) is the existing write helper to reuse for pip writes (routes through `onCommitSessionUpdates` batch path when present, else `patchSession`).
- `src/features/dmDashboard/InitiativeTracker.jsx` — `handleNextTurn` (L51–55), `handleClear` (L101–103), `handleRemove` (L93–99, the "Modify Order removed last entry" reset), and the `.init-header` row (L138–141). See §4.
- `src/pages/DmDashboardPage.jsx` — `commitInitiativeUpdate` (L245–282) normalizes to `{ entries, activeTurnIndex }` and **drops any other field** (L248–251). It must preserve `round`. Also `initiativesEqual` in `src/features/dmDashboard/dashboardShared.js` (L163–170) compares only `entries`/`activeTurnIndex` — extend it to compare `round`, or an auto-incremented round arriving via poll will be treated as "equal" and the optimistic value won't reconcile.
- CSS: `src/features/dmDashboard/characterCard.css` (replace `.cc-death-saves*` / `.cc-player-reported` rules ~L252–289 with the new authoritative tracker styles), `src/features/dmDashboard/npcCombat.css` (round counter in the init header — that file owns initiative tracker CSS per ADR-014), and `src/features/dmDashboard/dashboard.css` for any net-new keyframes (see §6). No `<style>` injection — the prototype's inline `<style>` is prototype-only.

### 2. Backend changes summary

- `deathSaves` → add to `SESSION_FIELDS` (session.js) **and** to the `dmParty.js` projection. Both are required; one without the other is a silent no-op.
- `round` → add to `normalizeInitiativeRecord`, `saveInitiativeState`, and the `initiative.js` PUT body destructure. Default to `1` when absent (not `0` — round 1 is the first round). Clamp to `>= 1` on write.
- No new endpoints, Lambdas, IAM, or `template.yaml` changes. No GSI. Zero new AWS cost — these are new attributes on existing items and existing write paths (ADR-003).

### 3. `deathSaves` write shape

`patchSession(slug, { deathSaves: { successes: <0–3>, failures: <0–3> } }, dmPassword)`. Always write the **whole object**, both keys, clamped 0–3 — never a partial. The tolerant reader (`getDeathSaveCounts`) accepts legacy `success`/`failure`/`succeeded`/`failed` aliases on read but the writer must standardize on `{ successes, failures }` only. Treat `deathSaves` as a live optimistic field in the same family as `conditions` (optimistic local state, write through `commitSessionFields`, reconcile on poll). NAT20 must write `{ hpCurrent: 1, deathSaves: { successes: 0, failures: 0 } }` in a **single** `patchSession` call (one atomic write — don't issue HP and deathSaves as two requests or a poll can land between them and show a woke-but-still-dying state). "✦ Stable" and 3rd-success write `{ deathSaves: { successes: 0, failures: 0 } }` only (HP stays 0). Healing above 0 must also clear `deathSaves` to `0/0` in the same write as the HP change (the rules-reset; don't rely on the tracker just unmounting — the data must be clean for the next time they drop).

### 4. Where `round` lives and how `handleNextTurn` changes

`round` is a sibling field on the `slug:"initiative"` sentinel item, written atomically with `entries`/`activeTurnIndex` through the existing `commitInitiativeUpdate` path (never a separate write — ADR-011's no-desync constraint).

- `handleNextTurn` (InitiativeTracker L51–55): compute `wrapped = next === 0 && entries.length > 0` (i.e., `activeTurnIndex` was the last entry). Pass `round: wrapped ? (currentRound + 1) : currentRound` in the same `onCommitInitiative({ entries, activeTurnIndex, round })` call. `currentRound` comes from `initiative.round ?? 1`.
- `handleClear` (L101–103): commit `{ entries: [], activeTurnIndex: 0, round: 1 }`. **Non-negotiable per brief §3b** — combat over = round resets.
- `handleRemove` (L93–99): when `updated.length === 0`, also reset `round: 1` (brief §6 "resets if entries reach 0 via Modify Order removes").
- `commitInitiativeUpdate` (DmDashboardPage L248–251): add `round: nextInitiative.round ?? 1` to the `normalized` object so it survives the normalize step and reaches `putInitiative`.
- `initiativesEqual` (dashboardShared L163–170): add `(a.round ?? 1) !== (b.round ?? 1)` to the inequality checks, otherwise the post-write reconcile (ADR-011 expected/echo merge) won't settle on round changes.
- Manual ± steppers: optimistic local update + `commitInitiativeUpdate({ ...initiative, round: clamped })`. Min round 1 (− disabled at 1). No hold-to-repeat (brief §5 — overshoot risk). The auto-increment-only "brighten" animation distinction is a CSS class toggle, not a data difference — the builder decides brighten vs. plain swap at the call site (wrap → brighten; manual/Clear → plain), the record carries only the number.

### 5. Damage-at-0 prompt hook points

There are **two** damage entry paths in `CharacterCard.jsx` that can land on a 0-HP character — the prototype only models one. Both must trigger the inline `[+1 Failure] [Crit: +2] [No Failure]` prompt:

1. **`DamageHealModal.confirm()` (L393–402)** — modal damage entry. After `onOptimisticUpdate(newHp)`, if `newHp === 0` AND the character was already at 0 before this damage (or damage took them to 0 — clarify with the brief: brief §0/§6 says "lands on a character *already* at 0 HP"; damage that *brings* them to 0 starts the tracker but does **not** itself add a failure). Show the prompt; do not auto-close the card flow until the DM picks a button.
2. **`applyDelta()` (L1099–1109)** — the inline −/+ HP stepper with hold-to-repeat (`useHoldToRepeat`, L1120). This is the more dangerous path: hold-to-repeat can tick a 0-HP character with many −1s. **Do not fire the prompt per tick.** Debounce/gate it: only evaluate "should I prompt?" once the optimistic value settles at 0 after a damage gesture (tie it to the existing `useDebouncedOptimisticNumberFlush` settle, not every `applyDelta` call). A naïve per-tick hook will spawn a prompt storm.

The prompt's buttons write `deathSaves` via `commitSessionFields` (`+1` → `failures+1`, `Crit: +2` → `failures+2` capped at 3, `No Failure` → dismiss only, no write). Reaching 3 failures from this path triggers the same FALLEN sequence as tapping the 3rd pip. The prompt is local component state on the card (e.g., `damageAtZeroPrompt` boolean/ref) — not a modal, not persisted, cleared on heal-above-0 or on any button press.

### 6. Animation reuse vs. new keyframes

The brief says reuse the dashboard motion vocabulary. Confirmed against `src/features/dmDashboard/dashboard.css`:

- **`dmDeathSaveShake`** — already exists (L55–61) with class `.dm-death-save-shake` (L120–122, 0.3s ease-out). Reuse as-is for the block shake on failure mark. The prototype redefined it locally with slightly different keyframe stops; **use the existing repo keyframe**, not the prototype's.
- **`dmConditionIn`** — exists (L19–22), `.dm-condition-enter` (L80–82, 0.18s). Reuse for pip fill (success and failure both — the asymmetry is colour/glow, not motion, per brief §4).
- **`dmFadeOut`** / `dmConditionOut` — exist; reuse for tracker collapse on resolve/heal. Note brief §4 exception: on death the tracker does NOT collapse (tombstone) — just don't apply the exit animation in the FALLEN branch.
- **`dmTurnGlow`** / `.dm-active-turn` (L69–72, 135–137) — existing active-turn glow, untouched by this story (round counter is a number in the header, not on a row).

**Net-new keyframes required** (none of these exist in `dashboard.css` — the prototype's `dsBlockIn/Out`, `stabilizeGlow`, `roundNumIn`, `roundBrighten`, `cardFallen`, `dmgPromptIn`, `hpHealNum` are prototype-only and must be ported into a repo CSS file as real `@keyframes`):
- Death-save block enter/exit (`max-height` + opacity) — `dmFadeOut` is opacity-only; the height collapse for mount/unmount is genuinely new. Add a keyframe.
- Stabilize glow ring (green box-shadow radiate) — new; the existing `dmBloodiedFlash` is amber/different geometry. Add.
- Round number swap + the optional brighten variant — new. Add (one keyframe + a `.round-num.auto-brighten` modifier class).
- FALLEN card dim (opacity → 0.6) + the damage-at-0 prompt slide-in — new but trivial; add to `dashboard.css`.

Put all new keyframes in `dashboard.css` (it is the documented home for all dashboard keyframes per ADR-014), pip/tracker structural rules in `characterCard.css`, round counter in `npcCombat.css`. The death-save colours are intentionally global hex (`#5a9a5a`/`#c06060`), not palette-derived (brief §3a) — keep them as literals/CSS custom props scoped to the tracker, do **not** wire them to `--pal-*`.

### 7. Risks / things the builder should watch

- **Optimistic-merge reconciliation (highest risk).** `deathSaves` and `round` both go through ADR-011's expected/echo merge. `deathSaves` must be added to the optimistic live-field set the same way `conditions` is, and `initiativesEqual` must learn about `round` (see §4) — otherwise either (a) the tracker flickers back to the server value mid-tap, or (b) an auto-incremented round never reconciles and "sticks" optimistically forever. This is the single most likely thing to ship broken. Mirror the existing `conditions` handling exactly; do not invent a new sync path (ADR-011 operational note).
- **`commitInitiativeUpdate` silently strips `round`.** L248–251 rebuilds a fresh object with only two keys. If the builder forgets to add `round` there, the round will appear to work optimistically and then revert on every poll — a confusing, intermittent bug. Call this out in the PR.
- **Damage-at-0 double-path + hold-to-repeat storm.** See §5.2. The stepper path is the trap. Gate the prompt on the debounced settle, not per `applyDelta`.
- **NAT20 split-write race.** HP→1 and deathSaves→0/0 must be one `patchSession` call (§3), or a poll between two writes shows an inconsistent state on other clients.
- **"Already at 0" vs. "brought to 0" semantics.** Damage that *brings* a character to 0 mounts the tracker but adds **no** failure (5e: you fall unconscious, you don't immediately fail a save). Only subsequent damage *while at 0* adds failures. Confirm the builder reads brief §0/§6 — the prototype's demo chunking obscures this.
- **No new tests are mandated by the pipeline, but** `InitiativeTracker.test.jsx` and `DmDashboardPage.test.jsx` already exist and assert initiative optimistic behavior — adding `round` will likely require updating their fixtures/assertions. Budget for that; don't let the round field silently break the existing initiative specs.
- **No decision needed from the user** — brief §8 resolved all open questions (NAT20 = 1 HP + wake; always show both damage buttons; surprise dropped; no death confirm). Proceed.
