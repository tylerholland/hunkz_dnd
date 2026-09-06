# Structured Spell List with Attack Role — Design Brief

> **Story 56.** Sibling to the 52–55 token-effects cluster but structurally
> unrelated: this is a data-shape + list-UI story, no map, no animation system.
>
> **Prototype recommendation: skip it.** Every element here is assembled from
> patterns that already exist and are already specified — expandable item rows,
> `.btn-pill` with `.active`, `.label-ui` headers, the badge-tag treatment,
> `.input-base`. An interactive HTML pass would cost more than it informs. This
> brief is written to be built directly from. **Route it straight to
> `code-architect`.**

---

## 1. Tier

**Tier 1** — the merged attacks quick-reference (it is the "what do I roll on my
turn" surface). **Tier 3** — the spell editor and the full spell reference
(on-demand, never competing with combat state).

## 2. Design intent

A player mid-turn should find every attack they can make in one list, in one
place, without deciding whether the thing they want is "a weapon" or "a spell."
Everywhere else, spells stay spells — they are not inventory, they do not equip,
and the sheet never asks a player to classify a spell they don't care about.

## 3. Information hierarchy + layout

### 3.1 The three surfaces (and why there is no new tab)

D&D Beyond's two-tier pattern (full Spells tab + condensed Actions list) is
correct, and **this app already has both surfaces** — they just aren't connected.
No fifth tab. The tab strip is a 64px full-width Tier-1 navigation element; a
fifth entry shrinks every tab to ~20% width on mobile to serve a Tier-3 concern.

| View | Surface (already exists) | Contains |
|---|---|---|
| **Action view** | Combat tab's weapons quick-reference; session mode's `combat` sub-tab | Weapons + `role: "attack"` spells |
| **Reference view** | Stats block's Spells badge row (classic sheet); DM card badge row | Every spell, all roles |
| **Authoring** | Edit mode, replacing the "Key Spells & Abilities" comma input | Add / rename / reorder / role / description / remove |

One new surface is added — §3.4 — because session mode currently shows a caster
**no spells at all**, which makes the Action view incomplete on the surface
players actually play on.

### 3.2 Merged attacks list (Combat tab + session-mode `combat` sub-tab)

Ranked: section header → weapon rows (existing order) → hairline → spell rows
(spell array order). **Do not interleave.** Two homogeneous runs read faster than
a mixed sort, and it keeps the weapons run byte-identical to today.

Header is computed from what is actually present — three-way, trivial:

| Present | Header |
|---|---|
| weapons only | `WEAPONS` |
| both | `WEAPONS & SPELLS` |
| spells only | `SPELLS` |
| neither | section does not render |

`WEAPONS & SPELLS` over the consultant's alternative "Attacks": the fallback
requirement is that a non-caster sees plain "Weapons," and `WEAPONS` →
`ATTACKS` shares no words, reading as a *different section* rather than the same
one extended. `& SPELLS` (not `& ATTACK SPELLS`) because inside a section already
understood as "what I attack with," the qualifier is redundant — and at 11px /
0.22em tracking a 20-char uppercase label wraps in session mode's column.

```
.cs-attacks-section
  .label-ui.cs-attacks-header                    — WEAPONS | WEAPONS & SPELLS | SPELLS
  .cs-attacks-list
    .cs-attack-row[data-kind=weapon]             — 44px min-height
      .cs-attack-gutter                          — 14px; RENDERED ONLY IF list has ≥1 spell; empty for weapons
      .cs-attack-name                            — 15px Crimson, --pal-text, single-line ellipsis
      .cs-attack-meta                            — existing to-hit / damage chips
      .cs-attack-chevron  ▼                      — only when description present
    .cs-attack-divider                           — 1px --pal-border; only when BOTH runs non-empty; no label
    .cs-attack-row[data-kind=spell]
      .cs-attack-gutter > .spell-glyph  ✶        — 12px, --pal-gem
      .cs-attack-name
                                                 — no .cs-attack-meta in v1 (see §10.3)
      .cs-attack-chevron  ▼                      — only when description present
    .cs-attack-expanded                          — 14px Crimson italic, --pal-text-body, lh 1.6, padding-left 22px
```

**The gutter is conditional.** When the list is weapons-only, no gutter element
renders and the rows are pixel-identical to today. This is what satisfies the
story's "no spell-flavored chrome for non-casters" — not a dimmed placeholder, an
absent one.

**No sub-header label between the runs.** The section header already names both,
and the glyph column already marks which is which. A `SPELLS` sub-header inside
`WEAPONS & SPELLS` is chrome that earns nothing.

### 3.3 Edit-mode spell editor

Inline expansion, not a modal. A spell has exactly two editable properties beyond
its name; a modal for two fields is heavier than the content warrants, it makes
categorising four spells a four-open/four-close chore, and staying inline
visually reinforces "spells are not items" — which is the story's whole point.
(rejected: a spell-specific mini-modal — consistent with weapons, but wrong
weight and wrong signal.)

```
.em-spells-section
  .label-ui                                      — "SPELLS & MAGICAL ABILITIES"
  .em-spell-list
    .em-spell-row[data-open]
      .em-drag-handle                            — existing 12×18 6-dot SVG, reorder
      input.em-spell-name.input-base             — flex: 1
      .em-spell-role-mark  ✶ | ✚ | (absent)      — 12px, NON-interactive indicator only
      button.em-spell-toggle  ▾/▴                — 44px
      button.em-spell-remove  ×                  — 44px, #c06060
    .em-spell-drawer                             — revealed only when [data-open]
      .label-ui "Role"
      .em-spell-role-row
        button.btn-pill[data-role=none]   "—"          ← .active by default
        button.btn-pill[data-role=attack] "✶ Attack"
        button.btn-pill[data-role=heal]   "✚ Heal"
      .label-ui "Description"
      textarea.input-base.em-spell-desc          — min-height 80px, resize: vertical
  .em-spell-add
    input.input-base                             — placeholder: "Fire Bolt, Shield, Mage Armor"
    button.btn-ghost "+ Add"
```

**The role selector never nags.** It lives inside a drawer that is closed by
default, so a player who opens edit mode to fix a typo never sees a "choose a
category" control. The collapsed row shows a role mark *only when one is set* —
there is no "unset" visual state anywhere in this design.

**`+ Add` is also the bulk-entry path.** Commas in the add input are row
separators on commit: typing `Fire Bolt, Shield, Mage Armor` + Enter creates three
rows. This preserves the exact ergonomics of today's comma-separated field (which
is otherwise a real downgrade to 15 individual `+ Add` taps) without a second
control, and it makes the migration story literally "your old string became these
rows."

