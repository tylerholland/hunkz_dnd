# Story 10 — NPC Combat Tracker

**Status**: Ready for implementation

---

## Consultant analysis

### Should the DM be able to track NPC details during a live session?

Yes — but with a carefully scoped MVP. The single biggest friction point in running combat with this tool today is that the DM has full visibility into party state (HP, conditions, spell slots, concentration) via the dashboard, but has zero visibility into enemy state. That asymmetry means the DM must mentally or physically track NPC HP elsewhere (scratch paper, a second tab, a phone app) while simultaneously managing the dashboard. Closing that gap is high-value and directly serves the stated use case: an in-session DM tool.

---

### What does a DM need to track for NPCs in combat?

From a 5e gameplay perspective, the minimum viable combat state for an NPC is:

1. **Name / identifier** — "Goblin A" vs "Goblin B"; or a named boss like "Strahd". The DM needs to distinguish between multiple instances of the same creature type.
2. **Current HP** — the single most-checked value in combat. The DM needs to know when a creature drops to 0, when it is bloodied (below half), and whether it should flee, beg, or fight to the death.
3. **Max HP** — needed to calculate the bloodied threshold and to judge whether a creature is near death. In 5e, DMs often roll or use average HP per monster type; this just needs to be a number the DM sets at the start of combat.
4. **Active conditions** — Frightened, Poisoned, Restrained, Prone, etc. change AC, attack rolls, movement, and saves meaningfully enough that forgetting them causes real errors. A DM running four goblins absolutely needs to know which one is Restrained by the ranger's Ensnaring Strike.
5. **Initiative position** — NPCs already live in the existing initiative tracker. This is the linkage point (see below).

That's it for MVP. Everything else — AC, saving throw bonuses, legendary action charges, lair action timing — is additional complexity that is better served by a full VTT or a printed stat block. This tool is a session companion, not a full monster compendium.

---

### How is this different from tracking PC data?

Several important differences shape the data model and UX:

| Dimension | PC | NPC |
|---|---|---|
| **Persistence** | Permanent record in DynamoDB | Ephemeral — scoped to one combat encounter |
| **Data richness** | Full sheet: stats, equipment, backstory, portraits | Thin: name, HP, conditions only (MVP) |
| **Identity** | One named character per slug | Multiple instances of the same type ("Goblin A–D") |
| **Auth** | Password-protected | DM-only; no player auth needed |
| **Spell slots / concentration** | Tracked per character | Out of scope for MVP (boss spellcasters are rare; DM can handle mentally) |
| **Exhaustion** | Tracked (0–6) | Out of scope for MVP |
| **Edit mode** | Full character editor | Created inline, on the fly, during session prep or mid-combat |

The core architectural difference is that NPC state is **always ephemeral**. Unlike PCs, whose current HP and conditions need to survive between tabs and sessions (because players and DMs may both need to read them), NPC combat state is meaningless once the encounter ends. An NPC that dies in session 7 should not appear in the dashboard in session 8.

---

### What is the minimum viable set of fields?

```
{
  id: string,           // local identifier — not a DynamoDB slug
  name: string,         // e.g. "Goblin A" or "Strahd von Zarovich"
  hpMax: number,        // set at combat start; can be edited mid-combat
  hpCurrent: number,    // modified via the same ±1 stepper + damage/heal modal pattern as PCs
  conditions: string[], // same 14 standard 5e conditions as PCs
  initiativeId?: string // reference to the matching initiative tracker entry, if linked
}
```

Explicitly out of MVP scope: AC, speed, spell slots, concentration, exhaustion, save DCs, legendary/lair actions, portraits, notes, custom names beyond a free-text field.

---

### Should NPC data persist between sessions?

**No — it should be ephemeral, but with a clear lifecycle.**

NPC combat state should persist only for the duration of the DM's current session (i.e., while the DM tab is open or the DM password session is active). It should **not** survive a page refresh or a new DM session login, and it should never be stored in DynamoDB as a character record.

