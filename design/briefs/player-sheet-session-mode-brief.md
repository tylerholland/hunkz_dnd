# Player Sheet — Profile / Session Mode Brief

> Story 27. The player-facing character sheet evolves from a single narrow column into a context-aware surface with two clearly named modes — Profile (the booklet) and Session (the combat reference card). On desktop, Session mode unfolds into a two-column command surface anchored by a party status strip and live initiative. On mobile, the same two modes are reachable through a single, persistent toggle.
> Produced by design-strategist. **Revised pass 3** — incorporates the player's Design Direction (map as collapsible right-column panel, compact left-column HP, dedicated Recovery & Damage action zone) validated by the RPG Consultant Review. Pass-2 decisions on the mode toggle, party/initiative strips, dice/weapon integration, and single-surface aesthetic are preserved except where the Design Direction overrides them.

---

## 0. What changed in pass 3 (read this first)

Three structural decisions from the player's Design Direction supersede pass 2. Everything else in this brief stands.

1. **Map is a collapsible panel, not a sub-tab.** It lives at the **top of the right column**, always present, player-collapsible. The COMBAT / LOADOUT / NOTES sub-tabs live *below* it and are independent of whether the map is open or closed. There is no MAP sub-tab anymore.

2. **HP moves to the left column, compact.** The 40px "HP hero" elevated card in the right column is **removed**. HP becomes a compact block in the left column, directly below the identity strip and above the ability chips — `28–32px` Cinzel current number, thin bar, inline `± 1` steppers. It stays visible regardless of which right-column tab (or map state) is active.

3. **Recovery & Damage is a dedicated action zone** — separate from the passive HP readout. It contains **Take Damage**, **Receive Healing**, and **Spend Hit Die**, plus a contextual **concentration-check nudge**. The symmetric `[⚔ Damage] [✦ Heal]` button pair is retired. Potion healing stays in the Loadout `Use` button — it is *not* duplicated here.

The reasoning, per the RPG Consultant Review: the player reads their own single HP number (which they roughly know already) — it never needed hero-size weight. The battle map is the dominant shared reference during combat and deserves the right column's width. And the three HP-change events at a real table (record DM-called damage, record ally/DM healing, spend hit dice on a rest) are asymmetric self-service actions, not a mirrored damage/heal pair.

---

## 1. Design intent

The player at the table has two distinct jobs. Between sessions they are an **author** — reading their backstory, leveling up, updating equipment, planning spells. During play they are an **operator** — tracking HP under pressure, watching whose turn it is, reading the battle map, calling for healing, deciding whether to burn a slot. The current sheet treats these jobs identically, which means the operator scrolls past 800px of authorial content to find their HP.

The emotional goal is **mode confidence** — the player should always know which mode they are in, and switching should feel like turning the page of a notebook, not opening a new app. The functional goal is **glance-able session play**: the moment a player opens their sheet during combat they can see their HP, their party's status, the current turn, the battle map, and their dice tray — and HP in particular stays pinned regardless of what they're looking at on the right.

The mental model: **the left column is "who I am and how I'm doing"; the right column is "what I'm looking at and doing."** HP lives on the left because "how I'm doing" is a persistent identity-level fact. The map and the combat/loadout/notes work surfaces live on the right because they are *what you're currently working with*. The vertical rule between columns is the seam between state and action.

The aesthetic reference is the **DM dashboard** — one surface divided by lines, not a collection of floating card widgets. Depth comes from typography contrast (Cinzel vs. IM Fell English), the palette wash on the left column, and selective glow used to communicate state.

---

## 2. Mode definition (the load-bearing decision)

### Profile mode = everything that exists today, untouched

Profile mode is the current narrow single-column sheet: full-bleed portrait + tagline, character details grid, full stats block (ability circles with flyouts, skills/spells/special-ability badges, XP/coin), the four-tab strip (Inventory · Persona · Combat · Map), and the backstory collections viewer. **Nothing changes in Profile mode.** It is correct for reading, editing, leveling, and showing your character off.

