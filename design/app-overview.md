# App Overview

> This document is the source of truth for what the app currently does, in plain language.
> **Maintained by `feature-builder`** — update this after every feature implementation.
> Read by `rpg-consultant` and `ux-designer` instead of source code.

---

## What it is

A D&D character sheet web app for a small group of players (currently 3 characters: Aragorn, Eoghan, Aesop). Designed for both between-session character management and in-session reference. Players access their own character; a DM can access all characters with a shared password. Hosted on AWS (S3 + Lambda + DynamoDB).

## Audience

- **Players**: view and edit their own character sheet, protected by a per-character password
- **DM**: full access to all characters via a separate DM password; currently accesses the same character sheet UI

---

## Current features

### Character list (home page — `CharactersListPage.jsx`)

- Grid of character cards; each card shows portrait (4:3 ratio), character name, nickname (italic), race · class · level
- Palette-themed cards: each card uses the character's own palette for borders, accent colors, and background tints
- Hover effect: border brightens to `pal.accent`, card lifts 2px
- The page is a true library, not automatically the live campaign party roster
- Characters currently in the active party roster show an `In Party` badge on their library card
- Top nav replaces the old "The Company" heading; page title is now `Character Library`
- When not DM-authenticated: top nav shows `DM Login`
- When DM-authenticated: top nav shows `DM ✓` at top-right plus a second row with `Campaign` and `End Session`
- DM login opens a modal password prompt; verifies against the API; stores DM session in `sessionStorage` as `dnd_dm_password`
- `Campaign` link navigates directly to `/dm`
- `Maps` link navigates directly to `/maps` (shown alongside Campaign when DM-authenticated)
- "New Character" card at the end of the grid: dashed border, navigates to `/characters/new`
- Library rendering filters internal sentinel records such as `initiative`, `npc-combat`, `roll-history`, `map-library`, `party-roster`, `npc-library`, and `counter-wheels`

---

### Character sheet — VIEW mode

The full sheet is hidden behind a password prompt until unlocked. On load, the sheet automatically tries to unlock using the stored DM password (`sessionStorage.dnd_dm_password`) or the stored character password (`sessionStorage.dnd_char_${slug}`), showing a spinner while it checks. If no stored credential matches, a "🔒 Unlock with password" button appears.

The top bar (always visible, no auth required) contains:
- `← All Characters` link (back to list)
- World Guide trigger icon (open-book SVG, 44px touch target; opens the World Guide drawer)
- `Export JSON` button
- `🔒 Edit Character` / `Edit Character` button (triggers unlock or enters edit mode)

#### Header (always visible, no auth required)

- Class · Subclass line (uppercase, tracked, muted)
- Character name (`h1`, Cinzel, clamp 1.8–2.8rem)
- Nickname in italic quotes (if set)
- Pronunciation guide in accent color (if set)
- Character details grid (3-column, collapses to 2 on mobile): Race, Class, Subclass, Alignment, Background, Origin — each shown as a label/value pair

#### Portrait (always visible, no auth required)

- Full-bleed image spanning the content column width (bleeds to ±28px margins)
- Tagline shown beneath portrait in italic Crimson Text, accent color, 22px

#### Private content (requires unlock)

All content below the header is gated. When locked: shows a "Full sheet is private" note with an unlock button.

##### Stats block (surface panel with border)

1. **HP / Hit Dice / Armor row**: displayed as large centered numbers
   - Hit Points: 44px Cinzel, `pal.gem` color; shows item bonus inline if present
   - Hit Dice: mixed font sizes — numeric parts 44px, letter parts 22px (e.g., "4" big, "d" small, "10" big)
   - Armor: type label above (e.g., "Full · Slow"), armor total number in `pal.accentBright`; shows item bonus note if present
   - All three are horizontally centered with `gap: 52px`, wrapping on mobile

2. **Ability scores** — labeled "Ability Scores · Level N":
   - Each stat is a row: 44px score circle + stat name + optional note
   - Circle: 44px diameter, colored per score — `pal.gem` if score ≥ 14, `pal.gemLow` if ≤ 8, `pal.accent` otherwise
   - **Modifier badge**: 26px circle overlapping bottom-left of the score circle; shows total modifier (`floor((score-10)/2) + item bonuses`); hidden when modifier is exactly 0; background matches circle color, border uses `pal.surfaceSolid` for cutout effect
   - **Flyout** (on hover or tap): appears above the circle; shows — stat name + raw score, a divider, "Score modifier" + base mod, item mod rows (source name + value), another divider, "Total" (score + total modifier); `position: absolute, bottom: calc(100% + 6px), left: 0`; uses `pal.surfaceSolid` background; pointer-events none (hover-only on desktop, tap-toggle on mobile)

3. **Skills, Spells & Special Abilities**: rendered as three badge rows inside the stats panel
   - **Skills** row: badge-style tags using the accent palette treatment
   - **Spells** row: badge-style tags using the standard sheet border/surface treatment
   - **Special Abilities** row: badge-style tags using the gem palette treatment
   - All three rows use the same in-app tooltip interaction on hover, focus, or click; current tooltip text is just `Type: Name` (for example `Skill: Athletics`, `Spell: Hunter's Mark`, `Special Ability: Backstab`)

4. **Progression & currency**:
   - **Leveling mode** can be `milestone` or `xp`
   - XP-tracked characters show an XP progress panel using level thresholds, current XP, next-level target, and a progress bar
   - **Coin mode** can be `gp` (single gold total) or `full` (cp / sp / ep / gp / pp)
   - Coin totals are shown in the Combat tab and can be adjusted live by authenticated users through the session patch path

