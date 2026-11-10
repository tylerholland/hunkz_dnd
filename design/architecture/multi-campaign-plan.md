# Multi-campaign plan: campaigns, accounts, more than one table

Status: **proposal** (2026-11-10). Nothing here is built yet. Phase 0 is specified
in enough detail to start; phases 1 and 2 are outlined so phase 0's choices
leave room for them.

## Goal and constraints

Let a few groups use Hunkz Adventures: colleagues who play D&D, by invitation,
not open sign-up. Each group (a **campaign**) has its own DM, settings, live
table state and Chronicle. Players have accounts, own one or more characters and
can move a character between campaigns. Groups may play at the same time; the
scale is 5–10 campaigns, not thousands.

Decisions so far:
- Accounts only. No guest play. A tour is a demo campaign with demo logins.
- A character is in one campaign at a time, but moving it is easy and keeps
  its sheet (HP, inventory, XP travel with it).
- No co-DMs now, but a campaign stores a **list** of DMs so they can come later.
- Libraries (maps, creatures, shop catalog, talent texts) belong to a DM. First
  step: one shared starter library; new DMs start from a copy of it.
- Invite-only. Open sign-up is a later decision.

## Where we are (what "one game" means in the code)

- **Data.** One DynamoDB table (`dnd-characters`, key `slug`) holds the
  characters plus 19 special records, each existing once: `initiative`,
  `npc-combat`, `roll-history` (+ `roll-history-archive:0..5`, `:index`),
  `map-library`, `party-roster`, `npc-library`, `counter-wheels`, `house-rules`,
  `app-meta`, `chronicle` (+ `chronicle-session:<id>`), `talent-codex`, `shop`,
  `shop-catalog`, `presence`, `party-vote`, `roll-requests`, `table-silence`,
  `prep-deck`, `table-messages` (`backend/src/lib/specialItems.js`).
- **The roll log** is one record: the newest 100 events ride every poll, older
  ones rotate through a ring of six 500-event archive pages, so ~3,100 events
  are kept and older ones are overwritten. Every roll, HP change and condition
  is a version-checked write to that same record.
- **Auth.** The DM is a single bcrypt hash in a Lambda environment variable
  (`DM_PASSWORD_HASH`, from SSM). Each character has its own password; the
  browser keeps it in `sessionStorage` (`dnd_char_<slug>`, `dnd_dm_password`)
  and sends `x-character-password`. Session edits and own-token moves are
  intentionally open (ADR-005).
- **Realtime.** `broadcast.js` scans *all* WebSocket connections and nudges
  every one of them on any write; clients then refetch `GET /session-state`.
- **Reads.** `getSessionState` is two BatchGets (good). `list`, `dmParty`,
  `getPartyStatus` and `getPartyRoster` still Scan the whole table.
- **Files.** One public-read bucket, `hunkz-dnd-portraits`, with flat folders:
  `portraits/`, `maps/`, `npc/`, `npc-portraits/`, `shop-items/`, `moments/`.
  URLs are stored whole in records.
- **API.** 63 routes across 49 Lambda handlers; the frontend reaches them
  through ~77 functions in `src/api.js`. Routes are global (`/initiative`,
  `/maps/{mapId}`, `/characters/{slug}`).
- **Deploys.** `./deploy.sh` goes straight to production and broadcasts a
  reload to every open screen.

## Target model

| Entity | Key | Holds |
|---|---|---|
| Campaign | `CAMP#<campaignId>` / `META` | name, `dmUserIds[]` (phase 1), `libraryId`, createdAt |
| Campaign state | `CAMP#<id>` / `STATE#<name>` | today's live records: initiative, npc-combat, map-library, roster, counter-wheels, house-rules, shop, vote, roll-requests, silence, prep-deck, table-messages, presence, chronicle index |
| Log event | `CAMP#<id>` / `LOG#<createdAt>#<eventId>` | one roll / HP / condition / turn / note … event |
| Chronicle session | `CAMP#<id>` / `CHRON#<sessionId>` | as today's `chronicle-session:<id>` |
| Character | `CHAR#<characterId>` / `META` | the sheet, plus `campaignId` and (phase 1) `ownerUserId` |
| Library | `LIB#<libraryId>` / `NPCS`, `SHOP_CATALOG`, `TALENTS` (phase 2: `MAPS`) | what a DM builds once and reuses |
| App | `APP` / `META` | build version (deploy stamp) |
| User (phase 1) | `USER#<sub>` / `META` | display name |
| Membership (phase 1) | `CAMP#<id>` / `MEMBER#<userId>` | role: `dm` or `player` |

Indexes:
- **GSI1** `campaignId` → characters in a campaign (replaces the four Scans).
- **GSI2** (phase 1) `ownerUserId` → a user's characters.
- **GSI3** (phase 1) `userId` → a user's memberships (inverted `MEMBER#`).

