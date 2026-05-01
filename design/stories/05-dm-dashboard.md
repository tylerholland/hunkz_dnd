# Feature Story: DM Dashboard

**Status**: Needs architect review  
**Depends on**: Stories 01 (HP), 02 (Spell Slots), 03 (Conditions) — dashboard displays and edits data introduced by those stories  
**Source**: RPG Consultant Review, Priority 5

---

## Goal

Give the DM a dedicated `/dm` view that shows the entire party's combat state at a glance and allows real-time management — HP changes, conditions, initiative order — without navigating to individual character sheets. This is the single feature that elevates the app from a character sheet viewer to a session management tool for a remote group.

---

## User stories

- As a **DM**, I want to see all party members' HP, AC, active conditions, and concentration state on a single screen so I can run combat without switching tabs.
- As a **DM**, I want to deal damage or healing to one or more characters directly from the dashboard so I can quickly apply area-of-effect damage without leaving the combat view.
- As a **DM**, I want to apply or remove conditions on any character so I can track spell and ability effects as I adjudicate them.
- As a **DM**, I want to manage initiative order — setting it at the start of combat and advancing turns — so players know whose turn it is.
- As a **DM**, I want to trigger a long rest or short rest for the party to reset HP (if applicable) and spell slots in one action.
- As a **DM**, I want to track death saves for any downed character so I can adjudicate stabilization or death without relying on the player to self-report accurately.
- As a **DM**, I want the dashboard to be accessible from a single bookmarkable URL so I can open it at the start of every session without navigating.

---

## Functional requirements

### Authentication

- The `/dm` route redirects to a DM password prompt if no DM session is active
- Same DM password flow as the existing character list page — reuses the current `sessionStorage` DM session
- Once authenticated, the dashboard is accessible for the session without re-entry

### Party card strip

One card per character, displayed as a horizontal strip on desktop and a vertical stack on mobile. Cards are always visible — no pagination.

**Each card contains:**

| Element | Detail |
|---|---|
| Portrait thumbnail | 80×80px, circular crop; palette-colored placeholder initial if no portrait |
| Character name | Cinzel font, palette-accented |
| HP bar | Current / Max displayed numerically; visual bar; danger color below ~20% |
| Temp HP badge | Shown alongside HP when `tempHP > 0` (e.g., "+8 temp") |
| AC badge | Simple number badge; sourced from `armorTotal`; always visible |
| Condition chips | Active conditions as compact colored pills below the HP bar; max 3 shown inline, overflow as "+2 more" expandable |
| Concentration indicator | Small pulsing dot or icon + spell name when concentrating; hidden when not |
| Death save bubbles | Shown only when `hpCurrent === 0`; 3 success + 3 failure bubbles, tappable from the dashboard |
| Inspiration indicator | Small glow or badge when the character has inspiration |

**Card interactions (DM actions, no per-character password required — DM session is sufficient auth):**

- **Tap HP number** → inline input to set a new value, or stepper buttons for +/- adjustment
- **Tap condition chip** → removes that condition
- **"+" button on card** → opens a quick-action popover with: Add Condition (multi-select from the 14 standard conditions), Set Temp HP, Clear Concentration, Deal Damage to This Character, Heal This Character
- **Death save bubbles** → tappable directly on the card; DM fills them as the player rolls

### Initiative tracker

A persistent panel alongside (or below) the party card strip.

**Functionality:**
- DM adds combatants by name (both PCs — pre-populated from character list — and NPCs/monsters as free-text entries)
- Each entry has an initiative value (number, set by DM)
- List is automatically sorted by initiative value (highest first)
- "Current turn" highlight advances through the list; DM taps "Next Turn" to advance
- Entries can be re-ordered manually by drag or up/down arrows (for ties, or DM judgment calls)
- NPC/monster entries can be added and removed freely
- PC entries can be removed (if a character flees or is incapacitated and no longer in initiative)
- The initiative list persists for the session (stored in-memory or in DynamoDB — see open questions)
- A "Clear Initiative" button resets the list for the next encounter

