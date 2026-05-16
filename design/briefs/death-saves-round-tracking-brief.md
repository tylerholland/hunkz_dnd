# Death Saves & Combat Round Tracking — Design Brief

> Story 19. Three DM-facing combat instruments: death save tracker (party card,
> Tier 1), round counter (initiative panel header), surprise marking (initiative
> rows). Produced by design-strategist. Implementation spec for ux-designer.
>
> This brief is consistent with — and makes concrete — the death-save and
> initiative contracts already sketched in `dm-dashboard-brief.md` §11. Where
> the dashboard brief named an animation ("Death save failure marked: pip fills
> red, shakes"), this brief specifies the exact geometry, triggers, write path,
> and edge behaviour.

---

## 0. Rules grounding (load-bearing — design follows from these)

| Rule | Design consequence |
|---|---|
| At 0 HP, roll d20 at start of your turn. 10+ = success, ≤9 = failure. | Three success slots, three failure slots, independent. |
| 3 successes → **Stable**. Still 0 HP, still unconscious. Does NOT wake. | "Stable" is a *calm* state, not a *recovered* state. Card stays at 0 HP, dimmed-but-safe — not restored. |
| 3 failures → **Dead**. No further saves. | Terminal, weighty, irreversible-feeling (but DM can undo — see edge cases). |
| Natural 20 → regain **1 HP**, conscious, saves reset. | The story asks the shortcut to "stabilize". Rules-accurate is "1 HP + wake". This is the single biggest open question — see §8. Brief designs the rules-accurate path as default with story's path as the documented fallback. |
| Natural 1 → counts as **two failures**. | Need a one-tap "nat 1" affordance, not just "+1 failure" tapped twice. |
| Any damage at 0 HP → **+1 failure** (a crit, or any melee hit from within 5 ft, → **+2 failures**). | The card's existing Damage button, when it lands on a character already at 0 HP, must offer to record the resulting failure(s). This is the hidden third integration point the story doesn't name but the rules demand. |
| Any healing above 0 → death saves **reset to 0/0**, character wakes. | When `hpCurrent` goes 0 → >0, the tracker must clear itself automatically. No manual reset needed. |
| Round = 6 seconds. New round begins when initiative wraps last→first. | Round counter increments on the wrap, not on every Next Turn. |
| ~~Surprised creature: no move/action/reaction on turn 1; clears after round 1.~~ | **Out of scope.** Surprise marking dropped from this story — adds complexity for an edge case the DM can handle verbally. |

---

## 1. Design intent

These three instruments exist because the DM is **tracking time and tracking dying** while simultaneously narrating and adjudicating. The emotional goal is **confidence under the table's highest-stakes moment**: when a PC is at 0 HP, the DM should never have to ask "wait, how many failures was that?" The tracker is the DM's authoritative record, replacing the unreliable channel of a panicking player self-reporting.

The functional goal is **glanceable truth with one-tap correction**. Death saves must be readable without focusing — six pips, two colours, filled/empty. The round counter must be a passive number the DM never has to compute. Surprise must be a flag the DM sets once and then *forgets*, trusting the tool to clear it.

The mental model: **the tracker is a clipboard, not a calculator**. The DM watches the player roll a physical die, hears the number, and taps the result. The tool records; it does not roll. (Death saves are emotionally the player's moment — the app must not steal the roll from the table.)

---

## 2. Information hierarchy

Across the three features, ranked by visual priority when active:

1. **Death save FAILURE pips on a downed PC's card.** Highest urgency in the entire app. Red, on a card that already has a red border (the 0-HP state from the dashboard brief). The DM's eye must land here first when scanning the party column.
2. **Death save SUCCESS pips** — same card, immediately adjacent, but green and lower-tension. Read second because success is "less to worry about."
3. **The "Now" active-turn indicator + Round number** in the initiative header. During combat the DM's gaze cycles party → initiative → enemies; the round number rides along with the turn pointer they already track.
4. ~~Surprise flags on initiative rows~~ — **out of scope** (dropped from this story).

Within the death save tracker itself, the internal hierarchy resolves a real competition: **failures outrank successes**. Three failures kills a PC; three successes only stabilizes (a good-but-not-urgent outcome). When both have progress, the eye must hit failures first. Resolution: failures render on the **right** (the side the eye rests on after reading the success→failure label), in the universal error red `#c06060`, and a filled failure pip carries a subtle glow that a filled success pip does not. The success cluster is informational; the failure cluster is an alarm.

The round counter must NOT compete with the existing "▶ Next Turn" button (the most-tapped element in combat). Resolution: the round number is a small, calm Cinzel numeral in the initiative header *label row*, not a button. It is read, not pressed. Its ± controls are deliberately recessive (see §3).

---

## 3. Annotated wireframes

### 3a. Death save tracker — on a party card at 0 HP (~360px card width)

The tracker **replaces** the existing display-only stub at `CharacterCard.jsx` ~line 1370 (the dashed-pip "player-reported" block). It lives in the **same slot** — directly below the HP row / temp-HP row, above the status (conditions) row. This placement is correct and unchanged: death saves are the natural continuation of "what is this character's life state," reading top-down HP → temp → death saves.

```
┌──────────────────────────────────────────────────────────┐
│ [◐] AESOP                          ⟨↗⟩  ⟨AC 15⟩  ⟨⋯⟩      │  ← card header (unchanged)
│     Halfling · Rogue · Lvl 4                              │
│  ⊖   0 ── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  / 28   ⊕         │  ← HP row (0 HP → red, unchanged)
│──────────────────────────────────────────────────────────│
│ ① DEATH SAVES   ② ● ● ○   ③ │   ④ ◆ ◆ ◇   ⑤ NAT20  NAT1 │
│                   saves          failures                 │
│ ⑥                                          ⟨ ✦ Stable ⟩   │
└──────────────────────────────────────────────────────────┘
        ↑ entire block sits on a faint red wash (⑦)
```

**Legend:**

① **"DEATH SAVES" label** — IM Fell English, 11px, uppercase, `0.22em` tracking, `pal.textMuted` (the `.label-ui` class). Anchors the block; says unambiguously what these pips are. Left-most because the eye scans left and needs the noun before the data.

② **Success pips** — three circles, 14px diameter. Filled pips: solid `#5a9a5a` (the existing dashboard success green), 1.5px solid border same colour. Empty pips: transparent fill, 1.5px **solid** border `rgba(90,154,90,0.4)`. **Decision: solid borders, not dashed.** The current stub uses dashed borders to communicate "not authoritative / player-reported." Story 19 makes this authoritative — solid borders signal "this is the DM's record now." Removing the dashed treatment is itself a meaningful state change the DM will feel.

③ **Separator** — a thin vertical rule, `1px` × 14px, `pal.border`. Cleanly divides the two clusters so a 5-pip glance never miscounts across the boundary. Not a slash glyph (the stub's `/`) — a rule reads faster peripherally.

④ **Failure pips** — three circles, 14px. Filled: solid `#c06060`, plus a `0 0 4px rgba(192,96,96,0.55)` glow (the asymmetry that makes failures alarm and successes merely inform). Empty: transparent, 1.5px solid `rgba(192,96,96,0.35)`. Failures are right-aligned within the row (see hierarchy §2).

⑤ **NAT20 / NAT1 shortcuts** — two small ghost pills, IM Fell English 10px uppercase, `0.14em` tracking, 44px min touch height (padding `7px 10px`), `pal.border` border, transparent bg.
   - **NAT20**: text `pal.textMuted` → on hover/press tints to `#5a9a5a`. Tapping resolves the whole tracker (see §5 and the open question in §8 — default behaviour is rules-accurate "1 HP + clear").
   - **NAT1**: text `pal.textMuted` → tints to `#c06060`. Tapping adds **two** failures in one action (with a single combined animation, not two shakes — see §4).

   These pills sit to the right of the failure cluster, last in reading order: they are *outcomes of a roll the DM heard*, applied after reading the normal pips. Placing them inline (not in a menu) honours the non-negotiable — the DM should not have to open anything during this moment.

⑥ **"✦ Stable" manual button** — appears ONLY when the character is at 0 HP and not yet stable/dead. Ghost pill, right-aligned on its own sub-line, `#5a9a5a`-tinted on hover. This covers the rules path where a *different* character stabilizes the downed PC with a Medicine check or spare-the-dying (no save rolled, but the PC becomes stable at 0 HP). Distinct from NAT20 because the outcomes differ: Stable = 0 HP unconscious; NAT20 = 1 HP awake. Both clear the pips; only one wakes the character.

⑦ **Red wash** — the entire death-save block sits on `rgba(192,96,96,0.06)` background tint with a `2px` left bar in `#c06060`, echoing the card's 0-HP red border (dashboard brief §11 "HP zero reached"). This visually bonds the tracker to the danger state — it is not a neutral widget, it is an alarm panel.

**No "player-reported" caption.** It is deleted. The whole point of Story 19 is that this is no longer player-reported — it is DM-authoritative. Keeping the caption would contradict the feature.

### 3b. Round counter — initiative panel header (~300px column)

The round counter lives in the **InitiativeTracker header**, on the same line as the "INITIATIVE ORDER" label and "Clear ×" button (`InitiativeTracker.jsx` ~line 138, the `.init-header` row). It does **not** go on a party card (wrong scope — it's combat-global) and does **not** get its own panel (wasteful; it's one number). There is currently **no "Round X" label anywhere** in the app — this is net-new and owns the concept cleanly.

```
┌────────────────────────────────────────────────────────────┐
│ ① INITIATIVE ORDER          ② ROUND ⟨–⟩ ③ 3 ⟨+⟩  ④ Clear× │
│────────────────────────────────────────────────────────────│
│            ▶ Next Turn                                      │  (unchanged)
│  ┌──────────────────────────────────────────────────────┐  │
│  18  Eoghan                              ◀ Now           │  │
│  ...                                                        │
└────────────────────────────────────────────────────────────┘
```

**Legend:**

① **"INITIATIVE ORDER" label** — unchanged (`.label-ui`, `0.3em` tracking).

② **"ROUND" micro-label** — IM Fell English, 10px, uppercase, `0.2em` tracking, `pal.textMuted`. Tiny on purpose: it qualifies the number without competing.

③ **Round number** — Cinzel, 18px, `pal.accentBright`. The single most-glanced new datum in combat. Centred between its steppers. Shows `1` from the moment combat has an initiative order; shows `–` (em dash, `pal.textMuted`) when the initiative list is empty.

④ **± steppers** — 24×24px (visually) / 44px touch target, `.btn-stepper`-derived but minimal: transparent bg, `pal.border` border, `pal.textMuted` glyph → `pal.accent` on hover. Deliberately recessive — manual adjustment is the exception, the automatic increment is the rule. Minimum value is 1 (− is disabled/dimmed at round 1). No maximum.

**Critical behaviour:** Clear × resets the round counter to 1 along with clearing the initiative list. Clearing initiative *is* "combat is over"; the round must reset or the next fight starts mid-count. This is non-negotiable and easy to miss.

### 3c. Surprise marking — OUT OF SCOPE

Dropped from this story at user direction. The DM can manage surprise verbally for the rare combats where it applies. No change to the Modify Order mode or initiative rows.

---

## 4. Motion & animation spec

All durations/easings stay within the established dashboard vocabulary (`dashboard.css` already defines `dmDeathSaveShake`, `dmConditionIn/Out`, `dmFadeOut`, `pulseDot`, `dmBloodiedFlash`). Reuse these; do not invent a parallel motion language.

**Death save tracker appears (PC drops to 0 HP):**
- Block `max-height: 0 → auto`, `opacity: 0 → 1`; red wash fades in. Duration: 300ms, ease-out. Ties into the dashboard brief §11 "HP zero reached" promise.

**Death save tracker disappears (healed above 0, stabilized, or died):**
- `max-height → 0`, `opacity → 0`, 250ms ease-in. EXCEPTION: on death (3 failures) the block does NOT collapse first — the card-level death animation owns that moment and the tracker fades with it.

**Success pip fills:**
- `scale 0.7 → 1.0` + fill colour in. Reuse `dmConditionIn` (180ms, ease-out). No shake. The asymmetry vs. failure is the entire point.

**Failure pip fills:**
- Pip fills `#c06060` + glow in (`dmConditionIn`, 180ms), THEN the whole death-save block does one `dmDeathSaveShake` (300ms, ±3px translateX). Total ~480ms. The shake is the *whole block*, not just the pip — felt peripherally.

**NAT1 tapped (two failures at once):**
- Next two empty failure pips fill in a 60ms-staggered pair (reads as "two"), then ONE block shake. Not two shakes.

**NAT20 tapped / Stable reached / 3rd success:**
- Card red border fades to `pal.accent` (300ms), a single `pal.gem` glow ring radiates from the card (`box-shadow 0 → 12px`, fading, 400ms) — shared across all three resolve paths (dashboard brief §11). Then tracker collapses (250ms). NAT20: card HP number animates 0 → 1 with existing heal-glow (woke up). Stable/3rd-success: HP stays 0, card dims to 0.85 opacity — *safe but still down.* The visual difference between "woke up" and "stable but unconscious" is load-bearing and rules-correct.

**Three failures (death):**
- ONE final block shake, immediately into the dashboard brief §11 death sequence: card `opacity → 0.6`, name `line-through`, "FALLEN" label fades in (`#c06060`), 600ms ease-in. The tracker pips remain visible *frozen* at 3/3 failures inside the dimmed card (a tombstone — the DM can see exactly how it ended). Card stays in the party column, dimmed, not removed.

**Round counter increments (automatic, on initiative wrap):**
- Number does `translateY(-4px) → 0` + `opacity 0.4 → 1` swap (old out up, new in from above), 200ms ease-out, `pal.accentBright` briefly brightens. Tied to the same Next Turn tap the DM already watches.

**Round counter manual ±:**
- Same number swap (200ms), but NO accentBright brighten flash — the brighten is reserved for true automatic round advances. A manual correction shouldn't masquerade as a real wrap.

**No animation:** Tapping an already-filled pip to un-fill it (correction): instant. Round number rendering `–`: instant.

---

## 5. Interaction model

**Death save pips (success & failure):**
- **Tap an empty pip** → fills it AND all empty pips to its left in that cluster (tapping the 3rd success when only 1 is filled sets successes to 3 — matches the spell-slot-bubble grammar). Writes `deathSaves` via `patchSession` (no auth required, ADR-005). Optimistic.
- **Tap a filled pip** → sets the count to that pip's index (un-fills it and everything to its right). This is the correction/undo path. Instant, no animation.
- Touch target: 44px tall row, generous horizontal padding so adjacent pips don't mis-trigger. Visible circle is 14px; tappable zone is the full row-height column around it.
- Reaching 3 successes or 3 failures triggers the resolve/death sequence (§4). The DM can still tap-down from 3 failures (un-fill) within the same session — the "I miscounted, he's not actually dead" escape hatch. Death is not modal-confirmed (too slow for the table) but IS reversible by un-tapping.

**NAT20 pill** → applies the configured nat-20 resolution (default: set `hpCurrent = 1`, clear `deathSaves`). One tap. No confirm — the DM heard the natural 20; speed matters more than a guard, and it's reversible.

**NAT1 pill** → adds 2 failures (capped at 3). One tap. If this reaches 3 → death sequence.

**"✦ Stable" button** → clears `deathSaves`, leaves `hpCurrent` at 0. One tap.

**Round counter ±** → optimistic local update, written to the initiative record (round lives on the sentinel item). Hold-to-repeat NOT enabled — round corrections are ±1, occasionally ±2; hold-to-repeat would invite overshoot. Single deliberate taps only.

**Cancel/undo summary:** Every action is reversible by direct manipulation (tap a pip down, − the round), not by a separate undo button. An undo button is a second decision; direct correction is one motion.

---

## 6. Edge cases & empty states

**No one dying (default):** The tracker does not render at all. The healthy card is unchanged. No "0/0 death saves" placeholder ever shown. Absence is the design.

**Multiple PCs at 0 HP simultaneously:** Each downed card shows its own independent tracker. They stack in the party column, each with its red wash and shake. No aggregation — the DM resolves them in initiative order and needs each one's pips discretely. The visual weight of multiple red-washed cards stacked IS the appropriate "this is dire" signal.

**PC at 0 HP takes more damage (the integration the story omits):** When the card's existing Damage button lands on a character already at 0 HP, on confirm the modal shows an inline follow-up: `Damage at 0 HP → record 1 death save failure?  [+1 Failure]  [Crit: +2]  [Skip]`. Default focus on `[+1 Failure]`. This is the rules-mandated path. `[Skip]` exists because sometimes the damage source doesn't apply. This must be one extra tap, inline in the damage flow — not something the DM must remember to do manually.

**PC stabilizes mid-combat then is healed later:** Stable state → if `hpCurrent` later goes >0, tracker is already gone (cleared on stabilize); card animates HP up normally. If a stable PC takes damage again, they're back to dying — the damage-at-0 flow re-opens the tracker fresh at 0/1 (death saves reset on prior stabilize, so it correctly starts clean).

**Round counter manually adjusted — interaction with surprise auto-clear:** Surprise auto-clear is bound to the round value crossing from 1 to 2, *regardless of cause*. Manual + from 1→2 correctly clears surprise. Manual − from 2→1 does **not** re-apply surprise (can't un-happen the surprise round). This asymmetry is deliberate.

**Round counter when combat ends (Clear ×):** Resets to 1. Also resets if entries reach 0 via Modify Order removes.

**All combatants surprised:** Per-entry model handles it for free. Active-turn name stays un-dimmed even on a surprised row (the amber tag communicates the surprise; the un-dimmed name keeps the turn pointer legible).

**No combatants in initiative:** Round number renders `–`, ± steppers disabled, surprise toggle absent. Entire feature set dormant and silent.

---

## 7. Data model implications (for architect, not decisions to defer)

These are the minimal shapes the design assumes; the code-architect will finalize, but the design depends on them:

- **`deathSaves: { successes: 0–3, failures: 0–3 }`** on the character — already exists as a read shape (`getDeathSaveCounts` in `CharacterCard.jsx`, normalized/clamped). Story 19 makes it *writable* via `patchSession` (must be added to backend `SESSION_FIELDS` if not present — no auth, ADR-005, like `conditions`/`hpCurrent`). The existing tolerant reader means the writer should standardize on `{ successes, failures }`.

- **`round: number`** on the **initiative sentinel record** (`slug: "initiative"`), alongside `entries` and `activeTurnIndex`. Round is combat-global — it belongs with initiative, written through the existing `putInitiative` / `commitInitiativeUpdate` path. Default/absent → 1. `handleNextTurn` computes the wrap (`next === 0 && entries.length > 0`) and increments `round` in the same write.

~~`surprised: boolean` per initiative entry~~ — **out of scope** (surprise marking dropped from this story).

The round field is written atomically with `entries`/`activeTurnIndex` via `putInitiative` — one write, no desync.

---

## 8. Resolved decisions

All open questions resolved before prototyping.

1. **NAT20 → rules-accurate: 1 HP + wake up.** Sets `hpCurrent = 1`, clears `deathSaves`. Character wakes and acts normally. Card HP animates 0 → 1 with existing heal-glow.

2. **Damage-at-0 → always show both buttons.** Prompt: `[+1 Failure] [Crit: +2] [Skip]` — DM decides which applies. Default focus on `[+1 Failure]`. No crit inference.

3. **Surprise marking → dropped entirely.** No ⚡ toggle, no SURPRISED badge, no round-1 auto-clear. The DM handles surprise verbally. No changes to Modify Order mode or initiative rows.

4. **Death has no confirmation dialog.** Tapping the 3rd failure pip immediately triggers the FALLEN state. Reversible by tapping the pip back down (no timer, no toast — direct manipulation is the undo path).
