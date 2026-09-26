# Session Spell Slot Management — Design Brief

> **Story 63.** Make Session mode's existing (read-only) Spell Slots display interactive —
> tap-to-spend/restore — and add player-triggered Short / Long Rest. Reuses the component
> already in the persistent right column; adds no second slot UI.
>
> Produced by design-strategist. Implementation spec for ux-designer.
>
> **This is the prerequisite that unblocks Story 59's OQ-1 blocking regression.**
> Ship this, then the classic Combat tab can be deleted without a functional loss.
>
> **Prototype: not required.** Every decision here is read, not felt — no new gesture, no
> sequence, no threshold constant. It assembles from patterns the app already ships
> (44px pip targets from the death-saves strip, inline two-tap confirm from Drop Item,
> rebase-at-commit from Story 58). Route straight to `code-architect`.

---

## 1. Tier

**Tier 2** for the slot pips — ambient resource accounting, read at a glance, must never
compete with the HP hero card or the concentration pulse directly above it.
**Tier 3** for the two rest buttons — on-demand, between-encounter, low frequency.
That split is why the rests live as quiet header-row ghosts and not as full-width buttons.

## 2. Design intent

Your slots stop being a printout and become the ledger you actually keep during play:
one tap to burn one, one tap to put it back, and a rest that says exactly what it will
restore before it does it. Recovery should feel like refilling, not like a reward.

---

## 3. Placement — RESOLVED: keep it in the persistent right column (story OQ-1)

**Decision: keep the Spell Slots section exactly where it is — the persistent right
column, above the sub-tab strip — and put the rest buttons there with it. Do not move
either into the `combat` sub-tab, and do not duplicate.**

This is a design decision, not a question I'm handing back. Four reasons, in order of weight:

1. **The Map sub-tab is where casting happens.** Story 57 put the Attack Declaration Bar
   on the Map sub-tab and explicitly designed the bar to survive a sub-tab switch so "a
   player can check spell slots before rolling without losing their declaration"
   (attack-targeting-flow-brief §3.2). Moving slots into `combat` converts that from a
   scroll into a tab round-trip *away from the board you are currently pointing at*. The
   one moment slots matter most is the one moment this placement would hide them.
2. **Slot state is ambient, and ambient state belongs above the tab line.** It sits with
   HP, conditions, concentration and inspiration — the four other things that are true
   about you regardless of what you're reading. Slots are the fifth. Splitting one of the
   five below the fold breaks the column's single organising idea.
3. **The spend moment and the reference moment are different moments.** Players check the
   Loadout tab for a component, the Notes tab for a name, the Map for position — and cast
   from any of them. Gating spend behind `combat` means the control is missing during a
   plausible majority of casts.
4. **Zero migration cost.** The pips are already there and already read. This story adds
   behaviour to pixels players have already learned the position of. Moving them spends
   that learning for nothing.

**Rejected: move into the `combat` sub-tab** (hides the control during exactly the
between-turns moments it exists for; discards existing spatial memory).
**Rejected: duplicate into both** (two copies of one mutable resource on one screen is the
exact anti-pattern Story 59 is removing at page scale).

**The rest buttons live in the Spell Slots section's own header row, right-aligned** —
not near the HP hero card. This is a deliberate containment: a `LONG REST` button adjacent
to a big HP number reads as "this will heal me," and per §8 it will not. Scoping the
buttons inside the slots section makes their blast radius self-evident.

---

## 4. Information hierarchy + layout

Most → least prominent inside the section:

1. The pip runs — filled vs. hollow, readable without focusing
2. Per-level `N / M` count (the number you say out loud)
3. Level labels (`1st`, `2nd`, …) — positional, learned once
4. `SHORT REST` / `LONG REST` — present, not advertised
5. Pact marker on pact-magic rows

