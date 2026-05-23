# Party Intelligence Panel — Design Brief

> Story 20. The always-visible Passive Perception + Saves strip on the DM party card.
> Produced by design-strategist as the implementation spec for ux-designer.
>
> Scope: the saves strip established by Scenario 4 of `design/prototypes/dm-party-card.html` in implementation-precise detail. Movement speed is folded in as an optional inline append. Full six-save and skill-proficiency surfaces are deferred and flagged as future extensions. Prototype Scenario 4 is the visual ground truth; this brief makes its rules portable across palettes, edge cases, and data realities.

---

## 0. Rules grounding

| Rule | Design consequence |
|---|---|
| Passive Perception = `10 + WIS modifier + (proficiency bonus if proficient) + item mods` | Single computed integer. Most-queried non-combat number — earns headline visual weight. |
| Saving throw bonus = `ability modifier + (proficiency bonus if save-proficient for class)` | Six exist; only WIS · CON · DEX render at rest (see §1). |
| Conditions and items can alter the result | Computation must read live equipped-item mods, exactly like the existing flyout total. |
| Save proficiency is class-determined, not stored in the character record | **Open question §8.** v1 computes from raw ability mod + item mods only; proficiency layer added in follow-on. |

---

## 1. Design intent

The strip exists so the DM never asks the table "what's your Perception?" again. It is a calm, ambient row of numbers that answers three of the four most common non-combat queries — passive sense, dexterity dodge, concentration save — in a single horizontal glance.

**Why WIS · CON · DEX (not the other three)**

- **CON save** — concentration checks. The single most-rolled save in 5e. Mandatory.
- **DEX save** — Fireball, Lightning Bolt, breath weapons, traps. The "evasion save."
- **WIS save** — charm, fear, hold person. The "mental autonomy save."

STR / INT / CHA saves are rolled an order of magnitude less often. They live behind the `⋯` overflow as a future extension (§8).

---

## 2. Information hierarchy

Within the strip (left to right, by visual weight):