5. **Four-tab strip: Inventory | Persona | Combat | Map** — full-width icon+label tab strip (64px tall, SVG icon above label text, IM Fell English 13px uppercase tracked); active tab shows `pal.accentDim` background + `pal.accent` border + `pal.accentBright` text/icons; tab state stored in `sessionStorage` as `dnd_tab_${slug}`, default `"combat"`. The Map tab is visually dimmed (opacity 0.4, `cursor: not-allowed`) when no active map is set.
   - **Inventory tab** (`combatTab === "loadout"`): two-column `.loadout-grid` (collapses to 1 column at 560px). Tab layout (top to bottom): attunement banner → loadout grid → XP strip (xp-mode only) → coin section.
     - **Attunement banner**: full-width row above the grid, always visible. Shows `◆ Attuned N / 3` + contextual note ("N slots remaining", "Slots full", "⚠ Over limit"). Empty (0/3) renders at opacity 0.45. Over-limit (4+/3) renders the diamond, count, and note in error red `#c06060`. Full (3/3) note renders in `pal.accentBright`.
     - Weapons column: each weapon is an expandable row — name + mod chips; tap to expand description below if present; ▼/▲ indicator. Each weapon has an **equipped toggle** (■ square, 10px, `pal.gem` color when equipped, `pal.textMuted` dimmed when not) to the left of the name; tapping toggles `equipped` via `patchSession({ weapons: [...] })` (no auth required). Unequipped items have their name dimmed to `pal.textMuted` and their mods excluded from all stat calculations. Items with `requiresAttunement: true` show a gem indicator (10px circle) before the expand arrow: filled + pulsing glow when `attuned: true`, hollow circle when not attuned. Tapping the gem circle toggles `attuned` via `patchSession({ weapons: [...] })`. Item name renders in `pal.textBody` (dimmed) when `requiresAttunement` is true and `attuned` is false. **Drop Item** button shown in expanded description area (slug required); first tap shows inline `[Confirm drop] [Cancel]` confirmation; confirming removes the item from the weapons array and writes via `patchSession`.
     - Equipment column: same pattern — equipped toggle badge (■), name + optional capitalized type tag + mod chips; expandable description. Same attunement gem indicator as weapons. Equipment items also support optional `qty` tracking: when `item.qty != null`, shows `· N` inline after the name (muted color); depleted (qty=0) renders separator+count in `#c06060` and dims the item name to `pal.textMuted`. Tapping the qty opens an inline stepper `[−] N [+]` with hold-to-repeat (500ms delay, 100ms repeat); stepper auto-closes after 2s inactivity; writes via `patchSession({ equipment: [...] })` debounced 400ms. **Potion quick-use**: when `item.type === "potion"` AND `item.qty > 0`, a small `Use` button appears in the item row (slug required); tapping decrements qty by 1 via `patchSession`. **Drop Item** button shown in expanded description area (same pattern as weapons).
     - Over-limit attunement toggle: when toggling an item to attuned while already at 3/3, the toggle succeeds (warn-but-allow), the counter updates to 4/3 in error red, and the newly-attuned gem indicator briefly flashes red (400ms CSS animation `overLimitFlash`).
   - **Persona tab** (`combatTab === "persona"`): unordered list in a responsive auto-fill grid; each item prefixed with a ◆ diamond bullet; fontBody, 16px. Empty state message if no traits. Corresponds to the `inPlay[]` array.
   - **Combat tab** (`combatTab === "combat"`): live-session resource surface; no password required to update any value
     - **Concentration banner**: shown only when `concentration.active`; pulsing dot + "Concentrating on [spell]" + "Drop Concentration" button; hidden entirely when not concentrating
     - **Concentration set input**: text input + "Set Concentration" button; shown only when not concentrating
     - **Inspiration toggle**: glowing gem circle + "Inspiration" label + "Active" badge when `char.inspiration` is true; tap to toggle (writes via `patchSession`)
     - **Condition grid**: all 14 standard conditions as toggleable pill buttons; Exhaustion level stepper (0–6); "Clear All Conditions" button when any are active
     - **Spell Slots**: per-level bubble rows (available/used); Long Rest + Short Rest buttons; shown only if `spellSlots` configured
     - **Weapons quick-reference**: collapsed rows showing weapon name + to-hit + damage; tap to expand description; read-only (editing is in Inventory tab)
     - **Session Notes** (`SessionNotesSection`): inline notes section below the weapons quick-reference, visible only to authenticated callers. Player can add, delete, and share individual notes. Each note has a per-note "Private" / "Shared with DM" toggle (default: private). Writes via `patchSession({ playerNotes: [...] })`. Full `playerNotes` array returned to authenticated owner; DM sees only `sharedWithDm: true` entries via the character sheet or `GET /dm/party`.
     - **XP / Coin live management**:
       - XP panel appears only for XP-tracked characters and reflects `xpCurrent`
       - Coin panel reflects either a single GP total or a full denomination spread based on `coinMode`
       - Coin adjustments in the sheet are optimistic, then synced through the live session patch flow
     - **Dice Roller** (`DiceRoller.jsx`): collapsible section at the bottom of the Combat tab (collapsed by default; state stored in `sessionStorage` as `dnd_dice_open_${slug}`). Contains:
       - **Advantage/disadvantage strip**: Normal / Advantage / Disadvantage toggle; applies to all d20 rolls until changed; resets on page reload
       - **Weapon roll buttons**: one row per weapon that has an Attack Bonus or Damage mod; ATK button rolls 1d20 + attack bonus (respects adv/dis, triggers crit/fumble); DMG button parses the damage expression (`parseDiceExpr`) and rolls all dice groups
       - **Ability check circles**: six tappable stat circles (STR/DEX/CON/WIS/INT/CHA); each rolls 1d20 + computed ability modifier (same formula as rest of sheet); respects adv/dis
       - **Free dice picker**: 7 SVG die buttons (d4, d6, d8, d10, d12, d20, d100); count stepper 1–10; single-click selects primary die, double-click adds one to combo; "+ Add Die" adds current count+type to the pending combo expression; flat modifier input; big "Roll" button
     - **Expression text input**: accepts freeform expressions like `2d6+1d4+3`; overrides picker on roll when non-empty; Enter key triggers roll
      - **Result display**: single-die or multi-group layout; CSS-only spin animation (1050ms); staggered group reveal for combos; gold crit / red fumble number glow + label; advantage/disadvantage shows both d20 results with discarded value struck through
      - **Roll history**: last 5 rolls (most recent at top); each row shows expression on the left, roll label, per-die results array on the right, and a larger total. Fade levels are 100% / 45% / 22% / hidden / hidden. Session-only (not persisted)
      - **DM live roll broadcast**: after a player roll resolves, the sheet posts a compact event to a shared backend roll-history record (`/characters/{slug}/rolls`). On the next DM poll, that roll appears in the DM Campaign dice history

##### Collections / Persona sections

Below the stats block: a navigation area and content viewer for structured character backstory/notes.

- **Collection navigation**: for each collection (e.g., "Character", "History"), shown as a group label above a row of section buttons; clicking a section button sets it as the active section
- **Section button** style: ghost/active pill — `navBtn(isActive)` — background `pal.accentDim` + border `pal.accent` + text `pal.accentBright` when active; transparent + border `pal.border` + text `pal.textMuted` when inactive
- **Active section content viewer**: section title as `h2` (Cinzel, uppercase, `pal.accent`, 14px tracked); content rendered as:
  - **Prose type**: paragraphs split by `\n\n`; 18px Crimson Text, line-height 1.9, justified; supports inline `*italic*` markup via `renderInline()` (renders as `<em className="phoenetic">`)
  - **List type**: `<ul>` with ◆ diamond bullets; 16px Crimson Text

##### Footer

- Character name · nickname · race class · level; italic, muted, centered

---

### Character sheet — EDIT mode

Reached by clicking "Edit Character" (prompts for password if not already unlocked). Shows a top bar with:
- "Character Sheet Editor" label + character name
- `Import JSON` button (new characters only)
- `Export JSON` button
- `Save` button (existing characters) — shows saving/saved/error states
- `Create Character →` button (new characters only)
- `View Sheet →` button to return to view mode

Edit mode sections (in order):

1. **Color Theme**: row of palette buttons; selected palette shows with accentDim background + accent border + accentBright text
2. **Portrait Image**: shows current portrait thumbnail (90×90px); "Upload Image" / "Change Image" button + "Remove" button; uploads via S3 presigned URL if character exists, else stores as base64
3. **Portrait Tagline**: single text input
4. **Identity** (2-column grid):
   - Character Name (text)
   - Alias / Epithet (text)
   - Pronunciation (text)
   - Race (select from RACE_OPTIONS list)
   - Class (select from CLASS_OPTIONS list)
   - Subclass / Patron (select; filtered to current class if class is set)
   - Alignment (select)
   - Background (select)
   - Origin / Homeland (text)
   - Level (number 1–20)