The right storage target is `sessionStorage` on the DM client, or optionally a dedicated ephemeral DynamoDB item (similar to the `slug: "initiative"` item) that the DM can explicitly clear. The DynamoDB approach has one advantage: if the DM accidentally refreshes during a long session, the NPC HP state survives. This is worth doing.

The recommended lifecycle:
- NPCs are created when the DM starts a new encounter (or imports from initiative tracker).
- NPC state is stored in DynamoDB as a single item (`slug: "npc-combat"` or similar), structured as an array of NPC objects.
- The DM explicitly clears NPC state with a "Clear NPCs" / "End Combat" action — mirroring the "Clear ×" action in the initiative tracker.
- NPC state is never shown to players and is never mixed into the character list endpoint.

---

### Does this need to integrate with the existing initiative tracker?

Yes — and this is the key design decision. The initiative tracker already holds NPC entries (name + initiative number, tagged "NPC"). These two systems should share identity, not duplicate it.

The integration points are:

1. **Automatic NPC card creation**: When an NPC entry is added to the initiative tracker (or retroactively when the DM enables NPC tracking), the DM should be able to promote an initiative entry into a tracked NPC with HP and conditions. This avoids the DM entering the same creature name twice.

2. **Linked display**: On the initiative tracker, when a tracked NPC's HP drops to 0, their initiative entry should be visually marked as dead/down — the same way a PC card turns red at low HP.

3. **No forced coupling**: The DM should be able to add NPC HP tracking without using the initiative tracker, and vice versa. Some DMs prefer not to use digital initiative. The systems are better-together but not dependent on each other.

The current initiative tracker stores `{ name, initiative, isNPC }` per entry. Adding an optional `npcId` foreign key to each entry is sufficient to link the two systems without a schema overhaul.

---

## Goal

Give the DM a lightweight way to track NPC hit points and conditions during combat, integrated with the existing initiative tracker, so that all live session state — both party and enemy — is visible on the DM dashboard without leaving the app.

---

## User stories

1. **As the DM**, I want to add one or more NPCs to a combat encounter — each with a name and starting HP — so I stop tracking goblin HP on scratch paper while trying to run the party's combat on the dashboard.

2. **As the DM**, I want to adjust an NPC's current HP using the same ±1 stepper and damage/heal interaction I already use for party members, so there's no new mental model to learn mid-session.

3. **As the DM**, I want to apply conditions to an NPC (Frightened, Prone, Restrained, etc.) and see them at a glance on the NPC card, so I don't accidentally forget that the ranger has the lead goblin Restrained when resolving its attack roll.

4. **As the DM**, I want NPC cards to visually indicate when a creature is bloodied (below half HP) or at 0 HP, so I can make narrative and tactical decisions (does it flee? does it die?) without doing arithmetic mid-turn.

5. **As the DM**, I want NPCs in the initiative tracker to show their HP status inline (alive / bloodied / dead), so I can see at a glance which creatures are still a threat when it's their turn.

6. **As the DM**, I want to clear all NPC state with a single action at the end of combat, so dead goblins don't clutter the dashboard when I open it for the next session.

7. **As the DM**, I want NPC state to survive a page refresh during a long session (stored on the server, ephemeral but durable), so a fat-finger reload doesn't wipe out the HP I've been tracking for the last 30 minutes.

8. **As the DM**, I want to promote an existing initiative tracker entry into a tracked NPC (by tapping it and entering HP), so I don't have to type the creature's name twice when I've already added it to initiative.

---

## Functional requirements

### NPC data shape (MVP)

- `id`: client-generated UUID (not a DynamoDB slug)
- `name`: free text, required
- `hpMax`: positive integer, required at creation
- `hpCurrent`: integer, starts equal to `hpMax`; can go below 0 (overkill is meaningful in 5e)
- `conditions`: array of condition name strings, same 14 as PCs
- `initiativeEntryId`: optional reference to link with an initiative tracker entry

### Storage

