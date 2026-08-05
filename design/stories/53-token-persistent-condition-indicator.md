# Feature Story: Persistent Condition Indicator on Tokens

**Status**: Implemented
**Source**: RPG Consultant (live-session feedback)
**Prototype**: `design/prototypes/token-effects-review.html`

**Note**: Second of the four-story visual-effects cluster (Stories 52–55). This story defines only the gameplay trigger, source data, and duration rule — a `design-strategist` pass is the planned next step for the actual symbol/icon treatment per condition. Do not treat anything below as a visual spec.

## Goal

Active conditions (poisoned, charmed, restrained, and the rest of the 14 standard conditions) already exist as data on every character and NPC, and already show up as pills in the character sheet's Combat tab and as condition chips on the DM's party cards. But on the map — the surface everyone's actually looking at during a fight — there's no indication that a token is affected by anything ongoing. A DM tracking "who's still poisoned" or a player trying to remember "wait, is that enemy still charmed" has to look away from the map entirely. A persistent, always-visible marker on the token itself, for as long as the condition is active, keeps that information where the action is.

## User stories

- As a DM, I want to see at a glance which tokens on the map currently have active conditions, so I don't have to cross-reference party cards or NPC cards mid-fight to remember who's poisoned, restrained, etc.
- As a player, I want to see which tokens (mine, my allies', or enemies') have visible ongoing conditions, so I can factor that into my own tactical decisions without asking the DM to recap status effects out loud.
- As a DM or player, I want the indicator to stay on the token for exactly as long as the condition is actually active — no more, no less — so it stays trustworthy as a source of truth.

## Functional requirements

