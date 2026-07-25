# D&D Session Manager

A live-session D&D companion app for DMs and players. The DM runs a dashboard to track HP, conditions, initiative, maps, and NPCs; players get a session view with their character sheet, dice roller, party status, and battle map.

---

## Tech stack

| Layer | What |
|---|---|
| Frontend | React 19 + Vite SPA, React Router v7, plain JS, CSS custom properties |
| Backend | AWS SAM · Node.js 20 Lambda functions · DynamoDB (PAY_PER_REQUEST) · S3 |
| Real-time | WebSocket nudge channel (API Gateway v2) + adaptive polling fallback |

---

## Prerequisites

- **Node.js 20+** and **npm**
- **AWS CLI** configured with credentials for the target account
- **AWS SAM CLI** (`brew install aws-sam-cli` or see [docs](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- Access to the shared `.env` file (ask Tyler — it contains `VITE_API_URL`, `VITE_WS_URL`, and the DM password hash)

---

## Local development

```bash
# Install frontend dependencies
npm install

# Start the Vite dev server (hot reload, proxies to the deployed API)
npm run dev
```

The dev server reads `VITE_API_URL` from `.env` and points at the deployed AWS backend, so you get real data without running Lambda locally. No backend emulator is needed for most frontend work.

Other frontend commands:

```bash
npm run build    # Production build → dist/
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

---

## Deploying

```bash
# Full deploy: builds backend + frontend, syncs to S3, broadcasts a reload to connected clients
./deploy.sh
```

Backend-only (from `backend/`):

```bash
sam build
sam deploy
```

The DM password hash is pulled from SSM at deploy time — you don't need it in your shell.

---

## Seeding data

If you're setting up a fresh DynamoDB table:

```bash
node scripts/migrate.mjs   # interactive — seeds characters and uploads portraits to S3
```

---

## Architecture overview

### Frontend (`src/`)

- **`src/pages/`** — top-level route components (`CharactersListPage`, `CharacterPage`, `CharacterModePage`, `DmDashboardPage`, `MapLibraryPage`)
- **`src/components/`** — shared components (`TopNav`, `DiceRoller`, `DmDiceRoller`, `CharacterSheet`)
- **`src/features/`** — feature modules:
  - `characterSheet/` — view mode, edit mode, session mode, item editor, theme palettes
  - `dmDashboard/` — character cards, map panel, battle mode, token tray, NPC library, counter wheels
  - `maps/` — `MapViewer` (pan/zoom/rotate image viewer, token overlay)
  - `worldGuide/` — in-app world guide drawer
- **`src/api.js`** — all HTTP calls; reads `VITE_API_URL` from env
- **`src/lib/`** — hooks and utilities: `useSessionSocket` (WebSocket), `liveSync` (polling), `staleClient` (auto-reload on deploy)

Styling: CSS custom properties (`--pal-*`) set per component for theming; utility classes in `src/shared.css`. No CSS framework.

### Backend (`backend/src/handlers/`)

34 Lambda handlers. Notable ones:

- `getSessionState.js` — the single consolidated polling endpoint used by all pages; one request per poll tick
- `session.js` — PATCH session fields (HP, conditions, spells, notes) without auth
- `putMapView.js` — stores the DM's published viewport; triggers WebSocket broadcast
- `wsConnect/wsDisconnect/broadcastReload` — WebSocket nudge channel

All special data (initiative order, NPC combat, map library, roll history, counter wheels, party roster) lives as sentinel items in the same DynamoDB table as characters.

See `design/architecture/decisions.md` for Architecture Decision Records.

---

## Working with Claude Code

This project uses **Claude Code** as an AI coding assistant. The `CLAUDE.md` file at the repo root is loaded automatically by Claude and contains:

- Full component and handler descriptions
- Auth model, data shapes, and session field semantics
- Key conventions (styling, sessionStorage keys, coordinate systems)
- The five-agent design pipeline (`rpg-consultant → design-strategist → ux-designer → code-architect → feature-builder`)

**If you use Claude Code**, it will read `CLAUDE.md` and have full project context. The agents in the pipeline each have a specific role — read the "Agents" section in `CLAUDE.md` before kicking off new feature work.

---

## Design docs

| File | What |
|---|---|
| `design/app-overview.md` | Plain-language description of every feature (what agents read instead of source) |
| `design/design-system.md` | Color palettes, typography, spacing, component patterns |
| `design/architecture/decisions.md` | ADRs for major technical decisions |
| `design/stories/` | Feature stories (what + why, each with UX and architect notes) |
| `design/briefs/` | Detailed interaction design briefs (input to the UX designer agent) |
| `design/prototypes/` | HTML prototypes built from design briefs |

---

## Key conventions

- **No TypeScript** — plain JS throughout
- **CSS custom properties** for theming, not inline styles (except truly dynamic values like HP bar widths)
- **`patchSession`** writes session fields (HP, conditions, etc.) without auth — this is intentional (see ADR-005)
- **Sentinel DynamoDB items** share the characters table; they're filtered from list endpoints via `filterPublicCharacterItems()` in `backend/src/lib/specialItems.js`
- Ignore files matching `src/_backup_*`, `src/_eoghan*`, `src/_old*`
