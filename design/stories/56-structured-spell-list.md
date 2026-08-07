# Feature Story: Structured Spell List with Attack Role

**Status**: Implemented
**Source**: RPG Consultant (spawned out of Story 55 architecture review — see `design/stories/55-token-attack-animation.md`'s "RPG Consultant: Spell Classification" section for the full research behind this story)
**Prototype**: none — design-strategist recommended skipping a prototype pass for this story (see UX Design below); routed straight to code-architect

**Note**: This story exists as a prerequisite for Story 55's "Channel" spell-attack visual, split out on its own rather than folded into 55, because it's a real, separate data-model and UI change: today `spells` is a freeform `string[]` of display tags with no individual identity. A `design-strategist` pass is the planned next step for the actual UI treatment (how a spell's role is set, how the merged list renders, empty/fallback states). Do not treat anything below as a visual spec.

## Goal

Right now spells are stored and shown as a flat list of freeform text — there's no way for the app to know "this spell is the kind of thing you cast at an enemy to hurt them" versus a buff, a utility spell, or a ritual. That's fine for reading a spell list, but it means the app can't answer a simple, practical question a player actually has mid-turn: "what can I roll to attack with right now?" Weapons already answer that (the Combat tab's weapons quick-reference list, rollable via the dice roller). Attack spells should live in the same answer, because that's how a player actually thinks about their turn — and it's how the D&D 5e Player's Handbook's own character sheet is laid out (a single "Attacks & Spellcasting" section, weapons and attack spells together). This story gives spells enough structure to support that, without turning spells into inventory items.

## User stories

- As a player, I want to mark a spell as "the kind I cast at an enemy to attack/hinder them," so the app can treat it like a weapon for the purpose of "what can I roll on my turn."
- As a player, I want attack-flagged spells to show up alongside my weapons in the Combat tab's quick-reference list (not buried in a separate spell-prep view I have to flip to mid-fight), so I have one place to look when it's my turn.
- As a player who plays a non-caster, I don't want my weapons section to be cluttered with spell-flavored UI I'll never use — it should read as plain "Weapons" when I have no attack spells.
- As a DM or player, I want this to lay the groundwork for Story 55's map visuals (a spell attack should eventually look different on the map than a plain ranged weapon attack) without this story itself needing to build that.

## Functional requirements

- **Data shape**: each spell needs individual identity (an id, at minimum a name) instead of being a bare string. A `role` field on each spell, minimally `"attack" | "heal" | undefined`, per the RPG consultant's recommendation (see Story 55's research section for the full reasoning — this is deliberately a small enum, not a full spell taxonomy: no school, level, AoE, or ritual flags in v1, none of them are load-bearing for anything currently planned).
- **Editing**: a player can add/edit/remove spells and set a spell's role, analogous to how weapons are added/edited today (reuse patterns from `ItemEditorModal.jsx` where they fit, but do not force spells through the weapon/equipment item shape — no qty, no equip/attunement fields, none of that applies to a spell).
- **Display — merged quick-reference**: the Combat tab's weapons quick-reference list (and by extension the dice roller's weapon-roll-buttons row) shows weapon entries and `role: "attack"` spell entries together. Suggested label: "Weapons & Attack Spells" or "Attacks" (naming is a design call). When a character has zero attack-flagged spells, the section should read as plain "Weapons" — no spell-flavored chrome for non-casters.
- **Display — untouched**: the Inventory tab's Loadout grid is not renamed or merged with spells; it stays "what I'm carrying," a different mental mode from "what I can attack with."
- **Out of the gate**: this story does not need to make spells individually rollable via the dice roller (i.e., it does not need to add per-spell ATK/DMG buttons the way weapons have them) — it only needs spells to have enough structure and to render in the merged list. Whether/how spells get dice-roller buttons is a natural follow-on, not required here.

## Data model changes

- `spells` changes shape from `string[]` to an array of objects, minimally `{ id, name, role?: "attack" | "heal", ...whatever descriptive fields the current freeform text captures today }`. Exact shape (whether existing freeform spell text becomes a `description` field, whether mods are supported at all in v1) is architecture's call — flagging that existing character records have `spells` as bare strings today, so this needs either a migration or a tolerant read path (old shape treated as `role: undefined` display-only entries) — do not silently drop existing spell data for any character.
- No change to `weapons[]` or `equipment[]`.