5. **Ability Scores**: auto-fill grid of score cards; each card has stat name input + large score number input + optional note input
6. **Hit Points & Hit Dice**: two inputs side by side — HP (max, number) and Hit Dice (text, e.g., "4d10")
7. **Armor & Speed**: four toggle buttons (None/Fast, Light/Normal, Full/Slow, Shield) + Total Armor number input
8. **Key Spells & Abilities**: comma-separated text input (stored as string array)
9. **Skills**: manual multi-select badge grid for the nine supported skills
10. **Special Abilities**: manual multi-select badge grid for the supported special abilities
11. **Leveling Mode**: segmented toggle for `Milestone` vs `XP`
12. **XP**: numeric current XP field shown only when leveling mode is `xp`
13. **Coin Mode**: segmented toggle for `GP only` vs `Full denominations`
14. **Coin**:
    - GP mode: single numeric gold-piece field
    - Full mode: five numeric denomination inputs (`cp`, `sp`, `ep`, `gp`, `pp`)
15. **Persona Traits**: dynamic list of text inputs with ×-remove buttons; `+ Add Trait` button at bottom (formerly labeled "In Play Traits")
16. **Weapons**: list of weapon rows (name + modifier summary); `Edit` and `×` per row; `+ Add Weapon` button → opens **ItemEditorModal**
17. **Equipment**: same as weapons but includes optional `Type` field; `+ Add Item` button → opens **ItemEditorModal** with `showType: true`
18. **Change Password** (existing characters only, separated by divider): two-column new/confirm inputs; "Update Password" button; note that blank password removes protection
19. **Collections & Sections**: dynamic editor for the backstory/persona collections:
    - `+ Add Collection` button at top
    - Each collection: editable label input + `×`-remove button
    - Each section within a collection:
      - **Drag handle** (6-dot grip icon, `DragHandle` component) — drag to reorder sections within the collection; visual feedback: dragging item fades to 0.45 opacity, drop target border highlights with `pal.accent`
      - Section title input (Cinzel font)
      - **Type toggle button**: "¶ Prose" or "≡ List" — toggles between prose textarea and list item inputs
      - `×`-remove button
      - Prose sections: `<textarea>` with `resize: vertical, minHeight: 110`
      - List sections: dynamic list of text inputs with ×-remove buttons; `+ Add Item` at bottom
    - `+ Add Prose Section` and `+ Add List Section` buttons per collection

#### ItemEditorModal

Fixed-position overlay (rgba(0,0,0,0.8) backdrop). Modal panel in `pal.surfaceSolid`:
- "Edit Item" / "New Item" label
- Name field (always) + Type field (equipment only, optional) — Type is a `<select>` with fixed options: `(none)`, Armor, Shield, Wondrous, Potion, Tool, Ammunition, Quest, Other; stored as lowercase string (`""` / `"armor"` / `"shield"` / …); displayed with capitalized label in view mode
- **Requires Attunement** checkbox; when checked, a "Currently Attuned" sub-checkbox appears. Unchecking "Requires Attunement" clears `attuned` too.
- **Track Quantity** checkbox; when checked, a numeric "Current qty" input (min 0) appears. Unchecking removes the `qty` field from the saved item entirely.
- **Equipped / In use** checkbox (always shown, defaults to checked/true); when unchecked (`equipped: false`), the item's mods are excluded from all stat computations. Helper text: "Unequipped items don't contribute mods to stats."
- Description textarea ("shown on tap" hint)
- Modifiers section: dynamic list of `[attribute select] [value input] [×]` rows; attribute options from `MOD_ATTRIBUTES` constant; `+ Add Mod` dashed button
- Cancel + Save Changes / Add Item buttons
- `handleSave` spreads the existing item object before overriding with editor state, so unknown fields (including `qty`, `requiresAttunement`, `attuned`, `equipped`) are never silently wiped on re-save.

---

### Character creation flow (`NewCharacterPage.jsx`)

- Step 1 ("build"): renders a full `CharacterSheet` in create mode (no slug, `onCreate` prop); user fills in all fields in edit mode; "Create Character →" button triggers step 2
- Step 2 ("create"): password modal overlay in the character's chosen palette; name + confirm password inputs; "← Back" and "Create Character" buttons; calls `POST /characters`; redirects to `/characters/{slug}` on success

---

### Data structures (actual shapes in code)

**`BLANK_CHARACTER` defaults:**
```js
{
  name, nameAlt, pronunciation,
  race, charClass, subclass,
  alignment, background, origin,
  level: 1, portrait: "", tagline: "", palette: "ember",
  stats: [
    { stat: "Strength",     score: 10, note: "" },
    { stat: "Dexterity",    score: 10, note: "" },
    { stat: "Constitution", score: 10, note: "" },
    { stat: "Wisdom",       score: 10, note: "" },
    { stat: "Intelligence", score: 10, note: "" },
    { stat: "Charisma",     score: 10, note: "" },
  ],
  hpMax: 0, hpCurrent: 0, tempHP: 0,
  hitDice: "", armorType: "", armorTotal: 0,
  spells: [],          // string[] — spell names / key magical abilities
  skills: [],          // string[] — selected manual skill keys
  specialAbilities: [],// string[] — selected manual special-ability keys
  spellSlots: [],      // { level, max, used, isPactMagic }[]
  conditions: [],
  exhaustionLevel: 0,
  concentration: { active: false, spell: "" },
  inspiration: false,  // boolean — toggled in Combat tab, no auth required
  inPlay: [],      // string[] — roleplay behavior traits (shown on Persona tab)
  playerNotes: [], // { id, text, sharedWithDm, createdAt }[]
  weapons: [],     // { id, name, description, mods: [{ attribute, value }], equipped?: boolean }[]
  equipment: [],   // { id, name, type?: ""/"armor"/"shield"/"wondrous"/"potion"/"tool"/"ammunition"/"quest"/"other", description, mods: [{ attribute, value }], qty?: number, equipped?: boolean }[]
  levelingMode: "milestone", // "milestone" | "xp"
  xpCurrent: 0,
  coin: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  coinMode: "gp",  // "gp" | "full"
  collections: [
    { id, label: "Character", sections: [
      { id, title: "About",      type: "prose", content: "" },
      { id, title: "Appearance", type: "prose", content: "" },
    ]},
    { id, label: "History", sections: [] },
  ],
}
```

**Stat mods**: computed on-the-fly as `floor((score-10)/2) + sum of item mods for that attribute`. Never stored. `parseModInt` helper rejects dice notation (e.g., `"1d8"` is `NaN`, not `1`).

**`MOD_ATTRIBUTES`** (the full list): Strength, Dexterity, Constitution, Wisdom, Intelligence, Charisma, Armor, HP, Hit Dice, Attack Bonus, Damage, Initiative, Speed, Save DC.

---

### Palettes

10 named palettes: `ember`, `ocean`, `forest`, `ash`, `hearthstone`, `ironwood`, `hoarfrost`, `nightwood`, `pitch`, `vellum`. All are dark except `vellum` (light parchment). Each palette object contains: `bg`, `surface`, `surfaceSolid`, `border`, `accent`, `accentBright`, `accentDim`, `text`, `textBody`, `textMuted`, `glow1`, `glow2`, `gem`, `gemLow`, and the three font strings (`fontDisplay`, `fontBody`, `fontUI`). All three fonts are identical across palettes (Cinzel, Crimson Text, IM Fell English).

---

## Data model (key fields in DynamoDB)

