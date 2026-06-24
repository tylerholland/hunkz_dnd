# Design System

> This document captures the visual language of the app for use by `ux-designer` when creating prototypes.
> **Maintained by `feature-builder`** — update when palettes, fonts, or UI patterns change.
> Do not read `CharacterSheet.jsx` to infer styles — use this document instead.

---

## Fonts

All three fonts load from Google Fonts. They are always used consistently by role — never swap them.

| Role | Font | Used for |
|---|---|---|
| `fontDisplay` | Cinzel (wght 400, 500) | Headings, character names, section titles, stat labels |
| `fontBody` | Crimson Text (normal, semibold, italic) | Body text, descriptions, prose, notes |
| `fontUI` | IM Fell English (normal + italic) | Labels, UI chrome, uppercase metadata, buttons, tags |

**Import string:**
```css
@import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Cinzel:wght@400;500&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
```

**Typical sizes:**
- Section headings: 18–24px, Cinzel
- Body / item names: 15–16px, Crimson Text
- UI labels (uppercase, tracked): 11–12px, IM Fell English, `letterSpacing: "0.2–0.35em"`, `textTransform: "uppercase"`
- Secondary / muted metadata: 11–13px, IM Fell English, `letterSpacing: "0.12–0.15em"`
- Stat numbers / scores: 28–36px, Cinzel
- No text should be less than 12px font, unless a special exception is identified and approved. Including modifiers. Everything must be legible.

---

## Palette system

Each character has a named palette. All colors come from the palette object — never hardcode hex values in new UI. Reference palette properties as `pal.accent`, `pal.surface`, etc.

### Palette properties

| Property | Role |
|---|---|
| `bg` | Page background |
| `surface` | Card / panel background (semi-transparent) |
| `surfaceSolid` | Modal / overlay background (opaque) |
| `border` | Default border color (subtle) |
| `accent` | Primary accent — interactive elements, highlights |
| `accentBright` | Hover states, active links, emphasis |
| `accentDim` | Low-contrast accent — placeholder icons, disabled |
| `text` | Primary text |
| `textBody` | Body text (slightly muted) |
| `textMuted` | Labels, metadata, secondary info |
| `glow1` / `glow2` | Radial glow backgrounds (ambient mood) |
| `gem` | Stat circle fill, accent gem color |
| `gemLow` | Low-value or empty stat state |
| `fontDisplay` | Cinzel serif string |
| `fontBody` | Crimson Text string |
| `fontUI` | IM Fell English string |

### All palettes

```
ember      bg:#120d0a  accent:#a06840  accentBright:#c89060  text:#d4c4b0  textMuted:#6a4830  gem:#c8904c
ocean      bg:#0d0f14  accent:#6a8fa8  accentBright:#a0c0d0  text:#c8bfaf  textMuted:#3a5a6a  gem:#8ab4c8
forest     bg:#090e0b  accent:#5a8a60  accentBright:#88b888  text:#c0cdb8  textMuted:#3a5a3c  gem:#78b878
ash        bg:#0e0e0e  accent:#888888  accentBright:#b8b8b8  text:#d0ccc8  textMuted:#505050  gem:#a0a0a0
hearthstone bg:#110a08 accent:#a05040  accentBright:#cc8060  text:#d8c8b8  textMuted:#6a3828  gem:#cc8060
ironwood   bg:#0c0608  accent:#8a4450  accentBright:#b87080  text:#cec0bc  textMuted:#5a2e34  gem:#b87080
hoarfrost  bg:#090c12  accent:#8aaac8  accentBright:#c8dcea  text:#dce8f0  textMuted:#3a5068  gem:#c8dcea
nightwood  bg:#050d09  accent:#2e8a58  accentBright:#58c890  text:#b8d4c0  textMuted:#1e5034  gem:#58c890
pitch      bg:#060606  accent:#3a5048  accentBright:#607868  text:#c0c8c0  textMuted:#303c36  gem:#607868
vellum     bg:#f5f0e8  accent:#7a5c30  accentBright:#4a3418  text:#2a2018  textMuted:#9a8060  gem:#4a3418
```

