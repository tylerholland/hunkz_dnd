# Feature Story: Campaign Settings — DM Admin Page

**Status**: Approved — Ready to Build (after Stories 37, 39, 40 land; section list confirmed by DM except where flagged)
**Source**: DM request 2026-07-16

---

## Goal

A dedicated DM-only admin page at `/dm/settings` that collects campaign-level configuration and administration in one place, instead of scattering it across modals and the All Actions menu. Launch sections: **House Rules (dice defaults)**, **Talent Codex**, **Campaign Log** (including dissolving a breakpoint), **Party Visibility**, **Backup**, and a **Danger Zone**.

## Why

DM-level controls are accreting: party visibility hides inside Manage Party, the codex and galleries live in modals, text scale in a dropdown, and nothing manages house rules at all — the 2d6 ability check is hardcoded. One admin surface makes the app's "table rules" explicit, editable, and findable, and gives future config (push notifications, sync settings) an obvious home.

## Sections (v1)

### 1. House Rules — dice defaults
- New sentinel `slug: "house-rules"`:
  ```js
  {
    abilityCheck: { formula: "2d6" | "1d20", advExtraDie: true },   // current house rule: 2d6, adv rolls a 3rd d6 keep best two
    damageCrit:   { rule: "double-dice" | "max-plus-roll" | "none" },
    deathSave:    { formula: "1d20", successAt: 10, nat20Heals: true, nat1Double: true },
  }
  ```
- UI: one card per rule with segmented toggles / small numeric inputs and a plain-language preview line ("Ability checks roll **2d6 + modifier**; advantage rolls a third d6 and keeps the best two").
- **Consumed by**: `DiceRoller` ability-check circles and session-mode stat chips (replace the hardcoded 2d6 logic with config); death-save shortcut semantics on the DM card (NAT20/NAT1 behavior) read from config. Where a surface doesn't exist yet (e.g. an auto-rolled death save button for players), the config is stored now and consumed when that surface arrives.
- `GET /house-rules` is public (players' dice rollers need it); `PUT /house-rules` is DM-only. Mount-fetch + refetch-on-write, not polled.

### 2. Talent Codex
- Embeds the codex editor from Story 39 as a page section (the Story 39 modal component should be written embed-friendly: same component, `asPage` prop — the `MapLibraryModal` precedent). All Actions shortcut remains.

### 3. Campaign Log
- The chapter list from Story 40 (rename, edit summaries) lives here permanently.
- **Dissolve breakpoint** (per DM): only the **most recent** chapter can be dissolved — its archived feed entries merge back into the live roll history (sorted by timestamp, so anything rolled since the mark is kept), wheels/initiative/NPC snapshot restored only where the live surface is still empty, then the chapter record is deleted. Restore-first ordering (inverse of snapshot-first): a failure never loses the archive. Two-step confirm.

### 4. Party Visibility
- The "Allow players to see party HP and conditions" toggle (currently buried in Manage Party) gets a top-level card here. Stays in Manage Party too — same field, two doors.

### 5. Backup
- **Download campaign backup**: one button producing a JSON file of all characters + all sentinel records (initiative, npc-combat, roll-history, map-library, party-roster, npc-library, counter-wheels, campaign-log, talent-codex, house-rules). Client-side assembly from existing GETs is acceptable v1; no restore/import yet (dangerous — future story with dry-run diff).

### 6. Danger Zone (bottom, red-bordered per destructive idiom)
- Clear roll history · Reset all counter wheels · Clear initiative · Clear NPC listing — each with the existing `ConfirmDialog`. These are the manual versions of what an adventure end-mark does, for when the DM wants one lever, not the breakpoint.

## UX Design

- Route `/dm/settings`, DM auth gate identical to `/maps` (`DmLoginPrompt` if no stored credential). Entry points: DM standard menu (Story 37 nav) and All Actions.
- Layout: single scroll column of cards (max-width 720px), Cinzel section headers, campaign Ocean chrome — this is a management page like `/maps`, not a live surface: one-shot fetch on mount, no polling.
- Each card saves independently with the optimistic + rollback idiom; saved-flash confirmation per card (Enemies Gallery `✓ Saved` pattern).
- Mobile: cards stack full-width; Danger Zone buttons never sit adjacent to non-destructive buttons.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- New page `src/pages/CampaignSettingsPage.jsx` + route in `App.jsx`; uses shared `TopNav` (Story 37).
- `house-rules` follows the sentinel trio pattern (`specialItems.js`, `RESERVED_CHARACTER_SLUGS`, `specialRecords.js` normalizer with explicit field pass-through + defaults matching today's hardcoded behavior, so an absent sentinel changes nothing).
- Dice-default consumption: extract the ability-check roll construction in `DiceRoller.jsx` into a pure helper taking the config; session-mode chips call the same helper. Default config must reproduce current behavior bit-for-bit (tests assert this).
- Dissolve: client-orchestrated inverse of Story 40's mark-end; reuse its read/write helpers.
- Backup: a `buildCampaignBackup()` helper in `src/lib/` calling existing API getters with the DM password; download via Blob URL. No new backend.
- **Dependencies**: Story 37 (nav), 39 (codex component), 40 (campaign log + dissolve target). House Rules, Party Visibility, Backup, and Danger Zone have no dependencies and could ship first if this story is split.
- **Tests**: house-rules normalizer defaults; helper parity with current 2d6 behavior under default config; dissolve restore-first ordering; backup includes every sentinel.
- **Update** CLAUDE.md (route, sentinel, endpoints) and app-overview (new page section).

## Open items for DM

- Death-save config granularity: is `successAt` threshold + nat-20/nat-1 toggles enough, or do death saves use a different die entirely in your system?
- Anything else for v2: text-scale relocation, Web Push / notification settings (future), restore-from-backup (future).

## Out of Scope (v1)

- Restore/import of backups, multi-campaign switching, per-player permission tiers, LLM summarizer settings.
