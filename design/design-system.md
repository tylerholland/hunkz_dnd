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

**Spell / ability tag** — the stats-panel "Spells" badge row uses the shared `InfoBadge` component (`CharacterTalents.jsx`), not a bespoke tag; see `app-overview.md`'s Skills/Spells/Special Abilities section for current behavior. The old freeform "Key Spells & Abilities" comma input this bullet originally described was replaced by the structured spell editor in Story 56 (see below).

**Modifier chip** (on weapon/equipment rows):
- Small pill showing attribute + value (e.g., "STR +2")
- 11px IM Fell English, `pal.textMuted`, border `pal.border`, borderRadius 2, padding `2px 7px`

**Active condition chip** (story 03, not yet built):
- Similar to modifier chip but uses `pal.accent` border and `pal.accentBright` text when active
- Ghost (dim) state when inactive: `pal.border` border, `pal.textMuted` text

---

## Spell role glyph & role drawer (Story 56)

**Glyph vocabulary** — one meaning per glyph, reused identically on all three
surfaces that show spells (Persona badge row, session-mode Spells reference
row, Combat tab / session-mode Combat sub-tab merged attacks list):
- `✶` (U+2736) — spell `role: "attack"` — color `var(--pal-gem)` / `pal.gem`
- `✚` (U+271A) — spell `role: "heal"` — universal `#5a9a5a` (not palette-derived, same "universal" treatment as death-save colors)
- No glyph at all — `role` unset (including every legacy bare-string spell). There is **no visual "unset" state** — absence of the glyph *is* the unset state.

CSS class `.cs-spell-glyph` (`characterSheet.css`) — 14px fixed-width inline
span, explicit `font-size: 12px` (never left to inherit) so the system-font
fallback for these two characters doesn't shift row height; `.heal` modifier
swaps the color. The gutter this glyph occupies is conditional by
construction, not by a CSS visibility rule: it only ever appears inside a
spell row, and spell rows only render at all when the list has spells with a
role set — so a non-caster's weapon rows are byte-for-byte unaffected.

**Role selector** — first real consumer of the `.btn-pill` utility class
(`shared.css`, previously defined but unused). Three pills, always in this
order and always all three present: `—` (clears the role key entirely) /
`✶ Attack` / `✚ Heal`. Selected pill gets `.active`. Lives inside an inline
drawer on the edit-mode spell row (see `CharacterSheetEditMode.jsx`), not a
modal — a spell has only a handful of editable properties beyond its name,
and staying out of a modal reinforces that spells are not inventory items.
The drawer is **closed by default per row**; opening one row's edit drawer
does not affect others.

**Bulk comma-add entrance** — `.cs-spell-row-enter` keyframe (140ms
ease-out, `opacity`+`translateY(-4px)→0`), staggered 40ms per row and capped
at index 5 (6 rows) regardless of how many were added in one commit; wrapped
in `@media (prefers-reduced-motion: reduce)` to disable entirely. Reuse this
pattern for any future "several rows appear from one commit" UI rather than
inventing a new stagger constant.

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

---

## NPC Library UI patterns (Story 31)

### EnemiesGalleryModal

**File**: `src/features/dmDashboard/EnemiesGalleryModal.jsx`  
**CSS**: `src/features/dmDashboard/enemiesGallery.css` (class prefix: `eg-`)

**Layout**: Fixed-position full-screen overlay (`z-index: 1200`). Panel is centered, `max-width: 860px`, `max-height: 90vh`, scale+fade entrance animation (200ms). Two-pane layout:
- **List rail** (220px): MRU-sorted template list, search input (> 20 entries), `+ New` button, `⧉ Duplicate`, two-step delete confirm (6s auto-dismiss)
- **Entry editor** (flex: 1): portrait upload zone (64px circle; presign→S3 PUT→URL), name input (`.eg-name-input`), HP number input, `AbilitiesListEditor`

**Mobile** (≤720px): single-pane drill-in — list visible by default, `isMobileDrilled` state hides list and shows editor with `← Back`. Controlled via `.eg-modal-panel[data-mobile-drilled]`.

