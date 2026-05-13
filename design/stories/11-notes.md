# Feature Story: Notes

**Status**: Needs UX design  
**Source**: RPG Consultant  
**Prototype**: (leave blank)

---

## Consultant analysis

### How do DMs actually take notes at the table?

In my experience running and playing in real groups, DMs fall into two camps: paper notebook next to the laptop, or a second browser tab open to Notion/Google Docs/Obsidian. Neither is ideal during a live session. The paper notebook is fast but disconnected from the digital tools; the second tab competes for screen real estate and breaks focus. The real problem is context-switching: a DM managing HP on the dashboard who has to alt-tab to record "Aragorn mentioned his father died at the Battle of Fornost — revisit this" loses 15 seconds and their spatial attention.

The high-value ask here is not a general-purpose note system. It is **in-context notes that live next to the things they're about**, so the DM doesn't have to context-switch to record or retrieve them.

### Is entity-attached vs. flat note-taking valuable?

Yes — but scope it carefully. The two use cases that generate the most in-session friction are:

1. **Character context notes**: The DM needs to remember a player-character detail discovered during play ("Eoghan's player said he wants to find his mentor's sword — plant this in the dungeon"). These belong on the character, not in a general notepad, because the DM will look for them while looking at that character's card.

2. **NPC combat notes**: The DM is already looking at the NPC tracker when managing goblin HP. "This goblin surrendered and offered to lead the party to the stronghold" is useful exactly there — not in a global notepad.

A flat "session notepad" is useful for general adventure observations ("party discovered the map room", "they missed the secret door on the north wall"), but this is a lower-priority use case because DMs already have tools for this (paper, phone notes) and are less likely to look at a general notepad while in the middle of managing combat.

**Recommendation: prioritize entity-attached notes (character + NPC) for the MVP. Add a session scratch pad only if the group asks for it.**

### Should player notes be visible to the DM?

Player notes in D&D break into two types:
- **Private**: things the character knows that others don't ("I privately recognized the baron as the man who killed my brother")
- **Shared**: quest threads, important NPC names, locations discovered — things useful to share with the group

The lightest viable model is: **player notes are private by default; the player can explicitly mark individual notes as shared with the DM.** This avoids the awkward situation where a player types a note assuming it's private and the DM reads it. It also gives the DM a signal — shared notes from players are a request for DM engagement ("my player wants me to know this detail is important to them").

Do not build a full sharing/permissions system. A simple per-note `sharedWithDm: boolean` toggle is sufficient.

### Session-scoped vs. campaign-persistent notes

This is the most important design question. Notes in D&D decay in value quickly: "the orc chief is using a magic sword" is actionable during session 7's combat, irrelevant by session 8. But "Aragorn has never met his uncle Denethor, and the DM plans to introduce him at the siege" is a campaign-persistent seed that should survive for months.

Rather than building two different note types, the simplest solution is: **all notes persist, but old notes are easy to dismiss or archive**. Don't add a session filter in MVP. The DM can delete a note when it's no longer relevant. Build good deletion UX and this is solved well enough.

### What are the 2–3 most important things for in-session DM vs. player?

**DM (in-session priority)**:
1. Write a note attached to a character or NPC in 3 seconds or fewer, without leaving the dashboard
2. See a note at a glance when looking at that character/NPC (not buried in a separate notes page)
3. Delete or dismiss a note that's no longer relevant

**Player (in-session priority)**:
1. Capture a name, place, or clue quickly during roleplay before it slips away
2. Mark something as important to share with the DM
3. Access their own notes easily on the character sheet

---

## Goal

Give the DM a fast way to attach short contextual notes to player characters and NPCs on the dashboard — so that session-relevant reminders ("follow up on Eoghan's backstory thread", "this goblin offered to cooperate") live next to the entities they're about, visible at a glance without leaving the active session view. Players get a lightweight note field on their character sheet for capturing discoveries, clues, and quest threads mid-session.

---

## User stories