```
.cs-sm-slots                                          — absent entirely when spellSlots is empty
  .cs-sm-slots-head                                   — 44px flex-row-spread
    .cs-sm-slots-title       "SPELL SLOTS"            — .label-ui
    .cs-sm-slots-rests                                — flex, gap 6
      button.cs-sm-rest[data-kind=short]              — 44px; ABSENT when no isPactMagic slot exists
                        [data-state=idle|confirm|busy|disabled]
      button.cs-sm-rest[data-kind=long]
                        [data-state=idle|confirm|busy|disabled]
  .cs-sm-slot-row[data-level=N][data-pact][data-empty] — 44px; whole row is the tap band
    .cs-sm-slot-lvl          "1st"                     — 34px fixed gutter, .label-ui
    .cs-sm-slot-pact         "◐"                       — pact rows only, 10px --pal-accent, title="Pact Magic"
    .cs-sm-slot-pips                                   — flex, gap 0 (no dead space between targets)
      button.cs-sm-pip[data-state=avail|spent][data-boundary]
        .cs-sm-pip-dot                                 — 12px visible; button is 28×44 hit area
    .cs-sm-slot-count        "3 / 4"                   — right-aligned, 44px tap target
                             ↺ UNDO                    — occupies the SAME slot for 3s after a change
```

**Nothing is added at rest.** The header row and the count text already exist; the rest
buttons occupy the header's previously-empty right side, and the undo affordance borrows
the count's own pixels rather than adding a row. That is how a Tier-2 section absorbs two
new controls without gaining visual weight.

**A fully-spent row (`used === max`) dims to `opacity: 0.55`.** No red, no glow — the
at-a-glance "that level is gone" read, using nothing but the opacity channel already free.

---

## 5. The spend interaction — RESOLVED: single tap, no confirm, no hold (story OQ-2)

The story asks whether live play needs protection the classic tab doesn't. **It does not
need a heavier gesture. It needs a bigger target, an unmissable state change, and one
cheap undo.** Reasoning, stated once:

- The action is **self-inverse**. The undo for a mis-spend is the same gesture one pip
  over. A confirmation step taxes every correct tap to protect against a mistake whose
  cost is already one tap.
- A hold gesture here would be **inconsistent and wrong-surface**: Story 57 reserved hold
  for token targeting on the Map, and Story 58's brief explicitly declares no long-press
  anywhere else in Session mode. Two different hold meanings in one mode is a trap.
- Every peer control in this column is a plain tap: inspiration, condition pills, HP ±1,
  death-save pips, counter-wheel segments. Spell slots must not be the one exception.
- **The real failure mode isn't the accidental tap — it's not noticing it.** So the budget
  goes to feedback, not friction.

### 5.1 Which pip changes (the boundary rule)

`spellSlots` stores `{ level, max, used }` — a **count**, not per-pip flags. Pip `i` is
available iff `i < max - used`. Per-pip identity does not exist in the data, so it must
not exist in the interaction either:

| Tap lands on | Write | Pip that animates |
|---|---|---|
| Any `avail` pip | `used + 1` (clamp ≤ `max`) | The **rightmost** available pip (the boundary) |
| Any `spent` pip | `used − 1` (clamp ≥ 0) | The **leftmost** spent pip (the boundary) |

Any tap anywhere in the correct run produces the correct result — precision anxiety is
designed out. The change always happens **at the boundary**, which is where the eye
already is, so the flash lands where you're looking. Tapping the boundary pip twice is
exactly spend-then-restore.

### 5.2 The undo (recommended; the one cuttable element in this brief)

For **3 seconds** after any pip change, that row's `N / M` count crossfades into a 44px
`↺ UNDO` affordance, then crossfades back. Zero layout shift, zero resting footprint.

It exists for the one mistake the inverse tap doesn't cover: **tapping the wrong level's
row.** Undo restores the correct row without the player having to work out which row they
hit. It also coalesces with the 400ms write debounce (§8), so an immediate undo produces
**no network write at all**.

Cut it and nothing else in this brief changes — flagged as OQ-2.

---

## 6. Rest confirmation — RESOLVED: inline two-tap, and the confirm is a preview (story OQ-3)

**Decision: both rest buttons use a two-tap inline confirm. Not a modal, not a plain tap.**

The app's convention is unambiguous and already covers rests specifically:

| Existing action | Gate |
|---|---|
| DM party-wide Short Rest / Long Rest | Confirmation dialog |
| DM per-character rest (`QuickActionPopover` → `"shortRest"`/`"longRest"`) | Same confirmation dialog |
| Drop Item (Session/Inventory) | Inline `[Confirm drop] [Cancel]` |
| Enemies Gallery delete | Two-step, 6s auto-dismiss |
| Counter wheel Remove | None (single wheel, trivially rebuilt) |

