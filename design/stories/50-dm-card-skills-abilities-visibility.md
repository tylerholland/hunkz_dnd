# Feature Story: DM Card Skills & Special Abilities Visibility

**Status**: Needs UX design
**Source**: RPG Consultant (live-session feedback)
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

A DM running combat and roleplay for a full party needs to know, at a glance, what each character is actually capable of — what skills they're proficient in, what special abilities or class features they have available. Right now the DM dashboard's party cards surface Skills/Spells/Special Abilities badges, but the feedback is that this isn't reliably visible to the DM in both of the app's two operating modes — adventure (exploration/roleplay) and combat. A DM shouldn't have to ask "wait, are you proficient in Perception?" or "remind me what your special ability does?" mid-scene, and shouldn't lose that reference the moment the party switches from adventure mode into a fight.

## User stories

- As a DM, I want to see each character's skills and special abilities on their party card while running an adventure/roleplay scene, so I can quickly call for the right ability check or remember what a character can do narratively.
- As a DM, I want that same information visible on the party card while running combat, so I can remind a player of an ability they might be forgetting to use, or resolve a ruling without asking them to read their own sheet aloud.
- As a DM, I want this reference to be quick to scan, not something I have to expand or dig for, since I'm juggling the whole party plus NPCs at the same time.

## Functional requirements

