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

**Frontend** (`src/`) — React 19 + Vite SPA, React Router v7, plain JS, CSS custom properties for theming (no CSS framework). See ADR-001 and ADR-014 in `design/architecture/decisions.md` for the full CSS architecture.

- `src/components/CharacterSheet.jsx` — Single monolithic component (~2500+ lines) containing all character sheet display logic, edit mode, sub-components, and constants. Most frontend work happens here.
  - `PALETTES` — named color themes; exported and used by pages for theming
  - `BLANK_CHARACTER` — canonical default shape for new characters; includes `inspiration: false`
  - `parseModInt` — strict integer parser using `/^[+-]?\d+$/` to reject dice notation (prevents `parseInt("1d8") === 1` false positives)
  - `ItemEditorModal` — modal for editing weapons/equipment items
  - Ability score modifiers are computed on-the-fly as `floor((score-10)/2) + item bonuses`, never stored
  - **Four-tab structure** (view mode): `"loadout"` (Inventory), `"persona"` (Persona), `"combat"` (Combat), `"map"` (Map); active tab stored in `sessionStorage` as `dnd_tab_${slug}`, default `"combat"`. Map tab dimmed/disabled when no active map.
  - **Combat tab**: concentration banner, inspiration toggle, condition grid + exhaustion counter, spell slots, weapons quick-reference, **Session Notes** (player notes with per-note share toggle), dice roller — all writable without auth via `patchSession`
  - **Persona tab**: renders the `inPlay[]` trait list with diamond bullet points
  - **Inventory tab**: two-column weapons + equipment grid (`.loadout-grid`)
- `src/components/DiceRoller.jsx` — Self-contained dice roller component. Props: `{ weapons, stats, pal, slug }`. Renders at the bottom of the Combat tab. Owns its own state (roll results, history, advantage mode, free picker state). No backend calls — all UI-only. Key internals: `parseDiceExpr(str)` pure parser (named export), `rollDie(sides)` pure RNG (named export), `DieShape` SVG component (named export), CSS keyframe animations injected via `<style>` tag, `sessionStorage` key `dnd_dice_open_${slug}` for collapse state.
- `src/components/DmDiceRoller.jsx` — DM-specific dice roller rendered at the bottom of the party column in `DmDashboardPage`. Props: `{ pal, party, onApplyDamage }`. Reuses `parseDiceExpr`, `rollDie`, `DieShape` from `DiceRoller.jsx`. New DM behaviors: ×N repeat (1–8, single 600ms animation then labeled result rows), adv/dis auto-reset to Normal after each roll, "Apply to…" pill row after pure damage rolls (no d20) that calls `onApplyDamage(slug, amount)`. `sessionStorage` key `dnd_dice_dm_open` for collapse state (no slug — DM dashboard has no character context).
- `src/api.js` — all API calls; uses `VITE_API_URL` env var; password sent via `x-character-password` header
  - `getDmParty(dmPassword)` — GET /dm/party; requires DM password header
  - `patchSession(slug, fields, password)` — PATCH /characters/{slug}/session; password optional
  - `patchDmNote(slug, action, dmPassword)` — PATCH /characters/{slug}/dm-notes; DM auth required; action is `{ action: "add", text }` or `{ action: "delete", id }`
  - `getInitiative(dmPassword)` — GET /initiative; requires DM password
  - `putInitiative(dmPassword, data)` — PUT /initiative; requires DM password
  - `getMapLibrary()` — GET /maps; no auth; returns `{ activeMapId, maps[] }`
  - `presignMap(filename, contentType, dmPassword)` — POST /maps/presign; DM auth
  - `postMap(mapData, dmPassword)` — POST /maps; DM auth; registers map after S3 upload
  - `putMapActive(mapId, dmPassword)` — PUT /maps/active; DM auth; sets or clears active map
  - `patchMap(mapId, name, dmPassword)` — PATCH /maps/{mapId}; DM auth; renames map
  - `deleteMap(mapId, dmPassword)` — DELETE /maps/{mapId}; DM auth; removes from DB + S3
- `src/features/maps/MapViewer.jsx` — reusable pan/zoom image viewer; props: `{ imageUrl, name, height, pal }`; pure CSS transform, no canvas/library; used on character sheet Map tab and DM dashboard MapPanel
- `src/pages/` — CharactersListPage (index), CharacterPage (view/edit), NewCharacterPage (create flow), DmDashboardPage (`/dm`), MapLibraryPage (`/maps`, DM-only)

**Backend** (`backend/`) — AWS SAM, Node.js 20.x Lambdas, DynamoDB (PAY_PER_REQUEST, PK: `slug`), S3 for portraits.