**Amendment from Story 57 (`design/stories/57-attack-targeting-flow.md`, brief OQ-1):**
Story 57's attack-declaration flow needs an attack-flagged spell to actually be
rollable and to know whether its slot is spent — which the shape above can't
support (no roll expression, no level to check against spell slots). Add three
more optional fields to the same role drawer this story already builds:
`level?: number` (0 = cantrip), `toHit?: string`, `damage?: string` (dice
expressions, parsed by the existing `parseDiceExpr`). This narrowly reverses this
story's own OQ-2 ("no mods in v1") — OQ-2's objection was against pulling in
`ItemEditorModal`'s full mod-editor weight, and two freeform expression fields are
much lighter than that. All three stay optional; Story 57 is specified to degrade
gracefully at every level of completeness, so this story is not blocked by them
and can still ship on its own first.

## Out of scope

- Full taxonomy (spell school, AoE, concentration, ritual tags) — deliberately not building this, per the RPG consultant's research; none of it is load-bearing for this story or Story 55. (`level` is *not* in this exclusion — see the Story 57 amendment above, which adds it as a functional field for spell-slot checks, not a flavor/taxonomy field.)
- Per-spell dice-roller buttons (ATK/DMG rolls) in the sense of a rendered UI button — plausible future story on its own. (Story 57's amendment above adds `toHit`/`damage` *data* fields so a future roll flow has something to read; it does not add a roller button to this story's own UI.)
- Any change to Spell Slots tracking (separate existing feature, unaffected).
- Story 55's actual Channel visual and the map-effects trigger logic — this story only provides the data Story 55 needs; wiring it into the map-effects system is Story 55's job once this lands.

## Open questions

- Should un-flagged/legacy spells (existing freeform strings, or new spells a player just never bothers to categorize) still be listed anywhere, or only attack-flagged ones move into the merged list? (Recommendation: existing spell display — wherever spells are shown today outside the Combat tab — is unaffected; only attack-flagged spells additionally appear in the merged quick-reference list.) Decision: Show spells in the spell list, regardless of category (even none) but only show spells in teh attack section which are tagged as attack. 
- Exact UI for setting a spell's role — a toggle, a dropdown, an icon picker? Decision: Design's call, but I'd favor a dropdown or icon picker. 
- Should this story migrate existing character data at deploy time, or handle both shapes indefinitely at the read layer? Architecture's call.

---

## UX Design

**Brief**: `design/briefs/structured-spell-list-brief.md` — the authoritative spec.

**Prototype: recommended skipped.** Every element is assembled from patterns
already specified in the design system (expandable item rows, `.btn-pill`,
`.label-ui`, badge tags, `.input-base`). An interactive HTML pass would cost more
than it informs — **route this straight to `code-architect`.**

**Tier**: 1 for the merged attacks list (the "what do I roll on my turn"
surface); 3 for the spell editor and full spell reference.

**No new tab, because both views already exist.** D&D Beyond's two-tier pattern is
correct and this app already has both halves of it, just disconnected: the
**Action view** is the Combat tab's weapons quick-reference, the **Reference
view** is the stats block's Spells badge row (and the DM card's). A fifth tab is
rejected outright — the tab strip is a 64px full-width Tier-1 element and a fifth
entry shrinks every tab to ~20% on mobile to serve a Tier-3 concern.

**Merged list header is computed three ways**, not two: `WEAPONS` (weapons only),
`WEAPONS & SPELLS` (both), `SPELLS` (spells only, e.g. a Wizard with no weapon);
nothing renders when both are empty. Chosen over the consultant's "Attacks"
because `WEAPONS` → `ATTACKS` shares no words and reads as a *different section*
rather than the same one extended — and `& ATTACK SPELLS` wraps at 11px/0.22em in
session mode's column.

**A spell row reads as a spell via one 14px gutter glyph — and the gutter is
conditional.** When the list contains no spells, no gutter element renders and
rows are pixel-identical to today. That absence, not a dimmed placeholder, is
what satisfies "no spell-flavored chrome for non-casters." Weapon rows keep their
to-hit/damage; **spell rows carry nothing in the right slot in v1** (no mods, no
`ATTACK` chip — a chip reading ATTACK on every row in a section of attacks is
pure noise). Weapons first, then spells, separated by one unlabeled 1px
`--pal-border` hairline; no interleaving, no sub-header.