| Field | Type | Notes |
|---|---|---|
| `slug` | string | URL-safe identifier, DynamoDB PK |
| `name` / `nameAlt` | string | Display name + nickname/epithet |
| `pronunciation` | string | Phonetic guide, shown in accent color |
| `race` / `charClass` / `subclass` / `level` | string/number | Identity fields |
| `alignment` / `background` / `origin` | string | Identity fields |
| `palette` | string | Key into PALETTES constant |
| `portraitUrl` | string | S3 URL; `portrait` (base64) used during creation |
| `tagline` | string | Italic caption below portrait |
| `passwordHash` | string | bcrypt, stored in DynamoDB |
| `stats` | array | `{ stat, score, note }[]` — note is a short display annotation |
| `weapons` | array | `{ id, name, description, mods[], requiresAttunement?, attuned?, equipped? }` — `requiresAttunement` set in edit mode; `attuned` toggled in view mode via patchSession; `equipped` defaults `true` (omitted = equipped); when `false`, item mods are excluded from all stat calculations |
| `equipment` | array | `{ id, name, type?, description, mods[], qty?, requiresAttunement?, attuned?, equipped? }` — `type` is a lowercase string from fixed set (`""` / `"armor"` / `"shield"` / `"wondrous"` / `"potion"` / `"tool"` / `"ammunition"` / `"quest"` / `"other"`); `qty` tracked in view mode via patchSession; `equipped` same as weapons; when `type === "potion"` and `qty > 0`, a `Use` button decrements qty in-session |
| `hpMax` | number | Max HP (edit-mode only) |
| `hpCurrent` | number | Current HP (session state, no-auth write) |
| `tempHP` | number | Temporary HP (session state); default 0 |
| `hitDiceCurrent` | number/null | Live remaining hit dice; restored during long rests |
| `spellSlots` | array | `{ level, max, used, isPactMagic }[]`; empty = no spellcaster |
| `conditions` | string[] | Active condition names from the 14 standard 5e conditions |
| `exhaustionLevel` | number | 0–6; default 0 |
| `concentration` | object | `{ active: boolean, spell: string }` |
| `inspiration` | boolean | `true` when player has inspiration; default `false`; session state, no-auth write |
| `hp` | number | Legacy field; normalized to hpMax/hpCurrent on read by get.js |
| `hitDice` | string | e.g., "4d10" |
| `armorType` | string | "none" / "light" / "full" / "shield" |
| `armorTotal` | number | Numeric armor class total |
| `spells` | string[] | Key spells / magical abilities (display tags) |
| `skills` | string[] | Manual skill keys such as `athletics`, `stealth` |
| `specialAbilities` | string[] | Manual special-ability keys such as `backstab`, `ritual`, `wild` |
| `inPlay` | string[] | Roleplay behavior traits |
| `playerNotes` | array | `{ id, text, sharedWithDm: boolean, createdAt }[]`; session state, no-auth write via `patchSession`; owner sees all, DM sees only `sharedWithDm === true` |
| `dmNotes` | array | `{ id, text, createdAt }[]`; DM-only; written via `PATCH /characters/{slug}/dm-notes` (DM auth required); never returned by `GET /characters/{slug}` to non-DM callers |
| `levelingMode` | string | `"milestone"` or `"xp"`; controls whether XP UI is shown |
| `xpCurrent` | number | Current XP total; live-adjustable session field |
| `coin` | object | `{ cp, sp, ep, gp, pp }`; live-adjustable wealth totals |
| `coinMode` | string | `"gp"` or `"full"`; controls whether the sheet emphasizes GP only or all denominations |
| `collections` | array | `{ id, label, sections: [{ id, title, type, content?, items? }] }[]` |

---

---

### Player session mode (`/characters/:slug/session` and `/characters/:slug/profile`)

Characters can now be accessed at two dedicated mode URLs:

- **`/characters/:slug/profile`** — redirects to the full character sheet (`/characters/:slug`) for profile editing. In practice, this just navigates to the existing full-sheet page. (Story 28 will add in-session profile editing directly here.)
- **`/characters/:slug/session`** — a new in-session two-column layout optimized for live play; no editing, all writes go via `patchSession` without authentication.

**`CharacterModePage.jsx`** (`src/pages/CharacterModePage.jsx`):
- Route shell that owns data fetching for character data, map library, party status, and initiative public data
- Derives mode from URL path, falls back to `sessionStorage.dnd_mode_${slug}` or `"profile"`
- `setMode(newMode)` persists to sessionStorage and navigates via React Router
- Auto-switches to session mode (once, via `autoSwitchedRef`) when combat is active (entries exist + round > 0) and no stored preference exists
- Polls: `getCharacter`, `getMapLibrary`, `getPartyStatus`, `getInitiativePublic` via `useAdaptivePolling`

**`CharacterSheetSessionMode.jsx`** (`src/features/characterSheet/CharacterSheetSessionMode.jsx`):
Session mode (two-column layout):
- **Left column** (340px sticky, full viewport height): identity strip (portrait circle 56px, 72px + glow on own initiative turn), ability score mod chips (3×2 grid, display only), initiative strip (own entry highlighted with ▸ glyph + "Your Turn", NPC health-tier glow), party status strip (other party members, shows HP bars and palette-colored names)
- **Right column** (scrollable): concentration banner, HP hero card (big optimistic HP with +/− and Damage/Heal modal), conditions section with Manage button (ConditionPickerModal), spell slots (read-only display), inspiration toggle, four sub-tabs
- **Sub-tabs**: `combat` (read-only weapon quick-reference — Attack/Damage buttons are Story 28), `loadout` (simplified 2-column name/qty/attunement grid), `map` (MapViewer), `notes` (SessionNotesSection — read/write via patchSession without auth)
- All session writes via `patchSession(slug, fields, null)` — no auth required
- Sub-tab state stored in `sessionStorage` as `dnd_session_subtab_${slug}` (default `"combat"`)
- Mode toggle in top bar: `❡ Profile` / `⚔ Session` pill buttons
- Mobile-first: single column below 900px with sticky mode row

**New unauthenticated API endpoints**:
- `GET /party/status` (`getPartyStatus.js`) — returns `{ visible: boolean, members[] }` with player-safe projection (slug, name, palette, portraitUrl, hpCurrent, hpMax, tempHP, conditions, concentration, inspiration, deathSaves); returns `{ visible: false, members: [] }` when `partyVisibilityEnabled` is false on the roster
- `GET /initiative/public` (`getInitiativePublic.js`) — returns `{ round, activeTurnIndex, entries[] }` with hidden entries stripped, initiative roll values stripped, and NPC health tiers derived from npc-combat data

**DM party visibility control**:
- `partyVisibilityEnabled` boolean field on the `party-roster` sentinel item (default `true`)
- `GET /party-roster` now returns `partyVisibilityEnabled` in the response when roster exists
- `PUT /party-roster` accepts optional `partyVisibilityEnabled` boolean
- **Manage Party modal** (`ManagePartyModal.jsx`) now has a "Allow players to see party HP and conditions" checkbox that reads/writes `partyVisibilityEnabled` via the party roster endpoint

**sessionStorage keys added**:
- `dnd_mode_${slug}` — `"profile"` | `"session"`, persists selected mode per character
- `dnd_session_subtab_${slug}` — `"combat"` | `"loadout"` | `"map"` | `"notes"`, persists sub-tab per character

---

### DM Campaign (`/dm` — `DmDashboardPage.jsx`)

A dedicated DM session-management view accessible at `/dm`.

