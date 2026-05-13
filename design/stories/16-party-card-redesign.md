# Story 16 — DM Party Card Redesign

## Goal

Redesign the DM party card to establish a clear visual hierarchy between combat-critical information and administrative information. The current card has accumulated features without a deliberate tier structure — coin and XP panels occupy the same visual weight as HP, passive ability badges use the same chip style as active conditions, and the notes strip pushes all sibling cards down when expanded. The result is a cluttered surface that slows the DM during live play, the primary usage context.

The redesign does not remove features. It reorganises them so the DM's eye finds HP and active conditions instantly, spell slot depletion is readable at a glance, and secondary information (coin, XP) reads as secondary rather than equal.

---

## UX Design

### Design principles applied

**Sparse-first**: Design for the no-conditions, no-notes baseline as the default. Rows that have no content don't render at all — they don't leave empty placeholder space. The minimal card is not a stripped card; it's the normal healthy-party state.

**Visual tiers by combat relevance**:
- Tier 1 (combat-critical): HP, death saves (0 HP only), conditions, concentration, inspiration
- Between-tier: spell slot pips (read-only, caster-only, below active conditions)
- Tier 2 (secondary): XP progress, coin summary
- Tier 3 (on-demand): DM notes

**Card element order** (top to bottom):
1. HP block (stepper + ⚔/✦ buttons)
2. Death saves (0 HP only — dashed pip rings, "player-reported" label)
3. Active conditions (color-coded chips, concentration, inspiration)
4. Spell slot pips (caster-only, below conditions)
5. Tier 2 divider
6. XP strip / Coin strip

**Conditions vs. passive traits**: The current card shows passive character abilities (BACKSTAB, AWARENESS, RITUAL CASTER) in the same chip style as active conditions (POISONED, FRIGHTENED). Passive traits are not useful information for the DM mid-combat — a player manages their own abilities, and the DM doesn't need to see "BACKSTAB" to make a decision. That space is reclaimed for active conditions only. Passive traits move to the ⋯ overflow popover or are removed from the DM card entirely. They remain on the full character sheet.

---

### Tier 1a — Always-visible header (restructured to eliminate dead row)

Portrait · character name · race/class/level · AC badge · ⋯ button · ↗ Sheet link.

**Previous layout:**
```
[Portrait]  Name                    [AC badge]
            RACE · CLASS · LVL N
                                    [⋯ button]
                                    ↗ SHEET
```
The AC badge, ⋯ button, and ↗ Sheet link were stacked in a flex column at the right. This forced the header to be three rows tall even though the identity block (name + meta) only needed two. The ⋯ and ↗ Sheet row was dead space on the identity side.

**New layout:**
```
[Portrait]  Name              [⋯]  [AC badge]
            RACE · CLASS · LVL N · ↗ SHEET
```
The header is now always exactly two rows tall — matching the identity block height.

- **⋯ button** moves to the name row, right-aligned within the identity column (`margin-left: auto`). It sits in space that was already allocated to the name row, sharing it without adding height. Size reduced slightly to 24×24px (was 28×28px) since it is no longer the only element in its row.
- **↗ Sheet link** moves to the meta row, right-aligned within the identity column. It reads as a secondary action on the identity line rather than a standalone element. The muted color it already had makes it subordinate to the meta text without any additional treatment.
- **AC badge** remains as the sole element in the right grid column. It is visually prominent at top-right, unchanged in size or style.

Grid template unchanged: `52px 1fr auto` (portrait | identity | AC). Only the contents of the identity cell and the right cell have changed.

**Height saving:** approximately 28px per card in the minimal and combat-active states (the entire third row of the old actions column). This gives that space back to the HP block and combat stats below, which is where the DM's eye actually needs to be.

**Long names:** the `.char-name` element already has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and `min-width: 0` to allow flex truncation. The ⋯ button is `flex-shrink: 0` so it is never squeezed out — the name truncates before the button disappears.

**Mobile (320px):** the same two-row structure holds. At 320px the identity column is narrower but both action elements are fixed-width, so neither wraps to a new line. The meta text may truncate (`text-overflow: ellipsis`) before the Sheet link is crowded.

---

### Tier 1a (continued) — HP block, redesigned Damage/Heal

**Previous design**: HP number + stepper row, then a separate full-width `⚔ Damage / ✦ Heal` button row below, consuming significant card height even when never used.

**New design**: The ⚔ and ✦ buttons move into the stepper row itself, to the right of the `+` button. They shrink to compact 28px-height icon-labeled buttons (`⚔` and `✦` only, or with very short labels). This gives the DM one-tap access to the damage/heal modal without dedicating an entire row to large buttons.

The stepper (−/bar/+) remains as-is for quick ±1 adjustments. Larger adjustments open the DamageHealModal (unchanged).