Every rest trigger that exists today is confirmed. A player-side rest that fires on one
tap would be the only unconfirmed rest in the app, and it's the one that wipes the most
state (a full caster's Long Rest is 7+ pips you'd have to re-enter by hand).

**Inline, not modal**, because Session mode's confirm idiom is the in-place label swap
(Drop Item) and a modal over a live-play surface is heavier than a once-a-session action
warrants.

**Same gate on both**, despite Short Rest doing less. They sit adjacent; an asymmetry
where one fires immediately and its neighbour doesn't is a trap, and Short Rest is rare
enough that the second tap costs nothing.

**The second tap earns its place by being informative, not ceremonial.** The confirm state
names the exact consequence, so it doubles as a preview:

```
[ SHORT REST ]  → tap →  [ RESTORE 2 PACT? ]   → tap → commits
[ LONG REST  ]  → tap →  [ RESTORE ALL 7? ]    → tap → commits
```

Counts are computed live from `spellSlots`. Auto-reverts to `idle` after **5s** or on any
tap elsewhere in the section. Both buttons render `[data-state=disabled]` at `opacity: 0.4`
and are non-interactive when their specific effect would be a no-op (nothing spent to
restore) — one honest rule rather than a button that lies about doing something.

---

## 7. Colour tokens

| Token | Role |
|---|---|
| `--pal-gem` | Available pip fill (matches the HP numeral / GP total — "a resource you hold") |
| `--pal-border` | Spent pip rim (hollow, 1px) |
| `--pal-text-muted` | `SPELL SLOTS` label, level labels, `N / M` count |
| `--pal-accent` | Pact `◐` marker; rest button border at idle |
| `--pal-accent-bright` | Rest button label; confirm-state text + border; `↺ UNDO` |
| `--pal-accent-dim` | Rest button background in `confirm` state |
| `--pal-surface` | Pip button hit-area background on `:active` (touch feedback only) |
| `#c06060` | Write-failure text + row border (universal, not palette-derived) |

**No new tokens. No glow anywhere in this section, at any state, including zero slots.**
A pulsing pip would compete directly with the concentration banner's pulse two elements
above it and with the HP-critical state one element above that — both Tier 1. A Tier-2
section does not get to use the alert vocabulary. "You're out of slots" is communicated by
the row dimming to 0.55, and by nothing else.

---

## 8. Motion & animation spec

```
Slot spends:
  Trigger:      tap an available pip
  Element:      the boundary (rightmost available) pip
  Animation:    fill opacity 1→0, scale 1→0.82→1 (rim holds throughout)
  Duration:     160ms, ease-out
  Communicates: "that one is consumed" — the rim staying proves the slot still exists

Slot restores:
  Trigger:      tap a spent pip, or UNDO
  Element:      the boundary (leftmost spent) pip
  Animation:    fill opacity 0→1, scale 0.86→1.06→1
  Duration:     200ms, ease-out
  Communicates: "it came back" — the small overshoot is the only celebratory motion here

Rest commits (short or long):
  Trigger:      second tap on a rest button
  Element:      every pip the rest refills
  Animation:    the Slot-restores keyframe, staggered left→right within a row (35ms),
                rows top→bottom (+60ms per row), total capped at 400ms regardless of count
  Communicates: "recovery sweeping down the ledger"
  Non-goal:     NO completion pulse, NO gold, NO glow. Recovery is not achievement —
                the counter-wheel gold vocabulary must not leak here.

Rest button → confirm:
  Animation:    label crossfade 120ms ease-out; button width transitions to the new label
  Communicates: "one more tap, and here's what it will do"

Count ↔ UNDO swap:
  Animation:    crossfade 120ms, in place, no layout shift (both use the same fixed slot)

Remote change (DM party rest, or a second device):
  Trigger:      polled/nudged `spellSlots.used` differs from the rendered value
  Animation:    the same spend/restore keyframes, same stagger
  Duration:     as above
  Communicates: "this changed and you didn't do it" — a silent snap would be a lost event
  Gate:         suppressed on first paint / mount (same freshness gate concept as Story 52's
                Phase A) so arriving at the page never plays a phantom sweep.

Rest buttons at rest, and the section at rest:
  none. Tier 2/3. Nothing in this section animates unless a value actually changed.
```

