# DM Campaign Dashboard — Design Brief

> Comprehensive layout and interaction redesign for the primary DM session screen (`/dm`).
> Produced by the design-strategist agent. Implementation spec for the ux-designer.

---

## 1. Design intent

The DM Campaign Dashboard is a **command-and-control surface for a cognitively overloaded operator**. The DM is narrating, adjudicating, watching player faces, and managing six enemy HP values simultaneously. This page must reduce that cognitive load, not add to it.

The emotional goal: **calm authority**. The dashboard should feel like a well-organized cockpit — every instrument in its place, every reading legible at a glance, nothing demanding attention unless something has changed. The healthy-party, no-combat state should be sparse and quiet. The active-combat state should surface exactly the information the DM needs, in the order they need it, without the DM having to hunt for anything.

The functional goal: **zero-scroll combat management**. During an active combat encounter, the DM should be able to see all party HP, the dice roller, all enemy HP, and the current initiative turn without scrolling on a 1200px+ desktop viewport. Everything else — maps, coin, XP, notes — can scroll off-screen or collapse when combat is active.

The mental model: **the page has two modes** — exploration (party overview, map reference, session prep) and combat (HP tracking, conditions, initiative, dice rolling). The layout adapts between these modes, surfacing combat tools when combat is active and receding them when it is not.

---

## 2. Layout architecture

### The fundamental layout problem

The current three-column layout (`party | enemies | initiative`) treats all three columns as permanent equals. This is wrong. During exploration, the enemies and initiative columns are empty shells consuming 50% of screen width. During combat, the party column is too wide relative to the enemies — the DM interacts with enemy HP just as frequently as party HP, but enemies get a narrower column.

### Proposed layout: two-panel adaptive with combat columns

The page uses a **two-panel base layout** that grows into **three columns** when combat is active.

```
NON-COMBAT STATE:
┌─────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: ← Library · Campaign · [palette] · Manage Party · End Session │
├────────────────────────────────────────────┬────────────────────────────┤
│                                            │                            │
│  MAP PANEL (collapsible)                   │  DICE ROLLER               │
│                                            │  (docked, collapsible)     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─             │                            │
│                                            │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│  PARTY CARDS (stacked)                     │                            │
│  ┌──────────────────────────┐              │  INITIATIVE                │
│  │ Aragorn — compact card   │              │  (empty state: quiet)      │
│  └──────────────────────────┘              │                            │
│  ┌──────────────────────────┐              │                            │
│  │ Eoghan — compact card    │              │                            │
│  └──────────────────────────┘              │                            │
│  ┌──────────────────────────┐              │                            │
│  │ Aesop — compact card     │              │                            │
│  └──────────────────────────┘              │                            │
│                                            │                            │
│  PARTY-WIDE ACTIONS (strip)                │                            │
│                                            │                            │
├────────────────────────────────────────────┴────────────────────────────┤
│ MAP LIBRARY STRIP (horizontal thumbnails, full-width)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

```
COMBAT-ACTIVE STATE:
┌─────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: ← Library · Campaign · [palette] · [⋯ Party] · End Session    │
├──────────────────┬──────────────────────────┬───────────────────────────┤
│                  │                          │                           │
│  PARTY CARDS     │  DICE ROLLER             │  INITIATIVE               │
│  (combat mode)   │  (expanded, full height) │  (active turn highlighted)│
│  ┌──────────────┐│                          │                           │
│  │ Aragorn      ││  ┌────────────────────┐  │  [Next Turn]              │
│  │ 31/44 ████░░ ││  │ [d4][d6][d8][d10] │  │  ────────────────────     │
│  │ [Poisoned ×] ││  │ [d12][d20][d100]  │  │  ▸ Aragorn         18    │
│  │ Slots 1:●●○  ││  │ ×[3]  Mod:[+5]   │  │    Goblin A        14 ●  │
│  └──────────────┘│  │ Adv: [N] [A] [D]  │  │    Eoghan           12   │
│                  │  │ [ expression     ] │  │    Goblin B          9 ●│
│  ┌──────────────┐│  │ [   Roll 2d8+3   ]│  │    Aesop             7   │
│  │ Eoghan       ││  │                    │  │    Goblin C          5 ●│
│  │ 22/38 ████░░ ││  │ Result: 14         │  │                           │
│  │ ● Conc: Shld ││  │ Apply: [Ara] [Eog]│  │  ── ENEMIES ──            │
│  │ Slots 1:●○○  ││  │                    │  │  ┌───────────────────┐   │
│  └──────────────┘│  │ History:           │  │  │ Goblin A   14/22  │   │
│                  │  │  2d8+3 ×3 → 14,11 │  │  │ ████████░░░░░░    │   │
│  ┌──────────────┐│  │  1d20+5   → 17    │  │  └───────────────────┘   │
│  │ Aesop        ││  └────────────────────┘  │  ┌───────────────────┐   │
│  │ 38/38 ██████ ││                          │  │ Goblin B    0/22  │   │
│  │ ★ Inspired   ││                          │  │ ░░░░░░░░░ DEAD    │   │
│  │ Slots 1:●●●● ││                          │  └───────────────────┘   │
│  └──────────────┘│                          │  ┌───────────────────┐   │
│                  │                          │  │ Goblin C   22/22  │   │
│                  │                          │  │ ████████████████  │   │
│                  │                          │  └───────────────────┘   │
│                  │                          │  [+ Add Enemy]           │
│                  │                          │  [End Combat]            │
├──────────────────┴──────────────────────────┴───────────────────────────┤
│ (map library strip hidden during combat)                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Column proportions

**Non-combat (2-column):**
- Left column (party + map): `1fr` (fluid, takes remaining space)
- Right column (dice + initiative): `340px` fixed

**Combat-active (3-column):**
- Left column (party): `300px` minimum, flex-shrink allowed
- Middle column (dice roller): `1fr` (takes remaining space — the roller is wide and expressive)
- Right column (initiative + enemies): `320px` fixed

The dice roller occupies the middle column during combat because it is the widest, most interactive panel — die picker grid, expression input, repeat controls, advantage strip, result display, apply-to pills, and history. It needs breathing room. Enemy cards are structurally narrow (name + HP bar + action buttons) and fit naturally in a fixed-width column alongside the initiative list.

The transition between 2-column and 3-column is triggered by the presence of NPC combatants in the `npc-combat` state. When `npcs.length > 0`, the layout shifts. When NPCs are cleared (End Combat), the layout returns to 2-column.

### Why this layout

1. **Non-combat is clean.** The enemies and initiative columns don't waste space when empty. The party cards spread into the available width, making them more readable.
2. **Combat puts the action surface in the center.** The DM's workflow during combat: glance left (my team's HP) → roll in the center (the dice roller is always visible, never scrolled off) → glance right (whose turn, enemy HP). The dice roller sits between allies and enemies — the neutral action surface between the two sides of combat.
3. **Enemies and initiative share the right column.** Initiative tells you whose turn it is; enemy cards show enemy state. Both are "the other side" — they belong together. The initiative list (6-8 short rows) sits above the enemy cards, so the DM reads top-to-bottom: turn order → enemy status.
4. **The map recedes during combat.** The DM set the map before combat started. During combat, the map is for players to reference on their own sheets; the DM needs the screen space for HP tracking.

