# Feature Story: Adventure Breakpoints — Begin & End an Arc

**Status**: Draft — model decisions proposed below need DM sign-off before build
**Source**: DM priority list 2026-07-16 (#3)

---

## Goal

Give the campaign explicit chapter boundaries. The DM can **begin an adventure** (named arc) and later **end** it; ending archives that arc's transient state and resets the live surfaces, leaving a browsable record of the journey.

## Why

Right now the campaign is one endless session: roll history grows forever, counter wheels linger, and there's no marker for "that was the Sunless Citadel arc." Breakpoints give the table a sense of progression and give the DM a clean slate without manually clearing five panels.

## Proposed model (terminology: a *campaign* is the whole series; an *adventure* is one arc)

- **Sentinel** `slug: "campaign-log"`: `{ activeAdventure: { id, name, startedAt } | null, adventures: [{ id, name, startedAt, endedAt, summary?, snapshot }] }`.
- **Begin Adventure** (DM dashboard, All Actions menu): name input → sets `activeAdventure`; appends a `type: "adventure"` marker entry to the roll-history feed ("⚑ The Sunless Citadel — begun").
- **End Adventure**: confirm dialog listing exactly what will happen:
  - **Archived into the adventure's `snapshot`**: final roll-history entries (count + the feed itself, capped), counter wheels (names + fill state), initiative round count, party XP/level/HP totals at close, active map name.
  - **Reset**: roll-history feed cleared, counter wheels cleared, initiative cleared (round → 1), NPC combat cleared.
  - **Untouched**: characters (HP, inventory, XP — the party keeps what it earned), maps, NPC library, talent codex, party roster.
- **Between adventures** (`activeAdventure: null`): everything works exactly as today — breakpoints are optional structure, not a gate.
- **Journey view** (small v1): a "Campaign Log" entry in the DM All Actions menu opens a simple modal listing past adventures (name, dates, XP gained, one-line summary the DM can edit). Player-visible read-only version can wait.

## Architect Notes (preliminary)

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- Handlers: `GET /campaign-log` (DM), `PUT /campaign-log` (DM) following the sentinel trio pattern (`specialItems.js` + `specialRecords.js` + `RESERVED_CHARACTER_SLUGS`). End-adventure is client-orchestrated: read current state, write snapshot into campaign-log, then issue the existing clear writes (roll history, wheels, initiative, npc-combat) — no new atomic multi-item transaction needed at this trust level, but order the writes snapshot-first so a failure never loses data.
- Snapshot size: cap archived roll feed at the last 200 entries; DynamoDB item limit is 400KB — validate size before write and truncate oldest-first.
- Reuse `ConfirmDialog`; marker entries render in `RollHistoryList` like the existing `type: "wheel"` entries.

## Open questions for the DM

1. Should ending an adventure also prompt a party-wide Long Rest? (Proposed: no — offer it as a checkbox in the confirm dialog, default off.)
2. Should players see the Campaign Log? (Proposed: later story.)
3. Anything else that should reset at a boundary — active map? (Proposed: keep active map.)

## Out of Scope (v1)

- Multiple simultaneous campaigns/rosters, XP-per-adventure analytics, exporting logs.
