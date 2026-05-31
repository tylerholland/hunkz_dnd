# Character Card Portrait Treatment — Design Brief

> Visual upgrade to the DM party card portrait (Stories 16 + 20 baseline). Two treatment options proposed, one recommended. Produced by design-strategist as implementation spec.
>
> **Touches:** `src/features/dmDashboard/characterCard.css` (`.cc-card`, `.cc-stripe`, `.cc-header-grid`, `.cc-portrait`, `.cc-portrait img`, `.cc-portrait-initial`), keyframes in `src/features/dmDashboard/dashboard.css`.

---

## 0. Constraints framing this brief

| Constraint | Source | Implication |
|---|---|---|
| Card uses 3-col grid `auto 1fr auto` with `padding: 12px 14px 4px 18px` | `.cc-header-grid` | Resizing portrait widens column 1, compresses name + meta column 2. Must verify column 2 doesn't drop below ~150px at 320px viewport. |
| Cards stack with `margin-bottom: 12px` (one-column grid) and `gap: 16–20px` (two-column grid) | `.cc-card`, `.dm-prototype-cards` | Anything bleeding *upward* eats into the 12–20px gutter to the card above. Anything bleeding *sideways* clips against the grid column wall. |
| Card is `overflow: visible`; popovers, HP delta floats, ghost trails, and the 4px bottom turn-bar already rely on this | `.cc-card`, `.cc-turn-bar`, `.dm-hp-delta` | Bleed approach is *already permitted by the architecture*. No structural change needed. |
| Accent stripe is 3px wide, runs full card height at `left: 0`, top-corner-rounded with `border-radius: 6px 0 0 6px` | `.cc-stripe` | A larger portrait near the top-left will *visually collide* with the stripe unless the portrait either crosses it intentionally (welding) or sits behind it (overlap). |
| Card has 0 HP `deathGlow` animation, `dm-active-turn` glow, condition pulses, FALLEN dim. All apply via `box-shadow` and `opacity` on `.cc-card`. | `characterCard.css`, `dashboard.css` | A portrait that bleeds outside the card MUST inherit these state effects, or it will visually decouple ("the portrait is fine, the body is dying"). Critical. |
| 10 palettes, each with own `--pal-accent`, `--pal-gem`. Vellum is light. | design-system.md | Portrait border + any glow ring must use `--pal-accent`. Must read against both dark and Vellum dashboards. |
| Portrait is the *only* visual element that does not encode session state. It encodes **identity**. | Tier model (Story 16) | Resizing the portrait is buying identity legibility at the cost of square footage previously available to combat-critical content. Justify by reducing other identity-redundancy (e.g. the meta row) if needed. |

---

## 1. Design intent

The 42px portrait does its job — character recognition — but does it *coldly*. A DM scanning four stacked cards reads the **name** first, not the **face**, which is backwards for a tool used at the table with players present. Players say "Aragorn took a hit" out loud; the DM's eye should land on Aragorn's portrait, not skim the name row.

This treatment makes the portrait **the primary identity anchor** of the card — large enough to read facial detail at a glance, distinctive enough that the DM can identify a card before reading any text, and treated with editorial gravity that matches the dark-fantasy tone (Cinzel, small-caps, IM Fell English). The card should feel like a campaign-journal entry, not a contact-list row.

**Emotional goal:** the portraits feel like *characters in the room*, not data records. The accent-colored ring around each one is a small heraldic device — a sigil. The cards feel like a row of standards leaning against the table.

**Functional goal:** zero loss of combat-critical surface. HP bar, conditions, concentration, slots, saves strip — all stay exactly where Story 16 + 20 put them. The portrait grows by reclaiming whitespace, not by displacing content.

**Mental model:** the portrait is *outside the operational area of the card*. The card body is the instrument panel; the portrait is the brass nameplate riveted to its top-left corner.

---

## 2. Information hierarchy

| Rank | Before (Story 16) | After (this brief) |
|---|---|---|
| 1 | **Name** (17px Cinzel small-caps, `accentBright`) | **Portrait** (64–72px circle, accent ring) |
| 2 | AC badge | **Name** (unchanged size, visual emphasis traded down) |
| 3 | Portrait (42px) | AC badge |
| 4 | Race · Class · Lvl meta row | Race · Class · Lvl meta row |
| 5 | ↗ Sheet link | ↗ Sheet link |
| 6 | ⋯ kebab | ⋯ kebab |

The promotion of portrait over name is deliberate. Player-spoken character names are heard, not read; portrait recognition is the channel the eye actually uses. **Name does not shrink** — it stays at 17px Cinzel. We change ranking by enlarging the portrait, not by demoting the name.