Note: `vellum` is the only light-background palette — all others are dark. New UI must look correct on both.

---

## Layout & spacing

- **Page background**: `pal.bg`, `minHeight: 100vh`
- **Content max-width**: ~900px, `margin: "0 auto"`, `padding: "48px 32px 80px"`
- **Section divider**: `<HR>` component — `borderTop: 1px solid pal.border`, `margin: "22px 0"`
- **Card / panel**: `background: pal.surface`, `border: 1px solid pal.border`, `borderRadius: 4–6px`
- **Modal overlay**: `position:fixed, inset:0, background:rgba(0,0,0,0.75)`, content in `pal.surfaceSolid` panel, `maxWidth: 480–540px`
- **Two-column grid**: CSS class `.loadout-grid` — `grid-template-columns: 1fr 1fr; gap: 0 32px`, collapses to 1 column at `max-width: 560px`
- **Three-column grid**: CSS class `.character-details-grid` — `repeat(3, 1fr)`, collapses to 2 columns at `max-width: 600px`

---

## CSS class system

Styles are being migrated from inline JS objects to CSS classes. Use these classes rather than duplicating inline styles. Palette values are inherited via CSS custom properties (`--pal-*`) set at the component root — no prop drilling needed in CSS.

**CSS files:**
- `src/shared.css` — utility classes used across all components (imported in `main.jsx`)
- `src/features/characterSheet/characterSheet.css` — character sheet view-mode, edit-mode (`.em-*`), and ItemEditorModal (`.em-modal-*`) structural classes
- `src/features/dmDashboard/characterCard.css` — DM card component classes (`.cc-*`)
- `src/features/dmDashboard/dashboard.css` — DM dashboard layout classes

**Key shared utility classes (`shared.css`):**
- `.flex-row` — `display:flex; align-items:center`
- `.flex-row-spread` — flex row with `justify-content:space-between`
- `.flex-col` — flex column
- `.label-ui` — IM Fell English, 11px, uppercase, `0.22em` tracking, `var(--pal-text-muted)`
- `.input-base` — standard text input/textarea styling (surface bg, border, body font, 15px)
- `.btn-ghost` — transparent ghost button (border, textMuted, hover → accent)
- `.btn-primary` — accent-tinted primary action button
- `.btn-stepper` — 32px circle +/− stepper
- `.btn-pill` — pill tag/chip button with `.active` modifier
- `.modal-overlay` — full-viewport `position:fixed` dark backdrop (`z-index:200`)
- `.modal-panel` — content box inside overlay (`max-width:400px`)
- `.flyout` — absolute-positioned tooltip panel
- `.surface-panel` — surface-background section panel
- `.divider` — `1px solid var(--pal-border)` horizontal rule
- `.num-display-lg/md/sm` — Cinzel numeric display sizes

**Palette variable pattern:** Set `--pal-*` vars once at the component root element via `style={{}}`. All child CSS classes inherit them without any JS prop passing. Components that render outside a palette-aware parent (e.g. `ItemEditorModal`) set their own `--pal-*` vars on their root element.

---

## Interactive elements

### Buttons

Use CSS classes (see above). For reference, the equivalent inline values are:

Primary action button:
```js
background: "rgba(18,58,78,0.5)", border: `1px solid ${pal.accent}`,
borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI,
fontSize: 13–14, letterSpacing: "0.08em", padding: "8–9px 16–20px"
```

Secondary / ghost button:
```js
background: "transparent", border: `1px solid ${pal.border}`,
borderRadius: 3, color: pal.textMuted, fontFamily: pal.fontUI,
fontSize: 11–13, letterSpacing: "0.12–0.18em"
```