Why a **new table** rather than adding fields: a DynamoDB table's key can't be
changed, and `slug` alone can't hold "many campaigns × many records". A
`PK`/`SK` single-table layout lets one Query fetch everything a campaign needs.

Why the log becomes **one item per event**:
- **No contention.** Rolls stop competing for one version-checked record.
- **No ring that overwrites old history.** The whole log is kept.
- **Simpler Chronicle recording.** It becomes a Query between two times.

Characters keep **their own partition** (not under the campaign) so moving one
between campaigns is a single field change, not a copy.

`characterId` = today's `slug` for existing characters, so URLs stay the same.
Slugs stay globally unique: new characters get a conditional put on a
`SLUG#<slug>` item.

### Files

New uploads use owner-based prefixes; existing files stay where they are (their
URLs are stored whole and keep working):

```
lib/<libraryId>/maps/…        lib/<libraryId>/npc/…        lib/<libraryId>/shop-items/…
camp/<campaignId>/moments/…   char/<characterId>/portraits/…
```

The bucket stays public-read with unguessable keys for now; privacy-tightening
(signed GETs) is a later choice.

---

## Phase 0 — campaigns under the hood (no visible change)

Outcome: the app behaves exactly as today, but every record, event, connection
and file is scoped to a campaign (`hunkz`) and a library (`hunkz`). Nothing about
auth changes yet. Doing this while there is one group means a bug can only hurt
one table, ours.

### 0.1 A store layer over today's table (no behaviour change)

Add `backend/src/lib/store.js` and route **all** data access through it:

```js
getCampaignStates(campaignId, names)        // one BatchGet → { initiative, …, versions }
putCampaignState(campaignId, name, payload, { expectedVersion })
appendLog(campaignId, events)               // replaces appendRollHistoryEvent(s)
readLog(campaignId, { limit, before, since, until })
updateLogEvent(campaignId, ref, changes)    // tag, applied, effect note
getCharacter(id) / putCharacter(item, { expectedVersion }) / listCampaignCharacters(campaignId)
getLibrary(libraryId, name) / putLibrary(libraryId, name, payload, { expectedVersion })
getAppMeta()
```

At this step the implementation still reads and writes the old slugs and
ignores `campaignId`. Each handler takes `campaignId` from
`event.pathParameters.campaignId ?? DEFAULT_CAMPAIGN_ID` (`"hunkz"`). Handlers
stop importing `specialRecords.js`/`db` directly.

- Touches: all 49 handlers, `specialRecords.js`, `chronicle.js`, `presence.js`,
  and the handler tests (they mock `db.send`; most can mock `store.js` instead,
  which also makes them shorter).
- Done when: full backend suite green, `sam validate --lint` clean, a deployed
  build behaves identically.

### 0.2 Broadcast per campaign

- `wsConnect.js`: read `?campaign=` (default `hunkz`); store `campaignId` on the
  connection item. Add **GSI** `campaignId` to `dnd-ws-connections`.
- `notifySessionChanged(campaignId)`: Query that index instead of Scan.
  `broadcastReload` (deploys) stays global.
- `src/lib/useSessionSocket.js`: pass the campaign (still the default for now).
- Small, independent; can ship before 0.1 if convenient.

### 0.3 The new table, behind a switch

- Add `GameTable` (`dnd-game`, `PK`/`SK`, GSI1, point-in-time recovery **on**,
  TTL attribute reserved) to `template.yaml`. Env var `GAME_TABLE`; flag
  `STORE_BACKEND=legacy|game`.
- Implement `store.js` for `game`:
  - `STATE#…` items mirror today's records one-to-one, including `version`
    (ADR-030).
  - `appendLog` writes one item per event. Use BatchWrite; events are
    immutable except via `updateLogEvent`.
  - `readLog({ limit: 100 })` replaces the live feed: Query newest-first. The
    public projection in `getSessionState` is unchanged.
  - `updateLogEvent` needs the event's sort key. Log event ids get the time
    prefix (`LOG#<createdAt>#<id>`). The tag/apply endpoints accept
    `{ id, createdAt }`; the client already has both. Keep a fallback that
    Queries the last 24 h by id.
  - Chronicle recording (`chronicle.js` `gatherSessionEvents`) becomes
    `readLog({ since, until })`. The "live + archive" merge goes away.
  - The roll-history archive endpoint (`GET /roll-history?archive=1`) becomes
    paged `readLog({ before })`.
- `getSessionState` round trips stay at two: BatchGet of campaign states +
  Query of the log (in parallel), then the roster's characters.

### 0.4 Migration and cutover