- As the DM, I want to attach a short note to a player character's card on the dashboard so that I can surface a session-relevant backstory beat or pending plot hook right when I'm looking at that character.
- As the DM, I want to attach a short note to an NPC card so that I can record a mid-combat discovery ("surrendered", "knows the password") without switching to a separate app.
- As the DM, I want to see at a glance whether a character or NPC has any notes, so that I don't have to open every card to check.
- As the DM, I want to delete a note once it's no longer relevant, so that stale reminders don't clutter the dashboard.
- As a player, I want to jot a note on my character sheet during the session so that I can capture an NPC name, clue, or quest thread before I forget it.
- As a player, I want to optionally mark a note as visible to the DM so that I can signal "this detail matters to my character's arc" without having to say it out loud at the table.
- As the DM, I want to see player-shared notes aggregated somewhere on the dashboard so that I can read what my players consider significant.

---

## Functional requirements

### DM notes on character cards

- Each player character card on the DM dashboard supports one or more short text notes.
- Notes are created inline on the card — tapping an "add note" affordance reveals a text input; submitting saves immediately.
- Notes are visible on the card without expanding any panel; they should be readable at a glance.
- Each note has a delete (dismiss) action.
- Notes are DM-only: they are never visible on the player's character sheet view.
- Notes persist between sessions (stored server-side, not in sessionStorage).
- Notes are attached to the character by slug.

### DM notes on NPC cards

- Same interaction model as character card notes.
- NPC notes are scoped to the NPC's `id` within the current `npc-combat` state.
- When "End Combat" clears NPC state, NPC notes are discarded along with the NPC record. NPC notes are inherently session-scoped; this is intentional.

### Player notes on character sheet

- A dedicated "Notes" area appears on the character sheet (Combat tab or as a separate tab — UX to decide) visible to the authenticated character owner.
- Players can write and delete their own notes.
- Each note has a `sharedWithDm` flag (default: false) that the player can toggle on/off per note.
- Notes are stored per-character in DynamoDB.
- Player notes are never shown on other players' sheets.

### DM visibility of shared player notes

- On the DM dashboard, player notes with `sharedWithDm: true` are surfaced. Exactly where and how is UX's decision — a subtle indicator on the character card linking to the shared notes is sufficient.
- Unshared player notes are never visible to the DM, even via API.

### General constraints

- Notes are short-form: plain text only, no markdown, no rich text. A 500-character limit per note is sufficient.
- No tagging, categorization, or search in MVP.
- No session scoping or timestamps visible to the user in MVP (internal `createdAt` is fine for ordering).

---

## Data model changes

### Design decision: arrays, not single text fields

Both `dmNotes` and `playerNotes` are modeled as **arrays of discrete entries**, not as a single editable text field. This is an intentional design choice made after evaluating both approaches:

- In real play, DMs and players *accumulate* notes — they add entries as discoveries happen and delete them when stale. They do not overwrite a single memo.
- The in-session interaction is capture-first: type a fragment, hit enter, move on. A free-text field invites editing behavior (cursor positioning, rewriting) that costs 15–20 seconds of focus; an append-only list takes 3 seconds.
- The `sharedWithDm` flag only makes sense as a per-entry toggle — it has no coherent meaning on a monolithic text blob.
- Past notes retain value across sessions. A single overwritten memo destroys retrospective context.

A "one field" memo was evaluated and rejected.

### Character notes (DM)

Add a `dmNotes` field to the character record in DynamoDB:

```
dmNotes: [
  { id: string, text: string, createdAt: string }
]
```

This field is never returned by `GET /characters/:slug` to unauthenticated callers. The DM reads it via `GET /dm/party` (projected alongside existing session fields) or a dedicated endpoint.

### Player notes

Add a `playerNotes` field to the character record:

```
playerNotes: [
  { id: string, text: string, sharedWithDm: boolean, createdAt: string }
]
```

`GET /characters/:slug` returns `playerNotes` only to the authenticated owner (character password) or DM. The DM only receives entries where `sharedWithDm: true`.

### NPC notes

No schema change needed. NPC notes are stored inline on the NPC object within the `npc-combat` DynamoDB item:

```
npcs: [
  { id, name, hpMax, hpCurrent, conditions, initiativeEntryId,
    notes: [{ id: string, text: string }] }
]
```

No `sharedWithDm` or persistence concerns — NPC notes are discarded when combat ends.

### API changes

- `PATCH /characters/:slug/session` (existing): extend to accept `playerNotes` as a writable session field (same no-auth write pattern as conditions and inspiration — player notes are low-sensitivity).
- New endpoint or extension of `dmParty.js`: DM reads `dmNotes` and shared `playerNotes` as part of the party payload.
- New endpoint `PATCH /characters/:slug/dm-notes`: DM writes `dmNotes`. Requires DM auth. Alternatively fold into the existing session endpoint gated by DM role.

---

## Out of scope

- **Any changes to character card or NPC card layout, styles, colors, button styles, or existing visual structure.** The feature-builder must add notes affordances without modifying surrounding card chrome — no resizing existing buttons, no reordering existing rows, no palette or font changes.
- General-purpose session notepad not attached to any entity.
- Note history, versioning, or undo.
- Rich text, markdown rendering, or formatting.
- Tagging, labeling, or search across notes.
- Sharing notes between players (player-to-player visibility).
- Timestamps displayed in the UI.
- Note export or printing.
- Any form of notification when the DM adds a note about a character.
- Per-collection or per-section notes in the existing character backstory editor (those already support free-text prose).
- **Activity / event log**: The product owner has raised a long-term vision of logging gameplay events (dice rolls, DM narration, player actions) to generate a written tale of the adventure. This is a valuable concept but it is a **separate feature with a separate data model** — event log entries are observed facts (structured, timestamped, app-generated or DM-entered in a specific format), while notes are authored intent (freeform, player/DM-controlled). Mixing the two data models would compromise both features. The activity log should be its own story when the group is ready to invest in it. It should not influence the `dmNotes` or `playerNotes` schema.

---

## Open questions

1. **Tab placement for player notes**: Should player notes appear in the Combat tab (alongside conditions, inspiration — quick-capture during session) or as a fourth tab alongside Inventory / Persona / Combat? Combat tab placement is more immediately accessible; a fourth tab is cleaner but adds navigation weight. UX to decide.

2. **DM note visibility on card**: Should DM notes on a character card be always visible inline (taking up vertical space even when empty) or hidden behind an indicator (e.g., a note icon badge that the DM taps to expand)? The latter keeps cards compact on the dashboard but adds a tap to read.

3. **Shared player notes on dashboard**: When a player marks a note as shared, where does the DM see it on the dashboard? Options: inline on the character card (consistent with DM note placement), a dedicated "player intel" section somewhere, or a subtle indicator linking to a modal. UX to decide.

4. **DM note API auth**: Should DM notes be writable via `patchSession` (accepting DM auth, same endpoint the DM already uses) or via a new `/dm-notes` endpoint? Using `patchSession` is simpler; a new endpoint is cleaner. Architect to advise.

5. **Character note vs. backstory sections**: The character sheet already supports free-text backstory sections via the Collections editor. Should player notes be explicitly scoped to in-session use only (Combat tab, quick-capture) so they don't overlap with the backstory system? The distinction is: backstory sections are authored between sessions with care; player notes are captured in the moment. Keeping them separate prevents confusion but means two note surfaces on one sheet.

---

## UX Design

**Prototype**: `design/prototypes/notes.html` (Rev 2)

### Progressive disclosure pattern for DM card notes

**Chosen pattern: collapsible notes strip below the Damage/Heal footer row.**

The card footer is occupied entirely by the ⚔ Damage and ✦ Heal buttons — these are the DM's most-used in-combat actions and must remain full-width and clearly tap-targetable. Adding a Notes button alongside them would shrink all three below a comfortable touch size and dilute the visual hierarchy between "combat actions" and "meta information."

Instead, a thin collapsible strip attaches as its own row directly below the footer (separated by a 1px border). It is always present on every character and NPC card — always discoverable, never hidden. Its collapsed height is minimal (~30px) so it does not push primary card content down.