- A single DynamoDB item with `slug: "npc-combat"` stores the full NPC array as a top-level attribute.
- Same access pattern as the `slug: "initiative"` item — GET and PUT, DM password required.
- No per-NPC DynamoDB items; no new table.
- Client polls on the same 2-second interval as initiative and party data (ADR-011).

### NPC cards on the DM dashboard

- NPC cards appear in a dedicated section, visually separate from party cards but on the same dashboard surface.
- Each NPC card shows: name, `hpCurrent / hpMax`, HP bar (same style as PC cards), condition chips, bloodied state (below 50% HP), dead state (0 or below HP).
- HP adjustment: same ±1 stepper and damage/heal modal as PC cards (identical interaction model).
- Condition management: same Add Condition popover as PC cards.
- No portrait, no palette theming — NPC cards use a neutral visual treatment to avoid confusion with party members.
- "×" remove button to delete an individual NPC mid-combat.

### Integration with initiative tracker

- Each initiative entry for an NPC (currently `isNPC: true`) gains an optional `npcId` field.
- When an NPC card exists with a matching `npcId`, the initiative entry shows a small HP indicator (e.g., a color dot: green / orange-bloodied / red-dead) next to the creature's name.
- The DM can tap an initiative entry (NPC row) to promote it: a small form appears asking for `hpMax`; on confirm, an NPC card is created and linked.
- PC initiative entries are unaffected.

### DM Dice Roller "Apply to…" integration

- The existing "Apply to…" pill row (story 08) currently shows only party members.
- Extend it to also show NPC entries (when NPC tracking is active) so the DM can apply damage to a goblin directly from the dice roller.
- NPC pills use a neutral style (no palette accent).

### Lifecycle / clear action

- "End Combat" button (new, in the DM dashboard toolbar or bottom of NPC section) clears all NPC cards and resets the `npc-combat` DynamoDB item to an empty array.
- Does not affect the initiative tracker — the DM clears that separately with the existing "Clear ×" button.
- Requires a confirmation dialog ("End combat? This will remove all NPC tracking.").

---

## Data model changes

- **New DynamoDB item**: `{ slug: "npc-combat", npcs: NPC[] }` — same ephemeral item pattern as `slug: "initiative"`.
- **Initiative entry schema**: add optional `npcId: string` field to each entry in the `slug: "initiative"` item.
- **New Lambda handlers**: `getNpcCombat` (GET /npc-combat) and `putNpcCombat` (PUT /npc-combat), both DM-auth-only.
- **`dmParty.js`**: no changes needed — the NPC combat endpoint is separate.
- **`template.yaml`**: two new Lambda functions + API Gateway routes.

---

## Out of scope

- NPC portraits, palette theming, or character backstory.
- Spell slot or concentration tracking for NPC spellcasters.
- Exhaustion tracking for NPCs.
- Saving NPC stat blocks for reuse across sessions (no "monster compendium").
- Player-visible NPC state (NPC data is always DM-only).
- AC, speed, or save bonus tracking.
- Legendary actions, lair actions, or multi-phase bosses.
- Import from D&D Beyond, Monster Manual PDFs, or any external source.
- Any changes to the player character sheet view.

---

## Open questions

1. **NPC section placement on dashboard**: Should NPC cards appear in the left (party) column below party cards, in a dedicated third column, or in the right column alongside the initiative tracker? The left column grows long; a third column may require layout changes. UX to decide.

2. **"Apply to…" NPC pills — damage flow**: When the DM applies damage to an NPC from the dice roller, should it go through a modal (matching the PC flow, requiring confirm) or apply directly (simpler, but inconsistent)? NPCs don't have the same "player feels it" sensitivity, so direct apply may be better. UX and architect to advise.

3. **Bloodied threshold**: 5e doesn't have an official "bloodied" mechanic (unlike 4e), but many DMs use the halfway point as a behavioral trigger (creature flees, reveals its true form, etc.). Should the bloodied visual indicator be opt-in, or always-on? Always-on seems safe as a visual aid without implying rules weight.

