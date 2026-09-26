# Feature Story: Simplify the Classic Profile View

**Status**: Needs UX design
**Source**: User request
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

The classic character sheet ("Profile" mode, reached at `/characters/:slug`) currently carries a four-tab strip — Inventory | Persona | Combat | Map — that has accumulated live-session-oriented content (a Combat tab with concentration, conditions, spell slots, the dice roller, and session notes; a Map tab tied to the active battle map) alongside its original purpose as the character's reference/backstory view. Session mode (`/characters/:slug/session`) already exists as the dedicated live-play surface and already has its own Combat and Map sub-tabs that do this job better — they're built for during-play use (no-auth writes, live polling, token/battle-map interaction), while the classic Profile view's Combat and Map tabs are largely duplicating that same functionality on a page that was never meant to be the live-play surface. This story simplifies the classic Profile view back down to what it's actually for: a quick reference for "who is this character" — the basic identity header (name, race, class, level, portrait, etc.) plus the Persona tab's backstory/traits/description content — by removing the tabs that only matter during actual play, since play already has its own, better home.

## User stories

- As a player, I want the classic Profile view to just show my character's identity and backstory, so I'm not maintaining or looking at a second, redundant copy of live-session tools (combat tracker, map) that I already use in Session mode.
- As a DM, I want the classic Profile view to be a clean reference for a character's background and traits, so I'm not confused about which page is the "live" one when I'm looking something up between sessions.
- As a player or DM, I want fewer places where the same session-state data (conditions, concentration, spell slots, map position) is displayed, so there's only one place to look for "what's happening right now."

## Functional requirements

- The classic Profile view's tab strip changes from four tabs (Inventory | Persona | Combat | Map) to fewer tabs, per the removals below.
- **Remove the Map tab** from the classic Profile view entirely. Session mode's Map sub-tab (the `PlayerMapViewer` / battle-map view) is unaffected and becomes the only place a character's map view lives, for both players and any classic-view visitor.
- **Remove the Combat tab** from the classic Profile view entirely. This includes everything currently in that tab: the concentration banner/set-input, inspiration toggle, condition grid, spell slots display, weapons/attack-spells quick-reference, session notes section, and the dice roller. (XP and coin live management are **not** part of the Combat tab — confirmed against source, they render in the Inventory tab — and are unaffected by this removal either way.) Session mode's Combat sub-tab (which already has an equivalent read-only weapons/attack-spells reference, concentration, conditions, spell slots, and — per Story 57 — the Attack Declaration Bar and dice roller) is unaffected and becomes the only place Combat lives going forward.
- **Keep the Persona tab** as the main remaining tab content, unchanged — the traits/backstory list (the `inPlay[]` array) stays exactly as it is today.
- The basic character details header (class/subclass line, name, nickname, pronunciation guide, the Race/Class/Subclass/Alignment/Background/Origin detail grid, and the full-bleed portrait with tagline) stays exactly as it is today — none of this is a tab and none of it is affected by this story.
- The Collections/Persona sections area below the stats block (the "Character"/"History" backstory content viewer with its section navigation) also stays exactly as it is today — this is separate from the four-tab strip and is not in scope for removal.
- The Inventory tab's fate is explicitly undecided — see the open question below. Do not remove it as part of this story; if it is removed, that should happen as a deliberate, separately-scoped follow-up once Story 58 has landed and the "does Session mode fully replace it" question has an actual answer.
- Edit mode is unaffected by this story. The classic sheet's edit mode already edits Combat-tab-adjacent data (spells, conditions are session-only so not edit-mode fields, but weapons/equipment/spell slots configuration, etc. are edit-mode fields) and Map-tab-adjacent data (map library management lives elsewhere, e.g. `MapLibraryPage`) — none of that changes. This story is scoped to the VIEW-mode tab strip only.

## Data model changes

None. This is a presentation/navigation change only — no character fields are added, removed, or reshaped. All data currently shown in the classic Profile view's Combat and Map tabs continues to exist and continues to be read/written exactly as today; it's simply no longer surfaced a second time on this particular page.

## Out of scope

