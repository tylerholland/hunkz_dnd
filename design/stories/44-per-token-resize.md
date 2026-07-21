# Feature Story: Per-Token Resize on the Battle Map

**Status**: Ready for Design Brief
**Source**: DM feedback

---

## Goal

Allow the DM to resize individual tokens on the battle map to represent creature size. A boss monster (Large, Huge, or Gargantuan in D&D 5e) should visually occupy more space than a standard Medium token — giving players an immediate sense of scale and threat.

## User stories

1. As a DM, when I hover over an NPC token on the battle map, I want to see resize controls (+/−) so I can make a boss monster visibly larger than the other tokens without leaving the map.

2. As a DM, I want the resized token to persist across sessions so a dragon I scaled up stays large after a page refresh.

3. As a player, I want to see boss tokens at their DM-set size so the scale of the encounter is immediately legible.

## Scope

- Resize is per-token, not a global setting (the existing `tokenScale` calibration already handles global size).
- Size is stored as a multiplier on the individual token object (e.g. `scale: 2` = twice the baseline token size).
- Sensible range: 0.5× to 4× in steps that map to D&D size categories (Tiny, Small/Medium, Large, Huge, Gargantuan).
- Controls surface on DM hover only — players see the token at the set scale but have no resize controls.
- The resize interaction should feel fast and stay out of the way — the DM should be able to size a token in 2–3 taps without opening a modal.

## Out of scope

- Per-token resize for PC tokens (PCs are always Medium).
- Free-form drag-to-resize.
- Named size-category labels on the token itself.

## UX Design

Design brief: `design/briefs/per-token-resize-brief.md`

**Tier**: control = Tier 3 (setup); resulting size = Tier 1 (live spatial truth).

**Key decisions:**
- Resize is summoned through the **existing 480ms long-press / right-click micro-menu**
  (a new `⤢ Resize` row beside `✕ Remove`), which opens an inline +/− size stepper
  anchored to the token — **overriding the story's hover suggestion** because the 36px
  token target already carries hover-expand, long-press-remove, and player-drag, and
  hover fails touch-first. Two taps to start, one tap per step, no modal.
- Steps map to **D&D 5e size categories**, not raw integers:
  Tiny 0.5× · Small/Medium 1.0× (default) · Large 1.5× · Huge 2.0× · Gargantuan 3.0×.
  The readout names the category (`HUGE`). Non-linear, five discrete clamped stops.
- **NPC tokens only** — PCs are always Medium and get no `⤢ Resize` row.
- Persistence: additive `scale` field on each token in the map's `tokens[]`; written via
  the **existing `patchMapTokens`** (no new endpoint), debounced 300ms, server-clamped
  `[0.5, 3.0]`; absent/legacy = 1.0.
- Effective size = `36px × token.scale × map.tokenScale × mapViewerZoom` — a new per-token
  multiplier stacked on the existing global calibration and zoom (own `--token-size-mult`
  CSS var, orthogonal to `--token-scale-multiplier`).
- Players read `token.scale` via the shared `TokenChip` (no controls); large tokens
  **overflow the map edge, no clipping**.
- No resting chrome: a board with no resized tokens is the default Story 29 board.

---

## Architect Notes