**Collapsed state — no notes**: the strip shows a muted note icon + faint `+ Note` label in the standard ghost/muted style. Visual weight is intentionally low — it reads as a secondary affordance, not a primary action.

**Collapsed state — notes exist**: the strip shifts to an accent-tinted background, the label changes to `DM Notes`, and a count badge appears (e.g. `2`). This achieves the "see at a glance whether notes exist" requirement without rendering any note text and without adding height to the core card content.

**Expanded state**: tapping anywhere on the strip expands the notes panel in-place below the strip bar. The card grows downward — no modal, no scroll-jump, no navigation change. The add-note input auto-focuses. Tapping the strip bar again collapses the panel.

**Why not a Notes button in the card footer:** the footer already has two buttons. A third button shrinks Damage/Heal, crowds the footer on narrow mobile screens, and implies notes are a peer action to dealing damage — they are not.

**Why not the ⋯ overflow menu:** the `⋯` menu holds infrequent actions (Add Condition, Set Temp HP, Long/Short Rest). Putting notes there adds a tap and buries them behind a menu. DM notes are retrieved frequently during play — they deserve a persistent zero-tap-to-see affordance.

**Why not "only show notes on the active turn":** the DM often wants to re-read a note before a character's turn (while another character acts) to prepare their response. Turn-scoped visibility would hide notes exactly when the DM might need them most.

### Where player notes live on the character sheet

**Decision: bottom of the Combat tab, between "Weapons quick-reference" and the Dice Roller.**

Player notes are a combat/session tool — quick-capture during roleplay, name lookup during NPC encounters, quest-thread jotting before the session ends. Placing them in the Combat tab means zero additional navigation: the player is already on the tab where all live-session writing happens (HP, conditions, spell slots, inspiration). A fourth tab was considered but adds navigation weight and splits the player's mental model of "in-session stuff."

Within the Combat tab, notes sit after the weapons quick-reference (which is used more frequently during combat) and before the collapsible Dice Roller. This ordering matches frequency-of-use: weapons first, notes second, dice roller last (collapsed by default).

**Naming:** the section is labeled "Session Notes" rather than "Notes" to subtly signal its purpose (capture in the moment) and visually distinguish it from the Collections backstory editor lower on the sheet. This addresses open question #5 without requiring any structural change — the two surfaces are named differently and live in different parts of the sheet.

### How shared player notes appear on the DM character card

**Decision: inside the same notes panel, below DM notes, with a visual divider.**

When the DM expands a character card's notes panel, they see:
1. DM-authored notes (full CRUD — add/delete)
2. A thin divider labeled "Player shared" (gem-colored, small, uppercase)
3. Read-only player notes where `sharedWithDm: true` — displayed with a gem-colored left border and italic body text to distinguish authorship at a glance

This colocation is intentional: the DM is already looking at the character's note context when they open the panel. Splitting shared player notes into a separate section elsewhere (a "player intel" sidebar, a modal) would add a second place to check. The visual distinction (border, italic, author line) makes it unambiguous that these are player-authored — the DM cannot edit or delete them.

If a character has no DM notes but does have shared player notes, the panel opens to show just the player intel section (no "No notes yet" empty state — the player-shared notes are real content).

### Player share toggle design

Each player note row has a small toggle button beneath the note text. Default state: `○ Private` (empty dot, muted color). Shared state: `● Shared with DM` (filled gem-color dot, gem text). Tapping toggles immediately and writes via `patchSession`. The toggle is text-labeled (not icon-only) so the current state is always readable without hover.

### Mobile considerations

- The notes strip is ~30px tall in its collapsed state — a comfortable touch target across the full card width.
- The strip sits below the Damage/Heal footer, so it never competes with those buttons for tap accuracy.
- The notes panel input and "Add" button stack as a flex row; on narrow screens (< 400px) the "Add" button label could be reduced to `+` if needed (input takes `flex:1`).
- The delete (×) button on each note is 28×28px effective tap target.
- The player share toggle is a full-width-label button — easy to tap on mobile without precise targeting.
- On mobile the DM dashboard stacks to a single column, so card expansion does not cause adjacent-card clipping issues.
- Player notes on the Combat tab are naturally scrollable as part of the existing sheet scroll — no nested scroll container needed.

