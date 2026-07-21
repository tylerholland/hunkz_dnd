# Per-Token Resize on the Battle Map — Design Brief

> Story 44. The DM sizes an individual NPC token up to make a boss read as a boss — a Huge dragon should tower over the goblins around it. This is a **surgical, additive extension** of the Story 29 / 29b token layer, not a redesign. It reuses the existing token-state model, the `--token-scale-multiplier` CSS variable pattern, the `patchMapTokens` write path, and the 480ms long-press already living on the same token target. Nothing about placement, visibility, faction rings, or the global calibration slider changes.
>
> Produced by design-strategist. Builds on `design/briefs/battle-map-tokens-brief.md` (Story 29) and `design/briefs/battle-map-token-polish-brief.md` (Story 29b).
>
> Palette: Ocean (DM dashboard chrome) — `bg #0d0f14`, `accent #6a8fa8`, `accentBright #a0c0d0`, `gem #8ab4c8`. Player surfaces inherit each character's own palette. Fonts: Cinzel (display / numeric), IM Fell English (UI labels), Crimson Text (body).

---

## 1. Design intent

A boss should *feel* like a boss the instant it hits the board. The functional goal is a two-to-three-tap size adjustment the DM performs once when placing a creature, then forgets — the dragon stays Huge across polls, refreshes, and sessions, and every player sees it loom over the rank-and-file. The emotional goal is **legible threat**: scale is the fastest non-verbal way to say "this one is dangerous." The mental model is unchanged from Story 29 — **tokens are pieces on the DM's board** — and this feature simply lets the DM reach for a *bigger figurine* for the monster that deserves one. The interaction must be so cheap that resizing feels like part of placement, not a separate chore.

---

## 2. Tier declaration

Per the Story 16 information-tier discipline and Story 29's tier split:

- **Tier 1 — combat-critical (DM, Battle Mode only)**: the *resulting token size* on the map. A correctly-sized boss is live spatial truth the DM and players read every turn.
- **Tier 3 — ambient / setup (DM)**: the *resize control itself*. Like the NPC portrait upload (29b §2), the control that sets the size is a between-placements setup action — it must be discoverable and instant, but it must **not** occupy permanent chrome or pull the eye during moment-to-moment combat. It surfaces on demand and recedes completely when not in use.

This split is load-bearing: it is why the +/− controls are **transient (summoned on interaction)**, never a persistent overlay riding every token. A persistent stepper on every NPC token would turn a clean board into a cluttered control panel — the exact opposite of Story 29's "disappears when not in use" promise.

---

## 3. Information hierarchy

Ranked by visual weight while the resize interaction is active on one token, most prominent first:

1. **The token being resized.** It is the subject. During the interaction it lifts (subtle scale bump + shadow) and every other token dims slightly (see §5) so the DM's eye is locked to the thing changing.
2. **The live size readout** — the size-category label (`LARGE`, `HUGE`, `GARGANTUAN`) that appears while resizing. This is the feedback that makes +/− meaningful; it is the second thing the eye lands on, riding just above the token.
3. **The +/− controls.** Present but deliberately *quiet* — they are tools, not information. They flank the token and are large enough to hit reliably, but styled as chrome (ghost, palette border), never competing with the readout for attention.
4. **All other placed tokens.** Dimmed to ~0.55 during the resize interaction — present for spatial context (the DM is sizing *relative to* the goblins around it) but pushed back.

When no resize is in progress, this entire hierarchy is absent: the map is exactly the Story 29 board. **There is no resting-state chrome for this feature.** A token that has been sized up simply *is* bigger — that is its only ambient signal, and it is the correct one.

---

## 4. Interaction model — the core decision

### 4.1 How the controls are summoned — decision

**A dedicated `⤢ Resize` row inside the existing long-press micro-menu, which opens an inline +/− size stepper anchored to the token. Not a hover-only overlay. Not a persistent per-token control.**

The story suggests hover. The **hover suggestion is overridden** and resize is folded into the gesture path that already exists — here is the reasoning:

- **The token target is already overloaded.** The same 36px circle already carries: hover-expand (120ms desktop / 280ms touch → HP card, per 29 §6), long-press-to-remove (480ms → micro-menu, per 29b §6), and — for PC tokens — player drag (Story 34). A *fourth* independent hover affordance on the same pixels would collide with hover-expand and be impossible to hit cleanly on a token that's only 36px.
- **Hover doesn't exist on touch, and the DM is often on a tablet.** A hover-only design fails the touch-first non-negotiable outright. The long-press menu is already the established touch-native command surface for tokens — resize belongs there.
- **The micro-menu already exists and already opens on the exact right gesture.** Story 29b's long-press (480ms) / right-click menu currently shows `✕ Remove` + `Cancel`. Adding one row — `⤢ Resize` — is the minimal, consistent, discoverable move.

So the flow is: **long-press (or right-click) the token → menu shows `⤢ Resize` / `✕ Remove` / `Cancel` → tap `⤢ Resize` → the menu is replaced in place by a compact size stepper anchored to the token.** Two taps from a resting board to actively resizing; each subsequent size step is one more tap. This satisfies the story's "2–3 taps, no modal" requirement precisely, and it costs **zero** new resting chrome.

### 4.2 The size stepper (the resize control proper)

Once `⤢ Resize` is chosen, an inline horizontal stepper replaces the micro-menu at the same anchor point:

```
        ┌─────────────────────────────────┐
        │   ⓐ HUGE          2×           │   ← readout row
        │  ⓑ[ − ]  ●───●───◐───○  [ + ]ⓒ │   ← stepper + notch track
        │         ⓓ Done                 │
        └─────────────────────────────────┘
```

- Each `−` / `+` tap moves one size category (§6), animating the live token immediately.
- The readout row shows the **category name** (Cinzel 14px `pal.accentBright`) + the **numeric multiplier** (Cinzel 13px `pal.textMuted`, right-aligned).
- A 5-notch mini-track visualises where in the Tiny→Gargantuan range the token currently sits — passive orientation, not a draggable slider.
- **Commit is implicit and continuous:** each tap writes optimistically (§7). `Done`, a tap outside the stepper, or `Escape` dismisses it. There is no separate "save."
- **Undo:** stepping back down with `−` is the undo. Because every step writes, there is no destructive commit to guard against.

### 4.3 Desktop convenience path

On desktop, after `⤢ Resize` is active for a token, **`+` / `-` / `=` keyboard keys** also step the size (and `Esc` dismisses). Purely additive; touch is unaffected.

---

## 5. Visual design — controls on a 48px target without hiding the face

### 5.1 Anchoring and collision avoidance

- The stepper is a **single detached panel anchored below the token** (or above, if the token is in the bottom 25% of the viewport). It never overlaps the portrait circle.
- Panel: `pal.surfaceSolid` (opaque), 1px `pal.border`, 3px radius, `box-shadow: 0 4px 12px rgba(0,0,0,0.5)`. ~200px wide.
- `−` and `+` are **32px visible / 44px touch target** (via padding), ghost style (`pal.border` border, `pal.textMuted` glyph → `pal.accent` on hover/press).
- The token itself, during resize, gets a **selection affordance ring** (`pal.accentBright`, +1px) and a soft lift shadow, matching the "held" language from 29. Other tokens dim to 0.55 (180ms ease-out), restoring on `Done`.

### 5.2 Coexistence with long-press-remove and hover-expand — no collisions

| Gesture on a token | Result |
|---|---|
| Hover (desktop, 120ms) / long-press 280ms (touch) | **Hover-expand HP card** (unchanged, 29 §6) |
| Long-press 480ms / right-click | **Micro-menu**: `⤢ Resize` · `✕ Remove` · `Cancel` |
| Micro-menu → `⤢ Resize` | **Size stepper** (this feature) |
| Micro-menu → `✕ Remove` | Remove flow (unchanged, 29b §6) |

During an **active resize**, hover-expand on that token is suppressed so the HP card doesn't pop over the stepper.