HP color logic is unchanged: danger threshold at 20% turns the HP number and card border red.

---

### Tier 1b — Active status (conditional row)

**Active conditions** use color-coded chips that are visually distinct from everything else on the card:
- Red chips: damage/debuff conditions (Poisoned, Blinded, Stunned, Paralyzed, Petrified)
- Amber chips: movement/physical conditions (Prone, Grappled, Restrained, Exhausted)
- Blue chips: perception/awareness conditions (Deafened)
- Purple chips: fear/mental conditions (Frightened, Charmed, Incapacitated)

Each chip has an inline `×` to remove it — no confirmation needed (matches existing behavior).

**Concentration indicator**: pulsing dot + spell name, in the character's own palette accent color. This is visually separate from condition chips — it never looks like a condition.

**Inspiration indicator**: small gem dot + "Inspired" label, in the character's gem color.

This row renders only when at least one of the above is present. When a character has no conditions, no concentration, no inspiration, the row does not exist — no empty whitespace.

---

### Spell slot pips — new, caster-only strip

**This is new functionality absent from the current card.**

A compact horizontal strip appearing **below the active conditions row**, visible only for characters with `spellSlots` configured. Conditions are Tier 1 combat-critical; slot pips are a secondary resource reference — they always render below the status row, never between death saves and conditions.

Layout: `Slots` label (36px) · one group per spell level · separators between levels. Each group shows the level number (9px) + one pip per slot. Filled pip = remaining. Hollow pip = used. Pip size: 9×9px circles.

This gives the DM immediate visual information: "Aesop's 3rd-level slots are gone" without any interaction. Warlock Pact Magic renders a single group (e.g., `5 ●●` for 2 5th-level pact slots).

No interaction on the pips — slot management remains in the ⋯ overflow (Short Rest / Long Rest) and the character sheet. The DM reads slot state; the player manages it.

---

### Death saves — new, 0 HP only

**This is new functionality absent from the current card (a known gap in the app).**

When `hpCurrent === 0`, a death save row appears immediately below the HP block, before the conditions row:

```
Death Saves  [● ● ○]  /  [● ○ ○]
             successes     failures
                                    player-reported
```

Success pips: filled green = rolled success, hollow green-tinted = empty.
Failure pips: filled red = rolled failure, hollow red-tinted = empty.

This row is visually marked with a subtle red-tinted background strip so it stands out even in peripheral vision. It disappears entirely when HP > 0.

**Player-reported visual treatment**: Death save pips are read-only — they reflect the value the player last updated on their own character sheet, not data the DM has verified. A wrong save count displayed with full visual confidence could create false assurance during a downed-character situation.

To signal this provenance:
- All pip rings (both success and failure, filled and empty) use **dashed circle outlines** instead of solid borders. The dash pattern communicates "this is an estimate / last known value."
- A small `player-reported` label in 9px muted italic appears directly below the death save row, right-aligned.
- The red-tinted background band is kept as-is — it still draws the eye at 0 HP.

When death saves become writable (future story), the dashed pip style and the "player-reported" label are removed, replaced by solid pips with interactive behavior.

*Note: Death save state is not yet writable (known gap, story 06). The pips render in read-only display mode initially. Making them interactive is a follow-up task.*

---

### Tier 2 — Secondary information (compact single-line strips)

**XP strip** (XP-mode characters only):

Previous design: full panel with a large number, progress bar, and `+` button — same visual weight as the HP panel.

New design: a single 20px-tall line:
```
XP  [thin 4px bar]  14,200 / 23k  [tiny + button]
```

Font sizes: bar label 10px, value 12px Cinzel, max 10px. The `+` award button is 20×20px, small enough to not attract the eye until needed. The bar communicates progress at a glance without requiring number reading.

**Coin strip** (always present):

Previous design: full panel with label, GP pill, and `Give` button — same visual weight as XP.

New design: a single compact line, with two display modes depending on how the character's coin is stored:

**GP-only mode** (`coinMode: "gp"`): character stores only a single gold value. Simple pill, no conversion, no expand toggle. Give is always visible inline:
```
GP  [240 gp]  [Give]
```

**Multi-denomination mode** (`coinMode: "multi"`): character has a mixed purse (cp/sp/ep/gp/pp). Showing all five denomination pills inline does not scale — the label and Give button can overlap at card width. Instead, the strip uses a collapsed/expanded pattern:

*Collapsed (default):*
```
GP  [≈ 131.52 gp]  [↓]
```
The `≈` prefix (rendered smaller and muted) signals this is a GP-equivalent total, not a literal amount. The `[↓]` is a 20×20px ghost expand button. Give is hidden in this state — the collapsed view is read-only at a glance.