### Session mode = the combat reference surface

Session mode collapses or hides everything Profile-only and promotes session-critical fields. Session mode is view-only; editing always exits to Profile (gated behind unlock + edit as today).

**What Session mode hides:** full portrait image (→ identity-strip portrait circle), character details grid, backstory collections, Persona/roleplay traits, the four-tab strip, and the chrome-level edit entry (still reachable via the top-bar `⋯` overflow).

**What Session mode promotes:**
- **Left column (state):** identity strip → **compact HP block** → **Recovery & Damage action zone** → ability mod chips → initiative strip → party status strip.
- **Right column (action):** **collapsible Map panel (top)** → concentration banner (when active) → conditions row → spell slots → inspiration → **COMBAT / LOADOUT / NOTES sub-tabs** → dice roller (pinned bottom, expanded by default).

### Where does Inventory live?

Profile keeps the full Inventory tab. Session exposes a **LOADOUT sub-tab** for the full grid (attunement, equipped toggles, qty steppers, potion `Use`, Drop Item). The COMBAT sub-tab shows the abridged weapons/spells roll surface. Both read the same `weapons[]` / `equipment[]` data — no duplication.

---

## 3. The mode toggle

Unchanged from pass 2.

A two-state segmented pill labeled `❡ PROFILE | ⚔ SESSION`, IM Fell English 12px uppercase, `letterSpacing: 0.2em`, in the same visual family as the tab strip.

- **<900px:** sticky at the top of the sheet, immediately below the top bar. Full-width, 44px tall.
- **≥900px:** top of the left column (spanning its 340px width), just above the identity strip. Always reachable without scrolling.

Active segment uses the existing active-tab treatment (`pal.accentDim` bg, `pal.accent` border, `pal.accentBright` text). Inactive is transparent with `pal.border` / `pal.textMuted`.

**Persistence:** `sessionStorage.dnd_mode_${slug}` ∈ `"profile" | "session"`, default `"profile"`.

**Auto-switch:** if `initiative.entries.length > 0 AND round > 0 AND` no stored preference → open in Session with a 400ms `accentBright` border pulse on the pill. Explicit player override always wins.

---

## 3a. Compact HP block (left column) — NEW PLACEMENT