**Applies**: ADR-018 (this story is the explicit "per-token scale" revisit trigger named in ADR-018's Revisit-when — see decisions.md update below), ADR-011 / ADR-019 (write path + `notifySessionChanged` nudge, already wired into `patchMapTokens`), ADR-003 (additive sentinel field, no migration), ADR-014 (CSS-var + static-CSS styling; no inline style beyond the dynamic multiplier), ADR-012 (player receives `scale` via the same public map payload, no projection change).

**Tech approach**: This is a surgical extension of the existing Story 29/29b token layer — no new endpoint, no new AWS resource, no new sentinel. Reuse everything.

1. **Stepper UI inside `TokenChip`** (`BattleModeController.jsx`, ~L534 where `longPress === "menu"` renders `.token-longpress-menu`). Add one local state — `const [resizeActive, setResizeActive] = useState(false)` — alongside the existing `longPress` state machine. The micro-menu currently renders `✕ Remove` + `Cancel`; add a third `⤢ Resize` button, gated `token.type === "npc"` (PC tokens get no row — brief §6). Clicking `⤢ Resize` sets `resizeActive = true` and `setLongPress("idle")` (the menu closes, the stepper opens at the same anchor). The stepper is a new sibling block rendered when `isDm && resizeActive`: a `.token-resize-stepper` panel (opaque `--pal-surface-solid`, absolutely positioned below the chip, flipped above when `flipCard` is true — reuse the existing `checkFlip()`/`flipCard` machinery the HP card already uses for bottom-25% detection). Contents: readout row (category name in Cinzel `--pal-accent-bright` + multiplier in `--pal-text-muted`), a 5-notch passive track (5 `<span>` dots, the active one filled — **not** an interactive slider), and `[−]` / `[+]` ghost buttons (32px visible / 44px touch via padding) plus a `Done` button. Map `−`/`+` against the fixed non-linear ladder `[0.5, 1.0, 1.5, 2.0, 3.0]` (find current index by nearest value, clamp at ends) — define this as a module constant `SIZE_STEPS` and a `SIZE_LABELS` map (`0.5→"TINY"`, `1.0→"MEDIUM"`, `1.5→"LARGE"`, `2.0→"HUGE"`, `3.0→"GARGANTUAN"`) next to the existing color helpers at the top of the file. Each tap calls a new `onResizeToken(token.id, nextScale)` prop (undefined/absent for player chips, exactly like `onMoveToken`/`onRemoveToken`). `Done`, outside-tap, or `Escape` sets `resizeActive = false`. While `resizeActive`, suppress hover-expand (guard `handleMouseEnter` early-return) so the HP card can't pop over the stepper (brief §5.2). Desktop `+`/`-`/`=` keydown is additive — attach a `keydown` listener in an effect gated on `resizeActive`. Dismiss the stepper if the chip unmounts / map switches (it unmounts with the chip — no extra handling needed).

2. **`--token-size-mult` integration — the load-bearing detail.** Token size is driven *entirely* by `transform: scale(calc(var(--token-scale-multiplier,1) * ...))` on `.token-chip` in `battleMode.css` (base rule L33, ghost L51, held L55, and the `token-drop-bounce`/poll keyframes L379–381). There is **no** width/height sizing to touch. Add `token.scale` as a new inline CSS var on the chip root (in the `style={{}}` block ~L430, next to `--token-x`): `"--token-size-mult": token.scale ?? 1`. Then, in `battleMode.css`, multiply it into **every** `scale(calc(...))` expression that already references `--token-scale-multiplier` (L33, L51, L55, L379, L380, L381) — e.g. `scale(calc(var(--token-scale-multiplier,1) * var(--token-size-mult,1) * var(--token-drag-scale,1)))`. Both vars default to 1 so legacy/PC/absent-scale tokens are unchanged. This is orthogonal and multiplicative exactly as brief §8 requires; the effective size `36px × scale × tokenScale × zoom` falls out for free because zoom is applied by the outer MapViewer transform. `MapViewer.jsx` needs **no change** — it only sets `--token-scale-multiplier` on the layer; the per-token var lives on each chip. Confirm no `overflow:hidden` clips a scaled-up chip at the map edge (brief §9 — allow overflow); the token layer at `MapViewer.jsx` ~L336 is `inset:0` sized to natural image dims, so overflow already shows.

3. **Debounced write in `MapPanel.jsx`** — model on the existing `handleScaleChange` calibration debounce (L191–205), *not* the immediate `writeTokens`. Add a new `handleResizeToken(tokenId, nextScale)` callback: (a) build `next = effectiveTokens.map(t => t.id === tokenId ? { ...t, scale: clampedScale } : t)`, (b) `setLocalTokens(next)` for the optimistic update (each tap animates instantly), (c) clear + set a 300ms `setTimeout` ref (new `tokenResizeWriteTimerRef`) that calls `patchMapTokens(activeMap.id, { tokens: next }, dmPassword).then(onLibraryChange).catch(...)`. Pass `onResizeToken={handleResizeToken}` into the `<TokenChip>` in the `tokenChips` map (~L339). Clamp client-side to `[0.5, 3.0]` mirroring `handleScaleChange`'s clamp. On error the optimistic `localTokens` holds until the next poll reverts — same failure story as every other token write. Note the debounce collapses rapid `−`/`+` taps into one `patchMapTokens` call carrying the final `tokens[]`, so the whole array (including `scale`) is written in one request; no per-tap network storm.

4. **Backend** — two small changes, both additive:
   - `patchMapTokens.js` `validateToken()` (L9–17): after the `x`/`y` checks, accept `scale` only if present — `if (t.scale !== undefined && (typeof t.scale !== "number" || !Number.isFinite(t.scale))) return false;`. Then clamp in the write loop (or when constructing `updatedMaps[idx].tokens`) — do **not** reject out-of-range, clamp it: `scale: t.scale === undefined ? undefined : Math.min(3.0, Math.max(0.5, t.scale))` (mirror `patchMapCalibration.js`'s clamp constants — note the ceiling is **3.0** here, distinct from calibration's 2.5). Simplest: normalize each token's `scale` into the `body.tokens` array before the existing `saveMapLibraryState` call. Leave absent `scale` absent (don't force-write 1.0) so legacy tokens stay untouched.
   - `specialRecords.js` `normalizeMapLibraryRecord()` (L143–149, the `map.tokens` isn't per-token-normalized today — it's passed through as `Array.isArray(map.tokens) ? map.tokens : []`). Add a `.map()` over tokens that defaults `scale`: `scale: Number.isFinite(tok.scale) ? Math.min(3.0, Math.max(0.5, tok.scale)) : 1.0`. This guarantees every token the frontend receives has a concrete `scale` (absent/legacy → 1.0), so `TokenChip` never has to guard for undefined. This is the read-side default; the handler is the write-side clamp — both needed per ADR-017's "widen the normalizer in the same change" rule.