`scripts/migrate-to-campaigns.mjs` (interactive, like `migrate.mjs`):
1. **Read** the whole old table (Scan, paged).
2. **Write**:
   - `CAMP#hunkz/META` with `libraryId: "hunkz"`.
   - Each live record → `CAMP#hunkz/STATE#<name>`.
   - `npc-library`, `shop-catalog`, `talent-codex` → `LIB#hunkz/…`.
   - Each character → `CHAR#<slug>/META` with `campaignId: "hunkz"`.
   - Chronicle sessions → `CHRON#<id>`.
   - Log: the live feed plus all archive pages, deduped by id, → `LOG#…` items.
     Chronicle snapshots stay as they are (they're copies by design).
   - `app-meta` → `APP/META`.
3. **Dry run** prints counts per kind and any record it can't place.
4. **Verify**: for the default campaign, call the `getSessionState`
   projection (public and DM variants) against both backends and diff, ignoring
   order and `version`. Same for `list`, `dmParty`, chronicle index/session.

Cutover, in a quiet window (no session that day):
1. Deploy with `STORE_BACKEND=legacy` (0.1–0.3 code live, old data).
2. Run migration + verify.
3. Flip to `game`, deploy, smoke test (DM dashboard, a player sheet, a roll,
   an HP change, a vote, the Chronicle).
4. Keep the old table untouched for a month (PITR on it too).

Rollback: flip back to `legacy`. Anything written after the flip is lost, which
is acceptable in a quiet window. That's why the window matters.

`deploy.sh` writes `APP/META` instead of `app-meta`.

### 0.5 Campaign-scoped routes

- **Template:** add `/c/{campaignId}/…` for every campaign-level route
  (initiative, npc-combat, maps, roll-history, party-roster, counter-wheels,
  house-rules, shop, vote, roll-requests, silence, prep-deck, table-messages,
  chronicle, session-state). Keep the old routes pointing at the same
  functions; they resolve to `hunkz`.
- **Unchanged:** character routes (`/characters/{slug}/…`); the character's
  `campaignId` is read from the record. The same goes for `/libraries/{libraryId}/…`
  (npc library, shop catalog, talent codex, presign).
- **Frontend:** `src/api.js` gets one path builder,
  `campaignPath(path) → /c/${currentCampaignId}${path}`, and every campaign
  call uses it. `currentCampaignId` comes from config
  (`VITE_DEFAULT_CAMPAIGN=hunkz`) in phase 0 and from the URL in phase 2. No
  page changes.
- **Remove:** the old routes once the new frontend has been live for a session
  or two.

### 0.6 Libraries and file prefixes

- NPC library, shop catalog and talent codex are read/written through
  `getLibrary/putLibrary(campaign.libraryId, …)`.
- Presign handlers (`mapPresign`, `npcPortraitPresign`, `portrait`) write new
  objects under the prefixes above. Bucket policy: add `lib/*`, `camp/*`,
  `char/*` to public-read (keep the old folders).
- `map-library` stays **campaign state** in phase 0. It mixes "maps the DM
  owns" with "what's on the table now" (active map, tokens, view, combat mode);
  splitting it is phase 2 work.

### 0.7 Clean up

- Delete `STORE_BACKEND=legacy` code, the archive ring, the four Scans and the
  old routes.
- Update `design/architecture/data-model.md`, `backend-reference.md`, the
  backend and realtime module notes, and add an ADR ("Campaign-partitioned
  single table; one item per log event").

### Phase 0 order, size and risk

| Step | Size | Risk | Ships alone? |
|---|---|---|---|
| 0.2 scoped broadcast | S | low | yes |
| 0.1 store layer | L (mechanical, every handler) | medium: breadth | yes |
| 0.3 game backend + log items | M | medium | behind flag |
| 0.4 migration + cutover | M | **high**: data | the one risky moment |
| 0.5 campaign routes + `api.js` | M | low | yes |
| 0.6 libraries + prefixes | S | low | yes |
| 0.7 cleanup + docs | S | low | yes |

Testing beyond the unit suites:
- A **projection contract test**: a fixture of today's records fed through both
  store backends must give identical `getSessionState` output.
- A **migration test** on a copy of real data: export the table to JSON and run
  the migration into DynamoDB Local or a scratch table.

---

## Phase 1 — accounts (still one campaign)

Outcome: everyone signs in. Your players claim their existing characters, your
DM claims the campaign, and passwords retire. Still one campaign.

- **Identity: Amazon Cognito user pool.**
  - Email + password, Google optional. Managed login pages with PKCE (via a
    small OIDC client such as `oidc-client-ts`), so the app doesn't build
    sign-in screens.
  - **Invite-only:** self sign-up is allowed only with a valid invite code,
    checked by a Pre sign-up Lambda trigger against `INVITE#<code>` items.
- **API.**
  - The HTTP API gets a **JWT authorizer**; handlers read
    `requestContext.authorizer.jwt.claims.sub`.
  - A helper `requireMember(campaignId, userId, role?)` and
    `requireCharacterOwner(characterId, userId)`. Membership is cached
    per Lambda container for ~60 s.
  - Replaces `verifyPassword`, `x-character-password` and `DM_PASSWORD_HASH`.
  - ADR-005's open paths become **members of the campaign**; DM-only stays DM
    (any user in `dmUserIds`).
- **Realtime.** The WebSocket `$connect` takes `?token=` (browsers can't set
  headers on sockets), validates the JWT and checks membership.
- **Data.**
  - `USER#<sub>`, `CAMP#<id>/MEMBER#<userId>`.
  - `ownerUserId` on characters.
  - GSIs 2 and 3.
  - `dmUserIds[]` on the campaign; a list, so co-DMs need no migration.
- **Claiming** (one time, keeps continuity):
  - A signed-in player enters a character's old password once → it becomes
    theirs.
  - The DM enters the DM password once → becomes campaign DM.
  - After everyone has claimed, password hashes are removed.
- **Invites.**
  - The DM creates a code in campaign settings.
  - `/join/<code>` → sign in or up → pick an existing character or create one
    → joined.
- **Frontend.**
  - An auth context. `api.js` attaches the bearer token and refreshes it
    silently.
  - Password prompts and `sessionStorage` credentials go away.
  - New screens: sign in (managed), **My characters** (list, create, open),
    a minimal **Account** page (name, sign out, delete).
- **Demo / tour.** A `demo` campaign with demo characters and a shared demo
  login. It gets reset by a script.
- **Size:** M–L. Touches every handler's auth line (one helper call each) and
  every page that prompts for a password.

## Phase 2 — more than one campaign

Outcome: a second DM can run their own game, with their own settings,
Chronicle and library.

- **Campaigns.**
  - **Create campaign** (gated by an `canCreateCampaigns` flag on the user
    while invite-only).
  - A **campaign switcher** and a home page listing your campaigns and
    characters.
- **Routes.** `/c/:campaignId/dm`, `/c/:campaignId/play/:slug`,
  `/c/:campaignId/chronicle`, `/c/:campaignId/maps`; `api.js`'s
  `currentCampaignId` comes from the URL. Old URLs redirect into the user's
  campaign.
- **Per campaign, already true after phase 0:** house rules, live state, prep
  deck, shop opening, presence, the log, the Chronicle, next-session time.
- **Libraries.**
  - A new DM's first campaign gets a **copy** of the starter library
    (`LIB#<new>` ← `LIB#hunkz` records). Asset URLs are shared rather than
    duplicated: the files are public and never edited in place. New uploads go
    under their own `lib/<id>/` prefix.
  - No shared-mutable library, so no permission puzzles.
  - "Publish, browse and copy from other DMs" is a later feature on the same
    shape.
- **Maps split.**
  - `map-library` → `LIB#<id>/MAPS` (the uploaded maps, calibration,
    rotation) + `CAMP#<id>/STATE#table` (active map, tokens and their
    positions, view, combat mode).
  - Tokens are per campaign, per map.
- **Moving a character.**
  - The owner picks another campaign they belong to. Their character leaves the
    old roster, initiative and tokens, and joins the new roster.
  - The sheet travels unchanged. The old campaign's log and Chronicle keep their
    history (events carry names).
- **Operations, needed before a second group plays.**
  - **Staging:** a second SAM stack (`samconfig` env `staging`: own table,
    bucket, Cognito pool, domain). Deploy there first.
  - **Deploys:** stop forced reloads mid-game. Clients show "A new version is
    ready, reload when convenient". Only force when the API contract breaks,
    and then only to campaigns with no one present.
  - **Visibility:** CloudWatch alarms on Lambda errors/throttles; an error
    reporter on the frontend.
  - **Limits and costs:** per-user rate limits on uploads, an upload size cap,
    and an AWS budget alert. At 5–10 groups expect single-digit dollars a month
    plus S3 storage.
  - **Content:** before showing outsiders, keep game content to the SRD 5.1
    (CC-BY 4.0), with attribution. Avoid "D&D" in branding; check that shop
    and item art is yours to use.
- **Size:** L, mostly new screens and the maps split; the foundations exist
  after phases 0–1.

## Open questions (decide before the phase that needs them)

1. Phase 1: Google sign-in, or email only?
2. Phase 1: does the Chronicle stay readable without signing in (shareable),
   or members only?
3. Phase 2: who may create campaigns — anyone invited, or only people you
   mark as DMs?
4. Phase 2: when a character moves, should anything reset (temporary HP,
   conditions, concentration, exhaustion)? Suggest: clear conditions,
   concentration and temp HP; keep the rest.
5. Later: should the file bucket become private (signed URLs) once outsiders
   upload pictures?