- 17 Lambda handlers in `backend/src/handlers/`: `list`, `get`, `create`, `update`, `delete`, `verify`, `portrait`, `session`, `dmParty`, `initiative`, `dmNotes`, `getMapLibrary`, `mapPresign`, `postMap`, `putMapActive`, `patchMap`, `deleteMap`
  - `session.js` — PATCH /characters/{slug}/session; partial update of session fields (hpCurrent, tempHP, spellSlots, conditions, exhaustionLevel, concentration, inspiration, playerNotes); intentionally writable without auth (see ADR-005); DM password accepted via x-character-password
  - `dmParty.js` — GET /dm/party; DM-only; returns projected session-relevant fields for all characters; filters out sentinel slugs (`initiative`, `npc-combat`, `roll-history`, `map-library`) via `filterPublicCharacterItems()`
  - `dmNotes.js` — PATCH /characters/{slug}/dm-notes; DM auth required; accepts `{ action: "add", text }` or `{ action: "delete", id }`; appends/removes from `dmNotes[]` array in DynamoDB
  - `initiative.js` — GET + PUT /initiative; DM-only; stores initiative order as a single DynamoDB item with `slug: "initiative"`
  - `getMapLibrary.js` — GET /maps; no auth required; returns `{ activeMapId, maps[] }` from `slug: "map-library"` sentinel item
  - `mapPresign.js` — POST /maps/presign; DM auth; generates UUID, returns presigned S3 PutObject URL for `maps/{uuid}.{ext}` key in `hunkz-dnd-portraits` bucket
  - `postMap.js` — POST /maps; DM auth; appends map entry to `maps[]` array on sentinel item via `list_append`
  - `putMapActive.js` — PUT /maps/active; DM auth; sets `activeMapId` on sentinel item (accepts `null` to clear)
  - `patchMap.js` — PATCH /maps/{mapId}; DM auth; renames a map entry by ID
  - `deleteMap.js` — DELETE /maps/{mapId}; DM auth; removes from DynamoDB then deletes S3 object (best-effort, logs on S3 failure)
- `backend/src/lib/auth.js` — `verifyPassword(password, item)`: compares against owner hash (DynamoDB) and DM hash (SSM env var `DM_PASSWORD_HASH`)
- `backend/src/lib/db.js` — DynamoDB client wrapper
- `backend/src/lib/specialItems.js` — sentinel slug constants (`INITIATIVE_SLUG`, `NPC_COMBAT_SLUG`, `ROLL_HISTORY_SLUG`, `MAP_LIBRARY_SLUG`) and `filterPublicCharacterItems()` — single source of truth for sentinel filtering
- `backend/src/lib/specialRecords.js` — helpers for reading/writing sentinel items: `getMapLibraryState()`, `saveMapLibraryState()`, `normalizeMapLibraryRecord()`
- `backend/template.yaml` — SAM template; DM password hash passed as parameter override from SSM at deploy time
- S3 bucket `hunkz-dnd` (frontend), `hunkz-dnd-portraits` (portraits + maps under `maps/` prefix)

**Special DynamoDB items**: In addition to character records, the `CharactersTable` stores sentinel items: `slug: "initiative"` (initiative order), `slug: "npc-combat"` (NPC HP tracking), `slug: "roll-history"` (shared roll feed), `slug: "map-library"` (active map + library). All are filtered from `list.js` and `dmParty.js` via `filterPublicCharacterItems()` in `specialItems.js`.

**Auth model**: Two roles — `owner` (per-character bcrypt hash stored in DynamoDB) and `dm` (single hash from `DM_PASSWORD_HASH` env var set via SSM). DM session stored in `sessionStorage`.

## Character data shape

Key fields stored in DynamoDB: `slug`, `name`, `nameAlt`, `race`, `charClass`, `level`, `palette`, `portraitUrl`, `passwordHash`, `stats` (array of `{name, score, mods[]}`), `weapons` (array), `equipment` (array), `hp`, `hitDice`, `armorType`, `armorTotal`, `spells`, `notes`, `traits`, `playerNotes` (`{ id, text, sharedWithDm, createdAt }[]`; session-writable without auth; stripped from unauthenticated GET responses by `get.js`), `dmNotes` (`{ id, text, createdAt }[]`; DM-only; written via dedicated `/dm-notes` endpoint).

Each mod entry: `{ attribute: string, value: number }`. Attribute names match `MOD_ATTRIBUTES` constant (includes Strength, Dexterity, Constitution, Wisdom, Intelligence, Charisma, Armor, HP, Hit Dice, Attack Bonus, Damage, Initiative, Speed, Save DC).

