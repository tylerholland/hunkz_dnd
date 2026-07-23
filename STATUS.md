# Project Status — last updated 2026-07-22

## What just landed on `main`

Stories 34 through 47 (47a/47b) have landed since the last status pass — player-moved
tokens, full sync consolidation + WebSocket nudge + stale-client auto-refresh, shared
TopNav, CharacterCard decomposition, NPC library/portraits, DM map dual-state +
per-token resize + rotation, and player map view polish all confirmed live in source.
Several of these story files still had pre-implementation `Status:` labels ("Ready for
Architect Notes", "Needs UX design") that were never updated after the work landed —
that's now corrected (2026-07-22 doc-truth pass, see `design/stories/`).

**PRIORITY (2026-07-17) resolved**: the AWS free-tier request-quota pressure that drove
Stories 35/36 to jump the queue is addressed — consolidated `GET /session-state` +
WebSocket nudge channel are both live.

---

## Pipeline — what's ready to advance

Genuinely unfinished (verified against source, not just doc status):

- **Story 33 — Token Tray Parity** (`design/stories/33-token-tray-parity.md`): Ready for Architect Notes. NPC tokens in the tray still show initials instead of portrait; hover-card/card-highlight parity not started. *Note: numbering collides with `33-ability-score-display.md`, which is a different (and already-implemented) story — worth renumbering one of them.*
- **Story 39 — Talent Codex** (`design/stories/39-talent-codex.md`): Approved, ready to build. No code yet.
- **Story 40 — Adventure Breakpoints** (`design/stories/40-adventure-breakpoints.md`): Approved, ready to build. No code yet.
- **Story 41 — Campaign Settings Admin** (`design/stories/41-campaign-settings-admin.md`): Approved, ready to build — blocked on 39 and 40 landing first.
- **Story 42 — Profile View Slim-Down** (`design/stories/42-profile-view-slimdown.md`): Approved, ready to build. Profile view still has all four tabs (Combat/Map not yet removed).
- **Story 21 — Combat Efficiency** (`design/stories/21-combat-efficiency.md`): Awaiting design — AoE multi-target damage, condition tooltips, NPC concentration tracking.
- **Story 25 — World Guide**: Iceboxed (deliberately shelved — distinct from Story 26, the World Guide *browser*, which is implemented).

## Roadmap (agreed 2026-07-16) — status

1. ~~Player-moved tokens~~ — done (Story 34).
2. ~~Sync consolidation → WebSocket nudge~~ — done (Stories 35, 35b, 36, 36b).
3. ~~Shared top nav~~ — done (Story 37).
4. ~~CharacterCard.jsx breakup~~ — done (Story 38).
5. **Rich talent/ability library + admin page** — Story 39, still open, full pipeline needed (design-strategist → ux-designer → code-architect → feature-builder).
6. **Adventure/arc breakpoints** — Story 40, still open, `rpg-consultant` model already defined in the story doc.

---

## Things that need attention (not urgent)

- **Lint debt**: `npm run lint` reports ~10.5k pre-existing problems repo-wide (legacy/backup files and old rules); files touched recently lint clean. Worth a scoped cleanup or ignore-list pass.
- **`dist/` is committed and dirty** in git; deploys go via S3 sync, so it can likely be removed from the repo.
- **Story 33 numbering collision** — `33-ability-score-display.md` (implemented) and `33-token-tray-parity.md` (not implemented) share a number. Rename one before it causes confusion.