### Remaining open questions

1. **DM note API auth** (open question #4): whether DM notes write via `patchSession` (with DM auth check) or a new `/dm-notes` endpoint is an architecture concern — left to the code architect.
2. **Polling frequency for player-shared notes**: should shared `playerNotes` be included in the existing `GET /dm/party` response (efficient, slightly stale) or polled separately? Architect to advise.
3. **Empty state when only player-shared notes exist** (edge case): if a character has zero DM notes but the player has shared notes, the expanded panel should still feel complete — prototype shows this as jumping straight to the "Player shared" divider with no "No notes yet" message above it. Confirm this is the right behavior during implementation.

---

## Architect Notes

**Applies**: ADR-003, ADR-004, ADR-005, ADR-007, ADR-011

---

### Decision 1 — DM notes endpoint: use a new `PATCH /characters/:slug/dm-notes`

**Recommendation: new dedicated endpoint (option b). Do not extend `patchSession`.**

`patchSession` is intentionally unauthenticated for the fields it currently manages — the handler comment and ADR-005 rationale both document this as a deliberate design choice. Adding a DM-only field to that handler requires a conditional auth gate within the same code path: "if the field is `dmNotes`, require DM auth; otherwise, allow unauthenticated writes." This makes the handler's auth model non-uniform and harder to audit. The current handler does a single optional auth check and then writes any listed session field — that simplicity is a feature.

A new `PATCH /characters/:slug/dm-notes` endpoint cleanly separates concerns:
- Its auth model is uniform: always require DM auth, full stop.
- It accepts `{ action: "add", text: string }` or `{ action: "delete", id: string }` — this is safer than sending the full array and avoids last-write-wins races between DM actions (two tabs, or two DMs).
- The handler is small and testable in isolation.

The endpoint must also be responsible for projecting `dmNotes` back in its response (or the DM reads it via `GET /dm/party` — see Decision 2). It does **not** need a corresponding GET — the DM's read path is the party poll.

**New file**: `backend/src/handlers/dmNotes.js`
**template.yaml**: add `DmNotesFunction` wired to `PATCH /characters/{slug}/dm-notes`, `DynamoDBCrudPolicy` on `CharactersTable`.
**`src/api.js`**: add `patchDmNote(slug, action, dmPassword)` — `PATCH /characters/{slug}/dm-notes` with `x-character-password: dmPassword`.

---

### Decision 2 — Where `dmNotes` travels: include in `GET /dm/party`

**Recommendation: include `dmNotes` in the existing `/dm/party` projection. Do not add a separate endpoint.**

The current party poll is the DM's heartbeat — it already carries HP, conditions, concentration, inspiration, and spell slots on every 1s/5s tick. Adding `dmNotes` to the projection is a single extra attribute in the DynamoDB `ProjectionExpression`. Notes are short (≤ 500 chars each, ≤ a handful per character) so payload growth is negligible at this scale (3 characters).

A separate endpoint would require the dashboard to manage another polling loop or a one-shot fetch, with its own loading state, error handling, and merge logic. That complexity is not worth it.

**Backend change**: update `dmParty.js` — add `dmNotes` to the `ProjectionExpression` string and add `"#dmNotes": "dmNotes"` to `ExpressionAttributeNames`. Items that have no `dmNotes` attribute will simply omit the field; normalize to `[]` in `dmParty.js` before returning (same pattern used for other optional session fields).

The `filterPublicCharacterItems` filter in `specialItems.js` must **not** strip `dmNotes` — it is called on the DM-authed party scan result and the DM is entitled to this data. Verify that `filterPublicCharacterItems` is only a reserved-slug filter (it is — it calls `isReservedCharacterSlug` to drop the `initiative` item). No change needed there; just confirm.

---

### Decision 3 — `playerNotes` write path: extend `patchSession`; read path requires auth

**Write path — extend `patchSession`:** Add `playerNotes` to `SESSION_FIELDS` in `backend/src/handlers/session.js`. This follows the existing no-auth-required pattern. Player notes are low-sensitivity session captures (quest threads, NPC names) — same threat model as conditions and inspiration. The player cannot write notes to another character's slug without knowing the route, and there is no secrets risk in another player overwriting someone else's note list (there is no `sharedWithDm` escalation attack because the DM-dashboard projection already only serves `sharedWithDm: true` entries to the DM, not the raw array).

**Read path — the current `get.js` returns everything except `passwordHash`:** This is a latent privacy issue. `get.js` currently returns the entire DynamoDB item (minus `passwordHash`) to any caller without auth. Once `playerNotes` is stored on the character record, an unauthenticated `GET /characters/{slug}` would expose all player notes including private ones.

**Required fix**: `get.js` must strip `playerNotes` from unauthenticated responses. The handler currently has no auth check at all. The feature-builder must:
1. Read the `x-character-password` header in `get.js` (pattern already present in `session.js` and `dmParty.js`).
2. If no password or invalid password: strip `playerNotes` entirely from the response.
3. If owner auth: return full `playerNotes` array.
4. If DM auth: return only entries where `sharedWithDm === true` (strip private ones).

This is the correct scope for this story. Do not add `playerNotes` to the `CharacterSheet` auto-unlock flow or to `update.js` — those are separate concerns.

**`GET /dm/party` projection for shared player notes**: update `dmParty.js` to also include `playerNotes` in the `ProjectionExpression`. The handler must then filter the array to `sharedWithDm === true` before including it in the response. Name this field `sharedPlayerNotes` in the party payload to make it unambiguous on the frontend (avoid the DM accidentally treating it as the full notes array).

---

### Decision 4 — Optimistic update pattern for notes

`liveSync.js` has no generic optimistic-array utility — `useDebouncedOptimisticNumberFlush` is purpose-built for numeric HP-style fields. Array note operations (add, delete, toggle-share) must be handled manually in the component. This is straightforward given the operation semantics:

- **Add**: append a local entry with a client-generated `id` (use `crypto.randomUUID()` or `Date.now().toString(36) + Math.random().toString(36).slice(2)`). Write to server. On error: filter the local entry back out by `id`. No expected-value merge needed — the next poll will restore server state.
- **Delete**: filter locally by `id`. Write `{ action: "delete", id }` to server. On error: re-append the removed entry.
- **Toggle sharedWithDm** (player notes only): flip the boolean locally. Write full `playerNotes` array via `patchSession`. On error: flip back. This follows the same one-shot pattern used for `inspiration`.

For **DM notes**, all writes go through the new `patchDmNote` endpoint which accepts `action: "add"` / `action: "delete"` rather than the full array. This makes the server the authoritative merge point and eliminates last-write-wins risk. The next party poll brings the server-authoritative array back down.

For **player notes**, writes go through `patchSession` with the full `playerNotes` array (same as `spellSlots`). This is safe because the player only has one active session tab in practice, and the array is small.

**No changes to `liveSync.js` are needed.** The component-level state management is simple enough to inline in `CharacterCard.jsx` (DM notes) and the Combat tab section component (player notes).

---

### Decision 5 — NPC notes: confirm extend-in-place via `putNpcCombat`

Confirmed correct. The `putNpcCombat` handler (`backend/src/handlers/putNpcCombat.js`) accepts `{ npcs: [...] }` and overwrites the entire NPC combat record via `saveNpcCombatState`. Adding `notes: []` to each NPC object in the array requires no handler change — the payload passes through as-is.

The `NpcCombatSection` component (`src/features/dmDashboard/NpcCombatSection.jsx`) already holds the NPC array in local state and calls `putNpcCombat` on mutation. The feature-builder adds note add/delete actions to NPC state mutations in that component, same as HP changes are handled today.

**Gotcha**: `saveNpcCombatState` is a full `PutItem` that replaces the record. If two browser tabs both hold NPC state and one adds a note while the other changes HP, the second write will clobber the first. This is the existing race condition for all NPC edits (HP changes have the same problem) and is acceptable at a 1–2 DM setup. Do not introduce new locking for this story — document as a known limitation, same as the existing NPC state.

**No backend changes needed for NPC notes.** Frontend only: `src/features/dmDashboard/NpcCombatSection.jsx`.

---

### Scope boundary

**Must touch:**

- `backend/src/handlers/dmNotes.js` — new file; DM-auth-gated add/delete for `dmNotes[]`
- `backend/src/handlers/dmParty.js` — add `dmNotes` and `playerNotes` to projection; filter player notes to `sharedWithDm === true`; rename as `sharedPlayerNotes` in response; normalize both to `[]` if absent
- `backend/src/handlers/session.js` — add `playerNotes` to `SESSION_FIELDS`
- `backend/src/handlers/get.js` — strip `playerNotes` from unauthenticated responses; filter to shared-only for DM auth
- `backend/template.yaml` — add `DmNotesFunction` (PATCH `/characters/{slug}/dm-notes`, `DynamoDBCrudPolicy`)
- `src/api.js` — add `patchDmNote(slug, action, dmPassword)`
- `src/features/dmDashboard/CharacterCard.jsx` — add collapsible notes strip UI; local note state; calls to `patchDmNote`; render `sharedPlayerNotes` read-only section
- `src/features/dmDashboard/NpcCombatSection.jsx` — add `notes[]` to NPC state; add/delete note actions via existing `putNpcCombat` write path
- `src/features/characterSheet/CharacterSheetViewMode.jsx` — add "Session Notes" section in Combat tab (between weapons quick-reference and DiceRoller); local note state; calls to `patchSession` with full `playerNotes`; share toggle
- `src/features/characterSheet/constants.js` — add `playerNotes: []` to `BLANK_CHARACTER`
- `design/app-overview.md` — update after implementation

**Must not touch:**

- `backend/src/handlers/update.js` — `playerNotes` and `dmNotes` are not edit-mode fields; they must not appear in the full character `PUT` path
- Existing card chrome in `CharacterCard.jsx` (Damage/Heal buttons, HP bar, condition chips, portrait, AC badge) — add the notes strip below the footer row only
- `liveSync.js` — no changes needed
- `backend/src/lib/specialItems.js` or `specialRecords.js` — NPC notes require no special records changes

---

### Performance notes

`dmParty.js` uses a full table `ScanCommand` with `ProjectionExpression`. Adding two new attributes to the projection does not change scan cost (DynamoDB charges per KB read from storage, not per projected attribute). At 3–5 characters with short notes arrays, the payload remains well under 10KB total. Not a concern at current scale.

---

### Cost notes

One new Lambda (`DmNotesFunction`). Per-operation cost at PAY_PER_REQUEST and typical session frequency (a few note writes per session, a few sessions per month) is effectively zero.

---

### Dependencies

None — this story is self-contained. No prior story needs to ship first. The `get.js` auth fix for `playerNotes` is additive (new conditional, no breaking change to existing consumers that currently receive the full character sans `passwordHash`).

---

### Risks / decisions needed

1. **`get.js` privacy fix is required before shipping player notes.** If `playerNotes` is added to the DynamoDB record but `get.js` is not updated to strip it, all player notes become publicly readable via `GET /characters/{slug}` without any auth. The feature-builder must not defer this fix.

2. **Empty-state behavior confirmed**: when a character has no DM notes but does have shared player notes, the expanded panel renders the "Player shared" section directly with no "No notes yet" empty state above it. The "No notes yet" empty state only shows when both the DM notes list and the shared player notes list are empty.

3. **`dmNotes` field name in DynamoDB vs. projection alias**: the raw DynamoDB attribute is `dmNotes`; the party response field is also `dmNotes`. No alias needed. `sharedPlayerNotes` is the projection-layer rename applied in `dmParty.js` before the response is sent — the DynamoDB attribute remains `playerNotes` on the character record.

4. **ID generation for new notes**: use `crypto.randomUUID()` where available (all modern browsers and Node 20). No dependency needed.