Below the header, hierarchy is **unchanged** — HP block remains rank 1 of the card body, as established in Story 16. The portrait does not compete with HP because portrait communicates *who* and HP communicates *what state*. They occupy different cognitive channels.

---

## 3. Option A — The Editorial Slip (RECOMMENDED)

**Concept:** the portrait grows to 64×64px and *bleeds 10px above the top edge of the card*, like a wax seal slipped under the corner of a parchment. The accent stripe widens at the top to become the portrait's left border (welding portrait to spine), then narrows back to 3px below it. The card top padding is reduced from 12px to 4px — the portrait *replaces* that vertical breathing room, it doesn't add to it.

### 3a. Wireframe — ~400px card, healthy state

```
        ╔══════╗
        ║      ║ ← ① portrait bleed envelope, +10px above card top
   ┌────╫──────╫─────────────────────────────────┐
   │ ◢  ║  IMG ║   ARAGORN                ⋯ ②   │
   │ ⑤  ║      ║   Human · Ranger · Lvl 8  ↗ ③  │   [AC 17] ④
   │ ║  ╚══════╝                                │
   │ ║                                          │
   │─║──────────────────────────────────────────│
   │ ║  52 / 60                                 │
   │ ║  [−] [████████████████░░░] [+]            │
   │ ║                                          │
   │ ║  PERC 14 · Wis +1 · Con +5 · Dex +6      │
   │═║══════════════════════════════════════════│
   │ ║  GP  [240 gp]  [Give]                    │
   │ ║                                          │
   │ ║  [+ Note]                                │
   └─╨──────────────────────────────────────────┘
   ↑
   ⑤ stripe — widens to portrait-border width near the top
```

① **Portrait bleed.** 64×64px circle. `margin-top: -10px` relative to the card. The bleed is bounded — it never exceeds 12px (which is the card-stack `margin-bottom`), so it cannot kiss the card above.

② **⋯ kebab.** Unchanged position (top-right). 24×24px tap target.

③ **↗ Sheet link.** Unchanged. Inline with meta row.

④ **AC badge.** Moves to **below the kebab, right-aligned in the actions column**, not next to the name. Required because enlarged portrait + name + AC + kebab in one row won't fit at 320px. AC remains visually anchored top-right but on its own row.

⑤ **Accent stripe transition.** The 3px stripe widens to the portrait's 2px border between `top: 0` and `top: portrait-bottom-edge` (~`top: 56px`), then snaps back to 3px. The portrait's left border *is* the stripe in that region — they are one continuous accent element.

### 3b. State behavior — active-turn + concentration + 0HP

The portrait wears the state. Because the portrait visually escapes the card, it must explicitly inherit the card's state pulses via its own `box-shadow` keyframes that run in sync with the card's `deathGlow` / `dmTurnGlow` rhythm.

```
   ╔══════╗
   ║      ║ ← portrait inherits red deathGlow via outer ring animation
   ║ IMG  ║      box-shadow on portrait's own element
   ║      ║
   ╚══════╝
```

### 3c. CSS spec — Option A

```css
/* Header grid: reduce top padding, fixed portrait column */
.cc-header-grid {
  grid-template-columns: 76px 1fr auto;  /* was: auto 1fr auto */
  gap: 14px;                              /* was: 10px */
  padding: 4px 14px 4px 18px;             /* was: 12px 14px 4px 18px */
  align-items: start;
  position: relative;
  z-index: 1;
}

/* Portrait grows + bleeds */
.cc-portrait {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin-top: -10px;                      /* THE BLEED */
  border: 2px solid var(--pal-accent);
  background: var(--pal-surface-solid);
  overflow: hidden;
  position: relative;
  z-index: 2;                             /* above the stripe */
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.35),
    0 0 0 4px var(--pal-surface-solid);   /* spacer ring punches clean hole in any state-glow */
  transition: box-shadow 0.22s ease, border-color 0.22s ease;
}

.cc-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  filter: brightness(0.97) saturate(0.92);  /* slight aged-parchment feel */
}

.cc-portrait-initial {
  font-family: var(--font-display);
  font-size: 26px;                        /* was: 16px */
  letter-spacing: 0.04em;
  color: var(--pal-gem);
}

/* Stripe: weld with portrait band via ::after */
.cc-stripe::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 2px;                             /* matches portrait border */
  height: 60px;                           /* portrait diameter - 4px overlap */
  background: var(--pal-accent);
  border-radius: 2px 0 0 0;
}

/* HP=0 state: red glow propagates to portrait ring */
.cc-card.hp-zero .cc-portrait {
  border-color: rgba(192, 96, 96, 0.7);
  animation: deathGlowPortrait 3.5s ease-in-out infinite;
}

@keyframes deathGlowPortrait {
  0%, 100% {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 0 0 4px var(--pal-surface-solid),
      0 0 10px 2px rgba(192, 96, 96, 0.25);
  }
  50% {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 0 0 4px var(--pal-surface-solid),
      0 0 22px 6px rgba(192, 96, 96, 0.55);
  }
}

/* Active-turn state: palette gem pulse */
.cc-card.dm-active-turn .cc-portrait {
  border-color: var(--pal-gem);
  animation: portraitTurnGlow 2.2s ease-in-out infinite;
}

@keyframes portraitTurnGlow {
  0%, 100% {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 0 0 4px var(--pal-surface-solid),
      0 0 10px 2px rgba(255, 255, 255, 0.18);
  }
  50% {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 0 0 4px var(--pal-surface-solid),
      0 0 18px 5px rgba(255, 255, 255, 0.32);
  }
}

/* FALLEN: portrait dims with the rest of the card */
.cc-card.fallen .cc-portrait {
  filter: grayscale(0.45) brightness(0.7);
  border-color: rgba(192, 96, 96, 0.5);
  animation: none;
}

/* Actions column: AC badge sits below kebab */
.cc-actions-col {
  min-width: 44px;
  align-items: flex-end;
}
```