**Auth gate**:
- On mount, checks `sessionStorage.getItem("dnd_dm_password")`
- If a cached DM credential exists, the page first shows a full-screen `Checking DM Access` panel with an animated loader while it verifies the credential
- If verification fails or there is no stored credential, the DM password prompt is shown
- On success, stores the DM password and renders the campaign page

**Top bar** (sticky): focuses on navigation/session controls. `Short Rest` and `Long Rest` were removed from the top bar to reduce mobile width pressure; those actions still exist lower on the page in the party-wide actions section. A breadcrumb-style `← Character Library` link sits below the bar.
- `Manage Party` button opens a DM-only roster modal for choosing which library characters are in the active campaign
- World Guide trigger icon (between Manage Party and palette select; same open-book icon as character sheet)

**Party roster model**:
- The campaign party is not implicitly "all characters in the library"
- A separate special record (`slug: "party-roster"`) stores the ordered list of current party member slugs
- If the roster record does not exist yet, the app falls back to "all valid characters" as the initial default
- Updating the roster changes which PCs appear in the party column and which PCs are available to add to initiative
- Removing a PC from the roster also removes that PC's initiative entries so campaign state stays coherent

**Party card strip** (left column, stacked vertically):
- One card per character returned by `GET /dm/party`
- Each card uses the character's own palette for accent stripe, portrait border, name color, and HP bar — providing instant visual identification
- Vellum characters receive a special dark-dashboard treatment so they remain readable on Ocean / other dark campaign themes
- Portrait: 52px circle with image or palette-colored initial letter
- HP display: `hpCurrent / hpMax` numerically; temp HP badge if `tempHP > 0`; card border turns red and HP number turns `#c06060` when below 20%
- **0 HP state** (Story 19): when `hpCurrent === 0`, the card adds a slow-pulsing red glow (`deathGlow` keyframe in `characterCard.css`), and the death saves strip mounts below the Notes section as the card's last element with a 300ms ease-out entrance (max-height + opacity transition).
- **Death saves strip** (Story 19 redesign, brief §3): replaces the mid-card tracker. Mounts only when `hpCurrent === 0`. A 40px footer strip with red wash background (`rgba(192,96,96,0.07)`) and red top border. Layout: "DEATH SAVES" label (IM Fell English 11px uppercase) + success pips + vertical divider + failure pips + chevron disclosure button (right edge). Success pips: green `#5a9a5a` with `rgba(90,154,90,0.4)` empty border. Failure pips: red `#c06060` with `rgba(192,96,96,0.55)` glow. Pip tap: fill up-to-index or correct down. Writes `deathSaves: { successes, failures }` via `patchSession`. Failure fills trigger `dmDeathSaveShake` on the strip.
  - **Shortcut row** (revealed by disclosure chevron ⌃): strip expands to 89px. Left-grouped: NAT 20 (green, sets HP→1 + clears saves in one atomic write) and NAT 1 (red, +2 failures staggered 60ms). Right-aligned: ✦ STABLE (green, clears saves at 0 HP). Chevron rotates 180° when expanded. Auto-collapses after 30s inactivity or on FALLEN/damage-at-0.
  - **Damage-at-0 prompt**: when damage lands on a character already at 0 HP, the pip row is replaced with "+ DAMAGE AT 0" label and three pills: "+1 FAIL" (red, default focus ring), "CRIT +2" (red), "NO FAIL" (neutral). Auto-resolves to No Fail after 12 seconds. Collapses shortcuts first (180ms) before appearing.
  - **FALLEN** (3 failures): strip background deepens to `rgba(192,96,96,0.11)`, top border to `rgba(192,96,96,0.6)`. Pip row replaced by tombstone: "⨯ FALLEN" (Cinzel 13px, `#c06060`; ⨯ in `#a04040`) + three frozen red pips (grayscale filter, no glow). No chevron. Reversible — tapping a frozen pip un-fills failures from that index onward and restores the active pip row.
  - **Stable** (3 successes or ✦ STABLE): saves cleared to 0/0, strip collapses (250ms), card dims to 0.85 opacity.
  - All death save colors are universal (not palette-derived): `#5a9a5a` success / `#c06060` failure. Only the NO FAIL pill uses `var(--pal-text-muted)` as the neutral exit.
  - The Notes strip loses its bottom border-radius when the death saves strip is mounted below it (`has-death-strip-below` CSS class).
- **Inline ±1 HP stepper**: `−` and `+` buttons flanking the HP bar directly on the card. Tapping adjusts HP by 1 immediately (optimistic update). Hold-to-repeat: 500ms initial delay, 80ms repeat interval, using `pointerdown`/`pointerup`/`pointercancel` events. **Debounced flush**: accumulates taps in `pendingDeltaRef` (a `useRef`), fires one `patchSession` 300ms after the last tap — no per-tick API calls. On error, reverts the displayed HP. **Delta indicator**: floating `+N` / `−N` label using the character's `pal.gem` color, animated upward via `@keyframes hpDeltaFloat` injected into the shared `DASHBOARD_CSS` style block.
- **⚔ Damage / ✦ Heal buttons**: always visible below the HP stepper row; each opens a focused `DamageHealModal`:
  - Large number display + `−` / `+` stepper (hold-to-repeat, same 500ms/80ms timing)
  - Six preset jump buttons: 3 · 5 · 8 · 10 · 15 · 20
  - Direct number input
  - Confirm applies optimistically via `patchSession` (no debounce — single submit per modal open); reverts on error
  - Damage modal uses red accent; Heal modal uses green accent
  - Escape or backdrop tap closes without applying
- AC badge showing `armorTotal`
- Condition chips (tappable to remove inline); max 3 shown with "+N more" overflow
- Concentration pulsing dot + spell name when `concentration.active`
- Inspiration gem indicator
- **Skills / Spells / Special Abilities badges**: compact inline badge area below the condition row. All configured talents and spells are shown for quick reference. Each badge exposes an in-app tooltip on hover/focus/click; current tooltip text is just `Type: Name`
- **XP / Coin summary row**: below the talents block, cards show compact campaign-management widgets:
  - XP-tracked characters get an XP progress panel with current total, next threshold, progress bar, and `+` award button
  - All characters get a coin panel with current GP total and a `Give` button
  - These panels stack on narrower widths and sit side by side on wider cards
- **⋯ button** (replaces old `+` circular button): opens `QuickActionPopover` for less-common actions — Add Condition (multi-select), Set Temp HP, Drop Concentration (conditional on active), Short Rest, Long Rest. Damage/Heal have been removed from this popover and promoted to card-level buttons.
- "↗ Sheet" link opens the full character sheet in a new tab
- **DM notes strip**: collapsible strip below the Damage/Heal footer row. Collapsed with no notes: faint "+ Note" label. Collapsed with notes: accent-tinted background + count badge. Expanded: shows DM notes with delete (×), a "Player shared" gem-colored divider followed by read-only italic player-shared notes (if any), and an inline add-note text input. DM notes persist in DynamoDB via `PATCH /characters/{slug}/dm-notes` (DM auth required). Shared player notes from `sharedPlayerNotes` are passed from the party payload. Note state is managed inline in `DmNotesStrip` (`src/features/dmDashboard/characterCard/DmNotesStrip.jsx`, composed by `CharacterCard.jsx`) with manual optimistic updates (no liveSync utility needed).
- When the quick-action popover is open, the entire card is raised above its neighbors so the menu is not clipped by adjacent cards

