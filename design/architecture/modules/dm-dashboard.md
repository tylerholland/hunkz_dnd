# DM dashboard

Read for party cards, initiative, NPC combat, notes, or counter wheels.

- `src/pages/DmDashboardPage.jsx` owns dashboard data and coordinates writes. Live state comes through consolidated session polling; avoid adding a second poller for a new resource.
- `src/features/dmDashboard/CharacterCard.jsx` is the card shell. Focused UI lives in `characterCard/`, including death saves, damage/heal, notes, XP, and coin modals. Preserve exported compatibility paths used by the dashboard.
- HP updates are optimistic/debounced. Preserve pending-write protection, active-turn visuals, temp HP, death saves, and failure recovery when changing cards.
- Death-save transitions affect both card styling and persisted session state. Inspect `DeathSavesStrip.jsx` and its callers together; recovery and damage-at-zero flows must remain consistent.
- NPC library templates and active NPC combat instances are distinct. Template changes must not silently rewrite active combat state. Counter wheels are persistent session tools and are not cleared by End Combat.
- DM notes are private; shared player notes have their own projection rules. Use shared backend projections rather than adding fields separately to polling and one-shot responses.
- `DmDiceRoller.jsx` reuses player dice helpers and supports applying rolled damage to party members; preserve that integration when changing HP actions.

Use [map notes](maps.md) for MapPanel/token work, [backend notes](backend.md) for persistence, and search the [frontend reference](../frontend-reference.md) or [product overview](../../app-overview.md) for the specific affected feature.
