# Session Inventory Editing — Design Brief

> Story 58. Bring item creation, coin, and XP into Session mode's Loadout sub-tab so loot
> gets logged where the player is already looking, at the moment it happens.
>
> Produced by design-strategist. Implementation spec for ux-designer.

**Tier: 2 for the ledger band (coin/XP — ambient, always readable, never competing with HP or
conditions). Tier 3 for item creation (on-demand; zero resting footprint beyond one affordance
row per column).**

---

## 1. Design intent

Session mode's Loadout tab stops being a read-only printout and becomes a **capture surface**:
the player says what they just picked up in one line of typing and it's on the sheet. The coin
and XP strips make the two numbers that change most during play visible without a mode switch —
readable at a glance, adjustable in three taps.

---

## 2. The replace-vs-add decision (story OQ-1) — RECOMMENDATION: strictly additive

Keep the classic edit-mode `+ Add Weapon` / `+ Add Item`. They are not duplicates; they are two
different acts on the same array:

| | Session Loadout (new) | Classic edit mode (unchanged) |
|---|---|---|
| Act | **Capture** — "log it before the party moves on" | **Authoring** — "define what this thing does" |
| Auth | None (ADR-005, matches every other session write) | Owner/DM password |
| Fidelity | Name (+ optional qty), repeatable | Full: mods, type, description, attunement |
| Cadence | Several per session, seconds each | Once per item, between sessions |

Removing the classic controls is a Story 59 call (Profile-tab simplification), not this story's.
State this in the story so it isn't re-litigated. (Rejected: replacing classic outright — that
would make the modifiers editor unreachable without also deciding the auth question in §8.)

## 2b. The modal-vs-inline decision (story OQ-2) — RECOMMENDATION: inline first, modal on demand

**Neither pure option.** A full `ItemEditorModal` for "+1 torch" is a wall of checkboxes over the
map on a phone, and it imports the *editing* mental model Session mode has otherwise avoided. A
name-only quick-add with no escape hatch strands anyone who actually knows the item's stats.

**Ship: an inline compose row as the default path, with a one-tap `⋯` escalation into the existing
`ItemEditorModal`, pre-seeded with whatever's already typed.** Zero new editor built; full parity
available; the modal only appears when the player asks for it.

Three ergonomics that make the inline path the right default:
1. **The column chooses the array.** Tapping `+ WEAPON` vs `+ ITEM` is the type decision — no
   picker, no radio group.
2. **Repeat capture.** On commit the row lands in the list and the input **clears and stays
   focused**. A hoard is four items, not one.
3. **Comma-bulk, reusing Story 56's exact pattern.** `Rope, Torch, Rations` + Enter creates three
   rows with Story 56's `.cs-spell-row-enter` keyframe and its existing stagger constants (140ms
   ease-out, 40ms stagger, capped at index 5). Do not mint a second stagger constant.

**Trailing-quantity parse (equipment only):** a trailing ` xN` / ` ×N` (case-insensitive,
whitespace-preceded, end of string) sets `qty`. `Arrows x20` → `{ name: "Arrows", qty: 20 }`.
Applied per comma-segment. Flagged in §12 as overridable.

---

## 3. What earns its place (the reduction)

Two 44px affordance rows and a ledger band are added to a panel that is currently pure list. Paid
for by:
- **The `+` row *is* the empty state.** An empty column renders only `+ WEAPON` — no "No weapons"
  line above a button. One element, both jobs.
- **The compose row *replaces* the `+` row** when open; it never stacks below it.
- **The ledger band renders only what exists.** Milestone character → no XP strip at all. `gp`
  coin mode → one 36px row, not five denominations.

---

## 4. Information hierarchy + layout

Most → least prominent inside the Loadout sub-tab:
1. Item names (the list — unchanged, this is what the tab is for)
2. GP total (Cinzel 28px `--pal-gem` — the number that changes most)
3. Qty numerals `× N`
4. `+ WEAPON` / `+ ITEM` affordances (ghost, Tier 3 — present, not advertised)
5. XP bar + numerals
6. Attunement meta, type tags, denomination chips