Destructive (remove/delete): same as ghost, color `#c06060` (not palette-derived — universal error red).

### Inputs and textareas

Use `.input-base` CSS class. Equivalent inline values:
```js
background: pal.surface, border: `1px solid ${pal.border}`,
borderRadius: 3, color: pal.text, fontFamily: pal.fontBody,
fontSize: 15–16, padding: "8–9px 12–13px", outline: "none", width: "100%"
```

### Labels (above inputs)

Use `.label-ui` CSS class. Equivalent inline values:
```js
fontFamily: pal.fontUI, fontSize: 11–12, letterSpacing: "0.2em",
textTransform: "uppercase", color: pal.textMuted, display: "block", marginBottom: 5
```

### Hover effects on cards/rows
- `borderColor` transitions to `pal.accent`
- `transform: translateY(-2px)` on card lift
- `transition: "border-color 0.18s, transform 0.12s"`

---

## Stat circles

Ability score circles:
- Outer ring: `border: 2px solid pal.border` (or accent on hover), `borderRadius: "50%"`, ~64–72px diameter
- Fill: `background: pal.surface`
- Score number: 28–36px, Cinzel, `color: pal.gem`
- Label below: 10–11px, IM Fell English, uppercase, `color: pal.textMuted`

Modifier badge (overlapping bottom-left of stat circle):
- ~26×26px circle, `position: absolute, bottom: -6, left: -8`
- `background`: colored per modifier sign (positive = gem, negative = warning tone)
- `border: 2px solid pal.surfaceSolid` (creates cutout effect against parent)
- Hidden when modifier is 0

---

## Typography conventions

- **Uppercase tracked labels**: IM Fell English, 11–12px, `letterSpacing: 0.2–0.35em`, `textTransform: uppercase` — used for section headers, metadata tags, field labels
- **Italic secondary text**: Crimson Text italic — used for nicknames, descriptions, flavor text; `opacity: 0.85` via `.phoenetic` class
- **Stat numbers**: Cinzel — always use for numeric values so they feel weighty
- **Error text**: `color: "#c06060"`, Crimson Text, 14px — universal across all palettes

---

## Page-level backgrounds

The character sheet has an ambient glow effect behind the content:
```js
background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%),
             radial-gradient(ellipse at 80% 100%, ${pal.glow2} 0%, transparent 55%),
             ${pal.bg}`
```
This gives depth without competing with content. Preserve it in full-page designs.

---

## Modifier flyout

Appears above the ability score circle on hover (desktop) or tap (mobile). Triggered by both the main circle and the modifier badge.

```
position: absolute
bottom: calc(100% + 6px)
left: 0
min-width: 160px
background: pal.surfaceSolid
border: 1px solid pal.border
borderRadius: 4px
padding: 10px 14px
pointerEvents: none
zIndex: 10
```

**Content structure** (top to bottom):
1. Stat name — 13px IM Fell English uppercase tracked, `pal.textMuted`
2. Raw score — 22px Cinzel, `pal.gem`
3. Thin divider (`borderTop: 1px solid pal.border`, `margin: 6px 0`)
4. "Score modifier" row — italic, 13px Crimson Text, `pal.textMuted`; value right-aligned
5. One row per item mod source — item name left, `+N` right; 13px Crimson Text, `pal.textBody`
6. Thin divider
7. "Total" row — 13px IM Fell English uppercase, `pal.accentBright`; value right-aligned, bold

Hidden entirely when total modifier is 0 (no badge, no flyout).

---

## Expandable item rows (weapons & equipment)

Each row in the Loadout tab follows this pattern:

**Collapsed state:**
```
display: flex, alignItems: center, gap: 10px
padding: 8px 0, borderBottom: 1px solid pal.border (last item: none)
```
- Drag handle (left): 12×18px SVG dot-grid, `pal.textMuted`, opacity 0.45
- Item name: 15px Crimson Text, `pal.text`
- Type tag (equipment only, if set): 11px IM Fell English uppercase, `pal.accent`, opacity 0.7, `letterSpacing: 0.12em`
- Mod chips: inline, see "Pill / chip / tag" section below
- Expand arrow (right): ▼ / ▲, 12px, `pal.textMuted`; tap to toggle

**Expanded state** (revealed below the row):
```
paddingLeft: 22px, paddingBottom: 12px
```
- Description: 14px Crimson Text italic, `pal.textBody`, line-height 1.6
- Mod chips repeated in a wrapped row

---

## Drag handle

Used on reorderable rows (weapon/equipment items, collection sections in edit mode):
```jsx
<svg width="12" height="18" viewBox="0 0 12 18" fill={pal.textMuted} opacity={0.45}>
  // 6 dots in a 2×3 grid at positions (4,3), (8,3), (4,9), (8,9), (4,15), (8,15)
  // each dot: <circle r="1.4" />