4. **Multiple NPC instances of same type**: Should the app auto-suffix names ("Goblin A", "Goblin B") when the DM adds multiple creatures of the same type, or let the DM name them freely? Auto-suffix is helpful for speed but may conflict with named creatures. UX to decide — both flows should work.

5. **Initiative promotion UX**: The "tap an initiative entry to promote to NPC" flow works cleanly on desktop but may be awkward on mobile (the initiative tracker is already touch-dense). UX to design a clear tap target that doesn't conflict with "Next Turn" and "×" remove.

---

## UX Design

**Prototype**: `design/prototypes/npc-combat-tracker.html`

---

### Layout: third column between party and initiative

The dashboard grows from two columns to three:

```
[ Party cards ] | [ NPC tracker ] | [ Initiative ]
```

The NPC column sits between party and initiative because it is thematically between them — it tracks enemies the way the party column tracks allies, and it feeds status into the initiative list on the right. On screens ≤1100px, the NPC column drops below the two-column party/initiative layout (full width). On screens ≤700px, all three columns stack vertically.

This avoids growing the party column (which is already the longest and scroll-heaviest) and keeps the initiative tracker anchored at the right edge where the DM's eyes naturally track turn order.

---

### NPC cards: compact, neutral, distinct from PC cards

NPC cards use a deliberate visual treatment different from character cards:
- **No palette stripe color** — instead a warm parchment-neutral tone (`--npc-accent: #7a7060`, `--npc-bright: #b0a080`) so NPCs are visually "enemy" territory, not party members
- **Slightly smaller** than PC cards — name at 15px vs 17px for PC, HP current at 20px vs 22px — reflecting that NPCs are secondary objects to track
- **Same structural layout** as PC cards (name row, HP numbers, stepper + HP bar, quick actions) so the interaction model is identical

Each NPC card contains:
- Name (truncated with ellipsis if long)
- HP current / HP max in Cinzel display font
- ±1 HP stepper flanking the HP bar — same hold-to-repeat timing (500ms delay, 80ms repeat) as PC cards
- ⚔ Damage / ✦ Heal / + Condition quick action buttons — same modal patterns as PC cards
- × remove button (top-right corner)
- Condition chips (same 14 standard conditions, same color coding as PC cards)

---

### HP states: normal / bloodied / dead

Three visual states, always-on (not opt-in):

- **Normal** (HP > 50%): warm gold left stripe, standard border
- **Bloodied** (HP ≤ 50%, > 0): orange left stripe (`#c07030`), amber border, `BLOODIED` badge next to name, HP number shifts to amber
- **Dead** (HP ≤ 0): dark red left stripe, red border, `DEAD` badge, card opacity reduced to 75%, name gets strikethrough, HP number turns red

These map to the three `init-hp-dot` states in the initiative column (green / amber glow / dark red), so the DM gets the same information at a glance in both columns.

---

### Promote-to-NPC flow (from initiative entry)

NPC entries in the initiative list (`isPC: false`) are visually tappable — warm hover state distinguishes them from PC entries. Tapping one expands an inline form directly below that entry:

```
┌─────────────────────────────────────────┐
│ 14  Goblin A   [NPC]              ×     │
│────────────────────────────────────────│
│ Set HP max to begin tracking           │
│ [ _____ HP ]   [+ Track]  [cancel]     │
│ Leave blank to add without HP tracking │
└─────────────────────────────────────────┘
```

On confirm, an NPC card is created in the NPC column pre-populated with the name from the initiative entry, and the initiative entry gains an `npcId` link + a status dot. The form closes. The DM never types the name twice.

Already-promoted entries display differently (warmer border, status dot visible) and tapping them does nothing — they're read-only in the initiative list.

The "×" remove button does NOT expand the promote form — it only removes the initiative entry, and it has its own discrete tap target. The promote tap area is the entire entry row (excluding the × button), which is large enough on mobile.

---