**Key CSS classes**:
- `.eg-modal-overlay` — full-screen backdrop (`rgba(0,0,0,0.72)`)
- `.eg-modal-panel` — centered panel, scale+fade in/out
- `.eg-list-rail` / `.eg-list-entry` / `.eg-list-entry[data-selected]` — list pane
- `.eg-editor-pane` — right pane
- `.eg-portrait-zone` — 64px upload circle with `◆` icon when empty
- `.eg-name-input` / `.eg-hp-input` — text/number inputs
- `.eg-save-btn` / `.eg-close-btn` — primary action buttons
- `.eg-dirty-guard` — inline dirty-close confirmation
- `.eg-saved-flash` — `✓ Saved` flash overlay

**Dirty guard**: if unsaved changes exist (`isDirty`), `onClose` renders an inline `showDirtyGuard` confirm panel instead of closing immediately.

### NPC card overflow menu

**`NpcThumb`** helper (in `NpcCombatSection.jsx`): circular portrait/initials avatar. Props: `{ portraitUrl, name, size, npcPal }`. Falls back to first letter of name in a colored circle when no portrait. Handles `img` error (falls back to initials on broken URL).

**`NpcOverflowMenu`** (in `NpcCombatSection.jsx`): popover menu anchored to `⋯` button. Opens with CSS transition (opacity + translateY). CSS classes in `npcCombat.css`:
- `.btn-npc-overflow` — the ⋯ trigger button (28px min, hover: `--npc-bright` + `--npc-chip-bg`)
- `.npc-overflow-wrap` — relative wrapper for position context
- `.npc-overflow-popover` — hidden popover (opacity 0, translateY −6px)
- `.npc-overflow-popover.npc-overflow-popover-open` — visible (opacity 1, translateY 0)
- `.npc-overflow-item` — action button rows (hover: `--npc-chip-bg` background)
- `.npc-overflow-item-destructive` — red destructive variant (`#c06060`)
- `.npc-overflow-item-muted` — non-interactive info row

### Library picker (inside Add Enemy form)

Inline expandable panel below the Add Enemy form. Toggle via `◆ From library` / `Hide library` button. Panel sections: optional search input (>20 entries), scrollable row list, `⚙ Enemies Gallery` footer link. No new CSS classes — all inline styles using `npcPal.*` values.

### NPC library data model

```js
// Sentinel item slug: "npc-library"
{
  templates: [{
    id: string,           // "tpl-{timestamp}{random}"
    name: string,
    abilities: string[],  // 255 char cap per entry
    hpMax: number | null,
    portraitUrl: string | null,  // S3 URL at npc-portraits/{uuid}.{ext}
    updatedAt: string,    // ISO timestamp; used for MRU sort
  }]
}
```

### NPC combat object additions (Story 31)

Spawned NPCs now carry optional provenance fields written at spawn time:
- `portraitUrl?: string` — S3 URL from library template; shown in card header via `NpcThumb`
- `librarySourceId?: string` — `template.id` from library; used by `NpcOverflowMenu` for conflict detection (check `t.id === npc.librarySourceId` before falling back to name match)

These fields pass through `normalizeNpcCombatRecord` transparently (`...npc` spread).

---

## Shared TopNav component (Story 37)

`src/components/TopNav.jsx` + `src/components/topNav.css`

Adopted on all six pages: CharactersListPage, CharacterSheetViewMode, CharacterSheetSessionMode, DmDashboardPage, MapLibraryPage, MapViewerPage.

### Layout

52px sticky bar (`position: sticky; top: 0; z-index: 200`). Three slots:

| Slot | Contents |
|---|---|
| Left (`.topnav-left`) | `‹` back glyph (`<Link>`) + title span (Cinzel, 15px, small-caps, `--pal-accent-bright`) |
| Center (`.topnav-center`) | Optional `center` prop (NavSegment); hidden at `<560px`, shown in `.topnav-mobile-row` below the bar instead |
| Right (`.topnav-right`) | `children` (page-specific action buttons) + Live dot + book icon + ⋯ NavMenu |