</svg>
```
Always `flexShrink: 0`, cursor `grab`.

---

## Pill / chip / tag

**Spell / ability tag** (view mode, Key Spells section):
```js
fontFamily: pal.fontUI, fontSize: 16, letterSpacing: "0.08em"
padding: "4px 13px"
border: `1px solid ${pal.border}`
borderRadius: 2
color: pal.accent
display: inline-block
```

**Modifier chip** (on weapon/equipment rows):
- Small pill showing attribute + value (e.g., "STR +2")
- 11px IM Fell English, `pal.textMuted`, border `pal.border`, borderRadius 2, padding `2px 7px`

**Active condition chip** (story 03, not yet built):
- Similar to modifier chip but uses `pal.accent` border and `pal.accentBright` text when active
- Ghost (dim) state when inactive: `pal.border` border, `pal.textMuted` text

---

## Tab buttons

The Loadout / Persona (formerly "In Play") tab strip:
```js
// Active tab
background: pal.accentDim, border: `1px solid ${pal.accent}`,
color: pal.accentBright, borderRadius: 3,
fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.18em",
textTransform: "uppercase", padding: "5px 16px"

// Inactive tab
background: "transparent", border: `1px solid ${pal.border}`,
color: pal.textMuted, // same other styles
```
Tab strip has `gap: 8px`, `marginBottom: 20px`.

---

## Collection / section navigation

Below the stats block, the character's backstory is organised into collections (e.g., "Character", "History") each containing named sections (e.g., "About", "Appearance").

**Collection label**: 10px IM Fell English uppercase, `letterSpacing: 0.28em`, `pal.textMuted`, `marginBottom: 6px`

**Section nav button** (same pattern as tab buttons above):
```js
// Active
background: pal.accentDim, border: `1px solid ${pal.accent}`, color: pal.accentBright
// Inactive
background: "transparent", border: `1px solid ${pal.border}`, color: pal.textMuted
```
Buttons wrap into multiple rows if many sections exist. `gap: 6px`.

**Section content area**:
- Section title: 14px IM Fell English uppercase, `letterSpacing: 0.2em`, `pal.accent`, `marginBottom: 16px`
- Prose content: 18px Crimson Text, `lineHeight: 1.9`, `textAlign: justify`, `pal.textBody`
- Paragraphs split by `\n\n`; inline `*text*` renders as `<em className="phoenetic">` (italic, `opacity: 0.85`)
- List content: `<ul>` with ◆ diamond bullets, 16px Crimson Text

---

## Section panel (surface block)

The stats block and other major content areas use a surface panel:
```js
background: pal.surface
border: `1px solid ${pal.border}`
borderRadius: 4
padding: "28px 30px"
marginBottom: 44
isolation: "isolate"  // for z-index stacking of flyouts
```

---

## Portrait treatment

Full-bleed portrait image:
```js
width: "calc(100% + 56px)"   // bleeds beyond 28px side padding
marginLeft: -28, marginRight: -28
marginBottom: 44
overflow: "hidden"
borderRadius: 4
```
- Image: `width: 100%, display: block`
- Tagline (beneath portrait, when set): 22px Crimson Text italic, `pal.accent`, `textAlign: center`, `lineHeight: 1.7`, `padding: "14px 28px 10px"`

---

## HP / Hit Dice display (mixed font sizes)

The HP / Hit Dice / Armor row uses intentionally mixed sizes for readability:
- HP number: 44px Cinzel, `pal.gem`
- Hit Dice: numeric parts 44px Cinzel, letter parts 22px Cinzel (e.g., "4" large + "d" small + "10" large + "+" small + "6" large)
- Armor total: `pal.accentBright`; speed label above in 13px IM Fell English, `pal.accent`
- Row: `display: flex, gap: 52px, justifyContent: center, flexWrap: wrap`
- Each stat: centered column, label below number in 11px IM Fell English uppercase `pal.textMuted`

---

## Death Saves Strip (DM dashboard party card)

A footer-band that mounts below the Notes strip when `hpCurrent === 0`. Colors are universal — not palette-derived — so the strip reads identically on all character palettes.

**Color tokens** (defined as CSS custom properties on `.ds-strip`):

| Token | Value | Use |
|---|---|---|
| Success | `#5a9a5a` | Filled success pip |
| Success rim | `rgba(90,154,90,0.4)` | Empty pip border |
| Failure | `#c06060` | Filled failure pip; FALLEN label |
| Failure rim | `rgba(192,96,96,0.35)` | Empty pip border |
| Failure glow | `rgba(192,96,96,0.55)` | Filled failure pip box-shadow |
| Strip wash | `rgba(192,96,96,0.07)` | Resting background |
| Strip wash (FALLEN) | `rgba(192,96,96,0.11)` | Tombstone background |
| Top border | `rgba(192,96,96,0.45)` | Resting |
| Top border (FALLEN) | `rgba(192,96,96,0.6)` | Tombstone |
| Label | `rgba(192,96,96,0.65)` | DEATH SAVES label |
| Damage label | `rgba(192,96,96,0.75)` | DAMAGE AT 0 label |
| Inner divider | `rgba(192,96,96,0.18)` | Between pip row and shortcut row |
| Vertical divider | `rgba(192,96,96,0.25)` | Between success / failure clusters |
| Chevron | `rgba(192,96,96,0.5)` | Disclosure ⌃/⌄ |
| FALLEN glyph | `#a04040` | ⨯ prefix in tombstone |
| No-Fail pill | `var(--pal-text-muted)` | Only palette-derived element |