### 3d. Actions column reflow

The current `.cc-actions-col` holds only the kebab. Option A moves **AC badge to row 2 below the kebab**. This is required at 320px viewport.

```
┌──────┐
│  ⋯   │   row 1, 24px tall
│      │
│ [17] │   row 2, AC badge (was inline with name)
└──────┘
```

AC's visual rank drops slightly (no longer at eye-corner), which is acceptable — AC is consulted on incoming attacks ~once per round, not continuously. HP remains at full prominence.

---

## 4. Option B — The Embedded Plate (fallback / conservative)

**Concept:** portrait grows to 56×56px but stays **fully inside the card**. Header band expands top padding from 12px to 14px and bottom from 4px to 10px. Accent stripe stays 3px, no welding. Subtle inner glow ring uses `--pal-accent` at 30% alpha.

### 4a. Wireframe — Option B

```
   ┌───────────────────────────────────────────┐
   │ ║                                         │
   │ ║   ⓪⓪⓪⓪                                  │
   │ ║   ⓪IMG⓪    ARAGORN              ⋯  AC   │
   │ ║   ⓪⓪⓪⓪    Human · Ranger · Lvl 8  ↗   │
   │ ║                                         │
   │─║─────────────────────────────────────────│
   │ ║   52 / 60                               │
   │ ║   [−] [████████████████░░] [+]           │
```

Numbers and elements remain in current positions. Change is **only** portrait size (42→56px) and generous negative space. AC stays inline next to the name.

### 4b. CSS spec — Option B

```css
.cc-header-grid {
  grid-template-columns: 64px 1fr auto;
  gap: 12px;
  padding: 14px 14px 10px 18px;
}

.cc-portrait {
  width: 56px;
  height: 56px;
  border: 2px solid var(--pal-accent);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 0 4px rgba(0, 0, 0, 0.18);
}

.cc-portrait-initial {
  font-size: 22px;
}
```

Option B uses the same state keyframes as Option A — only the geometry differs.

### 4c. Why Option B exists

One reason: **stacked-card claustrophobia**. If during prototyping the bleeding portraits of Option A read as floating heads rather than editorial seals, Option B captures most of the identity uplift (42→56px = +78% pixel area) without spatial risk. Prototype Option A first; fall back to B only if the stacked column looks unsettled.

---

## 5. Motion & animation spec

| Trigger | Animation | Duration | Notes |
|---|---|---|---|
| Initial render | None — instant | — | Portraits should feel present, not arriving |
| Portrait URL change | Cross-fade old → new | 240ms ease-out | Communicates: same character, new image |
| Active turn (`.dm-active-turn`) | `portraitTurnGlow` | 2.2s infinite | Matches existing turn-glow rhythm |
| 0 HP (`.hp-zero`) | `deathGlowPortrait` | 3.5s infinite | Matches card `deathGlow` rhythm; border shifts red over 220ms |
| FALLEN (3 failures) | `filter` transition | 320ms ease-out | Grayscale + dim; border fades to muted red |
| NAT20 revival | Border flashes `#5a9a5a` | 700ms, fades back | Mirrors HP heal glow on the portrait |
| HP delta tick (damage/heal) | **None on portrait** | — | Portrait communicates persistent state, not transient events |

