# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend
```bash
npm run dev       # Start Vite dev server (reads VITE_API_URL from .env)
npm run build     # Production build to dist/
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

### Backend (from /backend)
```bash
sam build                          # Build Lambda functions
sam deploy                         # Deploy to AWS (see deploy.sh for param overrides)
```

### Full deploy
```bash
./deploy.sh   # Fetches DM hash from SSM, builds backend + frontend, syncs to S3
```

### Seed initial data
```bash
node scripts/migrate.mjs   # Seeds DynamoDB and uploads portraits to S3 (interactive)
```

## Architecture

**Frontend** (`src/`) — React 19 + Vite SPA, React Router v7, plain JS, inline styles throughout (no CSS framework).

- `src/components/CharacterSheet.jsx` — Single monolithic component (~2500+ lines) containing all character sheet display logic, edit mode, sub-components, and constants. Most frontend work happens here.
  - `PALETTES` — named color themes; exported and used by pages for theming
  - `BLANK_CHARACTER` — canonical default shape for new characters; includes `inspiration: false`
  - `parseModInt` — strict integer parser using `/^[+-]?\d+$/` to reject dice notation (prevents `parseInt("1d8") === 1` false positives)
  - `ItemEditorModal` — modal for editing weapons/equipment items
  - Ability score modifiers are computed on-the-fly as `floor((score-10)/2) + item bonuses`, never stored
  - **Three-tab structure** (view mode): `"loadout"` (Inventory), `"persona"` (Persona), `"combat"` (Combat); active tab stored in `sessionStorage` as `dnd_tab_${slug}`, default `"combat"`
  - **Combat tab**: concentration banner, inspiration toggle, condition grid + exhaustion counter, spell slots, weapons quick-reference, dice roller — all writable without auth via `patchSession`
  - **Persona tab**: renders the `inPlay[]` trait list with diamond bullet points
  - **Inventory tab**: two-column weapons + equipment grid (`.loadout-grid`)
- `src/components/DiceRoller.jsx` — Self-contained dice roller component. Props: `{ weapons, stats, pal, slug }`. Renders at the bottom of the Combat tab. Owns its own state (roll results, history, advantage mode, free picker state). No backend calls — all UI-only. Key internals: `parseDiceExpr(str)` pure parser (named export), `rollDie(sides)` pure RNG (named export), `DieShape` SVG component (named export), CSS keyframe animations injected via `<style>` tag, `sessionStorage` key `dnd_dice_open_${slug}` for collapse state.
- `src/components/DmDiceRoller.jsx` — DM-specific dice roller rendered at the bottom of the party column in `DmDashboardPage`. Props: `{ pal, party, onApplyDamage }`. Reuses `parseDiceExpr`, `rollDie`, `DieShape` from `DiceRoller.jsx`. New DM behaviors: ×N repeat (1–8, single 600ms animation then labeled result rows), adv/dis auto-reset to Normal after each roll, "Apply to…" pill row after pure damage rolls (no d20) that calls `onApplyDamage(slug, amount)`. `sessionStorage` key `dnd_dice_dm_open` for collapse state (no slug — DM dashboard has no character context).
- `src/api.js` — all API calls; uses `VITE_API_URL` env var; password sent via `x-character-password` header
  - `getDmParty(dmPassword)` — GET /dm/party; requires DM password header
  - `patchSession(slug, fields, password)` — PATCH /characters/{slug}/session; password optional
  - `getInitiative(dmPassword)` — GET /initiative; requires DM password
  - `putInitiative(dmPassword, data)` — PUT /initiative; requires DM password
- `src/pages/` — CharactersListPage (index), CharacterPage (view/edit), NewCharacterPage (create flow), DmDashboardPage (`/dm`)

**Backend** (`backend/`) — AWS SAM, Node.js 20.x Lambdas, DynamoDB (PAY_PER_REQUEST, PK: `slug`), S3 for portraits.

- 10 Lambda handlers in `backend/src/handlers/`: `list`, `get`, `create`, `update`, `delete`, `verify`, `portrait`, `session`, `dmParty`, `initiative`
  - `session.js` — PATCH /characters/{slug}/session; partial update of session fields (hpCurrent, tempHP, spellSlots, conditions, exhaustionLevel, concentration, inspiration); intentionally writable without auth (see ADR-005); DM password accepted via x-character-password
  - `dmParty.js` — GET /dm/party; DM-only; returns projected session-relevant fields for all characters; filters out the `slug: "initiative"` item
  - `initiative.js` — GET + PUT /initiative; DM-only; stores initiative order as a single DynamoDB item with `slug: "initiative"`
- `backend/src/lib/auth.js` — `verifyPassword(password, item)`: compares against owner hash (DynamoDB) and DM hash (SSM env var `DM_PASSWORD_HASH`)
- `backend/src/lib/db.js` — DynamoDB client wrapper
- `backend/template.yaml` — SAM template; DM password hash passed as parameter override from SSM at deploy time
- S3 bucket `hunkz-dnd` (frontend), `hunkz-dnd-portraits` (portraits)

**Special DynamoDB items**: In addition to character records, the `CharactersTable` stores a single item with `slug: "initiative"` that holds the current initiative order (`entries[]`, `activeTurnIndex`). This item is filtered out of character list/party endpoints.

**Auth model**: Two roles — `owner` (per-character bcrypt hash stored in DynamoDB) and `dm` (single hash from `DM_PASSWORD_HASH` env var set via SSM). DM session stored in `sessionStorage`.

## Character data shape

Key fields stored in DynamoDB: `slug`, `name`, `nameAlt`, `race`, `charClass`, `level`, `palette`, `portraitUrl`, `passwordHash`, `stats` (array of `{name, score, mods[]}`), `weapons` (array), `equipment` (array), `hp`, `hitDice`, `armorType`, `armorTotal`, `spells`, `notes`, `traits`.

Each mod entry: `{ attribute: string, value: number }`. Attribute names match `MOD_ATTRIBUTES` constant (includes Strength, Dexterity, Constitution, Wisdom, Intelligence, Charisma, Armor, HP, Hit Dice, Attack Bonus, Damage, Initiative, Speed, Save DC).

## Agents

Four specialist agents follow a **Consult → Design → Architect → Build** pipeline. Each stage requires explicit user approval before the next begins.

| Agent | Invoke when | Reads | Writes |
|---|---|---|---|
| `rpg-consultant` | You want a D&D expert's evaluation of features, or want gameplay-level stories written for new features | `design/app-overview.md`, web | `design/stories/` (simple goal-oriented stories: what + why, no UX detail) |
| `ux-designer` | You have a consultant story and want visual design + UX implementation detail | `design/design-system.md`, `design/app-overview.md`, `design/stories/` | `design/prototypes/` (new HTML prototype), `design/stories/` (appends `## UX Design` section to consultant's story) |
| `code-architect` | **(a)** Review approved stories before implementation — annotates each with tech guidance, scope boundaries, cost/performance notes. **(b)** Periodic codebase audit — produces refactor scope + scale-up backlog | `design/stories/`, `design/architecture/decisions.md`, source files as needed | Stories: appends `## Architect Notes`. Audit: `design/architecture/` |
| `feature-builder` | You've approved a design **and** architect notes are present on all stories | `design/stories/` (with UX Design + Architect Notes), `design/prototypes/`, source files | `src/`, `backend/`, `design/app-overview.md`, `design/design-system.md` |

