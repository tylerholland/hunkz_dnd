# Feature Story: Adventure Breakpoints — Retroactive Chapter Marks

**Status**: Approved — Ready to Build (model revised per DM 2026-07-16)
**Source**: DM priority list 2026-07-16 (#3), revised by DM

---

## Goal

Play flows continuously — there is **no "begin adventure" action**. When an arc concludes, the DM marks an **adventure end**, which retroactively bounds the chapter as "everything since the last breakpoint" (or campaign start), names it, archives its transient state, and resets the live surfaces. The result is a browsable chapter log of the journey.

## Why

Arcs are only obvious in hindsight. A retroactive mark matches real play: no ceremony up front, no forgotten "begin" clicks, and the DM gets a clean slate plus a named chapter record at the natural pause. Because each breakpoint clears the transient feeds, the current chapter's history is always exactly "what's in the feeds right now" — the model enforces itself.

## Model

- **Sentinel** `slug: "campaign-log"`: `{ adventures: [{ id, name, endedAt, startedAt (= previous chapter's endedAt, or null for the first), summary?, snapshot }] }`. No `activeAdventure` — the open chapter is implicit.
- **Mark Adventure End** (DM dashboard, All Actions menu): opens a confirm dialog with:
  - Name input, prefilled `Chapter N` (renameable later — naming is retroactive labeling, not a commitment)
  - Optional one-line summary (also editable later)
  - A checklist of exactly what will be archived and reset (below)
  - **"Party Long Rest on close"** as a secondary option in the dialog (per DM), default off
- **Archived into `snapshot`**: the roll-history feed (capped at last 200 entries — this IS the chapter's activity log, including wheel events and map events), counter wheels (names + fill), final initiative round, party XP/level/HP totals at close, and the list of maps activated during the chapter (derived from map events in the feed).
- **Reset**: roll-history feed cleared, counter wheels cleared, initiative cleared (round → 1), **NPC combat / active NPC listing cleared** (per DM).
- **Untouched**: characters (HP, inventory, XP — the party keeps what it earned), map library and active map, NPC library, talent codex, party roster.
- **Feed marker**: after reset, append a `type: "adventure"` entry to the fresh feed — `⚑ "The Sunless Citadel" — concluded` — so the new chapter opens with a visible seam.
- **Map activations join the log**: `putMapActive` now also appends a `type: "map"` entry to the roll-history feed (`🗺 <map name> set active`, or `map cleared`). Rendered by `RollHistoryList` like the existing `type: "wheel"` entries. This makes chapters capture which maps were used — deliberate groundwork for the future summarizer.
- **Campaign Log view** (v1, DM-only): All Actions → "Campaign Log" modal listing chapters newest-first — name (inline-editable), date range, XP gained, summary (inline-editable). Player-visible read-only version is a later story.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- Handlers: `GET /campaign-log` (DM), `PUT /campaign-log` (DM) following the sentinel trio pattern (`specialItems.js` constants + `RESERVED_CHARACTER_SLUGS` + `specialRecords.js` normalizers that pass through all fields explicitly).
- Mark-end is client-orchestrated, **snapshot-first**: read current feeds → PUT campaign-log with the new chapter appended → then issue the existing clear writes (roll history, wheels, initiative, npc-combat). A failure after snapshot never loses data; a failure before it aborts with the dialog still open.
- `putMapActive` change is backend-side: append the feed entry inside the handler, mirroring how the counter-wheels PUT appends `type: "wheel"` events.
- Snapshot size: DynamoDB item cap is 400KB — cap the archived feed at 200 entries, truncate oldest-first, validate size before write.
- Reuse `ConfirmDialog`; the chapter list modal can be single-pane, cribbing Enemies Gallery list styling at reduced scope.
- **Tests**: normalizer round-trip; snapshot-first ordering (mock a failing clear, assert the chapter persisted); map-event append; feed marker rendering.
- **Update** CLAUDE.md (sentinel, endpoints, roll-history entry types) and app-overview.

## Decisions from DM review (2026-07-16)

- No begin action — chapters are bounded retroactively at end-marks; future LLM summarizer can propose the name.
- Long Rest: offered as a secondary option in the end dialog, default off.
- Boundary clears the active NPC listing in addition to feeds/wheels/initiative ("not sure what else" — the reset list above is the full set; anything missed can be added when noticed in play).
- Active map: kept. Players don't see the Campaign Log yet (follow-up story).

## Future story (not this one)

**LLM chapter summarizer**: an assistant call reads the chapter snapshot — roll log, wheel events, map activations — and proposes a chapter name + summary the DM can accept or edit. The map-event logging added here exists to feed it.

## Out of Scope (v1)

- The LLM summarizer, player-visible log, multiple campaigns/rosters, XP-per-adventure analytics, log export.