```
.cs-sm-loadout-panel
  .cs-sm-ld-grid                              — 2col ≥560px, 1col below
    .cs-sm-ld-col[data-kind="weapons"]
      .cs-sm-ld-colhead                       — "WEAPONS" label (existing)
      .cs-sm-ld-list
        .cs-sm-ld-row × n                     — existing read row, UNCHANGED
      .cs-sm-add[data-state="idle"]           — 44px ghost row, dashed 1px --pal-border, "+ WEAPON"
      .cs-sm-add[data-state="open"]           — same element, expanded to compose
        .cs-sm-add-input                      — autofocus, maxlength 60, .input-base
        .cs-sm-add-qty                        — equipment column only; "× N" chip, tap to edit
        .cs-sm-add-commit                     — "ADD" 44px, .btn-primary
        .cs-sm-add-details                    — "⋯" 44px, .btn-ghost → ItemEditorModal
        .cs-sm-add-hint                       — "Comma-separate for several"  (11px, shown once)
      .cs-sm-add[data-state="error"]          — inline retry, typed text preserved
    .cs-sm-ld-col[data-kind="equipment"]      — same, + qty chip
  .cs-sm-ledger                               — renders only if it has content
    .cs-sm-purse[data-mode="gp"|"full"]
      .cs-sm-purse-gp                         — ⧫ glyph + Cinzel 28px total, 44px tap target
      .cs-sm-purse-denoms                     — full mode only: cp/sp/ep/pp chips, fixed 4-slot rail
      .cs-sm-pad[data-open]                   — inline delta pad (shared with XP)
        .cs-sm-pad-seg                        — [− SPEND][+ GAIN][= SET]
        .cs-sm-pad-input                      — numeric, autofocus
        .cs-sm-pad-chips                      — 1 · 5 · 10 · 25 · 50 · 100
        .cs-sm-pad-commit                     — "APPLY" 44px
        .cs-sm-pad-drift                      — "+50 gp from the DM — applied to new total"
    .cs-sm-xp[data-state="normal"|"ready"]    — only when levelingMode === "xp"
      .cs-sm-xp-bar
      .cs-sm-xp-nums                          — "6,400 / 14,000 · LVL 5"
      .cs-sm-xp-add                           — "+ XP" 44px → same .cs-sm-pad
```

**Order: list → coin → XP.** Deliberately diverges from the classic Inventory tab's
grid → XP → coin (rejected: matching classic — coin changes ten times more often mid-session and
is conceptually part of inventory; XP is progression, not loadout).

**Coin editing is a delta pad, not a stepper** (rejected: ±1 hold-to-repeat — getting from 12 gp
to 137 gp is punishment). It borrows the DM `DamageHealModal`'s established vocabulary — big
number, preset jumps, direct input, explicit confirm — but **inline, not modal**: Session mode's
other live writes are all in-place. `= SET` exists so a mis-entry is correctable without arithmetic.

**Full coin mode: fixed 4-slot rail for cp/sp/ep/pp, zeros dimmed to 0.4 but present.** Positional
stability beats sparse here — the player learns "pp is rightmost" and the row must not reflow on
every transaction. GP stays the dominant numeral above them.

**XP is lighter than coin on purpose** — the DM awards it party-wide from the dashboard; the player
side is correction/logging. Slim bar + `+ XP`, GAIN-default, chips `10 · 25 · 50 · 100 · 250 · 500`.
**Crossing the next threshold never auto-levels** (level is a definition field). The bar fills to
100%, holds a one-shot gold pulse, and the numerals become `LEVEL 6 READY` in the counter-wheel
completion gold — the app's existing "you completed something" vocabulary.

---

## 5. Colour tokens

| Token | Role |
|---|---|
| `--pal-border` | Compose row dashed border (idle), pad hairlines |
| `--pal-accent` | Compose row border on focus; `+` glyph at 0.7 |
| `--pal-accent-bright` | `ADD` / `APPLY` label; active pad segment |
| `--pal-accent-dim` | Active pad segment background |
| `--pal-gem` | GP total; qty numerals; XP bar fill |
| `--pal-text` | Item names in compose input |
| `--pal-text-muted` | Labels, denomination chips, hint text, zero-value denominations |
| `--pal-surface` | Pad background, compose input background |
| `#c06060` | Write-failure text; negative-balance guard (universal, not palette-derived) |
| `#f2e8d2` → `#c8ae84` | XP threshold-crossed gold pulse — reuse counter-wheel completion gradient verbatim |

No new palette entries.

---

## 6. Motion & animation spec