**Pipeline**: `rpg-consultant` writes the *what/why* → `ux-designer` adds the *how it looks/works* → `code-architect` adds the *how to build it* → `feature-builder` implements.

**Key principle**: `rpg-consultant` reads `design/app-overview.md` (~2k tokens) instead of source code (~30k tokens). `feature-builder` keeps both `app-overview.md` and `design-system.md` current so downstream agents always have accurate context without reading source.

**Gate**: `feature-builder` will refuse to start if a story is missing `## Architect Notes`. Always run `code-architect` on new stories first.

Example invocations:
```
# Evaluate features and write a story
> Use the rpg-consultant agent to write a story for DM dice rolling

# Design the UX and update the story
> Use the ux-designer agent to design the DM dice roller from design/stories/08-dm-dice-roller.md

# Review stories before building (run this before every implementation)
> Use the code-architect agent to review the stories in design/stories/

# Audit code health
> Use the code-architect agent to audit the codebase and produce a refactor scope doc

# Implement after approval + architect review
> Use the feature-builder agent to implement the HP tracker from design/stories/hp-tracker.md
```

## Key conventions

- All styling is inline React styles. Responsive breakpoints use CSS injected via `<style>` tags (e.g., `.loadout-grid` two-column layout collapses at 560px).
- `sessionStorage` keys: `dnd_palette_${slug}`, `dnd_dm_password`, `dnd_char_${slug}` (per-character password caching), `dnd_tab_${slug}` (active tab; `"loadout"` | `"persona"` | `"combat"`, default `"combat"`), `dnd_dice_open_${slug}` (dice roller section open/closed, default `false`), `dnd_dice_dm_open` (DM dice roller panel open/closed, default `false`).
- Ignore legacy/backup files at `src/_backup_of_eoghan_sundayApp.jsx`, `src/_eoghan3.jsx`, `src/_oldApp.jsx`, etc.
