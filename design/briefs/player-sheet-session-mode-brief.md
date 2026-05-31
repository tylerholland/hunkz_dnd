# Player Sheet — Profile / Session Mode Brief

> Story 27. The player-facing character sheet evolves from a single narrow column into a context-aware surface with two clearly named modes — Profile (the booklet) and Session (the combat reference card). On desktop, Session mode unfolds into a two-column command surface anchored by a party status strip and live initiative. On mobile, the same two modes are reachable through a single, persistent toggle.
> Produced by design-strategist. Revised pass 2 incorporating owner feedback on avatar size, dice shapes, weapon roll integration, and single-surface aesthetic.

---

## 1. Design intent

The player at the table has two distinct jobs. Between sessions they are an **author** — reading their backstory, leveling up, updating equipment, planning spells. During play they are an **operator** — tracking HP under pressure, watching whose turn it is, calling for healing, deciding whether to burn a slot. The current sheet treats these jobs identically, which means the operator has to scroll past 800px of authorial content to find their HP bar.

The emotional goal is **mode confidence** — the player should always know which mode they are in, and switching should feel like turning the page of a notebook, not opening a new app. The functional goal is **zero-scroll session play** — on any device, the moment a player opens their sheet during combat they see their HP, their party's status, the current turn, and their dice tray without touching the screen.

The mental model: **Profile is the booklet, Session is the combat card.** Same character, same data, different surface. On desktop, Session mode also becomes the first time the player sees their party as a unit — mirroring the DM dashboard's spatial model so the table now shares a common visual language for "who's hurt, whose turn, what round."

The aesthetic reference is the **DM dashboard** — one surface divided by lines, not a collection of floating card widgets. Depth comes from typography contrast (Cinzel vs. IM Fell English), palette washes, and a single elevated card for the HP hero. Everything else lives on the surface.

---

## 2. Mode definition (the load-bearing decision)

### Profile mode = everything that exists today, untouched

Profile mode is the current narrow single-column sheet. It contains:
- The full portrait image (full-bleed) + tagline
- The character details grid (race/class/subclass/alignment/background/origin)
- The full stats block (HP/Hit Dice/Armor headline, ability score circles with flyouts, skills/spells/special abilities badges, XP/coin)
- The four-tab strip (Inventory · Persona · Combat · Map) — all tabs available
- The collections/sections backstory viewer below the stats block

Nothing changes in Profile mode. It is correct for reading, editing, leveling, and showing your character off.

### Session mode = the combat reference card

Session mode is a new layout that **collapses or hides everything Profile-only** and **promotes session-critical fields to the top of the surface**. Session mode is view-only — editing always exits to Profile (and is gated behind unlock + edit button as today).

**What Session mode hides:**
- Full portrait image (replaced by 56px portrait circle in the identity strip)
- Character details grid (race/class/subclass/etc.)
- Backstory collections viewer
- Persona tab content (roleplay traits — these live in Profile only)
- The four-tab strip (replaced by a smaller session-only tab control — see §4)
- Edit mode entrypoint (still reachable via overflow menu, but not chrome-level)

**What Session mode promotes (always visible, no scroll on desktop):**
- Compact identity strip (portrait circle + name + class/level + AC + speed)
- Tier-1: HP block (current/max/temp, ±1 stepper, Damage/Heal buttons)
- Tier-1: Active conditions row (only active conditions; manager opens on tap)
- Tier-1: Concentration banner (when active)
- Tier-1: Spell slots row (when configured)
- Tier-1: Party status strip + initiative strip (see §5/§6)
- Tier-2: Inspiration toggle
- Tier-2: Weapons + spells with inline roll buttons (Combat sub-tab — see §3b)
- Tier-2: Session Notes (NOTES sub-tab)
- Tier-2: Dice roller — **expanded by default** in Session mode
- Tier-3: Map (MAP sub-tab — gets full right column in non-combat; see §4)
- Tier-3: Compact ability-score modifier strip (six chips; tap to roll)

### Where does Inventory live?

Profile mode keeps the existing Inventory tab in full. Session mode exposes a **"Loadout" sub-tab** for the full grid (attunement toggles, equipped toggles, qty steppers, potion Use button, Drop Item). Session mode also shows abridged Weapons quick-reference in the Combat sub-tab with inline roll buttons. Both pull from the same `weapons[]` / `equipment[]` data — no duplication.

---

## 3. The mode toggle

### Placement

A single persistent control: a **two-state segmented pill** labeled `PROFILE | SESSION`, IM Fell English 12px uppercase, `letterSpacing: 0.2em`, in the same visual family as the existing tab strip.

- **Mobile and narrow desktop (<900px)**: pinned to the top of the sheet, immediately below the top bar. Full-width segmented control, 44px tall.
- **Desktop ≥900px**: anchored top-left inside the left column, just above the identity strip. Always reachable without scrolling.