---

## 3. Combat vs. non-combat states

This is the most important design decision in the dashboard. The current page has no concept of modes — it looks identical whether the DM is running a fight or chatting at an inn. The result is permanent clutter (empty enemy column) or permanent loss of space (party column too narrow because enemies column exists).

### State detection

Combat is active when `npcCombat.npcs.length > 0`. This is the single source of truth. The DM explicitly starts combat by adding enemies and explicitly ends it with "End Combat." There is no implicit detection.

### Non-combat state

- **Layout**: 2-column (party + sidebar)
- **Map panel**: expanded by default (the DM is likely referencing a region map during exploration)
- **Party cards**: full tier 1 + tier 2 content visible (HP, conditions if any, XP, coin)
- **Dice roller**: collapsed in the sidebar, available but not prominent
- **Initiative panel**: minimal empty state — a single line "No initiative — add combatants to begin" with an "Add" button. Does not consume vertical space.
- **Party-wide actions**: visible strip below party cards (Short Rest, Long Rest, Award XP, Distribute Coin)
- **NPC section**: does not render at all — no empty column, no "no enemies" placeholder
- **Map library strip**: visible, full-width horizontal strip below the main grid
- **DM palette selector**: visible in top bar, controls page chrome only (top bar, sidebar headers, dice roller panel, initiative panel). Character cards always use their own palette. Default: Ocean.

### Combat-active state

- **Layout**: 3-column (party | dice roller | initiative + enemies)
- **Map panel**: auto-collapses to header-only (pulsing green dot if active map set). One tap to re-expand.
- **Party cards**: tier 1 only (HP, conditions, concentration, spell slots, saves). Tier 2 (XP, coin) auto-hides. The DM can expand a specific card's Tier 2 via a per-card "show more" toggle if needed (e.g., to narrate "the goblin drops a pouch of 50 gold"), but it defaults to hidden during combat.
- **Dice roller**: auto-expands in the middle column. Shows the die picker, expression input, advantage strip, and roll button immediately. The DM can collapse it with one tap if they prefer physical dice, but the cost of an unwanted expand is lower than the cost of needing to manually expand every combat.
- **Initiative panel**: fully visible at the top of the right column, active turn highlighted, "Next Turn" button prominent
- **Party-wide actions**: collapse into a `⋯ Party` overflow button in the top bar (right side, before "End Session"). Rest and award actions are rare mid-combat; they don't deserve permanent strip space. The top-bar placement saves vertical space in the party column where every pixel matters.
- **NPC section**: right column, below the initiative list
- **Map library strip**: hidden. The DM chose their map before combat. Hiding it entirely reclaims vertical space. It restores automatically when combat ends.

### Transition animation

**Combat begins** (first NPC added):
- Middle column (dice roller) slides in, `transform: translateX(-50%) → translateX(0)`, `opacity: 0→1`, 300ms ease-out
- Right column reorganizes: initiative stays, enemy cards appear below with staggered fade-in (100ms per card, 50ms stagger)
- Map panel slides closed (max-height transition, 250ms)
- Party-wide actions strip fades and collapses (opacity 1→0, max-height to 0, 200ms)
- Tier 2 content on party cards fades and collapses per-card (200ms, staggered 40ms per card)
- Dice roller auto-expands in the middle column (300ms ease-out, starts 200ms after combat begins)
- Map library strip fades out and collapses (opacity 1→0, max-height to 0, 200ms)

**Combat ends** (End Combat confirmed):
- Middle column slides out, 250ms ease-in
- Right column simplifies: enemy cards fade out, initiative returns to its non-combat minimal state
- Map panel slides open if a map was active, 300ms
- Party-wide actions strip fades in, 200ms
- Tier 2 content on party cards fades in, 200ms
- Map library strip fades in and expands, 200ms

These transitions are not decorative. They communicate to the DM: "the page is reorganizing because your context changed." The DM should never look at the screen and wonder "where did the enemy column go" — the slide-out tells them.

---

## 4. Section-by-section hierarchy

### Tier classification

| Section | Tier | Rationale |
|---|---|---|
| Party cards (HP, conditions) | 1 | Combat-critical. DM checks every round. |
| NPC/Enemy cards (HP, conditions) | 1 | Combat-critical. DM checks every round. |
| Initiative tracker | 1 | Combat-critical. "Whose turn is it?" is asked every 30 seconds. |
| Dice roller | 1 (combat) / 2 (non-combat) | Used every round during combat. Rarely used during exploration. |
| Map panel | 2 (non-combat) / 3 (combat) | Reference during exploration. Set-and-forget during combat. |
| Party-wide actions | 2 | Used 1-2 times per session, never mid-round. |
| XP / Coin strips | 2 | Administrative. Post-encounter or between-session. |
| DM Notes | 3 | On-demand. DM opens when they need to write or read. |
| Map library strip | 3 | On-demand. DM accesses when switching maps. |

### Desktop wireframe — Non-combat state

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ① ← Library    CAMPAIGN                     [Manage Party] [End Session]│
├─────────────────────────────────────────────┬────────────────────────────┤
│ ②                                           │ ⑥                         │
│ ┌─── MAP ──────────────────────────────┐    │ ┌── DICE ROLLER ────────┐ │
│ │ ● Catacombs Level 2    [Clear] [Lib] │    │ │ ▸ Dice Roller          │ │
│ │ ┌────────────────────────────────┐   │    │ └───────────────────────┘ │
│ │ │                                │   │    │                           │
│ │ │    (map image, 240px tall)     │   │    │ ⑦                         │
│ │ │                                │   │    │ ┌── INITIATIVE ─────────┐ │
│ │ └────────────────────────────────┘   │    │ │ No initiative set.    │ │
│ └──────────────────────────────────────┘    │ │ [+ Add Combatants]    │ │
│                                             │ └───────────────────────┘ │
│ ③                                           │                           │
│ ┌──── ARAGORN ─────────────────────────┐    │                           │
│ │ [Port]  Aragorn           [⋯] [AC16] │    │                           │
│ │         Human · Ranger · Lv 8 ↗      │    │                           │
│ │  44/44 [─ ████████████ +] [⚔] [✦]   │    │                           │
│ │  ────────────────────────────────     │    │                           │
│ │  GP [240 gp] [Give]                  │    │                           │
│ │  ──── + Note ────────────── ▼        │    │                           │
│ └──────────────────────────────────────┘    │                           │
│                                             │                           │
│ ┌──── EOGHAN ──────────────────────────┐    │                           │
│ │ (similar compact card)               │    │                           │
│ └──────────────────────────────────────┘    │                           │
│                                             │                           │
│ ┌──── AESOP ───────────────────────────┐    │                           │
│ │ (similar compact card, with slots)   │    │                           │
│ └──────────────────────────────────────┘    │                           │
│                                             │                           │
│ ④                                           │                           │
│ [Short Rest] [Long Rest] [Award XP] [Coin]  │                           │
│                                             │                           │
├─────────────────────────────────────────────┴────────────────────────────┤
│ ⑤ MAP LIBRARY: [+Upload] [thumb1] [thumb2] [thumb3] [thumb4] →→→       │
└──────────────────────────────────────────────────────────────────────────┘