Background: `rgba(13,15,20,0.95)` + `backdrop-filter: blur(8px)`. Border-bottom: `1px solid var(--pal-border)`.

### NavSegment

Segmented control pill. Visual height 32px; touch target 44px via `::before` pseudo-element (no `overflow:hidden` on wrapper). Active segment: `var(--pal-accent-bright)` text + `var(--pal-accent-dim)` background + `var(--pal-accent)` border. CSS class: `.topnav-segment` / `.topnav-seg-btn` / `.topnav-seg-btn--active`.

Props: `options: [{key, label}]`, `value: string`, `onChange: (key) => void`

### NavMenu

`⋯` trigger button (28×28px tap target expanded to 44px via `::before`). Popover anchored top-right, `min-width: 200px`, fade+translate-Y animation. Items:

```js
{ label: string, onClick?: fn, href?: string, destructive?: boolean }
| { divider: true }
```

`href` items render as React Router `<Link>`. `destructive` items: `var(--pal-gem-low)` / red text color. Dividers: `1px solid var(--pal-border)`. Closes on outside `mousedown` or `Escape`.

### TopNav props

| Prop | Type | Description |
|---|---|---|
| `backTo` | string\|null | URL for `‹` glyph; omit to hide |
| `title` | string | Page title in Cinzel small-caps |
| `center` | ReactNode | Center slot content (typically `<NavSegment>`) |
| `menuItems` | Array | Items for ⋯ NavMenu |
| `showLive` | boolean | Show Live/Polling dot |
| `wsConnected` | boolean | True = Live (green pulse), false = Polling |
| `onBookClick` | function | Called on book icon click (World Guide) |
| `bookOpen` | boolean | Whether World Guide drawer is open |
| `children` | ReactNode | Right-slot action buttons (e.g. Upload) |

### `.topnav-action-btn`

Defined in `topNav.css`. Use for page-specific action buttons placed as `children` of `<TopNav>` (e.g. Upload on MapLibraryPage). Equivalent appearance to `.cs-toolbar-btn` in `characterSheet.css` — transparent background, `var(--pal-border)` border, uppercase IM Fell English 10px.

### CSS variable requirements

TopNav uses `--pal-*` and `--font-*` variables. All pages that adopt TopNav must set `--pal-*` on their root element. Use the `palVars` spread pattern (see DmDashboardPage.jsx, MapLibraryPage.jsx).

## Token effects cluster — damage flash, condition badges, invisible veil, attack tracer (Stories 52–55)

New visual vocabulary on the battle-mode token layer (`TokenChip` in `BattleModeController.jsx`), CSS in `src/features/dmDashboard/battleMode.css`. These colours are **universal, not palette-derived** — the same rule as HP-bar tiers and death-save pips — because they need to read identically regardless of which of the 8 character palettes a given token belongs to.

### DOM structure note

Position (`--token-x`/`-y`) now lives on a new **outer** wrapper, `.tk-lunge` (Story 55, ADR-021) — `.token-pos` → `.tk-lunge` → `.token-chip` → `.tk-hit`. Before Story 55, `.token-chip` carried position directly on its own `transform` alongside the counter-rotation and both size multipliers, with no separate position wrapper; Story 55's melee lunge needs its translate() expressed in map-frame space (outside `.token-chip`'s counter-rotation, or it points the wrong way on a rotated map), which is what forced the split. `.tk-hit` remains an **inner** child of `.token-chip` (Story 52) wrapping the portrait/ring/badge/effect layers with its own independent recoil/vanish transform — unrelated to why the lunge specifically needs to be outside; the whole visible chip still recoils/vanishes together without ever touching `.token-chip`'s own transform (fully claimed by counter-rotation and the two size multipliers).

### Colour tokens