The active segment uses the existing active-tab treatment (`pal.accentDim` background, `pal.accent` border, `pal.accentBright` text). Inactive segment is transparent with `pal.border` and `pal.textMuted`.

### Labels

`PROFILE` and `SESSION`. Each segment has a small leading glyph: ❡ for Profile, ⚔ for Session.

### Persistence

Stored as `sessionStorage.dnd_mode_${slug}` with values `"profile"` or `"session"`. Default on first visit is **Profile**.

### Auto-switch behavior

If `initiative.entries.length > 0` AND `round > 0` AND no stored preference, the page opens in Session mode with a 180ms accent-border pulse on the toggle. Explicit player override always wins — no re-auto-switch.

---

## 3b. Weapon and spell roll integration

The Combat sub-tab shows weapons and spells not as a read-only reference but as a **roll surface** — every row has direct attack and damage buttons. The player should never need to manually configure the dice roller for a weapon they use every turn. All rolls flow into the shared dice roller history.

### The two-step roll model

D&D's attack rhythm is: declare → roll attack → DM calls AC → roll damage. The UI mirrors this. **Two buttons per row**: `[ ⚔ Attack ]` and `[ ✦ Damage ]`, always visible. They are separate, not combined — combining them hides the miss case and doesn't match how the game is played.

After an Attack roll, the Damage button **brightens and pulses** (240ms accent pulse, then settles to an elevated state for 8 seconds) to signal "your attack landed — now roll damage." The player can still tap Damage independently when they don't need the to-hit check (auto-hits, follow-up DM calls). After 8 seconds, the Damage button decays back to its secondary weight.

### Three behavior classes

**1. Attack-roll items** (weapons, eldritch blast, ray of frost): `[ ⚔ Attack ]` + `[ ✦ Damage ]`. Default shape.

**2. Save-DC spells** (fireball, hold person): `[ ✦ Cast (DC 15) ]` + `[ ✦ Damage ]`. Cast does not roll d20 — it announces the spell, consumes the slot, and prints `Cast Fireball at L3 · DC 15` into history. The target's save happens on the DM/target side.