```
Compose row opens:
  Trigger:      tap "+ WEAPON" / "+ ITEM"
  Animation:    row height 44 → 92px (equip: 92px incl. qty chip); border-style dashed → solid;
                border-color --pal-border → --pal-accent; input opacity 0 → 1 (90ms, 60ms delay)
  Duration:     180ms, cubic-bezier(0.2, 0.8, 0.2, 1)
  Communicates: "the affordance became the thing" — not a new panel, the same element grew

Row commits (single or comma-bulk):
  Animation:    REUSE Story 56's .cs-spell-row-enter verbatim — opacity 0→1 + translateY(-4px→0),
                140ms ease-out, 40ms stagger, capped at index 5
  Communicates: "these arrived together, read them top-down"
  Note:         same keyframe, new selector. Do not author a second stagger constant.

Compose input resets after commit:
  Animation:    none. Instant clear, focus retained, caret at position 0.
  Communicates: "go again" — the single most important non-animation in this brief

Write failure (add):
  Animation:    the optimistic row fades + collapses out (200ms ease-out); compose row reopens
                with the typed text restored and border → #c06060 for 900ms
  Communicates: "it didn't land, and you haven't lost your typing"

Purse pad opens:
  Trigger:      tap the GP total / a denomination chip / "+ XP"
  Animation:    max-height 0 → measured + opacity 0 → 1
  Duration:     160ms ease-out
  Communicates: "adjust it here, in place"

Value lands (coin or XP total changes, local or remote):
  Animation:    the CHANGED NUMERAL only — colour → --pal-accent-bright, scale 1 → 1.12 → 1
  Duration:     500ms ease-out
  Communicates: "that number just moved" — same 500ms value-flash the Story 51 DM drawer uses

Remote drift while the pad is open:
  Animation:    .cs-sm-pad-drift slides down 4px + fades in, 140ms ease-out; holds until commit
  Communicates: "someone else changed this; your amount is being applied to the NEW total"

XP threshold crossed:
  Animation:    bar width → 100% (420ms ease-out), then one-shot gold pulse
                (box-shadow 0 → 10px → 4px, 620ms ease-in-out) + numerals swap to "LEVEL N READY"
  Communicates: "you've earned it — go level up between sessions"
  Note:         fires once per crossing, never on re-render or poll echo

Add affordance at rest:
  none. Instant, static. A Tier-3 affordance does not animate itself into notice on a surface
  that also carries an HP hero card and a concentration pulse.
```

## 7. Reduced-motion table

