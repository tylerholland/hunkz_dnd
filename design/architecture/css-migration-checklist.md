# CSS Migration Checklist
> Incremental refactor: inline React styles → CSS classes + CSS custom properties
> Do these alongside feature work — no big-bang required.

## Foundation (done ✓)
- [x] `src/index.css` — absorbed GLOBAL_CSS; global reset, grid utilities, `.phoenetic`, scrollbar, spinner
- [x] `src/shared.css` — CSS variable schema (`--pal-*`), 10 shared utility classes
- [x] `src/features/dmDashboard/dashboard.css` — extracted from DASHBOARD_CSS string
- [x] `dashboardShared.js` — `useDashboardStyles()` is now a no-op; CSS is a static import
- [x] `theme.jsx` — `useCharacterSheetGlobalStyles()` is now a no-op; CSS is in index.css
- [x] `src/main.jsx` — imports `shared.css`

---

## Per-file migration

For each file below, the pattern is the same:
1. Set `--pal-*` CSS variables at the component root element (one `style={{}}` object, replace the rest)
2. Replace repeated static inline style objects with the matching utility class from `shared.css`
3. Move any static structural styles (padding, display, flex) to a per-component `.css` file
4. Replace `onMouseEnter`/`onMouseLeave` hover handlers with CSS `:hover` rules
5. Keep `style={{}}` only for truly dynamic values (hp bar width, computed colors, toggle positions)

---

### 1. `CharacterSheetViewMode.jsx` — 359 inline styles → ~50 (~85% reduction)
**Highest value. Do this first — proves the pattern and yields most shared classes.**

- [ ] Set `--pal-*` vars on the root wrapper (already has `rootWrap` — extend it)
- [ ] Replace all `fontFamily: pal.fontUI` occurrences with `.label-ui` or `font-family: var(--font-ui)`
- [ ] Replace all `fontFamily: pal.fontDisplay` occurrences with `font-family: var(--font-display)`
- [ ] Replace modal overlay divs with `.modal-overlay` + `.modal-panel`
- [ ] Replace flyout tooltip divs with `.flyout`
- [ ] Replace `display:"flex", alignItems:"center"` with `.flex-row`
- [ ] Replace `borderTop: \`1px solid ${pal.border}\`` with `.divider`
- [ ] Replace 59 `onMouseEnter`/`onMouseLeave` hover handlers with CSS `:hover` on extracted classes
- [ ] Create `src/features/characterSheet/characterSheet.css` for component-specific structural rules
- [ ] Keep dynamic: hp bar width, score-based color thresholds, active/selected state colors, toggle positions

---

### 2. `CharacterCard.jsx` (DM dashboard) — 188 inline styles → ~28
**Validates that per-card palette variable scoping works with `getPartyCardPalette()` remixing.**

- [ ] Set `--pal-*` vars on the card root element (each card sets its own variables — CSS inheritance handles the rest)
- [ ] Set `--turn-color` / `--turn-glow` on active-turn card root (already used by `.dm-active-turn` keyframe)
- [ ] Replace label patterns with `.label-ui`
- [ ] Replace HP stepper buttons with `.btn-stepper`
- [ ] Replace ghost action buttons with `.btn-ghost`
- [ ] Replace condition chips with `.btn-pill` + `.active`
- [ ] Replace `display:"flex", alignItems:"center"` with `.flex-row`
- [ ] Replace dividers with `.divider`
- [ ] Keep dynamic: hp bar widths, ghost trail positions, condition chip colors (use `--pill-color` inline)

---

### 3. `CharacterSheetEditMode.jsx` — 166 inline styles → ~22
**Most classes will already exist from ViewMode migration.**

- [ ] Set `--pal-*` vars at edit mode root (shares `rootWrap` from CharacterSheet.jsx context)
- [ ] Replace input elements with `.input-base`
- [ ] Replace section headers with `.label-ui`
- [ ] Replace save/cancel buttons with `.btn-primary` / `.btn-ghost`
- [ ] Replace modal overlay/panel with `.modal-overlay` / `.modal-panel`
- [ ] Replace `display:"flex"` patterns with `.flex-row`
- [ ] Create any edit-specific structural classes in `characterSheet.css`

---

### 4. `DmDiceRoller.jsx` — 87 inline styles → ~12
- [ ] Set `--pal-*` vars at component root (already receives `pal` prop)
- [ ] Replace die picker buttons with `.btn-ghost` + `.active` modifier
- [ ] Replace label rows with `.label-ui`
- [ ] Replace the `DICE_CSS` `<style>` tag injection with `import './diceRoller.css'`
- [ ] Create `src/components/diceRoller.css` with the keyframe animations
- [ ] Keep dynamic: die result colors (nat20 gold, nat1 red), roll animation inline transforms