### 5.3 What a resized token looks like at rest

No badge, no ring change, no "2×" label on the board. A Gargantuan token is simply a large portrait circle with its normal faction ring. Size *is* the signal. The name label continues to sit below the token's now-larger bottom edge, tracking the scaled size automatically.

---

## 6. Size steps — decision

**Map +/− to D&D 5e size categories, not raw integers.**

| Category | `scale` value | vs. Medium | Notes |
|---|---|---|---|
| Tiny | `0.5` | half | sprite, familiar, imp |
| Small / Medium | `1.0` | baseline (**default**) | vast majority of NPCs |
| Large | `1.5` | 1.5× | ogre, dire wolf |
| Huge | `2.0` | 2× | giants, young dragons |
| Gargantuan | `3.0` | 3× | ancient dragon, tarrasque |

**Why categories over integers:** They map to the language the DM already thinks in. The 5e ratios are visually *correct* on a battle mat — Large really is 1.5 Medium-widths, not 2×. The steps are non-linear (`0.5 → 1.0 → 1.5 → 2.0 → 3.0`); `+` from Huge jumps to 3.0 because there is no "2.5× size" in the DM's mental model.

**PC tokens:** No `⤢ Resize` row for `type === "character"` tokens.

---

## 7. Persistence model

- **Field:** add `scale: number` to the individual token object in `tokens[]`. Absent / legacy = `1.0` — no migration needed.
- **Write path:** **existing `patchMapTokens(mapId, { tokens }, dmPassword)`** — the whole array is already replaced, so no backend schema or handler change beyond letting `scale` pass through validation.
- **Debounce:** 300ms after the last +/− tap (mirrors HP-stepper flush pattern). Optimistic local update on each tap; revert on error.
- **Validation:** server clamps `scale` to `[0.5, 3.0]` (mirror `patchMapCalibration.js`'s clamp).

---

## 8. Player visibility

- Players receive the map via `PlayerMapViewer` → `TokenChip`. The `scale` field is already on the token object in the public payload — **no new endpoint or projection change**.
- `TokenChip` reads `token.scale` for both DM and player renders.
- **Effective size formula:** `36px × token.scale × map.tokenScale × mapViewerZoom`. Per-token `scale` stacks on the existing global calibration `tokenScale` and zoom. Implement as a new per-chip `--token-size-mult` CSS variable, orthogonal to the global `--token-scale-multiplier`.
- Players get **no resize controls** — the `⤢ Resize` row is NPC DM-only, gated by the same branch that already gates remove/menu handlers.

---

## 9. Edge cases & empty states

| Case | Behaviour |
|---|---|
| Large token near map edge | **Allow overflow, do not clip.** The token's `(x,y)` anchor is clamped 0–1; a scaled token extends past the image edge visually. Clamping would fight the DM's intent. |
| Resize during active drag | N/A — PCs aren't resizable; NPC tokens aren't player-draggable; simultaneous long-press + drag is impossible. |
| FALLEN / concentration / active-turn token | Works identically. FALLEN dim and concentration dot scale with the token. |
| Legacy token missing `scale` | Treated as `1.0`. First resize write persists the value. |
| `scale` arrives malformed | Server clamps to `[0.5, 3.0]`; missing = `1.0`. Token never vanishes. |
| Stepper open, DM switches map | Stepper dismisses immediately (same as micro-menu on map switch). |
| Poll arrives mid-resize with different `scale` | Optimistic local value wins until `Done`, then server confirms. |
| Empty state | No resting chrome — a board with no resized tokens is the default Story 29 board. |

---

## 10. Motion & animation spec

All durations assume `prefers-reduced-motion: no-preference`; reduce → §11.

```
Resize step (− / +):
  Duration: 160ms, cubic-bezier(0.34, 1.56, 0.64, 1) (slight overshoot)
  Communicates: "this creature changed size" — overshoot echoes the drop-bounce
                'a piece landed' grammar from Story 29

Readout category change:
  Animation: old label opacity→0 (60ms), new label 0→1 (100ms)
  Duration: 160ms total

Stepper appears (from micro-menu → Resize):
  Animation: micro-menu crossfades to stepper; stepper scale 0.96→1 + opacity 0→1
  Duration: 140ms ease-out

Subject-token lift / others dim:
  Trigger: stepper opens
  Duration: 180ms ease-out
  Other tokens: opacity 1→0.55

Interaction end (Done / outside tap / Esc):
  Stepper: scale 1→0.96 + opacity→0 (120ms ease-in)
  Others: opacity 0.55→1 (180ms ease-out)

Player-side size change (poll/push):
  Duration: 240ms, cubic-bezier(0.2, 0.8, 0.2, 1)
  Slightly slower than DM's 160ms — a watching player reads it as a real event
```

---

## 11. `prefers-reduced-motion`

Fold into the **single authoritative `@media (prefers-reduced-motion: reduce)` block in `tokens.css`** (established by 29b §9). The dim-others focus state is **kept as a static end-state** — it carries focus meaning, per 29b's "replace, don't delete" rule.

| Motion point | Reduce-motion behaviour |
|---|---|
| Resize step | Instant size change — no overshoot tween |
| Readout category change | Instant label swap |
| Stepper appear / dismiss | Instant show/hide |
| Subject lift / others dim | Instant opacity state |
| Player-side poll size change | Instant snap |

---

## 12. Mobile vs. desktop delta

| Element | Mobile / touch | Desktop |
|---|---|---|
| Summon resize | Long-press 480ms → micro-menu → `⤢ Resize` | Right-click → micro-menu → `⤢ Resize` |
| Step | Tap `−` / `+` (44px touch targets) | Click `−` / `+`, or `+`/`-`/`=` keys |
| Dismiss | `Done` / tap outside | `Done` / tap outside / `Esc` |
| Stepper panel | If narrow viewport: centers as bottom-anchored panel above the tray | Anchored below/above token |
| Resulting token size | Identical | Identical |

---

## 13. Files to touch

**Frontend:**
- `src/features/dmDashboard/battleMode/BattleModeController.jsx` — `TokenChip`: add `token.scale` → `--token-size-mult`; size stepper UI + state; `⤢ Resize` row in DM-only micro-menu (NPC tokens only); resize-active focus/dim state.
- `src/features/dmDashboard/MapPanel.jsx` — debounced `patchMapTokens` write on size change; optimistic/revert handling.
- `src/features/maps/MapViewer.jsx` — confirm `--token-size-mult` multiplies cleanly with `--token-scale-multiplier`; confirm no edge overflow clipping.
- `src/features/characterSheet/CharacterSheetSessionMode.jsx` (`PlayerMapViewer`) — player-side `TokenChip` reads `token.scale` at size (no controls). Likely no change beyond shared `TokenChip`.
- `src/features/dmDashboard/tokens.css` — stepper panel styles, size-transition keyframes, addition to the existing reduced-motion block.

**Backend:**
- `backend/src/handlers/patchMapTokens.js` — allow `scale` in per-token validation; clamp to `[0.5, 3.0]`.
- `backend/src/lib/specialRecords.js` — `normalizeMapLibraryRecord()`: default `scale: 1.0` on tokens lacking it.

---

## 14. Open questions

1. **Size step naming.** Brief uses D&D 5e category names (`LARGE`, `HUGE`, etc.) in the readout. Confirm over bare multipliers (`1.5×`, `2×`). Names are recommended — they make +/− meaningful at a glance.
2. **Gargantuan ceiling at 3×.** Can be raised to 4× post-playtest trivially. Flagged, not now.
3. **Edge overflow — allow vs. clip.** Brief allows overflow. Confirm no visual clamping desired.
4. **Trigger override — long-press menu vs. hover.** Brief overrides the story's hover suggestion. Flag if hover is specifically desired; requires solving the 36px-target collision problem.
5. **PC tokens strictly non-resizable.** Confirm no future desire to size an Enlarged/Reduced PC.