**Scope boundary**:
- In: `⤢ Resize` row (NPC tokens, DM only) → inline stepper; `scale` field on tokens; debounced `patchMapTokens` write; `--token-size-mult` CSS var; server clamp `[0.5, 3.0]`; normalizer default 1.0; player-side render at `scale` (no controls, via shared `TokenChip`); reduced-motion static end-states.
- Out: PC-token resize (no `⤢ Resize` row when `token.type === "character"`); free-form drag-to-resize; any on-board resting badge/label/ring for resized tokens (size *is* the signal); raising the 3× ceiling (flagged in brief §14.2 for post-playtest, not now); any new endpoint, sentinel, or projection change; grid snapping; touching `MapViewer.jsx` logic (CSS-only surface there is already sufficient).

**Performance notes**: The stepper is transient per-token chrome that mounts only during an active resize — no persistent per-chip overlay, so no added resting-state render cost across all tokens (the explicit Tier-3 rationale in brief §2/§3). The 300ms write debounce keeps rapid stepping to one `patchMapTokens` call. `--token-size-mult` is a pure CSS-transform change — GPU-composited, no layout/reflow, no re-render of sibling chips. Suppress hover-expand during resize to avoid a stacking-context/HP-card repaint fighting the stepper.

**Cost notes**: None. No new AWS resource, no new Lambda, no new sentinel item, no new S3 object. `scale` rides inside the existing `tokens[]` array on the `map-library` sentinel and the existing `patchMapTokens` write. The debounced write pattern means *fewer* writes than a naive per-tap approach. Zero marginal cost at current scale.

**Dependencies**: None new. Depends only on Story 29 (token layer + `TokenChip`), 29b (long-press micro-menu + `tokenScale`/`--token-scale-multiplier` + reduced-motion block), and 34 (the `onMoveToken`-style optional-DM-callback prop pattern) — all shipped. No data field needs to exist first (`scale` is additive, legacy = 1.0).

**Risks / decisions needed**:
- **Highest-risk item: the CSS-var multiplication must hit every transform variant.** `--token-scale-multiplier` appears in six places in `battleMode.css` (base L33, ghost L51, held L55, and three drop-bounce keyframe stops L379–381). Missing any one means a resized token snaps back to global-only size during that state (e.g. mid-drop-bounce, or while held). Grep `token-scale-multiplier` and update each occurrence to also multiply `--token-size-mult`.
- **480ms long-press vs. player drag on the same token target.** No collision in practice: the resize gesture path (long-press → micro-menu → `⤢ Resize`) is DM-only and NPC-only; player drag (Story 34) is player-side and PC-own-token-only. The two never coexist on the same chip. No new guard needed — but do not accidentally wire `onResizeToken` into the player-side `<TokenChip>` in `CharacterSheetSessionMode.jsx` (`PlayerMapViewer`); leaving it `undefined` is what keeps players control-free (mirror how `onRemoveToken` is already omitted there).
- **Reduced-motion block location.** The brief says `tokens.css`; the actual file is `src/features/dmDashboard/battleMode.css` (per ADR-018 §4 — single authoritative `@media (prefers-reduced-motion: reduce)` block at the bottom of that file). Fold the resize step / stepper appear-dismiss / subject-lift-others-dim reduce-motion overrides into that existing block; keep the dim-others focus state as a static end-state (ADR-018 replace-don't-delete rule).
- **No user decision blocking.** Brief §14 open questions 1–5 were all resolved in the story's UX Design section (category names confirmed, 3× ceiling confirmed, overflow allowed, long-press over hover confirmed, PCs strictly non-resizable). Nothing needs sign-off before build.