### Add NPC form

At the bottom of the NPC column, a dashed-border form handles manual NPC creation (for creatures not in initiative):

- **Name field** (text) + **HP field** (number, required)
- **Count field** — "Add N of these" input (default 1, max 8). When count > 1, names are auto-suffixed: "Goblin" → "Goblin A", "Goblin B", etc. A hint label confirms this: "Will create: Goblin A, B, C"
- **Add button** spans full width

The multi-add pattern handles the most common DM scenario (adding 4 goblins at session start) in one action.

---

### End Combat

"End Combat" button lives in the **NPC column header** (right-aligned, styled in muted red), not the top nav. Placement rationale: the action is scoped to the NPC tracker, not the whole session. Moving it to the top nav would imply it also clears initiative, party state, or dice history — it doesn't. The confirmation dialog is explicit: "End Combat — Remove all NPC tracking? Initiative and party state are not affected."

---

### "Apply to…" pills in dice roller

After a pure damage roll (no d20), the existing "Apply to…" pill row is extended:
- PC pills appear first (as now), using their character palette accent color
- NPC pills appear after a subtle divider, using the neutral NPC warm-gold style (`#b0a080`)
- NPC pills show the NPC name. If the NPC is dead, its pill is shown with reduced opacity but still tappable (overkill damage is valid in 5e)
- Applying damage to an NPC fires directly without a confirm modal (unlike PCs where it opens the Damage modal pre-filled). NPCs have no "player feels it" sensitivity and the DM wants speed.

---

### Mobile considerations

- The promote-to-NPC tap target is the full initiative row minus the × button — adequate for touch
- NPC card action buttons use the same minimum 12px font and 26px+ tap height as PC cards
- On single-column mobile layout, the NPC section appears between party cards and initiative tracker (party → NPC → initiative), maintaining the "party vs enemy vs turn order" left-to-right mental model even when stacked vertically
- The count input in the Add NPC form is a number input with spinner suppressed — DMs type directly rather than tap-to-increment

---

### Resolved open questions

1. **NPC section placement**: Third column (middle), not below party or alongside initiative. Keeps the layout clean and separates enemy tracking from turn order.
2. **"Apply to…" damage flow**: Direct apply for NPCs, no confirm modal. Speed over consistency — DMs applying damage to NPCs don't need a second confirmation.
3. **Bloodied indicator**: Always-on, not opt-in. It's visual information with no rules weight; hiding it provides no benefit.
4. **Multiple NPC instances**: Auto-suffix when count > 1 (Goblin A/B/C). DM can still name a boss freely by setting count to 1 and using the full name.
5. **Initiative promotion on mobile**: Full row tap target excluding the × button. Large enough — no conflict with Next Turn (which is above the list) or × (which has its own discrete button).

---

## Architect Notes

### Backend: two new Lambda handlers

**Handler files** (follow the exact naming and location pattern of `backend/src/handlers/initiative.js`):

- `backend/src/handlers/getNpcCombat.js`
- `backend/src/handlers/putNpcCombat.js`

Split into two files rather than a single combined handler — this matches the existing convention for DM-only endpoints and keeps the SAM policy grants separate (read-only GET vs. CRUD PUT).

**Handler pattern** — mirror `initiative.js` exactly:

```js
// getNpcCombat.js
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden } = require("../lib/response");

const NPC_COMBAT_SLUG = "npc-combat";

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const result = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { slug: NPC_COMBAT_SLUG },
  }));

  if (!result.Item) return ok({ npcs: [] });
  return ok({ npcs: result.Item.npcs ?? [] });
};
```

