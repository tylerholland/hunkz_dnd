# Battle Map Tokens — Design Brief

> Story 29. Tokens turn the existing display-only battle map into a shared positional surface. The DM is the sole author of token positions; players see the live result through the existing polling channel. The visual language echoes the DM dashboard's portrait-and-palette-ring grammar so the table reads one design language across the campaign page, party strip, and battle map.
> Produced by design-strategist.

---

## 1. Design intent

The DM under pressure should never have to *describe* where things are. A glance at the table-shared map answers "where is the goblin / who is closest to the door / can I hit the wizard with this fireball" in under a second, for every seat at the table. The emotional goal is **shared spatial truth** — players feel the encounter is *real* because they can see it, and the DM trusts the layer to stay quiet until they reach for it.

The functional goal is **a token layer that disappears when not in use**. A healthy out-of-combat map looks identical to today's map view. The moment the DM flips Battle Mode on, tokens for the present party and the active NPCs materialise in a tray; the DM places them in seconds; the players see them refresh on the next poll. No grid math, no DM math, no client math.

The mental model: **tokens are pieces on the DM's board.** They follow the DM's hand. Players watch them move; players do not touch them. The toggle between Adventure mode (display-only map) and Battle mode (token layer enabled) is the same gesture as flipping a battle mat over to the gridded side at the table.

The aesthetic reference is the **DM dashboard party strip**: a portrait circle with a palette ring is already the canonical "this is a character" object in this app. A token on the map is just that same object scaled down and pinned to a coordinate. NPCs use the same colored-initial fallback already used on enemy cards. Players already recognise both — there is no new visual vocabulary to learn.

---

## 2. Tier declaration

Battle map tokens span all three tiers depending on the surface:

- **Tier 1 — combat-critical (DM, in Battle mode)**: token placement state, who is unplaced, the held-token follower, exact HP on hover. These are the things the DM *acts on* turn by turn.
- **Tier 2 — secondary (player, in combat)**: token positions on the player's MapViewer. The player references this when their turn comes around; they do not write to it.
- **Tier 3 — ambient (DM, out of combat / on Adventure-mode maps)**: nothing. The token layer literally does not render. The battle map UI must not advertise its presence on a map that is not in Battle mode.

Mode-switching is therefore not chrome — it is a load-bearing affordance that gates an entire UI layer.

---

## 3. Information hierarchy

Ranked by visual weight on the DM's battle map panel, most prominent first:

1. **The map itself.** The map image fills the panel. Every other layer is overlaid on it. Nothing chromed in the panel should pull the eye away from the terrain.
2. **Placed tokens at rest.** A portrait circle with a palette ring on the map terrain. Bright enough to see, small enough not to obscure features.
3. **The held token (when one is selected).** A *floating* version of the token follows the cursor / finger, slightly elevated, partially transparent — this must read as "in flight, not yet committed." Brighter ring, soft shadow.
4. **Hover-expanded token.** The portrait grows and an HP strip slides in below — temporary, only one expanded at a time.
5. **The unplaced tray.** A subdued strip at the bottom edge of the map panel; tokens here are dim until the DM hovers/selects one, then the selected one brightens.
6. **The Battle Mode toggle.** A small pill in the panel header — when ON, glows in `pal.accent`; when OFF, ghost. It announces its state ambiently.
7. **FALLEN dim state.** Token opacity drops to 0.4 with a faint red wash — visible as a "body" on the field but never competing with active combatants.
8. **Token name label.** Below the token in IM Fell English 11px tracked. Visible at all times but small — never the thing your eye lands on first.

On the **player's MapViewer**, the hierarchy flattens: map > tokens > hover-expanded HP. There is no tray, no toggle, no held state.

---

## 4. The DM map panel — annotated wireframes

### 4a. Adventure mode (unchanged from today)

```
┌────────────────────────────────────────────────────────────────┐
│ MAP   Forest Crossing              [⚔ Battle Mode]   ⌃         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                    [ existing MapViewer pan/zoom ]             │
│                                                                │
│                                              [+] [−] [⟳]  72% │
└────────────────────────────────────────────────────────────────┘
```

Battle Mode toggle — ghost pill, 32px tall. No tray, no tokens, no extra chrome.

### 4b. Battle mode — fresh entry (all tokens unplaced)