- Any change to Session mode's Combat or Map sub-tabs — they are the unaffected, surviving home for this functionality and this story doesn't touch them.
- Any change to the Persona tab's content, layout, or the Collections/backstory section editor.
- Any change to the identity header (name/race/class/level/portrait/tagline block above the tab strip).
- Removing or changing the classic sheet's edit mode.
- Deciding the Inventory tab's fate — see open question below; explicitly not decided by this story.
- Any change to Story 58 (Session mode inventory editing) — this story is related but independent, see the dependency note below.

## Open questions

- **Should the classic Profile view's Inventory tab also be removed once Story 58 lands, or kept as a secondary/read-only view?** The user explicitly said "we could probably keep it" but did not decide either way. This needs an explicit answer before `design-strategist` scopes the final tab strip (two tabs — Persona only — vs. two tabs — Persona + Inventory). Note the sequencing: this decision logically depends on Story 58 shipping first (there's no point deciding whether the classic Inventory tab is redundant until Session mode's Loadout tab actually has the add-weapon/add-item/GP/XP capability that would make it redundant) — but the Map and Combat tab removals in this story do **not** need to wait for Story 58; they can ship independently and immediately.
- Once Map and Combat are removed, does the tab strip UI still make sense as a "tab strip" at all if it only ever has one or two tabs (Persona, and possibly Inventory)? This is a design question for `design-strategist` — the underlying gameplay decision (remove Map, remove Combat, keep Persona) is settled here regardless of how few tabs that leaves.
- Is there any between-session use case (e.g., a player reviewing what conditions or concentration they ended a session with) that the Combat tab currently serves that would be lost with no replacement? The user's framing is that this tab is "pretty much deprecated," implying no — but flagging so it's a deliberate call, not an oversight.

---

## UX Design

**Brief**: `design/briefs/simplify-profile-view-brief.md` — the authoritative spec.

**Tier: this story is a tier demotion of the whole page.** The classic Profile view goes
from Tier 1 (its tab strip literally defaults to `"combat"`) to **Tier 3 — on-demand
reference**. The Inventory section within it is Tier 2. Nothing on this page is Tier 1
afterwards. That sentence is the entire design; every other decision follows from it.

**The tab strip should not shrink to two tabs — it should be deleted.** Answering the
story's second open question directly: a 64px full-width icon+label strip earns its cost
only when it compresses a surface you switch between under time pressure. Nobody switches
between backstory and inventory under pressure. With two panels left it becomes the
loudest element on an otherwise linear page, and it is the *second* nav mechanism sitting
directly above the Collections section-button nav. One page, one nav idiom. Both surviving
panels become plain titled sections in the scroll, using the existing Collections
section-title treatment verbatim (14px IM Fell English, uppercase, 0.2em, `--pal-accent`,
preceded by the existing `.divider`) — zero new visual vocabulary. Final order:
**stats panel → Inventory → Persona → Collections → footer.** Inventory sits under the
stats panel because item mods are the literal source of the modifier values in the
ability-score flyouts; Persona sits above Collections because traits and backstory are
the same register. **Net mobile win: 64px of vertical space returned above the fold on
every phone, on every character, permanently.**