**Initiative tracker** (right column, 300px):
- Entries persist in explicit array order; the order shown is the order stored
- "Next Turn" advances `activeTurnIndex` mod entries length using an optimistic local update, then confirms with `PUT /initiative`
- **Round counter** (Story 19): shown in the initiative header row alongside "Initiative Order" / "Clear ×". Shows `1` when entries exist, `–` (em dash) when empty. Auto-increments with a brief `accentBright` brighten animation each time "Next Turn" wraps from the last entry back to the first. Manual ± steppers for correction (no hold-to-repeat; no auto-increment animation on manual changes). "Clear ×" resets round to 1 in the same write. `round` lives on the `slug:"initiative"` sentinel item, written atomically with `entries`/`activeTurnIndex`.
- PCs can be added only from the current party roster
- Manual combatant form is reserved for allies, summons, or scene actors that do not need an enemy card
- Reorder/remove controls are hidden by default and appear only after toggling `Modify Order`
- "Clear ×" resets to empty (and resets round to 1)
- Empty state: "No initiative set — add combatants below"
- State persisted in DynamoDB (`slug: "initiative"` item) — now includes `round` field (default 1)

**NPC combat section**:
- Separate column/section for non-player combatants tracked outside the character roster
- NPC cards support HP adjustment, initiative linking, conditions, and active-turn highlighting
- Enemy cards are split into `In Initiative` and `Inactive` sections
- Each enemy card exposes a short initiative toggle:
  - `+ Init` when not currently in initiative
  - `− Init` when already linked into initiative
- Vellum campaign-theme adjustments also apply to NPC surfaces when the overall campaign theme is light
- **NPC notes strip**: same collapsible strip pattern as character cards, attached below the action buttons row. NPC notes are stored inline in the NPC object (`notes: [{ id, text }][]`) and written via `putNpcCombat`. Session-scoped: notes are discarded when "End Combat" is triggered. No `sharedWithDm` — no player-sharing section.
- **NPC ability reference** (Story 23): persistent structured list of abilities/spells on each NPC card. Stored as `abilities: string[]` on the NPC object (optional; absent or old `string` values coerced to array on read). Sits between the conditions row and action buttons row. Three states: (1) empty — quiet "+ Ability reference" affordance; (2) read-collapsed — first 3 entries shown as `◆` list items with "Show all N" + pencil; (3) read-expanded — all entries with "Show less" + pencil; (4) edit mode — removable entry rows + inline add input + Done button. Auto-expands when the NPC is the active initiative turn; auto-collapses on turn-off if not editing. Entries capped at 255 chars; no array-length limit. Written via existing `putNpcCombat` pass-through. No backend changes. DM-only.
- **NPC library** (Story 24 + Story 31): persistent DM-only library of creature templates stored in sentinel item `slug: "npc-library"` with `templates: [{ id, name, abilities: string[], hpMax?: number, portraitUrl?: string, updatedAt }]`.
  - **Portrait circle on NPC cards** (`NpcThumb` helper): 36px circle showing portrait image or color-matched initials fallback. Appears in the card header row, overflow menu delta preview, and library picker rows.
  - **`⋯` overflow menu on each NPC card** (`NpcOverflowMenu` — between `+ Init` and `×`): opens a popover showing `◆ Save to library` or name-conflict resolution (`Update existing entry` / `Save as new entry`). Shows HP delta preview on conflict. After save: `✓ Saved` flash (880ms) before auto-close. CSS classes: `.btn-npc-overflow`, `.npc-overflow-popover`, `.npc-overflow-item`, `.npc-overflow-item-destructive` in `npcCombat.css`.
  - **`◇ From library` toggle in Add Enemy form**: expands a library picker panel — MRU-sorted rows (portrait 32px + name + HP chip + first 2 abilities). Picking pre-fills Name and HP, and stages `portraitUrl`, `abilities`, and `librarySourceId` for the spawned NPCs. Search auto-appears above 20 entries. Per-row two-tap delete with 6-second auto-dismiss. `⚙ Enemies Gallery` link at bottom opens the advance editor modal.
  - **`☑ Number them` toggle**: visible in Add Enemy form when `addCount > 1`. When checked (default `true`), spawned NPCs are suffixed `Name 1`, `Name 2`, …, `Name N`. Preview text `(Name 1–N)` shown inline.
  - **`⚙ Enemies Gallery` modal** (`EnemiesGalleryModal.jsx` in `src/features/dmDashboard/`): advance CRUD editor for the NPC library. Two-pane layout (list rail 220px + entry editor). Features: portrait upload (presign→S3 PUT→store URL), name input, HP input, `AbilitiesListEditor`, ⧉ Duplicate, two-step delete confirm, dirty guard on close. Accessible from `All Actions` dropdown in DM dashboard top bar. CSS prefix: `eg-` in `enemiesGallery.css`. Mobile: single-pane drill-in at 720px breakpoint.
  - **Portrait upload for NPC library** (`npcPortraitPresign.js`): `POST /npc-library/portraits/presign` (DM auth, image-only, 5 MB cap). S3 key `npc-portraits/{uuid}.{ext}` in the `hunkz-dnd-portraits` bucket; public GET via bucket policy on `npc/*`. Returns `{ uploadUrl, id, s3Key, portraitUrl }`.
  - **Spawned NPC provenance**: each NPC spawned from a library template carries `portraitUrl`, `abilities`, and `librarySourceId: template.id`. These pass through `normalizeNpcCombatRecord` via `...npc` spread — no backend schema change needed.
  - **`AbilitiesListEditor`** helper component in `NpcCombatSection.jsx`: shared per-entry array editor (255 char cap). Also used inside `EnemiesGalleryModal`.
  - **MRU**: `updatedAt` stamped per-template at save and at pick; sorted `desc` on each picker open.
  - **Fetch pattern**: mount-fetch only (`getNpcLibrary`); refetch-on-write. Not polled. `handleSaveToLibrary` in `DmDashboardPrototypePage` handles 4-arg dispatch: `(npc, existingEntry)` from overflow, `(null, null, bumpedTemplate)` for MRU bump, `(null, null, null, deleteId)` for delete.
  - New API: `GET /npc-library` (DM auth), `PUT /npc-library` (DM auth, body `{ templates }`), `POST /npc-library/portraits/presign` (DM auth).
  - Backend normalizer `normalizeNpcLibraryRecord` now passes through `hpMax` and `portraitUrl` (Story 31 fix — earlier version silently stripped these fields).
  - New slug `npc-library` in `RESERVED_CHARACTER_SLUGS` — automatically excluded from `list.js` and `dmParty.js`.

**Party-wide actions** (top toolbar + bottom of party column):
- "Short Rest": resets Pact Magic (`isPactMagic`) spell slots for all characters via parallel `patchSession` calls; shows confirmation dialog first
- "Long Rest": resets all spell slots and restores `hpCurrent` to `hpMax` for all characters; shows confirmation dialog first
- "Award XP to Party": shown only when at least one roster member uses XP leveling; opens a modal that can grant XP to the whole roster or selected members with optimistic updates
- "Distribute Coin": opens a modal for granting coin to the party, supporting denomination-level distribution and optimistic updates
- "End Session" button clears `dnd_dm_password` from sessionStorage and returns to auth gate