| Token | Value | Used by |
|---|---|---|
| `--tk-dmg-hot` | `#e06060` | Shockwave, Phase A wash, reduced-motion static rim |
| `--tk-dmg-rest` | `#c06060` | Wound halo border — same red as HP-bar critical, death-save fail pip, error text |
| `--tk-dmg-glow` | `rgba(192,96,96,0.45)` | Wound halo's outer glow — the channel that survives at tiny token sizes |
| `--fam-control` | `#b05878` | Condition badge family: Incapacitating (loses/forfeits turn) |
| `--fam-bind` | `#c8903c` | Condition badge family: Positional (can't move freely) — reuses the app's wounded-amber |
| `--fam-sense` | `#8a7cc8` | Condition badge family: Sense/will (perception/will compromised) |
| `--fam-physical` | `#8fae3c` | Condition badge family: Attrition (ongoing) — deliberately yellower than healthy-HP green |
| `--fam-unknown` | `#c8c0b4` | Neutral fallback for an unrecognised condition string |
| `--tk-veil-desat` / `--tk-veil-dim` | `0.35` / `0.55` | Invisible-veil portrait grayscale/opacity |
| `--tk-dm-secret` | `#7c93a8` | **App-wide "information only the DM can see" colour** — cold blue-grey adjacent to the DM dashboard's Ocean accent. Reciprocal rule: must never appear on a player-visible surface. |
| `--tk-dm-secret-scrim` | `rgba(124,147,168,0.22)` | Diagonal hatch texture on a DM-secret invisible NPC token |
| `--tk-atk-core` | `#dce8f0` | Story 55 — cold-steel white: the Bolt's core stroke and the impact crescent on every tracer kind (chosen to be distinguishable from the gold already claimed by crits and completed counter wheels) |
| `--tk-atk-shade` | `rgba(0,0,0,0.45)` | Story 55 — the Bolt's underlying dark shade stroke, drawn beneath the tinted glow and white core for contrast on light terrain |

### Damage flash (Story 52)

Two phases: **Phase A — IMPACT** (~300–450ms, tiered Standard/Heavy) is a shockwave ring + edge-weighted red portrait wash + a compress-then-rebound recoil (`scale 1→0.92→1.045→1`, deliberately the *inverse* of the existing drop-bounce so the two events never read as the same thing); **Phase B — WOUND** is a 1.5px `--tk-dmg-rest` halo ring outside the token's black outline, breathing 0.5↔0.85 opacity over 2.6s, that persists until the entity's next initiative turn (or a fixed 12s window with no active combat). Phase A never plays on a token's first paint (freshness/mount gate) and is suppressed on a FALLEN token (Phase A still fires — death saves are still real damage — but the halo is suppressed, a corpse being "recently hurt" isn't actionable). Reduced motion: Phase A becomes one static hot rim held ~900ms, then settles into the ordinary halo.

### Condition badges (Story 53)

A left-edge column of up to 3 badges (15px dark plate + 2px family-coloured ring + filled glyph), top-anchored so slot 1 never moves and reading order top→bottom is priority order. A 4th+ condition collapses the bottom badge into a stacked-plate "more behind this" motif rather than a `+N` numeral. Counter-scaled against the per-token `--token-size-mult` only (constant physical size on a Tiny familiar and a Gargantuan dragon) — **not** counter-scaled against map zoom/calibration, which should make badges bigger/smaller along with the rest of the board. Tier 2 — ambient, ice-cold register: no resting animation of any kind, `pointer-events: none`, not interactive. Exhaustion folds in as a six-segment radial gauge badge (not a numeral, illegible at this size) when `exhaustionLevel ≥ 1`, promoted to the Control family/colour at level ≥4. `Invisible` is never a badge — it's Story 54's own whole-token treatment.

### Invisible veil (Story 54)

Three render states, not two — it's viewer × subject, not just PC × NPC:

| | Player viewer | DM viewer |
|---|---|---|
| PC invisible | VEILED | VEILED — identical |
| NPC invisible | **ABSENT** (not in the DOM, not in the response payload) | **SECRET** = VEILED + hatch scrim + `◇` marker |

