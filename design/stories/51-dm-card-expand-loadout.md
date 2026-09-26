# Feature Story: DM Card Expand — Weapons, Spells & Inventory

**Status**: Needs UX design
**Source**: RPG Consultant (live-session feedback)
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

When a DM needs to know exactly what a character is carrying or capable of casting — to adjudicate an improvised action, check if they have the right tool for a puzzle, confirm ammo/consumables remaining, or double-check a weapon's damage die before applying an NPC's counterattack — the only options today are to interrupt the player and ask, or open that character's full sheet in a separate tab. Neither is great in the middle of a live session. The DM dashboard already shows compact HP/condition/talent info per card; giving the DM a way to drill into a character's actual loadout without leaving the dashboard removes a constant small friction point during play.

## User stories

- As a DM, I want to expand a party card to see a character's full weapons list (with damage/attack info), so I can adjudicate combat actions or apply effects without asking the player to read their sheet to me.
- As a DM, I want to see a character's known spells in that same expanded view, so I can sanity-check what a player says they're casting.
- As a DM, I want to optionally see a character's inventory/equipment, so I can answer "do you have rope/a potion/thieves' tools" questions without breaking flow.
- As a DM, I want this to be an expand-in-place or drill-down from the existing card, not a separate page load, so I don't lose my place in the party strip or initiative tracker while looking something up.

## Functional requirements

- Each party card gains a way to reveal a character's full weapons list (name, attack bonus, damage) beyond what's already shown in the compact card.
- The same expanded view should include the character's spell list.
- Inventory/equipment should also be viewable from this expanded view, though the DM's real-time need is more about combat-relevant items (weapons, potions, ammunition) than full inventory browsing — equipment can be secondary to weapons/spells in priority.
- This is read-only for the DM — this expansion is a reference lookup, not an editing surface. Item mods, attunement, and quantity edits remain owner/edit-mode actions elsewhere in the app.
- Given the DM dashboard already has an "↗ Sheet" link that opens the full character sheet in a new tab, this expand-in-place view should be positioned as the fast/no-context-switch option, while the full sheet link remains available for anything deeper than a quick lookup.

## Data model changes

None. `weapons[]`, `equipment[]`, and `spells[]` already exist on every character record; `GET /dm/party` (or the DM variant of the consolidated session-state poll) already returns full character projections to the DM. This is a display surface addition, not a data change — confirm during architecture review whether the current DM party projection already includes full weapons/equipment/spells or needs to add those fields to its whitelist.

## Out of scope

- Editing any loadout data from the DM dashboard (weapons, equipment, attunement, quantity) — remains sheet-only.
- Full inventory management workflows (drop item, quantity stepper, potion use) surfaced on the DM side — this is a lookup, not a second copy of the Inventory tab.

## Open questions