### 3.4 Session-mode spell reference (the one new surface)

Placed **directly below the existing Spell Slots block in session mode's right
column** — not inside the `combat` sub-tab. "Slots + spells" is one coherent
unit ("what I can cast, and what it costs"), and the physical separation from the
sub-tab panel keeps the two views from reading as accidental duplication ~200px
apart.

```
.cs-sm-spells                                    — element absent entirely when spells[] is empty
  button.cs-sm-spells-header                     — 44px; .label-ui "SPELLS · N" + chevron
  .cs-sm-spells-body[data-open]                  — COLLAPSED BY DEFAULT
    .cs-sm-spell-badge[data-role=attack]         — "✶ Fire Bolt"
    .cs-sm-spell-badge                           — "Mage Armor"
```

Read-only. Badge styling is the existing spell-tag treatment (§ design-system
"Pill / chip / tag"), wrapped.

### 3.5 Badge rows (classic sheet stats block + DM card)

Two minimal changes, no restructuring:
1. A spell with `role: "attack"` renders a leading `✶` inside its badge.
2. A spell with a `description` puts that description in the tooltip instead of
   `Spell: Name`. (Directly closes an item in app-overview's "Known gaps".)

## 4. Glyph vocabulary

| Glyph | Meaning | Where | Colour |
|---|---|---|---|
| `✶` U+2736 | **this spell is attack-flagged** | merged-list gutter; badge rows; edit-row mark; role pill | `--pal-gem` |
| `✚` U+271A | this spell is heal-flagged | edit-row mark; role pill; badge rows | `#5a9a5a` |
| *(nothing)* | role unset | everywhere | — |

`✶` carries **one** meaning on every surface. In the merged list every spell
present is attack-flagged, so "spell row" and "attack-flagged" are the same set
there — no drift.

Deliberately **not** `✦` (U+2726), which the app already spends on `✦ Heal` and
`✦ STABLE`; not `◆`/`◇` (attunement, Persona bullets, library picker); not `⚔`
(the Damage button). Six points vs. four points vs. diamond is a reliable read at
11–12px.

Render glyphs in a span that does **not** force `--font-ui` — IM Fell English
will not have these codepoints and must fall back to a system font. This is the
established behaviour for `◆`, `✦`, and `◷` in the app today; give it an explicit
`font-size` so fallback metrics stay stable.

## 5. Colour tokens

| Token | Role |
|---|---|
| `--pal-gem` | `✶` glyph, all surfaces |
| `--pal-border` | run divider; role-pill resting border; row bottom borders |
| `--pal-accent-dim` / `--pal-accent` / `--pal-accent-bright` | active role pill bg / border / text (tab-button pattern) |
| `--pal-text` | spell + weapon names |
| `--pal-text-body` | expanded description |
| `--pal-text-muted` | `.label-ui` headers, chevrons, inactive role pills, `SPELLS · N` count |
| `--pal-surface` | `.input-base` fields |
| `#5a9a5a` | `✚` heal glyph — universal, not palette-derived |
| `#c06060` | `×` remove — existing universal destructive |

## 6. Motion & animation spec

```
Spell drawer opens (edit mode):
  Trigger: tap ▾ on a spell row
  Animation: max-height 0→220px + opacity 0→1
  Duration: 180ms, ease-out cubic
  Communicates: "this row unfolded — you're still in the same list"
```
```
Spell rows added via bulk add:
  Trigger: Enter / "+ Add" on the add input
  Animation: opacity 0→1 + translateY(-6px)→0, per row
  Duration: 140ms ease-out; stagger 40ms per row, capped at 6 staggered
  Communicates: "three things arrived, in this order" — the count is the message
```
```
Spell row removed:
  Trigger: tap ×
  Animation: opacity 1→0 + max-height collapse
  Duration: 120ms ease-out
  Communicates: "gone, and the list closed behind it"
```
```
Role pill selection:
  Instant. No animation. Colour swap on the same frame as the tap.
  A toggle that animates its own state change reads as latency.
```
```
Merged-list row expand (weapon or spell):
  Reuses the existing expandable-item-row transition unchanged. No new spec.
```
```
Section header changing (WEAPONS → WEAPONS & SPELLS):
  Instant, no animation — incidental change, and only observable across a
  navigation, never in place.
```
```
Session-mode spells block collapse/expand:
  max-height + opacity, 180ms ease-out. Matches the app's existing collapsible
  panel vocabulary (Counter Wheels, DM notes strip).
```

## 7. Reduced-motion table

| Animation | `prefers-reduced-motion: reduce` |
|---|---|
| Spell drawer open | Instant show/hide, 0ms |
| Bulk-add row entrance | Instant, **no stagger** |
| Row removal | Instant |
| Role pill selection | Unchanged (already instant) |
| Merged-list row expand | Inherits existing reduced-motion rule |
| Session spells collapse | Instant |

## 8. Interaction model

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| `+ Add` input | Enter or tap `+ Add` | Rows appear staggered; input clears and keeps focus | Local state; persists on Save | Tap `×` on the new row |
| Spell name input | Type | Standard input | Local state; persists on Save | Leave edit mode without saving |
| Row `▾` | Tap (44px) | Drawer opens; chevron rotates 180° | none | Tap again |
| Role pill | Tap (44px) | Pill becomes active; row mark appears/changes/clears instantly | Local state; persists on Save | Tap `—` |
| Description textarea | Type | Standard | Local state; persists on Save | — |
| Row `×` | Tap (44px) | Row collapses out | Local state; persists on Save | **None** — matches existing Persona Traits / weapon-row behaviour; unsaved, so leaving without saving restores |
| Drag handle | Drag | Existing reorder feedback (0.45 opacity, accent drop border) | Local state; persists on Save | Drop outside |
| Merged-list row | Tap | Description expands | none | Tap again |
| Session spells header | Tap (44px) | Body expands | none | Tap again |

**No hold, no swipe anywhere in this feature.** Every affordance is a tap on a
≥44px target.

## 9. Data contracts and sync/freshness

**Shape:** `spells: { id: string, name: string, role?: "attack" | "heal", description?: string }[]`

- `id` — client-generated, stable across saves; the React key. Duplicate names
  are legal and must not be deduped.
- `role` — **absent** is the unset state. Never store `null`, never store `""`,
  never store `"none"`; the `—` pill deletes the key.
- `description` — receives the freeform text of a legacy string spell if the
  string carried more than a name (architecture's call whether migration splits
  it; the UI works either way).

**Tolerant read is a UI requirement, not just an architecture one.** Whatever
migration strategy is chosen, the render path must accept a bare `string` entry
and treat it as `{ name: <string> }` with no id, no role, no description, without
throwing and without visual difference from a structured role-unset spell. A
single `normalizeSpells()` helper in `constants.js`, called at every read site.

**Write path:** the normal edit-mode save — `PUT /characters/{slug}`, owner or DM
auth. **Not `patchSession`.** Spells are character-definition data, not session
state. Consequence: role cannot be changed mid-session without unlocking the
sheet. That is deliberate for v1 (OQ-1).

**Freshness:** none required. Spells arrive on the existing character payload of
`GET /session-state`. A 1–30s stale spell name is harmless; there is no
optimistic-update rule, no conflict path, no write-failure state beyond edit
mode's existing save error handling. **This feature adds zero polling cost and
zero new endpoints.**

## 10. Size-degradation ladder

**Merged attacks list**
1. ≥720px — `[gutter] name ················ to-hit  damage  ▼`, full names.
2. 560–720px — unchanged; name column absorbs the squeeze.
3. <560px — name truncates with ellipsis; **to-hit and damage never truncate**
   (they are the reason the row exists). Full name available in the expanded
   drawer and via `title`.
4. Session-mode right column at <560px — identical to step 3.

**Edit-mode spell row**
1. ≥480px — `[⋮⋮] [name·······] [✶] [▾] [×]`.
2. 360–480px — name input shrinks; all three 44px targets hold.
3. <360px — role mark `✶` hides (it is redundant with the drawer, which is the
   only place role is *set*); handle, `▾`, `×` all persist.

**Session-mode spells block** — badges wrap; no ladder needed.

## 11. Key edge cases

1. **Zero weapons, ≥1 attack spell** (a Wizard with no weapon). Header reads
   `SPELLS`; no divider; no gutter conditional needed since every row is a spell —
   the gutter renders. Real case, must not render an empty weapons run.
2. **Zero weapons, zero attack spells.** The whole section does not render — not
   an empty state, not a placeholder. Sparse-first.
3. **All spells legacy strings.** Attacks list = weapons only, header `WEAPONS`,
   pixel-identical to today. **No "categorize your spells" prompt, banner, or
   badge anywhere.** The gap is invisible until the player chooses to close it.
4. **`role: "heal"` set.** Appears in *no* new list in v1 — its only surface is
   the `✚` mark in badge rows and the edit row. It must not silently vanish;
   capturing it now is what avoids a second migration when heal tracers land
   (Story 55 Phase 2).
5. **Long spell name in the merged list.** Single-line ellipsis; full text in the
   expanded description area and `title` attribute.
6. **A spell with a role but no description.** No chevron in the merged list — the
   row is present and non-expandable. Matches existing weapon-row behaviour.
7. **Bulk add with empty segments** (`"Fire Bolt,, Shield,"`). Trim and drop
   empties; never create a nameless row.

## 12. Files touched

- `src/features/characterSheet/constants.js` — `BLANK_CHARACTER.spells` shape,
  `SPELL_ROLES`, `normalizeSpells()` tolerant reader
- `src/features/characterSheet/CharacterSheetEditMode.jsx` — spell list editor
  replaces the comma-separated "Key Spells & Abilities" input
- `src/features/characterSheet/CharacterSheetViewMode.jsx` — merged attacks list
  in the Combat tab; `✶` + description tooltip on stats-block badges
- `src/features/characterSheet/CharacterSheetSessionMode.jsx` — merged attacks
  list in the `combat` sub-tab; new spells reference below Spell Slots
- `src/features/characterSheet/characterSheet.css` — `.cs-attack-*`,
  `.em-spell-*`, `.cs-sm-spells-*`; new keyframes for drawer + row entrance
- `src/features/dmDashboard/CharacterCard.jsx` — `✶` + description tooltip on the
  Spells badge row
- `src/components/DiceRoller.jsx` — **no change in v1.** Weapon roll buttons stay
  weapon-only; per-spell ATK/DMG is explicitly out of scope.
- `design/app-overview.md`, `design/design-system.md` — feature-builder updates
  (new `✶`/`✚` glyph vocabulary; the merged-section header rule)

## 13. Open questions

- **OQ-1 — In-session role toggle?** Should `spells` join `SESSION_FIELDS` so a
  player can flag a spell as Attack mid-fight without unlocking the sheet?
  **Recommendation: no for v1.** It doubles the write path for a setting a player
  changes ~3 times per character. Revisit if it actually bites in play.
- **OQ-2 — Do spells carry `mods[]`?** **Recommendation: no in v1.** Nothing
  consumes them (roller buttons are out of scope) and adding the mod editor pulls
  most of `ItemEditorModal`'s weight back in — the exact thing the story rejects.
- **OQ-3 — Section header naming.** This brief chooses `WEAPONS` /
  `WEAPONS & SPELLS` / `SPELLS` over the consultant's "Attacks." Confirm or
  override.
- **OQ-4 — `✶` glyph.** Accept system-font fallback (established precedent with
  `◆`/`✦`/`◷`), or commit to an inline SVG sprite instead? Recommendation: accept
  the fallback; an SVG sprite for two glyphs on a text row is over-engineering.
- **OQ-5 — Session-mode spells reference (§3.4).** This is the one net-new
  surface. Wanted now, or defer and accept that session-mode casters see only
  their attack spells? Recommendation: build it — it's ~30 lines and it's what
  makes the two-view model actually true on the surface people play on.
- **OQ-6 — Capture `role: "heal"` now** despite it having no v1 consumer?
  Recommendation: yes (consultant §1.2) — same field shape, and it removes a
  second migration when heal tracers land.

## 14. Cross-references

- **Story 55 (`token-attack-animation-brief.md`) — important correction.** This
  story provides the `role: "attack"` *classification*, but it does **not** by
  itself unblock the Channel visual. Story 55's tracer is triggered by a
  damage-apply, which carries no reference to which item or spell caused it —
  nothing tells the tracer that *this* damage came from Fire Bolt rather than a
  longbow. Bolt-vs-Channel still needs a per-event item reference that neither
  story captures. Story 55's Architect Notes risk #4 remains open after this
  story lands; option (a) — "ship Bolt only for v1" — remains the correct call.
- **Story 55 §RPG Consultant §3** — adopted in full: merge at display, not at
  storage; the Inventory tab's Loadout grid is untouched.
- **Story 16 (DM card redesign)** — tier declaration in §1 follows its
  information-tier principle.
- **Design system, "Pill / chip / tag" → Spell / ability tag** — unchanged as a
  visual spec; this brief adds a conditional leading glyph inside it.
- **app-overview "Known gaps" → "spell tooltips are minimal"** — partially closed
  by §3.5 (descriptions now reach the tooltip).
