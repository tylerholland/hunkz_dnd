# Project guidance

React 19 + Vite + React Router SPA in plain JavaScript; AWS SAM/Node.js Lambdas, DynamoDB (character table PK `slug`), and S3 backend. This is a small-group D&D session tool. Preserve existing gameplay behavior and the project's intentional trust model.

## Default workflow

- Handle ordinary tasks directly in the main conversation: investigate, implement, and verify. Do not require a story, design brief, Architect Notes, or specialist handoffs for a clear request.
- For new UI or substantial interaction changes, use one `ux-designer` to design and produce an interactive HTML prototype. Obtain user approval of that design before implementation; approval already given in the conversation counts. Small fixes and minor styling adjustments do not require a prototype.
- After design approval, the main agent implements. There are no other project specialist agents; do not run a fixed agent pipeline.
- Keep scope tied to the request. Resolve routine implementation choices independently; ask about material product ambiguity. Preserve unrelated working-tree changes.
- These defaults replace the former Consult → Strategise → Design → Architect → Build workflow, including its mandatory stage gates.

## Context discipline

- Start with relevant source and the matching module note below. Search large references for headings/symbols and read the needed sections; do not preload the overview, design system, ADR collection, stories, or graph.
- Use `rg` to locate code, then read enough surrounding logic to edit safely. Expand only when dependencies require it. Exclude generated output, backups, dependencies, and `.claude/worktrees/` from broad searches.
- Graphify is optional for unfamiliar dependencies or broad impact analysis. If using it, check `built_at_commit` in `graphify-out/graph.json` against HEAD and account for uncommitted changes. A stale graph is a navigation hint; verify against source or refresh for graph-dependent work. Do not rebuild it for an unrelated small task.
- Keep durable, cross-project-area rules here. Update the relevant module note or reference when a change makes it inaccurate; do not append endpoint inventories, field lists, or story history here. Existing code establishes current implementation details; ADRs explain constraints and reasons.
- Keep handoffs short: outcome, affected files, checks, and unresolved issues. Do not repeat documents or full diffs in chat.

## Commands and verification

- Frontend: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
- Tests: `npm run test:frontend -- <test-file>` (Vitest); `node --test <backend-test-file>` for targeted backend tests. `npm test` runs both complete suites.
- Backend: run `sam build` / `sam deploy` from `backend/`.
- Full deploy: `./deploy.sh` builds backend/frontend, syncs S3, stamps the build version, and broadcasts reload. Seed data: `node scripts/migrate.mjs` (interactive).
- Run checks appropriate to the changed behavior. Add regression coverage for meaningful bugs and logic changes; documentation-only changes need link/configuration checks, not app builds. Report what was actually verified.

## Essential patterns

- Styling uses component CSS and inherited `--pal-*` custom properties; utilities in `src/shared.css`. Inline styles are for dynamic values only. No runtime style-tag injection or CSS framework. Support existing palettes, including light `vellum`.
- API calls belong in `src/api.js`. Live pages use consolidated `getSessionState()` with `useAdaptivePolling`; extend the consolidated response rather than adding independent poll targets. Preserve shared projections and player/DM visibility boundaries.
- Auth has owner and DM roles using `x-character-password`. Session edits and own-token movement intentionally have unauthenticated paths (ADR-005); DM-only operations remain authenticated. Reuse auth helpers and preserve each endpoint's contract.
- Sentinel records coexist with characters. Use `specialItems.js` constants/filtering and `specialRecords.js` normalization; never expose sentinel records as characters or private fields in public projections.
- Reuse `BLANK_CHARACTER`, `MOD_ATTRIBUTES`, and strict numeric parsing in character-sheet constants. Compute derived stats rather than storing duplicate values. Preserve optimistic updates, write-failure recovery, and protection from stale polling responses.

## Read only for the task

| Area | Start here | Further detail, only as needed |
|---|---|---|
| Character sheets, inventory, dice | [Character notes](design/architecture/modules/character-sheet.md) | `src/components/CharacterSheet.jsx`, `src/features/characterSheet/` |
| DM cards, NPCs, initiative | [Dashboard notes](design/architecture/modules/dm-dashboard.md) | `src/pages/DmDashboardPage.jsx`, `src/features/dmDashboard/` |
| Maps, tokens, drag/rotation | [Map notes](design/architecture/modules/maps.md) | `src/features/maps/`, `src/features/dmDashboard/battleMode/` |
| Polling, sockets, reload | [Sync notes](design/architecture/modules/realtime.md) | `src/lib/`, `backend/src/handlers/getSessionState.js` |
| API, auth, persistence | [Backend notes](design/architecture/modules/backend.md) | [Data model](design/architecture/data-model.md), [backend reference](design/architecture/backend-reference.md) |
| HTML design | [Design essentials](design/design-essentials.md) | Relevant sections of [design system](design/design-system.md) |

Detailed [frontend reference](design/architecture/frontend-reference.md), [ADRs](design/architecture/decisions.md), and [product overview](design/app-overview.md) are searchable references, not startup reading. Existing `design/stories/`, `design/briefs/`, and `design/prototypes/` remain usable when relevant.