**3. Utility / duration spells** (hex, hunter's mark, bless): `[ ✦ Cast ]` only. No damage roll. If the spell requires concentration, casting automatically sets the concentration banner.

### Spell slot auto-consume

When a leveled spell is cast (Attack, Cast, or Damage — whichever fires first), the highest available slot of that spell's level is **decremented automatically**. The dice roller result card shows `Slot L2 used` in IM Fell English 11px tracked, with an `Undo` ghost link that stays live for 8 seconds, then fades.

If no slot of the spell's level is available: the action buttons render in `pal.textMuted`, labelled `No L2 slot`, and are non-interactive. The row's expand chevron still works for reading the description.

### Cantrips

Cantrips show `Cantrip` instead of a level pill, never consume a slot, and never show the slot-used line in the result.

### Result display — shared dice roller history

All rolls — from weapon rows, ability chip taps, and the dice roller's own controls — write to the **same roll history in the dice roller**. No floating result cards, no per-row inline result. History is the single bulletin board.

History entry format for weapon/spell rolls includes a source label:

```
Hex Blade · Attack    1d20+7 → 18
Hex Blade · Damage    1d8+4  → 9 slashing
Fireball  · Cast      L3 slot used · DC 15
Fireball  · Damage    8d6    → 28 fire
```

Source label: IM Fell English 10px tracked `pal.textMuted`. On mobile, a row-initiated roll triggers auto-scroll to the history entry (320ms smooth scroll), followed by a 220ms `pal.accentBright` border pulse on the new entry.

### Advantage / disadvantage

A **per-row adv/dis chip** (24×24px) sits between the row metadata and the action buttons. Single-tap cycles `·` (inherit global) → `▲` (advantage) → `▼` (disadvantage) → `·`. When set to non-normal, the chip glows `pal.accentBright`. The override applies to the next Attack roll from this row only, then resets to `·`.

The global adv/dis toggle in the dice roller also resets to Normal after each row-initiated roll (matching the DM dice roller behavior).

### Row anatomy

```
┌────────────────────────────────────────────────────────────────┐
│ Hex Blade                 1d8+4 · +7 hit              ⌄        │
│ [ ⚔ Attack ]  [ ✦ Damage ]   [·]                               │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Fireball  (L3)            8d6 fire · DC 15            ⌄        │
│ [ ✦ Cast (DC 15) ]  [ ✦ Damage ]   [·]                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Hex  (L1)                 Concentration · BA          ⌄        │
│ [ ✦ Cast ]   [·]                                               │
└────────────────────────────────────────────────────────────────┘
```

- **Name**: 15px Crimson Text `pal.text`. Level pill `(L3)` in IM Fell English 11px tracked `pal.accent`. Cantrips: `(Cant.)` in `pal.textMuted`.
- **Metadata**: 12px IM Fell English `pal.textMuted`. Format: `Xd Y · +N hit` / `Xd Y · DC N` / `Concentration · BA`.
- **Expand chevron**: 24×24px tap target. Toggles description row.
- **Action buttons**: 36px tall. Attack uses ⚔, Damage/Cast use ✦. `.btn-ghost` at rest; Damage brightens for 8s after Attack roll.
- **Per-row adv/dis chip**: 24×24px. Cycles `·` → `▲` → `▼`.
- **Row height**: 56px. No card chrome — rows are separated by `1px solid pal.border` on the surface.

### Dice visual treatment — existing DieShape components required

All dice rendered in the Session mode dice roller, weapon row roll triggers, and ability chip roll triggers **must reuse the existing `DieShape` polygon SVG components** from `src/components/DiceRoller.jsx` (d4 triangle, d6 square, d8 diamond, d10 kite, d12 pentagon, d20 near-circle, d100 octagon). Square/rectangular die buttons are a regression — the shaped dice are a distinctive app feature. Do not redraw them.

---

## 4. Desktop two-column layout (≥900px breakpoint)

### Single-surface model (most important design principle)

The Session view is **one dark surface divided into two columns by a vertical rule** — not two floating panels. This is what makes the DM dashboard feel premium: one object, not a collection of card widgets. Apply the same restraint here.

Sections inside each column are separated by:
- **Horizontal rules** (`1px solid pal.border`, `margin: 20px 0`)
- **IM Fell English section labels** (11px uppercase tracked `pal.textMuted`) above each region
- **Spacing** (12–24px vertical) within regions

**Sections that ARE elevated cards** (floating above the surface, `pal.surface` background, 1px border, subtle box-shadow):
- **The HP hero block** — the most important interactive element earns its own elevation
- **Modals** (Damage/Heal, Condition Manager)
- **The dice roller** — keeps its existing chrome

**Everything else lives on the surface** — identity strip, ability chips, initiative strip, party strip, conditions row, spell slots, inspiration toggle, weapon/spell rows, sub-tab content. No individual bordered boxes. No drop shadows on these elements. Rhythm comes from rules, labels, and typography.

### Left column palette wash

The left column receives a very subtle palette-tinted wash: `background: linear-gradient(180deg, rgba(pal.accent, 0.05) 0%, rgba(pal.accent, 0.02) 100%)`. The right column stays on the page background (no tint). The vertical rule between columns is the meeting line between the tinted "who and when" side and the neutral "what you do" side.

### HP hero — scaled back

The prototype's HP hero was too dominant. Revised scale:
- **Current HP**: Cinzel **40px**, `pal.gem`
- **Slash + max HP**: Cinzel 24px, `pal.textMuted`
- **Temp HP badge**: 13px IM Fell English tracked, `pal.accentBright`
- **HP bar**: **6px tall**, full card width, color-coded
- **Buttons**: `[−] [+]` are 32px circle steppers; `[⚔ Damage] [✦ Heal]` are 36px tall `.btn-ghost`
- **Card total height**: ~96px. Still the most prominent element in the right column, but no longer dominating.

### Column anatomy

```
┌────────────────────────────────────────────────────────────────────────┐
│ ① Top bar: ← All Characters · World Guide · Export · ⋯               │
├────────────────────────────────────────────────────────────────────────┤
│ ② [❡ PROFILE | ⚔ SESSION] toggle                                      │
├──────────────────────────┬─────────────────────────────────────────────┤
│ LEFT (tinted wash)       │ RIGHT (neutral surface)                     │
│ 340px sticky             │ flex, max ~720px, scrolls                   │
│                          │                                             │
│ ③ Identity strip         │ ── ⑦ Concentration banner (when active) ── │
│  [56/72px portrait]      │                                             │
│  Name · Class · Lvl      │ ⑧ HP HERO  [ elevated card ]               │
│  AC  Spd  badges         │   40  /44    +5 temp                        │
│                          │   [────────────░] 6px bar                   │
│ ── ABILITIES ──          │   [−][+]   [⚔ Damage]  [✦ Heal]            │
│ ④ Ability mod chips      │                                             │
│  3×2 grid                │ ── CONDITIONS ──                            │
│                          │ ⑨ Active conditions row  [+ Manage]         │
│ ── INITIATIVE ──         │                                             │
│ ⑤ Initiative entries     │ ── SPELL SLOTS ──                           │
│  (full list, always)     │ ⑩ Per-level pip rows                        │
│                          │                                             │
│ ── PARTY ──              │ ── ⑪ Inspiration ──                         │
│ ⑥ Party member rows      │                                             │
│  44px / 56px+glow active │ ── ⑫ Session sub-tabs ──                    │
│                          │   COMBAT | LOADOUT | MAP | NOTES  38px      │
│                          │                                             │
│                          │ ⑬ Sub-tab content                           │
│                          │   (Map expands to fill in non-combat)       │
│                          │                                             │
│                          │ ⑭ Dice roller  [ own card chrome ]          │
└──────────────────────────┴─────────────────────────────────────────────┘
         ▲ single 1px pal.border vertical rule, full height
```

### Numbered legend

① **Top bar** — unchanged from today. Full-width, above mode toggle.

② **Mode toggle** — top-left, ~220px wide. Always visible without scrolling.

③ **Identity strip** — 56px portrait circle at rest; grows to **72px and glows** when it's the player's own turn (see §5). Name Cinzel 20px, "Class · Lvl N" IM Fell English 11px tracked. AC and Speed as small badges. No card border — lives on the tinted surface.

④ **Ability mod chips** — 3×2 grid. Stat name IM Fell English 10px, modifier Cinzel 22px `pal.gem`. Tap to shortcut a roll into the dice roller.

⑤ **Initiative strip** — full list always visible. See §6.

⑥ **Party strip** — 44px resting / 56px active-turn avatars with palette ring glow. See §5.

⑦ **Concentration banner** — full right-column width. Inline on the surface (no card chrome). Hidden when not concentrating. `+ Concentration` ghost button in its place when inactive.

⑧ **HP hero** — elevated card as described in "HP hero — scaled back" above. Only elevated card in the page body.

⑨–⑪ **Right column sections** — live on the surface, separated by horizontal rules and IM Fell English labels. No individual card borders.

⑫ **Session sub-tabs** — 38px strip: COMBAT (default in combat / when map is inactive), LOADOUT, MAP (auto-selected in non-combat when active map exists), NOTES.

⑬ **Sub-tab content** — scrolls within the right column. **Map panel option**: when no initiative is active and a map is set, MAP tab is auto-selected and the content area expands to fill available height between the inspiration row and the dice roller (~480–640px). MapViewer fills this space. Combat sub-tab (and others) have their natural content height only.

⑭ **Dice roller** — pinned to bottom of right column, expanded by default. Keeps its own chrome (self-contained component). All weapon row and ability chip rolls append to this history.

### Column widths and breakpoints

- **<900px**: single column (see §8)
- **900–1199px**: left 320px, right flexes; names truncate, party HP bars ~80px
- **≥1200px**: left 340px, right max ~720px, left-aligned
- **≥1600px**: additional width is whitespace

### Does the tab bar survive?

**No.** The Profile four-tab strip is replaced in Session mode by the mode toggle + Session sub-tab strip. Persona tab is unreachable in Session mode by design.

### Scroll behavior

Right column scrolls only. Left column is sticky below the top bar + mode toggle. If party + initiative + chips overflow viewport height, the party strip becomes internally scrollable; identity and initiative stay anchored.

---

## 5. Party status strip

The party strip is the player's ambient awareness of the rest of the table. **Avatars are the dominant signal** — larger than in a typical strip, with the active-turn member's avatar grown and glowing as the primary turn indicator.

### Avatar sizing

- **Resting**: **44px** portrait circles
- **Active turn**: **56px** — the avatar of the character whose initiative turn it currently is grows to this size. This is the primary turn indicator. Animated: 220ms ease-out scale on enter, 180ms ease-in on exit.
- **Active-turn ring glow**: `box-shadow: 0 0 0 2px pal.accent, 0 0 12px 4px rgba(pal.accent, 0.45)`, pulsing at 1.8s cycle (spread 4px→8px→4px, opacity 0.45→0.65→0.45). In that character's own palette accent.

The `⚔` glyph turn indicator from earlier designs is **removed** — avatar size + glow is the indicator.

### Identity strip portrait — own turn

When it's the **current player's own turn**, their portrait in the identity strip (top of left column) also grows and glows:
- Grows from resting 56px to **72px**
- Same `pal.accent` ring glow, 1.8s pulse
- 220ms ease-out scale on enter

This ensures "YOUR TURN" is felt at the identity level — their own face on the page signals the turn before any text is read. The initiative strip `· YOUR TURN` label remains for reinforcement.

### Row anatomy

```
Resting (44px portrait):
│ [◉Ar 44px]  Aragorn   18/24  [██████░░]  [Prone]  │

Active turn (56px portrait + ring glow):
│ [◉Ar 56px🔆]  Aragorn   18/24  [██████░░]  [Prone]  │
```

- **Portrait**: 44/56px circle, in that character's palette color. Initial letter if no portrait.
- **Name**: Cinzel 14px, in that character's `pal.accent` color.
- **HP numerals**: `current/max` Cinzel 14px. Red when below 20%.
- **HP bar**: 80–100px wide, 6px tall, proportional fill with standard color thresholds.
- **Active conditions**: up to 2 inline chips; `+N` overflow.
- **Bloodied state**: row border brightens to `pal.accent` at <50%; `#c06060` at ≤20%; `deathGlow` red pulse at 0 HP.
- **Concentration dot**: small pulsing gem dot between name and HP when concentrating.
- **Inspiration dot**: small gem dot next to name when inspired.

### HP display: exact

Show both numerals AND bar. Exact numbers matter to the healer planning spell slots.

### What is NOT shown

- Spell slots, inventory, full stats, AC, ability mods, DM notes
- Death save pip count — row shows "DOWN" at 0 HP, "FALLEN" in `#c06060` Cinzel at 3 failures

### Self-card omitted

Strip shows only other party members. Own HP is the right-column hero card.

### Read-only

Tapping a row does nothing. Ambient communication, not action surface.

### Data source — **architect concern (§14.1)**

Needs `GET /dm/party` equivalent. New player-accessible endpoint required.

### Mobile delta

44px resting / 56px active on mobile too. At 320–360px, HP bars shrink to ~60px to preserve the 56px active avatar without truncating names.

---

## 6. Initiative strip

### Anatomy

```
┌─────────────────────────────────────┐
│ INITIATIVE             Round 3      │
├─────────────────────────────────────┤
│  ▸ Eoghan       (you)  · YOUR TURN │  ← active + self
│    Goblin Scout                     │  ← npc, plain
│    Aragorn                          │  ← pc, palette dot
│    Goblin B                         │
│    Aesop                            │
└─────────────────────────────────────┘
```

### Header

- "INITIATIVE" label: IM Fell English 11px uppercase tracked, `pal.textMuted`
- Round counter: Cinzel 13px `pal.accentBright`. On advance: 400ms brighten pulse.
- Empty state: "No initiative set" italic Crimson Text 13px `pal.textMuted`.

### Each entry

- **Active turn**: `▸` glyph `pal.accentBright`, name brightened, 2px left border `pal.accentBright`, subtle `pal.accentDim` row background.
- **Player's own turn** (active): same + `· YOUR TURN` in 11px IM Fell English tracked, with 600ms accent-glow pulse.
- **Player's own entry** (not active): name in own `pal.accent` color.
- **Other PC entries**: name in that PC's `pal.accent` color + 16px palette-colored dot to the left.
- **NPC/enemy entries**: name in `pal.textBody`, no leading dot — plainer than PC rows by design.
- **NPC/enemy health tier glow**: when wounded, the enemy row carries a soft glow — **yellow** (`box-shadow: 0 0 6px rgba(200,168,64,0.4)`, amber 2px left border) below 50% HP; **red** (`box-shadow: 0 0 8px rgba(192,96,96,0.5)`, danger 2px left border) below 25% HP. No bar, no numerals — glow only. DM-configurable toggle in session settings; default **on**.

### Hidden enemies

The DM controls show/hide per NPC initiative entry **globally** (not per-player). Entries marked hidden are omitted entirely from all player views — no placeholder. Future addition (flag only): a "Hidden" boolean on the initiative entry shape visible on the DM's own view (greyed/marked) but omitted from player-facing views.

### Initiative roll values

**Not shown** — order only. See §14.2.

### Read-only

Tapping an entry does nothing.

### Data source — **architect concern (§14.1)**

Reuses `GET /initiative` — currently DM-only auth. Must be accessible from the player sheet.

---

## 7. Edge cases and empty states

### Solo character (no party, no initiative)

Left column shows quiet placeholder lines: "No initiative set." and "Solo adventure — no other party members." Italic Crimson 13px `pal.textMuted`, no card chrome.

### Healthy no-combat session

HP shows `44/44` in normal `pal.gem`. Conditions row absent. Concentration absent. Map sub-tab auto-selected and expanded if active map exists. Screen is calm and sparse — the dice roller is the dominant interactive element.

### Combat active, player healthy, ally at low HP

Hero is normal-state. Party strip shows the bloodied ally's row in red — the one demanding element on the page.

### Player's own HP at 0

HP hero card gets `deathGlow` red pulse. "UNCONSCIOUS" label replaces HP numerals. Death save pips shown passively (display-only v1 — see §14.3).

### DM has disabled party visibility

Party strip slot renders: "Party status hidden by DM" italic Crimson 13px. Initiative still shows PC names and turn order.

### No active map, Map sub-tab selected

Sub-tab dimmed (opacity 0.4, `cursor: not-allowed`). Brightens with 220ms ease-out when DM activates a map.

### Player has not unlocked the sheet

Mode toggle, party strip, initiative strip do not render without unlock.

---

## 8. Mobile behavior

### Profile mode on mobile (<900px)

**Unchanged from today.** Only addition: `PROFILE | SESSION` toggle at the very top, just above the portrait.

### Session mode on mobile (<900px)

Single column. **Same single-surface model as desktop** — sections separated by horizontal rules and IM Fell English labels, not individual card borders. HP hero is the only elevated card. The identity region receives the subtle palette-tinted wash (`rgba(pal.accent, 0.05)`); below identity the surface is neutral.

```
┌───────────────────────────────┐
│ ← All Chars · ⌃ · ⤴ · ✎      │ ← top bar
├───────────────────────────────┤
│ [ ❡ PROFILE | ⚔ SESSION ]     │ ← mode toggle (sticky)
├──── tinted wash ──────────────┤
│ [◉ 56px / 72px on your turn]  │ ← identity strip (sticky)
│  Eoghan                        │
│  Warlock · Lvl 5  AC15 Spd30  │
├──── ABILITIES ────────────────┤
│ STR−1 DEX+3 CON+1 WIS+0 INT+2 │
│ CHA+4                          │
├──── HP ───────────────────────┤  ← only elevated card
│  ┌──────────────────────────┐  │
│  │  40  /44    +5 temp      │  │
│  │  [────────░░] 6px bar    │  │
│  │  [−][+]  [⚔ Dmg][✦ Heal] │  │
│  └──────────────────────────┘  │
├──── INITIATIVE ───────────────┤
│ Round 3 · Eoghan · YOUR TURN  │
│ ▼ Show order                  │
├──── PARTY ────────────────────┤
│ [◉44] Aragorn  18/24 [████░]  │
│ [◉56🔆] Aesop 12/12 [████]    │ ← active turn: 56px + glow
├──── CONDITIONS / SLOTS ───────┤
│ [Prone] [+ Manage]            │
│ L1 ●●○○  L2 ●○○               │
│ ◆ Inspiration                  │
├───────────────────────────────┤
│ [COMBAT|LOADOUT|MAP|NOTES]    │ ← session sub-tabs, 44px
│ (sub-tab content)             │
├───────────────────────────────┤
│ DICE ROLLER  [ card chrome ]  │ ← expanded by default
└───────────────────────────────┘
```

Key mobile decisions:

- **Mode toggle is sticky** at the top — always one tap away.
- **Section labels** (ABILITIES, HP, INITIATIVE, PARTY, CONDITIONS/SLOTS) replace card borders as section delimiters.
- **HP hero is the only elevated card** — `pal.surface` background, 1px `pal.border`, 4px border-radius, subtle elevation shadow.
- **Identity strip portrait** grows to 72px + palette ring glow when it's the player's own turn.
- **Party strip avatars**: 44px resting / 56px + glow on active turn. At 320–360px, HP bars shrink to ~60px.
- **Initiative collapsed** to one active-turn line by default; `▼ Show order` expands inline with 220ms max-height transition. Auto-collapses when the active turn changes.
- **Tab bar transformation**: Profile four-tab strip completely replaced by Session sub-tab strip. Persona unreachable in Session mode.
- **No sticky columns** — everything scrolls vertically. Sticky: top bar, mode toggle, identity strip.

### Smallest mobile (320–360px)

- Initiative names truncate at ~14 chars
- Party names truncate at ~12 chars; HP bars ~60px
- AC and Speed in identity collapse to one line: "AC 15 · Spd 30"
- Round counter compacts to "R3"
- HP hero current-HP drops from 40px to 36px

---

## 9. Information hierarchy in Session mode

Ranked by visual weight, most prominent first:

1. **HP HERO** — elevated card, largest number on the surface. Color-codes safe / wounded / critical.
2. **Active turn indicator** — party avatar grows + glows; identity portrait grows + glows on own turn. Readable within 200ms of glancing at the screen.
3. **Bloodied/down party members** — red border + red HP numbers + `deathGlow` pull peripheral attention.
4. **Concentration banner** (when active) — full-width, pulsing dot.
5. **Identity + ability mod chips** — quiet anchors; referenced intentionally.
6. **Initiative full list, party strip healthy members** — ambient, scanned not stared at.
7. **Inspiration, spell slots** — referenced when planning.
8. **Session sub-tabs, weapon/spell rows, dice roller controls** — interactive surfaces.

The HP hero in Session mode is roughly **2× the visual weight** of Profile mode's HP number (40px vs ~18px in the stats panel), supported by its elevated card and color-coded bar — prominent but no longer dominating.

---

## 10. Motion & animation spec

| Event | Animation | Duration |
|---|---|---|
| Profile → Session switch | Profile content fades out (160ms); Session layout fades in (200ms), desktop right column slides in from right (240ms translateX +24px→0) | 280ms total |
| Session → Profile switch | Reverse; right column slides out | 280ms total |
| Auto-switch to Session on page load | Session renders immediately; mode toggle receives 400ms accent-border-bright pulse | 400ms |
| HP change (own) | Number cross-fade 160ms; bar 280ms; red flash on damage / green flash on heal (180ms); danger-border ramp 320ms + 480ms pulse on crossing 20% | 280–480ms |
| HP change (party strip) | Bar animates 280ms; border brightens on bloodied/critical (220ms); deathGlow at 0 | 220–480ms |
| Active turn changes | Old entry fades out (140–180ms); new entry fades in (160–200ms); `YOUR TURN` slides in (240ms) + 600ms glow pulse | 220–600ms |
| Round increments | Number cross-fade 140ms + 400ms brighten pulse | 400ms |
| Party member drops to 0 HP | Row enters deathGlow; HP numerals red (160ms); "DOWN" slides in (180ms) | 180ms + ongoing |
| **Active turn — party avatar grows** | scale 1.0 → 1.27 (44→56px), ring glow fades in | 220ms ease-out |
| **Active turn — party avatar shrinks** | scale 1.27 → 1.0, ring glow fades out | 180ms ease-in |
| **Active turn — own identity portrait grows** | scale 1.0 → 1.29 (56→72px), ring glow fades in | 220ms ease-out |
| **Avatar ring glow pulse (ongoing)** | box-shadow spread 4→8→4px, opacity 0.45→0.65→0.45 | 1.8s cycle ease-in-out |
| **Weapon row Attack button tapped** | dice roller shake + spin + settle (existing animation) | ~1000ms total |
| **Damage button brightens after Attack** | bg pulse to pal.accentBright, settles to accentDim hold | 240ms pulse + 8s hold |
| **Damage button decays** | bg fades from accentDim to transparent | 320ms ease-out |
| **Spell slot consumed** | just-used pip scales 1.0→0.7→1.0 then state = empty | 220ms |
| **Slot Undo link fade** | opacity 1→0 after 8s idle hover | 8s hold, 220ms fade |
| **History entry pulse (row-initiated roll)** | new entry receives 220ms border pulse in pal.accentBright | 220ms |
| **Mobile auto-scroll to history** | smooth window scroll to new history entry | 320ms ease-out |
| **Per-row adv/dis chip cycle** | text/icon cross-fade | 120ms |
| **Per-row adv/dis chip reset after roll** | scale 1.0→0.85→1.0 + color fade to textMuted | 180ms |
| Mode toggle first-visit hint | 1.6s breathing pulse on toggle, stops after first interaction or 3 cycles | — |
| Sub-tab change | Outgoing opacity 1→0 (100ms), incoming 0→1 (140ms) | 240ms |
| Initiative expand on mobile | List max-height 0→natural (220ms ease-out cubic); ▼ rotates 180° (180ms) | 220ms |
| `prefers-reduced-motion` | All animations instant; color states remain | — |

**No animation on:** tapping party strip row, tapping enemy initiative entry, toggling own conditions chip.

---

## 11. Interaction model

### Mode toggle
- Tap inactive segment: switches mode, stores to sessionStorage, triggers animation.
- Tap active segment: no-op.
- Keyboard: Tab reaches toggle; Enter/Space switches.

### HP hero block
- ±1 stepper: 500ms initial delay, 80ms repeat; floating delta indicator; 300ms debounced flush.
- Damage / Heal buttons: open `DamageHealModal`. Backdrop or Escape cancels.
- Max HP changes require Profile → Edit.

### Active conditions row
- Tap chip or `+ Manage`: opens condition manager modal (14-condition grid + exhaustion stepper).

### Party strip rows
- Tap: no-op.

### Initiative strip entries
- Tap: no-op.

### Session sub-tabs
- Tap: switches sub-tab. Stored as `sessionStorage.dnd_session_subtab_${slug}` (default `"combat"`).

### Loadout sub-tab
- All today's Loadout interactions preserved: attunement, equipped, qty steppers, potion Use, Drop Item. No edit-mode entry.

### Concentration banner
- "Drop Concentration": instant write, no confirmation.
- `+ Concentration` ghost button: reveals input inline on tap. Auto-populates when a concentration spell is cast from the Combat sub-tab.

### Dice roller
- Identical to `DiceRoller.jsx`. Expanded by default in Session mode (writes `dnd_dice_open_${slug} = "true"` once on first Session-mode entry). Profile mode behavior unchanged.
- **DieShape polygon SVGs required** — d4 triangle, d6 square, d8 diamond, d10 kite, d12 pentagon, d20 near-circle. Reuse existing component from `DiceRoller.jsx`. No square buttons.

### Weapon / spell row — Attack button
- Tap: dice-roller shake/spin/settle animation. Writes `<Name> · Attack` to history. Damage button brightens for 8s. Global and per-row adv/dis resets to Normal.

### Weapon / spell row — Damage button
- Tap: same animation. Writes `<Name> · Damage` to history.

### Weapon / spell row — Cast button
- Tap: no d20 roll. Writes `Cast <Name> at L<N> · DC <N>` to history. Consumes highest available slot. Sets concentration banner if applicable. Undo link in history for 8s.

### Weapon / spell row — per-row adv/dis chip
- Single tap: cycles `·` → `▲` → `▼` → `·`. Resets to `·` after next Attack roll.

### Weapon / spell row — disabled (no slot)
- Tap Attack/Damage/Cast: no-op. Expand chevron still works.

### Ability mod chips
- Tap: shortcut roll into dice roller. Writes `<STAT> check → <result>` to history.

---

## 12. Coexistence with existing features

| Feature | Profile mode | Session mode |
|---|---|---|
| Session Notes | Combat tab | NOTES sub-tab |
| Concentration banner | Combat tab | Top of right column, above HP hero. **Auto-set when a concentration spell is cast from Combat sub-tab.** |
| Inspiration toggle | Combat tab | Below spell slots in right column |
| XP / Coin | Inventory tab | LOADOUT sub-tab, bottom |
| Skills/Spells/Special Abilities badges | Stats panel | **Not displayed** — switch to Profile |
| Concentration set input | Combat tab | Ghost `+ Concentration` button inline |
| Edit mode entry | Top bar | Overflow `⋯` menu in top bar |
| World Guide | Top bar | Top bar (mode-independent) |
| **Weapon / spell rolls** | Read-only quick-reference | **Inline Attack / Damage / Cast buttons; results flow into shared dice roller history. Auto-consume slots for leveled spells.** |

---

## 13. Mobile vs desktop delta

| Element | Mobile / narrow (<900px) | Desktop (≥900px) |
|---|---|---|
| Layout | Single column | Two columns: left 340px, right flex |
| Surface model | Single surface, horizontal rules | Single surface, vertical rule between columns |
| Left column wash | Tinted top (identity region only) | Full left column tinted |
| Mode toggle | Sticky top, full-width, 44px | Top-left, ~220px |
| Identity strip | Full-width row, sticky | Top of left column, sticky |
| Ability chip strip | Below identity, 3×2 | Left column, 3×2 |
| HP hero | Elevated card, below chips | Elevated card, top of right column |
| Concentration banner | Above HP hero | Full right-column width, above HP hero |
| Initiative strip | Collapsed to 1 line + ▼ Show order | Full list always visible in left column |
| Party strip | Below initiative, full-width | Bottom of left column |
| Party portrait (resting) | 44px | 44px |
| Party portrait (active turn) | 56px + ring glow | 56px + ring glow |
| Identity portrait (own turn) | 72px + ring glow | 72px + ring glow |
| Active conditions | Below HP hero | Right column |
| Spell slots | Below conditions | Right column |
| Inspiration | Below spell slots | Right column |
| Session sub-tabs | Below inspiration, full-width, 44px | Right column, 38px |
| Map sub-tab | Full-width sub-tab content | Expands to fill right column in non-combat |
| Sub-tab content | Single column | Right column |
| Dice roller | Below sub-tab content, expanded, card chrome | Pinned bottom of right column, expanded, card chrome |
| Sticky behavior | Top bar + toggle + identity | Top bar + toggle; left column sticky; right scrolls |
| Party HP bar | ~80px (60px at ≤360px) | ~100px |
| Initiative name truncation | ~14 chars | ~28 chars |
| Round counter | Inline in collapsed initiative line | Top-right of initiative header |
| Session sub-tab height | 44px | 38px |
| HP current number size | 40px (36px at ≤360px) | 40px |

---

## 14. Open questions

1. **Party + initiative endpoint auth (architect required before implementation)**: `GET /dm/party` and `GET /initiative` currently require DM auth. Session mode needs both. Options: (a) new unauthenticated `GET /party/status` endpoint returning only session-visible projection, (b) character-password-gated, (c) new player-auth model. **Recommendation**: option (a) — matches ADR-005 no-auth philosophy.

2. **Initiative roll values shown?** Brief defaults to no (order only). Trivial change later.

3. **Player-controlled death save pips on player sheet?** v1 = display-only; v2 = let player tap a pip to write. Race condition with DM writes needs architect review.

4. **Map as third column on very wide desktops (≥1400px)?** Not for v1.

5. **Profile mode wide-desktop layout?** Leave Profile alone for v1.

6. **Auto-switch threshold**: `entries.length > 0 AND round > 0` to avoid auto-switching during pre-loaded-between-sessions case.

7. **Mode toggle glyphs**: ❡ (profile) and ⚔ (session) proposed. Labels alone are clear if glyphs feel heavy.

8. **Active-turn haptic/audible cue on mobile?** Not for v1.

9. **Damage button auto-brighten duration**: 8 seconds set in brief. Adjust after playtest if too short/long.

10. **Per-row adv/dis chip vs. global toggle**: if per-row chip proves confusing in playtesting, fall back to global-only.

11. **Slot auto-consume on Cast vs. on Damage**: for attack-roll spells, missing the attack still costs the slot (RAW). Confirm against table's house rules before implementation.

---

## Files to touch (for code-architect annotation)

**Frontend only — no backend implementation until §14.1 is resolved.**

- `src/components/CharacterSheet.jsx` — mode state, Session layout, desktop two-column, party/initiative strips, weapon roll integration (behind feature flag until endpoint exists)
- `src/features/characterSheet/characterSheet.css` — Session mode layout rules, two-column breakpoints, HP hero card, party/initiative strip styles, weapon row styles, avatar grow animations
- `src/api.js` — new `getPartyStatus()` and `getInitiativePublic()` calls (pending architect decision)
- `src/pages/CharacterPage.jsx` or equivalent — top-level layout wrapper for two-column session view
