# Battle Map Token Polish — Design Brief

> Story 29b. The follow-up polish pass on Story 29's token layer. Five concrete additions (NPC token portraits, per-map scale calibration, smooth player-side movement, long-press remove on touch, tray collapse) plus a `prefers-reduced-motion` audit. Nothing here changes the placement model, the visibility rules, or the data shape established in Story 29 — this brief refines, it does not redesign.
>
> Produced by design-strategist. Builds on `design/briefs/battle-map-tokens-brief.md` (Story 29) and coordinates with Story 31 (already built and merged).
>
> Palette: Ocean (DM dashboard chrome) — `bg #0d0f14`, `accent #6a8fa8`, `gem #8ab4c8`. Player surfaces inherit each character's own palette. Fonts: Cinzel (display), IM Fell English (UI labels), Crimson Text (body).

---

## 1. Design intent

Story 29 gave the table a shared positional truth. Story 29b makes that truth **recognisable and calibrated** — a named villain wears its face, three goblins are told apart at a glance, tokens sit at the right size for *this* map's grid, and a player watching from across the table sees the rogue *glide* into the open door rather than blink into it. The emotional goal is **recognition without effort**: the DM never re-describes who's who, and the player's eye locks onto their own token instantly because it glows in their own colour.

Every item in this brief is a reduction of cognitive load, not an addition of chrome. The portrait replaces a guessing game ("which initial was the shaman?"). The scale slider replaces squinting. The smooth transition replaces the jarring teleport that makes a player wonder *did something break?*. The reduced-motion audit ensures none of this motion becomes a liability for a player who needs stillness. The mental model is unchanged from Story 29 — **tokens are pieces on the DM's board** — we are just making the pieces look and behave like the real thing.

---

## 2. Tier declaration

These polish items inherit Story 29's tier split and add nothing above it:

- **Tier 1 — combat-critical (DM)**: token identity (portrait), token scale calibration. The portrait is the fastest possible "which creature is this" read; calibration is the prerequisite for the whole token layer being legible on a given map.
- **Tier 2 — secondary (player)**: smooth poll-driven movement, palette-coloured highlight ring. The player references these passively during others' turns; they never act on them.
- **Tier 3 — ambient / setup (DM)**: the NPC portrait *upload affordance* (a between-turns or between-session action), the tray collapse status strip (recedes when work is done).

The portrait **upload control is Tier 3** (a setup action) even though the resulting **portrait is Tier 1** (live identity). This distinction drives §3's placement decision: the upload affordance must be discoverable but must not steal compact-card real estate from live HP/condition state.

---

## 3. NPC token portrait upload

### 3.1 Where the affordance lives — decision

**On the NPC card's initials/portrait circle in the combat tracker header, as a hover/tap-revealed camera overlay. Not in the `⋯` menu.**

The NPC card header already renders an identity circle (initials fallback today, per Story 24/29). That circle *is* the thing the portrait replaces — so the upload affordance belongs **on the circle it modifies**, following the principle of direct manipulation. Burying it in the `⋯` overflow (which Story 31 already loads with `Save to library` / `Remove enemy`) would make portrait-setting feel like an obscure command rather than "tap the face to give it a face."

```
NPC card header (compact, ~52px tall):

┌───────────────────────────────────────────────────────┐
│  ①[◔]  ② Goblin Shaman        ③ ♥ 27/27   + Init  ⋯ × │
│   ▲                                                    │
│   └ ④ camera glyph overlay on hover / persistent on    │
│      touch; tap → file picker                          │
└───────────────────────────────────────────────────────┘
```

**① Identity circle** — 36px in the card header (matches existing). Image (circle-cropped, 1px `npcPal.actionBorder` ring) when `portraitUrl` set; initials fallback (`npcPal.bright` on `npcPal.chipBg`, 1–2 chars per Story 31 §6 rule) when not.