VEILED = portrait `grayscale(0.35)` + `opacity(0.55)` (portrait layer only, never `.token-chip` itself — that would drag the condition badges and the drag-affordance ring down with it) + the faction ring going dashed (16 dashes, shape-based so it reads on any palette/terrain/colour-blindness with no legend) + a slow 3.2s shimmer + an italic name label. SECRET adds a diagonal hatch scrim and a bare filled `◇` rhombus at 12 o'clock in `--tk-dm-secret`, in its own reserved slot so it's never mistaken for a Story 53 condition badge. A veiled PC never gets the `◇` — that mark specifically means "your players can't see this," which would be false for a PC. An NPC going invisible on the player's map fades out over 500ms with a slight upward drift rather than popping — players legitimately watched it turn invisible, and a hard cut would read as "it's still there and something's hiding it."

### Attack tracer (Story 55)

Bolt-only for v1 — Channel (a distinct spell-glow treatment) was scoped out entirely pending Story 57's spell-role data, not built or stubbed. Two visuals, gated by token distance in natural-image pixels (`U = 36 × map.tokenScale`; `gap ≤ 1.0U → Strike, else Bolt` — a single named constant in `tokenEffects.js`, tunable after a live session):

- **Strike (melee).** Nothing travels. A 6% attacker lunge toward the target and back (140ms out / 180ms back) on the new `.tk-lunge` wrapper (see DOM structure note above — this is the one element in the whole cluster that must live *outside* `.token-chip`'s counter-rotation), plus three small chevrons (`⟩⟩⟩`) stepping outward from the attacker's rim along the attacker→target bearing, staggered 55ms apart. Both the lunge and the chevrons are drawn in `--tk-atk-core` (cold steel) — gold was already claimed by crits and completed counter wheels.
- **Bolt (ranged weapon or spell — same visual for both in v1).** A ~3px tapered streak on a new `TracerLayer.jsx` (mounted first inside `tokenLayerChildren`, explicit `z-index: 4` below `.token-chip`'s `10`), rim-to-rim with a gentle quadratic sag (`min(0.10 × dist, 2.5U)`), duration scaling 220–420ms by distance. Three stacked strokes — a `--tk-atk-shade` underlay, a glow tinted to the attacker's own faction ring colour (PC palette accent, or neutral `#c0c8c0` for NPCs), and a `--tk-atk-core` white core — so two different casters' bolts read as distinguishable at a glance without a label.
- Both terminate in the same **impact crescent**: a short `--tk-atk-core` arc on the target's rim, oriented on the attacker→target bearing (rendered on the side facing the attacker), 120ms scale-and-fade, inside `.token-chip`'s existing counter-rotation (upright for free, same trick as the badges).
- **Choreography with Story 52 (brief §8 Rule 3):** the crescent lands at t=0, Story 52's damage shockwave follows at t=+60ms (capped 480ms total) — this amends Story 52's previously-fixed 60ms delay into a supplied parameter (`resolvePhaseADelayMs()` in `tokenEffects.js`), owned by one module so the DM and player maps can't drift apart. Firing both at t=0 simultaneously would read as a rendering glitch, not a hit.
- **Rotation correctness is the story's single biggest implementation trap.** The chevrons and the impact crescent live *inside* `.token-chip`'s counter-rotation and add `--map-rotation` back via CSS `calc()` so their screen-space bearing is correct at any map orientation; the lunge lives *outside* it on `.tk-lunge` and needs the RAW (uncorrected) map-frame bearing for the same reason, in the opposite direction. Getting either one backwards is invisible on an unrotated map and only shows up at 90°/180°/270° — test all four.
- **Visibility governed entirely by the existing token-visibility rule (§ above):** if either endpoint is an ABSENT token for a viewer, that viewer sees no tracer at all — not a tracer to empty space, not a half-tracer. Enforced server-side (`lastDamageFrom` stripped whenever the attacker is invisible or linked to a hidden initiative entry) and client-side for free (the tracer geometry function only resolves attacker/target against tokens the current viewer's map actually has).
- Reduced motion: the lunge and chevrons are suppressed outright (pure CSS); the impact crescent holds statically for 300ms instead of animating (a JS-driven state, mirroring Story 52's `tk-rm-flash` pattern); the Bolt substitutes a static rim-to-rim path held ~260ms at 0.75 opacity instead of the draw animation (`TracerLayer.jsx` detects `prefers-reduced-motion` directly and sets the SVG dash offset without a transition).

## Attack Declaration Bar & target reticle (Story 57)

New player-facing surface on the session-mode Map sub-tab: `AttackDeclarationBar.jsx` (new component, `.cs-atk-*` in `characterSheet.css`) plus a new gesture/reticle on `TokenChip` (`.tk-target-*` in `battleMode.css`). Unlike the Stories 52–55 token-effects colour tokens above, the reticle is deliberately **palette-tinted, not universal** — a declared target is private intent (only the declaring player sees it), so it uses the viewer's own `--pal-accent-bright` rather than a shared app-wide colour.

### The gesture (`TokenChip`, NPC tokens only, player view only)

Reuses the DM's existing long-press pattern's mechanism (a `stroke-dashoffset` CSS transition whose duration equals the hold threshold is a 1:1 progress meter, zero JS animation loop) under new, independently-named constants — `TARGET_HOLD_MS = 500` (not `LONG_PRESS_MS = 480`, the DM's own gesture threshold two functions away; the two are allowed to drift, not silently coupled) and `TARGET_MOVE_CANCEL_PX = 8`. The 8px threshold is a **cancel condition on the chip's own pointer timer**, not a routing decision — `TokenChip` uses Pointer events and `MapViewer`'s pan uses a separate Mouse/Touch event family; both already fire independently on a press, so there is nothing to hand off to and no `panSuppressedRef` involvement (that flag is drag-only, Story 34).

- **Tap** (<500ms, <8px) — toggles the detail card open/closed, firing immediately on release (no extra delay beyond the 500ms hold-threshold check below). **Amended 2026-08-11**: originally shipped as a no-op (the card opened on hover instead, per Architect Risk #1 option (a)); that hover trigger conflicted with the reticle (see "Fix: tap-to-expand" below), so tap was given this job instead of staying a no-op.
- **Hold** (≥500ms, <8px) — declares/un-declares the target, committing **mid-press** at the instant the threshold crosses, not on release.
- While targeting is armed (`canTarget`), hover no longer opens the detail card at all (see "Fix: tap-to-expand" below) — there is nothing left for a charging-suppression guard to suppress, so the one-line `resizeActive`-precedent guard that used to live here was removed as dead code rather than kept alongside the new tap-toggle.

#### Fix: tap-to-expand replaces hover-to-expand while armed (2026-08-11)

The detail card originally opened on **hover** for every token, NPC included, regardless of `canTarget`. That collided with the reticle: `.tk-target-ring` has no hover-driven size rule, so while the mouse rested on an armed NPC token and the portrait hover-grew (`.token-chip[data-expanded="true"] .token-chip__portrait`), the reticle stayed sized/positioned for the resting portrait until `mouseleave` — a visible desync, and worse, entirely incidental (the mouse can rest on a token for any reason, with no relationship to the player's actual intent to target or inspect it).

Fix, scoped to **NPC tokens on the player's map only** (PC tokens and the DM's own map view are untouched — both hover exactly as before):

- **`canTarget` true (armed)**: hover is fully retired for this token — `handleMouseEnter`/`handleMouseLeave` both no-op. Tap toggles the card instead (see above). Mouse-leaving the token after a tap-opened card does **not** auto-close it — only another tap does, matching the toggle-on-repeat-press convention already used for hold-to-target itself.
- **`canTarget` false (disarmed — no battle mode, or no rollable attack)**: unchanged from before this fix — hover still opens the card after the existing 120ms delay, tap remains a no-op. There is no reticle possible in this state (targeting can't be armed), so there's nothing for hover to desync against.

No CSS changed — the fix is entirely the interaction trigger, not the card's geometry or the reticle's.

### Charge sweep

`.tk-target-charge-ring` — same geometry/mechanism as `.token-longpress-ring` (r=19, `stroke-dasharray: 119.4`), a fresh `stroke-dashoffset` CSS `animation` from 119.4→0 over the 500ms hold window, in `--pal-accent-bright` with a black under-stroke for contrast on any palette/terrain. Reduced motion: a static dot at 12 o'clock (`.tk-target-charge-dot`) instead of the sweep — the 500ms hold itself is unchanged, only the animated feedback is removed.

### The reticle

`.tk-target-ring` — a dasharray-gapped circle (same technique as `.tk-veil-ring` above: one `<circle>`, `stroke-dasharray` creating four equal arcs with equal gaps, rather than four hand-authored path elements), sitting further out than the charge ring/veil ring so the three never collide. Black under-stroke circle beneath the palette-tinted stroke circle for legibility. Lives **inside** `.token-chip` (not `.tk-lunge`/`.tk-hit`) so it inherits Story 45's counter-rotation for free — upright at any map rotation, no correction code. 200ms scale-in on mount, then a slow 2.4s opacity breathe at rest ("this declaration is still live" — ambient, readable without looking); reduced motion drops both to an instant, static full-opacity ring.

### Attack Declaration Bar

Fixed to the bottom of the session-mode viewport (`.cs-atk-bar`, `position: fixed`, `z-index: 150` — above the sticky topbar's `110`, below the roll overlay's `200`), present only while a declaration is live, `translateY` slide-in on mount. Four `data-state` values drive the same bar shell: `pick` (target + horizontally-scrolling attack-chip picker, `scrollbar-width: none`), `armed` (chosen chip + `ATTACK`), `result-atk` (total + `⚔ DAMAGE` / `↺ AGAIN`), `result-dmg` (total + `↺ AGAIN`). A fifth state, `gone`, overrides the others when the declared target has been absent from two consecutive polls — the target name strikes through and turns `--tk-dmg-rest`, gains a `— GONE` tag, holds 1400ms, then the whole bar exits (never silent).

- Attack chips (`.cs-atk-chip`) follow Story 56's exact weapons-then-`✶`-spells order and glyph vocabulary — no re-sort, no new glyph. A spent spell slot chip (`data-state="spent"`) shows a muted `SLOTS 0` tag and shake-refuses (3-cycle ±3px, 90ms) on tap rather than being hidden or erroring.
- The chosen chip (`.cs-atk-chosen-chip`) shows the loaded roll expression (e.g. `1d20+7`), tap-to-edit into a single-line input validated with the dice roller's own `parseDiceExpr` — an invalid expression shows inline error text and doesn't arm. A compact three-segment Adv/Dis strip (`.cs-atk-adv-strip`) appears only while the next roll is a to-hit step, driving the exact same `advMode` state the roller's own panel strip shows (mirrored via a `onAdvModeChange` callback so the bar's UI re-renders when it changes elsewhere) — never a second, potentially-disagreeing copy.
- Size ladder (two breakpoints, `max-width: 560px` wraps to a two-row 72px bar; `max-width: 380px` drops the to-hit value from picker chips and the dice-array text from the result readout) — the Roll button, target name, and result total never truncate at any step.

### Roll overlay

`RollOverlay.jsx` (new, `.cs-roll-overlay` in `characterSheet.css`) — a centred full-viewport number reveal, `z-index: 200`, translucent scrim (not a full modal — "a moment, not a blocking dialog"). Reuses the dice roller's cycling-number *mechanic* (an interval swapping a random face value, settling on the real total) at `25vh` scale rather than the panel's small numeral; crit/fumble reuse the roller's existing gold-pulse/red-shake keyframes verbatim (`dr-crit-pulse`/`dr-fumble-shake`, already loaded globally via `DiceRoller.jsx`'s own stylesheet import — not redefined). Auto-dismisses ~400ms after the result lands, or on tap-anywhere. Attack-Bar-only — the roller's own panel (weapon quick-roll buttons, Free Roll, ability checks) is completely unaffected; this is a new surface, not a change to the existing one.