**Active-turn wins** over 0-HP state when both are simultaneous — character is at 0 HP but still alive and rolling death saves; the active-turn glow correctly signals "look here now."

**Reduced motion:** all animations replaced with instant state-color swaps.

---

## 6. Interaction model

The portrait is **not interactive** in this brief. No tap handler, no hover state.

- The `↗ Sheet` link is the existing "open this character" affordance — adding portrait-as-link creates two targets for one action
- Hover-to-enlarge adds cognitive overhead in an already-dense tool
- Tap targets on the portrait would compete with the ⋯ popover and HP stepper

**Open hook:** if a "Quick Inspect" feature ships in a future story, portrait becomes its trigger. Flagged in §10.

---

## 7. Edge cases

| Case | Behavior |
|---|---|
| No portrait URL set | Show palette-colored initial letter (existing behavior). Font size: 26px (Option A) / 22px (Option B). The empty-portrait state should look intentional — a sigil, not a missing image. |
| Portrait image fails to load | Add `onError` fallback in React component: fall back to initial letter. (Builder note, not design spec.) |
| Vellum palette (light dashboard) | `--pal-surface-solid` spacer ring becomes a brighter ring — reads fine, reinforces portrait anchoring. |
| FALLEN state (Option A) | Portrait remains bleed-positioned. The silhouette stays in the visual layout even when the character is down — only dims. |
| Adjacent card flashing damage | Does not cross cards. Portrait state inherits only from its own card. |
| Very long character name | Name column is `1fr` with `min-width: 0` — existing ellipsis rules handle it. |
| Active turn + 0 HP simultaneously | Active turn wins (see §5). |
| `<400px` viewport | Option A falls back to Option B geometry (no bleed). |
| `<320px` viewport | Portrait drops to 44px (current size). Treatment disabled. |

---

## 8. z-index map

| Element | z-index | Notes |
|---|---|---|
| `.cc-card` | 0 | Base |
| `.cc-stripe` | 0 | Behind portrait |
| `.cc-header-grid` | 1 | Above stripe |
| `.cc-portrait` (Option A) | 2 | Above stripe AND above card's top edge |
| `.dm-hp-delta` | 10 | Floats above portrait — no visual conflict (deltas appear right of HP bar; portrait is top-left) |
| `.cc-popover` | 400 | Above all portraits |

**The spacer ring is load-bearing.** The `0 0 0 4px var(--pal-surface-solid)` shadow on the portrait ensures it reads as anchored to *its own* card, not floating between cards. Without this ring, a bleeding portrait can appear to belong to the card above it.

---

## 9. Responsive breakpoints

```css
@media (max-width: 400px) {
  .cc-portrait { width: 56px; height: 56px; margin-top: 0; }
  /* AC returns inline with name */
}
@media (max-width: 320px) {
  .cc-portrait { width: 44px; height: 44px; }
  .cc-portrait-initial { font-size: 16px; }
}
```

---

## 10. Open questions

1. **Option A vs B preference.** Prototype A first; validate against a 4-card stack screenshot in Ocean palette. If editorial → ship A. If floating heads → ship B. Tyler decides after seeing both.
2. **Portrait tap target (future story).** Defer. No interactive affordance in this brief.
3. **Circle vs squircle.** This brief specifies circle. A squircle (`border-radius: 30%`) would feel more heraldic. Flag as a tone-experiment for later.
4. **`.cc-stripe::after` vs second DOM node.** Pseudo-element is cleaner; second DOM node is easier to debug. Confirm with code-architect before building.
5. **NPCs.** This brief covers PC party cards only. NPC cards use different shape; deferred.

---

## Summary recommendation

**Build Option A — Editorial Slip.** The 10px upward bleed lives safely inside the 12–20px inter-card gutter. The accent stripe welding resolves the spatial ambiguity of whose card the bleed belongs to. State pulses propagate into the portrait so it never visually decouples from card state. The result feels like a campaign-journal entry, not a contact list.

Fall back to **Option B** only if prototyping reveals the stacked-column reads as floating heads rather than editorial seals.

**Files to touch:**
- `src/features/dmDashboard/characterCard.css` — `.cc-header-grid`, `.cc-portrait`, `.cc-portrait img`, `.cc-portrait-initial`, `.cc-stripe`, `.cc-stripe::after` (new), `.cc-actions-col`, plus state selectors
- `src/features/dmDashboard/dashboard.css` — new keyframes `deathGlowPortrait`, `portraitTurnGlow`
- `src/features/dmDashboard/CharacterCard.jsx` — AC badge moves from name-row to actions column (Option A); `onError` fallback on portrait `<img>`
