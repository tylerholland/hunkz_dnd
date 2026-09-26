# Maps and tokens

Read for map viewing, token rendering/movement, placement, calibration, or rotation.

- `src/features/maps/MapViewer.jsx` owns pan/zoom and image transforms. `src/features/dmDashboard/MapPanel.jsx` coordinates DM placement and map writes. Shared token rendering (`TokenChip`, `HeldTokenFloater`) lives in `battleMode/BattleModeController.jsx` under the DM dashboard feature.
- Player map behavior is composed in `CharacterSheetSessionMode.jsx`. Shared token changes need both DM and player paths checked: DM placement and player own-token dragging have different permissions and interaction state.
- Persist positions as fractions of natural image coordinates. Convert rotated visual coordinates back before writing. Preserve counter-rotation so token portraits/labels remain upright; transform order matters.
- Distinguish map-wide `tokenScale` from per-token `scale`. Preserve defaults and normalization for old records; inspect current validation ranges before changing controls.
- Suppress map panning during token drag, preserve Pointer Events cleanup, and retain optimistic movement with recovery on failure. Map-wide state changes must preserve unrelated tokens and map fields.
- DM writes use `patchMapTokens` and map-specific APIs; player own-token movement uses `moveMapToken`, whose handler validates token type and matching source slug. Do not replace these with a generic unrestricted write.
- Token effects, status symbology, animation, and labels share visual space. Inspect relevant `battleMode/` helpers and CSS before changing transforms or layers. Preserve reduced-motion behavior.

Search [frontend reference](../frontend-reference.md) and [backend reference](../backend-reference.md) by component/handler. Consult only the relevant token/map brief or story when it explains a non-obvious constraint.