| Animation | `prefers-reduced-motion: reduce` |
|---|---|
| Compose row opens | Instant height change; no border transition |
| Row commits / comma-bulk stagger | Instant append, all rows at once, no stagger, no translate |
| Write-failure collapse | Instant removal; the 900ms `#c06060` border hold is kept (it's information) |
| Purse pad opens | Instant |
| Value-lands flash | 500ms colour hold, no scale |
| Remote-drift note | Instant appear |
| XP bar fill | Instant width; gold pulse becomes a 620ms static gold border hold |

---

## 8. Interaction model

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| `+ WEAPON` / `+ ITEM` | Tap (44px) | Row expands to compose, input focused | — | Tap outside, `Escape`, or empty-input blur → collapses to idle |
| Compose input | Type | — | `Enter` or `ADD` commits (comma-splits) | `Escape` (text preserved for 30s, then dropped) |
| `ADD` | Tap (44px) | Row appears optimistically at list end; input clears, keeps focus | `patchSession({ weapons \| equipment })` | None — use the row's existing Drop Item |
| `⋯` details | Tap (44px) | `ItemEditorModal` opens seeded with typed name + parsed qty | Modal's own `Add Item` commits | Modal Cancel returns to the compose row, text intact |
| Qty chip (equip only) | Tap | Inline number input | Included in the commit | Clear → no `qty` key written |
| GP total | Tap (44px) | Pad opens, `+ GAIN`, input focused | `patchSession({ coin })` on `APPLY` | Tap outside / `Escape` |
| Denomination chip (full mode) | Tap (44px) | Pad opens scoped to that denomination | as above | as above |
| Pad chip (`25`, `50`…) | Tap | Adds to the input value (accumulates: 50 + 50 = 100) | — | Tap `⌫`/clear |
| `+ XP` | Tap (44px) | Pad opens, `+ GAIN`, XP chip set | `patchSession({ xpCurrent })` | as above |
| Existing item rows | — | **Unchanged.** Equip/attune/qty/potion-use/drop all behave exactly as today | | |

**Explicit non-interactions** (so they aren't guessed): no swipe-to-delete; no drag-reorder in
session mode; no editing an existing item's name/mods from Session mode (story scope — `⋯ Details`
is add-only); no long-press (reserved by Story 57's targeting gesture on the adjacent Map sub-tab).

**Session-mode `ItemEditorModal` renders with the Modifiers section hidden (`showMods={false}`).**
Reason: ADR-005 draws the auth line at *state* vs *definition*. Qty, attunement, and equipped are
state; a `+5 Armor` mod recomputes every derived stat on the sheet and is definition. An
unauthenticated surface should not mint arbitrary mods. Everything else in the modal (name, type,
qty, attunement, equipped, description) is present. Flagged in §12 — this is a one-prop reversal
if the table disagrees.

---

## 9. Data contracts, sync & freshness

All writes: `patchSession(slug, fields, null)` — no auth, matching every other Session-mode write.
Fields touched: `weapons[]`, `equipment[]`, `coin{}`, `xpCurrent`. **No new fields.**

| Rule | Behaviour |
|---|---|
| **Rebase at commit, never at open** | Adds append to the **latest polled array** at the moment `ADD` fires, not to the snapshot present when the compose row opened. Coin/XP commits apply the **signed delta to the freshest polled base**. This is the difference between a safe merge and a silent clobber. |
| Remote drift while the pad is open | Don't swallow it. Recompute the base, show `.cs-sm-pad-drift` (`+50 gp from the DM — applied to new total`), keep the entered amount. Never overwrite what the player typed. |
| Optimistic | Yes for all four writes. Row/numeral updates instantly, reconciles on next poll/WS nudge. |
| Failure | Add: row fades out, text restored to the compose input, `#c06060` border 900ms + inline `Couldn't save — tap to retry`. Coin/XP: revert the numeral, pad stays open with the amount intact. Never a toast that loses the input. |
| **Poll quiescence** | While the compose input or the pad has focus, incoming polls must not re-sort, re-animate, or re-mount the list beneath. New remote rows append silently and value-flash. Same rule as the Story 51 DM drawer. |
| New item shape | `{ id: uid(), name, description: "", mods: [], equipped: true }` (+ `qty` when parsed/entered). No `type`, no attunement keys — omitted, never `""`/`null`. Matches `ItemEditorModal`'s own defaults. Reuse Story 56's `uid()`. |
| Negative guard | A `− SPEND` larger than the current balance clamps to 0 and flashes the numeral `#c06060` for 400ms rather than going negative or blocking. Same for XP. |
| Staleness tolerance | 1s (WS-connected: sub-second). A ≤2s-stale coin base is acceptable because commits are deltas, not absolutes — this is why `= SET` is the exception that must always rebase-and-warn. |
| Story 36b | The stale-client auto-reload already defers while a text input is focused or a modal overlay is open — the compose row and pad inherit that protection with no new work. |

---

## 10. Size-degradation ladder

| | ≥900px (two-column session shell) | 560–899px | 380–559px | <380px |
|---|---|---|---|---|
| Loadout grid | 2 columns | 2 columns | 1 column (weapons then equipment) | 1 column |
| `+` affordance | one per column, foot of list | same | one per section | same |
| Compose row | input + qty + ADD + ⋯ on one line | same | same | ⋯ and ADD share a line below the input; row → 118px |
| Compose hint | shown | shown | shown on first open only | hidden |
| Purse (gp mode) | one 36px row | same | same | same |
| Purse (full mode) | GP + 4 denomination chips inline | same | chips wrap to a second line | chips wrap; ep hidden when 0 |
| Pad chips | 6 chips | 6 | 6 (wraps to 2 rows) | 4 (`5 · 10 · 25 · 100`) |
| XP strip | bar + numerals + `+ XP` inline | same | numerals wrap below the bar | `LVL N` label dropped, bar + total only |

Nothing disappears above 380px. The GP total, the `+` affordances, and `APPLY` never truncate at
any step.

---

## 11. Key edge cases

| Case | Behaviour |
|---|---|
| Empty column | The `+` row **is** the empty state — no separate empty line |
| Empty name / whitespace only | `ADD` is disabled (0.4 opacity), `Enter` no-ops. No error text |
| Duplicate name | Allowed silently. Two daggers is a real thing; de-duping would be wrong |
| Name > 60 chars | Hard `maxlength`, no error — the input simply stops accepting |
| Comma-bulk with an empty segment (`Rope,,Torch`) | Empty segments dropped silently, 2 rows created |
| `xN` parse ambiguity (`Potion x2 Healing`) | Only a **trailing** match parses. Mid-string `x2` stays part of the name |
| Milestone character | XP strip absent entirely — not a zero, not a disabled control |
| `coinMode: "gp"` | Denomination rail absent; one GP row only |
| DM edits coin during the same tick | §9 drift rule; the delta is preserved, the base is rebased |
| Character at 0 HP / FALLEN | Fully available and unchanged. Handing someone a potion is exactly a 0-HP moment |
| Player adds an item while the DM's Story 51 loadout drawer is open on that character | New row **appends to the end of its sort group** with the standard 500ms value-flash. **No re-sort of the open drawer** — cross-reference §13 |
| 30+ equipment entries | The sub-tab panel already scrolls; the compose row scrolls into view on open (`scrollIntoView({ block: "nearest" })`, instant under reduced motion) |
| Offline / write fails repeatedly | Two consecutive failures switch the inline message to `Not saving — check your connection`. Text still preserved. No retry storm |
| Vellum (light) palette | Verify the dashed `--pal-border` compose row is visible on parchment; bump to `--pal-text-muted` at 0.5 alpha on `.vellum` if not |

---

## 12. Open questions

1. **Resolved (2026-09-05).** Checked directly against `CharacterSheetViewMode.jsx`: the coin
   section and XP panel both render inside the `combatTab === "loadout"` block (i.e., the
   **Inventory** tab), not Combat. `design/app-overview.md`'s Combat-tab bullet describing this was
   stale documentation, now corrected. Neither is a separate extractable component today — both are
   inline JSX — so there's nothing to reuse with a `variant="session"` prop; the brief's plan to
   author a new `SessionLedger.jsx` (§14) is the right path regardless.
2. **`showMods={false}` in the session `ItemEditorModal`** (§8). Recommended for the ADR-005
   definition/state reason. If your table is fine with unauthenticated mods (3 trusted players),
   it's a one-prop reversal — say so and it ships with mods.
3. **Trailing `xN` qty parsing** — specced on by default for equipment. Off is also defensible if
   you'd rather the qty chip be the only path.
4. **Pad chip denominations** — `1 · 5 · 10 · 25 · 50 · 100` for coin, `10 · 25 · 50 · 100 · 250 ·
   500` for XP. If your campaign deals in hundreds of gp, `10 · 25 · 50 · 100 · 250 · 500` for coin
   too.
5. **Should the classic Inventory tab (view mode, no unlock) get the same no-auth quick-add?** That
   is the more interesting form of OQ-1 and would genuinely obsolete the edit-mode buttons.
   **Recommend deferring to Story 59** rather than widening this story.
6. **Does the DM want any visibility that a player self-added an item?** (e.g. a subtle "new this
   session" mark in the Story 51 drawer.) Out of scope as written; flagging so the absence is
   deliberate.

---

## 13. Cross-references

- **Story 56** — reuses `.cs-spell-row-enter` (140ms / 40ms stagger / cap index 5) verbatim for
  committed rows, the comma-bulk entry ergonomic, and `uid()` for new item ids. No new constants.
- **Story 51 brief (DM card loadout drawer)** — extends its §6 "no re-sort, no re-animate under
  poll" rule to cover *insertion*: a player-added row appends to the end of its sort group with the
  standard 500ms value-flash and does not re-sort an open drawer. Its `⚗N` consumable badge
  value-flashes when a player adds a potion — no change needed there.
- **Story 57** — long-press is reserved on the adjacent Map sub-tab's tokens; this brief adds no
  long-press gesture anywhere in Session mode. The session `ItemEditorModal` reuses the existing
  `.modal-overlay` `z-index: 200`, which correctly covers the Attack Declaration Bar's `150`.
- **Story 36b** — no new deferral logic needed; focused-input and open-modal reload deferral both
  already cover this surface.
- **ADR-005** — this brief takes ADR-005's state/definition line as load-bearing and applies it to
  item *modifiers* for the first time (§8, OQ-2).
- **Story 59** — owns the removal of the classic edit-mode add controls, if wanted. Not assumed here.

---

## 14. Files touched

- `src/features/characterSheet/CharacterSheetSessionMode.jsx` — Loadout sub-tab panel; compose
  state; the four `patchSession` write paths; rebase-at-commit logic
- `src/features/characterSheet/SessionLedger.jsx` *(new)* — purse strip, XP strip, shared delta pad
- `src/features/characterSheet/ItemEditorModal.jsx` — `seedName`, `seedQty`, `showMods` props
- `src/features/characterSheet/characterSheet.css` — `.cs-sm-add-*`, `.cs-sm-purse-*`,
  `.cs-sm-pad-*`, `.cs-sm-xp-*`; reuse `.cs-spell-row-enter`; new `csXpThresholdPulse` keyframe
- `src/features/characterSheet/constants.js` — export `uid()` if not already exported
- No backend change, no new endpoint, no new field, no added polling.

---

## 15. Prototype recommendation

**Yes, but small.** The load-bearing decisions here are *felt, not read*: the repeat-capture rhythm
(does clearing-and-holding-focus actually feel right after the third item?), the comma-bulk stagger
at 4+ rows, and the delta pad's chip-accumulation. Prototype **one column** with the compose row,
comma-bulk, and the purse pad with a button that simulates a remote DM coin change while the pad is
open (the drift case). **Not** the full two-column grid, not the XP bar, not `ItemEditorModal`.