---

## 9. Reduced-motion table

| Animation | `prefers-reduced-motion: reduce` |
|---|---|
| Slot spends | Instant fill removal, no scale |
| Slot restores | Instant fill, no scale/overshoot |
| Rest commit sweep | All pips fill at once, no stagger |
| Rest button → confirm | Instant label swap; no width transition |
| Count ↔ UNDO swap | Instant swap |
| Remote change | Instant; the changed row holds `--pal-accent-bright` on its count for 500ms instead (the event still has to be *noticeable*, just not animated) |
| Write-failure flash | Kept — the 900ms `#c06060` hold is information, not decoration |

---

## 10. Interaction model

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| Available pip | Tap (28×44) | Boundary pip drains; count decrements | `patchSession({ spellSlots })`, 400ms coalesced | Tap a spent pip, or `↺ UNDO` (3s) |
| Spent pip | Tap (28×44) | Boundary pip fills; count increments | as above | as above |
| `↺ UNDO` | Tap (44px) | Reverts the last change on that row; count returns | Cancels the pending write outright if within the 400ms window; otherwise writes the reverted array | Re-tap the pip |
| `SHORT REST` | Tap (44px) | → `confirm`: `RESTORE N PACT?` | — | Tap elsewhere, or 5s auto-revert |
| `SHORT REST` (confirm) | Tap | Pact rows sweep-refill optimistically | `patchSession({ spellSlots })` immediately (no debounce) | None — restoring is non-destructive; re-spend by tapping pips |
| `LONG REST` | Tap (44px) | → `confirm`: `RESTORE ALL N?` | — | as above |
| `LONG REST` (confirm) | Tap | All rows sweep-refill optimistically | as above | None |
| Row / section (no slots) | — | Section absent entirely | — | — |

**Accessibility:** each pip is a real `<button>` with `aria-label` of the form
`"Level 1 spell slot — 3 of 4 available. Spend."` / `"… Restore."`; each row is
`role="group"` labelled by its level. Rest buttons announce their confirm label on state
change. Full keyboard operability comes free from using real buttons — do not build these
out of `div`s.