- Skills and Special Abilities (and, since they're part of the same reference cluster on the character sheet, Spells) must be visible on the DM's party card regardless of which dashboard mode is active — Adventure or Combat.
- This is glance-level reference, not a full sheet dive: the DM should be able to see what a character has without opening a modal or leaving the dashboard.
- Whatever tooltip/detail interaction already exists for these badges elsewhere in the app (hover/focus/click showing `Type: Name`) should carry over here for consistency, rather than inventing a new interaction pattern.

## Data model changes

None. `skills[]`, `spells[]`, and `specialAbilities[]` already exist on every character record and are already read by the DM dashboard for badge rendering — this is a visibility/consistency fix across dashboard modes, not new data.

## Out of scope

- Rich skill/spell descriptions or mechanical detail beyond the existing `Type: Name` tooltip (tracked separately as a known gap).
- Editing skills/abilities from the DM dashboard — this remains a player/owner edit-mode-only capability.

## Open questions

- Is the current gap that these badges are present but visually easy to miss, or that they're actually absent/hidden in one of the two dashboard modes? Worth confirming exactly what's missing where before this goes to design.
- Given the DM already has a lot on each card (HP, conditions, concentration, inspiration, XP/coin, notes), how much of this reference should live on the compact card by default versus behind the expand-for-more affordance in Story 51 below? These two stories likely want to be designed together.

## UX Design

**Brief**: `design/briefs/dm-card-skills-abilities-visibility-brief.md`
**Status**: Design brief complete — ready for `ux-designer` prototype.

### Diagnosis (answers the story's first open question)

The badges are **not** hidden in either mode — they render unconditionally. The real defect is that the block is **uncapped and variable-height**: it prints every skill, spell and ability as ~24 equal-weight chips with no grouping, no counts, and no fixed position. It becomes the tallest region on the card, lands at a different depth on every card, and reads as texture rather than information. Showing everything is why nothing is seen.

### Solution summary

Replace the badge wall with two things:

1. **Capability Rail** (Tier 1c) — a fixed-position, hard-capped **2-line** region in the card's "reference band" (directly below the saves strip, above the Tier 2 divider). Identical position on every card in both modes. Cluster identity is carried by colour (skills=accent, spells=neutral, abilities=gem), so no labels are needed at rest.
   - **Exactly two clusters print; one summarises as a count chip.** Abilities always print. Adventure = Skills + Abilities (Spells → `SPELLS 12`). Combat = Abilities + Spells (Skills → `SKILLS 9`).
   - **No cluster ever disappears in either mode** — this is the literal fix for the story's requirement. Only density changes, and the swap is animated (200ms) so the DM sees the reorder rather than perceiving a loss.
   - Overflow drops chips **whole** into a `+N` chip; labels are never ellipsed mid-word.

2. **Codex drawer** (Tier 3) — one tap on the rail expands an in-card panel listing all Skills / Abilities / Spells in a stable canonical order, `max-height: 320px` with internal scroll so the card never grows unboundedly. One codex open at a time across the party strip. Auto-expands on the active-turn card in combat, matching the NPC ability-reference behaviour from Story 23. Existing `Type: Name` tooltip carries over on codex chips.

**Net effect on card height: negative.** A typical caster's resting card gets ~60px shorter, not taller.

### Story 51 relationship

Design them as one pattern. The codex drawer built here is the container; Story 51 adds **Weapons** and **Inventory** as two further sections inside the same drawer (order: Skills → Abilities → Spells → Weapons → Inventory). This also settles Story 51's expand-vs-modal question: **expand-in-place with an internal scroll cap** — a modal would cost the DM their view of initiative and the party strip, which is the friction Story 51 exists to remove. Story 51 adds nothing to the rail.

### Decisions needing user sign-off (full detail in brief §10)

1. Mode-dependent cluster ordering — committed to, overridable to a fixed layout.
2. Placement moved from "below conditions" to "below the saves strip" (reference band).
3. Active-turn auto-expand on by default; fallback is a chevron pulse.
4. Architect to confirm `skills` / `specialAbilities` / `spells` (and, for Story 51, `weapons` / `equipment`) are in the DM party projection whitelist.
5. Needs a `skillKey → label` map; recommend showing the governing ability (`Athletics (STR)`) in the codex only.

---

## Architect Notes

**Applies**: ADR-001, ADR-002, ADR-006, ADR-011, ADR-013, ADR-014, ADR-020

### Read this first — the brief diagnosed the wrong surface

The story premise ("the DM dashboard's party cards surface Skills/Spells/Special Abilities badges") and the brief's Diagnosis ("they render unconditionally… uncapped and variable-height… ~24 equal-weight chips… the tallest region on the card") are **factually wrong about the DM party card**. There are zero references to `skills`, `specialAbilities`, `spells`, `CharacterTalents`, or `InfoBadge` anywhere in `src/features/dmDashboard/`. The badge wall being described exists on the **player sheet** — `CharacterSheetViewMode.jsx` (Persona tab, ~line 1364) and `CharacterSheetSessionMode.jsx` (~line 1055, `<CharacterTalents … compact />`).

**This definitively answers the story's first open question: the badges are absent, not easy to miss.** Three consequences the feature-builder must not miss:

1. **The brief's "net effect on card height: negative (~60px shorter)" is false.** There is no badge wall to remove. This story is purely *additive* to card height (~2 lines + rail padding). Story 51's footer-band reduction is therefore paying for two additions, not one — re-read that tradeoff before agreeing to it.
2. **The overflow/`+N` machinery is likely over-built for the real data.** The catalogs are small and fixed: 9 skills and 20 special abilities (`CHARACTER_SKILLS` / `SPECIAL_ABILITIES` in `talentCatalog.js`). The "~24 chips" figure assumed 5e's 18 skills plus class features. Check actual party data before building elaborate overflow logic; a simple whole-chip budget is probably sufficient.
3. **These are not 5e skills.** `athletics, awareness, deception, decipher, heal, leadership, lore, stealth, survival` is a custom 9-skill system with no ability-score mapping anywhere in the codebase.

**Tech approach**: The `skillKey → label` map the brief asks for (open question 5) **already exists and must be reused, not rebuilt** — `getTalentDetail(key)`, `getTalentTooltip(key)`, and `getOrderedTalentEntries(skills, specialAbilities)` in `src/features/characterSheet/talentCatalog.js`, which also gives you canonical ordering for free (it filters the catalog arrays, so order is stable and independent of stored array order — exactly the "stable canonical order" the codex needs). Import it directly from `src/features/dmDashboard/`; that cross-slice direction is already established (`DmDashboardPage.jsx` imports `PALETTES` from `../features/characterSheet/theme`) — see ADR-020. Build `CapabilityRail.jsx` in `src/features/dmDashboard/characterCard/` (alongside the other card sub-components, not at the `dmDashboard/` root), composed into `CharacterCard.jsx` after the `.cc-saves-strip` block (~line 611) and before `<XpCoinRow>`. Styling per ADR-001/ADR-014: classes in `src/features/dmDashboard/characterCard.css` prefixed `cc-rail-*`; the only legitimate inline styles are the per-cluster palette colors already computed at runtime. Reuse `InfoBadge` from `CharacterTalents.jsx` for codex chips rather than a parallel chip implementation.

Two corrections to the brief's interaction spec:
- **The "existing `Type: Name` tooltip" is a misreading.** For catalog entries (skills + abilities) the existing tooltip shows the **description** via `getTalentTooltip`; `` `${group.singular}: ${item.label}` `` is only the fallback for the non-catalog **spells** group, where it renders as `Spell: Fireball` — i.e. the name twice, carrying zero information. Use descriptions for skills/abilities; **do not build a tooltip for spell chips at all**, because `spells` is `string[]` free text with no description data to show.
- **Drop the governing-ability idea (`Athletics (STR)`).** No such mapping exists anywhere, and these 9 skills are not 5e skills, so producing one means *inventing game rules* — an `rpg-consultant` decision, not an implementation detail. If it's genuinely wanted later it's an added field on `TALENT_DETAILS` under ADR-013.

**Scope boundary**:

*In*: `CapabilityRail.jsx` (fixed-position, 2-line, hard-capped, mode-ordered, whole-chip `+N` overflow, count chip for the summarised cluster); composition into `CharacterCard.jsx`; `cc-rail-*` CSS; passing the existing `combatMode` boolean from `DmDashboardPage.jsx` down to `CharacterCard` (it currently is not passed — `isActiveTurn`, `dimmed`, and `showTier2` are).

*Out*: any backend change (`skills`, `specialAbilities`, and `spells` are **already** in `DM_PARTY_FIELDS` and `DM_PARTY_PROJECTION_EXPRESSION` — verified, brief open question 4 is resolved for this story; only Story 51's `weapons`/`equipment` need adding); governing-ability labels; spell tooltips; any edit affordance; touching the player sheet's badge rendering.

*Resist*: gating the rail behind `showTier2`. Combat layout sets `cardsCompact`, which suppresses Tier 2 — and "visible in **both** modes" is this story's entire requirement. The rail must render regardless of `showTier2`, and should probably also render regardless of `hasHp` (which currently gates the saves strip immediately above it).

**Sequencing with Story 51 — build the rail now, the codex with 51**

The two briefs contradict each other on the shared container: brief 50 says the codex is the container and 51 appends two *stacked sections* to it; brief 51 says 50 has no drawer and may append a fourth *tab* to 51's tab strip. Both also claim to render Spells. Recommended split, which sidesteps the conflict entirely rather than arbitrating it:

- **Pass A (this story, minus the codex)**: the Capability Rail only. Card-face, no drawer, no backend change, no accordion, no cross-card coordination. This fully satisfies the story's stated requirement — *"quick to scan, not something I have to expand or dig for."* The codex is a bonus tier the story text does not actually ask for.
- **Pass B (Story 51 + this story's codex)**: build `CardDrawer.jsx` **once**, with all five sections, per ADR-020.

The seam that makes this safe: ship `CapabilityRail` with an optional `onOpenCodex` prop. Undefined in Pass A → the rail renders non-interactive with no chevron. Pass B passes it → the rail becomes the codex trigger. No Pass A code is rewritten.

```
<CapabilityRail
  pal={cardPal}
  skills={char.skills} specialAbilities={char.specialAbilities} spells={char.spells}
  mode={combatMode ? "combat" : "adventure"}
  onOpenCodex={undefined}        // Pass A: rail is display-only
/>
```

If the user prefers one combined pass, that is viable — but then ADR-020's `CardDrawer` must be built first and both stories composed into it, and the Spells-section ownership question below must be answered up front.

**Performance notes**: Do not measure chip widths in the DOM. Cards re-render on every poll tick (1s without WebSocket, 30s with — ADR-011), and the dashboard applies a user text scale via CSS `zoom` (`useTextScale`), so a `ResizeObserver`/`getBoundingClientRect` overflow pass would be both expensive and wrong. Compute the 2-line budget from label character counts against the fixed catalogs — pure, deterministic, and `useMemo`-able on `[skills, specialAbilities, spells, mode]`. Accept that it degrades gracefully (a slightly early/late `+N`) at extreme text scales; that is much cheaper than the alternative. The rail must add no per-tick work beyond that memo.

**Cost notes**: None. No new AWS resources, no new endpoint, no projection change, no additional request. Purely client-side rendering of data already in the DM poll payload.

**Dependencies**: None blocking. `combatMode` already exists in `DmDashboardPage.jsx` (line 51) and just needs threading through. If the codex ships in this story rather than Pass B, it depends on ADR-020's `CardDrawer`.

**Risks / decisions needed**:

1. **The brief's height-reduction argument is void** (no existing badge wall to remove). Confirm the DM still wants ~2 lines of *added* card height, given brief 51 is simultaneously spending its footer-band reduction on Story 51's trigger.
2. **`dnd_codex_open` conflicts with brief 51.** Brief 51 explicitly says drawer openness is **not** persisted across reloads; this story proposes persisting it. Recommend aligning with 51: persist only the last-viewed section/tab, never openness. Under ADR-020's single `openSection` model there is one key to persist, not two — likely making `dnd_codex_open` unnecessary. Per ADR-006 keys are `sessionStorage` and clear on tab close.
3. **Active-turn auto-expand vs. brief 51's "the drawer never auto-closes."** With a dashboard-wide single-open accordion, auto-expanding the codex on the active-turn card *force-closes whatever drawer the DM had open on another card* every time the turn advances. These two behaviors are mutually exclusive as written. Needs a user decision: (a) drop auto-expand in favour of the brief's chevron-pulse fallback, (b) drop the dashboard-wide accordion, or (c) exempt auto-expand from the accordion (two drawers open — cheapest to reason about, costs vertical space). Recommend (a).
4. **Who owns the Spells section** if both stories ship — resolve before Pass B starts (ADR-020 §4).
5. Mode-dependent cluster reordering (brief decision 1) means the rail's contents change when the DM toggles Adventure/Combat. Confirm the DM wants motion there at all; a fixed order is less clever and never surprises.