**Recommendation on the Inventory tab (the story's own open question): KEEP it** — and
this recommendation does **not** depend on Story 58's outcome. Three reasons: (a) once the
Combat tab goes, the Inventory section is the classic sheet's **only remaining view-mode
home for XP and coin** — removing both leaves a sheet that cannot show you your gold;
(b) it is the *rich* read view (attunement banner, expandable descriptions, mod chips,
drop/use) where session mode's Loadout is a simplified name/qty/attunement grid, and
Story 58 explicitly excludes editing existing items; (c) inventory is between-session
planning, not live session state, so keeping it doesn't violate this story's own "one
place for what's happening right now" principle the way conditions and concentration did.
Flagged as a recommendation you can override with a one-line change to the brief's §3.2.

**Two things do NOT survive the Combat tab's removal — one of them is blocking.** The
brief's §0 inventories every Combat-tab element against its surviving home. Everything is
covered except: **spell slots** (session mode's display is read-only, and the Short/Long
Rest buttons are DM-dashboard party-wide only) — so deleting this tab removes the
player's *only* self-serve way to spend or restore a slot anywhere in the app; and
**the exhaustion 0–6 stepper**, whose presence in session mode's `ConditionPickerModal`
is unverified. The first is a functional regression wearing a presentation-change
costume. **Recommendation: split the shipping order — remove the Map tab immediately
(zero cost, strictly better elsewhere per Story 57's own note that the classic Map tab
has no token layer at all), and hold the Combat tab removal behind a small follow-on that
makes session-mode slot pips tappable and adds Short/Long Rest there.** See brief OQ-1/OQ-2.

**The identity header is unaffected — but the TopNav is not, and that's the wayfinding
answer.** Nothing in the class/name/nickname/pronunciation/details-grid/portrait/tagline
block changes. However, session mode's TopNav already carries a `❡ Profile | ⚔ Session`
NavSegment in its center slot while the classic sheet buries `⚔ Session` in the ⋯ menu.
That asymmetry is fine while this page has combat tools of its own; the moment it doesn't,
a returning user hunting for Combat or Map has nothing on screen pointing at where they
went. **Promote the same NavSegment into the classic view's TopNav center slot** — same
component, same props, same <560px mobile-row fallback (Story 37) — and delete the
now-duplicated `⚔ Session` ⋯ item. Two tabs and two surfaces are being removed; adding one
already-built, already-learned control that names their new home is a net reduction in chrome.

**Plus one self-deleting orientation line.** `dnd_tab_${slug}` defaults to `"combat"`, so
most returning users have a stored value naming a tab that no longer exists. On mount, if
that key reads `"combat"` or `"map"`, render one quiet muted line in the exact pixels the
tab strip used to occupy — *"Combat and Map now live in ⚔ Session mode. →  ×"* — then
delete the key immediately so it can never appear twice. Informational register, not
accent-tinted. The key is retired entirely; no writes remain.

**Motion: this story is net-negative on animation, deliberately.** The tab panel switch
was the only transition in this region and nothing replaces it. The single remaining
animation in the whole brief is the notice's 140ms fade+collapse on dismiss — which makes
the reduced-motion table exactly one row. Explicit non-goals: no staggered section
entrance, no scroll-spy, no smooth-scroll jump links, no collapse/expand on Inventory.
Likewise **no new colour tokens, and no glow, `--pal-gem` emphasis, or `#c06060`** anywhere
in the new layout — this page no longer displays critical state, so it must no longer
carry the app's danger or ambient-alert vocabulary.

**One intentional content change to the Persona panel: when `inPlay[]` is empty the
section unmounts entirely** — head, divider and all — rather than showing today's
empty-state message. An empty *tab* needs an explanation because the user deliberately
navigated to it; an empty *section* should simply not exist. Sparse-first.

**Data: zero model change, and do not delete the poll.** No new fields, endpoints or
writes. The page stops writing `concentration`, `conditions`, `exhaustionLevel`,
`inspiration`, `spellSlots`, `playerNotes` (all still written from session mode) and
becomes read-mostly — its only surviving `patchSession` writes are the Inventory
section's. `CharacterPage.jsx`'s single `getSessionState({ slug })` poll must **stay**
(Story 36b's `staleClient.reportServerBuildVersion()` rides on it, and Inventory must
reflect items added elsewhere); what it should stop consuming is `mapLibrary`/`activeMap`,
whose only consumer was the Map tab. Since the page is now pure reference, relaxing its
poll cadence is a legitimate follow-on saving — flagged for `code-architect`, not specced here.

**Removal warning for the builder: do not delete any component file.** `DiceRoller.jsx`
and `SessionNotesSection` are both mounted by session mode. This story removes *usages*,
not files.

**Open questions needing your decision** (brief §12): **OQ-1** — spell slots / rests
regression: prerequisite follow-on (recommended) vs. accept the loss. **OQ-2** — verify the
exhaustion stepper exists in session mode before deleting the condition grid. **OQ-3** —
Inventory tab: keep (recommended, with reasons above) vs. remove. **OQ-4** — "Inventory"
vs "Loadout" naming, later pass. **OQ-5** — keep the one-time notice, or smallest-possible diff.

**Cross-references**: retires Story 57's footnote that "the classic full character sheet's
Map tab is unaffected"; reuses Story 37's `NavSegment`/TopNav center slot verbatim;
depends on Story 36b's poll surviving; applies Story 16's tier principle at page scale;
**independent of Story 58** — the Inventory recommendation stands regardless of 58's outcome.