**Key dimensions:**
- Strip resting: 40px height; expanded (shortcuts revealed): 89px
- Pip visible diameter: 12px; pip tap target: 36×40px; gap within cluster: 8px
- Chevron tap target: 44×40px
- Pill height: 32px visible / 44px tap target; padding: `8px 12px`; border-radius: 3px

**States:**
- **Resting**: pip row + chevron at right edge
- **Expanded**: pip row + 1px inner divider + 48px shortcut row (NAT 20, NAT 1 left-grouped; ✦ STABLE right-aligned)
- **Damage at 0**: pip row replaced by "+ DAMAGE AT 0" label + "+1 FAIL" / "CRIT +2" / "NO FAIL" pills (12s auto-resolve)
- **FALLEN**: tombstone row replacing pip row; no chevron; strip darker wash
- **Stable**: strip unmounts, card dims to 0.85 opacity

**CSS classes** (in `characterCard.css`): `.ds-strip-wrap`, `.ds-strip`, `.ds-pip-row`, `.ds-pip`, `.ds-pip-dot`, `.ds-cluster-divider`, `.ds-chevron-btn`, `.ds-damage-prompt`, `.ds-dmg-pill`, `.ds-inner-divider`, `.ds-shortcut-row`, `.ds-shortcut-pill`, `.ds-tombstone`, `.ds-fallen-label`, `.ds-frozen-cluster`

