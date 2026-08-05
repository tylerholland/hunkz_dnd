# Feature Story: Invisible Token Veil

**Status**: Implemented
**Source**: RPG Consultant (live-session feedback)
**Prototype**: `design/prototypes/token-effects-review.html`

**Note**: Third of the four-story visual-effects cluster (Stories 52–55). This story defines only the gameplay trigger and — critically — the DM-vs-player visibility asymmetry. A `design-strategist` pass is the planned next step for the actual veil/highlight visual treatment. Do not treat anything below as a visual spec.

## Goal

Invisibility is one of the standard 5e conditions, and it means fundamentally different things depending on who's looking. A player who turns invisible still needs to see themselves on the map, and their allies still need to see them too — that's basic table courtesy and also just how the players' own screens work (nobody wants to lose track of their own token). But an invisible *enemy* is a genuine secret: if a player could see an invisible monster's token on their map, invisibility would be mechanically pointless. The DM, meanwhile, always needs to know exactly where every invisible NPC is, because the DM is the one adjudicating whether anyone finds it. Getting this asymmetry right is the entire point of the feature — it's not just a visual effect, it's an information-hiding rule enforced by the app rather than trusted to house rules ("don't look at that token, pretend you don't see it").

## User stories

- As a player, when my character (or an ally's character) turns invisible, I want my own token to still show clearly on the map (visually marked as invisible, but present), so I don't lose track of my own position or my teammates' positions.
- As a player, I want an invisible NPC's token to be completely absent from my map — not grayed out, not hinted at, just not there — so invisibility actually functions as a real mechanic and I can't metagame around it.
- As a DM, I want every invisible NPC token to remain fully visible on my map view, with a clear highlight marking it as invisible, so I always know exactly where it is even though the players don't.

## Functional requirements

- **Trigger**: a character or NPC has the "Invisible" condition active in its `conditions` list.
- **PC tokens**: when a player-controlled token is invisible, it remains visible to all players (the owning player and every other player), rendered with a distinct "veiled" visual treatment so it's clear at a glance that this character is currently invisible. It also remains visible on the DM's map, presumably with the same or a DM-specific treatment.
- **NPC tokens**: when an NPC token is invisible, it must be entirely omitted from the player-facing map — not shown in any diminished/hinted form, fully absent, exactly as if the token didn't exist for that viewer. It remains fully visible on the DM's map, with a distinct highlight marking it as invisible so the DM can tell at a glance which visible tokens are secretly invisible to the party.
- **Duration**: tied directly to the Invisible condition being active — appears the moment the condition is applied, and the veil/omission clears the moment the condition is removed (same condition-toggle mechanism already used for every other condition).
- **Consistency with existing precedent**: the app already has a concept of hiding certain initiative/combat information from players while keeping it visible to the DM (hidden initiative entries are already stripped from the public initiative feed). This feature extends the same DM-sees-everything / players-see-a-filtered-view principle to the map's token layer.

## Data model changes

None new — this reuses the existing "Invisible" condition, which is already part of the standard condition set (`conditions[]` on characters, and the existing conditions support on NPC combat entries). The change is entirely in how the map/token data is filtered per viewer role, not in what's stored.

## Out of scope

- The actual visual design of the veil effect on PC tokens and the invisible-highlight treatment on the DM's view of NPC tokens — design-strategist territory next.
- Any new "detect invisibility" mechanic (e.g., a player rolling to reveal a hidden token) — this story is purely about the map rendering respecting the existing Invisible condition, not adding new mechanics around discovering it.
- Retroactively hiding an NPC token that a player already has positional knowledge of from before it went invisible (e.g., if they were actively fighting it) — this is a display rule, not a memory/fog-of-war system.

## Open questions

- Currently, does the map/token data path that feeds the player-facing map even carry NPC condition state at all, or does it need to start doing so (while still withholding the NPC's presence itself when invisible)? This affects how big a backend change this is and is worth confirming during architecture review.
- Should the DM's invisible-NPC highlight be a variant of the same symbol used for the persistent-condition indicator in Story 53, or does it need to be visually distinct enough that it's unmistakably "only I can see this token exists"?
- What happens to an invisible NPC token that's also engaged in the damage-flash effect from Story 52 — does taking damage betray its position to players in any way, or does the veil/omission rule always win regardless of what else is happening to the token? (5e RAW: taking damage doesn't reveal an invisible creature's location by itself, so likely the omission rule should always win — flagging for confirmation.)

---

## UX Design

**Brief**: `design/briefs/token-effects-symbology-brief.md` (§7) — part of the
combined Stories 52–55 cluster.

**Three render states, not two.** The story frames this as PC-vs-NPC; the real
matrix is viewer × subject:

| | Player viewer | DM viewer |
|---|---|---|
| **PC invisible** | (a) VEILED | (a) VEILED — identical |
| **NPC invisible** | (c) ABSENT | (b) SECRET |

**(a) VEILED** — portrait `grayscale(0.35)` + `opacity 0.55`; **the faction ring
becomes dashed** (4px/3px, same colour, same width); slow 3.2s shimmer; name
label at 0.6 opacity, italic. The dashed ring is the primary signal and it is
deliberately **shape-based, not colour-based** — a broken outline says "not fully
here" on every palette, every terrain, and for every form of colour blindness,
with no legend required. The owning player's token stays draggable (Story 34
unchanged).

**(b) SECRET** — everything in (a), **plus** two DM-only additions: a diagonal
hatch scrim over the portrait (`rgba(124,147,168,0.22)`, ~3px pitch) and a `◇`
open-diamond badge at **12 o'clock**, in `#7c93a8`, in its own reserved slot so
it is never mistaken for a Story 53 condition badge. The hover card gains
`◇ Invisible — not visible to players`.

This establishes a reusable app-wide rule: **`#7c93a8` — a cold blue-grey
adjacent to the DM dashboard's own Ocean accent — is the colour for "information
only the DM can see."** The DM's chrome colour marks the DM's private knowledge.
Reusable for hidden initiative entries, DM-only map pins, etc.

**(c) ABSENT** — not rendered at all. **Transition matters:** an NPC going
invisible must *fade out over 500ms with a slight upward drift and scale to
0.94*, not pop — a pop draws the eye hard to the last known position. Players
legitimately watched it turn invisible; a graceful exit is honest. Reappearance
fades in over 280ms **at its current position**, which may be elsewhere — that
discontinuity is the mechanic working, not a bug.

**Open questions resolved:**
- *Does the player token payload carry NPC condition state?* It must carry
  `conditions` for **PC** tokens (to drive the veil) while **omitting invisible
  NPC tokens entirely**. **Design requirement, not an implementation detail: the
  omission must be server-side, in the player-facing projection.** A client-side
  filter is a design failure — the position would sit in devtools and the whole
  feature would be theatre.
- *Same symbol as Story 53, or distinct?* **Distinct, and in its own reserved
  12 o'clock slot.** Invisible is deliberately excluded from Story 53's badge set
  so it is never double-represented and never competes for a condition slug.
- *Does damage betray an invisible NPC?* **No. Absence always wins.** If a token
  isn't rendered for a viewer, nothing about it renders: no damage flash, no
  condition badge, no attack tracer originating or terminating at its position.
  Confirms the consultant's RAW reasoning.

**Flagged for approval:** `#7c93a8` as an app-wide DM-only colour — a
system-level commitment beyond this story (brief OQ-7); and the decision that a
veiled **PC** on the DM's map gets **no** `◇` marker, since `◇` means "your
players can't see this," which is false for a PC (OQ-9).

---

## Architect Notes

**Applies**: ADR-023 (server-side player-facing projection — this story is the
reason that ADR exists), ADR-021 (token DOM / CSS file), ADR-012 (public map
endpoint — amended below), ADR-011, ADR-014.

### Tech approach

**The security half is the whole story; the visual half is small.** Treat them as
two commits.

**Backend — the derived `invisible` flag, and two leak surfaces not one.**

Compute one boolean per token, server-side, once, in a shared helper (suggest
`backend/src/lib/tokenVisibility.js`): resolve each `tokens[]` entry's subject
(`type: "character"` → the character item's `conditions`; `type: "npc"` → the
matching `npc-combat` NPC's `conditions`), normalised match (trim,
case-insensitive) on `"invisible"`. Emit `invisible: true|false` on every token in
**both** `getSessionState.js` variants; the public variant additionally **drops
every `type: "npc"` token whose flag is true** from `mapLibrary.maps[].tokens[]`.

**`backend/src/handlers/getMapLibrary.js` is the leak a `getSessionState`-only fix
would miss.** It is a six-line, fully unauthenticated `GET /maps` handler that
returns `getMapLibraryState()` verbatim (ADR-012), and it is still live for
one-shot fetch surfaces. It must call the same omission helper. Verify this
directly with an unauthenticated `curl` against `/maps` as an acceptance step —
not by reading the player UI.

Three hard constraints:
- **The flag is derived, never stored.** `patchMapTokens.js` and `moveMapToken.js`
  must not accept or round-trip an `invisible` field from a client, and
  `normalizeMapLibraryRecord()` must not persist one.
- **The DM client must not re-derive invisibility independently.** One
  server-computed flag drives *both* the player-side omission and the DM's `◇`.
  Two derivations can drift, and the invariant "the DM's map is a strict superset
  of every player's map, and `◇` marks exactly the difference" is the entire value
  of the feature.
- **Fail open.** Unresolvable subject → render, not invisible. Fail-closed hides a
  token from players while the DM sees it *without* a `◇` — silently false
  superset. Document it; don't "harden" it.

Note the omission is **positional data removal**, which is stronger than the
existing `partyVisibilityEnabled` behaviour — that one returns
`{ visible: false, members: [] }` but still ships every token's x/y in
`mapLibrary`. Don't model this on that.

**Frontend.**

`PlayerMapViewer` already filters tokens client-side
(`CharacterSheetSessionMode.jsx:1406–1410`) for `partyVisibilityEnabled`. **Do not
extend that filter for invisibility** — that pattern is exactly what ADR-023
forbids here. The player client simply renders what the server sent; there is no
invisible-NPC branch on the player side at all, which is also how you can tell the
implementation is correct.

`TokenChip` gains `data-veil="1"` / `data-veil-secret="1"` driven by the server
flag plus `isDm`, and four conditional `pointer-events: none` children:
`.tk-veil-ring` (SVG `<circle>` with animated `stroke-dasharray`, 16-dash count so
it closes seamlessly at any radius), `.tk-veil-hatch`, `.tk-veil-sheen`, and
`.tk-secret-mark` (the 12 o'clock `◇`, DM + NPC only). The dim/desaturate applies
to **`.token-chip__portrait` / `.token-chip__initial` only, never `.token-chip`**
— dimming the chip would drag Story 53's badges and Story 34's drag-affordance
ring down with it.

**Dimmers must not multiply** (brief V4): implement as ordered CSS rules keyed on
data attributes — `.token-chip--fallen` already sets its own portrait opacity
(`battleMode.css:156`), and a nested veil container would multiply 0.55 × 0.4 into
an unreadable 0.22. Ordered rules, one winning value.

The NPC vanish (500ms fade + `translateY(-8%)` + `scale(0.94)`) runs on ADR-021's
`.tk-hit` wrapper — **shared with Story 52's recoil**, not a fourth wrapper. If
this story ships before 52, it introduces `.tk-hit` with the same scale-only
contract. The exit needs a small **diff-driven token-exit registry** in the parent
(present→absent for the same `mapId`, 500ms ghost, `pointer-events: none`,
excluded from hit-testing and from any count, `>3` simultaneous → instant, map
switch → instant, never on first paint, return-during-exit cancels). Put it in the
shared `tokenEffects.js` module, consumed by both maps.

Reuse Story 53's `data-cond-band` resolver for the degradation ladder — **do not
compute a second band.**

All CSS in `src/features/dmDashboard/battleMode.css` (not `tokens.css`, which
doesn't exist).

### Scope boundary

**In**: the derived server flag; omission in `getSessionState.js`'s public variant
**and** `getMapLibrary.js`; VEILED treatment (both viewers, PC + DM-side NPC);
SECRET additions (hatch + `◇`, DM only); the 500ms exit and the exit registry;
`HeldTokenFloater` carrying the veil; tray chips getting the dashed ring only; the
`◇ INVISIBLE` detail-card row as the first row of Story 53's condition block.

**Out**:
- Any client-side invisibility filter. Non-negotiable.
- Hiding an invisible **PC** from other players — explicitly rejected in the brief
  (§16.10); that needs a real stealth system, not a display rule.
- Any "detect invisibility" mechanic or reveal roll.
- Toggling Invisible from the map (brief OQ-7 — a follow-up story, and it belongs
  with Story 53's proposed `Conditions ▸` submenu).
- A "preview player view" mode. The `◇` is the cheaper answer to the same need.
- Fog of war / positional memory. The story says this explicitly and it will be
  tempting once the projection machinery exists.
- Propagating `#7c93a8` to any other surface in this story, even though the ADR
  reserves it app-wide.

**Hidden dependency worth naming**: the story's requirement that the player payload
carry `conditions` for PC tokens is **already satisfied** —
`PLAYER_VISIBLE_FIELDS` includes `conditions` (`partyProjection.js:52`). The
narrower `invisible` flag is still the right contract for the veil, because it
keeps working when `partyVisibilityEnabled: false` strips the party payload
entirely (brief §12: an ally's veil still renders in that state, while Story 53's
badges hide).

### Performance notes

- The flag computation is O(tokens) per request against data already loaded in the
  same handler — `getSessionState.js` already reads the map-library, npc-combat,
  and party-member records in its two existing `BatchGetItem`s. **No additional
  DynamoDB round trip.** `getMapLibrary.js` currently reads only the map-library
  sentinel and will need the npc-combat sentinel too — make it one `BatchGetCommand`
  for both slugs, not two `GetCommand`s.
- The dashed ring is an SVG `<circle>` with animated `stroke-dasharray`; that is
  not compositor-accelerated, but it only animates for 320ms on state change and
  never at rest. The shimmer is `transform`/`opacity` only, is the lowest-priority
  loop, and is suppressed below 20px effective size.
- Hatch pitch must be counter-scaled against `--token-size-mult` or it moirés on
  small tokens.
- Per-token shimmer phase offset must be derived deterministically from the token
  id (`npcInitialColor`'s djb2 hash in `tokenUtils.js` is the existing precedent),
  never random per mount — random would resynchronise on every remount.

### Cost notes

Zero new AWS resources, zero new endpoints, zero new writes. One extra sentinel
read on `GET /maps` (folded into an existing round trip as a BatchGet). Response
payload *shrinks* for players.

### Dependencies

- **ADR-021's wrapper split** (`.tk-hit`).
- **Story 53 should land first** — this story reuses its `data-cond-band`
  resolver, its detail-card condition block (the `◇ INVISIBLE` row is the block's
  first row), and its shared condition-string normaliser. Building 54 first means
  building throwaway versions of all three.

### Risks / decisions needed

1. **Confirm `#7c93a8` as the app-wide "information only the DM can see" colour**
   (brief OQ-1). This is a system-level commitment beyond this story, with a
   reciprocal rule attached: it must **never** appear on a player-visible surface,
   which means the VEILED detail-card row uses neutral `#c8c0b4` instead. Confirm
   before it propagates.
2. Confirm veiled PC gets no `◇` on the DM's map (OQ-2), the single shared exit
   animation for every disappearance type — which touches Story 29's existing
   removal behaviour (OQ-3), and the accepted number-badge existence leak (OQ-5).
3. **Most likely implementation failure: shipping the omission in
   `getSessionState.js` and forgetting `getMapLibrary.js`.** It is unauthenticated,
   six lines long, and easy to overlook. Make the `curl /maps` check an explicit
   acceptance criterion.
4. Second most likely: a well-meaning client-side "safety" filter added on top of
   the server omission. That's a second source of truth for a security rule and
   makes drift undetectable. There must be exactly one.
5. **ADR-012 amendment implied.** That ADR documents `GET /maps` as deliberately
   unauthenticated with a known name-enumeration exposure. This story adds a
   *positional* secrecy requirement to the same endpoint. It stays unauthenticated
   (players need it) but is no longer a verbatim passthrough — worth a one-line
   note on ADR-012 when this ships.