```
┌────────────────────────────────────────────────────────────────┐
│ MAP   Forest Crossing             [⚔ BATTLE MODE ✓]   ⌃        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                    [ MapViewer pan/zoom — empty of tokens ]    │
│                                                                │
│                                              [+] [−] [⟳]  72% │
├────────────────────────────────────────────────────────────────┤
│  UNPLACED · 7                                          End ▾   │
│  ◉Ar  ◉Eo  ◉Ae   │   ◉Gb1  ◉Gb2  ◉Gb3  ◉Bs                   │
└────────────────────────────────────────────────────────────────┘
```

**Battle Mode toggle ON** — `pal.accent` background, `pal.accentBright` text, the ⚔ glyph glows faintly.

**Token tray** — a 76px strip mounted *below* the MapViewer (not overlaid). "End ▾" opens **End Combat** (clears tokens + flips to Adventure mode) and **Reset Tray** (returns all placed tokens to tray, keeps Battle mode).

**PC token chips** — left half of the tray. 44px circles with each character's `pal.accent` ring. Portrait if set, palette-colored initial otherwise. PCs always sort first for consistent muscle-memory.

**NPC token chips** — right half, separated by a 1px `pal.border` vertical divider. Neutral-grey ring (`pal.border` color) to distinguish from PCs at a glance. Initial-circle fill hashes from NPC `id` so three identical goblins have distinct colors.

### 4c. Battle mode — partial placement, one token held

```
┌────────────────────────────────────────────────────────────────┐
│ MAP   Forest Crossing             [⚔ BATTLE MODE ✓]   ⌃        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│          [◉Ae] ← floating under cursor, 0.88 opacity           │
│                ◉Ar           ← placed PC                       │
│                         ◉Gb1 ← placed NPC                      │
│                                              [+] [−] [⟳]  72% │
│                          × Cancel                              │
├────────────────────────────────────────────────────────────────┤
│  UNPLACED · 4                                          End ▾   │
│  ◉Eo   │   [◉Gb2 selected]  ◉Gb3  ◉Bs                         │
└────────────────────────────────────────────────────────────────┘
```

The held floating token has a `pal.accent` glow halo (pulsing 1.2s). The selected tray chip gets a 2px `pal.accent` border. The `× Cancel` pill (44px touch target) is the universal bailout — bottom-left of the map area during HELD state.

### 4d. Battle mode — hover-expanded token (DM view)

```
           ┌──────────────┐
           │  ┌──────┐    │
           │  │ ◉Ar  │    │  ← 48px portrait (grown from 36px)
           │  └──────┘    │
           │  Aragorn     │
           │  31/44       │
           │  [████████░] │  ← exact HP bar + numerals (DM)
           └──────────────┘
               ↕
           (anchored to original token position)
```

The card is 124px wide, anchored 4px below the grown portrait. The card flips above the token if placed in the bottom 25% of the viewport.

---

## 5. Token visual design

A token is the dashboard's portrait-circle pattern miniaturised. Must be legible at 36px against varied terrain without an opaque background plate that obscures the map.

### Token states (36px diameter at 1× map zoom)