**Glyph vocabulary — `✶` (U+2736) = attack-flagged spell, `✚` (U+271A) = heal,
nothing = unset.** `✶` carries exactly one meaning on all three surfaces.
Deliberately not `✦` (already spent on `✦ Heal` / `✦ STABLE`), not `◆`/`◇`
(attunement, Persona bullets, library picker), not `⚔` (Damage button). Colours:
`--pal-gem` and universal `#5a9a5a`.

**Role is set in an inline drawer, not a modal, and never nags.** Editing is
inline expansion on the edit-mode spell row — a spell has two editable properties
beyond its name, a modal for two fields is the wrong weight, and staying out of a
modal reinforces "spells are not items." The role selector is three `.btn-pill`s
(`—` / `✶ Attack` / `✚ Heal`) *inside a drawer that is closed by default*, so a
player who opens edit mode to fix a typo never sees a categorisation control. The
collapsed row shows a role mark **only when one is set** — **there is no "unset"
visual state anywhere in this design.**

**`+ Add` is also the bulk-entry path**, preserving today's comma-separated
ergonomics with no second control: commas are row separators on commit, so
`Fire Bolt, Shield, Mage Armor` + Enter creates three rows (140ms staggered
entrance, 40ms apart — the count is the message). Without this, migrating from
one text field to a row list is a real downgrade to 15 individual taps.