---

### 5. `DiceRoller.jsx` — 85 inline styles → ~12
- [ ] Same pattern as DmDiceRoller
- [ ] Share `diceRoller.css` between both dice roller components
- [ ] Replace history row styles with CSS classes
- [ ] Keep dynamic: die shape fill colors (accent oscillation during spin)

---

### 6. `NpcCombatSection.jsx` — 87 inline styles → ~11
- [ ] Set `--pal-*` vars at section root
- [ ] Replace NPC card structure with CSS classes (`.npc-card`, `.npc-header`, `.npc-bar`)
- [ ] Replace action buttons with `.btn-ghost` (heal/cond) — DMG button keeps red tint inline
- [ ] Replace badge styles with CSS classes (`.badge-bloodied`, `.badge-dead`)
- [ ] Keep dynamic: HP bar fill width, bar color by threshold, ghost trail position/width

---

### 7. `InitiativeTracker.jsx` — 40 inline styles → ~8
- [ ] Replace list row structure with CSS classes
- [ ] Replace "Next Turn" button with `.btn-primary`
- [ ] Replace initiative value display with `.num-display-sm`
- [ ] Set `--turn-color` per active row for the `.dm-active-turn` animation

---

### 8. `ItemEditorModal.jsx` — 43 inline styles → ~8
- [ ] Replace modal wrapper with `.modal-overlay` + `.modal-panel`
- [ ] Replace labels with `.label-ui`
- [ ] Replace inputs with `.input-base`
- [ ] Replace save/cancel with `.btn-primary` / `.btn-ghost`

---

### 9. Page-level files (lower priority) ✅ DONE
- [x] `CharactersListPage.jsx` — 37 inline styles → ~12; `.modal-overlay`/`.modal-panel`, `.btn-ghost`/`.btn-primary`, `.label-ui`, `.flex-row-spread`, `.char-list-grid`/`.char-card-btn`/`.char-card-new` in `pages.css`
- [x] `DmDashboardPage.jsx` — 22 inline styles → ~8; removed `useDashboardStyles()` call, `.btn-ghost`, `.label-ui`, `.flex-row`, `.dm-sticky-header` + `.dm-nav-link` in `pages.css`
- [x] `MapLibraryModal.jsx` — 31 inline styles → ~10; `.modal-overlay`/`.modal-panel`, `.btn-primary`/`.btn-ghost`, `.flex-row-spread`, structural rules in new `src/features/dmDashboard/mapLibrary.css`
- [x] `NewCharacterPage.jsx` — `.modal-overlay`/`.modal-panel`, `.btn-primary`/`.btn-ghost`, `.label-ui`, `.input-base`, `pages.css` imported
- [x] `CharacterPage.jsx` — `centeredStyle` const removed; `.page-centered` CSS class in `pages.css`

---

## Cleanup (after all files migrated) ✅ DONE
- [x] Delete the `DASHBOARD_CSS` string constant from `dashboardShared.js` (now dead code)
- [x] Delete the `GLOBAL_CSS` string constant from `theme.jsx` (now dead code)
- [x] Remove `useDashboardStyles` call sites — removed from `DmDashboardPage.jsx` and `DmDashboardPrototypePage.jsx`
- [x] Remove `useCharacterSheetGlobalStyles` call sites — removed from `CharacterSheet.jsx` import + call
- [x] Remove `useEffect` import from `theme.jsx` if no longer needed — was already removed before this pass (comment at top of file)
- [x] Remove `useEffect` import from `dashboardShared.js` if no longer needed — `dashboardShared.js` does not import `useEffect` (uses `createContext` only)
- [x] Delete `src/App.css` (confirmed unused boilerplate — only referenced in `original_App.jsx` legacy file)
- [ ] Audit remaining `!important` rules in `dashboard.css` — most can be removed once cascade order is correct (deferred to future pass)
- [x] Run `npm run lint` and `npm run build` to confirm no regressions — build passes ✓

---

## Rules for this migration
- **Set palette variables once per component root.** Children inherit via CSS cascade — no prop drilling.
- **Per-card palette scoping works.** Each `.card[style]` element can set different `--pal-*` values. CSS inheritance means all children inside that card use that card's palette without any JS.
- **Keep inline style= for:** hp bar widths, ghost trail positions, per-row computed colors, toggle switch positions, any value that changes on every render.
- **Do not** create a CSS class for a style that only appears once. Three or more uses justifies a class.
- **Do not** use CSS Modules — no conflicting class names exist and it adds build complexity for no gain.