**Item shapes:**
- `weapons[]: { id, name, description, mods[], requiresAttunement?, attuned?, equipped? }` — `requiresAttunement` set in edit mode (ItemEditorModal); `attuned` toggled via `patchSession` in view mode; `equipped` defaults to `true` when absent — when explicitly `false`, item mods are excluded from all stat calculations (`_itemBonuses`, ability score flyout, armor breakdown)
- `equipment[]: { id, name, type?, description, mods[], qty?, requiresAttunement?, attuned?, equipped? }` — `type` is a fixed lowercase enum (`""` / `"armor"` / `"shield"` / `"wondrous"` / `"potion"` / `"tool"` / `"ammunition"` / `"quest"` / `"other"`); stored via `ItemEditorModal` select (not free-text); displayed with capitalized label via `itemTypeLabel()` exported from `ItemEditorModal.jsx`; `qty` is a non-negative integer when tracking is on, absent/null when not tracked; `equipped` same as weapons; when `type === "potion"` and `qty > 0`, a `Use` button appears in view mode to decrement qty by 1 via `patchSession`
- Both `weapons` and `equipment` were already in `SESSION_FIELDS` on the backend — no backend changes needed for these new fields
- Drop Item: in view mode, items with a description can be dropped from the expanded description row via a 2-step inline confirmation (`Drop Item` → `Confirm drop` / `Cancel`); writes via `patchSession` after confirmation

## Agents

Five specialist agents follow a **Consult → Strategise → Design → Architect → Build** pipeline. Each stage requires explicit user approval before the next begins.

| Agent | Invoke when | Reads | Writes |
|---|---|---|---|
| `rpg-consultant` | You want a D&D expert's evaluation of features, or want gameplay-level stories written for new features | `design/app-overview.md`, web | `design/stories/` (simple goal-oriented stories: what + why, no UX detail) |
| `design-strategist` | You have a consultant story and want deep interaction design thinking before any HTML is written. Produces a written design brief covering hierarchy, motion spec, interaction model, edge cases. | `design/design-system.md`, `design/app-overview.md`, `design/stories/` | `design/briefs/<name>-brief.md`, appends `## UX Design` to story |
| `ux-designer` | You have a design brief from `design-strategist` and want an interactive HTML prototype built from it. Executes the brief — does not make design decisions. | `design/briefs/`, `design/design-system.md`, `design/stories/` | `design/prototypes/` (new HTML prototype) |
| `code-architect` | **(a)** Review approved stories before implementation — annotates each with tech guidance, scope boundaries, cost/performance notes. **(b)** Periodic codebase audit — produces refactor scope + scale-up backlog | `design/stories/`, `design/architecture/decisions.md`, source files as needed | Stories: appends `## Architect Notes`. Audit: `design/architecture/` |
| `feature-builder` | You've approved a design **and** architect notes are present on all stories | `design/stories/` (with UX Design + Architect Notes), `design/prototypes/`, source files | `src/`, `backend/`, `design/app-overview.md`, `design/design-system.md` |

**Pipeline**: `rpg-consultant` writes the *what/why* → `design-strategist` produces the *design brief* → `ux-designer` *builds the prototype* → `code-architect` adds the *how to build it* → `feature-builder` implements.

**Key principle**: `rpg-consultant` reads `design/app-overview.md` (~2k tokens) instead of source code (~30k tokens). `feature-builder` keeps both `app-overview.md` and `design-system.md` current so downstream agents always have accurate context without reading source.

**Gate**: `feature-builder` will refuse to start if a story is missing `## Architect Notes`. Always run `code-architect` on new stories first.

Example invocations:
```
# Evaluate features and write a story
> Use the rpg-consultant agent to write a story for DM dice rolling

# Produce a design brief (deep interaction design thinking, no HTML)
> Use the design-strategist agent to brief the DM dice roller from design/stories/08-dm-dice-roller.md

# Build the HTML prototype from the brief
> Use the ux-designer agent to prototype the DM dice roller from design/briefs/dm-dice-roller-brief.md

# Review stories before building (run this before every implementation)
> Use the code-architect agent to review the stories in design/stories/

# Audit code health
> Use the code-architect agent to audit the codebase and produce a refactor scope doc

# Implement after approval + architect review
> Use the feature-builder agent to implement the HP tracker from design/stories/hp-tracker.md
```

## Key conventions

- **Styling**: CSS custom properties (`--pal-*`) set at each component root; children use `var(--pal-*)` via CSS cascade. Utility classes in `src/shared.css`; per-component CSS files alongside each component. Inline `style={}` reserved for truly dynamic values only (HP bar widths, computed threshold colors, toggle positions). No runtime `<style>` tag injection. See ADR-014 for the full variable schema and file map.
- `sessionStorage` keys: `dnd_palette_${slug}`, `dnd_dm_password`, `dnd_char_${slug}` (per-character password caching), `dnd_tab_${slug}` (active tab; `"loadout"` | `"persona"` | `"combat"` | `"map"`, default `"combat"`), `dnd_dice_open_${slug}` (dice roller section open/closed, default `false`), `dnd_dice_dm_open` (DM dice roller panel open/closed, default `false`).
- Ignore legacy/backup files at `src/_backup_of_eoghan_sundayApp.jsx`, `src/_eoghan3.jsx`, `src/_oldApp.jsx`, etc.
