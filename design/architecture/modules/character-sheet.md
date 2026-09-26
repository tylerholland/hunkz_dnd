# Character sheets

Read for sheet state, inventory, session controls, stats, or dice work.

- `src/components/CharacterSheet.jsx` orchestrates auth, save/create/import/export, and session state. Rendering is split under `src/features/characterSheet/`; inspect the relevant view/edit/session component rather than treating the orchestrator as a monolith.
- `src/pages/CharacterModePage.jsx` fetches mode-routed character data; `CharacterPage.jsx` handles the standard sheet route. Session mode shares live data and map behavior with other pages.
- `constants.js` owns `BLANK_CHARACTER`, `MOD_ATTRIBUTES`, and `parseModInt`. Update defaults for new character fields. Strict parsing must reject dice strings such as `1d8` as integers. Ability modifiers and item bonuses are computed, not persisted as duplicate derived stats.
- Inventory bonuses depend on equipped/attuned state. Preserve legacy defaults (missing `equipped` means equipped), quantities, and existing write semantics. Inspect current item calculations and editor before changing the data shape.
- Session controls use `patchSession`; character-profile editing has a separate auth/save flow. Player notes and DM notes have different read visibility and write contracts. Check backend validation and shared projections when introducing fields.
- `src/components/DiceRoller.jsx` exports shared dice helpers used by `DmDiceRoller.jsx`. Preserve shared roll reporting and responsive local feedback.
- Keep optimistic edits stable during polling and recover visibly from failed writes. Preserve existing `sessionStorage` keys/defaults; per-character keys generally include the slug.

Search [frontend reference](../frontend-reference.md) for exact components/storage keys and [data model](../data-model.md) for stored shapes. For map work also read [map notes](maps.md); for fetching/auth visibility read [sync](realtime.md) and [backend](backend.md).