The HP block sits in the left column directly below the identity strip and above the ability chips. It is a **passive readout with a light self-service stepper** — not the action zone (that's §3b). Keeping it in the left column means it is **always visible**: when the player is reading the battle map or flipping to Loadout on the right, a DM's "you take 12" still lands on a number that's on screen.

### Anatomy

```
┌──────────────────────────────────────┐
│ ① HP   ② 32 / 45   ③ +5 temp   ④[−][+]│
│ ⑤ [██████████████░░░░░] 4px bar       │
└──────────────────────────────────────┘
```

① **"HP" label** — IM Fell English 11px uppercase tracked `pal.textMuted`.
② **Current / max** — `current` in **Cinzel 28px** `pal.gem` (drops to wounded amber `#c8a840` <50%, danger red `#c06060` ≤20%); ` / max` in Cinzel 16px `pal.textMuted`.
③ **Temp HP badge** — only when `tempHP > 0`. IM Fell English 11px tracked `pal.accentBright`, faint bordered pill. Absent (not greyed) when zero.
④ **± 1 steppers** — two 32px circle steppers (44px tap target), right-aligned. Hold-to-repeat (500ms delay, 80ms repeat), floating `+N/−N` delta indicator in `pal.gem`, 300ms debounced flush via `patchSession`. Minor nudges only.
⑤ **HP bar** — full block width, **4px tall**. Color thresholds: healthy `#5a9a5a` >50%, wounded `#c8a840` 20–50%, critical `#c06060` ≤20%. 280ms width transition; damage flash red 180ms / heal flash green 180ms on change.

**Block height:** ~52px. No card border, no elevation — lives on the tinted left-column surface, separated from neighbors by a hairline rule + label.

### 0 HP / unconscious state

Number area replaces `0 / 45` with **"UNCONSCIOUS"** in Cinzel 20px `#c06060`. Bar sits at 0% in `#c06060`. Whole region gets `deathGlow` slow red pulse (1.4s). Death-save pips render passively below the bar (display-only v1): three success pips (`#5a9a5a`) + three failure pips (`#c06060`), filled per `deathSaves`. ± steppers remain.

---

## 3b. Recovery & Damage action zone — NEW SECTION

A dedicated, clearly-labeled action region that models the **actual asymmetric HP-change events at the table**.

### Placement

Left column, directly below the compact HP block. Rationale: cause (action) and effect (number moving) are in the same eye-fixation. Keeps all HP management always-visible regardless of right-column tab/map state.

### Anatomy

```
┌──────────────────────────────────────┐
│ ── RECOVERY & DAMAGE ──               │
│  ① [ ⚔ Take Damage ]  ② [ ✦ Heal ]    │
│  ③ [ ◈ Spend Hit Die · 3 left ]       │
│  ④ ⚠ Concentration: DC 12 save        │  ← contextual only
└──────────────────────────────────────┘
```

① **Take Damage** — primary, most-used. Ghost button; hovers to faint danger tint. Tapping reveals an **inline number stepper + confirm**: number field, `−/+` steppers, six preset jumps (3 · 5 · 8 · 10 · 15 · 20), `Apply` confirm. Applies negative delta via `patchSession`; temp HP consumed first. Escape / re-tap cancels. Preferred form is in-column inline expansion (not modal); `DamageHealModal` is the fallback — flag for architect (§15.6).

② **Heal (Receive Healing)** — secondary weight. Same inline stepper pattern; positive delta clamped to `hpMax`. Label: **`✦ Heal`**.

③ **Spend Hit Die** — full-width ghost button. Label shows remaining: **`◈ Spend Hit Die · 3 left`**. Tapping rolls one hit die + CON mod, applies to `hpCurrent` (clamped to max), decrements count, prints to shared dice history (`Spend Hit Die  1d8+1 → 6 regained`). When no dice remain: `◈ No hit dice left`, 0.4 opacity, non-interactive. Uses `hitDiceCurrent` + CON modifier; die size parses from `hitDice` (e.g. `"4d10"` → d10). Flag absent-field fallback for architect.

④ **Concentration-check nudge** — contextual only. Appears after Take Damage is applied while `concentration.active` is true: **`⚠ Concentration: DC {max(10, floor(dmg/2))} save`** in IM Fell English 11px, amber `#c8a840`. Auto-dismisses after 10 seconds or next HP change / concentration drop. Not a button — display only.

### Section header

`── RECOVERY & DAMAGE ──` — IM Fell English 11px uppercase tracked `pal.textMuted`, hairline rule above.

### What this section deliberately excludes

- **Potion healing** — stays in the Loadout `Use` button (extended to also apply HP via `patchSession`).
- **Long rest** — DM-applied via the dashboard.
- **Death saves, conditions, inspiration** — remain where they are.

---

## 3c. Weapon and spell roll integration

Unchanged from pass 2.

- **Two-step roll model:** `[ ⚔ Attack ]` + `[ ✦ Damage ]` per attack-roll row, always visible and separate. After an Attack roll, the Damage button brightens and pulses (240ms pulse, hold 8s, 320ms decay).
- **Three behavior classes:** attack-roll items; save-DC spells (`✦ Cast (DC 15)` + `✦ Damage`); utility/duration spells (`✦ Cast` only, sets concentration banner if applicable).
- **Spell-slot auto-consume:** casting decrements the highest available slot of that level; result card shows `Slot L2 used` with 8s `Undo` ghost link. No slot → `No L2 slot` in `pal.textMuted`, non-interactive. Cantrips show `Cantrip`, never consume.
- **Shared history:** every roll (weapon rows, ability chips, dice-roller, **Spend Hit Die**) writes to the single dice-roller history with a source label (IM Fell English 10px tracked).
- **Per-row adv/dis chip:** 24×24px, cycles `·` → `▲` → `▼` → `·`; glows `pal.accentBright` when set; applies to next Attack from that row only, then resets.
- **DieShape SVGs required:** all dice reuse existing `DieShape` polygon SVGs from `DiceRoller.jsx`.

Row anatomy:

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

---

## 4. The Map panel — NEW: collapsible right-column panel, not a tab

### Behavior

- **Lives at the top of the right column**, above the concentration banner and above the sub-tab strip. Always present (when a map is active), **always independent of the COMBAT / LOADOUT / NOTES tabs** below it.
- **Collapsible by the player.** Header: `▾ MAP · {map name}` with a pulsing green dot when active. State persisted in `sessionStorage.dnd_map_open_${slug}`. Default: **open** when an active map exists AND combat is active; **collapsed** otherwise.
- **Expanded height:** `min(46vh, 460px)` on desktop; `min(42vh, 360px)` on mobile. `MapViewer` (existing component) fills it.
- **No active map:** collapses to a single quiet inert line — `MAP · the DM hasn't set a map yet` italic Crimson 13px `pal.textMuted`. Brightens live when the DM activates one (220ms ease-in + green dot fade-in).

### Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ ▾ MAP · Goblin Warren  ●                          [collapse] │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │              MapViewer (pan / zoom)                     │ │
│ │              min(46vh,460px)                            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
── (concentration banner, if active) ──
── (conditions · slots · inspiration) ──
── [ COMBAT | LOADOUT | NOTES ]  sub-tabs ──
── Dice Roller (expanded) ──
```

### Why a panel beats a tab

A tab forces either/or: map *or* weapons. A collapsible panel above the tabs lets the player keep the map open while weapon rows sit just below — both in one scroll. On their turn they just look down. Collapsing reclaims space for the combat surface.

### Sub-tab strip

**COMBAT · LOADOUT · NOTES** (three tabs; MAP removed). COMBAT is default. Persona unreachable in Session by design.

---

## 5. Desktop two-column layout (≥900px)

### Single-surface model

One dark surface divided into two columns by a vertical rule — not floating panels. Sections within columns separated by horizontal rules, IM Fell English labels, and spacing — not bordered boxes.

**Elevated cards (only):** the Map panel body (1px border + faint inset, no drop shadow), modals, and the dice roller. Compact HP block and Recovery & Damage zone are **not** cards.

Left column: subtle `linear-gradient(180deg, rgba(pal.accent,0.05) 0%, rgba(pal.accent,0.02) 100%)`. Right column: page background, no tint.

### Column anatomy

```
┌────────────────────────────────────────────────────────────────────────┐
│ ① Top bar: ← All Characters · World Guide · Export · ⋯                 │
├──────────────────────────┬─────────────────────────────────────────────┤
│ ② [❡ PROFILE | ⚔ SESSION] (spans left col, top)                        │
├──────────────────────────┼─────────────────────────────────────────────┤
│ LEFT (tinted wash)       │ RIGHT (neutral surface)                     │
│ 340px sticky             │ flex, max ~760px, scrolls                   │
│                          │                                             │
│ ③ Identity strip         │ ⑩ MAP PANEL (collapsible, top)              │
│  [56/72px portrait]      │   ▾ MAP · name  ●                           │
│  Name · Class · Lvl      │   [ MapViewer  min(46vh,460px) ]            │
│  AC  Spd  badges         │                                             │
│ ── HP ──                 │ ── (⑪ Concentration banner, when active) ── │
│ ④ Compact HP block       │                                             │
│  HP 32/45 +temp [−][+]   │ ── CONDITIONS ──                            │
│  [████████░░] 4px        │ ⑫ Active conditions row  [+ Manage]         │
│ ── RECOVERY & DAMAGE ──  │                                             │
│ ⑤ [⚔ Take Damage][✦ Heal]│ ── SPELL SLOTS ──                           │
│   [◈ Spend Hit Die ·3]   │ ⑬ Per-level pip rows                        │
│   ⚠ Conc DC (contextual) │                                             │
│ ── ABILITIES ──          │ ── ⑭ Inspiration ──                         │
│ ⑥ Ability mod chips 3×2  │                                             │
│ ── INITIATIVE ──         │ ── ⑮ [ COMBAT | LOADOUT | NOTES ] ── 38px   │
│ ⑦ Initiative entries     │                                             │
│ ── PARTY ──              │ ⑯ Sub-tab content (weapons/loadout/notes)   │
│ ⑧ Party member rows      │                                             │
│                          │ ⑰ Dice roller  [ own card chrome, open ]    │
└──────────────────────────┴─────────────────────────────────────────────┘
         ▲ single 1px pal.border vertical rule, full height
```

### Widths & breakpoints

- **<900px:** single column.
- **900–1199px:** left 320px, right flexes; map panel `min(44vh, 420px)`.
- **≥1200px:** left 340px, right max ~760px.
- **≥1600px:** extra width is whitespace (map-as-third-column is out of scope for v1).

### Scroll behavior

Right column scrolls only; left column sticky. If left column overflows viewport height, the **party strip** becomes internally scrollable; identity, HP, and Recovery & Damage stay anchored at the top.

---

## 6. Turn indicator: avatar grow + glow

Avatars are the dominant turn signal. The `⚔` glyph indicator is removed.

- **Party avatars:** 44px resting → **56px on active turn**, `box-shadow: 0 0 0 2px pal.accent, 0 0 12px 4px rgba(pal.accent,0.45)` pulsing 1.8s cycle. 220ms ease-out grow / 180ms ease-in shrink.
- **Own identity portrait:** on own turn, 56px → **72px** with same ring glow + 1.8s pulse. `· YOUR TURN` label reinforces it.

---

## 7. Party status strip

Each row: portrait circle (44/56px, palette-colored) + name in character's `pal.accent` + exact HP numerals (Cinzel 14px, red <20%) + proportional HP bar (6px, 80–100px) + up to 2 condition chips. Bloodied border brightens <50%; `#c06060` ≤20%; `deathGlow` at 0. Concentration/inspiration gem dots near name. **Self-card omitted. Read-only.**

Data source: `GET /party/status` (unauthenticated). When DM disabled: `Party status hidden by DM` italic Crimson 13px.

---

## 8. Initiative strip

Full order always visible on desktop; collapsed to one active-turn line + `▼ Show order` on mobile. Header: `INITIATIVE` + round counter (Cinzel 13px `pal.accentBright`, 400ms pulse on advance). Active entry: `▸` glyph, brightened name, 2px `pal.accentBright` left border. Own active turn adds `· YOUR TURN` (600ms glow pulse). Own non-active: name in own `pal.accent`. Other PCs: name in their `pal.accent` + 16px palette dot. NPCs: `pal.textBody`, no dot. NPC health-tier glow (amber <50%, red <25%) — no bars or numerals for enemies. Hidden entries omitted. Roll values not shown. Read-only.

Data source: `GET /initiative/public` (unauthenticated).

---

## 9. Mobile behavior (<900px)

### Session mode stacking order

```
┌───────────────────────────────┐
│ ← All Chars · ⌃ · ⤴ · ✎      │
├───────────────────────────────┤
│ [ ❡ PROFILE | ⚔ SESSION ]     │ ← sticky
├───────────────────────────────┤
│ [◉ 56/72px on your turn]      │ ← identity (sticky)
│  Eoghan · Warlock Lvl5 AC13   │
├──── HP ───────────────────────┤
│  HP 31/44  +5 temp   [−][+]   │ ← compact, sticky-eligible
│  [████████░░] 4px bar         │
├──── RECOVERY & DAMAGE ────────┤
│  [⚔ Take Damage] [✦ Heal]     │
│  [◈ Spend Hit Die · 3 left]   │
│  ⚠ Concentration: DC 12 save  │
├──── ABILITIES ────────────────┤
│  STR−1 DEX+3 CON+1 …          │
├──── INITIATIVE ───────────────┤
│  Round 3 · Eoghan · YOUR TURN │
│  ▼ Show order                 │
├──── PARTY ────────────────────┤
│  [◉44] Aragorn 18/24 [████░]  │
│  [◉56🔆] Aesop 12/12 [████]   │
├───────────────────────────────┤
│ ▾ MAP · Goblin Warren  ●      │ ← collapsed by default unless combat+map
│ [ MapViewer min(42vh,360px) ] │
├──── CONDITIONS / SLOTS ───────┤
│  [Prone] [+ Manage]           │
│  L1 ●●○○  L2 ●○○   ◆ Inspire  │
├───────────────────────────────┤
│ [ COMBAT | LOADOUT | NOTES ]  │ ← 44px
│ (sub-tab content)             │
├───────────────────────────────┤
│ DICE ROLLER  [ open ]         │
└───────────────────────────────┘
```

Sticky stack: top bar + mode toggle + identity. Compact HP is sticky-eligible (~52px) — if pinning both identity + HP costs too much on smallest screens, identity stays sticky and HP scrolls (flag for architect §15.6). Map panel after party strip, collapsed by default unless combat+map active.

### Smallest mobile (320–360px)

Names truncate ~14 chars; HP number 28px → 26px; map panel `min(40vh, 300px)`.

---

## 10. Information hierarchy in Session mode

1. **Active-turn indicators** — avatar grow + glow. Readable within 200ms of a glance.
2. **Bloodied / down party members** — red border + red HP numerals + `deathGlow`.
3. **The battle map** (when open) — largest media surface on screen.
4. **Compact HP block** — small but always-present; color-coded.
5. **Concentration banner** (when active) — full-width, pulsing dot.
6. **Recovery & Damage actions** — quiet at rest; deliberately accessed.
7. **Identity, ability chips, initiative, healthy party rows** — ambient anchors.
8. **Conditions, spell slots, inspiration, sub-tab content, dice controls** — interactive surfaces.

HP earns its place by *persistence and color*, not bulk. Map and turn indicators carry the room's attention.

---

## 11. Motion & animation spec

| Event | Animation | Duration |
|---|---|---|
| Profile → Session switch | Profile fades out (160ms); Session fades in (200ms); desktop right column slides in from right (240ms) | 280ms |
| Session → Profile switch | Reverse | 280ms |
| Auto-switch to Session on load | Renders immediately; toggle gets 400ms `accentBright` border pulse | 400ms |
| HP change (compact block) | Number cross-fade 160ms; bar width 280ms; red/green flash 180ms; color ramp 320ms on threshold cross | 280–320ms |
| Take Damage / Heal inline expand | Stepper area max-height 0→natural (180ms ease-out); collapses 160ms | 160–180ms |
| Spend Hit Die | Count decrements (instant); roll prints to history with 220ms border pulse; HP animates as heal | 220ms + HP |
| Concentration nudge appears | slide+fade in (opacity 0→1, translateY 4→0, 180ms); auto-dismiss fade 220ms | 180ms / 220ms |
| Map panel collapse/expand | max-height transition 240ms ease-in-out; header chevron rotates 180° (180ms) | 240ms |
| Map activates | Dead line brightens (220ms) + green dot fades in (220ms) | 220ms |
| HP at 0 | Block enters `deathGlow` (1.4s loop); number → "UNCONSCIOUS" (160ms); death-save pips fade in (180ms) | 180ms + loop |
| Active turn changes | Old entry fades (140–180ms); new fades in (160–200ms); `YOUR TURN` slides in (240ms) + 600ms glow | 220–600ms |
| Round increments | Number cross-fade 140ms + 400ms brighten pulse | 400ms |
| Party member → 0 HP | Row enters `deathGlow`; HP red (160ms); "DOWN" slides in (180ms) | 180ms + loop |
| Active-turn party avatar grows | 44→56px; ring glow fades in | 220ms |
| Own identity portrait grows | 56→72px; ring glow fades in | 220ms |
| Avatar ring glow pulse (ongoing) | box-shadow spread 4→8→4px | 1.8s loop |
| Weapon Attack tapped | Dice-roller shake + spin + settle (existing) | ~1000ms |
| Damage button brightens | bg pulse to accentBright, hold 8s, then fade | 240ms + 8s + 320ms |
| Spell slot consumed | Just-used pip scale 1.0→0.7→1.0 then empty | 220ms |
| Sub-tab change | Outgoing opacity 0→1 (100ms), incoming 0→1 (140ms) | 240ms |
| Initiative expand (mobile) | max-height 0→natural (220ms); ▼ rotates 180° | 220ms |
| `prefers-reduced-motion` | All animations instant; color states remain | — |

---

## 12. Interaction model

### Mode toggle
Tap inactive segment → switch + store + animate. Keyboard: Tab reaches it; Enter/Space switches.

### Compact HP block (§3a)
- `± 1` steppers: hold-to-repeat, 300ms debounced `patchSession`. Minor nudges only.
- Max HP changes require Profile → Edit.

### Recovery & Damage (§3b)
- **Take Damage:** tap → inline expand → enter amount → Apply. Temp HP consumed first. Escape / re-tap cancels. Concentration nudge appears if applicable.
- **Heal:** same inline pattern, positive delta clamped to max.
- **Spend Hit Die:** single tap rolls + applies. Non-interactive when 0 dice.
- **Concentration nudge:** display-only, auto-dismisses.

### Map panel (§4)
- Tap header → collapse/expand; persisted `dnd_map_open_${slug}`. No active map → header inert.
- MapViewer pan/zoom unchanged.

### Sub-tabs
Stored `dnd_session_subtab_${slug}` ∈ `"combat" | "loadout" | "notes"`, default `"combat"`. *(MAP is no longer a valid value.)*

### Loadout sub-tab
All existing interactions preserved. Potion `Use` extended to also apply healing to `hpCurrent` in the same `patchSession`.

### Concentration banner
`Drop Concentration`: instant write. `+ Concentration` ghost: reveals inline input.

### Dice roller
Identical to `DiceRoller.jsx`; expanded by default in Session.

---

## 13. Edge cases and empty states

- **Solo, no combat:** initiative → `No initiative set.`; party → `Solo adventure — no other party members.` Italic Crimson 13px.
- **Healthy, no combat:** HP block normal; Recovery & Damage present but calm; map panel collapsed by default; dice roller dominant interactive element.
- **Combat, player healthy, ally low:** HP normal; party strip shows bloodied ally's red row.
- **Player at 0 HP:** compact HP block → `deathGlow` + "UNCONSCIOUS" + passive death-save pips. ± steppers remain.
- **No hit dice left:** Spend Hit Die at 0.4 opacity, `◈ No hit dice left`, non-interactive.
- **Concentrating, take damage:** DC nudge appears and auto-dismisses.
- **DM disabled party visibility:** `Party status hidden by DM`; initiative still shows PC turns.
- **No active map:** map panel collapses to inert line; brightens live when DM activates one.

---

## 14. Mobile vs desktop delta

| Element | Mobile (<900px) | Desktop (≥900px) |
|---|---|---|
| Layout | Single column | Two columns: left 340px, right flex (max ~760px) |
| Mode toggle | Sticky top, full-width, 44px | Top of left column, spans 340px |
| Identity strip | Sticky | Top of left column, sticky |
| **Compact HP block** | Below identity; sticky-eligible | Left column, below identity |
| **Recovery & Damage** | Below HP, inline steppers | Left column, below HP |
| Ability chips | Below recovery, 3×2 | Left column, 3×2 |
| Initiative | Collapsed 1 line + ▼ | Full list always |
| Party strip | Below initiative | Bottom of left column |
| **Map panel** | After party strip; collapsed by default unless combat+map; `min(42vh,360px)` | **Top of right column**; open by default in combat+map; `min(46vh,460px)` |
| Concentration banner | Below map panel | Below map panel, full right width |
| **Sub-tabs** | COMBAT · LOADOUT · NOTES, 44px | COMBAT · LOADOUT · NOTES, 38px |
| Dice roller | Bottom, expanded | Pinned bottom of right column, expanded |

---

## 15. Open questions

1. **Endpoints** — resolved. `GET /party/status` and `GET /initiative/public` exist (unauthenticated). No backend work needed.
2. **Initiative roll values** — hidden (order only). Trivial later change.
3. **Player-controlled death-save pips** — v1 display-only; v2 = tap-to-write.
4. **Map as third column on ultra-wide (≥1400px)** — out of scope for v1.
5. **Profile mode wide-desktop layout** — leave Profile alone for v1.
6. **Take Damage / Heal: inline expansion vs. reuse `DamageHealModal`** — preferred = in-column inline expansion. If over budget, reuse `DamageHealModal` as fallback. Architect to confirm. Also confirm: (a) `hitDiceCurrent` absent-field fallback; (b) whether pinning both identity + HP sticky on smallest mobile is affordable; (c) shared dice history accepts a "recovery" source row.
7. **Spend Hit Die history entry** — prints to shared dice history; confirm history entry shape accepts non-d20, non-weapon "recovery" source label.
8. **Concentration nudge dismissal** — 10s auto-dismiss; adjust after playtest.
9. **Potion `Use` healing** — extend existing Loadout potion `Use` to apply healing value to `hpCurrent` in same `patchSession`. Confirm potions carry a parseable healing mod; if not, `Use` decrements qty only (current behavior).
10. **Map default-open heuristic** — open when `activeMapId` exists AND `initiative.entries.length > 0`; collapsed otherwise. Last manual toggle always wins.
11. **Damage button auto-brighten (8s) and per-row adv/dis chip** — carry-over playtest flags from pass 2.
12. **Slot auto-consume on Cast for attack-roll spells** — missing attack still costs slot (RAW).

---

## Files to touch (for code-architect annotation)

- `src/features/characterSheet/CharacterSheetSessionMode.jsx` — restructure: move HP to compact left-column block; add Recovery & Damage zone to left column; convert Map from sub-tab into collapsible right-column panel above sub-tab strip; reduce sub-tabs to COMBAT · LOADOUT · NOTES; wire Spend Hit Die + ability/weapon rolls into shared dice history.
- `src/features/characterSheet/characterSheet.css` — new `.cs-sm-hp-compact-*`; new `.cs-sm-recovery-*`; new `.cs-sm-map-panel-*`; remove `.cs-sm-hp-hero` weight; left-column sticky regions.
- `src/pages/CharacterModePage.jsx` — pass map state + `dnd_map_open_${slug}` into session mode; default-open heuristic.
- `src/components/CharacterSheet.jsx` — extend Loadout potion `Use` to apply healing; reuse `parseDiceExpr` / `rollDie` for Spend Hit Die.
- `src/components/DiceRoller.jsx` — confirm shared history accepts a "recovery" source row.
- `src/api.js` — no new endpoints required.