**New keyframes** (in `dashboard.css`): `dsStripExpand` (shortcut row reveal), `dsTombstoneIn` (tombstone cross-fade), `dsResolveGlow` (green glow pulse on NAT20/Stable/3rd success), `dmgPromptSlideIn` (damage prompt entrance).

---

## Session Mode Layout (`CharacterSheetSessionMode`)

Two-column layout for in-session play, defined in `characterSheet.css` under the `=== SESSION MODE LAYOUT ===` section.

**Two-column grid** (≥900px breakpoint):
```css
.cs-session-shell {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 0 20px;
}
.cs-session-left { position: sticky; top: 48px; height: calc(100vh - 48px); overflow-y: auto; }
.cs-session-right { /* scrolls independently */ }
```

**CSS class prefix convention**: `.cs-sm-` for session mode sub-components, `.cs-session-` for top-level layout containers, `.cs-mode-` for the mode toggle strip.

**Key class groups**:
- `.cs-session-root` — outermost div, sets `--pal-*` variables
- `.cs-session-topbar` / `.cs-mode-toggle` / `.cs-mode-seg` — top bar + mode pill toggle (Profile / Session)
- `.cs-mobile-mode-row` — sticky mode row on mobile (hidden at ≥900px)
- `.cs-sm-identity` / `.cs-sm-portrait` — identity strip + portrait circle in left column
- `.cs-sm-ability-grid` — 3×2 grid of ability mod chips
- `.cs-sm-init-*` — initiative strip (own entry, other entries)
- `.cs-sm-party-*` — party status strip
- `.cs-sm-hp-hero` — large HP card with optimistic updates
- `.cs-sm-conc-*` — concentration banner / input
- `.cs-sm-cond-*` — condition pills section
- `.cs-sm-slots-*` — spell slots display
- `.cs-sm-inspo-*` — inspiration toggle
- `.cs-sm-tabs` / `.cs-sm-tab` / `.cs-sm-tab-panel` — sub-tab strip and panels

**HP bar color utilities** (universal — not palette-derived):
- `.cs-sm-hp-bar-healthy` — green `#5a9a5a`
- `.cs-sm-hp-bar-wounded` — amber `#c8903c`
- `.cs-sm-hp-bar-critical` — red `#c06060`

**Static keyframes** (all in `characterSheet.css` — no runtime injection):
- `csPartyGlowPulse` — party member avatar ambient pulse
- `csOwnGlowPulse` — own avatar glow when on active turn
- `csDeathGlow` — death state slow red pulse
- `csRoundPulse` — round counter brighten on advance
- `csYourTurnSlide` — "Your Turn" label slide-in
- `csInitExpand` — initiative entry height expand
- `csModeIn` — mode page entrance fade
- `csToggleHint` — initial toggle hint bounce
- `csHpFlashDmg` / `csHpFlashHeal` — HP flash on damage/heal
- `csConcentrationPulse` — concentration banner pulse dot

**`@media (prefers-reduced-motion: reduce)`**: all animation/transition properties set to `none`/`0ms` to disable every animation in this component.

**Utility classes**: `.ds-strip.shake` (reuses `dmDeathSaveShake`), `.ds-strip.resolve-glow` (uses `dsResolveGlow`).

---

## Counter Wheels panel (`CounterWheelsPanel.jsx` + `counterWheels.css`)

Radial progress clock component, Tier 2 (ambient/peripheral). Below Map Panel, above party card strip.