*Expanded (after tapping `[↓]`):*
```
GP  [≈ 131.52 gp]  [↑]
    [12 cp]  [34 sp]  [0 ep]  [88 gp]  [4 pp]  [Give]
```
The summary line stays in place (it does not move or reflow). The denomination row appears directly below it, indented past the label. Each denomination uses a small pill chip with a metallic color tint appropriate to the coin type (copper/silver/electrum/gold/platinum). Give sits at the end of the denomination row and is only visible when expanded. Tapping `[↑]` collapses back to the summary.

**GP equivalent conversion rules:**
- 1 PP = 10 GP · 1 GP = 1 GP · 1 EP = 0.5 GP · 1 SP = 0.1 GP · 1 CP = 0.01 GP
- Round to 2 decimal places
- If the total is a whole number, show no decimals (e.g., `5 gp` not `5.00 gp`)
- If zero, show `0 gp`

Both strips are separated from Tier 1 by a single 1px divider line. They read as footnotes to the card, not as equal-weight sections.

---

### Tier 3 — DM Notes (collapsible, non-disruptive expansion)

The current inline expansion that shifts all cards below it down is the most disruptive UX pattern on the dashboard. Every time a DM opens notes on the first card, every other card moves.

**New behavior**: The notes strip expands within the card's own layout. The card grows taller in place. The DM's eye stays on the open card.

The strip bar behavior is unchanged in structure, with one refinement to the count badge system:

- No notes, collapsed: faint `+ Note` label with note icon.
- Has notes, collapsed: accent-tinted background + count badge(s) in the header. Two distinct badge types, each shown only when non-zero:
  - **DM notes badge** — stroked circle, no fill. The ring uses the card's accent color; the number sits inside on a transparent background. Communicates "authored by me, familiar/mine." (`○2` style)
  - **Player-shared badge** — filled circle using the accent color as fill, with the number cut out in the card's background color (knockout effect). Communicates "incoming/foreign, highlighted." (`●1` style)
  - When only one type is present, only that badge appears. When both are present, they sit side by side: `○2  ●1`. When both are zero, no badges shown.
  - Both badges are ~16px diameter to match the existing strip height.
- Expanded: shows DM note list with delete buttons, player-shared notes section (if any), and inline add-note input.

The expansion should use a CSS `max-height` transition (0 → auto via `max-height: 500px` with `overflow: hidden`) rather than changing sibling card layout. This keeps the notes panel feeling lightweight.

*Implementation note for feature-builder: the current `NotesStrip` component is self-contained and handles this well. The key change is removing the full-card-height expansion that pushes siblings down — in practice this may already be card-contained; if not, a `max-height` transition approach will resolve it.*

---

### Passive abilities — demoted from card

**Skills, spells, and special abilities badges are removed from the party card.**

Rationale (informed by DM domain expertise): Passive abilities like BACKSTAB, AWARENESS, STEALTH advantage, RITUAL CASTER tell the DM what a player *can* do. The player manages their own actions — the DM doesn't make those choices. Mid-combat, the DM reads these badges and gets no actionable information. The space is better used for status information that actually changes per round.

Where they move:
- Full character sheet: unchanged (players and DM can read them there via the ↗ Sheet link).
- ⋯ overflow popover: could add a "View abilities" section if the DM genuinely wants a quick reference — but this is intentionally not a first-class card feature.

---

### Three card states

**State 1: Minimal** (no conditions, no concentration, no inspiration, milestone leveling, no notes)

```
[Portrait]  Name                [⋯]  [AC]
            Race · Class · Lvl N ↗ Sheet
  NN / NN  [− ██████░░ + ] [⚔] [✦]
  ──────────────────────────────────
  GP  [● NNN gp]  [Give]
  ──────────────────────────────────
  [note icon] + Note                   ▼
```

The card is compact. No empty rows. For casters, a slot strip appears between HP and the tier-2 divider.

**State 2: Combat-active** (conditions, hp ≤ 20%, active turn glow)

```
[Portrait]  Name                [⋯]  [AC]
            Race · Class · Lvl N ↗ Sheet
  11 / 60  [− ██░░░░░░ + ] [⚔] [✦]
  [Poisoned ×] [Frightened ×]
  ──────────────────────────────────
  GP  [● NNN gp]  [Give]
  ──────────────────────────────────
  [note icon] DM Notes  [○2]           ▼
```

Active-turn card adds `scaleX(1.025)` + a bottom glow bar in the character's palette accent color. The border does not become a full glow box (that shifts layout); only the bottom bar animates.

**State 3: Full-featured** (XP mode, notes expanded, all conditions, death saves at 0 HP, mixed-denomination coin collapsed)