```js
// putNpcCombat.js
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { db, TABLE } = require("../lib/db");
const { verifyPassword } = require("../lib/auth");
const { ok, forbidden, badRequest } = require("../lib/response");

const NPC_COMBAT_SLUG = "npc-combat";

exports.handler = async (event) => {
  const password = event.headers?.["x-character-password"] || "";
  const auth = await verifyPassword(password, { passwordHash: "$2b$10$invalid" });
  if (!auth.valid || auth.role !== "dm") return forbidden("DM password required");

  const body = JSON.parse(event.body || "{}");
  if (!Array.isArray(body.npcs)) return badRequest("npcs must be an array");

  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { slug: NPC_COMBAT_SLUG, npcs: body.npcs, updatedAt: new Date().toISOString() },
  }));

  return ok({ success: true });
};
```

**`dmParty.js`**: no changes. The `slug: "npc-combat"` item must be filtered out of the party list endpoint. Verify that `dmParty.js` already filters out items whose `slug` starts with a known sentinel value, or add `slug !== "npc-combat"` alongside the existing `slug !== "initiative"` guard.

---

### `backend/template.yaml` additions

Add two new `AWS::Serverless::Function` resources after `InitiativeFunction`. The GET uses `DynamoDBReadPolicy`; the PUT uses `DynamoDBCrudPolicy`:

```yaml
GetNpcCombatFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/handlers/getNpcCombat.handler
    Events:
      Api:
        Type: HttpApi
        Properties:
          Path: /npc-combat
          Method: get
          ApiId: !Ref CharactersApi
    Policies:
      - DynamoDBReadPolicy:
          TableName: !Ref CharactersTable

PutNpcCombatFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/handlers/putNpcCombat.handler
    Events:
      Api:
        Type: HttpApi
        Properties:
          Path: /npc-combat
          Method: put
          ApiId: !Ref CharactersApi
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref CharactersTable
```

No new DynamoDB tables or S3 buckets required.

---

### `src/api.js` additions

Add two exported functions alongside the existing `getInitiative` / `putInitiative` pair:

```js
export async function getNpcCombat(dmPassword) {
  const res = await fetch(`${API}/npc-combat`, {
    headers: { "x-character-password": dmPassword },
  });
  if (!res.ok) throw { status: res.status };
  return res.json();
}

export async function putNpcCombat(dmPassword, data) {
  const res = await fetch(`${API}/npc-combat`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-character-password": dmPassword,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw { status: res.status };
  return res.json();
}
```

---

### Frontend: state and polling in `DmDashboardPage`

**New state** — add alongside `initiative` in the main `DmDashboardPage` component:

```js
const [npcCombat, setNpcCombat] = useState({ npcs: [] });
```

**Extend the `Promise.all` poll** (lines 1596–1603) to fetch all three sources in one round-trip:

```js
const [partyData, initData, npcData] = await Promise.all([
  getDmParty(dmPassword),
  getInitiative(dmPassword),
  getNpcCombat(dmPassword),
]);
setParty(partyData);
setInitiative(initData);
setNpcCombat(npcData);
```

Also add a `refreshNpcCombat` helper (mirror of the existing `refreshInitiative`) for use after promote and end-combat actions:

```js
async function refreshNpcCombat() {
  try {
    const data = await getNpcCombat(dmPassword);
    setNpcCombat(data);
  } catch (_) {}
}
```

---

### Frontend: three-column layout

**Current** `dm-layout` grid (inline style on the wrapper div, line 1813):

```js
gridTemplateColumns: "1fr 300px"
```

**New**:

```js
gridTemplateColumns: "1fr 320px 300px"
```

Column order in JSX: party column (left) → `NpcCombatSection` (middle) → `InitiativeTracker` (right).

**Responsive CSS** — update the `DASHBOARD_CSS` string at the top of the file. Replace the existing `@media (max-width: 900px)` block with three breakpoints:

