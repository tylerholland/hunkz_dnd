# Project Status — last updated 2026-07-16

## What just landed on `main`

| Commit | What |
|---|---|
| (uncommitted) | Cleanup: dead `DmDashboardPage.jsx` deleted, `DmDashboardPrototypePage.jsx` renamed to `DmDashboardPage.jsx`, `/dm-classic` + `/dm-prototype` routes and "Classic Layout" nav link removed, dashboard test API mocks repaired, doc-truth pass (CLAUDE.md, app-overview.md, this file) |
| `bce1fb2` | Counter wheel fill changes logged to DM roll history |
| `977899a` | Story 32 implemented — ability checks roll 2d6 + modifier |
| `cf4f355` | Combat-mode gap fix between counter wheels and dice roller |
| `4bb6516` | Session status notes + Noa's feature feedback |
| `8158a38` | Stories 32 + 33 written |

**Backend deploy state**: verified 2026-07-16 — `/npc-library` and `/counter-wheels` are live (handlers respond with their own auth errors). The Story 24 deploy warning from June is resolved.

---

## Pipeline — what's ready to advance

- **Story 33 — Token Tray Parity** (`design/stories/33-token-tray-parity.md`): Ready for Architect Notes.

## PRIORITY (2026-07-17): AWS free-tier pressure

Account hit **85% of free-tier request quota** — idle browser tabs polling 4-5 endpoints at 1s. Next play session is **Wednesday 2026-07-22**; sync work must land and deploy before then. Stories 35 (consolidation) → 36 (WebSocket nudge) jump the queue; token stories (33, classic-Map-tab parity) deferred. Stopgap until deployed: don't leave app tabs open when not playing.

## Roadmap (agreed 2026-07-16)

Original priority order from architecture/feature review session:

1. **Player-moved tokens** (must-have) — players drag their own PC token only; player-writable move endpoint consistent with ADR-005 trust model. Needs `rpg-consultant` story.
2. **Sync consolidation → WebSocket nudge** — step 1: single `GET /session-state` Lambda (BatchGetItem all sentinels + party projection) replacing the 5-endpoint polling fan-out; step 2: API Gateway WebSocket "state changed, refetch" ping channel with graceful fallback to slow polling. Full payload-over-WS rejected as not worth it.
3. **Shared top nav** — consistent nav/menu design language across player and DM pages. Needs `design-strategist` first.
4. **CharacterCard.jsx breakup** — 2,041 lines; extract death-saves strip and `DamageHealModal` first. `code-architect` refactor scope, no design stage.
5. **Rich talent/ability library + admin page** — DM-authored descriptions replacing `Type: Name` tooltips; structural sibling of the NPC library (sentinel + gallery editor). Full pipeline.
6. **Adventure/arc breakpoints** — begin/end adventure actions that archive arc state (roll history, wheels, XP snapshot) and reset live surfaces. `rpg-consultant` to define the model.

---

## Things that need attention (not urgent)

- **Old story statuses**: Stories 01–24 have stale status fields from before consistent status tracking. Cosmetic only.
- **Lint debt**: `npm run lint` reports ~10.5k pre-existing problems repo-wide (legacy/backup files and old rules); files touched recently lint clean. Worth a scoped cleanup or ignore-list pass.
- **`dist/` is committed and dirty** in git; deploys go via S3 sync, so it can likely be removed from the repo.
- **`.dm-prototype-*` CSS class names** remain in `dashboard.css` / `DmDashboardPage.jsx` after the rename — functional and self-consistent; rename only if touching those files anyway.