1. **Passive Perception value** — 13px Cinzel, palette accent/gem color. Only value with accent color. Largest numeral on the strip.
2. **Divider dot** — faint 2px circle separating PERC from the triad.
3. **WIS · CON · DEX triad** — 11px Cinzel values, muted body-text color. Ordered WIS · CON · DEX (consistent with D&D conventional ordering; DM's eye lands in the same position across cards).
4. **Speed** (conditional) — rightmost, 11px Cinzel, rendered only when ≠ 30 ft or an item mod is present. Renders `0ft` in error red when speed is zeroed by condition.

Within the card stack: **Tier 1c** — below combat-critical (HP, conditions, concentration, slots) but above Tier 2 (XP, coin). Read once per scene transition, not once per round.

---

## 3. Annotated wireframes

### 3a. Saves strip — caster card (below spell slots row)

```
┌────────────────────────────────────────────────────────────┐
│ [portrait]  Eoghan                                     ⋯   │
│             Half-Elf · Warlock · Lvl 8      ↗ Sheet   [AC] │
├────────────────────────────────────────────────────────────┤
│         31 / 44     +5 temp                                │
│  [−] [████████████░░░░░░░░░] [+]    [⚔] [✦]               │
├────────────────────────────────────────────────────────────┤
│  [Poisoned ×]   ◉ Hunter's Mark · CON +2                   │
├──────────────  thin palette-tinted rule  ──────────────────┤
│  SLOTS   5  ○ ○                                            │
├──────────────  thin palette-tinted rule  ──────────────────┤
│  PERC 13 · Wis +1 · Con +2 · Dex +3                       │  ← SAVES STRIP
├══════════════  Tier 2 divider (heavier)  ══════════════════┤
│  GP  [88 gp]  [Give]                                       │
└────────────────────────────────────────────────────────────┘
```

### 3b. Saves strip — non-caster card (directly below HP block)

```
┌────────────────────────────────────────────────────────────┐
│ [portrait]  Aragorn                                    ⋯   │
│             Human · Ranger · Lvl 8          ↗ Sheet   [AC] │
├────────────────────────────────────────────────────────────┤
│         52 / 60                                            │
│  [−] [██████████████████░░] [+]     [⚔] [✦]               │
├──────────────  thin palette-tinted rule  ──────────────────┤
│  PERC 14 · Wis +1 · Con +5 · Dex +6  · 35ft               │  ← SAVES STRIP (with speed)
├══════════════  Tier 2 divider (heavier)  ══════════════════┤
│  GP  [240 gp]  [Give]                                      │
└────────────────────────────────────────────────────────────┘
```

### Element spec

| Element | Font | Size | Color | Spacing |
|---|---|---|---|---|
| PERC label | IM Fell English, uppercase | 9px | `--pal-text-muted` | `letter-spacing: 0.2em`, `margin-right: 3px` |
| PERC value | Cinzel | 13px | `--pal-gem` (accent) | — |
| Divider dot | — | 2px circle | `--pal-text-muted` at 40% opacity | `margin: 0 8px` |
| Save label (Wis/Con/Dex) | IM Fell English, uppercase | 9px | `--pal-text-muted` | `letter-spacing: 0.16em` |
| Save value | Cinzel | 11px | `--pal-text-body` | `gap: 2px` from label |
| Middot separator | IM Fell English | 10px | `--pal-text-muted` at 45% opacity | `padding: 0 5px` |
| Speed value | Cinzel | 11px | `--pal-text-body` (or `#c06060` when = 0) | `margin-left: 12px` before its middot |

### DOM structure (reuse Scenario 4 class names verbatim)

```html
<div class="saves-strip">
  <span class="saves-perc-label">Perc</span>
  <span class="saves-perc-value">14</span>
  <div class="saves-divider-dot"></div>
  <div class="saves-triad">
    <div class="save-pair">
      <span class="save-pair-label">Wis</span>
      <span class="save-pair-value">+1</span>
    </div>
    <span class="save-sep">·</span>
    <div class="save-pair">
      <span class="save-pair-label">Con</span>
      <span class="save-pair-value">+5</span>
    </div>
    <span class="save-sep">·</span>
    <div class="save-pair">
      <span class="save-pair-label">Dex</span>
      <span class="save-pair-value">+6</span>
    </div>
    <!-- Speed: only when net ≠ 30ft OR an item mod is present -->
    <span class="save-sep saves-speed-sep">·</span>
    <span class="save-pair-value saves-speed-value">35ft</span>
  </div>
</div>
```

Strip CSS in `src/features/dmDashboard/characterCard.css`. Per-palette PERC color overrides using `--pal-gem`.

---

## 4. Motion & animation spec

**Zero animation on this strip, by deliberate design.**

The strip is a passive reference surface. It is there, unchanging, while combat state shifts above it. Motion would betray that contract.

- **On card mount**: no animation. The strip is part of the card's resting visual state.
- **On value change** (e.g. item equip changes a save): instant text swap, 0ms transition. The DM is not expected to watch this happen.
- **On speed = 0**: color changes to error red (`#c06060`) instantly — this is a state change, not an animated event.

Everything else on the card that animates (HP delta floats, death save shake, concentration pulse) earns its motion by signalling change-of-state. The saves strip never signals — it shows.

---

## 5. Interaction model

The strip exposes **no interactive elements**. It is reference-only. No tap handlers, no hover states, no tooltips in this story.

Future enhancement (§8): hover tooltips that break down the computation (`WIS save +1 · ability +0 · prof +1 · item +0`).

---

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Missing `stats` array | Renders `PERC — · Wis — · Con — · Dex —`. Never absent. |
| No save proficiency data (v1) | Computes ability mod + item mods only. Values are useful but conservative. |
| Negative modifier (e.g. WIS −1) | Renders `Wis −1` using Unicode minus `−` (U+2212), not hyphen. |
| Zero modifier | Renders `Wis +0`, not blank. |
| Speed = 0 (Restrained, Paralyzed, Petrified, Grappled) | `0ft` in `#c06060` error red. Only use of red on the strip. |
| Speed = 30 ft, no item mods | Speed append **not rendered**. |
| Speed = 30 ft, item mod present | Speed append **rendered** (`30ft`). The mod is itself information. |
| Character at 0 HP / death saves showing | Strip still renders. Save data remains relevant for downed PCs. |
| Card locked (unauthenticated) | Strip **not rendered**. Same gate as HP stepper. |

---

## 7. Responsive behaviour

The strip is width-stable across all breakpoints. Nothing reflows, truncates, or disappears.

| Width | Headroom (worst case, speed shown) |
|---|---|
| 400px desktop | ~135px |
| 360px narrow desktop | ~95px |
| 320px mobile | ~55px |
| 480px+ wide | Extra space is right-side breathing room; strip does not stretch |

---

## 8. Open questions

1. **Save proficiency source** — three options: (a) class→saves lookup table in frontend, (b) `saveProficiencies[]` field on character record, (c) skip in v1. **Recommendation: (c) for v1, (a) as fast follow.** Architect decides.
2. **Full six-save expand** — deferred. Access via `↗ Sheet` is acceptable for STR/INT/CHA. Rejected as in-card expand to avoid crowding conditions/concentration row.
3. **Skill proficiency summary** — deferred. Recommended future path: `⋯` overflow popover `Proficiencies` button → transient modal.
4. **Speed always-on vs conditional** — this brief defaults to conditional. Override toward always-on if consistency is preferred.
5. **Vellum palette contrast** — verify accent color legibility on cream background; may need to fall back to `--pal-accent-bright` for PERC value on vellum.
6. **Computation tooltips on hover** — future enhancement, out of scope.

---

## Implementation hooks

**Placement in `CharacterCard.jsx`**: render `.saves-strip` after the spell slots strip for casters, or directly after the HP block for non-casters. Always before the Tier 2 divider. Gate on card-unlocked state (same condition as HP stepper).

**Computation**:
- Passive Perception: `10 + floor((wisScore - 10) / 2) + wisItemBonus` (+ proficiency bonus when implemented)
- Each save: `floor((score - 10) / 2) + itemBonusForStat`
- Speed: base (default 30) + item mods for `Speed` attribute + condition overrides (Restrained/Paralyzed/Petrified/Grappled → 0)

**CSS**: `.saves-strip` and per-palette overrides go in `src/features/dmDashboard/characterCard.css`. Scenario 4 CSS from the prototype is the starting point.

**Visual ground truth**: `design/prototypes/dm-party-card.html`, lines ~2660–2978 (Scenario 4).