```css
/* >1100px: three columns (default inline style above) */

/* 1100px–700px: two columns, NPC below party */
@media (max-width: 1100px) {
  .dm-layout { grid-template-columns: 1fr 300px !important; }
  .dm-npc-col {
    grid-column: 1 / 2;
    border-left: none !important;
    border-top: 1px solid rgba(100,130,160,0.18) !important;
    padding-left: 0 !important;
    padding-top: 20px !important;
    margin-top: 8px !important;
  }
}

/* <700px: single column stack */
@media (max-width: 700px) {
  .dm-layout { grid-template-columns: 1fr !important; }
  .dm-party-col { padding-right: 0 !important; }
  .dm-init-col {
    border-left: none !important;
    border-top: 1px solid rgba(100,130,160,0.18) !important;
    padding-left: 0 !important;
    padding-top: 20px !important;
    margin-top: 20px !important;
  }
  .dm-npc-col {
    border-left: none !important;
    border-top: 1px solid rgba(100,130,160,0.18) !important;
    padding-left: 0 !important;
    padding-top: 20px !important;
    margin-top: 20px !important;
  }
}
```

Remove the old `@media (max-width: 900px)` block entirely — it is superseded.

---

### Frontend: `NpcCombatSection` sub-component

Define `NpcCombatSection` as a function inside `DmDashboardPage.jsx` — not a separate file. This is consistent with `InitiativeTracker` and `CharacterCard` living in the same file.

**Props**:

```js
function NpcCombatSection({ npcCombat, initiative, dmPassword, onUpdate }) { ... }
```

- `npcCombat`: `{ npcs: NPC[] }` from server state
- `initiative`: passed through so the section can read `initiative.entries` + `initiative.activeTurnIndex` to identify which NPC card is the active turn
- `dmPassword`: for `putNpcCombat` calls
- `onUpdate`: callback that triggers `refreshNpcCombat()` (and `refreshInitiative()` when the promote flow writes to both)

**Active-turn glow**: Do NOT use a CSS class name toggled imperatively. Use a conditional inline style on the NPC card `<div>`:

```js
const isActiveTurn = (() => {
  const activeEntry = initiative.entries?.[initiative.activeTurnIndex];
  return activeEntry?.npcId === npc.id;
})();

// Applied to the card border/box-shadow:
border: `1px solid ${isActiveTurn ? "#c0a060" : NPC_BORDER_COLOR}`,
boxShadow: isActiveTurn ? "0 0 0 2px rgba(192,160,96,0.35)" : "none",
```

This is a pure render — no imperative DOM mutation, no extra state, no ref needed. The glow updates automatically when `initiative` changes via polling.

**NPC accent constants** (define at module level, above the component):

```js
const NPC_ACCENT = "#7a7060";
const NPC_BRIGHT = "#b0a080";
const NPC_BORDER_COLOR = "rgba(122,112,96,0.35)";
```

---

### Initiative entry `npcId` field

The `handleAddPC` (line 1198) and `handleAddEntry` (line 1214) functions in `InitiativeTracker` construct new entry objects. Add `npcId: null` as an explicit default to both:

```js
// handleAddPC:
const entry = {
  id: "id" + Date.now() + Math.random().toString(36).slice(2, 6),
  slug: char.slug,
  name: char.name || char.nameAlt || char.slug,
  initiative: isNaN(initNum) ? 0 : initNum,
  isPC: true,
  npcId: null,   // ← add this
};

// handleAddEntry:
const entry = {
  id: "id" + Date.now() + Math.random().toString(36).slice(2, 6),
  name: newName.trim(),
  initiative: isNaN(initNum) ? 0 : initNum,
  isPC: false,
  npcId: null,   // ← add this
};
```

This ensures the field is always present and never `undefined` when serialized to DynamoDB.

---

### Promote flow

Tapping an initiative entry row (NPC entries only, `isPC === false`, `npcId === null`) expands an inline form below the entry. The `InitiativeTracker` component manages which entry is "expanded" with local state:

```js
const [promotingId, setPromotingId] = useState(null); // entry.id | null
const [promoteHpInput, setPromoteHpInput] = useState("");
```