| State | Portrait | Ring | Outline | Opacity | Notes |
|---|---|---|---|---|---|
| **Resting (PC)** | Character portrait, circle crop | 2px `pal.accent` (character's palette) | 1px `rgba(0,0,0,0.4)` outer outline | 1.0 | Outer outline ensures ring reads against light terrain |
| **Resting (NPC, no portrait)** | Colored-initial circle (hash-tinted fill, white initials) | 2px `pal.border` (neutral grey) | 1px `rgba(0,0,0,0.4)` outer outline | 1.0 | Hash-tint distinguishes Goblin A from Goblin B |
| **Held (in flight)** | Same | Same color +1px ring + `pal.accent` glow halo (8px spread, 0.5 opacity, pulsing 1.2s) | Same | 0.88 | Slightly transparent = "not committed" |
| **Selected from map (pick-up)** | Same | Same color +1px ring | Same | 1.0 source ghost at 0.4; floating follower at 0.88 | Ghost marks where the token was |
| **Hover-expanded** | Grows 36px → 48px, HP card slides in below | Same +0.5px | Same | 1.0 | Only one expanded at a time |
| **FALLEN (0 HP)** | Same | Same color, desaturated 60% (`filter: grayscale(0.6)`) | Same | 0.4 | `box-shadow: inset 0 0 6px rgba(192,96,96,0.4)` red wash |
| **Concentrating (PC)** | Same | Same + 6px `pal.gem` dot at top-right, pulsing 1.4s | Same | 1.0 | Echoes dashboard concentration dot |

### Token name label

2px below token, centered. IM Fell English 11px, `letterSpacing: 0.12em`. Color: `pal.text` (PC) / `pal.textBody` (NPC). Background: `rgba(0,0,0,0.55)` pill for legibility against light terrain. Max width 80px, truncates with ellipsis. **Always visible** — never hover-only.

### Token size and zoom relationship

36px diameter at 1× zoom, scaling linearly with MapViewer's `scale` transform. At 5× zoom: 180px (readable portrait). At 0.5×: 18px (initials still distinct). The entire token layer participates in the same `translate/scale` transform as the map image — no per-token math during pan/zoom.

---

## 6. The hover-expand animation ("breathes open")

### Trigger

- **Desktop**: pointer enters token bounding circle. 120ms hover delay before animation fires (prevents accidental triggers during pan).
- **Touch**: long-press of 280ms. Visual feedback: ring brightens linearly during the press.

Only one token expanded at a time. If the user hovers a second token while one is expanded: first collapses (180ms), second begins expanding 40ms later.

### Animation sequence

```
t=0ms         Trigger fires.
t=0–220ms     Portrait scales 36px → 48px (transform-origin: center).
              Easing: cubic-bezier(0.34, 1.56, 0.64, 1) — slight overshoot.
              The "breath in" curve.
t=80–280ms    HP card unfolds downward from token center.
              max-height: 0 → 56px, opacity 0 → 1.
              Easing: cubic-bezier(0.2, 0.8, 0.2, 1) — ease-out cubic.
              Origin: card top aligns with token's bottom edge.
t=120–320ms   Name label translates down 56px to sit beneath the HP card.
              220ms ease-out. The label slides as a single element — not re-rendered.
t=320ms       Settle. Expanded card holds until pointer leaves / touch ends.
```

The staggered timing (portrait first, then card, then label) is the "breathes open" feel. A single synchronised animation reads as a balloon inflating; the stagger reads as a *thing waking up*.

### Collapse animation

```
t=0ms         Pointer leaves / touch ends.
t=0–60ms      20ms hold for accidental hover-out forgiveness, then 40ms grace.
t=60–220ms    All three elements reverse synchronously:
              portrait 48px → 36px (160ms ease-in cubic),
              card max-height 56px → 0 + opacity → 0 (160ms ease-in),
              label slides back to rest position (160ms ease-in).
```

Asymmetric open/close (staggered open, synchronised close) is intentional: open invites attention, close gets out of the way.

### HP card design at token scale

124px wide × 56px tall. Background `pal.surfaceSolid` (opaque — must read against any terrain). 1px `pal.border`, 3px `border-radius`. Anchors 4px below 48px portrait; flips above token if in bottom 25% of viewport.

**Contents top to bottom:**

1. **Name** — Cinzel 13px, `pal.text` (PC) / `pal.textBody` (NPC). Single line, truncated.
2. **HP numerals** — Cinzel 15px `pal.gem`, format `current/max`.
   - DM view (any token): shown.
   - Player viewing own token: shown.
   - Player viewing other PC (partyVisibilityEnabled=true): shown.
   - Player viewing other PC (partyVisibilityEnabled=false): `"HP hidden by DM"` italic, `pal.textMuted`; bar omitted.
   - Player viewing NPC: **omitted entirely** (line collapses).
3. **HP bar** — 100px × 4px, 12px horizontal padding.
   - `>50%` → `#5a9a5a` healthy green
   - `20–50%` → `#c8903c` wounded amber
   - `<20%` → `#c06060` critical red
   - **NPC, player viewing**: health-tier glow line only — a solid horizontal line in tier color + `box-shadow: 0 0 6px <tier color>` glow. No fill bar, no numerals.
4. **Concentration row (optional)** — when concentrating: `◆ Concentrating · [Spell]` in IM Fell English 11px tracked `pal.gem`. Adds 14px; card becomes 66px tall when present.

5. **Remove from map (DM only, FALLEN tokens)** — when the DM hovers a token in the FALLEN dim state, a `Remove from map` action appears at the bottom of the hover card as a ghost button (IM Fell English 10px, `pal.textMuted`, full card width). Tapping it removes the token with the standard 180ms scale+opacity collapse. This is the primary remove surface for fallen enemies — faster than long-press for a DM already hovering to confirm a token's identity. The long-press remove menu remains available on all tokens (fallen or not) as the secondary path.

**Empty state**: if HP data missing, shows `— / —` in `pal.textMuted`, omits bar. Card never fails to appear.

---

## 7. Placement interaction model

### State A — IDLE

Nothing held. Map shows placed tokens at rest. Tray shows unplaced tokens at rest. Hover triggers expand. Tapping tray token → **HELD**.

### State B — HELD (token follows cursor / finger)

- Floating 36px token follows cursor at full position. On touch: rides 36px *above* finger (lift-up offset so finger doesn't obscure).
- Glow halo pulses (1.2s cycle).
- Source: tray chip gets `pal.accent` 2px border + 0.15 tint. Map-source token becomes 0.4 ghost.
- Map pan during HELD works normally. Token tracks in *image-space* coordinates — position committed is fractional coordinate relative to image, not screen position.
- **Cancel paths** (all → IDLE): tap source again, Escape (desktop), `× Cancel` pill (bottom-left, 44px touch target).

### State C — DROP (commit animation)

```
t=0ms         Tap registered. Fractional (x, y) committed to local state.
t=0–180ms     Held token transitions from screen position to image-space
              coordinate. Easing: cubic-bezier(0.34, 1.56, 0.64, 1).
t=120–240ms   Token "settles" — scale 1.0 → 1.08 → 1.0 bounce (120ms ease-out,
              60ms hold, 60ms ease-in). The "the piece has landed" curve.
t=240ms       Ghost source fades out (180ms ease-out).
t=240ms       PATCH /maps/:mapId/tokens fires (200ms debounce to absorb
              rapid sequential placements).
```

### State D — placed (back to IDLE)

Token at committed position. Tray chip removed and tray reflows.

### Remove a placed token

Long-press 480ms (distinct from 280ms hover-expand) or right-click (desktop). Opens micro-action menu: `Remove` (red) + `Cancel` (ghost). On touch: if press continues past 280ms, expand collapses and action menu replaces it at 480ms. Remove → token scales 36px → 0, opacity 1 → 0 (180ms ease-in); tray chip slides back in.

---

## 8. Player map view

Players see the battle map on the Map tab (Profile mode) or Map sub-tab (Session mode). Pan/zoom unchanged. The token layer is an overlay on the MapViewer image-space transform.

**What renders**: all placed tokens with names, palette rings, FALLEN dim, hover-expand (with visibility rules from §6).

**What does not render**: tray, Battle Mode toggle, held-token floater, remove menu, any chrome announcing "battle mode."

**Poll-induced animation policy**:
- Token position changes between polls → smooth 280ms ease-out transition from old to new coords.
- Token appears → fade in 180ms ease-out.
- Token disappears → fade out 180ms ease-in.

`prefers-reduced-motion`: all transitions instant.

---

## 9. Edge cases

**All tokens placed**: tray collapses to 28px status strip: `ALL TOKENS PLACED · 7`. Map panel gains 48px of height. Tap strip to re-expand tray.

**PC removed from party roster mid-combat**: token remains on map as FALLEN dim orphan until DM manually removes it.

**NPC removed from combat tracker**: token stays as FALLEN dim "body" until DM removes it manually. The `Remove from map` action in the hover-expand card is the primary removal path; long-press remove menu is the secondary. (Decision confirmed 2026-06-08.)

**NPC with no portrait**: colored-initial circle, hash-tinted fill from NPC `id`. Three Goblins get distinct fill colors; labels read "Goblin A / B / C" per DM's naming in the tracker.

**Map panned during HELD**: held token tracks in image-space coordinates. Token stays locked to the terrain it was aimed at, not the screen position at commit time.

**Drop outside image bounds**: clamped to 0.0–1.0 fractional space. Token snaps to nearest image edge. Bounce animation still fires. No error state.

**Battle Mode toggled OFF with tokens placed**: confirmation prompt — "Disable Battle Mode? This will clear all N placed tokens." Tokens fade out staggered 40ms each (180ms each), tray collapses, toggle returns to ghost. ~600ms total.

**Player joins mid-combat**: first poll returns current `tokens[]`. All tokens fade in 180ms on first paint.

**Map switched mid-combat**: new map's tokens display immediately. If new map is in Adventure mode, tray disappears. If in Battle mode with existing tokens, tray and tokens appear.

**Empty state — no NPCs in tracker**: NPC tray half shows `No NPCs in combat · Add to tracker →` in IM Fell English 11px `pal.textMuted`. Tap → focuses NPC tracker.

**Empty state — no PCs in party**: PC tray half shows `Add party members in Manage Party →`. Tap → opens Manage Party modal.

**Token tray with 15+ unplaced NPCs**: tray NPC half scrolls horizontally with `overflow-x: auto`. PC half never scrolls (stable 3–6 members).

---

## 10. Motion & animation summary

| Event | Animation | Duration |
|---|---|---|
| Battle Mode ON | Toggle bg fades to `pal.accentDim`; tray slides up (max-height 0 → 76px, 240ms); chips stagger in (40ms offset each, 180ms each) | 240ms + stagger |
| Battle Mode OFF confirmed | Tokens fade out staggered; tray collapses; toggle ghost | ~600ms |
| Token picked up from tray | Tray chip border+tint (120ms); floating token appears opacity+scale 0→1 (180ms ease-out) | 180ms |
| Token picked up from map | Source opacity → 0.4 (180ms); floating token same as above | 180ms |
| Token follows cursor | Direct transform, no animation. Glow halo pulses 1.2s continuous | continuous |
| Drop / commit | Transition to image-space pos (180ms overshoot cubic); scale bounce 1.0→1.08→1.0 (240ms); ghost fades out (180ms) | 300ms total |
| Cancel held | Float opacity → 0 + scale → 0.9 (160ms ease-in); source restoration (160ms) | 160ms |
| Hover-expand open | Portrait 36→48px (220ms overshoot); card max-height+opacity (200ms ease-out, +80ms delay); label translateY (200ms ease-out, +120ms delay) | 320ms total |
| Hover-expand collapse | All three reverse synchronously (160ms ease-in) after 20ms forgiveness | 180ms |
| Token poll move (player) | translate old→new coords (280ms ease-out) | 280ms |
| Token poll appear | opacity+scale 0→1 (180ms ease-out) | 180ms |
| Token poll disappear | opacity+scale 1→0 (180ms ease-in) | 180ms |
| FALLEN state | opacity 1→0.4, grayscale 0→0.6, red inset shadow (220ms ease-out) | 220ms |
| Concentration dot enter | scale+opacity 0→1 (180ms ease-out cubic) | 180ms |
| Remove confirmed | Token scale+opacity 1→0 (180ms ease-in); tray chip slides in (200ms) | 200ms |
| Tray collapse "All placed" | max-height 76→28px (220ms ease-out); text crossfade (180ms) | 220ms |
| `prefers-reduced-motion` | All transitions instant | 0ms |

---

## 11. Mobile vs desktop delta

| Element | Mobile (<900px) | Desktop (≥900px) |
|---|---|---|
| Map height | 320px | 480px |
| Token diameter | 36px | 36px (map-relative, not screen-relative) |
| Held state | Touch: token rides 36px above finger | Desktop: token centered on cursor |
| Hover-expand trigger | Long-press 280ms | Pointer hover, 120ms delay |
| Long-press remove | 480ms (replaces expand if held past 280ms) | 480ms OR right-click |
| Cancel | `× Cancel` pill (44px touch target) prominent | Same pill + Escape key |
| Drag-to-pan vs. held | Native pan gesture preserved; select-then-tap is the placement model | Pointer moves don't conflict |

---

## 12. Coexistence with existing features

| Feature | Effect |
|---|---|
| MapPanel (DM dashboard) | Gains Battle Mode toggle in header; token tray below map when Battle Mode is on |
| MapViewer (player Map tab) | Renders token overlay in image-space; pan/zoom unchanged; hover-expand available |
| Initiative tracker | NPC entries auto-populate NPC tokens in tray |
| NPC combat tracker | Source of NPC tokens and NPC HP for hover card |
| Party roster | Source of PC tokens; `partyVisibilityEnabled` controls hover-card HP visibility |
| Dashboard party cards | Concentration/HP/FALLEN states drive same fields on tokens — both update on same poll tick |
| End Combat | Clears all token positions + flips mapMode back to "adventure" |

---

## 13. Information visibility — exact HP rules

| Viewer | Token hovered | HP shown |
|---|---|---|
| DM | Any PC token | Exact HP numerals + bar |
| DM | Any NPC token | Exact HP numerals + bar |
| Player | Own PC token | Exact HP numerals + bar |
| Player | Other PC (partyVisibilityEnabled=true) | Exact HP numerals + bar |
| Player | Other PC (partyVisibilityEnabled=false) | "HP hidden by DM" italic; bar omitted |
| Player | NPC token | Health tier glow line only (no numerals, no fill bar) |

---

## 14. Files to touch (for code-architect annotation)

**Frontend:**
- `src/features/dmDashboard/MapPanel.jsx` — Battle Mode toggle, token tray, held state, token layer rendering, drop animation
- `src/features/maps/MapViewer.jsx` — token layer integration in image-space transform pipeline, hover-expand, read-only mode
- `src/features/characterSheet/characterSheet.css` + new `src/features/dmDashboard/tokens.css` — token visual states, animations, tray styles, hover-expand keyframes
- `src/api.js` — `patchMapTokens(mapId, { mapMode, tokens }, dmPassword)`, `patchMapCalibration(mapId, { tokenScale }, dmPassword)`
- `src/pages/DmDashboardPage.jsx` — wire `patchMapTokens`, derive token sources from `dmParty` (PCs) and `npcCombat` (NPCs), pass to MapPanel
- `src/pages/CharacterModePage.jsx` — pass `mapLibrary.tokens` and `mapLibrary.mapMode` down to MapViewer

**Backend:**
- `backend/src/handlers/patchMapTokens.js` (new) — DM auth, replaces `tokens[]` and optionally `mapMode` on the map entry in the `map-library` sentinel
- `backend/src/handlers/patchMapCalibration.js` (new) — DM auth, updates `tokenScale` on a single map entry; separate from token writes to keep payloads distinct
- `backend/template.yaml` — add `PATCH /maps/{mapId}/tokens` and `PATCH /maps/{mapId}/calibration` routes
- `backend/src/handlers/getMapLibrary.js` — confirm `tokens[]`, `mapMode`, and `tokenScale` propagate in GET response
- `backend/src/lib/specialRecords.js` — `normalizeMapLibraryRecord()` adds `tokenScale: 1.0` default

---

## 15. Open questions

1. **Token size at 1× zoom — 36px vs 40px.** Brief defaults to 36px. Validate on hardware after first playtest — if portrait crops are unrecognisable at 36px, raise to 40px.

2. **Token position animation cadence on player view.** 280ms smooth transition between polls recommended. If the user wants instant snap (no animation), flag as a preference switch.

3. **NPC removed from tracker mid-combat — leave as FALLEN body or auto-remove?** **Decision (2026-06-08)**: leave as FALLEN dim body marker. DM removes manually via `Remove from map` in hover-expand card (primary) or long-press menu (secondary).

4. **`partyVisibilityEnabled` — does it hide token positions or only hover-expand HP?** Brief recommends positions stay visible, only HP hides. Confirm.

5. **Concentration dot on tokens — include or omit at 36px?** Brief includes it. If playtest finds it too noisy, fall back to "concentration shown in hover card only."

6. **DM visibility when `partyVisibilityEnabled` is false.** DM is always fully privileged regardless. Confirm.

7. **"Preserve positions, hide tokens" mode.** Not included in brief. Flag as v2 if requested.

8. **Should `partyVisibilityEnabled=false` hide other PC token positions entirely?** Current brief only hides HP on hover; positions remain visible. Stricter option available — confirm.

9. **Touch lift-up offset (36px above finger).** Validate on actual hardware, especially tablets with stylus.

10. **Endpoint shape — extend `PATCH /maps/{mapId}/tokens` or add `PATCH /maps/{mapId}/calibration`?** Brief recommends a separate route to keep token-array writes (large payload, frequent) distinct from calibration writes (one number, debounced). Confirm.

11. **Should `tokenScale` apply to the unplaced tray chips?** Brief recommends no — tray is chrome, chips stay at fixed 44px touch-friendly size regardless of calibration. Confirm.

12. **Name-label hide threshold.** Brief sets label to hide when `tokenScale × mapViewerZoom < 0.6`. Tune after playtest if labels vanish too early or too late.

---

## 16. Token scale control (per-map calibration)

### 16.1 The problem and mental model

Battle maps arrive at wildly different intrinsic resolutions. A 4000×3000 map drawn at 140px/square renders 36px tokens as ants. A 1200×900 map at 60px/square renders them as boulders. The fixed 36px default can't serve both.

**Per-map calibration** is the fix — a one-time setting the DM tunes when loading a new map, then forgets. It is distinct from MapViewer zoom:

- **MapViewer zoom** is *navigation* — ephemeral, changes moment-to-moment.
- **Token scale** is *calibration* — set once per map, intrinsic to that map.

The two multiply: `effective_token_px = 36 × tokenScale × mapViewerZoom`. The DM should think of token scale as "how big is one creature on this particular map" and zoom as "how close am I looking right now."

### 16.2 Where the control lives

**A settings popover behind a ⚙ gear icon in the map panel header — not on the main control row.**

Token scale is a one-time-per-map setting, not a per-glance adjustment. A permanent slider in the header steals chrome from moment-to-moment work. The gear popover keeps the header calm.

```
┌──────────────────────────────────────────────────────────────┐
│ MAP   Forest Crossing      [⚔ BATTLE MODE ✓]    [⚙]    ⌃    │
└──────────────────────────────────────────────│───────────────┘
                                               ▼
                         ┌───────────────────────────────────┐
                         │  MAP CALIBRATION                  │
                         │                                   │
                         │  Token size                       │
                         │  [−]  ◐───────●───────◑  [+]  1.4× │
                         │       small        large           │
                         │                                   │
                         │  [⟳ Reset to 1.0×]                │
                         └───────────────────────────────────┘
```

The **⚙** gear is a 32px ghost icon, visible only in Battle Mode. Tapping opens a 240px popover anchored under it (not a modal — tap outside to dismiss). Header label **MAP CALIBRATION** in IM Fell English 11px tracked `pal.textMuted`.

### 16.3 Control type

**A slider with flanking ± stepper buttons and a numeric readout.** Not segmented (too coarse), not stepper alone (no live feedback).

- 180px slider track
- `−` / `+` flanking buttons (32px, 44px touch target via padding); each click = 0.05×
- Numeric readout to the right of the track: `1.4×` in Cinzel 14px `pal.text`
- Thumb: 18px `pal.gem` filled circle; track: `pal.border` 4px with filled portion in `pal.accent`

### 16.4 Value range and default

- **Range**: `0.5×` – `2.5×`
- **Default**: `1.0×`
- **Step**: `0.05×`

`0.5×` = 18px effective token — floor of usefulness (readable as a colored disk). `2.5×` = 90px effective token — fills a 60px/square low-res map without being silly. Hard-clamps at both ends.

### 16.5 Live preview

Dragging the thumb → tokens resize **immediately**, no transition (1:1 coupling between thumb and token size). Clicking ± → 120ms ease-out on token size transform (discrete click deserves a tween; drag does not). Implemented as a CSS variable `--token-scale-multiplier` on the MapViewer root — no token list re-render.

### 16.6 Persistence — per-map in DynamoDB

**Backend-persisted, not sessionStorage.** The DM may set this on Monday and run combat Friday from a different device. `tokenScale: number` (default `1.0`) is stored per-map entry in the `map-library` sentinel.

**Write path**: new `PATCH /maps/{mapId}/calibration` endpoint (DM auth). Debounced 600ms after last slider movement — only the final resting value writes. The existing `PATCH /maps/{mapId}/tokens` stays focused on the token array.

`tokenScale` flows through the existing unauthenticated `GET /maps` so players render tokens at the DM's calibrated size.

### 16.7 Interaction with MapViewer zoom

The two are multiplicative and orthogonal. Neither control affects the other's value. The ⚙ popover label ("MAP CALIBRATION") and different units (`1.4×` vs `72%`) reinforce that these are separate concepts.

When the DM zooms in, tokens grow proportionally — the token scale value unchanged, but the visible size increases. This is correct: tokens should feel the same size relative to the map grid at any zoom level.

### 16.8 Edge cases

**Tokens too small (effective < ~20px)**: name label hides with 180ms ease-out at `tokenScale × mapViewerZoom < 0.6`. Label returns on hover-expand (portrait grows to 48px, label re-appears below HP card).

**Tokens too large**: no special handling — the DM chose it.

**Reset**: `⟳ Reset to 1.0×` ghost button at popover bottom; only renders when `tokenScale !== 1.0`. Tokens animate to 1.0× in 180ms ease-out.

**Map switched while popover open**: popover closes; new map's `tokenScale` becomes active value.

**Legacy maps (no `tokenScale` field)**: treat as `1.0×`. First write persists the value.

**Held token during scale change**: the floating token participates in the same CSS variable — it resizes live.

**Mobile**: slider works with touch; popover becomes a full-width bottom sheet on screens narrower than 360px.
