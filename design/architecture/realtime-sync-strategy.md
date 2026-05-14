# Realtime Sync Strategy for DM Dashboard

## Context

The current DM dashboard sync model is functional, but chatty:

- the active dashboard polls once per second when the tab is focused
- each poll fans out into multiple API requests
- current read endpoints include:
  - `GET /dm/party`
  - `GET /initiative`
  - `GET /npc-combat`
  - `GET /roll-history`
  - `GET /maps`

In the browser, this produces repeated fetches for small payloads and also repeated CORS preflights because requests use non-simple headers such as `x-character-password`.

This is acceptable for a small internal tool, but it is not the most efficient or scalable approach for near-real-time sync.

## Key Observations

### 1. The inefficiency is on the read side, not the write side

The current mutation API is already reasonably separated by domain:

- character session updates
- initiative updates
- NPC combat updates
- roll submissions
- map state updates

That separation is useful and should generally be preserved.

The current inefficiency is that one page reconstructs a single live dashboard view by polling several independent endpoints on a fixed cadence.

### 2. Polling everything every second is wasteful

The dashboard currently treats all domains as if they need equal freshness:

- party/session
- initiative
- NPC combat
- roll history
- maps

In practice:

- initiative and NPC combat are hot state
- roll history is also effectively hot state
- maps need immediate propagation when the DM changes active map/view
- map library contents are relatively cold

Polling all five domains every second is therefore a poor approximation of realtime behavior.

### 3. The current request count is not a React problem

Large request counts seen in local dev are partly explained by Vite dev-server behavior, but the repeated API traffic is real and is primarily caused by the polling strategy.

This is not a case of React repeatedly fetching JSX in production.

In production:

- JSX/modules should be bundled and loaded once per page load
- the real network issue is API polling and preflight overhead

### 4. This app is a good fit for push-based sync

Product requirements strongly favor event-driven updates:

- DM needs near-instant roll visibility
- players need near-instant map changes
- initiative and NPC combat changes should feel immediate
- actual activity should drive updates instead of timer-based approximation

This is the clearest reason to move toward WebSocket-based sync.

## Recommended Target Architecture

Use a hybrid model:

- keep distinct mutation endpoints
- add consolidated snapshot endpoints for hydration/recovery
- add WebSocket push for live incremental updates
- demote polling to fallback/recovery behavior

This combines:

- efficient initial load
- efficient incremental sync
- maintainable backend domain boundaries
- simpler client reconciliation

## API Design Recommendation

### Keep write endpoints distinct

The existing write API shape is good for commands and should generally remain domain-specific.

Examples:

- `PATCH /characters/{slug}/session`
- `PATCH /characters/{slug}/dm-notes`
- `PUT /initiative`
- `PUT /npc-combat`
- `PUT /maps/active`
- `PUT /maps/view`
- `POST /characters/{slug}/rolls`

These endpoints express intent clearly and map well to ownership boundaries.

### Consolidate read endpoints for snapshot hydration

Add a single snapshot endpoint for the DM dashboard:

- `GET /dm/dashboard`

Suggested response:

- `party`
- `initiative`
- `npcCombat`
- `rollHistory`
- `mapLibrary`
- `versions` by domain

Example shape:

```json
{
  "party": [],
  "initiative": { "entries": [], "activeTurnIndex": 0 },
  "npcCombat": { "npcs": [] },
  "rollHistory": { "rolls": [] },
  "mapLibrary": { "activeMapId": null, "activeMapView": null, "maps": [] },
  "versions": {
    "party": 128,
    "initiative": 42,
    "npcCombat": 73,
    "rollHistory": 301,
    "maps": 19
  }
}
```

Similarly, the player-facing experience can have its own snapshot endpoint with only player-visible data.

### Why not collapse writes too?

Because the write side is not the current pain point, and collapsing writes into one giant endpoint would reduce clarity without solving the underlying realtime issue.

The better split is:

- separate commands
- consolidated snapshots
- granular live events

## Realtime Transport Recommendation

### Preferred client-facing transport: WebSockets

Given the current stack:

- AWS SAM
- API Gateway HTTP API
- Lambda
- DynamoDB

The most natural realtime fit is:

- API Gateway WebSocket API
- Lambda connect/disconnect/message handlers
- DynamoDB-backed connection registry
- existing mutation handlers publish websocket events after successful writes

Why WebSockets over more polling:

