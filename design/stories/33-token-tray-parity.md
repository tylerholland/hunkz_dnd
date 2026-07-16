# Feature Story: Token Tray Parity — Avatars, Hover Card, and Card Highlight

**Status**: Ready for Architect Notes
**Source**: DM feedback

---

## Goal

Battle Mode tokens behave inconsistently depending on whether they're placed on the map or still sitting in the unplaced tray below it. An NPC token shows its uploaded portrait once placed on the map, but drops back to a plain initials circle while it's in the tray — the same NPC looks like two different tokens depending on placement state. Separately, hovering a token gives useful context (a preview card on the map; nothing but a bare browser tooltip in the tray), and hovering a token anywhere does not surface the matching character or NPC card in the party/initiative list, which would help the DM quickly connect a token to its full card during a busy combat.

This story closes all three gaps so a token — PC or NPC, on the map or in the tray — looks and behaves the same everywhere it appears.

## User stories

1. As the DM, I want an NPC's tray chip to show its uploaded portrait (not just initials) so the same NPC is recognizable whether it's placed or still waiting in the tray.

2. As the DM, I want hovering a tray chip to show the same preview card (name, HP, conditions) that hovering an on-map token shows, so I don't have to place a token just to check its status.

3. As the DM, I want hovering any token — on the map or in the tray, PC or NPC — to highlight that character's or NPC's card in the party column or initiative list, so I can immediately spot which card corresponds to the token I'm looking at.

## Scope

- **NPC tray portrait**: `TokenTray.jsx`'s NPC-chip branch (the `unplacedNpcs.map` block) currently only ever renders the `tray-chip__initial` circle. Mirror the PC-chip branch immediately above it, which already checks `member.portraitUrl` and renders a `tray-chip__portrait` `<img>` with an initials fallback — give the NPC branch the same `npc.portraitUrl` check, `onError` fallback to initials, matching the pattern `TokenChip` already uses on the map.
- **Tray hover card**: on the map, `TokenChip` has its own hover-expand behavior (mouse-enter delay, then an expanded card showing name/HP/conditions). Tray chips currently have only a native `title` attribute. Extend tray chips to trigger the same style of preview card on hover — reusing `TokenChip`'s expanded-card rendering rather than building a second implementation, if the component can be adapted to render token-preview content without requiring map-relative positioning.
- **Cross-component card highlight**: this is new — there is currently no hover-linking mechanism anywhere between a token (map or tray) and its corresponding party card or NPC card. Hovering a token (of either placement state, either type) needs to visually highlight the matching card (existing `.dm-active-turn`-style highlight treatment, or similar, on `CharacterCard`/`NpcCard`). This requires lifting hover state up to a shared ancestor (likely `MapPanel.jsx` or `DmDashboardPrototypePage.jsx`, since party cards, NPC cards, and the map/tray are siblings) so a hovered token's `sourceId`/`npc.id` can be compared against each card's own id to decide whether to apply the highlight.
- Player-side (`PlayerMapViewer`) is unaffected — players have no token interaction, on-map or in-tray, per existing scope boundaries.

## Out of scope

- Highlighting a token when hovering the reverse direction (hovering a party/NPC card to highlight its token) — this story is token→card only.
- Any change to the on-map `TokenChip` hover-expand card's own content or timing.
- Any change to tray placement/selection logic (`onSelect`, held-token state machine) — this story is purely about hover/visual parity, not interaction.

## Open questions

1. **Highlight mechanism**: should the card highlight use the same visual treatment as the existing active-turn highlight (`.dm-active-turn`), or a distinct "hovered" style so it's not confused with whose turn it is? These can coexist (a card could be both the active turn and hovered) so they likely need visually distinct treatments.
2. **Tray hover-card positioning**: the on-map hover card is presumably positioned relative to the token's map coordinates. Tray chips sit in a horizontal strip with different layout constraints — confirm whether the existing hover-card component can be reused as-is with different positioning logic, or needs a layout-aware variant.
