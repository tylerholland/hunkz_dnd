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

## Interactive elements

### Buttons

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
```js
background: pal.surface, border: `1px solid ${pal.border}`,
borderRadius: 3, color: pal.text, fontFamily: pal.fontBody,
fontSize: 15–16, padding: "8–9px 12–13px", outline: "none", width: "100%"
```

### Labels (above inputs)
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

## Scrollbar

Thin, subtle, palette-neutral:
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 3px; }
```
