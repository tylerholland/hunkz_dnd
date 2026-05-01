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
- DM login button (top right): opens a modal password prompt; verifies against the API; stores DM session in `sessionStorage` as `dnd_dm_password`; shows "DM ✓ · End Session" when active
- **DM Dashboard link** (top right, only visible when DM is authenticated): `<Link to="/dm">` rendered next to the DM session buttons; navigates directly to `/dm`
- "New Character" card at the end of the grid: dashed border, navigates to `/characters/new`

---

### Character sheet — VIEW mode

The full sheet is hidden behind a password prompt until unlocked. On load, the sheet automatically tries to unlock using the stored DM password (`sessionStorage.dnd_dm_password`) or the stored character password (`sessionStorage.dnd_char_${slug}`), showing a spinner while it checks. If no stored credential matches, a "🔒 Unlock with password" button appears.

The top bar (always visible, no auth required) contains:
- `← All Characters` link (back to list)
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

3. **Key Spells & Abilities**: rendered as pill-style tags (border + accent color, fontUI)

4. **Three-tab strip: Inventory | Persona | Combat** — full-width icon+label tab strip (64px tall, SVG icon above label text, IM Fell English 13px uppercase tracked); active tab shows `pal.accentDim` background + `pal.accent` border + `pal.accentBright` text/icons; tab state stored in `sessionStorage` as `dnd_tab_${slug}`, default `"combat"`
   - **Inventory tab** (`combatTab === "loadout"`): two-column `.loadout-grid` (collapses to 1 column at 560px)
     - Weapons column: each weapon is an expandable row — name + mod chips; tap to expand description below if present; ▼/▲ indicator
     - Equipment column: same pattern — name + optional type tag + mod chips; expandable description
   - **Persona tab** (`combatTab === "persona"`): unordered list in a responsive auto-fill grid; each item prefixed with a ◆ diamond bullet; fontBody, 16px. Empty state message if no traits. Corresponds to the `inPlay[]` array.
   - **Combat tab** (`combatTab === "combat"`): live-session resource surface; no password required to update any value
     - **Concentration banner**: shown only when `concentration.active`; pulsing dot + "Concentrating on [spell]" + "Drop Concentration" button; hidden entirely when not concentrating
     - **Concentration set input**: text input + "Set Concentration" button; shown only when not concentrating
     - **Inspiration toggle**: glowing gem circle + "Inspiration" label + "Active" badge when `char.inspiration` is true; tap to toggle (writes via `patchSession`)
     - **Condition grid**: all 14 standard conditions as toggleable pill buttons; Exhaustion level stepper (0–6); "Clear All Conditions" button when any are active
     - **Spell Slots**: per-level bubble rows (available/used); Long Rest + Short Rest buttons; shown only if `spellSlots` configured
     - **Weapons quick-reference**: collapsed rows showing weapon name + to-hit + damage; tap to expand description; read-only (editing is in Inventory tab)
     - **Dice Roller** (`DiceRoller.jsx`): collapsible section at the bottom of the Combat tab (collapsed by default; state stored in `sessionStorage` as `dnd_dice_open_${slug}`). Contains:
       - **Advantage/disadvantage strip**: Normal / Advantage / Disadvantage toggle; applies to all d20 rolls until changed; resets on page reload
       - **Weapon roll buttons**: one row per weapon that has an Attack Bonus or Damage mod; ATK button rolls 1d20 + attack bonus (respects adv/dis, triggers crit/fumble); DMG button parses the damage expression (`parseDiceExpr`) and rolls all dice groups
       - **Ability check circles**: six tappable stat circles (STR/DEX/CON/WIS/INT/CHA); each rolls 1d20 + computed ability modifier (same formula as rest of sheet); respects adv/dis
       - **Free dice picker**: 7 SVG die buttons (d4, d6, d8, d10, d12, d20, d100); count stepper 1–10; single-click selects primary die, double-click adds one to combo; "+ Add Die" adds current count+type to the pending combo expression; flat modifier input; big "Roll" button
       - **Expression text input**: accepts freeform expressions like `2d6+1d4+3`; overrides picker on roll when non-empty; Enter key triggers roll
       - **Result display**: single-die or multi-group layout; CSS-only spin animation (1050ms); staggered group reveal for combos; gold crit / red fumble number glow + label; advantage/disadvantage shows both d20 results with discarded value struck through
       - **Roll history**: last 5 rolls (most recent at top); fade: 100% / 45% / 22% / hidden / hidden; session-only (not persisted)

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
9. **Persona Traits**: dynamic list of text inputs with ×-remove buttons; `+ Add Trait` button at bottom (formerly labeled "In Play Traits")
10. **Weapons**: list of weapon rows (name + modifier summary); `Edit` and `×` per row; `+ Add Weapon` button → opens **ItemEditorModal**
11. **Equipment**: same as weapons but includes optional `Type` field; `+ Add Item` button → opens **ItemEditorModal** with `showType: true`
12. **Change Password** (existing characters only, separated by divider): two-column new/confirm inputs; "Update Password" button; note that blank password removes protection
13. **Collections & Sections**: dynamic editor for the backstory/persona collections:
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
- Name field (always) + Type field (equipment only, optional)
- Description textarea ("shown on tap" hint)
- Modifiers section: dynamic list of `[attribute select] [value input] [×]` rows; attribute options from `MOD_ATTRIBUTES` constant; `+ Add Mod` dashed button
- Cancel + Save Changes / Add Item buttons

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
  hp: 0, hitDice: "", armorType: "", armorTotal: 0,
  spells: [],      // string[] — spell/ability names, comma-separated input
  inspiration: false,  // boolean — toggled in Combat tab, no auth required
  inPlay: [],      // string[] — roleplay behavior traits (shown on Persona tab)
  weapons: [],     // { id, name, description, mods: [{ attribute, value }] }[]
  equipment: [],   // { id, name, type?, description, mods: [{ attribute, value }] }[]
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
| `weapons` | array | `{ id, name, description, mods[] }` |
| `equipment` | array | `{ id, name, type?, description, mods[] }` |
| `hpMax` | number | Max HP (edit-mode only) |
| `hpCurrent` | number | Current HP (session state, no-auth write) |
| `tempHP` | number | Temporary HP (session state); default 0 |
| `spellSlots` | array | `{ level, max, used, isPactMagic }[]`; empty = no spellcaster |
| `conditions` | string[] | Active condition names from the 14 standard 5e conditions |
| `exhaustionLevel` | number | 0–6; default 0 |
| `concentration` | object | `{ active: boolean, spell: string }` |
| `inspiration` | boolean | `true` when player has inspiration; default `false`; session state, no-auth write |
| `hp` | number | Legacy field; normalized to hpMax/hpCurrent on read by get.js |
| `hitDice` | string | e.g., "4d10" |
| `armorType` | string | "none" / "light" / "full" / "shield" |
| `armorTotal` | number | Numeric armor class total |
| `spells` | string[] | Key spells/abilities (display tags) |
| `inPlay` | string[] | Roleplay behavior traits |
| `collections` | array | `{ id, label, sections: [{ id, title, type, content?, items? }] }[]` |