**SVG wheel anatomy**:
- Full pie-slice annular sectors from center hub to rim (NOT thin arcs — maximizes tap target)
- Hub ring: 18% of outer radius (`hubR = rOuter * 0.18`); `fill: var(--pal-bg)`, `stroke: var(--pal-accent)` at `stroke-opacity: 0.3`
- Separator gaps: `<line>` elements at each sector boundary, `stroke="var(--pal-bg)"`, `strokeWidth={1.5}`, `strokeLinecap="butt"`; constant width from hub to rim (no angular gap in the path itself)
- Single-segment wheel: rendered as full annular ring with a notch `<line>` at 12 o'clock (2–3° gap)
- Fill math: `polar(cx, cy, r, angleDeg)` — 0° = 12 o'clock; `segPath(cx, cy, rOuter, rInner, startDeg, endDeg)` — annular arc path string

**Segment fill states**:
| State | Fill | Filter |
|---|---|---|
| Empty | `var(--pal-surface-solid)` | none |
| Filled | `url(#wfg-${id})` radialGradient | `drop-shadow(0 0 3px rgba(138,180,200,0.45))` |
| Completed (N/N) | `url(#wfg-gold-${id})` radialGradient | `drop-shadow(0 0 7px rgba(228,211,181,0.65))` |

**Gradient stops**:
- Normal fill: inner `var(--pal-accent-bright)` (0.15) → outer `var(--pal-accent)` (1.0); palette-aware via CSS custom props in SVG `stop-color`
- Completed gold: inner `#f2e8d2` (0.15) → outer `#c8ae84` (1.0); intentionally fixed warm gold

**CSS class prefix**: `.wheels-*` (panel chrome), `.wheel-*` (per-cell), `.wcf-*` (creation form)

**Key classes**:
- `.wheels-panel` / `.wheels-panel.expanded` — collapse state toggle
- `.wheels-body` — `max-height: 0` collapsed, `max-height: min(40vh, 360px)` expanded with `overflow-y: auto`
- `.wheels-grid` — `repeat(auto-fill, minmax(96px, 1fr))` desktop; `minmax(110px, 1fr)` mobile (≤900px)
- `.wheel-cell` — flex column, `animation: wheelCellIn 0.2s ease-out` on mount
- `.wheel-cell.full` — triggers `wheelCompletePulseScale` on `.wheel-svg-wrap`, `wheelCompletePulse` on `svg`
- `.wheel-cell.removing` — `animation: wheelCellOut 0.14s ease-out forwards`
- `.wheel-menu-trigger` — absolute top-right, `opacity: 0` at rest, `opacity: 1` on parent hover or `.menu-open`; `opacity: 0.5` persistent on touch (`hover: none`)
- `.wheel-menu-popover` — `display: none` → `display: block` via `.wheel-cell.menu-open`; `.flip-up` variant

**Keyframes** (all in `counterWheels.css`):
- `wheelCellIn` — `opacity 0 → 1, scale 0.7 → 1`, 200ms ease-out
- `wheelCellOut` — `opacity 1 → 0, scale 1 → 0.8`, 140ms ease-out
- `wheelCompletePulse` — filter drop-shadow: `3px → 14px → 7px`, 420ms ease-in-out (on SVG element)
- `wheelCompletePulseScale` — `scale 1 → 1.05 → 1`, 420ms ease-in-out (on wrapper, separate from SVG)
- `wheelBadgeIn` — `opacity 0, translateX(-6px) → 1, 0`, 150ms ease-out
- `wheelFormIn` — `opacity 0 → 1`, 180ms ease-out
- `wheelSegFillIn` — `scale 0.92 → 1`, 160ms ease-out (CSS class `.fill-anim` added reactively)

**sessionStorage key**: `dnd_wheels_open` — `"true"` | `"false"` | absent (use mode-aware default)

**Roll history entry** (`type: "wheel"`):
```js
{ id, type: "wheel", name, segments, createdAt }
```
Rendered by `RollHistoryRow` as: `◷` (in `pal.accent`) + italic name (in `pal.text`) + `— N segments` (in `pal.textMuted`). No numeric total. No dice badge.

---

## Scrollbar

Thin, subtle, palette-neutral:
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 3px; }
```