① TOP BAR — Sticky. Navigation and session controls. "Campaign" is the page title
   in Cinzel. Manage Party and End Session are the only always-visible actions.
   This bar uses the DM's selected palette for accent coloring. Palette selector
   controls page chrome only — character cards always use their own palette.

② MAP PANEL — Top of the party column when expanded. Collapsible with one tap.
   240px tall when expanded, showing the active map in the MapViewer component.
   Pulsing green dot in header when a map is active and panel is collapsed.
   Empty state: "No active map — Upload or choose from library."

③ PARTY CARDS — The primary working surface. Full card design with all tiers
   visible in non-combat state (HP block, conditions if any, saves strip,
   XP strip, coin strip, notes strip).

④ PARTY-WIDE ACTIONS — Horizontal strip below the last card. Four buttons,
   ghost-style. "Award XP" shown only if at least one character uses XP mode.
   These are session management actions, not combat actions.

⑤ MAP LIBRARY STRIP — Full-width horizontal scroll of thumbnails at the
   page bottom. Always accessible during non-combat. Active map shows green
   dot badge. Upload button at the left end. Hidden during combat.

⑥ DICE ROLLER — Collapsed to header in the sidebar. One tap to expand.
   During exploration, the DM rarely rolls. The collapsed header ("▸ Dice
   Roller") is sufficient to remind them it's there.

⑦ INITIATIVE — Minimal empty state. A quiet prompt to add combatants.
   Takes almost no vertical space when empty, leaving room for the
   dice roller to expand if the DM wants to roll outside of combat.
```

### Desktop wireframe — Combat-active state

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Library    CAMPAIGN                        [⋯ Party] [End Session]    │
├──────────────────┬───────────────────────────┬───────────────────────────┤
│ ①                │ ②                         │ ③                         │
│ PARTY            │ DICE ROLLER               │ INITIATIVE                │
│                  │                           │                           │
│ ┌──────────────┐ │ ┌───────────────────────┐ │ [Next Turn]               │
│ │ Aragorn      │ │ │                       │ │ ───────────────────────   │
│ │ 31/44 ████░░ │ │ │ [d4][d6][d8][d10]    │ │ ▸ Aragorn          18    │
│ │ [Poisoned ×] │ │ │ [d12][d20][d100]     │ │   Goblin A         14  ● │
│ │ Slots 1:●●○  │ │ │ ×[3]  Mod: [+5]     │ │   Eoghan            12   │
│ └──────────────┘ │ │ Adv: [N] [A] [D]     │ │   Goblin B           9 ● │
│                  │ │                       │ │   Aesop              7   │
│ ┌──────────────┐ │ │ [ expression input  ] │ │   Goblin C           5 ● │
│ │ Eoghan       │ │ │ [    Roll 2d8+3     ]│ │                           │
│ │ 22/38 ████░░ │ │ │                       │ │ ④ ENEMIES                │
│ │ ● Conc: Shld │ │ │ Result: 14           │ │ ┌─────────────────────┐   │
│ │ Slots 1:●○○  │ │ │ Apply: [Ara] [Eog]  │ │ │ Goblin A      14/22│   │
│ └──────────────┘ │ │                       │ │ │ ████████░░░░░░     │   │
│                  │ │ History:              │ │ └─────────────────────┘   │
│ ┌──────────────┐ │ │  2d8+3 ×3 → 14,11   │ │ ┌─────────────────────┐   │
│ │ Aesop        │ │ │  1d20+5    → 17      │ │ │ Goblin B       0/22│   │
│ │ 38/38 ██████ │ │ └───────────────────────┘ │ │ ░░░░░░░░ DEAD      │   │
│ │ ★ Inspired   │ │                           │ └─────────────────────┘   │
│ │ Slots 1:●●●● │ │                           │ ┌─────────────────────┐   │
│ └──────────────┘ │                           │ │ Goblin C      22/22│   │
│                  │                           │ │ ████████████████   │   │
│                  │                           │ └─────────────────────┘   │
│                  │                           │ [+ Add Enemy]             │
│                  │                           │ [End Combat]              │
├──────────────────┴───────────────────────────┴───────────────────────────┤
│ (map library strip hidden during combat)                                │
└─────────────────────────────────────────────────────────────────────────┘

① PARTY COLUMN — Combat mode. Tier 2 content (XP, coin) is auto-hidden.
   Party-wide actions move to a [⋯ Party] button in the top bar.
   Cards show only combat-critical info: HP, conditions, slots, saves.
   Map panel auto-collapsed to header-only.

② DICE ROLLER — Center column. The widest, most interactive panel gets
   the most space (1fr). The die picker, expression input, advantage
   strip, and result/history all render without internal scrolling.
   "Apply to..." pills appear after damage rolls, showing both party
   members and NPC names. The roller is the action surface — it sits
   between "your team" (left) and "their team" (right).

③ INITIATIVE — Top of the right column. Active turn highlighted with
   accent border + subtle glow. NPC entries show HP status dot
   (green/amber/red). "Next Turn" button is the most prominent control
   in this column — large, top-positioned, impossible to miss.

④ ENEMIES — Below initiative in the right column. Same card interaction
   model as party (HP stepper, damage/heal, conditions). Neutral warm
   accent (#7a7060) distinguishes from party cards. Add Enemy form at
   bottom. End Combat button in red, requires confirmation.
```

### Mobile wireframe (375px)

```
┌───────────────────────────────────┐
│ ← Lib    CAMPAIGN    [⋯] [End]   │
├───────────────────────────────────┤
│ ⓘ INITIATIVE BAR (combat only)   │
│ ▸ Aragorn's turn · [Next Turn]   │
├───────────────────────────────────┤
│ MAP PANEL (collapsed header)     │
│ ● Catacombs Lv2        [▾]      │
├───────────────────────────────────┤
│                                   │
│ ┌─── ARAGORN ──────────────────┐ │
│ │ (full card, single column)   │ │
│ └──────────────────────────────┘ │
│ ┌─── EOGHAN ───────────────────┐ │
│ │ (full card)                  │ │
│ └──────────────────────────────┘ │
│ ┌─── AESOP ────────────────────┐ │
│ │ (full card)                  │ │
│ └──────────────────────────────┘ │
│                                   │
│ ── ENEMIES (combat only) ──       │
│ ┌─── GOBLIN A ─────────────────┐ │
│ │ (NPC card)                   │ │
│ └──────────────────────────────┘ │
│ ┌─── GOBLIN B ─────────────────┐ │
│ │ (NPC card)                   │ │
│ └──────────────────────────────┘ │
│ [+ Add Enemy]  [End Combat]      │
│                                   │
│ ── INITIATIVE ──                  │
│ (full list, inline)               │
│                                   │
│ ── DICE ROLLER ──                 │
│ (collapsible, below initiative)   │
│                                   │
│ ── PARTY ACTIONS ──               │
│ [Short Rest] [Long Rest]          │
│ [Award XP] [Distribute Coin]     │
│                                   │
│ ── MAP LIBRARY ──                 │
│ (thumbnail strip, horizontal)     │
└───────────────────────────────────┘
```

Key mobile decisions:
- **Sticky initiative bar**: A 44px sticky summary bar appears at the top of the viewport during combat, showing whose turn it is and a "Next Turn" button. This prevents the DM from having to scroll to the initiative list every 30 seconds. The full initiative list still renders in its normal position further down the page. The convenience is worth the viewport cost — "whose turn is it?" is the single most asked question during combat.
- **Section order**: Party cards first (always), then enemies (combat only), then initiative, then dice roller, then party actions. This matches priority: the DM looks at HP most, then enemies, then turn order.
- **No tabs or drawers on mobile**. Every section is a vertical stack, collapsible. Tabs add navigation weight on a phone; the DM should be able to scroll to what they need. Collapsible headers let them minimize sections they aren't using.

---

## 5. The map panel

### Current problem

The active map display and the map library are split across two columns on desktop. The active map sits at the top of the party column, while the library thumbnails sit in the middle column. This makes the unified "maps" feature feel like two separate things, and it forces the library into a column that is more valuable for enemy tracking.

### Design

**Active map display**: Collapsible panel at the top of the party column. This position is correct and should not change — the party column is widest during non-combat, and the DM references the map while looking at party state.

**Map library**: Full-width horizontal strip below the main grid, spanning all columns. This is a more natural home — the library is a resource shelf, not an active working surface. It sits at the bottom of the page where it's accessible without consuming column space. Hidden during combat; restored when combat ends.

**Unification**: The active map panel header includes the map name, a "Clear" button, and a "Library" button that opens `MapLibraryModal`. The library strip at the bottom also provides "Set Active" on each thumbnail. Two entry points, same destination — the DM can access the library from either place.

### Vertical space allocation

- Map panel expanded: 240px height for the `MapViewer`, plus ~36px header = ~276px total
- Map panel collapsed: ~36px (header only, with pulsing green dot when active)
- During combat: auto-collapsed. The DM set the map before combat; they don't need to stare at it while managing HP.

---

## 6. The dice roller

### Current problem

The dice roller is buried at the bottom of the party column, below party-wide actions. On a typical 1200px desktop with 3 party cards, the dice roller is below the fold. The DM must scroll past party actions to reach it. During combat, when the DM rolls every 30 seconds, this scroll-to-use pattern is unacceptable.

### Design

**Non-combat**: The dice roller docks in the right sidebar column, below the initiative tracker. Collapsed to header only. The DM rarely rolls during exploration. The header reads "▸ Dice Roller" with a small die icon.

**Combat-active**: The dice roller promotes to the **center column** of the 3-column layout. It gets `1fr` width — the most space of any column. This placement solves three problems:
1. **Visibility**: The center column is always visible without scrolling. The dice roller is immediately usable.
2. **Spatial logic**: The roller sits between allies (left) and enemies (right) — it is the action surface where combat mechanics resolve. Roll in the center, glance left to check party HP, glance right to check enemy HP and whose turn it is.
3. **Breathing room**: The die picker grid, expression input, repeat controls, advantage strip, result display, apply-to pills, and roll history all render comfortably without internal scrolling.

### Dice roller states

**Non-combat**: Collapsed to header only in the sidebar. One tap to expand.

**Combat-active**: Auto-expanded in the center column. Shows the die picker, expression input, and roll button immediately.

**Always**: The "Apply to..." pills appear after damage rolls, showing both party members and NPC names. Party member pills use character palette accents. NPC pills use the neutral warm-gold NPC accent. This unification means the DM never has to switch contexts to apply damage after rolling — the workflow is: roll → tap target → confirm.

---

## 7. Character Card Enhancements

The existing card design is a solid foundation. These enhancements push it from functional to expressive — making the card communicate state more aggressively so the DM absorbs information without conscious effort.

### Card header: reconsider the portrait

The current header: `[44px portrait circle] Name [⋯] [AC badge]` with race/class/level below.

The portrait takes ~44px of horizontal width on a card that may be as narrow as 280px during combat. What does it give the DM? Instant character identification. But during combat, the DM already knows who their three players are. The portrait's identification value is highest during exploration (when the DM has more screen space anyway) and lowest during combat (when space is most precious).

**Proposal: portrait-to-accent collapse during combat.** In non-combat mode, the portrait renders as it does today — 44px circle, familiar and warm. When combat begins, the portrait smoothly transitions to a **4px vertical accent bar** on the left edge of the card, colored with the character's `pal.accent`. This reclaims ~48px of horizontal space (portrait + gap), letting the name and HP breathe. The color bar provides the same instant identification that a tiny portrait does — faster, actually, because color recognition is pre-attentive (the brain processes it before conscious thought). The transition: `width: 44px → 4px`, `border-radius: 50% → 2px`, `opacity` cross-fade from image to solid color, 300ms ease-out.

In non-combat mode, the portrait stays. It adds warmth and personality to the exploration experience.

### HP stepper row: make the bar dramatic

Current: `[−] [bar] [+] [⚔] [✦]` — functional but visually flat. The bar is a static rectangle that fills/empties.

**HP bar as storytelling device.** The bar should communicate three things beyond raw percentage: *velocity* (how fast HP is changing), *threshold* (danger zones), and *trend* (getting worse or better).

Improvements:
- **Segmented bar**: divide the bar into 5 equal segments with hairline internal borders (`1px solid rgba(0,0,0,0.15)`). This gives the DM a rough percentage read without counting pixels — "she's at about 3/5" is faster to parse than an unsegmented fill.
- **Color gradient thresholds**: 100-50% = `pal.gem` (healthy), 50-20% = amber `#c8a040` (bloodied), <20% = `#c06060` (critical). The color transition is instant on the boundary, not interpolated — the DM needs discrete states, not a gradient they have to interpret.
- **Damage flash**: when HP decreases, the bar's lost segment briefly flashes white (`opacity: 0.6`) before fading to empty. Duration: 300ms. This gives the DM a visceral "something just got hit" signal even in peripheral vision.
- **Heal glow**: when HP increases, the newly filled segment pulses once with `pal.gem` at 1.3x brightness before settling. Duration: 250ms. Healing should feel rewarding.
- **Hold-to-repeat haptic feel**: the `−`/`+` buttons already have hold-to-repeat. Add a subtle scale pulse on each repeat tick (`scale: 1.0 → 0.95 → 1.0`, 80ms, matching the repeat interval). This gives tactile feedback that the hold is working.

### Active turn state: make it unmistakable

Current: `scaleX(1.02)` + bottom glow bar. This is too subtle. In a column of 3-4 cards, a 2% width increase is nearly invisible. The bottom glow bar is only visible if the DM looks at the card's bottom edge.

**Active turn treatment:**
- **Left-edge accent bar pulses**: the card's left accent bar (always present as a palette-colored stripe) brightens and pulses slowly when it's this character's turn. `opacity: 0.4 → 1.0 → 0.4`, 2s cycle, ease-in-out. This is visible in peripheral vision without demanding focus.
- **Card surface lifts**: `translateY(-2px)` + `box-shadow: 0 4px 16px rgba(accent, 0.25)`. Not a scale transform (those distort text), but a true elevation change that reads as "this card is closer to you."
- **Name glow**: the character name text gains a subtle `text-shadow: 0 0 8px pal.accentBright` at `opacity: 0.4`. The name is the first thing the eye reads; making it glow draws the eye to the right card.
- **All other cards dim slightly**: non-active cards drop to `opacity: 0.85`. The contrast between 0.85 and 1.0 is enough to create a clear focus hierarchy without making inactive cards unreadable.
- **Transition**: all properties animate over 300ms ease-out when the turn changes. The previous active card de-glows over 200ms ease-in — it should feel like a spotlight moving, not switching.

### Condition chips: severity signaling

Current: color-coded chips with `×` dismiss. They sit statically in a row.

**Enhancements:**
- **Entry animation**: new chips scale from `0.7 → 1.0` + `opacity: 0 → 1`, 180ms ease-out. The chip "pops" into existence, drawing the eye.
- **Severity pulse on dangerous conditions**: Paralyzed, Stunned, Petrified, and Unconscious chips receive a slow border pulse (`border-color` oscillates between `pal.accent` and a brighter version, 3s cycle). These conditions are encounter-ending — they deserve ambient urgency. Less dangerous conditions (Prone, Grappled) do not pulse.
- **Exhaustion escalation**: the exhaustion counter already exists. At levels 1-2, it renders normally. At 3-4, the counter background shifts to amber. At 5-6, it shifts to `#c06060` red with the same slow pulse as dangerous conditions. Exhaustion 6 = death; the UI should communicate escalating dread.
- **Removal animation**: dismissed chips scale `1.0 → 0.8` + `opacity: 1 → 0`, 150ms ease-in. Quick and clean — the DM shouldn't wait for a chip to disappear.

### Death saves row: match the stakes

Current: dashed pips, "player-reported" label, red tinted background. This is the most critical moment in the game — a character might die. The current design treats it as "another row of information."

**Enhancements:**
- **Card border goes red**: the entire card border shifts to `#c06060` when HP hits 0. Not just the HP number — the whole card. This is a full-card state, not a row-level state.
- **Death save pips with weight**: replace dashed circles with solid rings. Successes fill green (`#58c890`). Failures fill red (`#c06060`). Each pip is 16px diameter — large enough to read across the table on a tablet.
- **Failure pip shake**: when a death save failure is marked, the newly filled pip shakes briefly (`translateX: 0 → -3px → 3px → -2px → 0`, 300ms). The physicality of the shake communicates "this is bad."
- **Three-failure state**: if three failures are marked, the entire card darkens (`opacity: 0.6`), the name receives a `line-through` decoration, and a "FALLEN" label appears in IM Fell English uppercase, tracked, `#c06060`. This is a permanent-feeling state — the character is dead until revived. The transition is slow: 600ms ease-in. Death should feel weighty, not instant.
- **Three-success state**: if three successes are marked, the red border fades to `pal.accent`, and a brief `pal.gem` pulse radiates from the card (box-shadow expanding from 0 to 12px and fading, 400ms). Stabilization is relief — the UI should express that.

---

## 8. NPC Card Enhancements

The enemy tracker is the DM's most-touched combat surface. Every round, the DM interacts with 3-6 enemy HP bars. These cards need to be optimized for rapid, repeated use.

### Active turn state for NPCs

**Active turn (this NPC is acting NOW):**
- The card's left border brightens to `pal.accentBright` and pulses (same 2s cycle as PC active turn).
- Card lifts with `translateY(-2px)` + elevated box-shadow.
- All non-active NPC cards dim to `opacity: 0.85`.
- The initiative list in the same column highlights this NPC's row — since enemies and initiative share the right column, the visual connection between "highlighted initiative row" and "glowing NPC card below" is immediately spatial.

**In initiative but not acting:**
- Normal card rendering. No special treatment. The initiative list shows their position; the card doesn't need to repeat that information.

**Dead NPC (0 HP):**
- HP bar fully drained to empty.
- Card receives a red-to-dark gradient overlay (`linear-gradient(rgba(192,96,96,0.12), rgba(0,0,0,0.15))`).
- Name text gets `line-through` decoration.
- "DEAD" badge appears: IM Fell English uppercase, `#c06060`, `letter-spacing: 0.2em`, scales in from 0.7→1.0 over 250ms.
- Card shrinks vertically: action buttons (DMG/HEAL/COND) collapse to a single "Revive" button, reclaiming space. The DM rarely heals dead enemies — but they might, so the option exists without consuming space.
- **Card does NOT leave the list.** Dead enemies stay for narrative continuity ("the goblin's body is still blocking the doorway"). They collapse to a compact state but remain visible. The DM can manually remove them via the `×` button if they want to clean up.

### Enemy HP bar: dramatic drain

The HP bar is the primary NPC readout. It should do more than fill/empty.

- **Drain animation**: when damage is applied, the bar doesn't instantly jump to the new value. Instead: the bar's filled portion immediately drops to the new width (instant response — the DM needs to see the result), but a "ghost" segment lingers at the old width in a lighter tint (`rgba(255,255,255,0.15)`) and fades out over 400ms. This creates a "drain trail" effect — the DM sees both where the HP was and where it is now, giving a visceral sense of how much damage was dealt. Inspired by fighting game HP bars (Street Fighter, Hades).
- **Bloodied flash**: when HP crosses below 50%, the bar color shifts to amber AND the card's left border flashes amber once (200ms). The word "BLOODIED" appears next to the HP numbers in IM Fell English uppercase, amber color. This is already partially implemented — enhance the flash to make the threshold crossing feel like an event, not a gradual change.
- **Critical threshold (<20%)**: bar color shifts to `#c06060`. No additional animation — at this point the DM knows the enemy is nearly dead. The color shift is sufficient.

### Action buttons: optimize for rapid repeated use

The `+DMG` / `+HEAL` / `+COND` buttons are the DM's most-used controls during combat. Current: standard ghost buttons in a row.

**Enhancements:**
- **Larger touch targets**: minimum 48px height (not the standard 44px). During combat, the DM is tapping rapidly, possibly on a tablet propped at an angle. Slightly oversized targets reduce miss-taps.
- **DMG button visual weight**: the damage button should be the most visually prominent action — it's used 5-10x per combat per enemy. Give it a subtle filled background (`rgba(192,96,96,0.15)`) instead of ghost style. Not a full red button — that would look like a destructive/dangerous action. But a tint that says "this is the primary action."
- **HEAL button is secondary**: ghost style, smaller text. The DM rarely heals enemies. It should be accessible but not competing for attention with DMG.
- **COND button**: ghost style, standard size. Conditions are applied less frequently than damage.
- **Button arrangement**: `[⚔ DMG]` occupies more width than the other two. `[✦ HEAL] [◎ COND]` share the remaining space. This 60/20/20 split reflects usage frequency.
- **Tap feedback**: on tap, the DMG button briefly brightens (`background-color` transitions to 2x opacity, then back, 120ms). Instant visual confirmation that the tap registered.

### NPC notes persistence

NPC notes are currently session-scoped — they disappear when "End Combat" is triggered. This is correct for most notes ("goblin A is hiding behind the pillar"). No change needed. But add a visual indicator that notes are ephemeral: a small "session only" label in the notes strip header, IM Fell English, 10px, `pal.textMuted`.

---

## 9. Dice Roll Animation Spec

The current dice roller uses SVG polyhedral shapes (d4=triangle, d6=square, d8=diamond, d10=pentagon, d12=hexagon, d20=circle, d100=octagon). These shapes are distinctive and correct — keep them. The animation around them needs to be more dramatic.

### Roll initiation (Roll button pressed)

When the DM taps Roll, the dice need to communicate "randomness is happening" before the result appears. The current 1050ms spin is a start but feels mechanical.

**Animation sequence:**

1. **Shake phase** (0–200ms): Each die shape in the expression translates rapidly between random offsets (`translateX` ±4px, `translateY` ±3px), switching position every 40ms (5 positions). This is a physical "rattling in the hand" feel. Easing: linear (randomness shouldn't smooth itself out). CSS: `@keyframes diceShake`.

2. **Spin phase** (200–800ms): Each die rotates. The rotation is not uniform — different die types spin at different speeds to break visual monotony:
   - d4, d6, d8: `rotate(0deg → 720deg)`, 600ms
   - d10, d12: `rotate(0deg → 540deg)`, 600ms  
   - d20: `rotate(0deg → 1080deg)`, 600ms (the d20 spins the most — it's the most important die)
   - d100: `rotate(0deg → 360deg)`, 600ms (slower, heavier feel)
   
   Easing: `cubic-bezier(0.2, 0.8, 0.3, 1.0)` — fast start, gradual deceleration, like a real die losing momentum.
   
   During the spin, the die shape's fill color oscillates between `pal.accent` and `pal.accentBright` (3 cycles over 600ms). CSS: `@keyframes diceSpin`.

3. **Blur-to-sharp** (600–850ms, overlapping with end of spin): `filter: blur(2px) → blur(0px)`. The die "snaps into focus" as it stops spinning. Duration: 250ms. Easing: `ease-out`. CSS: applied as part of `@keyframes diceSpin` at the 75% and 100% keyframes.

4. **Settle** (800–1000ms): The die shape does a micro-bounce, simulating a die landing on a surface. `translateY: 0 → -3px → 0`, with a very slight rotation (`rotate: 0deg → -2deg → 0deg`). Duration: 200ms. Easing: `cubic-bezier(0.3, 1.5, 0.6, 1.0)` (slight overshoot on the bounce). CSS: `@keyframes diceSettle`.

Total animation: ~1000ms from button press to result reveal.

### Result reveal

The number appears at the 850ms mark (overlapping with the settle animation so it feels simultaneous with the die "landing").

**Standard result:**
- Number fades in with slight scale: `opacity: 0→1`, `scale: 0.85→1.0`, 200ms, `ease-out`. The number "solidifies" as the die settles.
- The die shape's border briefly brightens to `pal.accentBright` for 300ms, then returns to normal. A "landing flash."

**Natural 20 (d20 roll of 20):**
- **Gold burst**: the d20 circle's fill flashes to a bright gold (`#f0d060`) and radiates an expanding glow ring (`box-shadow: 0 0 0 0 rgba(240,208,96,0.6) → 0 0 0 16px rgba(240,208,96,0)`, 500ms). CSS: `@keyframes nat20Burst`.
- **Number treatment**: the "20" renders in gold (`#f0d060`) at 1.2x scale, then settles to 1.0x over 300ms. It retains the gold color permanently in the result display.
- **"CRITICAL" label**: appears below the number, IM Fell English uppercase, gold, `letter-spacing: 0.25em`, fades in over 200ms starting at 1000ms. A celebratory but not excessive moment.
- **Subtle screen-edge flash**: a single-frame gold tint (`rgba(240,208,96,0.04)`) on the dice roller panel background, fading over 400ms. Just enough to say "something special happened" without being garish.

**Natural 1 (d20 roll of 1):**
- **Red flash**: the d20 circle's fill flashes `#c06060` and the circle border thickens momentarily (`2px → 3px → 2px`, 200ms). CSS: `@keyframes nat1Flash`.
- **Number treatment**: the "1" renders in `#c06060` at 0.9x scale (slightly small — a cringing, apologetic number), then settles to 1.0x over 200ms. Retains red color in the result display.
- **"FUMBLE" label**: appears below the number, same treatment as CRITICAL but in `#c06060`.
- **No screen-edge flash.** Fumbles are deflating, not dramatic. The restraint is intentional — a fumble flash would be annoying after the third one.
- **Die tilt**: the settled die shape tilts to `rotate(-5deg)` and stays tilted for 500ms before straightening. A die that "fell badly."

### Multiple dice (e.g., 3x1d6+1d8)

- **Staggered animation**: all dice begin shaking simultaneously (phase 1), but their spin phases stagger by 60ms each. So in a 4-die expression, the first die starts spinning at 200ms, the second at 260ms, the third at 320ms, the fourth at 380ms. This creates a visual "cascade" rather than a synchronized mechanical rotation.
- **Individual results**: each die's number appears as that specific die settles (not all at once). The per-die results are small (`12px, pal.textMuted`) and appear next to each die shape.
- **Total reveal**: the combined total appears 200ms after the last individual die settles. It renders larger (`20px, pal.text`) with the same scale-in animation as standard results. This is the number the DM actually cares about — the per-die results are context, the total is the answer.
- **Apply-to row appearance**: the target pills slide in from below (`translateY(8px) → 0`, `opacity: 0→1`, 200ms ease-out), starting 300ms after the total reveals. The delay is intentional — the DM needs a beat to read the total before being presented with action options.

### xN repeat rolls

- All N rolls share a single animation pass (the existing 600ms behavior). The dice animate once.
- Results appear as a labeled list with staggered fade-in: each row `opacity: 0→1`, `translateY(6px)→0`, 120ms per row, 60ms stagger.
- Crits and fumbles in individual rows get the gold/red number treatment but NOT the burst/flash effects — those would be overwhelming across multiple rows.

### History row entrance

- New roll results push into the history list. The new entry animates in from the top: `translateY(-8px) → 0`, `opacity: 0→1`, 180ms, `ease-out`.
- Existing history rows shift down smoothly: `translateY(0) → translateY(row-height)`, 180ms, `ease-out`. This should feel like a physical list where items slide to make room, not a DOM reflow.
- Opacity fade levels for history rows: 100% / 55% / 30% / 15% / hidden. The most recent roll is always full opacity; older rolls recede but remain scannable.

### CSS keyframe summary

| Keyframe name | Duration | Easing | Purpose |
|---|---|---|---|
| `diceShake` | 200ms | linear | Pre-roll rattle, ±4px random offsets |
| `diceSpin` | 600ms | cubic-bezier(0.2, 0.8, 0.3, 1.0) | Rotation + color oscillation + blur-to-sharp |
| `diceSettle` | 200ms | cubic-bezier(0.3, 1.5, 0.6, 1.0) | Micro-bounce landing |
| `diceResultIn` | 200ms | ease-out | Number fade + scale (0.85→1.0) |
| `nat20Burst` | 500ms | ease-out | Gold glow ring expansion |
| `nat1Flash` | 200ms | ease-in-out | Red flash + border thicken |
| `nat1Tilt` | 500ms | ease-in-out | Fumble die tilt + straighten |
| `historySlideIn` | 180ms | ease-out | New history row entrance |
| `applyRowIn` | 200ms | ease-out | Apply-to pills slide up |

---

## 10. Party-wide actions

### Current problem

Party-wide actions (Short Rest, Long Rest, Award XP, Distribute Coin) are a thin strip below the party cards. When the party list is long, this strip is below the fold. The actions are important but infrequent — the DM uses them 1-3 times per session, never during active combat rounds.

### Design

**Non-combat state**: Actions strip renders as a full-width row below the last party card, above the map library strip. Four ghost-style buttons in a horizontal row. "Award XP" appears only if at least one roster member uses XP leveling. This is the right placement — during non-combat, the DM scrolls through party cards and naturally reaches the actions.

**Combat-active state**: The actions strip collapses. A compact `⋯ Party` button appears in the top bar (right side, before "End Session"). Tapping it opens a dropdown with the four actions. During combat, these actions are almost never needed. Moving them to the top bar keeps them accessible for edge cases without consuming party column space.

### Interaction model

Each action opens a confirmation dialog (existing pattern). The dialog lists what will change before the DM confirms.

- **Short Rest**: "Reset Pact Magic slots for all characters?" → lists affected characters
- **Long Rest**: "Full rest — reset all spell slots and restore HP to max for all characters?" → lists all characters with changes
- **Award XP**: Modal with amount input + per-character checkboxes (existing)
- **Distribute Coin**: Modal with denomination inputs (existing)

No changes to the actual action logic — only the surface placement changes between modes.

---

## 11. Motion spec

### Combat mode transition

**Entering combat** (first NPC added via Add Enemy or initiative promotion):

```
Map panel collapse:
  Trigger: npcCombat.npcs goes from [] to [npc]
  Element: map panel body
  Animation: max-height shrinks to 0, opacity 1→0
  Duration: 250ms, ease-in-out
  Communicates: "combat is starting, the map recedes"

Middle column entrance (dice roller):
  Trigger: same as above
  Element: dice roller column container
  Animation: translateX(-50%)→0, opacity 0→1
  Duration: 300ms, ease-out (starts 50ms after map collapse begins)
  Communicates: "the action surface is appearing"

Right column reorganization (initiative + enemies):
  Trigger: same as above
  Element: enemy cards appearing below initiative
  Animation: per-card opacity 0→1, staggered 50ms
  Duration: 150ms per card, ease-out
  Communicates: "the other side of combat is populating"

Party-wide actions collapse:
  Trigger: same as above
  Element: actions strip
  Animation: max-height shrinks to 0, opacity 1→0
  Duration: 200ms, ease-in
  Communicates: "these are being put away for now"

Tier 2 content collapse on party cards:
  Trigger: same as above
  Element: XP strip, coin strip per card
  Animation: max-height shrinks to 0, opacity 1→0
  Duration: 200ms, ease-in, staggered 40ms per card
  Communicates: "secondary information is being tucked away"

Dice roller auto-expand:
  Trigger: same as above
  Element: dice roller panel body in center column
  Animation: max-height 0→auto, opacity 0→1
  Duration: 300ms, ease-out (starts 200ms after combat begins)
  Communicates: "your rolling tool is ready"

Map library strip hide:
  Trigger: same as above
  Element: map library strip
  Animation: max-height shrinks to 0, opacity 1→0
  Duration: 200ms, ease-in
  Communicates: "the map shelf is being cleared for combat"
```

**Leaving combat** (End Combat confirmed):

```
Middle column exit (dice roller):
  Trigger: npcCombat.npcs set to []
  Element: dice roller column container
  Animation: opacity 1→0, translateX(0)→translateX(-50%)
  Duration: 250ms, ease-in
  Communicates: "the action surface is being cleared"

Enemy cards exit:
  Trigger: same
  Element: NPC cards
  Animation: opacity 1→0
  Duration: 200ms, ease-in
  Communicates: "enemies are gone"

Map panel expand:
  Trigger: same, after column exit completes
  Element: map panel body (if active map exists)
  Animation: max-height 0→276px, opacity 0→1
  Duration: 300ms, ease-out
  Communicates: "back to exploration mode"

Party-wide actions restore:
  Trigger: same
  Element: actions strip
  Animation: max-height 0→60px, opacity 0→1
  Duration: 200ms, ease-out
  Communicates: "session management tools are back"

Tier 2 restore:
  Trigger: same
  Element: XP/coin strips per card
  Animation: max-height 0→auto, opacity 0→1
  Duration: 200ms, ease-out, staggered 40ms per card
  Communicates: "administrative information is visible again"

Map library strip restore:
  Trigger: same
  Element: map library strip
  Animation: max-height 0→auto, opacity 0→1
  Duration: 200ms, ease-out
  Communicates: "the map shelf is back"
```

### Initiative turn advancement

```
Active turn indicator move:
  Trigger: "Next Turn" tapped
  Element: highlight bar on initiative list
  Animation: background-color pulse (accent→bright→accent), 
             previous entry fades to normal (200ms)
  Duration: 250ms total
  Communicates: "the turn has moved to the next combatant"

Active-turn card glow (PC or NPC):
  Trigger: initiative activeTurnIndex changes
  Element: the party card or NPC card matching the active combatant
  Animation: left accent bar begins pulsing (opacity 0.4→1.0→0.4, 2s cycle),
             card lifts translateY(-2px) + elevated box-shadow,
             name gains text-shadow glow,
             all other cards dim to opacity 0.85
  Duration: 300ms ease-out for the initial transition
  Communicates: "this character is currently acting"

Previous turn card de-glow:
  Trigger: same
  Element: the previously active card
  Animation: pulse stops, card settles, opacity restores to 1.0
  Duration: 200ms, ease-in
  Communicates: "this character's turn is over"
```

### Character card status changes

```
Condition chip appears:
  Trigger: condition added
  Element: new chip
  Animation: scale 0.7→1.0, opacity 0→1
  Duration: 180ms, ease-out
  Communicates: "a new status effect appeared"

Condition chip removed:
  Trigger: × tapped on chip
  Element: removed chip
  Animation: scale 1.0→0.8, opacity 1→0
  Duration: 150ms, ease-in
  Communicates: "status cleared"

HP damage taken:
  Trigger: hpCurrent decreases
  Element: HP bar lost segment
  Animation: lost segment flashes white (opacity 0.6) then fades to empty
  Duration: 300ms, ease-out
  Communicates: "this character just took damage"

HP healed:
  Trigger: hpCurrent increases
  Element: HP bar gained segment
  Animation: new fill pulses at 1.3x pal.gem brightness then settles
  Duration: 250ms, ease-out
  Communicates: "healing feels rewarding"

HP danger threshold crossed (<20%):
  Trigger: hpCurrent drops below 20% of hpMax
  Element: card border + HP bar color
  Animation: bar color shifts to #c06060, card border flashes red once
  Duration: 400ms, ease-in-out
  Communicates: "this character is in danger"

HP zero reached:
  Trigger: hpCurrent reaches 0
  Element: card border + death save row
  Animation: entire card border shifts to #c06060 (300ms),
             death save row max-height 0→auto + red background-tint fades in
  Duration: 300ms, ease-out
  Communicates: "death saves are now relevant"

Death save failure marked:
  Trigger: failure pip filled
  Element: failure pip
  Animation: pip fills red, shakes (translateX ±3px, 300ms)
  Communicates: "this is bad"

Three failures (character death):
  Trigger: third failure marked
  Element: entire card
  Animation: card opacity → 0.6, name gets line-through,
             "FALLEN" label fades in (IM Fell English uppercase, #c06060)
  Duration: 600ms, ease-in
  Communicates: "this character has died — a weighty moment"

Three successes (stabilized):
  Trigger: third success marked
  Element: card border + glow
  Animation: red border fades to pal.accent,
             pal.gem pulse radiates from card (box-shadow 0→12px, fading)
  Duration: 400ms, ease-out
  Communicates: "relief — they're stable"

NPC bloodied:
  Trigger: hpCurrent crosses below 50% of hpMax
  Element: NPC card left stripe + badge + HP bar
  Animation: HP bar ghost trail (400ms drain), bar color → amber,
             stripe flashes amber once (200ms), BLOODIED badge scales in
  Duration: 250ms, ease-out
  Communicates: "this creature is weakening"

NPC dead:
  Trigger: hpCurrent reaches 0 or below
  Element: NPC card
  Animation: HP bar ghost trail to empty (400ms),
             red-to-dark gradient overlay fades in,
             name strikethrough appears,
             DEAD badge scales in from 0.7→1.0,
             action buttons collapse to single "Revive" button
  Duration: 300ms, ease-out
  Communicates: "this creature is down"
```

---

## 12. Responsive design

### Breakpoint definitions

| Breakpoint | Layout | Key changes |
|---|---|---|
| 1200px+ | Full desktop | 2 or 3 columns depending on combat state |
| 900px–1199px | Compressed desktop | Sidebar narrows to 280px; party cards at narrower width |
| 768px–899px | Tablet | 2-column (party + sidebar) always; enemies stack below party when in combat |
| 375px–767px | Mobile | Single column, everything stacks |
| <375px | Narrow mobile | Same as mobile but tab labels may truncate |

### 1200px+ (full desktop)

Full layout as described in the wireframes above. Non-combat: 2-column (`1fr 340px`). Combat: 3-column (`300px 1fr 320px`). All panels render at full fidelity.

### 900px–1199px (compressed desktop)

- Non-combat: 2-column (`1fr 280px`). Sidebar slightly narrower.
- Combat: **2-column** (`1fr 280px`), with the NPC section rendering below the party cards in the left column. The 3-column layout breaks at this width because the dice roller and party cards both need meaningful width. The NPC section is separated from party cards by a horizontal divider and an "ENEMIES" section header. The dice roller moves to the sidebar below initiative.
- Initiative and dice roller remain in the sidebar.

### 768px–899px (tablet)

- Always 2-column (`1fr 260px`).
- Combat: NPC cards render below party cards, same as compressed desktop.
- Map panel collapsed by default (expandable).
- Party-wide actions strip renders but may wrap to two rows.

### 375px–767px (mobile)

- **Single column**, full-width.
- **Sticky initiative bar** during combat: 44px tall, shows current turn name + "Next Turn" button. Fixed to top of viewport below the top bar. The convenience is worth the viewport cost.
- Section order (top to bottom):
  1. Map panel (collapsed header)
  2. Party cards
  3. NPC section (combat only, with section header)
  4. Initiative list (full, below NPCs)
  5. Dice roller (collapsible)
  6. Party-wide actions
  7. Map library strip
- Each section has a collapsible header so the DM can minimize what they aren't using.
- The sticky initiative bar prevents the "scroll to check whose turn" problem. The full initiative list is still available in its inline position for detailed management.

### What collapses

| Section | Desktop | Tablet | Mobile |
|---|---|---|---|
| Map panel | Collapsible, expanded default | Collapsible, collapsed default | Collapsed header only |
| Party cards | Always expanded | Always expanded | Always expanded |
| NPC cards | Right column (combat) | Below party (combat) | Below party (combat) |
| Initiative | Right col top (combat) / sidebar | Sidebar, always visible | Inline; sticky summary bar |
| Dice roller | Center column (combat) / sidebar | Sidebar, collapsible | Collapsible section |
| Party-wide actions | Strip or ⋯ button | Strip (may wrap) | Collapsible section |
| Map library | Full-width strip (hidden combat) | Full-width strip | Collapsible section |
| Tier 2 card content | Visible (non-combat), auto-hidden (combat) | Same | Always visible |

### What goes into drawers/tabs

Nothing. The design avoids tabs and drawers on the dashboard. Every section is directly scrollable. Drawers and tabs add a navigation decision ("which tab has the thing I need?") that costs the DM 1-2 seconds of cognitive effort during combat — unacceptable. Collapsible sections are the right pattern: one tap to expand, visually scannable even when collapsed (header text tells you what's there).

---

## 13. Summary of changes from current layout

| Aspect | Current | Proposed |
|---|---|---|
| Column count | Always 3 | 2 (non-combat) or 3 (combat) |
| NPC column | Always visible (even empty) | Appears only when NPCs exist |
| Dice roller position (non-combat) | Bottom of party column | Right sidebar, below initiative |
| Dice roller position (combat) | Bottom of party column | **Center column** (widest, 1fr) |
| Enemy position (combat) | Middle column | **Right column** (below initiative) |
| Map library position | Middle column | Full-width footer strip |
| Map library during combat | Same as non-combat | Hidden, restored on combat end |
| Map panel during combat | Same as non-combat | Auto-collapses to header |
| Party-wide actions during combat | Strip below party cards | `⋯ Party` overflow in top bar |
| Tier 2 card content during combat | Always visible | Auto-hidden with per-card toggle |
| Mobile initiative | Inline, must scroll to find | Sticky summary bar at top |
| Combat/non-combat visual distinction | None | Layout adapts, animations communicate transition |
| Active turn treatment | scaleX(1.02) + bottom glow | Pulsing accent bar + lift + name glow + others dim |
| HP bar | Flat fill/empty | Segmented, threshold colors, damage flash, heal glow |
| Death saves | Dashed pips + red tint | Solid ring pips, failure shake, FALLEN/stabilized states |
| NPC death | 0/max HP shown | Collapsed actions, strikethrough, DEAD badge, stays in list |
| Dice animation | 1050ms spin | Shake → spin → blur-to-sharp → settle, nat20/nat1 specials |
| Portrait in combat | 44px circle always | Collapses to 4px accent bar during combat |