**What the initiative tracker does NOT do:**
- Auto-roll initiative for PCs (players roll physically or verbally; DM enters the number)
- Track monster HP or stats (out of scope — this is a party management tool, not a full VTT combat tracker)
- Apply turn-based effects automatically

### Party-wide actions

A set of quick actions that apply to all characters simultaneously:

- **Long Rest**: resets all characters' spell slots to max; optionally resets `hpCurrent` to `hpMax` (should be a confirmation prompt since "did we fully rest?" is often a question at the table); clears exhaustion level if the DM confirms
- **Short Rest**: resets Pact Magic (Warlock) spell slots for any character that has them; does NOT reset hit points or standard spell slots
- Both rest actions show a confirmation dialog listing what will change before applying

### Navigation from dashboard

- Each character card has a link icon that opens their full character sheet in a new tab
- This is for when the DM needs to see full stats, equipment, or spells — not the primary dashboard flow

### Layout

**Desktop** (primary DM context):
- Party card strip: horizontal row across the top, scrollable if needed
- Initiative tracker: right sidebar or bottom panel, persistent
- Party-wide actions: accessible via a toolbar or top-right button group

**Mobile** (secondary, but must work):
- Party cards stack vertically
- Initiative tracker collapses to an expandable panel
- DM actions accessible via a floating action button or a bottom sheet

### Visual style