- Should this share a design pattern with Story 50 (skills/abilities visibility), since both are "more detail about a character, without leaving the dashboard"? They may end up as one combined expanded-card view rather than two separate additions.
- Expand-in-place (card grows taller, pushes neighbors down) vs. a slide-out/modal drill-in (like the NPC library's advance editor) — which fits better given the party card strip is already a scrolling column the DM is actively scanning during combat?

## UX Design

**Full brief**: `design/briefs/dm-card-expand-loadout-brief.md` — that document is the implementation spec. This section is the summary and the resolved decisions.

**Information tier**: 3 (on-demand). The trigger is Tier-3-ambient; the content is Tier 3 and must never out-weigh HP, conditions, or death saves.

### Resolved: the story's two open questions

**1. Expand-in-place, not a slide-out or modal.** A right-edge drawer would cover the initiative tracker (the DM dashboard's right column) — the one thing that must not be occluded during combat. A modal contradicts the story's own requirement. Expand-in-place occludes nothing, keeps the character's portrait and HP directly above their loadout so identity is never ambiguous, and reuses the vocabulary already established by the DM notes strip, death saves strip, counter wheels and NPC ability reference.

Three constraints make it safe: **(a) accordion** — one card's drawer open dashboard-wide, opening B closes A; **(b) bounded height** — `min(48vh, 420px)` desktop / `min(56vh, 380px)` mobile with internal scroll; **(c) scroll anchoring** — on open, the card *header* smooth-scrolls to a stable position so the DM never hunts for the card they just opened.

**2. Shared pattern with Story 50 — yes, but not a merge.** Story 50 is explicitly glance-level (card face, no expand); this is on-demand (drawer). Different tiers, no conflict. The drawer's tab strip is built left-aligned and non-stretched so Story 50 can append a fourth `ABILITIES` tab with zero relayout if its full list overflows the card face. Both share the existing `Type: Name` tooltip component. Neither blocks the other.

### The reduction

Adding a trigger row to this card is not free. **The DM notes strip becomes a half-width segment of a shared 44px footer band**, so two drawers cost +4px of card height instead of +44px:

```
BEFORE:  [ ▣ + Note                                        ▼ ]
AFTER:   [ ⚔ LOADOUT  ⚗2  ⌄  │  ▣ NOTES · 2              ⌄ ]
```

Both segments open into the same drawer region; opening one closes the other. The death saves strip continues to mount below the band, unchanged.

### Layout

```
│ ⚔ LOADOUT  ⚗2 ⌃ │  ▣ NOTES · 2               ⌄  │
│ ────────────────────────────────────────────────  │
│  WEAPONS │ SPELLS │ ITEMS               ◆ 2/3    │
│ ────────────────────────────────────────────────  │
│ ■ Pact Blade  ◆         ATK +7    1d8+4 force     │
│ ■ Hand Crossbow         ATK +5    1d6+3 piercing  │
│ □ Dagger                ATK +5    1d4+3 piercing  │
│ ────────────────────────────────────────────────  │
│                                ↗ Open full sheet  │
```

- **Weapons tab**: equipped ■/□ + attunement ◆ + name (truncates) + fixed-width right-aligned ATK and DMG rails in Cinzel. Unequipped sorts last at 0.5 opacity. ATK/DMG must be computed by the **same** logic as the player sheet's Combat-tab quick reference — DM and player must never see different numbers.
- **Items tab**: potions and ammunition with qty first, then author order, unequipped last. `× N` qty in Cinzel `--pal-gem`; `× 0` in `#c06060` with the name dimmed. Sort computed once at open, never re-sorted while open.
- **Spells tab**: existing spell-tag treatment at 13px, author order, existing `Type: Name` tooltip, plus one 26px read-only "Slots remaining" pip row (deliberate, bounded duplication — "can they cast it" is half the question).
- **Rows with a description** expand inline on tap (160ms) showing the description in Crimson italic + mod chips. Rows without a description are not tappable and show no affordance.
- **Read-only throughout.** Equipped, attunement and qty glyphs have no hover, no cursor change, no tap handler. `↗ Open full sheet` sits at the drawer's bottom as the escape hatch.

### Motion (summary — full spec in the brief §6)

- Open: max-height 0→auto, 200ms `cubic-bezier(0.2,0.8,0.2,1)`; content fades in at 60ms delay; chevron rotates 180°; band tints to ~10% accent.
- Rows stagger in: opacity + 4px translateY, 140ms each, 14ms stagger, capped at 8 rows.
- Close: 160ms — departures are faster than arrivals.
- Accordion swap: card A collapses and card B expands **simultaneously**, not sequentially.
- Tab switch: directional 6px translate + cross-fade, ~130ms.
- **Live value flash**: when a poll or WS nudge changes a qty/ATK/DMG/slot while the drawer is open, that value alone flashes (`--pal-accent-bright`, scale 1→1.12→1, 500ms). The drawer must never re-animate, re-sort, or scroll on a poll tick.
- Trigger at rest: no animation at all.
- `prefers-reduced-motion`: everything → 0ms, opacity swaps only.

### Explicit non-interactions

No editing of any kind. No swipe-between-tabs (third gesture axis in a nested scroll stack). No long-press (reserved for token removal). No search input. **The drawer never auto-closes** — not on turn change, damage, poll, or the character dropping to 0 HP (that last one is exactly when the DM wants the Items tab).

### Defaults & persistence

Tab resolution: last explicit DM choice this session (`sessionStorage.dnd_dm_loadout_tab`, global, no slug) → else mode-derived (`mapMode === "battle"` → Weapons, else Items) → else Weapons. Drawer *openness* is not persisted across reloads.

### Open questions for the user

1. `⚗N` consumable badge on the trigger (total potion qty, hidden at 0) — assumed useful ambient intel. Safe fallback is no badge.
2. Adventure-mode default tab assumed to be `ITEMS`; `SPELLS` may fit a more ritual-heavy table.
3. The DM notes strip becoming half-width is the reduction that pays for this. Keeping it full-width costs +44px card height instead — your call.
4. The duplicated slots row inside the Spells tab — argued for, but deletable.
5. Whether the drawer should also be reachable from the initiative tracker's PC entries (out of scope as designed).

---

## Architect Notes

**Applies**: ADR-001, ADR-002, ADR-004, ADR-006, ADR-011, ADR-014, ADR-020

### Backend: one real change, and it is cheaper than it looks

Brief open item confirmed: `spells` **is** already in the DM projection, but **`weapons` and `equipment` are not**. `DM_PARTY_FIELDS` and `DM_PARTY_PROJECTION_EXPRESSION` in `backend/src/lib/partyProjection.js` (lines 18–26) must both be widened — they are two parallel lists that must stay in sync, and the second needs no new `ExpressionAttributeNames` entry since neither name is a DynamoDB reserved word. That single file change serves **both** `dmParty.js` (ScanCommand) and the `getSessionState.js` DM variant (BatchGetItem), which is the one the dashboard actually polls (ADR-011, Story 35 amendment). No new handler, no new endpoint, no `template.yaml` change, no migration.

**Critically: this is DynamoDB-cost-neutral.** Both Scan and BatchGetItem are billed on *full item size* regardless of `ProjectionExpression`, so widening the whitelist changes response bytes only — not RCUs. See ADR-020 §5 for why the polled payload beats an on-demand fetch here (avoids a second code path, a per-drawer loading state, and the staleness that would defeat this brief's live-value-flash spec).

**Do not widen `PLAYER_VISIBLE_FIELDS`** in the same file. That list feeds `GET /party/status` and the public `getSessionState` variant; adding loadout there would leak every character's inventory to every player.

### ATK/DMG: no computation to replicate — extract a 6-line helper

The brief's strongest requirement ("ATK/DMG must be computed by the **same** logic as the player sheet… DM and player must never see different numbers") is much easier to satisfy than it reads, because **nothing is computed**. Attack bonus and damage are stored pre-totalled on the weapon's own `mods[]` — `ItemEditorModal.jsx` line 232 literally placeholders the ATK field as `"total (mod+prof+magic)"`. The display logic is a lookup:

```js
// src/features/characterSheet/CharacterSheetSessionMode.jsx:96
function weaponMeta(weapon) {
  const atkMod = (weapon.mods || []).find((m) => m.attribute === "Attack Bonus");
  const dmgMod = (weapon.mods || []).find((m) => m.attribute === "Damage");
  ...
}
```

There are already **three** near-duplicate copies of this lookup — `CharacterSheetSessionMode.jsx:96`, `CharacterSheetViewMode.jsx:1752`, and `DiceRoller.jsx:46`. Adding a fourth in the DM drawer is exactly the duplication-that-diverges risk the requirement is guarding against. **Extract to `src/lib/weaponStats.js`** exporting pure `getWeaponAtk(weapon)` / `getWeaponDmg(weapon)` / `weaponMeta(weapon)`, and repoint all three existing call sites. It is genuinely shared across two feature slices now, which is ADR-002's stated bar for promotion; `src/lib/rollHistory.js` is the precedent for a small shared display-logic module. No ability-modifier or proficiency math is involved anywhere — do not add any.

Related: `attunedCount` for the `◆ 2/3` chip is already derived in `CharacterSheetViewMode.jsx:448` across `weapons` + `equipment`; the max of 3 is a hardcoded 5e constant (ADR-013).

**Tech approach**: Build `CardDrawer.jsx` per ADR-020 — one container per card owning a single `openSection` string, with `DmNotesStrip` refactored into a section inside it (it currently sits *outside* `.cc-card-body` as a sibling of `DeathSavesStrip`, at `CharacterCard.jsx:628`, and owns its own local `open` state, which must be lifted). The footer-band reduction the brief proposes is what makes this a restructure rather than an append: `DmNotesStrip`'s `hasDeathStripBelow` prop exists purely to manage border-radius against `DeathSavesStrip` below it, and that coupling moves to the band. Dashboard-wide accordion state goes in `DmDashboardPage.jsx` as `openDrawerSlug`, extending the existing `openCardPopoverSlug`/`onPopoverOpenChange` pattern (lines 50, 914–919) — do not invent a second mechanism. Scroll-anchoring on open reuses the existing `cardItemRefs` slug→node `Map` (line 903). Tab strip and rows are read-only: no handlers, no `cursor: pointer`, no hover on the equipped/attunement/qty glyphs. CSS per ADR-001/ADR-014 in `characterCard.css`; keyframes there too, never injected.

Proposed component boundary, so this and Story 50 cannot conflict:

```
<CardDrawer
  slug={char.slug}
  pal={cardPal}
  char={char}                 // full projected party member
  dmPassword={dmPassword}     // notes section only
  openSection={...}           // null | "notes" | "weapons" | "spells" | "items"
                              //      | "skills" | "abilities"   (Story 50's codex)
  onOpenSectionChange={...}    // null closes; parent enforces cross-card accordion
/>
```

The single `openSection` union makes intra-card mutual exclusion — which both briefs require — a property of the data type instead of coordination logic between three sibling components. Whether a section renders as stacked lists (brief 50) or as tab panes (brief 51) is decided *inside* that section's renderer, so the two briefs' disagreement never reaches the container.

**Scope boundary**:

*In*: `partyProjection.js` whitelist widening (`weapons`, `equipment`); `src/lib/weaponStats.js` extraction + repointing 3 call sites; `CardDrawer.jsx`; `DmNotesStrip` refactored into a drawer section; the shared footer band; Weapons/Spells/Items tabs read-only; `openDrawerSlug` accordion in `DmDashboardPage.jsx`; scroll-anchor on open; `↗ Open full sheet` escape hatch; `sessionStorage` key for last tab (ADR-006).

*Out*: every write path — no editing, no qty stepper, no attunement toggle, no potion use, no drop-item (all remain owner-only on the sheet); no swipe gestures; no long-press (reserved for token removal, ADR-018); no search; no initiative-tracker entry point (brief open question 5); no `PLAYER_VISIBLE_FIELDS` change.

*Resist*: (a) rebuilding a spell-chip renderer — reuse `InfoBadge` from `CharacterTalents.jsx`; (b) adding a tooltip to spell chips — `spells` is `string[]` free text with no description data, so the existing `Spell: <name>` fallback renders the name twice and carries zero information (see Story 50's notes); (c) re-deriving sorted rows on every poll tick (see below); (d) letting the Items tab drift toward a second copy of the Inventory tab.

**Sequencing with Story 50**: The two briefs contradict each other about the shared container — brief 50 says its codex *is* the container and this story appends two stacked sections; brief 51 says Story 50 has no drawer and may append a fourth tab here. Recommendation (detailed in Story 50's notes): **two passes, split by tier, not by story.** Pass A ships Story 50's card-face Capability Rail only (no drawer, no backend change). Pass B is this story *plus* Story 50's codex, building `CardDrawer` **once** with all five sections. This story is Pass B and should not start until the Pass A rail is in, because the rail is a codex trigger and the drawer is the only place the codex can live. Building this story's drawer first and retrofitting the codex later also works — but then whoever ships second must not restructure the container, per ADR-020 §2.

**Performance notes**: The drawer's biggest risk is per-tick churn. `party` object identity changes on every poll tick, so every card re-renders — meaning any sorting/filtering done inline in the drawer body re-runs at 1Hz for every open drawer, and the brief's "sort computed once at open, never re-sorted while open" would silently be violated. Snapshot the sorted rows into state on open and derive nothing sortable from `char` afterwards. `DmNotesStrip` already establishes exactly this pattern with its `if (!open) return;` sync-deferral guard (lines 25–28) — copy it. The live-value flash then needs *targeted* comparison of qty/ATK/DMG/slot values against the snapshot, not a re-render of the list. Also honour the brief's own rule that the drawer must never scroll or re-animate on a poll tick; with `maxHeight` transitions, a re-mounted child will re-run the open animation, so keep the container mounted and swap section content.

**Cost notes**: Zero new AWS resources. Zero additional requests. Zero additional DynamoDB RCUs (full-item billing, as above). The only cost is response payload growth on the DM poll: `weapons` + `equipment` for every party member, including `description` strings and `mods[]`, on every tick. At a 5-person party with ~10 items each this is single-digit KB and irrelevant at current scale — and note the DM tab polls at 30s while the WebSocket is connected (ADR-011/ADR-019), not 1s. Worth stating plainly since Story 35 existed to cut poll cost: **request count does not change, only bytes.** ADR-020 records the revisit trigger (party > ~10, or > ~40 items/character).

**Dependencies**:
1. `partyProjection.js` widening must land before the Weapons/Items tabs can render anything — do it first and verify the DM payload actually contains the fields before building UI against them.
2. Story 50's Pass A rail, if following the recommended sequencing.
3. `weaponStats.js` extraction should land before the drawer consumes it, so there is never a moment with four copies of the lookup.

**Risks / decisions needed**:

1. **The footer-band reduction is the highest-risk item in this story** (brief open question 3, and the brief's own stated justification for the whole trigger). It restructures a region that `DeathSavesStrip` mounts against and that `DmNotesStrip` currently manages border-radius for — and death saves are the most consequential UI on the card (Story 19). Regression-test the 0-HP → FALLEN flow after the band lands; `CharacterCard`'s lifted `isFallen`/`isStable` and the `deathSavesRef` imperative `showDmgAtZeroPrompt()` handoff both cross this boundary. If the user declines the reduction, the fallback is +44px of card height and this story gets materially simpler and safer.
2. **Story 50's height argument is void** — its brief claimed removing an existing badge wall would make cards ~60px *shorter*, but that badge wall does not exist on the DM card (verified; see Story 50's notes). So the footer-band reduction is paying for *two* additions, not offsetting one. Re-check the net card-height budget with the user before committing.
3. **Active-turn auto-expand (Story 50) vs. "the drawer never auto-closes" (this brief)** are mutually exclusive under a dashboard-wide accordion: advancing the turn would force-close whatever drawer the DM had open elsewhere. Needs one decision covering both stories — recommendation and options are in Story 50's notes.
4. Brief open questions 1 (`⚗N` consumable badge), 2 (adventure-mode default tab), and 4 (duplicated slots row in Spells) are all cosmetic and independently deletable — safe to build as specified and cut later; none affect the architecture.
5. Minor: the brief's mode-derived default tab reads `mapMode === "battle"`, but the dashboard's own mode state is the `combatMode` boolean in `DmDashboardPage.jsx` (line 51) — use that, not the per-map field, so the default agrees with the Adventure/Combat toggle the DM actually pressed.