---

---

### DM Dashboard (`/dm` — `DmDashboardPage.jsx`)

A dedicated DM session-management view accessible at `/dm`.

**Auth gate**: On mount, checks `sessionStorage.getItem("dnd_dm_password")`. If absent or stale, shows a centered password prompt (same style as the DM login modal on the character list page). On successful verification, stores the DM password and renders the dashboard.

**Top bar** (sticky): includes a `← Characters` link back to `/` in addition to existing Short Rest, Long Rest, and End Session controls.

**Party card strip** (left column, stacked vertically):
- One card per character returned by `GET /dm/party`
- Each card uses the character's own palette for accent stripe, portrait border, name color, and HP bar — providing instant visual identification
- Portrait: 52px circle with image or palette-colored initial letter
- HP display: `hpCurrent / hpMax` numerically; temp HP badge if `tempHP > 0`; card border turns red and HP number turns `#c06060` when below 20%
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
- **⋯ button** (replaces old `+` circular button): opens `QuickActionPopover` for less-common actions — Add Condition (multi-select), Set Temp HP, Drop Concentration (conditional on active), Short Rest, Long Rest. Damage/Heal have been removed from this popover and promoted to card-level buttons.
- "↗ Sheet" link opens the full character sheet in a new tab

**Initiative tracker** (right column, 300px):
- Entries sorted by initiative descending; current turn highlighted in ocean accent
- "Next Turn" advances `activeTurnIndex` mod entries length, calls `PUT /initiative`
- Add combatant form: name + initiative number + "Add" button; NPC entries tagged
- "×" remove button per entry; "Clear ×" resets to empty
- Empty state: "No initiative set — add combatants below"
- State persisted in DynamoDB (`slug: "initiative"` item)