- better fit for frequent small updates
- actual activity drives sync
- reduces repeated requests and preflights
- improves map, initiative, NPC, and roll-history responsiveness

### Why not SSE first?

SSE can work, but in this stack WebSockets are usually a better long-term fit for session-aware realtime behavior and future flexibility.

### Why not EventBridge/SNS first?

Internal pub/sub can be added later if needed, but it is not required to achieve the product win.

At the current scale, the simplest useful model is:

- mutation Lambda writes domain state
- mutation Lambda directly publishes websocket events

Introduce internal fanout infrastructure only if future needs justify it:

- analytics consumers
- workflow consumers
- audit/event replay pipelines
- multiple independent subscribers

## Event Model Recommendation

Use granular domain events rather than full refresh pushes.

Suggested event types:

- `party.character.updated`
- `party.roster.updated`
- `initiative.updated`
- `npcCombat.updated`
- `rollHistory.appended`
- `map.active.updated`
- `map.view.updated`
- `map.library.updated`

Suggested event shape:

```json
{
  "type": "initiative.updated",
  "version": 42,
  "payload": {
    "entries": [],
    "activeTurnIndex": 0
  }
}
```

Each event should include:

- `type`
- room/campaign identity
- domain version
- payload

## Versioning and Consistency

Per-domain versioning is strongly recommended.

Why:

- clients can ignore stale events
- clients can detect dropped events
- reconnect logic becomes deterministic
- optimistic UI reconciliation becomes simpler

Suggested domains:

- `party`
- `initiative`
- `npcCombat`
- `rollHistory`
- `maps`

Each successful mutation increments the relevant domain version.

Snapshot responses and websocket events both carry those versions.

## Auth and Session Recommendation

The current browser API calls use `x-character-password`, which contributes to CORS preflights and is also not ideal as a long-lived client identity model.

Recommended direction:

1. keep password verification over HTTPS
2. mint a short-lived session token after verification
3. use that token for websocket connection/auth
4. store connection metadata:
   - role (`dm` or `player`)
   - player character slug when relevant
   - room/campaign membership
   - token expiry

This improves:

- security posture
- future extensibility
- browser behavior
- websocket authentication clarity

## Channel / Audience Model

Assume a single campaign room unless future requirements demand more.

Example:

- room: `campaign:default`

Participants:

- DM joins the room
- players join the room

Server decides which events each role can receive.

Examples:

- DM receives all dashboard-relevant events
- player receives player-visible state changes
- player does not receive DM-only data such as private notes or hidden NPC management state

## Client State Model Recommendation

The client should operate in this order:

1. fetch snapshot once on page load
2. open websocket connection
3. subscribe to room/campaign updates
4. apply incoming events directly to local state slices
5. refetch snapshot only on reconnect or version-gap detection

This is cleaner than:

- repeated page-wide polling
- full refresh on every change
- component-level ad hoc fetching

## Map Sync Notes

Maps are a special case because product expectations are realtime for active map changes.

Important distinction:

- players need immediate updates when the DM changes active map or published map view
- the DM dashboard does not necessarily need to subscribe to every player-local pan/zoom interaction if those are not shared

Recommended map events:

- `map.active.updated`
- `map.view.updated`
- `map.library.updated`

This preserves immediacy where it matters without forcing unnecessary chatter.

## Roll History Notes

Roll history is also a strong realtime candidate.

Recommended event:

- `rollHistory.appended`

This is better than frequent polling because the user expectation is that rolls appear essentially immediately after they happen.

## Recommended End State

### DM Dashboard

- one snapshot fetch on page load
- websocket subscription for incremental updates
- rare recovery fetch on reconnect / version mismatch

### Player View

- one snapshot fetch on page load
- websocket subscription for incremental updates
- rare recovery fetch on reconnect / version mismatch

### Backend

- separate domain mutation handlers
- consolidated snapshot read model(s)
- websocket broadcaster

## Migration Direction

This note is intentionally not a step-by-step implementation plan, but the migration order should conceptually be:

1. consolidated snapshot endpoint(s)
2. per-domain versioning
3. websocket infrastructure
4. mutation-triggered event publish
5. client subscription and incremental reducers
6. reduce polling to fallback only

## Summary

Best recommendation:

- do not collapse the mutation API into one monolith
- do consolidate snapshot reads
- do adopt WebSocket-based push for realtime updates
- do retain polling only as fallback/recovery

This is the best fit for:

- the current product needs
- the existing AWS/Lambda/DynamoDB stack
- the current domain model already present in the app
