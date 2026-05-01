# Feature Story: Current HP Tracking

**Status**: Needs architect review  
**Source**: RPG Consultant Review, Priority 1  
**Feeds into**: In Play tab (story 04), DM Dashboard (story 05)

---

## Goal

Replace the current static HP field with a live, session-editable HP tracker. Players need to adjust HP multiple times per combat without entering password-locked edit mode. The app must correctly model D&D 5e's three distinct HP pools.

---

## User stories

- As a **player**, I want to reduce my current HP when I take damage, without unlocking edit mode, so I can keep up with combat in real time.
- As a **player**, I want to increase my current HP when I'm healed, without unlocking edit mode.
- As a **player**, I want to see my HP as a visual bar (current vs. max) so I can assess my situation at a glance.
- As a **player**, I want to track temporary HP separately from my regular HP so I know which pool absorbs damage first.
- As a **DM**, I want to adjust any character's HP from the DM dashboard so I can apply area-of-effect damage or healing to the whole party.

---

## Functional requirements

### Display (view mode, no auth required)
- Show current HP and max HP as `current / max` (e.g., `28 / 45`)
- Show a horizontal HP bar: filled proportion = `hpCurrent / hpMax`; color transitions from accent (healthy) to a warning tone (below ~30%) to a danger tone (below ~15%)
- Show temp HP separately — a visually distinct secondary bar or badge above/alongside the main display (e.g., `+8 temp`); only shown when `tempHP > 0`
- Show death save bubbles (3 successes, 3 failures) when `hpCurrent === 0`; hide otherwise (death saves belong to this component — see story 06)

### Quick-adjust controls (no auth required)
- Stepper buttons: `-` and `+` buttons increment/decrement `hpCurrent` by 1 per tap; long-press or hold to accelerate
- Direct entry: tapping the `current` number opens an inline input for arbitrary values (damage of 17 in one tap)
- Temp HP: a separate `+temp` button or inline input that sets `tempHP`; when temp HP exists, damage reduces it first, then current HP
- Controls must be usable one-handed on a phone in the dark

### Edit mode (password required)
- `hpMax` is only editable in full edit mode (it changes on level-up, not in combat)
- Setting `hpMax` also sets `hpCurrent` to the new max value if `hpCurrent > hpMax` (prevents impossible state)
- `hpCurrent` and `tempHP` are also settable in edit mode (for setup before a session)

### Validation
- `hpCurrent` cannot exceed `hpMax`
- `hpCurrent` cannot go below 0 (floor at 0; going to 0 triggers death save display)
- `tempHP` cannot go below 0
- All values are integers

---

## Data model changes

Current: `hp: number` (one field, max HP only)

New:
```
hpMax: number       // permanent, edit-mode only
hpCurrent: number   // session state, no-auth update
tempHP: number      // session state, no-auth update; default 0
```

Migration: on first load, if `hp` exists and `hpCurrent` does not, set `hpCurrent = hpMax = hp`.

---

## Out of scope
- Hit Dice tracking (addressed in story 01 extension or story 02)
- Automatic damage calculation (no attack resolution logic)
- Damage type resistance/immunity
- Death save automation (story 06)

---

## Open questions
- **Session state auth**: RESOLVED. Unauthenticated writes are accepted (anyone with the URL can update session state). However, when a player has authenticated with their character password, a session token should be issued automatically — stored in `sessionStorage` as `dnd_session_${slug}` — and sent with all `PATCH /session` requests via a new `x-session-token` header, without any user action. The session handler accepts either a valid session token (fast lookup, no bcrypt) or falls through to the unauthenticated path. This means authenticated players' writes are distinguishable from anonymous ones (useful for observability) without adding any friction. The architect notes below need updating to reflect this token issuance flow in the `verify` handler and the new `session.js` handler logic.
- **Persistence**: HP changes write to DynamoDB immediately, or debounced? Immediate is safer for mid-session crashes; debounced is cheaper. Given low write volume (handful of hits per encounter), immediate is probably correct.
- **HP bar color thresholds**: what exact percentages trigger the warning/danger color transitions? Suggested: >50% = accent color, 20–50% = amber, <20% = red. Confirm with designer.

---

## Architect Notes

**Applies**: ADR-003, ADR-004, ADR-005

**Tech approach**: Add a new `PATCH /characters/{slug}/session` Lambda handler (`backend/src/handlers/session.js`). This handler accepts a subset of fields — `hpCurrent`, `tempHP`, and later `spellSlots[].used`, `conditions`, `exhaustionLevel`, `concentration`, `inspiration` — and performs a DynamoDB `UpdateCommand` on only those attributes (not a full `PutCommand` replace). Auth logic: if `x-character-password` header is present, verify via the existing `verifyPassword()` in `lib/auth.js` (owner or DM both valid). If the header is absent, allow the write anyway — this is the intentional session-state auth relaxation (see ADR-005 "Revisit when"). Document this relaxation explicitly in the handler with a comment. The existing `PUT /characters/{slug}` update handler is not changed.

Data migration: the `get.js` and `list.js` handlers must normalize the legacy `hp` field on read — if `hpCurrent` is absent, synthesize `hpCurrent = hp` and `hpMax = hp` in the response payload. Do not backfill DynamoDB eagerly; let a session write (first time the player touches the HP stepper) persist the new fields. The old `hp` field will coexist in DynamoDB until the character is next written via `PUT` (edit mode save), at which point `BLANK_CHARACTER` shape should include the new fields and the old `hp` field should be dropped. Add a `tempHP` default of `0` to `BLANK_CHARACTER` in `CharacterSheet.jsx`.

Frontend: HP tracker UI lives in `CharacterSheet.jsx` (ADR-002). The `+`/`-` stepper calls `PATCH /session` immediately on each tap (no debounce). Given ≤5 characters and ≤~20 HP changes per session, write volume is negligible — no debounce needed. Long-press acceleration is a UI-only concern; each accelerated tick still fires its own PATCH.

**Scope boundary**: In — `hpCurrent`, `hpMax`, `tempHP` fields; HP bar; stepper + direct-entry controls; death save bubble display trigger (display only, not save logic). Out — death save write logic (story 06); hit dice tracker; `hpMax` changes outside edit mode.

**Dependencies**: The `PATCH /session` endpoint created here is the shared write path for stories 02 and 03. Build it with all session fields in mind, not just HP, even though 02 and 03 haven't landed yet. Stories 02 and 03 can add their fields to the same endpoint.

**Risks / decisions needed**: Session state auth relaxation (unauthenticated HP writes) requires explicit product-owner sign-off before the session Lambda goes to production. The open question in this story should be resolved before implementation begins, not discovered during code review.