**Explicit non-interactions** (so they aren't invented): no hold/long-press anywhere in
this section; no swipe; no drag; no way to change a level's `max` (that stays edit-mode,
per the story's own out-of-scope).

---

## 11. Data contracts, sync & freshness

**Field:** `spellSlots: [{ level, max, used, isPactMagic }]`. **No new fields, no reshaping.**
**Write path:** `patchSession(slug, { spellSlots }, null)` — no auth, the whole array,
identical to every other Session-mode write.

| Rule | Behaviour |
|---|---|
| **Rebase at commit, never at render** | Apply the delta (`used ± 1`) to the **freshest polled array** at flush time, not the snapshot present when the row rendered. Same rule as Story 58 §9 — do not invent a second convention. The DM can party-rest concurrently; a blind whole-array write would clobber it. |
| Debounce | Pip taps coalesce at **400ms** (matches the equipment qty stepper). Rests write **immediately** — a single deliberate act, never batched. |
| Optimistic | Yes. Pips and counts update instantly; reconcile on next poll / WS nudge. |
| Write failure | Revert the affected row, hold a `#c06060` row border 900ms, and replace that row's count with `Couldn't save — tap to retry` (11px). Never a toast. Two consecutive failures → `Not saving — check your connection`. |
| Poll quiescence | While a rest button is in `confirm`, or an `↺ UNDO` window is live, incoming polls must not remount or re-animate the rows. Values still update; the DOM doesn't churn under the finger. |
| Staleness tolerance | 1s (sub-second with WS). Acceptable because pip writes are ±1 deltas rebased at commit; rests are absolutes and therefore must always rebase-and-recompute their confirm count before committing. |
| Bad data | `used > max` clamps to `max` on read (all pips spent). `max === 0` → the row does not render. Never crash, never render a negative count. |

**Rest rules — reuse, do not re-implement.** Extract the classic Combat tab's existing
rest logic into two pure helpers in `src/features/characterSheet/constants.js`
(`applyShortRest(spellSlots)` → refills entries where `isPactMagic === true`;
`applyLongRest(spellSlots)` → `used = 0` for all) and have **both** the classic tab and
Session mode call them. This story changes *where* rests can be triggered, not what they
do — and it means Story 59 can delete the classic tab without deleting the rules.

**Scope guard, load-bearing:** the player-side Long Rest restores **spell slots only**. It
must **not** copy the DM party-wide Long Rest's additional `hpCurrent = hpMax` restore.
A player silently full-healing themselves is a DM-authority change this story does not own.
If the classic tab already restores `hitDiceCurrent` on a long rest, match that exactly —
verification item for `code-architect`, see OQ-4.

---

## 12. Size-degradation ladder

| Step | Change |
|---|---|
| ≥900px | Full: header row with both rests inline; `1st` labels; `3 / 4` counts |
| 560–899px | Unchanged (right column is full width in the stacked layout) |
| 420–559px | Level label abbreviates `1st` → `1`; count tightens `3 / 4` → `3/4` |
| 380–419px | Rest labels shorten to `SHORT` / `LONG`; header stays one row |
| <380px | Header wraps to two rows (title above, rests below, both still 44px). If a level has >5 pips they wrap to a second line and the row grows to 68px |

**Never degrades away:** the pips themselves, the `N / M` count, and the words
`SHORT` / `LONG`. A rest button must never become glyph-only — a two-tap-confirmed action
that wipes state has to be readable, not decoded.

---

## 13. Key edge cases

| Case | Behaviour |
|---|---|
| `spellSlots` empty / absent (non-caster) | Whole section absent — unchanged from today. No rest buttons. Sparse-first; no regression |
| No `isPactMagic` slot exists | `SHORT REST` **absent entirely**, not disabled. For a non-warlock it can never do anything. (Intentional divergence from the classic tab, which always shows it — see OQ-3) |
| Nothing spent at any level | Both rests `[data-state=disabled]`, 0.4 opacity, non-interactive |
| Level fully spent (`used === max`) | Row dims to 0.55. No colour change, no glow |
| DM party-rests while the player has a `confirm` open | Confirm auto-dismisses (its effect is now a no-op); rows play the remote refill sweep |
| Player at 0 HP / FALLEN | Section unchanged and fully interactive. Bookkeeping is still bookkeeping |
| Player taps a pip while Story 57's Attack Bar is armed on a spell | Both are valid and independent — the bar reads slots, this writes them. The chip's `SLOTS 0` state updates on the next render. See §14 |
| `max` > 5 on a narrow screen | Pips wrap within the row; the row grows. Never truncate or `+N` — every slot must be individually tappable |
| Vellum (light) palette | Verify the hollow pip's `--pal-border` rim reads on parchment; bump to `--pal-text-muted` at 0.5 alpha on `.vellum` if not |

---

## 14. Party visibility of a rest — story OQ-4

**This is a genuine judgment call about your table, not a design-driven answer — but here
is a concrete recommendation and the cheapest possible implementation.**

The app already has a shared, DM-visible activity feed, and it already carries non-roll
events: counter-wheel creation posts `{ type: "wheel", … }` to `/characters/{slug}/rolls`
and `RollHistoryRow` renders it with a glyph, an italic name, and no numeric total.

**Recommendation: on commit, a Long Rest posts one line to that existing feed —
`☾ Long Rest — slots restored` — and a Short Rest posts nothing.** Rationale: a Long Rest
is a narrative beat the DM should see land; a Short Rest that refreshes two pact slots is
noise if the warlock takes three of them. Zero new data model, zero new UI, appears in the
DM's dice history for free.

**Do not gate a player rest behind DM approval.** The app's whole model is trust —
no-auth session writes everywhere — and a request/approve handshake for a once-a-session
action would be the heaviest interaction in Session mode.

Cut the feed line and nothing else changes. Flagged as OQ-1 because "should the DM see
this" is a table-culture question, not a design one.

---

## 15. Files touched

- `src/features/characterSheet/CharacterSheetSessionMode.jsx` — slots section becomes interactive; pip handlers with boundary resolution; rest button state machine; rebase-at-commit + 400ms coalesce; undo window
- `src/features/characterSheet/constants.js` — new exported pure helpers `applyShortRest(spellSlots)` / `applyLongRest(spellSlots)` (extracted from the classic tab's existing logic, behaviour unchanged); consumed by both surfaces
- `src/features/characterSheet/CharacterSheetViewMode.jsx` — classic Combat tab's rest buttons re-pointed at the shared helpers. **Behaviour identical; no visual change.** This is the only edit outside Session mode and it is a refactor, not a feature change
- `src/features/characterSheet/characterSheet.css` — `.cs-sm-slot-row`, `.cs-sm-pip`, `.cs-sm-rest`, `.cs-sm-slots-head`; new keyframes `csSlotSpend` / `csSlotRestore`; extend the existing `@media (prefers-reduced-motion: reduce)` block
- `design/app-overview.md`, `design/design-system.md` — feature-builder updates (Session-mode right-column description; `.cs-sm-slots-*` class group)

**No backend change, no new endpoint, no new field, no added polling.**

---

## 16. Open questions

1. **Rest visibility in the shared roll feed (story OQ-4).** Recommend: Long Rest posts one
   line, Short Rest posts nothing (§14). Genuinely your call — cut it and nothing else changes.
2. **The 3s `↺ UNDO` window (§5.2).** Recommend keeping it — it costs no resting pixels and
   covers the wrong-row mistake the inverse tap doesn't. The single cheapest thing to cut
   if you want the minimum diff.
3. **Hiding `SHORT REST` when no pact slots exist (§13).** Recommend hiding. Alternative:
   show it permanently disabled. Note the underlying data limitation: `isPactMagic` is the
   only short-rest recovery the model knows about, so Wizard Arcane Recovery and similar
   class features have no representation today — out of scope here, flagged so it isn't
   mistaken for a bug.
4. **Verify before building (for `code-architect`):** does the classic Combat tab's Long
   Rest currently also restore `hitDiceCurrent`? §11 says match it exactly, whatever it
   does — but it must be *checked*, not assumed. And it must **not** pick up the DM
   party-wide version's `hpCurrent = hpMax` restore.
5. **Should casting from Story 57's Attack Bar auto-spend a slot?** Today the bar *reads*
   slots (`data-state="spent"` → `SLOTS 0`) and never writes them. Recommend leaving it
   that way in this story — auto-spend plus manual pips would double-count, and "did that
   roll consume a slot" needs its own explicit design. Strong, cheap follow-on; flagged so
   it isn't lost.

---

## 17. Cross-references

- **Story 59 (simplify profile view) — this story is its declared prerequisite.** It closes
  brief OQ-1 exactly as recommended there: "a small follow-on that makes session mode's
  slot pips tappable (spend/restore) and adds Short/Long Rest there." On ship, Story 59's
  Combat-tab removal proceeds with no functional regression. Story 59's OQ-2 (the 0–6
  exhaustion stepper) is a **separate** gap and is *not* closed by this story.
- **Story 57 (attack targeting)** — the Attack Bar's spell chips read the same `spellSlots`;
  a pip tap here must be reflected in `data-state="spent"` within one poll/nudge. This
  story does **not** make the bar write slots (OQ-5). Story 57 §3.2's rationale for the
  fixed bar ("check spell slots before rolling without losing your declaration") is the
  single strongest argument for §3's placement decision.
- **Story 58 (session inventory editing)** — reuses its rebase-at-commit rule, its
  poll-quiescence rule, and its write-failure vocabulary verbatim. Do not author second
  versions of any of the three.
- **Story 56** — does **not** reuse `.cs-spell-row-enter`. Different motion, different
  meaning (arrival vs. recovery). New keyframes, stated so the implementer doesn't guess.
- **Story 52** — borrows only the *concept* of the mount/freshness gate, so arriving at the
  page never plays a phantom refill sweep (§8, remote change).
- **Story 16 (tier principle)** — applied here as the reason the rest buttons are quiet
  header ghosts rather than full-width primary buttons.
- **DM dashboard rests** (party-wide + `QuickActionPopover` per-character) — unchanged by
  this story, but should end up calling the same `applyShortRest`/`applyLongRest` helpers
  so the two paths can't drift. Flagged for `code-architect`, not specced here.