**④ Camera overlay** — a 28px circular scrim (`rgba(0,0,0,0.5)`) with a 14px camera glyph (`npcPal.bright`) centered over the identity circle. **Hover-revealed on pointer devices** (opacity 0→1, 120ms); **persistent at opacity 0.6 on touch** (`@media (hover: none)`) — the same hover-vs-touch affordance pattern the counter-wheels `⋯` trigger already uses. The whole 36px circle is the tap target (≥44px with the card's padding). Tap → native file picker.

**Why not inline-next-to-name, why not in `⋯`:** inline would add a second persistent control to an already-dense 52px row; the `⋯` menu hides a Tier-1 identity action behind a Tier-3 gesture. The circle overlay costs *zero* new horizontal space and reads as direct manipulation.

### 3.2 Upload flow (reuses the established presign pipeline)

Identical to the character-portrait and map-upload flows — **reuse `/maps/presign`** (same `hunkz-dnd-portraits` bucket); the architect may choose an `npc/` S3 prefix but the UX is unaffected. This matches Story 31 §6's explicit recommendation, so 29b and 31 share one pipeline.

1. Tap circle → native file picker (`image/png, image/jpeg, image/webp`).
2. File chosen → circle **immediately shows a local object-URL preview** with a thin determinate progress ring around its circumference (`npcPal.accent`) + a faint shimmer scrim.
3. Client requests presigned URL → PUTs to S3.
4. Success: shimmer fades (180ms), ring completes + fades. `portraitUrl` is written to the NPC object via the existing `putNpcCombat` pass-through **immediately** (the live combat tracker has no separate "save" step — unlike Story 31's library editor, the NPC combat object is the live record). The token on every map repaints with the portrait on the next poll.
5. Failure: preview reverts to prior portrait/initials; inline `Couldn't upload — try again` in `#c06060` Crimson italic 12px directly below the card header.

**Size/validation:** soft warning above ~2MB, inline rejection above ~5MB. Server hard-enforcement is the architect's call.

### 3.3 Token rendering — portrait vs. fallback

This is the payoff. The token (on both DM and player maps) renders per Story 29's token-state table, with one change: the NPC token's fill is now **the portrait image when `portraitUrl` is present**, falling back to the existing hash-tinted colored-initial circle when absent.

| | Portrait present | No portrait (fallback, unchanged) |
|---|---|---|
| **Fill** | Circle-cropped `portraitUrl` image, `object-fit: cover` | Hash-tinted fill from NPC `id`, white initials (Cinzel) |
| **Ring** | 2px `npcPal.border` (neutral grey) | 2px `npcPal.border` |
| **Outer outline** | 1px `rgba(0,0,0,0.4)` (legibility against light terrain) | Same |
| **Number badge** | Story 31's bottom-right badge when name ends in trailing integer — sits over the portrait | Same |
| **Broken image** | `onError` → revert to initials fallback. Never a broken-image glyph | n/a |

The NPC ring stays neutral grey deliberately: the **portrait carries identity; the ring carries faction** (grey = NPC). Changing both would muddy the PC-vs-NPC read that Story 29 established.

### 3.4 Contract with Story 31 (already built and merged)

One field, one upload, reused forever. `portraitUrl` on the NPC combat object (`npc-combat` sentinel) is the **same string** Story 31's library entries store.

- Upload here → `portraitUrl` on the live NPC card → its map token shows the face.
- Story 31's `⋯ → Save to library` captures whatever `portraitUrl` is on the card at save time (a **one-way snapshot**, not a live link — resolves the story's open question 2).
- Story 31's library spawn pre-fills `portraitUrl` onto the new combat card, so a re-spawned shaman arrives with its face already set — **no second upload**.

Because Story 31 is already merged, 29b adds the *combat-card* upload path that 31's brief §6 explicitly deferred to "Story 29b." This brief delivers exactly that card affordance, writing the same field 31 reads. No conflict.

---

## 4. Token scale calibration

Story 29 §16 already specified this control in full (a ⚙ gear popover in the map panel header, 0.5×–2.5× slider, per-map `tokenScale` persistence, the `--token-scale-multiplier` CSS variable, the `PATCH /maps/{mapId}/calibration` write). 29b's job is to **confirm and lock** that spec — it was deferred from 29's implementation, not redesigned. The decisions below resolve this story's open question 3.

### 4.1 Placement — decision: gear popover (confirmed)

**A ⚙ gear icon in the map panel header opening a 240px anchored popover — not an inline header slider.** Story 29 §16.2 already argued this; the story re-opens it as a question. The answer holds:

- Token scale is **set once per map and forgotten** — it does not earn permanent header real estate that competes with the moment-to-moment Battle Mode toggle and collapse chevron.
- An inline slider in a 320px-mobile header would crush the existing controls.
- The gear is visible **only in Battle Mode** (32px ghost icon, `pal.textMuted` → `pal.accent` on hover), keeping Adventure-mode headers calm.

```
┌──────────────────────────────────────────────────────────────┐
│ MAP   Forest Crossing      [⚔ BATTLE MODE ✓]    [⚙]    ⌃     │
└──────────────────────────────────────────────────│───────────┘
                                                   ▼
                         ┌─────────────────────────────────────┐
                         │  MAP CALIBRATION                    │
                         │  Token size                         │
                         │  [−]  ◐──────●──────◑  [+]   1.4×  │
                         │       small        large            │
                         │  [⟳ Reset to 1.0×]                 │
                         └─────────────────────────────────────┘
```

### 4.2 Control + behaviour (locked from Story 29 §16)

- **Slider with flanking ± steppers + numeric readout.** 180px track, thumb 18px `pal.gem`, filled portion `pal.accent`, readout `1.4×` in Cinzel 14px.
- **Range 0.5×–2.5×, default 1.0×, step 0.05×.** Hard-clamped both ends.
- **Live preview:** dragging the thumb resizes tokens **instantly** (1:1, no tween). Clicking ± gives a 120ms ease-out tween. Implemented as a single `--token-scale-multiplier` CSS variable on the MapViewer root — no token-list re-render.
- **Effective size:** `36px × tokenScale × mapViewerZoom`. Calibration and zoom are orthogonal and multiplicative.
- **Persistence:** per-map `tokenScale` in the `map-library` sentinel (ADR-017 default 1.0). Write via `PATCH /maps/{mapId}/calibration`, **debounced 600ms** after the last movement. Flows to players through unauthenticated `GET /maps`.
- **Reset** ghost button renders only when `tokenScale !== 1.0`; tokens animate to 1.0× in 180ms.
- **Tray chips do NOT scale** — they stay at 44px touch-friendly chrome regardless of calibration.
- **Name-label hide threshold:** label hides at `tokenScale × mapViewerZoom < 0.6`, returns on hover-expand.
- **Mobile:** popover becomes a full-width bottom sheet below 360px.

---

## 5. Smooth player-side token movement

The single most-felt polish item. A position change between two polls currently *teleports*; it should *glide*.

### 5.1 Spec

- **Where:** the player-facing `MapViewer` token overlay **only**. The DM side keeps Story 29's deliberate drop-bounce on placement.
- **Property:** CSS transition on the token's positional transform (the `translate` portion of the image-space position), not on `left`/`top` — transitioning `transform` stays on the compositor.
- **Duration / easing:** `transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out cubic). Slow enough to read as deliberate travel, fast enough to resolve before the next 1s poll tick.
- **Fires only on change, never on first mount.** A token appearing mid-combat must **not** slide in from `(0,0)` — it fades in at its committed position (opacity+scale 0→1, 180ms ease-out, per Story 29's appear policy). Implementation: gate the transition on a "has-mounted" flag (apply the transition class only after the first paint via a mounted ref).
- **Scope:** position only. No path interpolation, no rotation. Diagonal movement glides in a straight line.

---

## 6. Long-press remove on touch

A touch-native parallel path to the remove action already in Story 29's hover-expand card. **DM-only.**

### 6.1 Gesture spec

- **Trigger:** a sustained press of **480ms** on a placed token (DM device). Intentionally distinct from Story 29's **280ms** hover-expand long-press — holding past 480ms escalates to the remove menu. At ~280ms the hover-expand card that began appearing **cross-fades out** (120ms) as the menu takes over.
- **Press feedback (the "charging" cue):** during the hold, the token's outer ring fills clockwise as a progress sweep in `pal.accent`. At 480ms a haptic-light micro-action menu surfaces:

```
        ┌──────────────────┐
        │  ✕ Remove        │   ← red #c06060, 44px row
        │  Cancel          │   ← ghost, pal.textMuted, 44px row
        └──────────────────┘
```

- **Commit:** `✕ Remove` → token scales 36px→0 + opacity 1→0 (180ms ease-in); chip slides back into tray (200ms).
- **Cancel paths:** tap `Cancel`, tap outside the menu, or lift before 480ms. Menu auto-dismisses after 4s.
- **Desktop parity:** right-click already opens this same menu (Story 29). 29b adds the touch equivalent only.

---

## 7. Tray collapse polish

When every tray token is placed, the tray recedes to a slim status line — then expands the instant a token returns to unplaced.

### 7.1 States + spec (resolves story open question 4)

```
FULL TRAY (any token unplaced) — 76px strip
┌────────────────────────────────────────────────────────────┐
│  UNPLACED · 4                                       End ▾   │
│  ◉Eo   │   ◉Gb2  ◉Gb3  ◉Bs                                 │
└────────────────────────────────────────────────────────────┘

COLLAPSED (all placed) — 28px status strip
┌────────────────────────────────────────────────────────────┐
│  ✓ ALL TOKENS PLACED · 7                            ⌃ open  │
└────────────────────────────────────────────────────────────┘
```

- **Trigger to collapse:** the moment `unplacedCount` reaches 0 AND `total > 0`.
- **Animation:** `max-height 76px → 28px`, 220ms ease-out; chip row crossfades out (opacity→0, 180ms); `✓ ALL TOKENS PLACED · N` label crossfades in (opacity 0→1, 180ms, +40ms delay). The map panel reclaims the freed ~48px.
- **Collapsed treatment:** 28px strip, `pal.surface` bg, `✓` glyph in `pal.accent`, label in IM Fell English 11px tracked `pal.textMuted`, `N` = total placed count, `⌃ open` chevron (44px tap target) at right edge.
- **Re-expand triggers:** (a) DM taps the strip / chevron, or (b) any token is removed back to unplaced (auto-expands). Reverse animation: 220ms ease-out; chip row crossfades back in.
- **End Combat / Reset Tray access:** stays in the map panel header Battle Mode toggle area — the collapsed strip does not need its own `End ▾` menu.

---

## 8. Player token highlight ring — palette colour (story open question 3)

**Decision: a player's own token ring uses that character's `--pal-accent`. This is a usability fix, not just polish.**

### 8.1 Data available + lookup

- A PC token entry carries a `slug` identifying which character it represents.
- The character's `palette` field is available on the same party/character record the token is derived from. On the **DM map**, `dmParty` rows already include `palette`. On the **player MapViewer**, `GET /party/status` already returns `palette` per character (confirmed in app-overview).
- **Application:** resolve `PALETTES[character.palette].accent` and set it as the token's ring colour via a per-token `--token-ring` CSS variable. The token does not need to be inside a palette-themed DOM subtree.

### 8.2 Visual result

- **Own token (the viewing player):** ring in *your* palette accent — instant self-recognition.
- **Other PCs:** ring in *their* palette accent — matches the party status strip and DM dashboard colour grammar.
- **NPCs:** unchanged — neutral grey `npcPal.border` ring (faction signal). Only PC rings are palette-driven.

---

## 9. `prefers-reduced-motion` audit

An audit pass, not a new feature. Every motion point from Story 29 and this brief must honour `@media (prefers-reduced-motion: reduce)`.

### 9.1 Strategy

**Single authoritative block** in `tokens.css` under `@media (prefers-reduced-motion: reduce)`: blanket `animation: none; transition-duration: 0ms` on all token-layer elements. Strategy is *replace, don't merely delete* where motion carries meaning:

- **Poll move:** instant snap. State still updates; only the glide is removed.
- **Drop bounce:** token appears at final position instantly.
- **Hover-expand:** appears at final size/opacity instantly.
- **Long-press ring sweep:** replaced by a static "Hold to remove" label appearing at ~120ms — the gesture still works at 480ms; only the animated sweep is suppressed.
- **Tray collapse:** instant state swap.
- **Calibration ± / Reset tweens:** instant resize.
- **Concentration dot pulse, FALLEN wash, glow halos:** looping/transitioning motion stops; **static end-state styling remains** (dot present, FALLEN at 0.4 opacity + red wash, halo at rest opacity).
- **Portrait upload progress ring:** kept as a static determinate ring — it communicates real system state (bytes uploading), not decorative motion.

### 9.2 Audit checklist

| Motion point | Source | Reduce-motion behaviour |
|---|---|---|
| Drop bounce | 29 | Instant final position |
| Hover-expand breathe (open/close) | 29 | Instant appear/disappear at final size |
| HP card slide-in | 29 | Instant |
| Poll move | 29b §5 | Instant snap |
| Poll appear / disappear | 29 | Instant (no fade) |
| Held-token glow halo pulse | 29 | Static ring, no pulse |
| Concentration dot pulse | 29 | Static dot |
| FALLEN wash transition | 29 | Static dim + wash |
| Tray slide-up (Battle Mode on) | 29 | Instant |
| Tray collapse / expand | 29b §7 | Instant state swap |
| Long-press ring sweep | 29b §6 | Static "Hold to remove" label; menu still at 480ms |
| Calibration ± / Reset tween | 29b §4 | Instant resize |
| Number badge entrance | 31 | Static |
| Portrait upload shimmer / ring | 29b §3 | Static determinate progress ring (real system state — kept) |

---

## 10. Motion & animation spec

All durations assume `prefers-reduced-motion: no-preference`. Reduce → per §9.

| Event | Element / animation | Duration · easing | Communicates |
|---|---|---|---|
| NPC portrait upload — preview | Circle shows local object-URL; shimmer scrim + determinate progress ring | Ring tracks bytes; shimmer continuous | "your image is uploading now" |
| NPC portrait upload — success | Shimmer fades; ring completes + fades; token repaints next poll | 180ms ease-out | "done — this is the face now" |
| NPC portrait upload — fail | Preview reverts; error line fades in | 120ms revert + 160ms in | "didn't take — try again" |
| Calibration drag | Tokens resize via `--token-scale-multiplier` | Instant (1:1) | "this is the size, right now" |
| Calibration ± click | Tokens resize | 120ms ease-out | "stepped one notch" |
| Calibration reset | Tokens animate to 1.0× | 180ms ease-out | "back to default" |
| Player token poll-move | `transform` translate old→new | 280ms cubic-bezier(0.2,0.8,0.2,1) | "this creature travelled here" |
| Player token first mount | opacity+scale 0→1 (NO slide from origin) | 180ms ease-out | "a new piece entered the board" |
| Long-press charge (touch, DM) | Ring fills clockwise; hover-expand card cross-fades out at ~280ms | 480ms linear sweep | "keep holding to remove" |
| Long-press menu surfaces | Micro-menu scale 0.94→1 + opacity | 140ms ease-out | "remove option is ready" |
| Remove confirmed | Token scale+opacity 1→0; tray chip slides in | 180ms ease-in + 200ms | "gone from the board" |
| Tray collapse | max-height 76→28px; chip row ⇄ "ALL PLACED" crossfade | 220ms ease-out + 180ms | "work done; reclaiming space" |
| Tray expand | max-height 28→76px; label ⇄ chips crossfade | 220ms ease-out | "token to place again" |

---

## 11. Edge cases & empty states

| Case | Behaviour |
|---|---|
| NPC has no portrait | Hash-tinted initials fallback on token + camera overlay on the card circle |
| `portraitUrl` 404 / deleted out-of-band | `onError` → initials fallback. Never a broken-image glyph. |
| Portrait uploaded, NPC then removed from combat | S3 object orphaned (acceptable; matches map-library behaviour). Library entry retains `portraitUrl` if saved. |
| Same image for multiple goblins | Allowed. Story 31's number badge still differentiates them. |
| Calibration at 0.5× on a hi-res map | Tokens fall below label-hide threshold; labels hide, return on hover-expand. |
| Legacy map with no `tokenScale` | Treated as 1.0×; first calibration write persists the value. |
| Poll-move while DM is mid-drag same token | DM side instant (no transition); player side animates to latest committed coordinate. |
| Long-press started, finger lifts before 480ms | Resolves to hover-expand (if past 280ms) or nothing (if before). Ring resets. |
| Long-press on a FALLEN token | Works identically; `✕ Remove` is the most common use here. |
| All tokens placed, then map switched | New map computes its own unplacedCount; collapsed/full state is live-derived (not stored). |
| Tray with 0 total tokens | Shows Story 29's empty-state copy, NOT "ALL PLACED" strip. "ALL PLACED" requires `total > 0 AND unplaced === 0`. |
| Reduced-motion + long-press | Static "Hold to remove" label replaces the animated sweep; menu still appears at 480ms (§9). |

---

## 12. Mobile vs. desktop delta

| Element | Mobile / touch (<900px) | Desktop (≥900px) |
|---|---|---|
| Portrait upload affordance | Camera overlay persistent at 0.6 opacity; tap circle → file picker | Camera overlay hover-revealed (0→1, 120ms) |
| Calibration popover | Full-width bottom sheet below 360px | Anchored 240px popover under ⚙ |
| Remove gesture | **Long-press 480ms** with ring-sweep charge | Right-click → same menu; long-press also works |
| Poll-move transition | Identical (280ms) | Identical |
| Token ring colour | Identical (palette accent) | Identical |
| Tray collapse strip | Identical; `⌃ open` 44px tap target | Identical |

---

## 13. Files to touch (for code-architect annotation)

**Frontend:**
- `src/features/dmDashboard/NpcCombatSection.jsx` — camera-overlay upload affordance on the NPC card identity circle; presign→S3→`putNpcCombat` write of `portraitUrl`; upload preview/progress/error states.
- `src/features/dmDashboard/MapPanel.jsx` — ⚙ calibration popover (Story 29 §16); tray collapse status-strip state; long-press remove menu (DM side).
- `src/features/maps/MapViewer.jsx` — palette-accent ring colour per PC token (`--token-ring` from character `palette`); smooth poll-move transition (gated on has-mounted flag); NPC token portrait-vs-initials fill with `onError` fallback.
- `src/features/dmDashboard/tokens.css` — calibration popover styles, tray-collapse keyframes, long-press ring-sweep, **single authoritative `@media (prefers-reduced-motion: reduce)` block** covering all token-layer motion.
- `src/api.js` — confirm presign reuse for NPC portraits.
- `src/pages/CharacterModePage.jsx` — ensure `GET /party/status` palette + `tokenScale` propagate to the player MapViewer.

**Backend:**
- `backend/src/handlers/patchMapCalibration.js` (new per Story 29) — DM auth, writes `tokenScale` on the map entry.
- `backend/src/handlers/putNpcCombat.js` — confirm `portraitUrl` passes through (likely no change).
- `backend/src/handlers/getPartyStatus.js` — confirm `palette` is in the projection (already is).
- `backend/template.yaml` — `PATCH /maps/{mapId}/calibration` route; presign reuse confirmation.

---

## 14. Open questions

1. **Presign endpoint for NPC portraits — reuse `/maps/presign` or dedicated?** Recommend reuse (same bucket, same flow). Architect decides on an `npc/` S3 prefix; UX is unaffected either way.
2. **Reduced-motion + upload progress ring.** Recommend keeping a static determinate progress ring (real system state, not decorative motion). Confirm this is acceptable vs. suppressing it entirely.
3. **Reduced-motion + long-press charge.** Recommend the static "Hold to remove" label substitute (§9) so the gesture remains usable. Confirm the builder shouldn't simply `animation: none` the sweep.
4. **End Combat / Reset Tray access in the collapsed tray.** Brief recommends collapsed strip is a pure status indicator; End Combat stays in the Battle Mode toggle / panel header. Confirm.
5. **NPC ring colour with portrait.** Brief keeps NPC rings neutral grey even with a portrait (faction signal). Confirm this is the intended read — the alternative would be tinting NPC rings.
6. **Camera overlay vs. tap-circle on touch.** On touch the whole circle is the upload tap target. Confirm there is no competing tap action on the card identity circle today. If a future feature wants tap-circle for something else, the overlay would need to shrink to a corner glyph.