**DM Dice Roller** (`DmDiceRoller.jsx` — bottom of left/party column):
- Collapsible panel; collapsed by default; open/closed persisted as `sessionStorage.dnd_dice_dm_open`
- Die picker (d4–d100 SVG buttons), count stepper (1–10), flat modifier input, combo builder (double-click or "+ Add Die"), free-form expression input — all reuse shared utilities (`parseDiceExpr`, `rollDie`, `DieShape`) exported from `DiceRoller.jsx`
- Advantage/Disadvantage three-button strip (Normal / Adv. / Disadv.) — **auto-resets to Normal after every roll** (unlike the player roller's sticky toggle)
- **×N repeat**: stepper 1–8; executes N independent rolls in one 600ms animation pass; results displayed as a labeled selectable list ("Roll 1 · 17", "Roll 2 · 9 ✦ CRIT"); crit/fumble detected per row
- **"Apply to…" shortcut**: appears after any pure damage roll (no d20 in expression); one pill button per party member; tapping a pill opens that character's Deal Damage quick-action popover pre-filled with the rolled total; DM still confirms inside the popover before `patchSession` fires; for ×N rolls the DM taps a specific result row to select it, then sees the Apply-to pills for that row's total
- Roll history: last 12 rolls, fading opacity; session-only for DM-originated rolls
- **Shared party roll feed**: character-sheet rolls fetched from `GET /roll-history` are merged into the same history display, sorted by timestamp alongside DM-local rolls
- Shared/player roll rows now use the same visual structure as character-sheet history:
  - expression on the left
  - character name in the character palette color
  - action label in the DM palette/body color
  - per-die results array on the right in muted smaller text
  - large total on the far right, tinted to the character palette
- `QuickActionPopover` contains: Add Condition, Set Temp HP, Drop Concentration (conditional), Short Rest, Long Rest. Short Rest / Long Rest from the popover bubble up as string action tokens (`"shortRest"` / `"longRest"`) through `onUpdate` to the main page which shows the confirm dialog.
- `CharacterCard` accepts `onRegisterOpen` prop to register an external open-with-damage callback (used by DmDiceRoller "Apply to…"); dashboard holds callbacks in a `Map<slug, fn>` ref

**Counter Wheels panel** (`CounterWheelsPanel.jsx` — below Map Panel, above party card strip):
- Collapsible panel for tracking Blades-in-the-Dark-style progress clocks during play
- **Collapse behavior**: mode-aware default — expanded when initiative has entries (combat mode); collapsed otherwise unless ≥1 wheel exists (auto-expands on load if wheels exist). Last manual toggle wins, persisted as `sessionStorage.dnd_wheels_open`
- **Header**: clock glyph (◷), "Counter Wheels" label, count badge (`N active`) when wheels exist but panel is collapsed, `+ Add` shortcut (expands panel and opens create form), collapse chevron
- **SVG wheels**: rendered declaratively from `filledCount` (0..segments). Each wheel is a full pie-slice radial with a center hub ring. Fill model: fill-to-here clockwise (Blades-classic) — tap segment N fills all 1..N; tap a filled segment N to set filledCount = N-1. Segment separators are `<line>` elements at each boundary. `<radialGradient>` uses CSS custom props `var(--pal-accent-bright)` → `var(--pal-accent)` for filled segments; completed wheels switch to fixed gold stops (`#f2e8d2` → `#c8ae84`)
- **Wheel states**: empty segments → `var(--pal-surface-solid)`; filled → gradient + drop-shadow glow; completed (N/N) → gold gradient + completion pulse animation (`wheelCompletePulseScale` on wrapper, `wheelCompletePulse` on SVG)
- **Per-wheel ⋯ menu**: Rename (inline input, autofocus, commit on Enter/blur, Esc reverts), Reset (clockwise de-fill sweep, 25ms stagger), divider, Remove (no confirm, red `#c06060`). One menu open at a time; closes on outside click or Esc. Flip-up near panel bottom edge
- **Inline creation form**: shown at grid start (spans full width), not a modal. Name input (autofocus, defaults `Counter N` on empty), segment stepper 1–12 default 6, live mini-preview SVG, Cancel/Create Wheel
- **Animations** (all disabled under `prefers-reduced-motion`): cell entrance (0.2s ease-out scale), cell exit (0.14s ease-out scale+opacity), reset sweep (25ms/segment stagger), completion pulse (0.42s ease-in-out)
- **Activity log**: wheel creation appends a `type: "wheel"` entry to the shared roll-history feed via the PUT handler. Rendered by `RollHistoryRow` as: `◷` glyph in `pal.accent` + italic name + muted `— N segments`; no numeric total
- **Data**: `{ id, name, segments, filledCount }` per wheel; stored as `slug: "counter-wheels"` sentinel; NOT cleared by End Combat; fetched on mount + written after every change (debounced 300ms); optimistic update with rollback on failure

**Map panel** (top of party column, collapsible):
- Collapsible header showing "Map" label + active map name when collapsed; pulsing green dot when a map is active
- Expanded body: `MapViewer` component at 300px height showing the active map, with "Clear" and "Library" buttons
- Empty state: "No active map" message with "Upload a Map" / "Choose from Library" button
- Library button opens `MapLibraryModal` for full library management (set active, rename, delete, upload)

**Map Library Strip** (below the grid, full width):
- Horizontally scrollable row of 80×60px thumbnails with "Set Active" buttons
- Active map card shows a green dot badge
- "+" Upload button at left end; entire strip is a drag-drop zone
- Drag-and-drop opens `MapUploadModal` pre-loaded with dropped file

**Polling**: `getDmParty`, `getInitiative`, `getNpcCombat`, `getRollHistory`, and `getMapLibrary` are polled adaptively per ADR-011 (`1s` while visible/focused, `5s` while backgrounded). Successful writes queue immediate background refreshes. Polling clears on unmount. `getNpcLibrary` is intentionally NOT polled — mount-fetch + refetch-on-write only (single-writer access pattern; see Story 24 ADR-011 opt-out note).

**Visual style**: Ocean palette chrome throughout (`#0d0f14` bg, `#6a8fa8` accent). Responsive: stacks to single column below 900px.

---

---

### Map Library page (`/maps` — `MapLibraryPage.jsx`)

DM-only page. Auth gate: checks `sessionStorage.dnd_dm_password`; if missing, shows `DmLoginPrompt`. Full-page drag-drop zone: dropping an image file opens the upload modal.

- Page header: "Map Library" in Cinzel + "Upload" button + "← Campaign" breadcrumb link to `/dm`
- Primary content: `<MapLibraryModal asPage={true} />` — full thumbnail grid of library maps
- Each card: thumbnail, name (or filename-derived fallback), Set Active button, Rename (inline), Delete (inline confirm)
- Upload button opens `MapUploadModal`
- Data: one-shot `getMapLibrary()` fetch on mount (no live polling — management page, not live session)

### Map tab on character sheet

- Fourth tab in the tab strip (`combatTab === "map"`), always rendered
- When a map is active: `MapViewer` at 500px height (or `calc(100vh - 160px)` on mobile ≤560px)
- When no map is active: quiet "The DM hasn't loaded a map yet." message
- Active map data comes from `useAdaptivePolling(getMapLibrary)` in `CharacterPage.jsx`, passed as `activeMap` prop through `CharacterSheet` → `CharacterSheetViewMode`

### Map components

- **`MapViewer`** (`src/features/maps/MapViewer.jsx`): reusable pan/zoom image viewer. Props: `{ imageUrl, name, height, pal }`. Pure CSS transforms (`translate/scale` on `<img>`), no canvas or external library. Mouse drag to pan, scroll to zoom (clamped 0.5–5×). Touch: single-finger pan, pinch-to-zoom. Overlay controls: +/−/⟳ buttons + zoom % label. Fading "Drag to pan · Scroll to zoom" hint.
- **`MapPanel`** (`src/features/dmDashboard/MapPanel.jsx`): collapsible panel for DM party column.
- **`MapLibraryStrip`** (`src/features/dmDashboard/MapLibraryStrip.jsx`): horizontal thumbnail strip below dashboard grid.
- **`MapUploadModal`** (`src/features/dmDashboard/MapUploadModal.jsx`): presign → S3 PUT → postMap flow with progress bar, name input, size warning.
- **`MapLibraryModal`** (`src/features/dmDashboard/MapLibraryModal.jsx`): grid of map cards with inline rename/delete. Used both as modal (dashboard) and inline page content (MapLibraryPage via `asPage={true}`).

### Map library data model

Stored as a sentinel DynamoDB item `slug: "map-library"`:
```js
{
  slug: "map-library",
  activeMapId: string | null,
  maps: [{ id, name, s3Key, imageUrl, uploadedAt }],
  updatedAt: string
}
```
S3 path: `maps/{uuid}.{ext}` in the `hunkz-dnd-portraits` bucket (public GET allowed via bucket policy on `maps/*`).

Filtered from `list.js` and `dmParty.js` via `filterPublicCharacterItems()` in `specialItems.js` (single source of truth — no handler-level filter needed).

### Map API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /maps | None | Returns `{ activeMapId, maps[] }` |
| POST | /maps/presign | DM | Returns presigned S3 PUT URL + `{ id, s3Key, imageUrl }` |
| POST | /maps | DM | Appends map entry to DynamoDB sentinel item |
| PUT | /maps/active | DM | Sets or clears `activeMapId` |
| PATCH | /maps/{mapId} | DM | Renames a map entry |
| DELETE | /maps/{mapId} | DM | Removes from DynamoDB + deletes S3 object (best-effort) |

---

---

### World Guide Browser (`WorldGuideDrawer.jsx`, `WorldGuideTrigger.jsx`)

A right-edge slide-in drawer providing in-session reference to the campaign world guide. Accessible from both the character sheet top bar and the DM dashboard top bar via an open-book SVG icon (44px touch target).

**Trigger**: `WorldGuideTrigger` component — open-book SVG, 20×20 within a 44px target. Color: `pal.textMuted` default, `pal.accent` on hover, `pal.accentBright` when open. Class `.guide-trigger` defined in `worldGuide.css`.

**Drawer dimensions**: 440px fixed (desktop ≥1100px, no scrim), 420px (tablet 700–1099px, 0.4 scrim tap-to-close), 100vw (mobile <700px). `position: fixed`, z-index 1100. Scrim z-index 1099. Slide animation: open 260ms `cubic-bezier(0.2,0.8,0.2,1)`, close 220ms `cubic-bezier(0.4,0,0.6,1)`. Instant on `prefers-reduced-motion`.

**Palette**: `pal` object passed as prop; `--pal-*` CSS variables set inline on the drawer element (same pattern as `ItemEditorModal`). Inherits from whichever palette the mount surface uses.

**Content**: Static markdown files under `public/world-guide/`. `toc.json` fetched on first open from `/world-guide/toc.json`. Individual sections fetched lazily from `/world-guide/{file}`. Per-session in-memory cache (`useRef(Map)`) prevents re-fetches.

**TOC structure**: Two-level hierarchy. Top-level entries are chapter rows (Cinzel 16px). The Gazetteer section (`file: null`) expands in-place to reveal 56+ realm entries with a substring filter input. Other chapters with `children` (Folk, Geography, Power Groups, Gods) expand their child list in-place — tapping the chapter row navigates to the index file, the chevron expands children. Chapters without children navigate directly on tap.

**Reading view**: Cross-fades from TOC (90ms out, 160ms in, 60ms delay). Sticky header with "‹ Back to Guide" (left) and × close (right). Section title (Cinzel 22px) + breadcrumb (parent name). Body in Crimson Text 16px, line-height 1.8. Subheadings `##`/`###` in Cinzel 18/16px, `####` in Cinzel 14px. Unordered lists use ◆ diamond bullets.

**Markdown renderer**: Hand-written, no library. Supports: `#` title (stripped to section header), `##`/`###`/`####` headings, paragraphs, `**bold**`, `*italic*`, `` `code` ``, `- / *` unordered lists, `1.` ordered lists, `[text](url)` links (`.md` links intercepted for in-drawer navigation; external links open new tab).

**Session persistence** (`sessionStorage` keys):
- `dnd_guide_open` — drawer open/closed (written on change; cleared to `false` on unmount)
- `dnd_guide_section` — last-viewed file path (powers Resume row)
- `dnd_guide_scroll_${file}` — scroll position per section, throttled 250ms; cleared on Back
- `dnd_guide_gazetteer_expanded` — Gazetteer expansion state

**Resume row**: shown at top of TOC when `dnd_guide_section` is set. Tapping restores the section and its saved scroll position.

**Keyboard**: `Esc` closes the drawer when open.

**Error states**: TOC fetch fail → retry button in drawer. Section fetch fail → title/breadcrumb visible, body shows retry (Back still works).

**Files**:
- `src/features/worldGuide/WorldGuideDrawer.jsx` — drawer shell, all state, TOC view, reading view, markdown renderer
- `src/features/worldGuide/WorldGuideTrigger.jsx` — icon button, `open` + `onToggle` props
- `src/features/worldGuide/worldGuide.css` — all drawer styles, slide animation, typography, responsive breakpoints

---

## Known gaps (not yet built)

- **Death save tracking**: display-only bubbles shown at 0 HP; write logic not yet implemented (story 06)
- **No true push multiplayer transport**: live sync uses adaptive polling plus optimistic writes rather than WebSockets/AppSync. Shared updates appear across player sheets and the DM campaign page, but not via a dedicated push channel
- **No public vs. private view split** (planned feature per memory/project_goals.md)
- **Skill / spell / special ability tooltips are minimal**: current tooltip content only shows type + name. Rich descriptions, stat effects, and mechanical details are not yet modeled for spells and are only partially modeled for skills / special abilities
- **Party roster is single-campaign only**: there is one global ordered roster record. Multiple campaigns / benches / alternate parties are not modeled yet

---

## Auth model

- **Owner**: per-character bcrypt hash stored in DynamoDB; unlocks edit mode for that character; session cached in `sessionStorage` as `dnd_char_${slug}`
- **DM**: single bcrypt hash from SSM Parameter Store (`/dnd/dm-password-hash`); unlocks edit mode for all characters; session cached in `sessionStorage` as `dnd_dm_password`
- Both sessions clear on tab close (sessionStorage semantics)
- Auto-unlock on sheet load: tries DM session first, then character session; if either verifies, the sheet unlocks silently (no prompt shown)
- Unlock prompt: modal overlay in `pal.surfaceSolid`; shows character name; Cancel + Unlock buttons
- Session state fields (HP current, conditions, etc. — planned): intentionally writable without auth per ADR-005 (see story 01)