**Legacy display = new-unset display, exactly.** A bare legacy string renders as a
plain badge with `Spell: Name` tooltip, absent from the attacks list, with no
chevron, no "uncategorized" marker, and **no migrate/categorize prompt anywhere**.
Structured enrichments are opt-in and additive only: a role adds `✶`, a
description adds expandability and richer tooltip text (which incidentally closes
app-overview's "spell tooltips are minimal" gap). A tolerant `normalizeSpells()`
at every read site is a UI requirement regardless of the migration strategy
architecture picks.

**One net-new surface**, flagged for approval (OQ-5): session mode currently shows
a caster **no spells at all**, so the two-view model isn't true on the surface
people actually play on. Fix is a collapsed-by-default read-only badge row placed
**below the existing Spell Slots block in the right column** — "slots + spells" is
one coherent unit, and the separation from the sub-tab panel stops the two views
reading as accidental duplication 200px apart. Absent entirely when `spells` is
empty.

**Write path is the normal edit-mode save (`PUT /characters/{slug}`), not
`patchSession`** — spells are character definition, not session state. Zero new
endpoints, zero polling cost, no optimistic-update or conflict rules.

**Important cross-reference — this story does NOT complete Story 55's Channel
visual.** It supplies the `role: "attack"` classification, but Story 55's tracer
fires off a damage-apply that carries no reference to *which* item caused it —
nothing tells the tracer that this damage came from Fire Bolt rather than a
longbow. Story 55's Architect Notes risk #4 stays open after this lands, and
option (a) — "ship Bolt only for v1" — remains the correct call.

**Flagged for approval:** no in-session role toggle (OQ-1); no `mods[]` on spells
in v1 (OQ-2); the `WEAPONS & SPELLS` naming over "Attacks" (OQ-3); accepting
system-font fallback for `✶`/`✚` rather than an SVG sprite (OQ-4); the new
session-mode spells reference (OQ-5); capturing `role: "heal"` now despite having
no v1 consumer, to avoid a second migration when heal tracers land (OQ-6).

---

## Architect Notes

**Applies**: ADR-024 (tolerant normaliser + lazy write-through — written for this
story), ADR-025 (spell roll-field formats — written for this story), ADR-001 /
ADR-014 (CSS), ADR-011 (poll merge + optimistic writes), ADR-020 (poll-payload
width trigger), ADR-003. ADR-010 is referenced but **not** triggered (see ADR-025).

### Tech approach

**Final shape — including Story 57's amendment, treated here as this story's own
scope, not a follow-on:**

```
spells: {
  id: string,            // client-minted at creation; deterministic for legacy strings
  name: string,
  role?: "attack" | "heal",
  description?: string,
  level?: number,        // 0 = cantrip. ABSENT ≠ 0.
  toHit?: string,        // signed bonus, e.g. "+7" — NOT "1d20+7"
  damage?: string,       // dice expression, e.g. "2d6+3"
}[]
```

All optional keys are **absent** when unset — never `null`, `""`, or `"none"`; the
`—` role pill deletes the key. `toHit`/`damage` copy the *value formats* of a
weapon's `"Attack Bonus"` / `"Damage"` mod entries verbatim so one roll path
serves both (ADR-025) — this is what makes Story 57's picker a lookup rather than
a second roll engine. All three of Story 57's fields are inputs in **the same role
drawer this story is already building** (brief §3.3), below the Role pills:
`Level` (number), `To-hit` and `Damage` (both `.input-base`, freeform). No new
surface, no second modal.

**Backend: zero changes. Verified, not assumed.**
- `backend/src/handlers/update.js:28` is `{ ...result.Item, ...charData }` — a
  merge-and-store with no field validation and no schema. A shape change to
  `spells` needs no handler edit and no deploy-order coupling.
- `spells` is **already** in `DM_PARTY_FIELDS` *and* `DM_PARTY_PROJECTION_EXPRESSION`
  (`backend/src/lib/partyProjection.js:21,31`), so the DM payload carries the new
  shape for free (ADR-023's paired-widening constraint is already satisfied).
- A player's own spells arrive on their own character payload via
  `characterProjection.js`, not the party projection. **Do not add `spells` to
  `PLAYER_VISIBLE_FIELDS`** — no player needs another player's spell list.
- **Do not add `spells` to `SESSION_FIELDS`** (`session.js:13`). Brief OQ-1 and
  ADR-024's write-path constraint. Note the asymmetry this creates on purpose:
  `weapons`/`equipment` *are* session-patchable, spells are not.

**Migration: none — tolerant read + lazy write-through, per ADR-024.**
`normalizeSpells()` lives in `src/features/characterSheet/constants.js` alongside
`SPELL_ROLES`; `BLANK_CHARACTER.spells` stays `[]` (line 67). Legacy ids must be
**deterministic** (`legacy:${index}:${name}`) — a `crypto.randomUUID()` per call
remounts every row on every poll tick. Memoise (`useMemo` on `char.spells`) at
each of the three render sites. The seed JSONs (`src/characters/eoghan.json:47`,
`aragorn.json:47`) keep their string arrays — the tolerant reader covers them;
converting them is optional cosmetic work and if done they need ids.

**One shared derivation, three consumers.** Add `buildAttackEntries({ weapons,
spells })` next to `normalizeSpells()`, returning
`[{ id, kind: "weapon"|"spell", name, toHit, damage, description }]` with weapons
first, then `role === "attack"` spells (no interleaving, brief §3.2), plus the
three-way header string. Consumed by the Combat tab, the session-mode `combat`
sub-tab, and — later, unchanged — Story 57's attack picker. Building the merge
inline in two components is the one thing here guaranteed to diverge.

**The two hard break sites** (both render a spell string directly as a React key
*and* as text, so they will print `[object Object]` if missed):
- `CharacterSheetViewMode.jsx:454` — `{ key: spell, label: spell }`
- `CharacterSheetSessionMode.jsx:1063` — `<span key={spell}>{spell}</span>`

Duplicate spell names are legal (brief §9), so both must key on `id`.

**Two corrections to the brief's "files touched" (§12) — verified against source:**

1. **§3.4 is not a new surface.** Session mode already renders a Spells chip row
   directly below Spell Slots (`CharacterSheetSessionMode.jsx:1056–1067`), exactly
   where the brief proposes putting one. The brief's premise ("session mode
   currently shows a caster no spells at all") is wrong. This is therefore a
   *modification* of ~12 existing lines — add the `✶` glyph, a collapsible
   `SPELLS · N` header, and id keys — not the ~30-line net-new block OQ-5
   describes. It gets cheaper, and OQ-5 loses most of its weight as a decision.
2. **§3.5's "DM card badge row" does not exist.** `CharacterCard.jsx` renders
   `spellSlots` only (line 549–552); there are **no** skills / spells / abilities
   badges anywhere in `src/features/dmDashboard/`. Cut that bullet from this
   story. The `✶` on the DM side belongs to **Story 50's** Capability Rail /
   codex, whose brief asserts these badges "render unconditionally" — that
   assertion is factually false and whoever builds Story 50 needs to know it.
   Story 50 must consume `normalizeSpells()` rather than re-deriving.

**Edit-mode editor** replaces the comma input at
`CharacterSheetEditMode.jsx:351–353`. Inline drawer, per brief §3.3. Do **not**
route spells through `ItemEditorModal.jsx` and do **not** add a
`listType: "spells"` branch to `editingItem` (`CharacterSheetViewMode.jsx:1903+`)
— that is the item shape this story exists to keep spells out of. `DragHandle` is
reusable from `CharacterSheetPrimitives.jsx`, but the reorder *wiring* is not:
`onDrop` in `CharacterSheet.jsx:343` is hard-wired to `char.collections`. Give the
spell list its **own local drag state**; do not generalise the collections
handlers (that risks the Persona tab for no gain).

**Glyphs need no component change.** `InfoBadge`'s `label` is rendered as a child
(`CharacterTalents.jsx:46`), so pass a node:
`label={<><span className="spell-glyph">✶</span> Fire Bolt</>}` — the glyph keeps
`--pal-gem` while the label keeps the group colour. `tooltip` is already a prop,
so the description-in-tooltip change (§3.5) is a one-line swap at
`CharacterSheetViewMode.jsx:1381`. Note the tooltip is `maxWidth: 220` — another
reason to cap description length (below).

**Expanded-row keys must be namespaced.** The Combat tab keys expansion on
`item.id + "-combat"` (`CharacterSheetViewMode.jsx:1751`) and session mode on a
bare `w.id` in `expandedWeapons` (`:1113`). Use `spell:${id}-combat` /
`spell:${id}` rather than sharing the namespace with weapon ids.

**`DiceRoller.jsx`: no change in v1.** This deliberately follows brief §12 over
the story's own functional-requirement parenthetical ("and by extension the dice
roller's weapon-roll-buttons row") — which contradicts the story's own Out of
scope bullet. See Risk 3.

### Scope boundary

**In**: the seven-field spell shape above (all of it, including Story 57's
`level`/`toHit`/`damage`); `SPELL_ROLES` + `normalizeSpells()` +
`buildAttackEntries()` in `constants.js`; the inline role drawer replacing the
comma input, with bulk comma-split add, remove, and local-state reorder; the
merged attacks list with the three-way header, conditional gutter, and single
hairline divider, in **both** the Combat tab and the session-mode `combat`
sub-tab; `✶`/`✚` on the Persona badge row + description-in-tooltip; the existing
session-mode spells row upgraded (glyph, collapsible `SPELLS · N`, id keys); the
motion/reduced-motion specs in brief §6–§7; CSS in `characterSheet.css`.

**Out**:
- **All backend work.** No handler edit, no projection edit, no `SESSION_FIELDS`
  entry, no migration script, no new endpoint, no `patchSession` write.
- **`mods[]` on spells** (ADR-025), and anything else from the item shape:
  `equipped`, `attuned`, `qty`, `type`.
- **Per-spell ATK/DMG buttons in `DiceRoller.jsx`.** The data now exists to add
  them, which is precisely why they should wait for Story 57's Attack Bar rather
  than be built twice.
- **The DM card `✶`** — belongs to Story 50 (see correction 2).
- **Any prompt, banner, badge, or count that surfaces "you have uncategorised
  spells."** Brief §11.3, ADR-024's second constraint. This story's failure mode
  is nagging a non-caster.
- Spell school / AoE / concentration / ritual / save-DC / damage-type fields.
- Any change to Spell Slots tracking, or to the Inventory tab's Loadout grid.
- Anything Story 55 or 57 consumes — this story ships the data and the two
  display surfaces, and stops.

**Sizing**: one pass. Roughly 60% of the work is the edit-mode drawer; the merged
list is ~40 lines duplicated-then-shared across two components; the backend is
literally nothing. It splits cleanly at the drawer boundary if it needs to (shape
+ `normalizeSpells()` + merged list first, drawer second) — but shipping the shape
without the drawer means no way to *set* a role, so that split is only useful as
an intra-PR checkpoint, not as two stories.

### Performance notes

- **`normalizeSpells()` runs on every poll tick at three sites.** Deterministic
  ids + `useMemo` are not optional polish here; without them the spell list
  remounts on the DM's and player's adaptive poll cadence (ADR-011), and in edit
  mode would fight input focus.
- **Edit mode already suspends the poll merge** (`CharacterSheet.jsx:177`
  early-returns when `mode === "edit"`), so the editor needs no extra guard
  against a mid-edit clobber. Don't build one.
- The merged list is ≤ ~20 rows and re-renders with the sheet. Nothing to
  optimise; do not memo individual rows.
- Bulk-add stagger is capped at 6 rows (brief §6) — that cap is also the
  animation-cost cap; keep it.
- `✶`/`✚` fall back to a system font by design (brief §4, OQ-4). Give the span an
  explicit `font-size` so fallback metrics don't shift the row height.

### Cost notes

**Zero new AWS resources, zero new endpoints, zero added polling.** The only cost
change is payload width: `spells` already rides the DM's `GET /session-state`
projection on every tick, and today the DM UI renders **none** of it — so every
byte a description adds is currently dead weight on the wire until Story 50 lands.
Rough arithmetic: 5 characters × 15 spells × 300 chars ≈ 22KB per DM tick, which
at a sustained 5s cadence is ~$1/month of API Gateway egress — small, but it is
the largest single cost line in this story and it is avoidable at the source.
**Cap `description` at ~300 chars and `name` at ~60 in the editor** (also keeps
the 220px tooltip readable). This is exactly ADR-020's revisit trigger territory;
leave `spells` in the DM projection (Story 50 needs it) but bound the field.

### Dependencies

**None hard — this story can ship on its own, today.** No story needs to land
first, and no backend deploy is required to make it work.

Downstream ordering, for planning only:
- **Story 57 depends on this** and assumes all seven fields exist. It consumes
  `role: "attack"`, the weapons-then-spells order, `buildAttackEntries()`, and
  `level`/`toHit`/`damage` unchanged.
- **Story 55 is unaffected** — it ships Bolt-only (its Risk 4, resolved). This
  story does **not** close that risk; the tracer still fires off a damage-apply
  with no item reference. Do not let this story reopen 55.
- **Stories 50/51** should be built *after* this one if possible, so the DM-side
  spell rendering is written against the structured shape once instead of twice.
  If 50 ships first, its Spells cluster must be re-pointed at
  `normalizeSpells()`.

### Risks / decisions needed

1. **`level` and the `|| 0` trap — the most likely correctness bug in the story.**
   `0` is a meaningful value (cantrip = always castable), so an empty Level input
   must produce an **absent** key. `parseInt(e.target.value, 10) || 0` — the
   pattern used two screens away at `CharacterSheetEditMode.jsx:339` — silently
   converts "unspecified" into "cantrip". Story 57's "disable exhausted spells"
   rule then never disables anything. Confirm cantrip semantics and write the
   guard explicitly.
2. **Confirm `toHit` is a *bonus* (`"+7"`), not a full expression (`"1d20+7"`)**
   (ADR-025). This is the one decision here that shapes Story 57's Attack Bar. A
   full expression is superficially more flexible and immediately forks the roll
   path away from every weapon in the app. Recommendation: bonus.
3. **The story's functional requirements and its own brief contradict each other
   on `DiceRoller.jsx`.** FR §"Display — merged quick-reference" says the merge
   extends to "the dice roller's weapon-roll-buttons row"; brief §12 says
   "**no change in v1**"; and the story's Out of scope says no per-spell ATK/DMG
   buttons. Recommendation: **brief wins, roller untouched** — the merged
   quick-reference is the deliverable, and Story 57's bar becomes the place spells
   are actually rolled, so building roller buttons now means building the same
   thing twice with two different affordances. Needs an explicit yes.
4. **Confirm the DM card `✶` is cut** from this story and handed to Story 50
   (correction 2 — the surface the brief names does not exist).
5. **Confirm drag-reorder stays in v1.** It needs its own local drag state
   (~15 lines) because the existing `onDrop` is collections-only. Recommendation:
   keep it — bulk comma-add makes initial order arbitrary, so reorder is the only
   way to fix it — but it is the cheapest thing to cut if the pass runs long.
6. **Confirm no migration** (ADR-024): legacy strings stay in DynamoDB
   indefinitely and are upgraded only when that character is next saved from edit
   mode. Consequence to accept: a character nobody edits keeps bare-string spells
   forever, which is invisible in the UI but means `normalizeSpells()`'s tolerant
   branch is permanent, not transitional.
7. **Most likely implementation failure**: a missed string-shaped read site
   rendering `[object Object]`. The two known ones are listed above; add a
   `normalizeSpells()` unit spec (pure function, cheapest possible test) covering
   bare string, structured, mixed array, duplicate names, and `role`-absent, and
   grep `spells` across `src/` once more before calling it done.