- **Trigger**: a character or NPC has one or more entries in its active `conditions` list.
- **Duration**: the indicator remains on the token for as long as that condition remains in the entity's active conditions — added the moment a condition is applied, removed the moment it's cleared (via the existing condition toggle/management UI, or "Clear All Conditions").
- **Scope**: applies to both PC and NPC tokens, on both the DM's map and the player-facing map, using the same condition data already tracked for each (characters already have a `conditions` array; NPCs already support conditions via the DM dashboard's NPC cards).
- **Multiple conditions**: an entity can have more than one active condition at once — the indicator approach needs to account for showing more than one condition simultaneously without the token becoming unreadable (design's call how, but the gameplay requirement is that no active condition should be silently unrepresented because another one is already showing).
- **Visibility**: no visibility restriction beyond who already sees the token — this is a straightforward reflection of state that's already visible elsewhere (party cards, character sheet), just relocated onto the map.
- **Reads from**: the existing `conditions[]` field on characters and NPC combat entries — no new state to track, this is purely a new rendering surface for data that already exists and is already kept current by the existing condition-toggle UI.

## Data model changes

None. This is a new rendering surface (map token overlay) for the existing `conditions[]` field on characters and the existing conditions field on NPC combat entries — no new fields, no new write paths.

## Out of scope

- The actual icon/symbol design per condition, stacking/overflow treatment for multiple simultaneous conditions, and any animation — all design-strategist territory next.
- Exhaustion level (tracked separately from `conditions[]` via `exhaustionLevel`) — worth deciding during design whether it belongs in this same token-overlay treatment or is out of scope for this pass.
- Condition duration/auto-expiry mechanics (e.g., "this poison lasts 3 rounds then clears itself") — the app has no such timer today; conditions clear only when a player/DM manually clears them, and this story doesn't change that.

## Open questions

- Should exhaustion level be represented on the token the same way conditions are, given it's tracked as a separate field but is conceptually the same kind of "ongoing status" information?
- With up to 14 possible conditions plus exhaustion, how many simultaneous indicators is actually useful on a small token before it becomes noise rather than signal? This is a design question but worth flagging now since it affects whether "show all active conditions" is even the right requirement versus "show the N most significant."

---

## UX Design

**Brief**: `design/briefs/token-persistent-condition-indicator-brief.md` — the
authoritative spec. `design/briefs/token-effects-symbology-brief.md` §4 remains
normative for the *cluster-level layer budget* (how 52/53/54/55 share one 36px
object); its §6 is superseded by the dedicated brief, with every divergence
itemised in that brief's §13.

**Tier**: 2 — ambient reference. Two consequences that are design law:
**badges have no resting animation of any kind**, and **badges are not
interactive** (`pointer-events: none`; the chip keeps 100% of its existing hover /
long-press / drag surface).

**Placement — a left-edge column, top-anchored at ~11 o'clock, growing
downward.** 10→8 is the largest free arc (1–2 = concentration gem, 4–5 = Story
31's number badge, 6 = name label, 12 = Story 54's DM-only `◇`). Badges live
*inside* `.token-chip`, so Story 45's counter-rotation keeps them upright on a
rotated map for free, and they are counter-scaled against `--token-size-mult` so a
status badge is the same physical size on a familiar and on a Gargantuan dragon.
Three invariants: **slot 1 never moves** (top-anchored, not centred — a band
change or a cleared sibling shifts nothing); reading order top→bottom = priority
order; badges never overlap the ring stack (≥1px clear, so Story 52's wound halo
and Story 54's dashed veil ring stay unbroken at 9 o'clock). One change to an
existing element: **the name label's offset goes 2px → 4px below the token**,
globally and unconditionally, to clear slot 3 without a conditional layout.

**Overflow — partial override of the story's requirement, and a change from the
cluster brief.** Six legible icons cannot fit around an 18–36px circle. **3 slots
max — and no `+N` numeral anywhere.** Instead the bottom-most badge of a truncated
column carries a **stacked-plate motif** ("there's more behind this"), one motif
reused for truncation, the collapsed small-size band, and the 0-HP state. This
shows *three real conditions* rather than two plus the uninformative number "5",
and it **withdraws the cluster brief's requested exception to the 12px minimum
text rule entirely** (former OQ-10 — no longer needed). The story's real
requirement — nothing silently unrepresented — is met by a two-surface guarantee:
ambient signal = badges; **authoritative record = the existing hover/long-press
detail card, which gains a fully specified condition block** listing every active
condition by name (11px IM Fell English, family-coloured glyph + name, in the same
priority order as the column, exhaustion level shown numerically here). Zero new
chrome, zero new gesture.

**Severity priority (locked, not the implementer's choice):**
1. Incapacitating — Unconscious · Paralyzed · Stunned · Petrified · Incapacitated
2. Positional — Restrained · Grappled · Prone
3. Sense/will — Blinded · Charmed · Frightened · Deafened
4. Attrition — Poisoned · Exhaustion (1–3)

Positional ranks above sense specifically *because this is a map* — "can't move"
is what a map carries best. Ties break on `conditions[]` array index (application
order, oldest first); the sort **must be stable and index-keyed, never
alphabetical**, or badges reshuffle when an unrelated condition is added.

**Visual:** 12px circle · dark plate `rgba(10,10,12,0.88)` · 0.5px
`rgba(255,255,255,0.14)` outer hairline · 1.5px family-coloured ring ·
family-coloured glyph. Four families do the coarse read, glyphs the fine read:
Control `#b05878`, Bind `#c8903c` (reuses the universal wounded-amber), Sense
`#8a7cc8`, Physical `#8fae3c` (deliberately yellower than the app's healthy-HP
`#5a9a5a`). The key enabling insight: **a glyph only has to be distinguishable
from others in its own family** — largest family is 5, which is drawable at 12px;
14 mutually distinct marks is not. **Every glyph is a filled path — no strokes
anywhere** (a stronger rule than the cluster brief's "no strokes under 1.5px";
fills survive downscaling, strokes don't). Full 14-glyph silhouette table in the
brief §5.4.

**Degradation ladder** (`effective_px = 36 × token.scale × map.tokenScale ×
zoom`): 3 slots at ≥30px · **2 at 20–30px, the practical mobile default and the
layout to design against** · 1 collapsed summary badge at 12–20px · none below
12px, where only ring treatments survive. Resolved as a JS-computed
`data-cond-band` attribute with **80ms debounce + 2px hysteresis** — container
queries are unreliable inside a transformed layer, and strobing at a zoom
threshold is the one way this feature can look broken.

**Open questions resolved:**
- *Exhaustion* → **included**, but **as a six-segment radial gauge, not a
  numeral** (a numeral renders ~8px and is illegible; the gauge reads as a
  proportion at any size, encodes severity as quantity, and reuses the Counter
  Wheels fill-to-here vocabulary). Physical family at 1–3, **promoted to Control
  tier and Control colour at ≥4**, where 5e halves HP max and zeroes speed.
  General rule stated so this isn't a special case: a badge's ring colour is
  always its current priority family's colour.
- *How many is useful* → the ladder above.
- *Invisible* → **excluded from the badge set entirely** on every viewer; it is
  Story 54's whole-token treatment. Applied identically for DM and players so slot
  assignments and stack motifs always agree.
- *FALLEN / 0 HP* → **collapses to one summary badge at 0.6 opacity**, not hidden
  (a deliberate divergence from cluster brief §8 Rule 6). Compressing beats
  deleting, "this body is also Petrified" occasionally matters, and it reuses the
  1-slot component for free.

**New player-side visibility rules (design requirements, not implementation
details):** other PCs' badges hide when `partyVisibilityEnabled` is false (showing
conditions while hiding HP is incoherent) — **the player's own token always shows
its own badges**; NPC `conditions` must be **added to the public projection** (not
carried today — `initiativePublic` strips to `healthTier`); and an NPC whose
linked initiative entry is **hidden carries no public conditions**, making the
DM's existing hide-entry toggle the single secrecy lever with no new field and no
new UI.

**Flagged for approval:** exhaustion inclusion (brief OQ-1); the 320ms
tier-escalation pulse at exhaustion 3→4, the one time a badge raises its voice
(OQ-3); making NPC conditions public to players (OQ-4); hiding PC badges with
party visibility (OQ-5); the 0-HP summary badge (OQ-6); the four family colours as
an eventual system-wide commitment that should propagate to the sheet's condition
pills and the DM card's condition chips (OQ-7); and the 2px name-label offset
change to Story 29's spec (OQ-8). **No design-system exception is requested** —
former OQ-10 is withdrawn.

### Prototype review addendum (2026-08-04)

Confirmed against `design/prototypes/token-effects-review.html` (Battle Atlas
review page, Stories 52–55 combined) after several rounds of visual feedback:

- **Badge size increased from the brief's original dimensions**: 12px circle →
  15px, inner glyph 7.5px → 9.5px, border 1.5px → 2px, slot pitch 13px → 16px,
  slot-1 offset -20px → -25px, collapsed/summary badge 14px → 18px. The original
  sizing read as illegible in live review — this is now the sizing to implement
  against, superseding the raw numbers in the brief's §5.4 where they conflict.
- **Hover/long-press detail card must work on NPC tokens, not just PC tokens** —
  explicitly confirmed as a requirement during review (the brief's "authoritative
  record = hover/long-press detail card" language was written PC-first; NPCs need
  the same card, listing name, portrait/avatar, HP, and the full condition list).

---

## Architect Notes

**Applies**: ADR-021 (token DOM / CSS file location), ADR-023 (server-side
player-facing projection), ADR-011 (consolidated poll), ADR-014 / ADR-001 (CSS),
ADR-013 (rule tables as frontend constants), ADR-003.

### Tech approach

This is the **lowest-risk story in the cluster and the one everything else needs
first** — it establishes the badge orbit, the size-band resolver, and the detail
card's condition block that Stories 52 and 54 both write into.

**Frontend, mostly.** Badge column lives inside `.token-chip` (L2 badge orbit), so
Story 45's counter-rotation keeps it upright for free — no rotation handling, and
**no CSS `rotate` property anywhere** (repo-wide rule from Story 45; `rotate`
applies before `transform` and would break positioning). Counter-scale against
`--token-size-mult` with `transform: scale(calc(1 / var(--token-size-mult, 1)))`
and `transform-origin: center right`, per the brief §4.

Condition→`{family, rank, glyphId}` mapping, the badge-eligible filter (all
`conditions[]` minus a normalised `"invisible"`, plus `Exhaustion` when
`exhaustionLevel >= 1`), the stable index-keyed priority sort, and the size-band
resolver all go in the shared
`src/features/dmDashboard/battleMode/tokenEffects.js` module — the same module
Story 52 creates. **One shared canonical condition-string table** (resolves brief
OQ-8 across 53 and 54: one table, not two). Matching is trim + case-insensitive;
unrecognised strings get the neutral `#c8c0b4` single-dot badge at rank 4 and are
never dropped. Treat the family/rank table as a 5e rule table per ADR-013 — a
named exported constant, no backend storage.

Glyphs: one SVG `<symbol>` sprite rendered once per map surface, referenced by
`<use>` — not inlined paths per token (20 tokens × 3 badges of inline path data is
real DOM weight for zero benefit). All glyphs are filled paths, no strokes.

**Size-band resolver — zoom is already available on both surfaces**, so no
`MapViewer.jsx` change is needed: `MapPanel.jsx:88` already derives
`viewerZoom = viewerState?.scale ?? 1`, and `PlayerMapViewer` already uses
`viewerState?.scale` for its `labelsHidden` calculation
(`CharacterSheetSessionMode.jsx:1393`). `effective_px = 36 × token.scale ×
map.tokenScale × zoom`. **Compute the band once in the parent and pass it down as
a prop** — do not compute it inside `TokenChip`. `onViewChange` fires on every pan
frame; per-chip computation would run N× per frame. Apply the brief's 80ms debounce
+ 2px hysteresis **in the parent**, on the shared zoom value, so all chips change
band on the same tick (a staggered band change across a board would read as a bug).

**CSS goes in `src/features/dmDashboard/battleMode.css`.** The brief says
`tokens.css`; that file does not exist and must not be created (ADR-014, ADR-021).

**Backend — three targeted projection changes** (ADR-023):

1. **NPC `conditions` into the public payload.** Today `getSessionState.js:161`
   strips NPCs to `{ id, name, portraitUrl }` — this is why the story's data is
   genuinely missing for players. Add `conditions` (and nothing else — not HP, not
   notes, not abilities), **gated on the linked initiative entry not being
   `hidden`**. `backend/src/lib/initiativeProjection.js` already computes the
   hidden-entry set at line 17 and is the natural home for the gate; extract a
   small `publicNpcConditionsByNpcId(initiative, npcCombat)` helper there and call
   it from `getSessionState.js`'s public variant.
2. **PC `conditions` are already in `PLAYER_VISIBLE_FIELDS`**
   (`partyProjection.js:52`) — no change. `partyVisibilityEnabled: false` already
   returns `{ visible: false, members: [] }`, which satisfies "other PCs' badges
   hide when party visibility is off" with **zero backend work**.
3. **`exhaustionLevel` is NOT in `PLAYER_VISIBLE_FIELDS`.** It is in
   `DM_PARTY_FIELDS` only. Add it to `PLAYER_VISIBLE_FIELDS` — and widen
   `DM_PARTY_PROJECTION_EXPRESSION` in the same change if you touch the DM list at
   all (ADR-017's widen-together rule; `dmParty.js`'s Scan silently drops anything
   not in the expression string). NPCs have no `exhaustionLevel` — simply never
   show the badge for them.

**The one non-obvious client fix: "own token always shows its own badges."** When
`partyVisibilityEnabled` is false, `partyStatus.members` is `[]`, so
`PlayerMapViewer` passes an empty `party` array to `TokenChip`
(`CharacterSheetSessionMode.jsx:1418`) and the player's own token resolves
`member === undefined` — no conditions, no HP, nothing. The player's own full
record *is* already fetched (`CharacterModePage.jsx:162`, `d.character` from the
`?slug=` variant of `GET /session-state`). Pass it down and **merge it into the
`party` array** `PlayerMapViewer` hands to `TokenChip`. This is a small
prop-threading change, not a new fetch, and it is required for the story's stated
visibility rule to hold.

### Scope boundary

**In**: badge column (3/2/1/0 slot bands), the 14-glyph sprite, four family
colours, the locked severity priority order, the stack motif, exhaustion as a
six-segment radial gauge, the detail-card condition block **on both PC and NPC
tokens** (per the prototype review addendum), the global name-label offset change
2px→4px, NPC `conditions` + `exhaustionLevel` in the public projection with the
hidden-entry gate, the own-token merge above.

**Out**:
- **Any interaction.** Badges are `pointer-events: none` unconditionally. No tap
  to clear, no `Conditions ▸` submenu on the long-press menu (brief OQ-2 — a
  future story).
- Propagating the four family colours to the sheet's condition pills or the DM
  card's condition chips (brief OQ-7). That's a design-system change with a much
  wider blast radius; keep it map-only in this pass.
- Any new condition-management surface, condition timers, or auto-expiry.
- Per-NPC condition-visibility toggle (brief OQ-4). The hidden-entry lever is the
  answer; adding a second lever now doubles the secrecy surface.
- `Invisible` — excluded from the badge set on **every** viewer identically, so
  counts and slot assignments always agree. That's Story 54.

**Sizing**: correctly sized as one story. Do not split — the badge orbit, the band
resolver, and the detail-card block are one coherent unit and splitting them would
leave a half-built L2 layer that Stories 52 and 54 have to work around.

### Performance notes

- The prototype-review sizing supersedes the brief: **15px badge, 9.5px glyph, 2px
  ring, 16px slot pitch, slot-1 offset −25px, 18px collapsed badge.** Implement
  against these, not the brief's §5.4 numbers.
- Badges have **no resting animation of any kind** — this is design law and also
  the reason this story adds ~zero continuous compositor work. Only state-change
  transitions animate.
- Recompute the sorted badge list **only when `conditions`/`exhaustionLevel`
  actually change**, not per poll tick. `DmNotesStrip`'s existing
  `if (!open) return;` sync-deferral is the established precedent for
  "derive on change, not on tick" (ADR-020).
- `.token-layer` already has no `overflow: hidden` and is sized to the natural
  image, so the brief's `overflow: visible` requirement is already met.
- Badge column absent from the DOM entirely when there are no eligible conditions
  — which is the common case, and is what keeps a healthy board identical to today.

### Cost notes

None. No new AWS resources, no new endpoints, no new writes. The projection
changes add a handful of short strings per NPC to a response that already carries
the full map library and party records — DynamoDB RCUs are unchanged (both the
Scan and the BatchGet are already charged on full item size, per ADR-020's
reasoning).

### Dependencies

- **ADR-021's wrapper split** — strictly speaking this story could ship without
  it (badges live *inside* `.token-chip`, which doesn't move), but the detail-card
  block and the shared `tokenEffects` module are consumed by 52 and 54, so land the
  split first regardless and keep one build order for the cluster.
- Nothing else. This story has no dependency on 52, 54, or 55.

### Risks / decisions needed

1. **Making NPC conditions visible to players is a real information change**
   (brief OQ-4), not just a rendering change — the DM's only lever is hiding the
   initiative entry, which also hides the NPC from the initiative list. Confirm
   that trade is acceptable before implementation.
2. Confirm PC badges hiding with `partyVisibilityEnabled` (OQ-5), the 0-HP
   collapsed summary badge (OQ-6), the exhaustion 3→4 escalation pulse (OQ-3), and
   the global name-label 2px→4px offset (OQ-8) — the last touches an existing
   Story 29 element on every token unconditionally.
3. **Most likely implementation failure: strobing at a band boundary during
   pinch-zoom.** The 80ms debounce + 2px hysteresis is not optional polish; test it
   by slowly pinch-zooming across each of the three thresholds on a phone.
4. Second most likely: **glyph legibility at the 20–30px band**, which the brief
   correctly identifies as the everyday mobile case. Review the 2-slot layout on a
   real device against real terrain before the 3-slot one.