On confirm:
1. Generate a UUID for the new NPC: `const npcId = "npc-" + Date.now() + Math.random().toString(36).slice(2, 6);`
2. Build the NPC object: `{ id: npcId, name: entry.name, hpMax, hpCurrent: hpMax, conditions: [], initiativeEntryId: entry.id }`
3. Call `putNpcCombat(dmPassword, { npcs: [...npcCombat.npcs, newNpc] })` — requires passing `npcCombat` as a prop to `InitiativeTracker`, or lifting the action up to a handler in `DmDashboardPage`.
4. Call `putInitiative(dmPassword, { entries: updatedEntries, activeTurnIndex: ... })` to stamp `npcId` onto the entry.
5. Call `onUpdate()` to trigger both `refreshNpcCombat` + `refreshInitiative`.

The cleanest approach is to pass an `onPromoteToNpc(entryId, hpMax)` callback from `DmDashboardPage` down to `InitiativeTracker`. The callback owns both the `putNpcCombat` + `putInitiative` writes and the subsequent refresh. This keeps `InitiativeTracker` free of NPC state knowledge.

---

### `DmDiceRoller.jsx`: extending "Apply to…"

**Current signature**: `onApplyDamage(slug, amount)` — opens the DamageHealModal on the matching `CharacterCard`.

**Recommended approach**: keep one callback, extend its signature to `onApplyDamage(targetId, amount, isNPC)`.

- For PCs (`isNPC === false`): behavior unchanged — `targetId` is the `slug`, opens the modal.
- For NPCs (`isNPC === true`): `targetId` is the NPC `id`; apply damage directly (no modal) via `putNpcCombat` with the updated `hpCurrent`. This direct-apply path should be in a handler in `DmDashboardPage` (or passed as a second callback) since it needs access to `npcCombat` state and `dmPassword`.

**Alternative** — two callbacks: `onApplyDamage(slug, amount)` (existing, unchanged) + `onApplyNpcDamage(npcId, amount)` (new). This avoids touching the existing PC path entirely, at the cost of one extra prop. Given the different call sites (PC opens modal; NPC applies directly), two callbacks is actually cleaner and safer — it avoids a conditional branch inside `DmDiceRoller`. **Prefer two separate callbacks.**

**`DmDiceRoller` prop additions**:

```js
// Props: { pal, party, npcs, onApplyDamage, onApplyNpcDamage }
// npcs: [{ id, name, hpCurrent }]  — hpCurrent used to show dead-pill opacity
```

NPC pills render after a `<hr>`-style divider in the "Apply to…" row. If `npcs` is empty or undefined, the divider and NPC pills are omitted entirely (no layout shift during non-combat sessions).

Dead NPC pills (`hpCurrent <= 0`) render at 45% opacity but remain tappable — overkill damage is valid.

---

### End Combat data flow

The "End Combat" button lives in `NpcCombatSection`'s column header. It triggers a `ConfirmDialog` (reuse the existing component in the file) with message: _"End Combat — Remove all NPC tracking? Initiative and party state are not affected."_

On confirm:
1. `await putNpcCombat(dmPassword, { npcs: [] })`
2. `setNpcCombat({ npcs: [] })` — local optimistic clear (no need to wait for the next poll)
3. Do NOT call `putInitiative` or touch party state.

The handler lives in `DmDashboardPage` and is passed as `onEndCombat` prop to `NpcCombatSection`.

---

### `dmParty.js` — filter guard

Verify that `backend/src/handlers/dmParty.js` filters the `slug: "npc-combat"` sentinel item out of the party list. The existing code already filters `slug: "initiative"`. Add `slug !== "npc-combat"` to the same filter predicate. This prevents the NPC combat item from appearing in the party column if the DynamoDB scan ever returns it.

---

### Cost / performance

Adding `GET /npc-combat` to the existing 2-second `Promise.all` poll adds one Lambda invocation + one DynamoDB point-read per cycle. At a 4-hour session: ~7,200 additional Lambda invocations and ~7,200 DynamoDB reads. Lambda free tier is 1M invocations/month; DynamoDB free tier is 25 GB storage + 200M requests/month. This feature's incremental cost is negligible — well within free tier at any realistic usage volume.