**Party-wide actions** (top toolbar + bottom of party column):
- "Short Rest": resets Pact Magic (`isPactMagic`) spell slots for all characters via parallel `patchSession` calls; shows confirmation dialog first
- "Long Rest": resets all spell slots and restores `hpCurrent` to `hpMax` for all characters; shows confirmation dialog first
- "End Session" button clears `dnd_dm_password` from sessionStorage and returns to auth gate

**DM Dice Roller** (`DmDiceRoller.jsx` — bottom of left/party column):
- Collapsible panel; collapsed by default; open/closed persisted as `sessionStorage.dnd_dice_dm_open`
- Die picker (d4–d100 SVG buttons), count stepper (1–10), flat modifier input, combo builder (double-click or "+ Add Die"), free-form expression input — all reuse shared utilities (`parseDiceExpr`, `rollDie`, `DieShape`) exported from `DiceRoller.jsx`
- Advantage/Disadvantage three-button strip (Normal / Adv. / Disadv.) — **auto-resets to Normal after every roll** (unlike the player roller's sticky toggle)
- **×N repeat**: stepper 1–8; executes N independent rolls in one 600ms animation pass; results displayed as a labeled selectable list ("Roll 1 · 17", "Roll 2 · 9 ✦ CRIT"); crit/fumble detected per row
- **"Apply to…" shortcut**: appears after any pure damage roll (no d20 in expression); one pill button per party member; tapping a pill opens that character's Deal Damage quick-action popover pre-filled with the rolled total; DM still confirms inside the popover before `patchSession` fires; for ×N rolls the DM taps a specific result row to select it, then sees the Apply-to pills for that row's total
- Roll history: last 10 rolls, fading opacity; session-only (not `sessionStorage`)
- `QuickActionPopover` contains: Add Condition, Set Temp HP, Drop Concentration (conditional), Short Rest, Long Rest. Short Rest / Long Rest from the popover bubble up as string action tokens (`"shortRest"` / `"longRest"`) through `onUpdate` to the main page which shows the confirm dialog.
- `CharacterCard` accepts `onRegisterOpen` prop to register an external open-with-damage callback (used by DmDiceRoller "Apply to…"); dashboard holds callbacks in a `Map<slug, fn>` ref

**Polling**: `getDmParty` and `getInitiative` both polled every 2 seconds while mounted (ADR-011). Polling clears on unmount.

**Visual style**: Ocean palette chrome throughout (`#0d0f14` bg, `#6a8fa8` accent). Responsive: stacks to single column below 900px.

---

## Known gaps (not yet built)

- **Death save tracking**: display-only bubbles shown at 0 HP; write logic not yet implemented (story 06)
- **No real-time multiplayer / shared state** (planned: 2-second polling per ADR-011; implemented in DM dashboard, not yet in player sheets)
- **No public vs. private view split** (planned feature per memory/project_goals.md)

---

## Auth model

- **Owner**: per-character bcrypt hash stored in DynamoDB; unlocks edit mode for that character; session cached in `sessionStorage` as `dnd_char_${slug}`
- **DM**: single bcrypt hash from SSM Parameter Store (`/dnd/dm-password-hash`); unlocks edit mode for all characters; session cached in `sessionStorage` as `dnd_dm_password`
- Both sessions clear on tab close (sessionStorage semantics)
- Auto-unlock on sheet load: tries DM session first, then character session; if either verifies, the sheet unlocks silently (no prompt shown)
- Unlock prompt: modal overlay in `pal.surfaceSolid`; shows character name; Cancel + Unlock buttons
- Session state fields (HP current, conditions, etc. — planned): intentionally writable without auth per ADR-005 (see story 01)