- Uses the Ocean palette as the dashboard default (neutral dark theme not tied to any individual character's palette)
- Character cards adopt their own character palette for the HP bar, accent colors, and portrait border — this is the "quick visual ID" the consultant noted as valuable
- The overall dashboard bg and chrome are Ocean palette (`#0d0f14`, `#6a8fa8` accents)

---

## Data model changes

### New: Initiative state
Initiative order is ephemeral session state — it exists only for the current encounter and has no long-term value. Two options (see open questions):

Option A — DynamoDB (simple, consistent with existing pattern):
```
// New top-level item in DynamoDB, PK: "initiative"
{
  pk: "initiative",
  entries: [
    { id: string, name: string, initiative: number, isPC: boolean, characterSlug?: string }
  ],
  activeTurnIndex: number
}
```

Option B — sessionStorage on the DM's client only (ephemeral, zero cost, zero latency):
```
// Stored in DM's browser sessionStorage only
// Key: "dnd_initiative"
// Value: JSON of same structure as above
```

### Changes to character records
No new DynamoDB fields needed for the dashboard — it reads from fields introduced in stories 01–03:
- `hpCurrent`, `hpMax`, `tempHP` (story 01)
- `spellSlots` (story 02)  
- `conditions`, `exhaustionLevel`, `concentration` (story 03)
- `inspiration` (story 04)
- `armorTotal` (existing field, used for AC display)

### New API endpoints needed

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /dm/party` | GET | Returns all characters' session-relevant fields (hp, conditions, concentration, slots) in one call |
| `PATCH /characters/{slug}/session` | PATCH | Updates session state fields for a character (hp, conditions, concentration, etc.) — DM auth required |
| `GET /initiative` | GET | Returns current initiative order |
| `PUT /initiative` | PUT | Replaces initiative order |

The `PATCH /session` endpoint is important: it separates session state writes from full character updates, which allows the DM to modify HP/conditions without needing the per-character owner password — the DM session token is sufficient.

---

## Out of scope
- Monster / NPC stat blocks or HP tracking (the DM tracks those externally or on paper)
- Spell effect tracking (which spell is affecting which character)
- Map or spatial representation
- Combat log / history
- Shared visibility of the dashboard by players (DM-only view for now)
- ~~Real-time push updates~~ — **REINSTATED AS A REQUIREMENT** (see below). Previous polling-only recommendation overridden by product owner.

---

## Open questions

- **Initiative persistence**: sessionStorage (Option B) is simpler and free, but resets if the DM closes or refreshes the tab. DynamoDB (Option A) persists across tab reloads. Given that mid-session refreshes happen (especially on a long encounter), DynamoDB is probably the right call despite the small extra complexity. Confirm before implementing.

- **Session state auth**: the `PATCH /session` endpoint needs to accept DM session as sufficient auth for updating other characters' HP/conditions. This is a deliberate auth model relaxation. Confirm this is acceptable — currently the `update` endpoint requires the character's owner password.

- **Real-time sync approach**: OPEN — for architect to decide. **Requirement**: changes to session state (HP, spell slots, conditions, concentration, inspiration) made by either a player on their sheet or the DM on the dashboard must appear on all connected views without requiring a manual refresh. The technical approach — WebSocket API (API Gateway), Server-Sent Events, AWS AppSync subscriptions, or another mechanism — is deferred to the architect's review. The architect should weigh connection management complexity, cold start behavior, cost at small scale, and AWS SAM compatibility. A new ADR should be written for this decision. Polling is no longer the adopted approach.

- **Character palette on dashboard cards**: the dashboard defaults to Ocean palette chrome, but each character card uses that character's palette for its HP bar and accent. This may look visually noisy with 3–5 different palettes on screen. Alternatively, all cards use Ocean palette but show a small palette-colored accent stripe. Let the designer propose.

- **DM editing player-owned session state**: the `PATCH /session` endpoint allows the DM to change a player's HP, conditions, and concentration without that player's password. This is intentional (DM needs to apply damage). Make sure the auth model change is explicitly called out in the architect review.

---

## Architect Notes

**Applies**: ADR-003, ADR-004, ADR-005, ADR-006, ADR-009; **new ADR-011** (real-time sync)

**Tech approach**:

_Real-time sync — see ADR-011 for the full decision._ The adopted approach is **short-interval polling (2-second interval)** from both the player sheet and the DM dashboard. Each poll is a `GET /characters/{slug}` call (already exists). The DM dashboard polls `GET /dm/party` (new endpoint, see below). No WebSockets, no AppSync, no SSE. ADR-011 documents why and when to revisit.

_New API surface — minimal set:_

| Endpoint | Lambda | Reuse or new |
|---|---|---|
| `PATCH /characters/{slug}/session` | `src/handlers/session.js` | **New** — narrow write path for session fields; introduced in story 01 |
| `GET /dm/party` | `src/handlers/dmParty.js` | **New** — projects all characters to session-relevant fields only; avoids over-fetching `passwordHash`, `weapons` descriptions, etc. |
| `GET /initiative` | `src/handlers/initiative.js` (get) | **New** |
| `PUT /initiative` | `src/handlers/initiative.js` (put) | **New** (same file, two exports, or split — see below) |

That is 2 new Lambda files (session handler already counted in story 01, so net-new for this story: `dmParty` + `initiative`). Per ADR-004, prefer one file per operation; the initiative get/put can share a file since they operate on the same single DynamoDB item ("initiative" PK). Add both event bindings to `template.yaml` pointing to the same handler with an internal `event.requestContext.http.method` branch — this is the one acceptable multi-operation handler because the item is identical and the handler count stays manageable.

`GET /dm/party` is `list.js` logic with a field projection — do not literally reuse `list.js` (it returns full character items). Write `dmParty.js` as a thin wrapper: scan table with a `ProjectionExpression` covering only `slug, name, nameAlt, palette, portraitUrl, hpCurrent, hpMax, tempHP, armorTotal, conditions, exhaustionLevel, concentration, inspiration, spellSlots`. This keeps the DM polling payload small.

_Auth model for `PATCH /session`:_ The handler checks for `x-character-password`. If present, it calls `verifyPassword()` (owner or DM both accepted). If absent, the write is permitted without auth — this is the session-state relaxation. For DM dashboard writes, the frontend sends the DM password in `x-character-password` so the handler logs `role: "dm"` for observability. Document the no-auth path with an explicit comment in the handler: `// Session fields are intentionally writable without auth — see ADR-005 and story 01 architect notes.`

_`GET /dm/party` auth:_ Require the DM password (`x-character-password` header, verified as `role: "dm"` by `verifyPassword()`). This endpoint returns data for all characters — it should not be publicly accessible. Owner passwords are not valid for this endpoint (check `auth.role === "dm"` explicitly).

_Initiative persistence:_ Use DynamoDB Option A (single item, PK: `"initiative"`). Rationale: mid-session tab refreshes and the possibility of the DM sharing a device mean sessionStorage (Option B) is too fragile. A single DynamoDB item at near-zero cost is the right call. The `CharactersTable` already exists — add the initiative item to the same table (the flat schema per ADR-003 accommodates it; the `slug` PK just holds the string `"initiative"`). No new table, no new SAM resource.

_`GET /dm/party` polling and cold starts:_ At a 2-second poll interval across 3 clients (3 players + 1 DM = 4 clients), this is ~2 req/sec. Lambda will stay warm. Lambda + DynamoDB cost at this scale is effectively zero — well within free tier for a small group.

_New `template.yaml` resources needed:_ `SessionFunction` (PATCH `/characters/{slug}/session`), `DmPartyFunction` (GET `/dm`), `InitiativeFunction` (GET+PUT `/initiative`). Add `PATCH` to the API CORS `AllowMethods`. The existing `x-character-password` is already in `AllowHeaders` — no CORS change needed beyond the method.

_Dashboard frontend:_ New page at `/dm` in `src/pages/DmDashboardPage.jsx`. This is the first page outside of the character sheet that has significant complexity — it should be its own file, not added to `CharacterSheet.jsx`. ADR-002's "distinct sub-features large enough to be genuinely independent" criterion is clearly met here.

_Long rest / short rest party-wide actions:_ The frontend fires one `PATCH /session` per character in parallel (`Promise.all`). No new "party rest" endpoint is needed. At 3–5 characters, 3–5 parallel writes complete in well under 1 second.

**Scope boundary**: In — `/dm` route with DM auth gate; party card strip; HP/condition controls from the dashboard; initiative tracker (DynamoDB-backed); long/short rest party actions; `GET /dm/party` endpoint; initiative get/put endpoints. Out — monster/NPC stat blocks; shared dashboard visibility for players; combat log; map.

**Performance notes**: 2-second polling from up to 4 clients = ~2 req/sec sustained during a session. DynamoDB PAY_PER_REQUEST at this scale costs fractions of a cent per session. No caching layer needed.

**Cost notes**: No new AWS services. Two new Lambdas + one new DynamoDB item pattern (initiative). Cost impact negligible. If polling ever becomes a concern (highly unlikely at current scale), ADR-011 documents the upgrade path.

**Dependencies**: Stories 01, 02, 03 data fields must be in DynamoDB before the dashboard can display meaningful data. Story 01's `PATCH /session` endpoint is the foundation. Story 04's tab structure is independent — dashboard can be built in parallel with story 04.

**Risks / decisions needed**:
- The no-auth session write path (ADR-005 relaxation) requires explicit product-owner sign-off before `PATCH /session` goes to production. This is the single highest-stakes decision across stories 01–05.
- Initiative persistence (DynamoDB vs. sessionStorage) is resolved above in favor of DynamoDB — confirm with product owner before building the initiative Lambda.
- The `GET /dm/party` endpoint requiring DM auth means the frontend must send the DM password on every poll. This password lives in `sessionStorage` (`dnd_dm_password`) per ADR-006 — confirm the product owner is comfortable with the DM password being sent on every 2-second polling request (it's over HTTPS; the main concern is log exposure in API Gateway access logs).