```
[Portrait]  Name                [⋯]  [AC]
            Race · Class · Lvl N ↗ Sheet
  0 / 38  [− ░░░░░░░░ + ] [⚔] [✦]
  ──── Death Saves ─  [● ● ○] / [● ○ ○]
                                player-reported
  [Unconscious ×]
  Slots  1:[●●○○]  2:[●○○]  3:[○○]
  ──────────────────────────────────
  XP  [══════════░░]  9,100 / 23k  [+]
  GP  [≈ 131.52 gp]  [↓]
  ──────────────────────────────────
  [note icon] + Note                   ▼
```

When the DM taps `[↓]` to inspect the purse, the denomination row expands below the GP line:
```
  GP  [≈ 131.52 gp]  [↑]
      [12 cp] [34 sp] [0 ep] [88 gp] [4 pp]  [Give]
```

At maximum density the card is taller than the minimal state but every element is scannable. The death-save row is the only element with a colored background band — it draws the eye immediately at 0 HP. The coin strip in mixed-denomination mode stays as a single clean line by default — the breakdown is one tap away but does not impose its full width on the card's resting state.

---

### What was demoted and why

| Element | Previous | New | Reason |
|---|---|---|---|
| ⚔ Damage / ✦ Heal buttons | Full-width row below HP | Compact icon buttons inline with stepper | Functionally the same (opens modal) but 28px instead of ~40px of card height |
| Coin panel | Full panel, equal weight to HP | Single compact strip; GP-only shows pill+Give inline; multi-denom shows collapsed GP-equivalent with expandable purse | DM gives coin between encounters, not mid-fight; the collapsed total is sufficient for at-a-glance reference; denomination breakdown available on demand |
| XP panel | Full panel with large number | Single compact strip with bar | XP is a post-combat administrative action; the thin bar communicates "close to level up" visually without demanding attention |
| Passive ability badges | Inline chip row (same style as conditions) | Removed from card | No DM decision is informed by BACKSTAB mid-combat; space reclaimed for conditions |
| Notes expansion | Inline strip, expands and shifts all siblings down | In-place card expansion via max-height | DM writes quick notes without disrupting the layout of the whole party column |

### Saves & Passive Perception strip

**Always-visible, non-expandable strip.** Sits immediately above the Tier 2 divider — below the spell slot pips for casters, directly below the HP block for non-casters.

**Position in card order** (updated):
1. HP block (stepper + ⚔/✦ buttons)
2. Death saves (0 HP only)
3. Active conditions (color-coded chips, concentration, inspiration)
4. Spell slot pips (caster-only)
5. **Saves strip** ← new, always rendered
6. Tier 2 divider
7. XP strip / Coin strip

**Layout — single horizontal line:**

```
PERC 14    WIS +1 · CON +2 · DEX +3
```

- `PERC` label: 9px IM Fell English, uppercase, `var(--text-muted)`. Immediately followed (3px gap) by the Passive Perception value.
- **Passive Perception value**: 13px Cinzel, palette accent color (e.g. `#8ab4c8` for Ocean). Slightly larger than the save values — it's the most queried figure.
- **Divider dot**: 2px circle, `var(--text-muted)` at 40% opacity, 8px horizontal margin on each side. Visually separates PERC from the save triad without introducing a line.
- **Save triad** (WIS · CON · DEX): each as a `<label><value>` pair. Label: 9px IM Fell English, `var(--text-muted)`. Value: 11px Cinzel, `var(--text-body)` (neutral, not accented — secondary to PERC). Pairs separated by `·` middots at 45% opacity.
- The strip has a `border-top: 1px solid` using the same palette-tinted border color as the slots strip (`rgba(accent, 0.12)`).
- Strip padding: `5px 14px 5px 18px` (consistent with `slots-strip`).

**Why horizontal rather than two-column:** A horizontal left-to-right read matches the DM's natural scan direction. The slight size difference (13px PERC vs. 11px saves) signals importance without requiring color or bold contrast changes. The strip is short enough to fit comfortably at 360px card width without wrapping.

**Data sources:** Passive Perception = 10 + WIS modifier + Perception proficiency bonus (computed, not stored separately). WIS/CON/DEX save modifiers are already on the character data shape (`stats[].mods[]` with attribute names matching `MOD_ATTRIBUTES`). No new DynamoDB fields required.

---

### What was added and why

| Element | Why |
|---|---|
| Spell slot pips | DM consistently needs to know caster resource state mid-combat. "All 3rd-level slots gone" changes encounter calibration. Currently absent from the card. |
| Death save row (0 HP) | Critical life-or-death information at 0 HP. Currently the card shows `0 / 38` but no save tracking context at all. |
| Condition color coding | Red/amber/blue/purple chips make condition severity scannable without reading every label. Active conditions already had color (via `conditionStyle()`), but the new design makes the system explicit and distinct from the passive-ability chips that are now removed. |
