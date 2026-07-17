# Feature Story: Talent Codex — Rich Ability/Spell/Skill Library

**Status**: Approved — Ready to Build (assumptions flagged below; confirm with DM if any feel wrong)
**Source**: DM priority list 2026-07-16 (#2)

---

## Goal

Replace the `Type: Name` tooltips with DM-authored rich descriptions. A **Talent Codex** — a DM-managed library of entries for skills, spells, and special abilities — feeds tooltips on player sheets, DM party cards, and session mode. Managed from an admin surface following the Enemies Gallery pattern.

## Why

Badges without content are decoration. This is a homebrew system (2d6 checks), so licensed SRD content is the wrong direction — the DM's own rulings are the canon, and they need one place to write them down that every surface reads from.

## UX Design

- **Codex entry**: `{ name, type: "skill" | "spell" | "specialAbility", description (markdown-lite: bold/italic/lists, same mini-renderer rules as World Guide), tags?: string[] }`.
- **Tooltip upgrade**: everywhere a skill/spell/special-ability badge currently shows `Type: Name`, it now shows name (Cinzel small-caps), type label (muted), and the description body (Crimson Text 14px, max-width 300px, scroll past 240px height). Entries missing from the codex fall back to today's `Type: Name`. Same hover/focus/tap interaction as current badges.
- **Admin surface — "Talent Codex" modal**: clone the Enemies Gallery interaction pattern (two-pane: list rail + entry editor; mobile drill-in at 720px). List rail groups by type with a filter input. Editor: name, type select, description textarea, tags input. Duplicate, two-step delete, dirty guard — all per Enemies Gallery. Entry point: DM dashboard `All Actions` menu, "⚛ Talent Codex" (pick an appropriate glyph consistent with ⚙ Enemies Gallery).
- **Matching**: tooltips look up by case-insensitive name + type. A small "not in codex" pencil affordance appears on unmatched badges **for the DM only**, deep-linking into the codex editor with name/type pre-filled.

## Architect Notes

- **Graph orientation**: `graphify-out/graph.json` exists — run `graphify query` before reading source.
- **Backend**: new sentinel `slug: "talent-codex"`, shape `{ entries: [{ id, name, type, description, tags, updatedAt }] }`. Handlers mirror the NPC library trio: `GET /talent-codex` (**no auth** — players need tooltip content; it contains nothing secret), `PUT /talent-codex` (DM auth, full-array replace, validate `Array.isArray(entries)` + per-entry name/type). Add slug to `specialItems.js` constants + `RESERVED_CHARACTER_SLUGS`; add `getTalentCodexState`/`saveTalentCodexState`/`normalizeTalentCodexRecord` to `specialRecords.js` (copy the NPC library normalizer discipline — pass through all fields explicitly).
- **Fetch pattern**: mount-fetch + refetch-on-write, NOT polled (ADR-011 opt-out, same rationale as NPC library). Player sheets fetch once on mount.
- **Frontend**: `src/api.js` `getTalentCodex()` / `putTalentCodex(dmPassword, entries)`. New `src/features/talentCodex/TalentCodexModal.jsx` + CSS (prefix `tc-`), cribbing structure from `EnemiesGalleryModal.jsx`. Tooltip component: extend the existing badge tooltip in `CharacterSheetViewMode.jsx` / dashboard badges to accept description content — check `talentCatalog.js` first: if a static catalog already exists there, the codex supersedes it; merge codex-over-catalog so existing static entries remain as defaults.
- **Description rendering**: reuse the World Guide's hand-written markdown mini-renderer (`renderInlineMarkdown`/`renderMarkdown` in `WorldGuideDrawer.jsx`) — export it to a shared module rather than duplicating.
- **Tests**: normalizer round-trip, PUT validation, tooltip fallback behavior, codex-over-catalog merge.
- **Update** CLAUDE.md (sentinels, endpoints, file map) and app-overview (tooltip sections + known-gaps line about minimal tooltips).

## Acceptance Criteria

1. DM creates an entry; the matching badge tooltip shows the rich description on all surfaces within one reload (players) / immediately (DM after refetch).
2. Unmatched badges fall back to `Type: Name`; DM sees the pencil affordance, players don't.
3. Codex CRUD matches Enemies Gallery interaction quality (duplicate, delete confirm, dirty guard).
4. All tests pass.

## Assumptions to confirm

- Codex is **global** (not per-character) — one canon for the table.
- Descriptions are **public to players** (GET requires no auth). If some entries should be DM-secret, that's a follow-up `hidden` flag.

## Out of Scope

- Per-character overrides, mechanical automation (codex text does not drive rolls), SRD import.
